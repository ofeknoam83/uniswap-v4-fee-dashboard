import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

const RPC_URL = "https://arb1.arbitrum.io/rpc";
const POSITION_MANAGER = "0xd88f38f930b7952f2db2432cb002e7abbf3dd869";
const STATE_VIEW = "0x76fd297e2d437cd7f76d50f01afe6160f86e9990";
const POOL_ID =
  "0xab92bb13dae336cebff495ca2bc0238be956b0c89aec23342183a092b22f06aa";
const GRAPH_API_KEY = process.env.GRAPH_API_KEY || "";
const V4_SUBGRAPH_ID = "G5TsTKNi8yhPSV7kycaE23oWbqv9zzNqR49FoEQjzq1r";
const WALLET_ORIGIN = "0x8bee39a60e5b40fa76669a6ad74e84aa08445a7c";

// All known position NFT IDs for this wallet
const KNOWN_POSITION_IDS = [146642, 146750, 146806, 146807, 147574];

// Static position metadata (tick ranges)
// Pool: token0 = ETH (native), token1 = IDOS
// price = 1.0001^tick = IDOS/ETH, so IDOS_USD = ETH_USD / 1.0001^tick
const POSITION_META: Record<number, { tickLower: number; tickUpper: number }> =
  {
    146642: { tickLower: 104800, tickUpper: 115800 },
    146750: { tickLower: 34873, tickUpper: 52024 },
    146806: { tickLower: 46141, tickUpper: 70224 },
    146807: { tickLower: 52024, tickUpper: 59841 },
    147574: { tickLower: 52024, tickUpper: 58656 },
  };

// --- RPC helpers ---

async function ethCall(to: string, data: string): Promise<string> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_call",
      params: [{ to, data }, "latest"],
      id: 1,
    }),
  });
  const json = (await res.json()) as {
    result?: string;
    error?: { message: string };
  };
  if (json.error) throw new Error(json.error.message);
  return json.result || "0x";
}

function padHex(id: number): string {
  return id.toString(16).padStart(64, "0");
}

// getPositionLiquidity(uint256) = 0x1efeed33
async function getPositionLiquidity(id: number): Promise<bigint> {
  try {
    const result = await ethCall(
      POSITION_MANAGER,
      "0x1efeed33" + padHex(id)
    );
    if (!result || result === "0x") return 0n;
    return BigInt(result);
  } catch {
    return 0n;
  }
}

// --- Pool state helpers ---

// getSlot0(bytes32) = 0xc815641c — returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)
async function getCurrentTick(): Promise<number | null> {
  try {
    // Pool ID without 0x prefix, already 32 bytes
    const poolIdParam = POOL_ID.slice(2);
    const result = await ethCall(STATE_VIEW, "0xc815641c" + poolIdParam);
    if (!result || result === "0x" || result.length < 130) return null;
    // Result layout: uint160 sqrtPriceX96 (32 bytes) | int24 tick (32 bytes) | ...
    // tick is at offset 32 bytes (64 hex chars) after 0x prefix
    const tickHex = result.slice(2 + 64, 2 + 128);
    const tickBigInt = BigInt("0x" + tickHex);
    // int24 is signed — check if negative (top bit of int256 set)
    if (tickBigInt > BigInt("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")) {
      return Number(tickBigInt - BigInt("0x10000000000000000000000000000000000000000000000000000000000000000"));
    }
    return Number(tickBigInt);
  } catch (err) {
    console.error("Failed to get current tick from StateView:", err);
    return null;
  }
}

// --- Price helpers ---

// Pool: token0 = ETH (native addr 0), token1 = IDOS
// 1.0001^tick = IDOS per ETH
// IDOS USD price at tick = ETH_USD / 1.0001^tick

function tickToIdosUsd(tick: number, ethUsd: number): number {
  return ethUsd / Math.pow(1.0001, tick);
}

interface PriceData {
  ethUsd: number;
  idosUsd: number;
  currentTick: number;
}

async function fetchPriceData(): Promise<PriceData> {
  // Fetch current tick from on-chain StateView and prices from CoinGecko in parallel
  const [currentTick, coingeckoData] = await Promise.all([
    getCurrentTick(),
    fetchCoinGeckoPrices(),
  ]);

  const ethUsd = coingeckoData.ethUsd;
  const idosUsd = coingeckoData.idosUsd;

  // For in-range checking: prefer on-chain tick, fall back to CoinGecko-derived tick
  const tick = currentTick ?? coingeckoData.fallbackTick;

  return { ethUsd, idosUsd, currentTick: tick };
}

