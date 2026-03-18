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
const WALLET_ADDRESS = "0xcDd08205689bfDE7Aa81609697aAbf88Ce7906b6";
const WALLET_ORIGIN = "0x8bee39a60e5b40fa76669a6ad74e84aa08445a7c";
const IDOS_TOKEN = "0x68731d6F14B827bBCfFbEBb62b19Daa18de1d79c";

// --- RPC helpers ---

async function ethCall(to: string, data: string, retries = 2): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_call",
          params: [{ to, data }, "latest"],
          id: 1,
        }),
        signal: AbortSignal.timeout(8000),
      });
      const json = (await res.json()) as {
        result?: string;
        error?: { message: string };
      };
      if (json.error) throw new Error(json.error.message);
      return json.result || "0x";
    } catch (err) {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  return "0x";
}

// Run async functions in batches to avoid overwhelming the RPC
async function batchParallel<T>(fns: (() => Promise<T>)[], batchSize = 5): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < fns.length; i += batchSize) {
    const batch = fns.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((fn) => fn()));
    results.push(...batchResults);
  }
  return results;
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

// --- Position discovery ---

// Decode packed PositionInfo (uint256) to extract tickLower and tickUpper
// Layout: [poolId (25 bytes / 200 bits)] [tickUpper (3 bytes / 24 bits)] [tickLower (3 bytes / 24 bits)] [hasSubscriber (1 byte / 8 bits)]
function decodePositionInfo(info: bigint): { tickLower: number; tickUpper: number } {
  const tickLowerRaw = Number((info >> 8n) & 0xFFFFFFn);
  const tickUpperRaw = Number((info >> 32n) & 0xFFFFFFn);
  // Sign-extend from 24-bit
  const tickLower = tickLowerRaw >= 0x800000 ? tickLowerRaw - 0x1000000 : tickLowerRaw;
  const tickUpper = tickUpperRaw >= 0x800000 ? tickUpperRaw - 0x1000000 : tickUpperRaw;
  return { tickLower, tickUpper };
}

// getPoolAndPositionInfo(uint256) = 0x7ba03aad
// Returns: (PoolKey memory poolKey, uint256 info)
async function getPositionInfo(id: number): Promise<{ tickLower: number; tickUpper: number } | null> {
  try {
    const result = await ethCall(
      POSITION_MANAGER,
      "0x7ba03aad" + padHex(id)
    );
    if (!result || result === "0x" || result.length < 386) return null;
    // The result is ABI-encoded: PoolKey (5 fields × 32 bytes = 160 bytes) + info (32 bytes)
    // PoolKey: currency0(32) + currency1(32) + fee(32) + tickSpacing(32) + hooks(32) = 160 bytes = 320 hex chars
    // info is at offset 320 hex chars after 0x prefix
    const infoHex = result.slice(2 + 320, 2 + 384);
    const info = BigInt("0x" + infoHex);
    return decodePositionInfo(info);
  } catch {
    return null;
  }
}

// Discover all position token IDs owned by the wallet from the subgraph
interface DiscoveredPosition {
  id: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  isActive: boolean;
}

