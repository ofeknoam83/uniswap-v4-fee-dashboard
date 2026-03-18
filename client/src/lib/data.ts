// Uniswap V4 Fee Collection Data — Arbitrum
// Wallet: 0xcDd08205689bfDE7Aa81609697aAbf88Ce7906b6
// Pool: ETH/IDOS (1% fee tier)

export const WALLET_ADDRESS = "0xcDd08205689bfDE7Aa81609697aAbf88Ce7906b6";
export const POOL_ID = "0xab92bb13dae336cebff495ca2bc0238be956b0c89aec23342183a092b22f06aa";
export const CHAIN = "Arbitrum One";
export const POOL_NAME = "ETH / IDOS";
export const FEE_TIER = "1%";
export const POSITION_MANAGER = "0xd88f38f930b7952f2db2432cb002e7abbf3dd869";
export const ORIGIN_EOA = "0x8bee39a60e5b40fa76669a6ad74e84aa08445a7c";
export const DEPLOYER = "idos-network.eth";

export const TOTAL_ETH_FEES = 2.9618;
export const TOTAL_IDOS_FEES = 182167.61;
export const TOTAL_USD_FEES = 6582;
export const ETH_PRICE_APPROX = 2222; // approx at time of analysis

export const POOL_STATS = {
  tvl: 8365,
  volumeETH: 769.52,
  volumeIDOS: 50800000,
  txCount: 27527,
  walletBalance: 8.336,
};

// Position IDs are now dynamically discovered from the subgraph.
// This list is only used as a fallback reference.
export const POSITION_IDS = [
  146642, 146645, 146646, 146649, 146682,
  146690, 146750, 146806, 146807, 147574,
  151567, 151568, 151573, 151574,
];

export interface FeeEvent {
  id: number;
  date: string;
  time: string;
  ethAmount: number;
  idosAmount: number;
  usdValue: number;
  txHash: string;
  type?: "fee" | "liquidity";
}

export const FEE_EVENTS: FeeEvent[] = [
  {
    id: 1,
    date: "2025-03-05",
    time: "15:15 UTC",
    ethAmount: 0.3130,
    idosAmount: 34020.41,
    usdValue: 695,
    txHash: "0xec89dae035c1dfc262353d69361752e9f00258dc3027e0ab5e1524608ec15ced",
  },
  {
    id: 2,
    date: "2025-03-05",
    time: "15:16 UTC",
    ethAmount: 0.0612,
    idosAmount: 17465.54,
    usdValue: 136,
    txHash: "0x12126cea291aa1e23281649db170180d0af49792e73b9980e1ae522b7c7afa30",
  },
  {
    id: 3,
    date: "2025-03-05",
    time: "21:22 UTC",
    ethAmount: 0.6992,
    idosAmount: 26652.65,
    usdValue: 1553,
    txHash: "0x14632d442a7eea9276a1bf26935b9525575fb7097daab5c31194f025181c7053",
  },
  {
    id: 4,
    date: "2025-03-08",
    time: "14:04 UTC",
    ethAmount: 0.4286,
    idosAmount: 20345.12,
    usdValue: 953,
    txHash: "0xf2f48850f4616e6a643f04c720ad2f25b4e4bc376dfa42f4686ece0e3b14f583",
  },
  {
    id: 5,
    date: "2025-03-08",
    time: "14:05 UTC",
    ethAmount: 0.0263,
    idosAmount: 1342.36,
    usdValue: 59,
    txHash: "0xc36d8982d074f1d619c03432671d6d7aad00bff53bc723f15e295a9d3973a391",
  },
  {
    id: 6,
    date: "2025-03-08",
    time: "14:05 UTC",
    ethAmount: 0.3382,
    idosAmount: 19960.01,
    usdValue: 752,
    txHash: "0x5648534bd224946cc8319408e8e23fee35c54b37d699ad104e58e700528e1516",
  },
  {
    id: 7,
    date: "2025-03-08",
    time: "14:05 UTC",
    ethAmount: 1.0952,
    idosAmount: 62381.52,
    usdValue: 2435,
    txHash: "0x597b101705917d8291ede811533b0160a433c606aa45a9d19968f84770355093",
  },
];

