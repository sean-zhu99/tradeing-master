export type TradeDirection = 'long' | 'short';
export type TradeStatus = 'open' | 'closed';

export interface Trade {
  id: number;
  tradeId?: string | null;
  symbol: string;
  direction: TradeDirection;
  entryPrice: number;
  exitPrice?: number | null;
  quantity: number;
  leverage: number;
  entryTime: string;
  exitTime?: string | null;
  pnl: number;
  pnlPercentage: number;
  fee: number;
  status: TradeStatus;
  entryReason?: string | null;
  exitReason?: string | null;
  tags: string[];
  notes?: string | null;
  screenshots: string[];
  rating?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface TradePayload {
  tradeId?: string | null;
  symbol: string;
  direction: TradeDirection;
  entryPrice: number;
  exitPrice?: number | null;
  quantity: number;
  leverage?: number;
  entryTime: string;
  exitTime?: string | null;
  pnl?: number;
  pnlPercentage?: number;
  fee?: number;
  status?: TradeStatus;
  entryReason?: string | null;
  exitReason?: string | null;
  tags?: string[];
  notes?: string | null;
  screenshots?: string[];
  rating?: number | null;
}

export type TradeUpdatePayload = Partial<TradePayload>;

export interface TradeFilter {
  startDate?: string;
  endDate?: string;
  symbol?: string;
  direction?: TradeDirection;
  status?: TradeStatus;
  tag?: string;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface DailySummary {
  date: string;
  totalPnl: number;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  totalFee: number;
}

export interface OverallStats {
  totalPnl: number;
  totalFee: number;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  profitLossRatio: number;
  maxDrawdown: number;
  averageHoldingMinutes: number;
}

export interface TagStats {
  tag: string;
  tradeCount: number;
  totalPnl: number;
  winRate: number;
  averagePnl: number;
}

export interface BalanceItem {
  asset: string;
  free: string;
  locked: string;
}

export interface Balance {
  accountType?: string;
  balances: BalanceItem[];
}

export interface SyncResult {
  status: string;
  affectedRows: number;
}

export interface ListResponse<T> {
  data: T[];
  pagination: Pagination;
}

export interface ApiEnvelope<T> {
  data: T;
  pagination?: Pagination;
  message?: string;
}
