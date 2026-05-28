import { defineStore } from 'pinia';

export type TradeDirection = 'long' | 'short';

export interface TradeRecord {
  id: number;
  symbol: string;
  market: 'forex' | 'crypto';
  direction: TradeDirection;
  entryPrice: number;
  exitPrice: number;
  volume: number;
  pnl: number;
  openedAt: string;
  closedAt?: string;
  tags: string[];
}

export const useTradeStore = defineStore('trade', {
  state: () => ({
    trades: [] as TradeRecord[]
  }),
  getters: {
    totalPnl: (state) => state.trades.reduce((sum, trade) => sum + trade.pnl, 0),
    winRate: (state) => {
      if (!state.trades.length) return 0;
      const wins = state.trades.filter((trade) => trade.pnl > 0).length;
      return Number(((wins / state.trades.length) * 100).toFixed(2));
    }
  },
  actions: {
    setTrades(trades: TradeRecord[]) {
      this.trades = trades;
    }
  }
});
