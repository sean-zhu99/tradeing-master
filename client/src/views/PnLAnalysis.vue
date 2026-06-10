<template>
  <section class="analysis-page">
    <header class="analysis-title">
      <div>
        <span>P&L Analysis</span>
        <h1>盈亏分析</h1>
      </div>
      <el-tag effect="plain" round>MT5 + 交易所合并数据</el-tag>
    </header>

    <div class="metric-grid">
      <article class="metric-card">
        <span>总盈亏</span>
        <strong :class="stats.totalPnl >= 0 ? 'profit-value' : 'loss-value'">{{ formatCurrency(stats.totalPnl) }}</strong>
      </article>
      <article class="metric-card">
        <span>胜率</span>
        <strong>{{ stats.winRate.toFixed(2) }}%</strong>
      </article>
      <article class="metric-card">
        <span>平均盈亏</span>
        <strong :class="stats.averagePnl >= 0 ? 'profit-value' : 'loss-value'">{{ formatCurrency(stats.averagePnl) }}</strong>
      </article>
      <article class="metric-card">
        <span>最大回撤</span>
        <strong class="loss-value">{{ formatDrawdown(stats.maxDrawdown) }}</strong>
      </article>
    </div>

    <section class="chart-grid">
      <el-card class="panel" shadow="never">
        <template #header>每日盈亏</template>
        <div ref="dailyRef" class="chart"></div>
      </el-card>

      <el-card class="panel" shadow="never">
        <template #header>方向表现</template>
        <div ref="directionRef" class="chart"></div>
      </el-card>
    </section>

    <el-card class="panel" shadow="never">
      <template #header>
        <div class="panel-header">
          <span>最大盈利 / 最大亏损</span>
          <small>按单笔净盈亏排序</small>
        </div>
      </template>
      <el-table :data="extremeTrades" stripe>
        <el-table-column prop="tradeId" label="订单ID" min-width="130" />
        <el-table-column prop="symbol" label="品种" width="100" />
        <el-table-column label="方向" width="90">
          <template #default="{ row }">{{ row.direction === 'long' ? 'Long' : 'Short' }}</template>
        </el-table-column>
        <el-table-column label="平仓时间" min-width="160">
          <template #default="{ row }">{{ formatDateTime(row.exitTime || row.entryTime) }}</template>
        </el-table-column>
        <el-table-column label="盈亏" align="right" width="130">
          <template #default="{ row }">
            <span :class="row.pnl >= 0 ? 'profit-value' : 'loss-value'">{{ formatCurrency(row.pnl) }}</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts';
import type { ECharts } from 'echarts';
import dayjs from 'dayjs';
import { useTradingStore } from '@/stores/trading';
import type { Trade } from '@/types';

const tradingStore = useTradingStore();
const dailyRef = ref<HTMLDivElement>();
const directionRef = ref<HTMLDivElement>();
let dailyChart: ECharts | null = null;
let directionChart: ECharts | null = null;

const closedTrades = computed(() => tradingStore.trades.filter((trade) => trade.status === 'closed'));

const stats = computed(() => {
  const wins = closedTrades.value.filter((trade) => trade.pnl > 0);
  const totalPnl = closedTrades.value.reduce((sum, trade) => sum + trade.pnl, 0);

  return {
    totalPnl,
    winRate: closedTrades.value.length ? (wins.length / closedTrades.value.length) * 100 : 0,
    averagePnl: closedTrades.value.length ? totalPnl / closedTrades.value.length : 0,
    maxDrawdown: calculateMaxDrawdown(closedTrades.value)
  };
});

const dailyStats = computed(() => {
  const map = new Map<string, number>();
  for (const trade of closedTrades.value) {
    const date = dayjs(trade.exitTime || trade.entryTime).format('YYYY-MM-DD');
    map.set(date, (map.get(date) || 0) + trade.pnl);
  }
  return Array.from(map.entries())
    .map(([date, pnl]) => ({ date, pnl: Number(pnl.toFixed(2)) }))
    .sort((a, b) => a.date.localeCompare(b.date));
});

const directionStats = computed(() => {
  return ['long', 'short'].map((direction) => {
    const trades = closedTrades.value.filter((trade) => trade.direction === direction);
    return {
      direction,
      pnl: Number(trades.reduce((sum, trade) => sum + trade.pnl, 0).toFixed(2)),
      count: trades.length
    };
  });
});