let fullPositionCache: { positions: DiscoveredPosition[]; timestamp: number } | null = null;
let inflightDiscovery: Promise<DiscoveredPosition[]> | null = null;
const POSITION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function discoverPositionIds(): Promise<number[]> {
  const url = GRAPH_API_KEY
    ? `https://gateway.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/${V4_SUBGRAPH_ID}`
    : `https://gateway.thegraph.com/api/subgraphs/id/${V4_SUBGRAPH_ID}`;

  const ownerLower = WALLET_ADDRESS.toLowerCase();

  try {
    const query = `{
      positions(where: { owner: "${ownerLower}" }, first: 1000) {
        tokenId
      }
    }`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Subgraph error: ${res.status}`);
    const json = (await res.json()) as {
      data?: { positions: { tokenId: string }[] };
      errors?: { message: string }[];
    };
    if (json.errors?.length) throw new Error(json.errors[0].message);
    const ids = (json.data?.positions || []).map((p) => parseInt(p.tokenId));
    console.log(`Discovered ${ids.length} position IDs from subgraph: ${ids.join(", ")}`);
    return ids;
  } catch (err) {
    console.error("Failed to discover positions from subgraph:", err);
    // Fallback: return known IDs if subgraph fails
    return [146642, 146645, 146646, 146649, 146682, 146690, 146750, 146806, 146807, 147574, 151567, 151568, 151573, 151574, 151575];
  }
}

// Fully dynamic: discover IDs from subgraph, then fetch tick ranges + liquidity from on-chain
// Uses inflight deduplication so concurrent callers share a single RPC burst.
async function discoverAllPositions(): Promise<DiscoveredPosition[]> {
  // Return cached if fresh
  if (fullPositionCache && Date.now() - fullPositionCache.timestamp < POSITION_CACHE_TTL) {
    return fullPositionCache.positions;
  }

  // Deduplicate concurrent calls — if a discovery is already inflight, wait for it
  if (inflightDiscovery) {
    return inflightDiscovery;
  }

  inflightDiscovery = (async () => {
    try {
      const ids = await discoverPositionIds();
      if (ids.length === 0) return [];

      // Fetch tick ranges and liquidity in controlled batches (5 at a time)
      // to avoid overwhelming the public Arbitrum RPC
      const results = await batchParallel(
        ids.map((id) => async () => {
          const [posInfo, liquidity] = await Promise.all([
            getPositionInfo(id),
            getPositionLiquidity(id),
          ]);
          if (!posInfo) return null;
          return {
            id,
            tickLower: posInfo.tickLower,
            tickUpper: posInfo.tickUpper,
            liquidity,
            isActive: liquidity > 0n,
          } as DiscoveredPosition;
        }),
        5
      );

      const positions = (results as (DiscoveredPosition | null)[]).filter((p): p is DiscoveredPosition => p !== null);
      console.log(`Resolved ${positions.length} positions with on-chain tick data`);
      for (const p of positions) {
        console.log(`  #${p.id}: ticks ${p.tickLower} <> ${p.tickUpper}, liquidity=${p.liquidity > 0n ? "YES" : "NO"}`);
      }

      fullPositionCache = { positions, timestamp: Date.now() };
      return positions;
    } finally {
      inflightDiscovery = null;
    }
  })();

  return inflightDiscovery;
}

// --- Pool state helpers ---

interface Slot0Data {
  sqrtPriceX96: bigint;
  tick: number;
}

// getSlot0(bytes32) = 0xc815641c — returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)
async function getSlot0(): Promise<Slot0Data | null> {
  try {
    const poolIdParam = POOL_ID.slice(2);
    const result = await ethCall(STATE_VIEW, "0xc815641c" + poolIdParam);
    if (!result || result === "0x" || result.length < 130) return null;
    // sqrtPriceX96 is in the first 32 bytes
    const sqrtPriceHex = result.slice(2, 2 + 64);
    const sqrtPriceX96 = BigInt("0x" + sqrtPriceHex);
    // tick is at offset 32 bytes (64 hex chars)
    const tickHex = result.slice(2 + 64, 2 + 128);
    const tickBigInt = BigInt("0x" + tickHex);
    let tick: number;
    if (tickBigInt > BigInt("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")) {
      tick = Number(tickBigInt - BigInt("0x10000000000000000000000000000000000000000000000000000000000000000"));
    } else {
      tick = Number(tickBigInt);
    }
    return { sqrtPriceX96, tick };
  } catch (err) {
    console.error("Failed to get slot0 from StateView:", err);
    return null;
  }
}

async function getCurrentTick(): Promise<number | null> {
  const slot0 = await getSlot0();
  return slot0?.tick ?? null;
}

// --- Wallet balance helpers ---

async function getEthBalance(address: string): Promise<bigint> {
  try {
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getBalance",
        params: [address, "latest"],
        id: 1,
      }),
    });
    const json = (await res.json()) as { result?: string; error?: { message: string } };
    if (json.error) throw new Error(json.error.message);
    return BigInt(json.result || "0x0");
  } catch {
    return 0n;
  }
}

