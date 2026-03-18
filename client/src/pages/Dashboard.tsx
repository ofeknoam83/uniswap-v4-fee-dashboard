import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  ArrowUpRight,
  ExternalLink,
  Wallet,
  TrendingUp,
  Layers,
  Activity,
  Info,
  Copy,
  Check,
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";
import {
  WALLET_ADDRESS,
  CHAIN,
  POOL_NAME,
  FEE_TIER,
  TOTAL_ETH_FEES,
  TOTAL_IDOS_FEES,
  TOTAL_USD_FEES,
  POOL_STATS,
  POSITION_IDS,
  FEE_EVENTS,
  DAILY_FEES,
  METHODOLOGY_NOTE,
  DEPLOYER,
  POSITION_DETAILS,
  POSITION_MANAGER,
  type FeeEvent,
  type PositionDetail,
} from "@/lib/data";

interface LivePosition {
  id: number;
  tokenId: string;
  tickLower: number;
  tickUpper: number;
  priceLower: string;
  priceUpper: string;
  isActive: boolean;
}

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function truncateHash(hash: string) {
  return `${hash.slice(0, 10)}...${hash.slice(-4)}`;
}

function formatNumber(n: number, decimals = 2) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatUSD(n: number) {
  return `$${n.toLocaleString("en-US")}`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors"
      data-testid="copy-address"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

// KPI Card
function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: typeof Wallet;
}) {
  return (
    <Card className="border border-border/60">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              {title}
            </p>
            <p className="text-xl font-semibold tabular-nums mt-1 text-foreground">
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
          <div className="p-2 rounded-md bg-primary/8">
            <Icon className="w-4 h-4 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Custom tooltip for bar chart
function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2 shadow-md text-xs">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-muted-foreground">
          <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: p.color }} />
          {p.name}: {p.name === "USD Value" ? formatUSD(p.value) : formatNumber(p.value, 4)}
        </p>
      ))}
    </div>
  );
}

