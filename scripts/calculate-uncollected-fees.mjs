#!/usr/bin/env node
/**
 * Calculates uncollected (pending) fees for Uniswap V4 LP positions
 * owned by wallet 0xcDd08205689bfDE7Aa81609697aAbf88Ce7906b6 on Arbitrum One.
 *
 * Usage: node scripts/calculate-uncollected-fees.mjs
 */

import { ethers } from "ethers";

// --- Constants ---
const RPC_URL = "https://arb1.arbitrum.io/rpc";
const POOL_MANAGER = "0x360e68faccca8ca495c1b759fd9eee466db9fb32";
const POSITION_MANAGER = "0xd88F38F930b7952f2DB2432Cb002E7abbF3dD869";
const POOL_ID = "0xab92bb13dae336cebff495ca2bc0238be956b0c89aec23342183a092b22f06aa";

// Tick ranges verified on-chain via getPoolAndPositionInfo
const POSITIONS = [
  { tokenId: 146642n, tickLower: 104800, tickUpper: 115800, liquidity: 8380052099627785901912n },
  { tokenId: 146750n, tickLower: 104600, tickUpper: 108600, liquidity: 12962319182993429123989n },
  { tokenId: 146806n, tickLower: 107400, tickUpper: 111600, liquidity: 12481437836459845701406n },
  { tokenId: 146807n, tickLower: 108600, tickUpper: 110000, liquidity: 64212763316399157751696n },
  { tokenId: 147574n, tickLower: 108600, tickUpper: 109800, liquidity: 26082282696297971040275n },
];

const Q128 = 1n << 128n;
const UINT256_MAX = (1n << 256n) - 1n;

const coder = ethers.AbiCoder.defaultAbiCoder();
const extsloadIface = new ethers.Interface([
  "function extsload(bytes32[] calldata slots) external view returns (bytes32[] memory)",
]);

// --- Raw RPC helper with retries ---

