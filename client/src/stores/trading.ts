import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import {
  createTrade as createTradeApi,
  deleteTrade as deleteTradeApi,
  fetchBalance,
  fetchDailySummary,
  fetchOverallStats,
  fetchTagStats,
  fetchTradeDetail,
  fetchTrades,
  triggerSync as triggerSyncApi,
  updateTrade as updateTradeApi
} from '@/api';
import type {
  Balance,
  DailySummary,
  OverallStats,
  Pagination,
  TagStats,
  Trade,
  TradeFilter,
  TradePayload,
  TradeUpdatePayload
} from '@/types';
import { demoTrades } from '@/data/demoTrades';

const defaultPagination: Pagination = {
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 0
};

const defaultOverallStats: OverallStats = {
  totalPnl: 0,
  totalFee: 0,
  tradeCount: 0,
  winCount: 0,
  lossCount: 0,
  winRate: 0,
  profitLossRatio: 0,
  maxDrawdown: 0,
  averageHoldingMinutes: 0
};

const demoBalance: Balance = {
  accountType: 'Demo Portfolio',
  balances: [
    { asset: 'USDT', free: '48520.80', locked: '0' },
    { asset: 'BTC', free: '0.218', locked: '0' },
    { asset: 'ETH', free: '2.4', locked: '0' }
  ]
};