// Fee Events Table
function FeeEventsTable({ events }: { events: FeeEvent[] }) {
  return (
    <Card className="border border-border/60">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold">Fee Collection Events</CardTitle>
          <Badge variant="secondary" className="text-xs font-normal">
            {events.length} events
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-medium h-8 px-4 whitespace-nowrap">Date</TableHead>
                <TableHead className="text-xs font-medium h-8 text-right whitespace-nowrap">ETH</TableHead>
                <TableHead className="text-xs font-medium h-8 text-right whitespace-nowrap">IDOS</TableHead>
                <TableHead className="text-xs font-medium h-8 text-right whitespace-nowrap">USD</TableHead>
                <TableHead className="text-xs font-medium h-8 px-4 text-right whitespace-nowrap">Tx</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e) => (
                <TableRow key={e.id} className="group" data-testid={`fee-event-${e.id}`}>
                  <TableCell className="text-xs px-4 py-2.5 whitespace-nowrap">
                    <span className="text-foreground font-medium">{e.date}</span>
                    <span className="text-muted-foreground ml-1.5">{e.time}</span>
                  </TableCell>
                  <TableCell className="text-xs text-right tabular-nums py-2.5 font-medium whitespace-nowrap">
                    {formatNumber(e.ethAmount, 4)}
                  </TableCell>
                  <TableCell className="text-xs text-right tabular-nums py-2.5 text-muted-foreground whitespace-nowrap">
                    {formatNumber(e.idosAmount, 2)}
                  </TableCell>
                  <TableCell className="text-xs text-right tabular-nums py-2.5 font-medium text-primary whitespace-nowrap">
                    {formatUSD(e.usdValue)}
                  </TableCell>
                  <TableCell className="text-xs text-right px-4 py-2.5 whitespace-nowrap">
                    <a
                      href={`https://arbiscan.io/tx/${e.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                      data-testid={`tx-link-${e.id}`}
                    >
                      <span className="font-mono">{truncateHash(e.txHash)}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// Position NFTs
function PositionsList() {
  return (
    <Card className="border border-border/60">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold">Position NFTs</CardTitle>
          <Badge variant="secondary" className="text-xs font-normal">
            {POSITION_IDS.length} positions
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="flex flex-wrap gap-1.5">
          {POSITION_IDS.map((id) => (
            <a
              key={id}
              href={`https://arbiscan.io/token/0xd88f38f930b7952f2db2432cb002e7abbf3dd869?a=${id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono bg-secondary/60 hover:bg-secondary rounded-md transition-colors text-foreground"
              data-testid={`position-${id}`}
            >
              #{id}
              <ExternalLink className="w-2.5 h-2.5 text-muted-foreground" />
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Active Positions Table (fetches live data from subgraph, falls back to static)
function ActivePositions() {
  const { data, isLoading, error } = useQuery<{ positions: LivePosition[] }>({
    queryKey: ["/api/positions"],
    staleTime: 5 * 60 * 1000, // refresh every 5 minutes
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  });

  const livePositions = data?.positions;
  const activePositions = livePositions?.filter((p) => p.isActive);
  const closedPositions = livePositions?.filter((p) => !p.isActive);
  const usingLiveData = !!livePositions;

  return (
    <Card className="border border-border/60">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold">Active Positions</CardTitle>
          <div className="flex items-center gap-2">
            {usingLiveData && (
              <Badge variant="outline" className="text-[10px] font-normal text-emerald-600 border-emerald-500/30">
                Live
              </Badge>
            )}
            {isLoading && (
              <Badge variant="outline" className="text-[10px] font-normal">
                Loading...
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs font-normal">
              {usingLiveData ? `${activePositions!.length} active` : `${POSITION_DETAILS.length} positions`}
            </Badge>
          </div>
        </div>
        {error && !livePositions && (
          <p className="text-[10px] text-muted-foreground mt-1">
            Using static data (subgraph unavailable)
          </p>
        )}
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-medium h-8 px-4 whitespace-nowrap">NFT ID</TableHead>
                <TableHead className="text-xs font-medium h-8 whitespace-nowrap">Price Range</TableHead>
                <TableHead className="text-xs font-medium h-8 px-4 text-center whitespace-nowrap">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usingLiveData ? (
                <>
                  {activePositions!.map((pos) => (
                    <TableRow key={pos.id} className="group">
                      <TableCell className="text-xs px-4 py-2.5 whitespace-nowrap">
                        <a
                          href={`https://arbiscan.io/token/${POSITION_MANAGER}?a=${pos.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-mono font-medium text-foreground hover:text-primary transition-colors"
                        >
                          #{pos.id}
                          <ExternalLink className="w-2.5 h-2.5 text-muted-foreground" />
                        </a>
                      </TableCell>
                      <TableCell className="text-xs py-2.5 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-muted-foreground">
                            <span className="font-mono">{pos.priceLower}</span>
                            <span className="mx-1">→</span>
                            <span className="font-mono">{pos.priceUpper}</span>
                          </span>
                          <span className="text-[10px] text-muted-foreground/60">
                            Ticks: {pos.tickLower} to {pos.tickUpper}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-center px-4 py-2.5 whitespace-nowrap">
                        <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20 text-[10px] font-medium hover:bg-emerald-500/15">
                          Active
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {closedPositions && closedPositions.length > 0 && (
                    <>
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={3} className="text-xs px-4 py-2 text-muted-foreground font-medium bg-muted/30">
                          Closed Positions ({closedPositions.length})
                        </TableCell>
                      </TableRow>
                      {closedPositions.map((pos) => (
                        <TableRow key={pos.id} className="group opacity-50">
                          <TableCell className="text-xs px-4 py-2.5 whitespace-nowrap">
                            <a
                              href={`https://arbiscan.io/token/${POSITION_MANAGER}?a=${pos.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-mono font-medium text-foreground hover:text-primary transition-colors"
                            >
                              #{pos.id}
                              <ExternalLink className="w-2.5 h-2.5 text-muted-foreground" />
                            </a>
                          </TableCell>
                          <TableCell className="text-xs py-2.5 whitespace-nowrap text-muted-foreground">
                            <span className="font-mono">{pos.priceLower}</span>
                            <span className="mx-1">→</span>
                            <span className="font-mono">{pos.priceUpper}</span>
                          </TableCell>
                          <TableCell className="text-xs text-center px-4 py-2.5 whitespace-nowrap">
                            <Badge variant="secondary" className="text-[10px] font-medium text-muted-foreground">
                              Closed
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </>
                  )}
                </>
              ) : (
                POSITION_DETAILS.map((pos) => (
                  <TableRow key={pos.id} className="group">
                    <TableCell className="text-xs px-4 py-2.5 whitespace-nowrap">
                      <a
                        href={`https://arbiscan.io/token/${POSITION_MANAGER}?a=${pos.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono font-medium text-foreground hover:text-primary transition-colors"
                      >
                        #{pos.id}
                        <ExternalLink className="w-2.5 h-2.5 text-muted-foreground" />
                      </a>
                    </TableCell>
                    <TableCell className="text-xs py-2.5 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground">
                          <span className="font-mono">{pos.priceLower}</span>
                          <span className="mx-1">→</span>
                          <span className="font-mono">{pos.priceUpper}</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground/60">
                          Ticks: {pos.tickLower} to {pos.tickUpper}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-center px-4 py-2.5 whitespace-nowrap">
                      <Badge variant="secondary" className="text-[10px] font-medium text-muted-foreground">
                        Loading...
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// Fee split pie chart data
const PIE_DATA = [
  { name: "Mar 5", value: 2384, fill: "hsl(168, 65%, 38%)" },
  { name: "Mar 8", value: 4199, fill: "hsl(168, 55%, 55%)" },
];

export function Dashboard() {
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border/60 bg-card/50 backdrop-blur-sm sticky top-0 z-20">
          <div className="max-w-6xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <img
                  src="./outerlands-logo.svg"
                  alt="Outerlands Capital"
                  className="h-8 w-auto rounded"
                />
                <div>
                  <h1 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    Uniswap V4 Fee Dashboard
                    <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0">
                      {CHAIN}
                    </Badge>
                  </h1>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-muted-foreground font-mono">
                      {truncateAddress(WALLET_ADDRESS)}
                    </span>
                    <CopyButton text={WALLET_ADDRESS} />
                    <a
                      href={`https://arbiscan.io/address/${WALLET_ADDRESS}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary transition-colors"
                      data-testid="arbiscan-link"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Deployed by</span>
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {DEPLOYER}
                </Badge>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-5">
          {/* Pool info bar */}
          <div className="flex items-center gap-3 mb-5 flex-wrap text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-foreground">Pool:</span>
              <span>{POOL_NAME}</span>
            </div>
            <span className="text-border">|</span>
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-foreground">Fee Tier:</span>
              <span>{FEE_TIER}</span>
            </div>
            <span className="text-border">|</span>
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-foreground">TVL:</span>
              <span>{formatUSD(POOL_STATS.tvl)}</span>
            </div>
            <span className="text-border">|</span>
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-foreground">Txns:</span>
              <span>{POOL_STATS.txCount.toLocaleString()}</span>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <KPICard
              title="Total ETH Fees"
              value={`${formatNumber(TOTAL_ETH_FEES, 4)} ETH`}
              subtitle={`~${formatUSD(TOTAL_USD_FEES)}`}
              icon={Wallet}
            />
            <KPICard
              title="Total IDOS Fees"
              value={formatNumber(TOTAL_IDOS_FEES, 2)}
              subtitle="IDOS tokens"
              icon={TrendingUp}
            />
            <KPICard
              title="Positions"
              value={String(POSITION_IDS.length)}
              subtitle="Active NFTs"
              icon={Layers}
            />
            <KPICard
              title="Collection Events"
              value={String(FEE_EVENTS.length)}
              subtitle="Over 2 days"
              icon={Activity}
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
            {/* Daily fees bar chart */}
            <Card className="border border-border/60 lg:col-span-2">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold">Fees by Date (USD)</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={DAILY_FEES} barCategoryGap="30%">
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `$${v.toLocaleString()}`}
                    />
                    <RechartsTooltip content={<BarTooltip />} />
                    <Bar dataKey="usdValue" name="USD Value" radius={[4, 4, 0, 0]} maxBarSize={60}>
                      {DAILY_FEES.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? "hsl(168, 65%, 38%)" : "hsl(168, 55%, 55%)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Fee distribution pie */}
            <Card className="border border-border/60">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold">Fee Distribution</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 flex flex-col items-center">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={PIE_DATA}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {PIE_DATA.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value: number) => formatUSD(value)}
                      contentStyle={{
                        fontSize: "11px",
                        borderRadius: "6px",
                        border: "1px solid hsl(var(--border))",
                        backgroundColor: "hsl(var(--card))",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-1">
                  {PIE_DATA.map((d) => (
                    <div key={d.name} className="flex items-center gap-1.5 text-xs">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: d.fill }}
                      />
                      <span className="text-muted-foreground">{d.name}</span>
                      <span className="font-medium tabular-nums">{formatUSD(d.value)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Events table */}
          <div className="mb-5">
            <FeeEventsTable events={FEE_EVENTS} />
          </div>

          {/* Active Positions */}
          <div className="mb-5">
            <ActivePositions />
          </div>

          {/* Methodology */}
          <div className="grid grid-cols-1 gap-3 mb-5">
            {/* Methodology */}
            <Card className="border border-border/60">
              <CardHeader className="pb-3 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-muted-foreground" />
                  Methodology
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {METHODOLOGY_NOTE}
                </p>
                <div className="mt-3 flex gap-2 flex-wrap">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a
                        href="https://docs.uniswap.org/sdk/v4/guides/liquidity/collect-fees"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        data-testid="docs-link"
                      >
                        V4 Fee Docs <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">
                      Uniswap V4 fee collection documentation
                    </TooltipContent>
                  </Tooltip>
                  <span className="text-border">|</span>
                  <a
                    href={`https://arbiscan.io/address/${WALLET_ADDRESS}#internaltx`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    data-testid="internal-tx-link"
                  >
                    Internal Txns <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Wallet activity summary */}
          <Card className="border border-border/60 mb-5">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">Wallet Activity Summary</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Initial Funding</p>
                  <p className="text-xs leading-relaxed">
                    <span className="font-medium">3 ETH</span> + <span className="font-medium">2.5M IDOS</span> + <span className="font-medium">80K USDC</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">from idos-network.eth</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">USDC Swap</p>
                  <p className="text-xs leading-relaxed">
                    80K USDC → <span className="font-medium">37.4 ETH</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">via CoW Protocol</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Liquidity Operations</p>
                  <p className="text-xs leading-relaxed">
                    <span className="font-medium">~72.67 ETH</span> deposited
                  </p>
                  <p className="text-xs leading-relaxed">
                    <span className="font-medium">37.65 ETH</span> withdrawn
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Current balance: {POOL_STATS.walletBalance} ETH
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>

        {/* Footer */}
        <footer className="border-t border-border/60 py-4 mt-2">
          <div className="max-w-6xl mx-auto px-4 flex items-center justify-between flex-wrap gap-2">
            <p className="text-[10px] text-muted-foreground">
              Data sourced from Uniswap V4 Subgraph and Arbiscan. Prices approximate at time of collection.
            </p>
            <PerplexityAttribution />
          </div>
        </footer>
      </div>
    </TooltipProvider>
  );
}
