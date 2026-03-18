import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

const RPC_URL = "https://arb1.arbitrum.io/rpc";
const POSITION_MANAGER = "0xd88f38f930b7952f2db2432cb002e7abbf3dd869";
const POOL_ID =
  "0xab92bb13dae336cebff495ca2bc0238be956b0c89aec23342183a092b22f06aa";

// All known position NFT IDs for this wallet
const KNOWN_POSITION_IDS = [
  146642, 146645, 146646, 146649, 146682, 146690, 146750, 146806, 146807,
  147574,
];

// Static position metadata (tick ranges)
const POSITION_META: Record<number, { tickLower: number; tickUpper: number }> =
  {
    146642: { tickLower: -92100, tickUpper: 0 },
    146645: { tickLower: -69080, tickUpper: -23030 },
    146646: { tickLower: -55260, tickUpper: -36840 },
    146649: { tickLower: -50970, tickUpper: -41140 },
    146682: { tickLower: -48450, tickUpper: -43550 },
    146690: { tickLower: -47300, tickUpper: -44800 },
    146750: { tickLower: -46500, tickUpper: -45500 },
    146806: { tickLower: -52900, tickUpper: -46200 },
    146807: { tickLower: -57500, tickUpper: -46100 },
    147574: { tickLower: -46200, tickUpper: -45800 },
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

// --- Price helpers ---

// In this pool: token0 = lower address, token1 = higher address
// tick price = 1.0001^tick = token1/token0
// We need to determine what token0 and token1 are to show USD prices.
// The pool is ETH/IDOS. In V4 with native ETH, currency0 = address(0) = ETH,
// currency1 = IDOS token. So price = IDOS/ETH = 1.0001^tick.
// But given our tick ranges (-46200 range) produce price ≈ 0.00986,
// that means 0.00986 IDOS per 1 ETH, which implies IDOS is very expensive.
// More likely: token0 = IDOS (lower ERC20 address), token1 = WETH.
// price = WETH/IDOS = 1.0001^tick ≈ 0.00986 ETH per 1 IDOS.

function tickToRawPrice(tick: number): number {
  return Math.pow(1.0001, tick);
}

function priceToTick(price: number): number {
  return Math.log(price) / Math.log(1.0001);
}

interface PriceData {
  ethUsd: number;
  idosUsd: number;
  currentTick: number;
}

async function fetchPrices(): Promise<PriceData> {
  try {
    // Fetch ETH and IDOS prices from CoinGecko
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
    const idosUsd = data.idos?.usd || 0.05;

    // Derive current tick from price ratio
    // price = WETH/IDOS = idosUsd / ethUsd (how much ETH per 1 IDOS)
    const ethPerIdos = idosUsd / ethUsd;
    const currentTick = priceToTick(ethPerIdos);

    return { ethUsd, idosUsd, currentTick };
  } catch {
    // Fallback prices if CoinGecko unavailable
    return { ethUsd: 2000, idosUsd: 0.05, currentTick: -45500 };
  }
}

// --- Caching ---

let positionCache: { data: any; timestamp: number } | null = null;
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

      // Fetch prices and position liquidity in parallel
      const [prices, ...liquidities] = await Promise.all([
        fetchPrices(),
        ...KNOWN_POSITION_IDS.map((id) => getPositionLiquidity(id)),
      ]);

      const positions = KNOWN_POSITION_IDS.map((id, i) => {
        const liquidity = liquidities[i];
        const meta = POSITION_META[id] || { tickLower: 0, tickUpper: 0 };
        const isActive = liquidity > 0n;

        // Price range: raw price = ETH per IDOS at each tick
        const rawPriceLower = tickToRawPrice(meta.tickLower);
        const rawPriceUpper = tickToRawPrice(meta.tickUpper);

        // USD range: multiply ETH-per-IDOS by ETH USD price = IDOS USD price at boundary
        const usdPriceLower = rawPriceLower * prices.ethUsd;
        const usdPriceUpper = rawPriceUpper * prices.ethUsd;

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

      // Compute TVL: sum of active position values (rough estimate from liquidity)
      // For a more accurate TVL, we'd need to compute token amounts from liquidity + ticks
      const currentIdosPrice = prices.idosUsd;
      const currentEthPrice = prices.ethUsd;

      const responseData = {
        positions,
        prices: {
          ethUsd: currentEthPrice,
          idosUsd: currentIdosPrice,
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

  return httpServer;
}

function formatUsdPrice(price: number): string {
  if (price < 0.01) return `$${price.toFixed(4)}`;
  if (price < 1) return `$${price.toFixed(3)}`;
  if (price < 100) return `$${price.toFixed(2)}`;
  return `$${Math.round(price).toLocaleString()}`;
}