// Aggregated by date for charts
export const DAILY_FEES = [
  {
    date: "Mar 5",
    ethFees: 1.0734,
    idosFees: 78138.60,
    usdValue: 2384,
    events: 3,
  },
  {
    date: "Mar 8",
    ethFees: 1.8883,
    idosFees: 104028.01,
    usdValue: 4199,
    events: 4,
  },
];

// Current pool tick (read from PoolManager via extsload, March 2025)
export const CURRENT_TICK = 115799;

export interface PositionDetail {
  id: number;
  tickLower: number;
  tickUpper: number;
  priceLower: string;
  priceUpper: string;
  liquidity: string;
  inRange: boolean;
  isActive: boolean;
}

// Static fallback — live data is fetched from /api/positions
// Tick ranges verified on-chain via getPoolAndPositionInfo.
// Closed positions (146645, 146646, 146649, 146682, 146690) have zero liquidity.
export const POSITION_DETAILS: PositionDetail[] = [
  {
    id: 146642,
    tickLower: 104800,
    tickUpper: 115800,
    priceLower: "$0.020",
    priceUpper: "$0.060",
    liquidity: "8380052099627785901912",
    inRange: false,
    isActive: true,
  },
  {
    id: 146750,
    tickLower: 104600,
    tickUpper: 108600,
    priceLower: "$0.032",
    priceUpper: "$0.046",
    liquidity: "12962319182993429123989",
    inRange: false,
    isActive: true,
  },
  {
    id: 146806,
    tickLower: 107400,
    tickUpper: 111600,
    priceLower: "$0.026",
    priceUpper: "$0.037",
    liquidity: "12481437836459845701406",
    inRange: false,
    isActive: true,
  },
  {
    id: 146807,
    tickLower: 108600,
    tickUpper: 110000,
    priceLower: "$0.030",
    priceUpper: "$0.034",
    liquidity: "64212763316399157751696",
    inRange: false,
    isActive: true,
  },
  {
    id: 147574,
    tickLower: 108600,
    tickUpper: 109800,
    priceLower: "$0.037",
    priceUpper: "$0.042",
    liquidity: "26082282696297971040275",
    inRange: false,
    isActive: true,
  },
  {
    id: 151567,
    tickLower: 116200,
    tickUpper: 116400,
    priceLower: "$0.019",
    priceUpper: "$0.020",
    liquidity: "57483868946051169312121",
    inRange: true,
    isActive: true,
  },
  {
    id: 151568,
    tickLower: 116200,
    tickUpper: 116400,
    priceLower: "$0.019",
    priceUpper: "$0.020",
    liquidity: "15364208004481557209978",
    inRange: true,
    isActive: true,
  },
  {
    id: 151573,
    tickLower: 116200,
    tickUpper: 116400,
    priceLower: "$0.019",
    priceUpper: "$0.020",
    liquidity: "7696802043555582837063",
    inRange: true,
    isActive: true,
  },
  {
    id: 151574,
    tickLower: 116200,
    tickUpper: 116400,
    priceLower: "$0.019",
    priceUpper: "$0.020",
    liquidity: "127986629002661457068736",
    inRange: true,
    isActive: true,
  },
];

export const METHODOLOGY_NOTE =
  "The V4 subgraph does not track per-position fee accrual (collectedFees fields return 0). " +
  "Fee data was extracted from on-chain ERC-20 and internal ETH transfers during zero-liquidity-change " +
  "modifyLiquidity operations on Arbiscan. Only transfers from the Pool Manager to the wallet during " +
  "fee collection transactions are counted.";