async function ethCall(to, data, retries = 3) {
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
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      return json.result;
    } catch (err) {
      if (attempt < retries) {
        const delay = Math.pow(2, attempt + 1) * 1000;
        console.log(`  RPC call failed, retrying in ${delay / 1000}s... (${err.message})`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
}

// --- Storage slot helpers ---

function getPoolBaseSlot(poolId) {
  return ethers.keccak256(coder.encode(["bytes32", "uint256"], [poolId, 6]));
}

function addSlotOffset(slot, offset) {
  return ethers.toBeHex((BigInt(slot) + BigInt(offset)) & UINT256_MAX, 32);
}

function getTickSlot(baseSlot, tick) {
  const tickMappingSlot = addSlotOffset(baseSlot, 4);
  const encoded = coder.encode(["int24", "uint256"], [tick, tickMappingSlot]);
  return ethers.keccak256(encoded);
}

function getPositionSlot(baseSlot, tokenId, tickLower, tickUpper) {
  const salt = ethers.toBeHex(tokenId, 32);
  const positionKey = ethers.keccak256(
    coder.encode(
      ["address", "int24", "int24", "bytes32"],
      [POSITION_MANAGER, tickLower, tickUpper, salt]
    )
  );
  const positionMappingSlot = addSlotOffset(baseSlot, 5);
  return ethers.keccak256(
    coder.encode(["bytes32", "uint256"], [positionKey, positionMappingSlot])
  );
}

// --- Main logic ---

async function main() {
  console.log("Calculating uncollected fees for Uniswap V4 positions on Arbitrum...\n");

  const baseSlot = getPoolBaseSlot(POOL_ID);
  console.log("Pool base slot:", baseSlot);

  // Collect all unique ticks
  const uniqueTicks = new Set();
  for (const pos of POSITIONS) {
    uniqueTicks.add(pos.tickLower);
    uniqueTicks.add(pos.tickUpper);
  }

  // Build batch of all slots to read
  const slots = [];
  const slotIndex = {};

  // Pool globals: slot0 (+0), feeGrowthGlobal0 (+1), feeGrowthGlobal1 (+2)
  slotIndex.slot0 = slots.length; slots.push(addSlotOffset(baseSlot, 0));
  slotIndex.feeGlobal0 = slots.length; slots.push(addSlotOffset(baseSlot, 1));
  slotIndex.feeGlobal1 = slots.length; slots.push(addSlotOffset(baseSlot, 2));

  // Ticks: feeGrowthOutside0 (+1), feeGrowthOutside1 (+2)
  const tickSlotMap = {};
  for (const tick of uniqueTicks) {
    const tickBaseSlot = getTickSlot(baseSlot, tick);
    tickSlotMap[tick] = { fg0Idx: slots.length, fg1Idx: slots.length + 1 };
    slots.push(addSlotOffset(tickBaseSlot, 1), addSlotOffset(tickBaseSlot, 2));
  }

  // Positions: liquidity (+0), feeGrowthInside0Last (+1), feeGrowthInside1Last (+2)
  const posSlotMap = {};
  for (const pos of POSITIONS) {
    const posBaseSlot = getPositionSlot(baseSlot, pos.tokenId, pos.tickLower, pos.tickUpper);
    posSlotMap[pos.tokenId.toString()] = {
      liqIdx: slots.length,
      fg0LastIdx: slots.length + 1,
      fg1LastIdx: slots.length + 2,
    };
    slots.push(
      addSlotOffset(posBaseSlot, 0),
      addSlotOffset(posBaseSlot, 1),
      addSlotOffset(posBaseSlot, 2)
    );
  }

  console.log(`Reading ${slots.length} storage slots via extsload batch call...`);

  // Encode the extsload call
  const calldata = extsloadIface.encodeFunctionData("extsload", [slots]);
  const rawResult = await ethCall(POOL_MANAGER, calldata);

  // Decode: returns bytes32[] — each 32 bytes after the ABI offset header
  const decoded = extsloadIface.decodeFunctionResult("extsload", rawResult);
  const results = decoded[0]; // bytes32[]

  console.log("Storage read complete.\n");

  // Parse pool globals
  const slot0Raw = BigInt(results[slotIndex.slot0]);
  const currentTick = Number(BigInt.asIntN(24, (slot0Raw >> 160n) & 0xFFFFFFn));
  const sqrtPriceX96 = slot0Raw & ((1n << 160n) - 1n);
  console.log(`Current tick: ${currentTick}`);
  console.log(`sqrtPriceX96: ${sqrtPriceX96}`);

  const feeGrowthGlobal0 = BigInt(results[slotIndex.feeGlobal0]);
  const feeGrowthGlobal1 = BigInt(results[slotIndex.feeGlobal1]);
  console.log(`feeGrowthGlobal0X128: ${feeGrowthGlobal0}`);
  console.log(`feeGrowthGlobal1X128: ${feeGrowthGlobal1}\n`);

  // Parse tick data
  const tickData = {};
  for (const tick of uniqueTicks) {
    const { fg0Idx, fg1Idx } = tickSlotMap[tick];
    tickData[tick] = {
      feeGrowthOutside0: BigInt(results[fg0Idx]),
      feeGrowthOutside1: BigInt(results[fg1Idx]),
    };
  }

  // Calculate fees for each position
  let totalEthFees = 0n;
  let totalIdosFees = 0n;

  for (const pos of POSITIONS) {
    const { liqIdx, fg0LastIdx, fg1LastIdx } = posSlotMap[pos.tokenId.toString()];
    const onChainLiquidity = BigInt(results[liqIdx]) & ((1n << 128n) - 1n);
    const feeGrowthInside0Last = BigInt(results[fg0LastIdx]);
    const feeGrowthInside1Last = BigInt(results[fg1LastIdx]);

    const tickLowerData = tickData[pos.tickLower];
    const tickUpperData = tickData[pos.tickUpper];

    // Calculate feeGrowthInside for the position's range
    let feeGrowthInside0, feeGrowthInside1;

    if (currentTick >= pos.tickUpper) {
      feeGrowthInside0 = (tickUpperData.feeGrowthOutside0 - tickLowerData.feeGrowthOutside0) & UINT256_MAX;
      feeGrowthInside1 = (tickUpperData.feeGrowthOutside1 - tickLowerData.feeGrowthOutside1) & UINT256_MAX;
    } else if (currentTick < pos.tickLower) {
      feeGrowthInside0 = (tickLowerData.feeGrowthOutside0 - tickUpperData.feeGrowthOutside0) & UINT256_MAX;
      feeGrowthInside1 = (tickLowerData.feeGrowthOutside1 - tickUpperData.feeGrowthOutside1) & UINT256_MAX;
    } else {
      feeGrowthInside0 = (feeGrowthGlobal0 - tickLowerData.feeGrowthOutside0 - tickUpperData.feeGrowthOutside0) & UINT256_MAX;
      feeGrowthInside1 = (feeGrowthGlobal1 - tickLowerData.feeGrowthOutside1 - tickUpperData.feeGrowthOutside1) & UINT256_MAX;
    }

    // Pending fees = (feeGrowthInside - feeGrowthInsideLast) * liquidity / 2^128
    const delta0 = (feeGrowthInside0 - feeGrowthInside0Last) & UINT256_MAX;
    const delta1 = (feeGrowthInside1 - feeGrowthInside1Last) & UINT256_MAX;

    const pendingFees0 = (delta0 * pos.liquidity) / Q128;
    const pendingFees1 = (delta1 * pos.liquidity) / Q128;

    totalEthFees += pendingFees0;
    totalIdosFees += pendingFees1;

    console.log(`Position #${pos.tokenId} (ticks ${pos.tickLower} → ${pos.tickUpper}):`);
    console.log(`  On-chain liquidity: ${onChainLiquidity}`);
    console.log(`  feeGrowthInside0Last: ${feeGrowthInside0Last}`);
    console.log(`  feeGrowthInside1Last: ${feeGrowthInside1Last}`);
    console.log(`  feeGrowthInside0:     ${feeGrowthInside0}`);
    console.log(`  feeGrowthInside1:     ${feeGrowthInside1}`);
    console.log(`  delta0: ${delta0}`);
    console.log(`  delta1: ${delta1}`);
    console.log(`  Pending ETH fees:  ${formatEth(pendingFees0)} ETH`);
    console.log(`  Pending IDOS fees: ${formatIdos(pendingFees1)} IDOS`);
    console.log();
  }

  console.log("=".repeat(50));
  console.log("TOTAL PENDING FEES:");
  console.log(`  ETH:  ${formatEth(totalEthFees)}`);
  console.log(`  IDOS: ${formatIdos(totalIdosFees)}`);
}

function formatEth(raw) {
  return ethers.formatEther(raw);
}

function formatIdos(raw) {
  const formatted = ethers.formatEther(raw);
  const [whole, dec] = formatted.split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return dec ? `${withCommas}.${dec.slice(0, 2)}` : withCommas;
}

main().catch(console.error);
