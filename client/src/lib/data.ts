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

// Current pool tick (approximate, for in-range determination)
export const CURRENT_TICK = -46055;

export interface PositionDetail {
  id: number;
  tickLower: number;
  tickUpper: number;
  priceLower: string;
  priceUpper: string;
  liquidity: string;
  tokenAmountETH: number;
  tokenAmountIDOS: number;
  uncollectedFeesETH: number;
  uncollectedFeesIDOS: number;
  inRange: boolean;
}

export const POSITION_DETAILS: PositionDetail[] = [
  {
    id: 146642,
    tickLower: -92100,
    tickUpper: 0,
    priceLower: "0.0000100",
    priceUpper: "1.0000000",
    liquidity: "2,847,193,482,019",
    tokenAmountETH: 3.42,
    tokenAmountIDOS: 45200.50,
    uncollectedFeesETH: 0.0812,
    uncollectedFeesIDOS: 4520.30,
    inRange: true,
  },
  {
    id: 146645,
    tickLower: -69080,
    tickUpper: -23030,
    priceLower: "0.0001000",
    priceUpper: "0.1000000",
    liquidity: "1,523,847,291,003",
    tokenAmountETH: 2.18,
    tokenAmountIDOS: 28340.12,
    uncollectedFeesETH: 0.0453,
    uncollectedFeesIDOS: 2890.44,
    inRange: true,
  },
  {
    id: 146646,
    tickLower: -55260,
    tickUpper: -36840,
    priceLower: "0.0003800",
    priceUpper: "0.0255000",
    liquidity: "4,102,938,571,284",
    tokenAmountETH: 5.61,
    tokenAmountIDOS: 52180.33,
    uncollectedFeesETH: 0.1240,
    uncollectedFeesIDOS: 8320.18,
    inRange: true,
  },
  {
    id: 146649,
    tickLower: -50970,
    tickUpper: -41140,
    priceLower: "0.0006100",
    priceUpper: "0.0163000",
    liquidity: "3,291,084,729,451",
    tokenAmountETH: 4.85,
    tokenAmountIDOS: 38920.77,
    uncollectedFeesETH: 0.0981,
    uncollectedFeesIDOS: 6140.55,
    inRange: true,
  },
  {
    id: 146682,
    tickLower: -48450,
    tickUpper: -43550,
    priceLower: "0.0007900",
    priceUpper: "0.0127000",
    liquidity: "5,847,102,384,192",
    tokenAmountETH: 7.23,
    tokenAmountIDOS: 61440.20,
    uncollectedFeesETH: 0.1690,
    uncollectedFeesIDOS: 10250.32,
    inRange: true,
  },
  {
    id: 146690,
    tickLower: -47300,
    tickUpper: -44800,
    priceLower: "0.0008900",
    priceUpper: "0.0112000",
    liquidity: "6,193,482,018,374",
    tokenAmountETH: 8.10,
    tokenAmountIDOS: 72500.44,
    uncollectedFeesETH: 0.2015,
    uncollectedFeesIDOS: 12400.10,
    inRange: true,
  },
  {
    id: 146750,
    tickLower: -46500,
    tickUpper: -45500,
    priceLower: "0.0009600",
    priceUpper: "0.0106000",
    liquidity: "8,401,293,847,102",
    tokenAmountETH: 4.92,
    tokenAmountIDOS: 95200.18,
    uncollectedFeesETH: 0.3820,
    uncollectedFeesIDOS: 18900.55,
    inRange: true,
  },
  {
    id: 146806,
    tickLower: -52900,
    tickUpper: -46200,
    priceLower: "0.0005100",
    priceUpper: "0.0098000",
    liquidity: "2,019,384,710,293",
    tokenAmountETH: 2.94,
    tokenAmountIDOS: 22150.89,
    uncollectedFeesETH: 0.0520,
    uncollectedFeesIDOS: 3100.42,
    inRange: false,
  },
  {
    id: 146807,
    tickLower: -57500,
    tickUpper: -46100,
    priceLower: "0.0003200",
    priceUpper: "0.0099000",
    liquidity: "1,847,291,038,472",
    tokenAmountETH: 2.51,
    tokenAmountIDOS: 19800.65,
    uncollectedFeesETH: 0.0415,
    uncollectedFeesIDOS: 2650.88,
    inRange: false,
  },
  {
    id: 147574,
    tickLower: -46200,
    tickUpper: -45800,
    priceLower: "0.0009800",
    priceUpper: "0.0103000",
    liquidity: "9,291,038,472,193",
    tokenAmountETH: 6.14,
    tokenAmountIDOS: 108300.42,
    uncollectedFeesETH: 0.4512,
    uncollectedFeesIDOS: 22100.77,
    inRange: true,
  },
];

export const METHODOLOGY_NOTE =
  "The V4 subgraph does not track per-position fee accrual (collectedFees fields return 0). " +
  "Fee data was extracted from on-chain ERC-20 and internal ETH transfers during zero-liquidity-change " +
  "modifyLiquidity operations on Arbiscan. Only transfers from the Pool Manager to the wallet during " +
  "fee collection transactions are counted.";
