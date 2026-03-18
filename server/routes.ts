import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

const RPC_URL = "https://arb1.arbitrum.io/rpc";
const POSITION_MANAGER = "0xd88f38f930b7952f2db2432cb002e7abbf3dd869";
const WALLET_ADDRESS = "0xcdd08205689bfde7aa81609697aabf88ce7906b6";

// All known position NFT IDs for this wallet
const KNOWN_POSITION_IDS = [
  146642, 146645, 146646, 146649, 146682, 146690, 146750, 146806, 146807,
  147574,
];

// Static position metadata (tick ranges from data.ts)
const POSITION_META: Record<
  number,
  { tickLower: number; tickUpper: number }
> = {
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
  const json = (await res.json()) as { result?: string; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return json.result || "0x";
}

function padHex(id: number): string {
  return id.toString(16).padStart(64, "0");
}

async function checkPositionActive(id: number): Promise<boolean> {
  try {
    // ownerOf(uint256) = 0x6352211e — reverts if NFT is burned
    const result = await ethCall(POSITION_MANAGER, "0x6352211e" + padHex(id));
    const owner = "0x" + result.slice(26).toLowerCase();
    // Position exists if owner is not zero address
    return owner !== "0x" + "0".repeat(40);
  } catch {
    // ownerOf reverts for burned/non-existent NFTs
    return false;
  }
}

// Cache results for 5 minutes
let positionCache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/positions", async (_req, res) => {
    try {
      // Return cached data if fresh
      if (positionCache && Date.now() - positionCache.timestamp < CACHE_TTL) {
        return res.json(positionCache.data);
      }

      // Check each position via RPC
      const results = await Promise.all(
        KNOWN_POSITION_IDS.map(async (id) => {
          const isActive = await checkPositionActive(id);
          const meta = POSITION_META[id] || { tickLower: 0, tickUpper: 0 };
          return {
            id,
            tokenId: id.toString(),
            tickLower: meta.tickLower,
            tickUpper: meta.tickUpper,
            priceLower: tickToPrice(meta.tickLower),
            priceUpper: tickToPrice(meta.tickUpper),
            isActive,
          };
        })
      );

      const responseData = { positions: results };
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

function tickToPrice(tick: number): string {
  const price = Math.pow(1.0001, tick);
  if (price < 0.0001) return price.toExponential(4);
  if (price < 1) return price.toFixed(7);
  return price.toFixed(4);
}