export const useTradingStore = defineStore('trading', () => {
  const trades = ref<Trade[]>([]);
  const selectedTrade = ref<Trade | null>(null);
  const filters = ref<TradeFilter>({});
  const pagination = ref<Pagination>({ ...defaultPagination });
  const dailySummary = ref<DailySummary[]>([]);
  const dailyPagination = ref<Pagination>({ ...defaultPagination });
  const overallStats = ref<OverallStats>({ ...defaultOverallStats });
  const tagStats = ref<TagStats[]>([]);
  const tagPagination = ref<Pagination>({ ...defaultPagination });
  const balance = ref<Balance | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const winRate = computed(() => overallStats.value.winRate);
  const profitLossRatio = computed(() => overallStats.value.profitLossRatio);
  const maxDrawdown = computed(() => overallStats.value.maxDrawdown);

  const filteredTrades = computed(() => {
    return trades.value.filter((trade) => {
      if (filters.value.symbol && trade.symbol !== filters.value.symbol) return false;
      if (filters.value.direction && trade.direction !== filters.value.direction) return false;
      if (filters.value.status && trade.status !== filters.value.status) return false;
      if (filters.value.tag && !trade.tags.includes(filters.value.tag)) return false;
      if (filters.value.startDate && trade.entryTime < filters.value.startDate) return false;
      if (filters.value.endDate && trade.entryTime > filters.value.endDate) return false;
      return true;
    });
  });

  const symbols = computed(() => {
    return Array.from(new Set(trades.value.map((trade) => trade.symbol))).sort();
  });

  const tags = computed(() => {
    return Array.from(new Set(trades.value.flatMap((trade) => trade.tags))).sort();
  });

  async function loadTrades(page = pagination.value.page, pageSize = pagination.value.pageSize) {
    await withRequestState(async () => {
      try {
        const result = await fetchTrades({
          ...filters.value,
          page,
          pageSize
        });

        trades.value = result.data.length ? result.data : [...demoTrades];
        pagination.value = result.data.length
          ? result.pagination
          : { page: 1, pageSize: demoTrades.length, total: demoTrades.length, totalPages: 1 };
      } catch {
        trades.value = [...demoTrades];
        pagination.value = { page: 1, pageSize: demoTrades.length, total: demoTrades.length, totalPages: 1 };
      }
    });
  }

  async function loadTradeDetail(id: number) {
    await withRequestState(async () => {
      selectedTrade.value = await fetchTradeDetail(id);
    });
  }

  async function createTrade(data: TradePayload) {
    await withRequestState(async () => {
      const trade = await createTradeApi(data);
      trades.value = [trade, ...trades.value];
      pagination.value.total += 1;
      pagination.value.totalPages = Math.ceil(pagination.value.total / pagination.value.pageSize);
    });
  }

  async function updateTrade(id: number, data: TradeUpdatePayload) {
    await withRequestState(async () => {
      let trade: Trade;
      try {
        trade = await updateTradeApi(id, data);
      } catch {
        const current = trades.value.find((item) => item.id === id);
        if (!current) throw new Error('交易记录不存在');
        trade = { ...current, ...data, updatedAt: new Date().toISOString() } as Trade;
      }
      const index = trades.value.findIndex((item) => item.id === id);

      if (index >= 0) {
        trades.value.splice(index, 1, trade);
      }

      if (selectedTrade.value?.id === id) {
        selectedTrade.value = trade;
      }
    });
  }

  async function deleteTrade(id: number) {
    await withRequestState(async () => {
      try {
        await deleteTradeApi(id);
      } catch {
        // Demo mode: when the backend is unavailable, keep the review workflow usable locally.
      }
      trades.value = trades.value.filter((trade) => trade.id !== id);
      pagination.value.total = Math.max(0, pagination.value.total - 1);
      pagination.value.totalPages = Math.ceil(pagination.value.total / pagination.value.pageSize);

      if (selectedTrade.value?.id === id) {
        selectedTrade.value = null;
      }
    });
  }

  async function loadDailySummary(page = dailyPagination.value.page) {
    await withRequestState(async () => {
      try {
        const result = await fetchDailySummary({
          startDate: filters.value.startDate,
          endDate: filters.value.endDate,
          page,
          pageSize: dailyPagination.value.pageSize
        });

        dailySummary.value = result.data.length ? result.data : buildDailySummary(trades.value);
        dailyPagination.value = result.data.length
          ? result.pagination
          : { page: 1, pageSize: dailySummary.value.length, total: dailySummary.value.length, totalPages: 1 };
      } catch {
        dailySummary.value = buildDailySummary(trades.value.length ? trades.value : demoTrades);
        dailyPagination.value = { page: 1, pageSize: dailySummary.value.length, total: dailySummary.value.length, totalPages: 1 };
      }
    });
  }

  async function loadOverallStats() {
    await withRequestState(async () => {
      try {
        const data = await fetchOverallStats();
        overallStats.value = data.tradeCount ? data : buildOverallStats(trades.value);
      } catch {
        overallStats.value = buildOverallStats(trades.value.length ? trades.value : demoTrades);
      }
    });
  }

  async function loadTagStats(page = tagPagination.value.page) {
    await withRequestState(async () => {
      try {
        const result = await fetchTagStats({
          page,
          pageSize: tagPagination.value.pageSize
        });

        tagStats.value = result.data.length ? result.data : buildTagStats(trades.value);
        tagPagination.value = result.data.length
          ? result.pagination
          : { page: 1, pageSize: tagStats.value.length, total: tagStats.value.length, totalPages: 1 };
      } catch {
        tagStats.value = buildTagStats(trades.value.length ? trades.value : demoTrades);
        tagPagination.value = { page: 1, pageSize: tagStats.value.length, total: tagStats.value.length, totalPages: 1 };
      }
    });
  }

  async function loadBalance() {
    await withRequestState(async () => {
      try {
        balance.value = await fetchBalance();
      } catch {
        balance.value = demoBalance;
      }
    });
  }

  async function triggerSync() {
    await withRequestState(async () => {
      try {
        await triggerSyncApi();
      } catch {
        trades.value = trades.value.length ? trades.value : [...demoTrades];
      }
      await Promise.all([loadTrades(1), loadDailySummary(1), loadOverallStats(), loadTagStats(1)]);
    });
  }

  function updateFilters(nextFilters: Partial<TradeFilter>) {
    filters.value = {
      ...filters.value,
      ...nextFilters
    };
    pagination.value.page = 1;
  }

  function resetFilters() {
    filters.value = {};
    pagination.value.page = 1;
  }

  function setPage(page: number) {
    pagination.value.page = page;
  }

  function setPageSize(pageSize: number) {
    pagination.value.pageSize = pageSize;
    pagination.value.page = 1;
  }

  async function withRequestState(task: () => Promise<void>) {
    loading.value = true;
    error.value = null;

    try {
      await task();
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : '请求失败，请稍后重试';
      throw caught;
    } finally {
      loading.value = false;
    }
  }

  function getAnalysisTrades(source: Trade[]) {
    return source.filter((trade) => trade.status === 'closed');
  }

  function buildDailySummary(source: Trade[]): DailySummary[] {
    const map = new Map<string, DailySummary>();

    for (const trade of getAnalysisTrades(source)) {
      const date = (trade.exitTime || trade.entryTime).slice(0, 10);
      const current = map.get(date) || {
        date,
        totalPnl: 0,
        tradeCount: 0,
        winCount: 0,
        lossCount: 0,
        totalFee: 0
      };
      current.totalPnl = Number((current.totalPnl + trade.pnl).toFixed(2));
      current.tradeCount += 1;
      current.winCount += trade.pnl > 0 ? 1 : 0;
      current.lossCount += trade.pnl < 0 ? 1 : 0;
      current.totalFee = Number((current.totalFee + trade.fee).toFixed(2));
      map.set(date, current);
    }

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  function buildOverallStats(source: Trade[]): OverallStats {
    const closedTrades = getAnalysisTrades(source);
    const wins = closedTrades.filter((trade) => trade.pnl > 0);
    const losses = closedTrades.filter((trade) => trade.pnl < 0);
    const grossProfit = wins.reduce((sum, trade) => sum + trade.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0));
    const totalPnl = closedTrades.reduce((sum, trade) => sum + trade.pnl, 0);
    const averageHoldingMinutes = closedTrades.length
      ? closedTrades.reduce((sum, trade) => {
          if (!trade.exitTime) return sum;
          return sum + (new Date(trade.exitTime).getTime() - new Date(trade.entryTime).getTime()) / 60000;
        }, 0) / closedTrades.length
      : 0;

    return {
      totalPnl: Number(totalPnl.toFixed(2)),
      totalFee: Number(closedTrades.reduce((sum, trade) => sum + trade.fee, 0).toFixed(2)),
      tradeCount: closedTrades.length,
      winCount: wins.length,
      lossCount: losses.length,
      winRate: closedTrades.length ? Number(((wins.length / closedTrades.length) * 100).toFixed(2)) : 0,
      profitLossRatio: grossLoss ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit ? grossProfit : 0,
      maxDrawdown: calculateMaxDrawdown(closedTrades),
      averageHoldingMinutes: Number(averageHoldingMinutes.toFixed(2))
    };
  }

  function calculateMaxDrawdown(source: Trade[]) {
    let equity = 0;
    let peak = 0;
    let drawdown = 0;

    for (const trade of [...source].sort((a, b) => (a.exitTime || a.entryTime).localeCompare(b.exitTime || b.entryTime))) {
      equity += trade.pnl;
      peak = Math.max(peak, equity);
      drawdown = Math.max(drawdown, peak - equity);
    }

    return Number(drawdown.toFixed(2));
  }

  function buildTagStats(source: Trade[]): TagStats[] {
    const map = new Map<string, { totalPnl: number; tradeCount: number; winCount: number }>();

    for (const trade of getAnalysisTrades(source)) {
      for (const tag of trade.tags) {
        const item = map.get(tag) || { totalPnl: 0, tradeCount: 0, winCount: 0 };
        item.totalPnl += trade.pnl;
        item.tradeCount += 1;
        item.winCount += trade.pnl > 0 ? 1 : 0;
        map.set(tag, item);
      }
    }

    return Array.from(map.entries())
      .map(([tag, item]) => ({
        tag,
        tradeCount: item.tradeCount,
        totalPnl: Number(item.totalPnl.toFixed(2)),
        winRate: Number(((item.winCount / item.tradeCount) * 100).toFixed(2)),
        averagePnl: Number((item.totalPnl / item.tradeCount).toFixed(2))
      }))
      .sort((a, b) => Math.abs(b.totalPnl) - Math.abs(a.totalPnl));
  }

  return {
    trades,
    selectedTrade,
    filters,
    pagination,
    dailySummary,
    dailyPagination,
    overallStats,
    tagStats,
    tagPagination,
    balance,
    loading,
    error,
    winRate,
    profitLossRatio,
    maxDrawdown,
    filteredTrades,
    symbols,
    tags,
    loadTrades,
    loadTradeDetail,
    createTrade,
    updateTrade,
    deleteTrade,
    loadDailySummary,
    loadOverallStats,
    loadTagStats,
    loadBalance,
    triggerSync,
    updateFilters,
    resetFilters,
    setPage,
    setPageSize
  };
});
