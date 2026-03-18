import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

const GRAPH_SUBGRAPH_ID = "G5TsTKNi8yhPSV7kycaE23oWbqv9zzNqR49FoEQjzq1r";
const WALLET_ADDRESS = "0xcdd08205689bfde7aa81609697aabf88ce7906b6";

const POSITIONS_QUERY = `
  query GetPositions($owner: String!) {
    positions(where: { owner: $owner }, first: 100) {
      id
      tokenId
      owner
      liquidity
      tickLower {
        tickIdx
      }
      tickUpper {
        tickIdx
      }
      pool {
        id
        tick
        token0 {
          symbol
          decimals
        }
        token1 {
          symbol
          decimals
        }
      }
    }
  }
`;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/positions", async (_req, res) => {
    const apiKey = process.env.GRAPH_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GRAPH_API_KEY not configured" });
    }

    try {
      const endpoint = `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${GRAPH_SUBGRAPH_ID}`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: POSITIONS_QUERY,
          variables: { owner: WALLET_ADDRESS },
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        return res.status(response.status).json({ error: `Subgraph error: ${text}` });
      }

      const data = await response.json();

      if (data.errors) {
        return res.status(500).json({ error: "Subgraph query error", details: data.errors });
      }

      const positions = (data.data?.positions || []).map((pos: any) => {
        const tickLower = parseInt(pos.tickLower?.tickIdx ?? "0");
        const tickUpper = parseInt(pos.tickUpper?.tickIdx ?? "0");
        const liquidity = pos.liquidity || "0";
        const currentTick = parseInt(pos.pool?.tick ?? "0");
        const isActive = BigInt(liquidity) > 0n;
        const inRange = isActive && currentTick >= tickLower && currentTick < tickUpper;

        return {
          id: parseInt(pos.tokenId),
          tokenId: pos.tokenId,
          tickLower,
          tickUpper,
          priceLower: tickToPrice(tickLower),
          priceUpper: tickToPrice(tickUpper),
          liquidity: formatLiquidity(liquidity),
          liquidityRaw: liquidity,
          isActive,
          inRange,
          currentTick,
          pool: {
            token0Symbol: pos.pool?.token0?.symbol || "ETH",
            token1Symbol: pos.pool?.token1?.symbol || "IDOS",
          },
        };
      });

      return res.json({ positions });
    } catch (err: any) {
      console.error("Failed to fetch positions:", err);
      return res.status(500).json({ error: err.message || "Failed to fetch positions" });
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

function formatLiquidity(liquidity: string): string {
  const n = BigInt(liquidity);
  if (n === 0n) return "0";
  const str = n.toString();
  return str.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