const extremeTrades = computed(() => {
  const sorted = [...closedTrades.value].sort((a, b) => b.pnl - a.pnl);
  return [...sorted.slice(0, 5), ...sorted.slice(-5).reverse()];
});

onMounted(async () => {
  await tradingStore.loadTrades(1, 500);
  await nextTick();
  renderCharts();
  window.addEventListener('resize', resizeCharts);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCharts);
  dailyChart?.dispose();
  directionChart?.dispose();
});

watch([dailyStats, directionStats], renderCharts);

function renderCharts() {
  if (dailyRef.value) {
    dailyChart = dailyChart || echarts.init(dailyRef.value);
    dailyChart.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: 58, right: 24, top: 28, bottom: 44 },
      xAxis: { type: 'category', data: dailyStats.value.map((item) => item.date.slice(5)) },
      yAxis: { type: 'value', axisLabel: { formatter: '${value}' } },
      series: [
        {
          type: 'bar',
          data: dailyStats.value.map((item) => ({
            value: item.pnl,
            itemStyle: { color: item.pnl >= 0 ? '#2f9d73' : '#d25d52' }
          })),
          barMaxWidth: 34
        }
      ]
    });
  }

  if (directionRef.value) {
    directionChart = directionChart || echarts.init(directionRef.value);
    directionChart.setOption({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        valueFormatter: (value: number) => formatCurrency(value)
      },
      grid: { left: 88, right: 104, top: 38, bottom: 42 },
      xAxis: {
        type: 'value',
        axisLabel: { formatter: '${value}' },
        splitLine: { lineStyle: { color: '#eee6dc' } }
      },
      yAxis: {
        type: 'category',
        data: directionStats.value.map((item) => (item.direction === 'long' ? 'Long' : 'Short')),
        axisTick: { show: false }
      },
      series: [
        {
          type: 'bar',
          data: directionStats.value.map((item) => ({
            value: item.pnl,
            count: item.count,
            itemStyle: { color: item.pnl >= 0 ? '#2f9d73' : '#d25d52' }
          })),
          barMaxWidth: 34,
          label: {
            show: true,
            position: 'right',
            color: '#2f3437',
            formatter: (params: { value: number; data: { count: number } }) =>
              `${params.data.count}笔 · ${formatCurrency(Number(params.value))}`
          }
        }
      ]
    });
  }
}

function resizeCharts() {
  dailyChart?.resize();
  directionChart?.resize();
}

function calculateMaxDrawdown(trades: Trade[]) {
  let equity = 0;
  let peak = 0;
  let drawdown = 0;

  for (const trade of [...trades].sort((a, b) => (a.exitTime || a.entryTime).localeCompare(b.exitTime || b.entryTime))) {
    equity += trade.pnl;
    peak = Math.max(peak, equity);
    drawdown = Math.max(drawdown, peak - equity);
  }

  return Number(drawdown.toFixed(2));
}

function formatCurrency(value: number) {
  return `${value >= 0 ? '+' : '-'}$${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatDrawdown(value: number) {
  return `-$${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatDateTime(value: string) {
  return dayjs(value).format('YYYY-MM-DD HH:mm');
}
</script>

<style scoped>
.analysis-page {
  width: min(1380px, 100%);
  margin: 0 auto;
}

.analysis-title {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 18px;
  border-bottom: 1px solid #e6dfd4;
}

.analysis-title span {
  color: #81786f;
  font-size: 12px;
  font-weight: 760;
  text-transform: uppercase;
}

.analysis-title h1 {
  margin: 8px 0 0;
  font-size: 34px;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin: 18px 0;
}

.metric-card,
.panel {
  border: 1px solid #e6dfd4;
  border-radius: 8px;
  background: #fffdf9;
}

.metric-card {
  padding: 18px;
}

.metric-card span {
  color: #81786f;
  font-size: 12px;
}

.metric-card strong {
  display: block;
  margin-top: 14px;
  font-size: 28px;
}

.chart-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.7fr);
  gap: 14px;
  margin-bottom: 14px;
}

.chart {
  height: 360px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.panel-header small {
  color: #81786f;
}

.profit-value {
  color: #1f9a68;
  font-weight: 760;
}

.loss-value {
  color: #c94f45;
  font-weight: 760;
}

@media (max-width: 960px) {
  .analysis-title {
    align-items: flex-start;
    flex-direction: column;
  }

  .metric-grid,
  .chart-grid {
    grid-template-columns: 1fr;
  }
}
</style>
