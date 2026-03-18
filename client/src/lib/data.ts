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

export const POSITION_IDS = [
  146642, 146645, 146646, 146649, 146682,
  146690, 146750, 146806, 146807, 147574,
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
    txHash: "0xec89dae05ced",
  },
  {
    id: 2,
    date: "2025-03-05",
    time: "15:16 UTC",
    ethAmount: 0.0612,
    idosAmount: 17465.54,
    usdValue: 136,
    txHash: "0x12126ceafa30",
  },
  {
    id: 3,
    date: "2025-03-05",
    time: "21:22 UTC",
    ethAmount: 0.6992,
    idosAmount: 26652.65,
    usdValue: 1553,
    txHash: "0x14632d44c705",
  },
  {
    id: 4,
    date: "2025-03-08",
    time: "14:04 UTC",
    ethAmount: 0.4286,
    idosAmount: 20345.12,
    usdValue: 953,
    txHash: "0xf2f48850f583",
  },
  {
    id: 5,
    date: "2025-03-08",
    time: "14:05 UTC",
    ethAmount: 0.0263,
    idosAmount: 1342.36,
    usdValue: 59,
    txHash: "0xc36d8982a391",
  },
  {
    id: 6,
    date: "2025-03-08",
    time: "14:05 UTC",
    ethAmount: 0.3382,
    idosAmount: 19960.01,
    usdValue: 752,
    txHash: "0x5648534b1516",
  },
  {
    id: 7,
    date: "2025-03-08",
    time: "14:05 UTC",
    ethAmount: 1.0952,
    idosAmount: 62381.52,
    usdValue: 2435,
    txHash: "0x597b10175093",
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
// Only includes the 5 positions with non-zero on-chain liquidity.
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
    tickLower: 34873,
    tickUpper: 52024,
    priceLower: "$12.00",
    priceUpper: "$66.66",
    liquidity: "12962319182993429123989",
    inRange: false,
    isActive: true,
  },
  {
    id: 146806,
    tickLower: 46141,
    tickUpper: 70224,
    priceLower: "$1.94",
    priceUpper: "$21.61",
    liquidity: "12481437836459845701406",
    inRange: false,
    isActive: true,
  },
  {
    id: 146807,
    tickLower: 52024,
    tickUpper: 59841,
    priceLower: "$5.49",
    priceUpper: "$12.00",
    liquidity: "64212763316399157751696",
    inRange: false,
    isActive: true,
  },
  {
    id: 147574,
    tickLower: 52024,
    tickUpper: 58656,
    priceLower: "$6.18",
    priceUpper: "$12.00",
    liquidity: "26082282696297971040275",
    inRange: false,
    isActive: true,
  },
];

export const METHODOLOGY_NOTE =
  "The V4 subgraph does not track per-position fee accrual (collectedFees fields return 0). " +
  "Fee data was extracted from on-chain ERC-20 and internal ETH transfers during zero-liquidity-change " +
  "modifyLiquidity operations on Arbiscan. Only transfers from the Pool Manager to the wallet during " +
  "fee collection transactions are counted.";
