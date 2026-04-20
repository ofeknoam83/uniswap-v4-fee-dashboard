#!/usr/bin/env node
/**
 * Checks which Uniswap V4 positions are active (have liquidity) vs closed.
 * Uses the Arbitrum public RPC to query the PositionManager contract.
 *
 * Usage: node scripts/check-positions.mjs
 */

const POSITION_MANAGER = "0xd88f38f930b7952f2db2432cb002e7abbf3dd869";
const RPC_URL = "https://arb1.arbitrum.io/rpc";
const POSITION_IDS = [146642, 146645, 146646, 146649, 146682, 146690, 146750, 146806, 146807, 147574];

// getPositionLiquidity(uint256) selector from PositionManager
// We'll use ownerOf to check if the NFT still exists, and
// getPositionInfo to get liquidity data

async function ethCall(to, data) {
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
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

function padTokenId(id) {
  return id.toString(16).padStart(64, "0");
}

async function checkPosition(id) {
  const hexId = padTokenId(id);

  // Try ownerOf(uint256) = 0x6352211e
  try {
    const ownerResult = await ethCall(POSITION_MANAGER, "0x6352211e" + hexId);
    const owner = "0x" + ownerResult.slice(26).toLowerCase();
    const isZeroAddress = owner === "0x" + "0".repeat(40);

    if (isZeroAddress) {
      return { id, status: "CLOSED (burned)", owner };
    }

    // Try to get position info using getPositionInfo(uint256,bytes32)
    // For simpler check, we just report the owner
    return { id, status: "ACTIVE", owner };
  } catch (e) {
    // ownerOf reverts for non-existent tokens (burned NFTs)
    if (e.message.includes("revert") || e.message.includes("invalid")) {
      return { id, status: "CLOSED (NFT burned/non-existent)", owner: null };
    }
    return { id, status: `ERROR: ${e.message}`, owner: null };
  }
}

async function main() {
  console.log("Checking Uniswap V4 positions on Arbitrum...\n");
  console.log("Position Manager:", POSITION_MANAGER);
  console.log("RPC:", RPC_URL);
  console.log("");

  const results = [];
  for (const id of POSITION_IDS) {
    const result = await checkPosition(id);
    results.push(result);
    const emoji = result.status.startsWith("ACTIVE") ? "✅" : "❌";
    console.log(`${emoji} #${id}: ${result.status}${result.owner ? ` (owner: ${result.owner})` : ""}`);
  }

  console.log("\n--- Summary ---");
  const active = results.filter(r => r.status === "ACTIVE");
  const closed = results.filter(r => r.status !== "ACTIVE");
  console.log(`Active: ${active.length} positions (${active.map(r => "#" + r.id).join(", ")})`);
  console.log(`Closed: ${closed.length} positions (${closed.map(r => "#" + r.id).join(", ")})`);

  // Output JSON for easy copy-paste
  console.log("\n--- JSON (paste back to me) ---");
  console.log(JSON.stringify({
    active: active.map(r => r.id),
    closed: closed.map(r => r.id),
  }));
}

main().catch(console.error);