// ERC-20 balanceOf(address) = 0x70a08231
async function getTokenBalance(token: string, address: string): Promise<bigint> {
  try {
    const paddedAddr = address.slice(2).toLowerCase().padStart(64, "0");
    const result = await ethCall(token, "0x70a08231" + paddedAddr);
    if (!result || result === "0x") return 0n;
    return BigInt(result);
  } catch {
    return 0n;
  }
}

// --- Uniswap V3/V4 liquidity math ---
// Compute token0 (ETH) and token1 (IDOS) amounts from liquidity, tick range, and current sqrtPriceX96

const Q96 = 1n << 96n;

function tickToSqrtPriceX96(tick: number): bigint {
  // sqrt(1.0001^tick) * 2^96
  const sqrtPrice = Math.sqrt(Math.pow(1.0001, tick));
  // Convert to Q96 — use BigInt for precision
  return BigInt(Math.round(sqrtPrice * Number(Q96)));
}

function getPositionAmounts(
  liquidity: bigint,
  tickLower: number,
  tickUpper: number,
  currentTick: number,
  sqrtPriceX96: bigint
): { amount0: bigint; amount1: bigint } {
  const sqrtLower = tickToSqrtPriceX96(tickLower);
  const sqrtUpper = tickToSqrtPriceX96(tickUpper);

  let amount0 = 0n;
  let amount1 = 0n;

  if (currentTick < tickLower) {
    // Current price below range — all in token0 (ETH)
    // amount0 = L * (1/sqrtLower - 1/sqrtUpper) = L * (sqrtUpper - sqrtLower) / (sqrtLower * sqrtUpper) * 2^96
    amount0 = (liquidity * Q96 * (sqrtUpper - sqrtLower)) / (sqrtLower * sqrtUpper);
  } else if (currentTick >= tickUpper) {
    // Current price above range — all in token1 (IDOS)
    // amount1 = L * (sqrtUpper - sqrtLower) / 2^96
    amount1 = (liquidity * (sqrtUpper - sqrtLower)) / Q96;
  } else {
    // In range — split between both tokens
    // amount0 = L * (1/sqrtPrice - 1/sqrtUpper)
    amount0 = (liquidity * Q96 * (sqrtUpper - sqrtPriceX96)) / (sqrtPriceX96 * sqrtUpper);
    // amount1 = L * (sqrtPrice - sqrtLower)
    amount1 = (liquidity * (sqrtPriceX96 - sqrtLower)) / Q96;
  }

  return { amount0: amount0 < 0n ? 0n : amount0, amount1: amount1 < 0n ? 0n : amount1 };
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

// Price cache to avoid hammering APIs on every request
let priceCache: { ethUsd: number; idosUsd: number; fallbackTick: number; timestamp: number } | null = null;
const PRICE_CACHE_TTL = 60 * 1000; // 1 minute

async function fetchCoinGeckoPrices(): Promise<{
  ethUsd: number;
  idosUsd: number;
  fallbackTick: number;
}> {
  // Return cached prices if fresh
  if (priceCache && Date.now() - priceCache.timestamp < PRICE_CACHE_TTL) {
    return priceCache;
  }

  let ethUsd = 0;
  let idosUsd = 0;

  // Try CoinGecko first
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,idos&vs_currencies=usd",
      { signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const data = (await res.json()) as {
        ethereum?: { usd: number };
        idos?: { usd: number };
      };
      ethUsd = data.ethereum?.usd || 0;
      idosUsd = data.idos?.usd || 0;
    }
  } catch {
    // CoinGecko failed, try alternatives
  }

  // If CoinGecko didn't return ETH price, try CoinPaprika (no rate limit)
  if (!ethUsd) {
    try {
      const res = await fetch(
        "https://api.coinpaprika.com/v1/tickers/eth-ethereum",
        { signal: AbortSignal.timeout(5000) }
      );
      if (res.ok) {
        const data = (await res.json()) as { quotes?: { USD?: { price?: number } } };
        ethUsd = data.quotes?.USD?.price || 0;
      }
    } catch {
      // CoinPaprika also failed
    }
  }

  // If still no IDOS price, try CoinPaprika for IDOS
  if (!idosUsd) {
    try {
      const res = await fetch(
        "https://api.coinpaprika.com/v1/tickers/idos-idos",
        { signal: AbortSignal.timeout(5000) }
      );
      if (res.ok) {
        const data = (await res.json()) as { quotes?: { USD?: { price?: number } } };
        idosUsd = data.quotes?.USD?.price || 0;
      }
    } catch {
      // CoinPaprika also failed for IDOS
    }
  }

  // Final fallback only if all APIs failed
  if (!ethUsd) ethUsd = 2000;
  if (!idosUsd) idosUsd = 0.02;

  const idosPerEth = ethUsd / idosUsd;
  const fallbackTick = Math.round(
    Math.log(idosPerEth) / Math.log(1.0001)
  );

  const result = { ethUsd, idosUsd, fallbackTick };
  priceCache = { ...result, timestamp: Date.now() };
  return result;
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

      // Dynamic discovery: fetch positions from subgraph + on-chain data
      const [prices, discoveredPositions] = await Promise.all([
        fetchPriceData(),
        discoverAllPositions(),
      ]);

      const positions = discoveredPositions.map((p) => {
        // IDOS USD price at each tick boundary
        // tickLower → higher IDOS price, tickUpper → lower IDOS price
        const usdAtTickLower = tickToIdosUsd(p.tickLower, prices.ethUsd);
        const usdAtTickUpper = tickToIdosUsd(p.tickUpper, prices.ethUsd);

        // Display range as low price to high price
        const usdPriceLower = Math.min(usdAtTickLower, usdAtTickUpper);
        const usdPriceUpper = Math.max(usdAtTickLower, usdAtTickUpper);

        // In range: current tick falls within position's tick range
        const inRange =
          p.isActive &&
          prices.currentTick >= p.tickLower &&
          prices.currentTick < p.tickUpper;

        return {
          id: p.id,
          tokenId: p.id.toString(),
          tickLower: p.tickLower,
          tickUpper: p.tickUpper,
          liquidity: p.liquidity.toString(),
          isActive: p.isActive,
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

  // Verified fee collection events (zero-liquidity-change modifyLiquidity operations)
  // extracted from on-chain Arbiscan data. The V4 subgraph doesn't index historical
  // fee collections for this wallet, so we use verified static data.
  const VERIFIED_FEE_EVENTS = [
    { date: "2025-03-05", time: "15:15 UTC", ethAmount: 0.3130, idosAmount: 34020.41, txHash: "0xec89dae035c1dfc262353d69361752e9f00258dc3027e0ab5e1524608ec15ced" },
    { date: "2025-03-05", time: "15:16 UTC", ethAmount: 0.0612, idosAmount: 17465.54, txHash: "0x12126cea291aa1e23281649db170180d0af49792e73b9980e1ae522b7c7afa30" },
    { date: "2025-03-05", time: "21:22 UTC", ethAmount: 0.6992, idosAmount: 26652.65, txHash: "0x14632d442a7eea9276a1bf26935b9525575fb7097daab5c31194f025181c7053" },
    { date: "2025-03-08", time: "14:04 UTC", ethAmount: 0.4286, idosAmount: 20345.12, txHash: "0xf2f48850f4616e6a643f04c720ad2f25b4e4bc376dfa42f4686ece0e3b14f583" },
    { date: "2025-03-08", time: "14:05 UTC", ethAmount: 0.0263, idosAmount: 1342.36, txHash: "0xc36d8982d074f1d619c03432671d6d7aad00bff53bc723f15e295a9d3973a391" },
    { date: "2025-03-08", time: "14:05 UTC", ethAmount: 0.3382, idosAmount: 19960.01, txHash: "0x5648534bd224946cc8319408e8e23fee35c54b37d699ad104e58e700528e1516" },
    { date: "2025-03-08", time: "14:05 UTC", ethAmount: 1.0952, idosAmount: 62381.52, txHash: "0x597b101705917d8291ede811533b0160a433c606aa45a9d19968f84770355093" },
  ];

  app.get("/api/fees", async (_req, res) => {
    try {
      if (feeCache && Date.now() - feeCache.timestamp < CACHE_TTL) {
        return res.json(feeCache.data);
      }

      const prices = await fetchPriceData();

      // Use verified on-chain fee data, with live USD pricing
      const feeEvents = VERIFIED_FEE_EVENTS.map((e, i) => {
        const usdValue =
          e.ethAmount * prices.ethUsd + e.idosAmount * prices.idosUsd;
        return {
          id: i + 1,
          date: e.date,
          time: e.time,
          ethAmount: e.ethAmount,
          idosAmount: e.idosAmount,
          usdValue: Math.round(usdValue * 100) / 100,
          txHash: e.txHash,
          type: "fee" as const,
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

      const totalEthFees = feeEvents.reduce(
        (sum, e) => sum + e.ethAmount,
        0
      );
      const totalIdosFees = feeEvents.reduce(
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

  // --- Wallet balance endpoint ---
  let walletCache: { data: any; timestamp: number } | null = null;

  app.get("/api/wallet", async (_req, res) => {
    try {
      if (walletCache && Date.now() - walletCache.timestamp < CACHE_TTL) {
        return res.json(walletCache.data);
      }

      // Fetch everything in parallel: balances, prices, positions, pool state
      const [ethBalanceRaw, idosBalanceRaw, prices, positions, slot0] = await Promise.all([
        getEthBalance(WALLET_ADDRESS),
        getTokenBalance(IDOS_TOKEN, WALLET_ADDRESS),
        fetchPriceData(),
        discoverAllPositions(),
        getSlot0(),
      ]);

      // Convert raw balances to human-readable (18 decimals for both)
      const ethBalance = Number(ethBalanceRaw) / 1e18;
      const idosBalance = Number(idosBalanceRaw) / 1e18;

      // Compute position token amounts
      let totalPositionEth = 0;
      let totalPositionIdos = 0;
      const positionBreakdown: { id: number; ethAmount: number; idosAmount: number; usdValue: number }[] = [];

      if (slot0) {
        for (const pos of positions) {
          if (!pos.isActive) continue;
          const { amount0, amount1 } = getPositionAmounts(
            pos.liquidity,
            pos.tickLower,
            pos.tickUpper,
            slot0.tick,
            slot0.sqrtPriceX96
          );
          const ethAmt = Number(amount0) / 1e18;
          const idosAmt = Number(amount1) / 1e18;
          totalPositionEth += ethAmt;
          totalPositionIdos += idosAmt;
          positionBreakdown.push({
            id: pos.id,
            ethAmount: Math.round(ethAmt * 10000) / 10000,
            idosAmount: Math.round(idosAmt * 100) / 100,
            usdValue: Math.round((ethAmt * prices.ethUsd + idosAmt * prices.idosUsd) * 100) / 100,
          });
        }
      }

      const walletUsd = ethBalance * prices.ethUsd + idosBalance * prices.idosUsd;
      const positionsUsd = totalPositionEth * prices.ethUsd + totalPositionIdos * prices.idosUsd;
      const totalUsd = walletUsd + positionsUsd;

      const responseData = {
        wallet: {
          ethBalance: Math.round(ethBalance * 10000) / 10000,
          idosBalance: Math.round(idosBalance * 100) / 100,
          usdValue: Math.round(walletUsd * 100) / 100,
        },
        positions: {
          ethTotal: Math.round(totalPositionEth * 10000) / 10000,
          idosTotal: Math.round(totalPositionIdos * 100) / 100,
          usdValue: Math.round(positionsUsd * 100) / 100,
          breakdown: positionBreakdown,
        },
        total: {
          ethTotal: Math.round((ethBalance + totalPositionEth) * 10000) / 10000,
          idosTotal: Math.round((idosBalance + totalPositionIdos) * 100) / 100,
          usdValue: Math.round(totalUsd * 100) / 100,
        },
        prices: {
          ethUsd: prices.ethUsd,
          idosUsd: prices.idosUsd,
        },
      };

      walletCache = { data: responseData, timestamp: Date.now() };
      return res.json(responseData);
    } catch (err: any) {
      console.error("Failed to fetch wallet data:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to fetch wallet data" });
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