async function fetchCoinGeckoPrices(): Promise<{
  ethUsd: number;
  idosUsd: number;
  fallbackTick: number;
}> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,idos&vs_currencies=usd",
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) throw new Error("CoinGecko API error");
    const data = (await res.json()) as {
      ethereum?: { usd: number };
      idos?: { usd: number };
    };

    const ethUsd = data.ethereum?.usd || 2000;
    const idosUsd = data.idos?.usd || 0.02;

    // Compute fallback tick: tick = ln(IDOS_per_ETH) / ln(1.0001)
    const idosPerEth = ethUsd / idosUsd;
    const fallbackTick = Math.round(
      Math.log(idosPerEth) / Math.log(1.0001)
    );

    return { ethUsd, idosUsd, fallbackTick };
  } catch {
    // Fallback: IDOS ~$0.02, ETH ~$2000
    const ethUsd = 2000;
    const idosUsd = 0.02;
    const fallbackTick = Math.round(
      Math.log(ethUsd / idosUsd) / Math.log(1.0001)
    );
    return { ethUsd, idosUsd, fallbackTick };
  }
}

// --- Subgraph helpers ---

interface SubgraphFeeEvent {
  id: string;
  timestamp: string;
  amount: string | number; // liquidity delta (0 = fee collection)
  amount0: string; // ETH (token0)
  amount1: string; // IDOS (token1)
  tickLower: string;
  tickUpper: string;
  transaction: { id: string };
}

