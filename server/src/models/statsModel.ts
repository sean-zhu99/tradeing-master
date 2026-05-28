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
