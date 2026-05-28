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

export interface TradeRow {
  id: number;
  trade_id: string | null;
  symbol: string;
  direction: TradeDirection;
  entry_price: string | number;
  exit_price: string | number | null;
  quantity: string | number;
  leverage: number;
  entry_time: Date | string;
  exit_time: Date | string | null;
  pnl: string | number;
  pnl_percentage: string | number;
  fee: string | number;
  status: TradeStatus;
  entry_reason: string | null;
  exit_reason: string | null;
  tags: string | string[] | null;
  notes: string | null;
  screenshots: string | string[] | null;
  rating: number | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface TradeFilters {
  startDate?: string;
  endDate?: string;
  symbol?: string;
  direction?: TradeDirection;
  status?: TradeStatus;
  tag?: string;
}

export interface PaginationOptions {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateTradeInput {
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

export type UpdateTradeInput = Partial<CreateTradeInput>;