async function introspectSubgraph(): Promise<string[]> {
  const url = `https://gateway.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/${V4_SUBGRAPH_ID}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `{ __schema { queryType { fields { name } } } }`,
      }),
      signal: AbortSignal.timeout(10000),
    });
    const json = (await res.json()) as {
      data?: { __schema: { queryType: { fields: { name: string }[] } } };
    };
    const fields =
      json.data?.__schema.queryType.fields.map((f) => f.name) || [];
    console.log("Subgraph query fields:", fields.join(", "));
    return fields;
  } catch (err) {
    console.error("Failed to introspect subgraph:", err);
    return [];
  }
}

// Cache introspection result
let subgraphFields: string[] | null = null;

async function fetchFeeEvents(): Promise<SubgraphFeeEvent[]> {
  const url = `https://gateway.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/${V4_SUBGRAPH_ID}`;

  // Introspect schema once to find the right entity name
  if (!subgraphFields) {
    subgraphFields = await introspectSubgraph();
  }

  const entityName = subgraphFields.includes("modifyLiquidities")
    ? "modifyLiquidities"
    : subgraphFields.includes("modifyLiquiditys")
      ? "modifyLiquiditys"
      : null;

  if (!entityName) {
    console.error(
      "No modifyLiquidity entity found. Available:",
      subgraphFields.join(", "),
    );
    return [];
  }

  console.log(`Using subgraph entity: ${entityName}`);

  // First: broad query to find ANY events for this origin (no amount filter)
  // The origin address must be lowercase for subgraph queries
  const originLower = WALLET_ORIGIN.toLowerCase();
  const query = `{
    ${entityName}(
      where: {
        origin: "${originLower}"
      }
      orderBy: timestamp
      orderDirection: asc
      first: 100
    ) {
      id
      timestamp
      amount
      amount0
      amount1
      tickLower
      tickUpper
      transaction { id }
    }
  }`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Subgraph error: ${res.status}`);
    const json = (await res.json()) as {
      data?: Record<string, SubgraphFeeEvent[]>;
      errors?: { message: string }[];
    };
    if (json.errors?.length) {
      console.error("Subgraph query error:", json.errors[0].message);
      throw new Error(json.errors[0].message);
    }
    const allEvents = json.data?.[entityName] || [];
    console.log(`Subgraph returned ${allEvents.length} total events for origin ${originLower}`);

    // Return ALL events — in V4, fees are collected as part of every
    // modifyLiquidity call and are embedded in amount0/amount1.
    // Events with amount=0 are pure fee collections (may be $0 if out of range).
    // Events with amount!=0 include both liquidity changes and accrued fees.
    return allEvents;
  } catch (err) {
    console.error("Failed to fetch fee events from subgraph:", err);
    return [];
  }
}

// --- Caching ---

let positionCache: { data: any; timestamp: number } | null = null;
let feeCache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

// --- Routes ---

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/positions", async (_req, res) => {
    try {
      if (positionCache && Date.now() - positionCache.timestamp < CACHE_TTL) {
        return res.json(positionCache.data);
      }

      // Fetch prices/tick and position liquidity in parallel
      const [prices, ...liquidities] = await Promise.all([
        fetchPriceData(),
        ...KNOWN_POSITION_IDS.map((id) => getPositionLiquidity(id)),
      ]);

      const positions = KNOWN_POSITION_IDS.map((id, i) => {
        const liquidity = liquidities[i];
        const meta = POSITION_META[id] || { tickLower: 0, tickUpper: 0 };
        const isActive = liquidity > 0n;

        // IDOS USD price at each tick boundary
        // tickLower → higher IDOS price, tickUpper → lower IDOS price
        const usdAtTickLower = tickToIdosUsd(meta.tickLower, prices.ethUsd);
        const usdAtTickUpper = tickToIdosUsd(meta.tickUpper, prices.ethUsd);

        // Display range as low price to high price
        const usdPriceLower = Math.min(usdAtTickLower, usdAtTickUpper);
        const usdPriceUpper = Math.max(usdAtTickLower, usdAtTickUpper);

        // In range: current tick falls within position's tick range
        const inRange =
          isActive &&
          prices.currentTick >= meta.tickLower &&
          prices.currentTick < meta.tickUpper;

        return {
          id,
          tokenId: id.toString(),
          tickLower: meta.tickLower,
          tickUpper: meta.tickUpper,
          liquidity: liquidity.toString(),
          isActive,
          inRange,
          usdPriceLower: formatUsdPrice(usdPriceLower),
          usdPriceUpper: formatUsdPrice(usdPriceUpper),
        };
      });

      const responseData = {
        positions,
        prices: {
          ethUsd: prices.ethUsd,
          idosUsd: prices.idosUsd,
          currentTick: Math.round(prices.currentTick),
        },
      };

      positionCache = { data: responseData, timestamp: Date.now() };
      return res.json(responseData);
    } catch (err: any) {
      console.error("Failed to fetch positions:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to fetch positions" });
    }
  });

  app.get("/api/fees", async (_req, res) => {
    try {
      if (feeCache && Date.now() - feeCache.timestamp < CACHE_TTL) {
        return res.json(feeCache.data);
      }

      const [events, prices] = await Promise.all([
        fetchFeeEvents(),
        fetchPriceData(),
      ]);

      const feeEvents = events
        .filter((e) => {
          // Only include events with actual token movement
          const eth = Math.abs(parseFloat(e.amount0));
          const idos = Math.abs(parseFloat(e.amount1));
          return eth > 0 || idos > 0;
        })
        .map((e, i) => {
          const ts = parseInt(e.timestamp) * 1000;
          const date = new Date(ts);
          const ethAmount = Math.abs(parseFloat(e.amount0));
          const idosAmount = Math.abs(parseFloat(e.amount1));
          const usdValue =
            ethAmount * prices.ethUsd + idosAmount * prices.idosUsd;
          // In V4, fee collections are modifyLiquidity calls with zero liquidity delta.
          // Events with non-zero amount are liquidity adds/removes (which may also
          // auto-collect fees, but the amount0/amount1 includes the liquidity change).
          const isFeeOnly =
            e.amount === "0" || e.amount === 0;

          return {
            id: i + 1,
            date: date.toISOString().split("T")[0],
            time:
              date.toISOString().split("T")[1].slice(0, 5) + " UTC",
            ethAmount,
            idosAmount,
            usdValue: Math.round(usdValue * 100) / 100,
            txHash: e.transaction.id,
            type: isFeeOnly ? "fee" : "liquidity",
          };
        });

      // Aggregate by date for charts
      const dailyMap = new Map<
        string,
        {
          ethFees: number;
          idosFees: number;
          usdValue: number;
          events: number;
        }
      >();
      for (const e of feeEvents) {
        const d = new Date(e.date);
        const label =
          d.toLocaleString("en-US", { month: "short" }) + " " + d.getDate();
        const existing = dailyMap.get(label) || {
          ethFees: 0,
          idosFees: 0,
          usdValue: 0,
          events: 0,
        };
        existing.ethFees += e.ethAmount;
        existing.idosFees += e.idosAmount;
        existing.usdValue += e.usdValue;
        existing.events += 1;
        dailyMap.set(label, existing);
      }
      const dailyFees = Array.from(dailyMap.entries()).map(
        ([date, data]) => ({
          date,
          ethFees: Math.round(data.ethFees * 10000) / 10000,
          idosFees: Math.round(data.idosFees * 100) / 100,
          usdValue: Math.round(data.usdValue * 100) / 100,
          events: data.events,
        })
      );

      // Only sum fee-only events (zero liquidity delta) for the totals.
      // Liquidity adds/removes are shown in the table but excluded from fee totals.
      const feeOnlyEvents = feeEvents.filter((e) => e.type === "fee");
      const totalEthFees = feeOnlyEvents.reduce(
        (sum, e) => sum + e.ethAmount,
        0
      );
      const totalIdosFees = feeOnlyEvents.reduce(
        (sum, e) => sum + e.idosAmount,
        0
      );
      const totalUsdFees =
        totalEthFees * prices.ethUsd + totalIdosFees * prices.idosUsd;

      const responseData = {
        events: feeEvents,
        dailyFees,
        totals: {
          ethFees: Math.round(totalEthFees * 10000) / 10000,
          idosFees: Math.round(totalIdosFees * 100) / 100,
          usdFees: Math.round(totalUsdFees * 100) / 100,
        },
        prices: {
          ethUsd: prices.ethUsd,
          idosUsd: prices.idosUsd,
        },
      };

      feeCache = { data: responseData, timestamp: Date.now() };
      return res.json(responseData);
    } catch (err: any) {
      console.error("Failed to fetch fees:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to fetch fees" });
    }
  });

  return httpServer;
}

function formatUsdPrice(price: number): string {
  if (price < 0.01) return `$${price.toFixed(4)}`;
  if (price < 1) return `$${price.toFixed(3)}`;
  if (price < 100) return `$${price.toFixed(2)}`;
  return `$${Math.round(price).toLocaleString()}`;
}
