<template>
  <section class="mt5-page">
    <header class="report-hero">
      <div>
        <span>MT5 Static Report</span>
        <h1>MT5 导出交易报表</h1>
        <p>
          账户 {{ mt5ReportMeta.account }} · {{ mt5ReportMeta.server }} ·
          {{ mt5ReportMeta.periodLabel }}
        </p>
      </div>
      <el-tag effect="plain" round>{{ mt5ReportTrades.length }} 笔交易</el-tag>
    </header>

    <div class="metric-grid">
      <article class="metric-card">
        <span>净盈亏</span>
        <strong :class="stats.netPnl >= 0 ? 'profit-value' : 'loss-value'">
          {{ formatCurrency(stats.netPnl) }}
        </strong>
        <small>已扣手续费与库存费</small>
      </article>
      <article class="metric-card">
        <span>胜率</span>
        <strong>{{ stats.winRate.toFixed(2) }}%</strong>
        <small>{{ stats.winCount }} 胜 / {{ stats.lossCount }} 负</small>
      </article>
      <article class="metric-card">
        <span>盈亏比</span>
        <strong>{{ stats.profitFactor.toFixed(2) }}</strong>
        <small>总盈利 / 总亏损</small>
      </article>
      <article class="metric-card">
        <span>手续费</span>
        <strong>{{ formatCurrency(stats.fee) }}</strong>
        <small>Swap {{ formatCurrency(stats.swap) }}</small>
      </article>
    </div>

    <div class="report-grid">
      <el-card class="panel chart-panel" shadow="never">
        <template #header>
          <div class="panel-title">
            <strong>每日净盈亏</strong>
            <span>{{ dailyStats.length }} 个交易日</span>
          </div>
        </template>
        <div ref="dailyChartRef" class="daily-chart" />
      </el-card>

      <el-card class="panel" shadow="never">
        <template #header>
          <div class="panel-title">
            <strong>报表摘要</strong>
            <span>{{ mt5ReportMeta.sourceFile }}</span>
          </div>
        </template>
        <div class="summary-list">
          <div>
            <span>交易品种</span>
            <b>{{ symbolSummary }}</b>
          </div>
          <div>
            <span>平均每笔净盈亏</span>
            <b :class="stats.averageNetPnl >= 0 ? 'profit-value' : 'loss-value'">
              {{ formatCurrency(stats.averageNetPnl) }}
            </b>
          </div>
          <div>
            <span>最大单笔盈利</span>
            <b class="profit-value">{{ formatCurrency(stats.bestTrade.netPnl) }}</b>
          </div>
          <div>
            <span>最大单笔亏损</span>
            <b class="loss-value">{{ formatCurrency(stats.worstTrade.netPnl) }}</b>
          </div>
        </div>
      </el-card>
    </div>

    <el-card class="panel" shadow="never">
      <template #header>
        <div class="panel-title">
          <strong>最近订单</strong>
          <span>按平仓时间倒序</span>
        </div>
      </template>

      <el-table :data="recentTrades" stripe class="recent-table">
        <el-table-column prop="exitTime" label="平仓时间" min-width="150">
          <template #default="{ row }">{{ formatDateTime(row.exitTime) }}</template>
        </el-table-column>
        <el-table-column prop="symbol" label="品种" width="110" />
        <el-table-column prop="direction" label="方向" width="100">
          <template #default="{ row }">
            <el-tag :type="row.direction === 'long' ? 'success' : 'danger'" effect="plain">
              {{ row.direction === 'long' ? 'Long' : 'Short' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="开仓 → 平仓" min-width="190">
          <template #default="{ row }">
            {{ formatPrice(row.entryPrice) }} → {{ formatPrice(row.exitPrice) }}
          </template>
        </el-table-column>
        <el-table-column prop="volume" label="手数" width="90" />
        <el-table-column prop="netPnl" label="净盈亏" width="120" align="right">
          <template #default="{ row }">
            <span :class="row.netPnl >= 0 ? 'profit-value' : 'loss-value'">
              {{ formatCurrency(row.netPnl) }}
            </span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card class="panel" shadow="never">
      <template #header>
        <div class="panel-title">
          <strong>完整交易明细</strong>
          <span>静态解析自 MT5 导出文件</span>
        </div>
      </template>

      <el-table :data="pagedTrades" stripe class="detail-table">
        <el-table-column prop="positionId" label="持仓号" width="110" />
        <el-table-column prop="entryTime" label="开仓时间" min-width="150">
          <template #default="{ row }">{{ formatDateTime(row.entryTime) }}</template>
        </el-table-column>
        <el-table-column prop="exitTime" label="平仓时间" min-width="150">
          <template #default="{ row }">{{ formatDateTime(row.exitTime) }}</template>
        </el-table-column>
        <el-table-column prop="symbol" label="品种" width="100" />
        <el-table-column prop="direction" label="方向" width="90">
          <template #default="{ row }">{{ row.direction === 'long' ? '多' : '空' }}</template>
        </el-table-column>
        <el-table-column prop="volume" label="手数" width="80" />
        <el-table-column label="开仓价" width="110" align="right">
          <template #default="{ row }">{{ formatPrice(row.entryPrice) }}</template>
        </el-table-column>
        <el-table-column label="平仓价" width="110" align="right">
          <template #default="{ row }">{{ formatPrice(row.exitPrice) }}</template>
        </el-table-column>
        <el-table-column label="手续费" width="100" align="right">
          <template #default="{ row }">{{ formatCurrency(row.fee) }}</template>
        </el-table-column>
        <el-table-column label="净盈亏" width="120" align="right">
          <template #default="{ row }">
            <span :class="row.netPnl >= 0 ? 'profit-value' : 'loss-value'">
              {{ formatCurrency(row.netPnl) }}
            </span>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-row">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          layout="prev, pager, next"
          :total="sortedTrades.length"
        />
      </div>
    </el-card>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import * as echarts from 'echarts';
import type { ECharts } from 'echarts';
import { mt5ReportMeta, mt5ReportTrades, type Mt5StaticTrade } from '@/data/mt5ReportTrades';

const dailyChartRef = ref<HTMLDivElement>();
const page = ref(1);
const pageSize = 20;
let dailyChart: ECharts | null = null;

const sortedTrades = computed(() => {
  return [...mt5ReportTrades].sort((a, b) => dateValue(b.exitTime) - dateValue(a.exitTime));
});

const recentTrades = computed(() => sortedTrades.value.slice(0, 10));
const pagedTrades = computed(() => {
  const start = (page.value - 1) * pageSize;
  return sortedTrades.value.slice(start, start + pageSize);
});

const stats = computed(() => {
  const wins = mt5ReportTrades.filter((trade) => trade.netPnl > 0);
  const losses = mt5ReportTrades.filter((trade) => trade.netPnl < 0);
  const grossProfit = wins.reduce((sum, trade) => sum + trade.netPnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.netPnl, 0));
  const netPnl = mt5ReportTrades.reduce((sum, trade) => sum + trade.netPnl, 0);
  const bestTrade = mt5ReportTrades.reduce((best, trade) => trade.netPnl > best.netPnl ? trade : best, mt5ReportTrades[0]);
  const worstTrade = mt5ReportTrades.reduce((worst, trade) => trade.netPnl < worst.netPnl ? trade : worst, mt5ReportTrades[0]);

  return {
    netPnl,
    fee: mt5ReportTrades.reduce((sum, trade) => sum + trade.fee, 0),
    swap: mt5ReportTrades.reduce((sum, trade) => sum + trade.swap, 0),
    winCount: wins.length,
    lossCount: losses.length,
    winRate: mt5ReportTrades.length ? (wins.length / mt5ReportTrades.length) * 100 : 0,
    profitFactor: grossLoss ? grossProfit / grossLoss : grossProfit,
    averageNetPnl: mt5ReportTrades.length ? netPnl / mt5ReportTrades.length : 0,
    bestTrade,
    worstTrade
  };
});

const symbolSummary = computed(() => {
  return Array.from(new Set(mt5ReportTrades.map((trade) => trade.symbol))).join(', ');
});

const dailyStats = computed(() => {
  const map = new Map<string, { date: string; netPnl: number; count: number }>();

  for (const trade of mt5ReportTrades) {
    const date = normalizeDate(trade.exitTime).slice(0, 10);
    const current = map.get(date) || { date, netPnl: 0, count: 0 };
    current.netPnl += trade.netPnl;
    current.count += 1;
    map.set(date, current);
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
});

onMounted(async () => {
  await nextTick();
  renderDailyChart();
  window.addEventListener('resize', resizeChart);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeChart);
  dailyChart?.dispose();
});

function renderDailyChart() {
  if (!dailyChartRef.value) return;
  dailyChart = dailyChart || echarts.init(dailyChartRef.value);
  dailyChart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 56, right: 24, top: 28, bottom: 44 },
    xAxis: {
      type: 'category',
      data: dailyStats.value.map((item) => item.date.slice(5)),
      axisLine: { lineStyle: { color: '#d9d3ca' } },
      axisLabel: { color: '#70685f' }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#70685f', formatter: '${value}' },
      splitLine: { lineStyle: { color: '#eee8df' } }
    },
    series: [
      {
        type: 'bar',
        data: dailyStats.value.map((item) => ({
          value: Number(item.netPnl.toFixed(2)),
          itemStyle: { color: item.netPnl >= 0 ? '#2f9d73' : '#d25d52' }
        })),
        barMaxWidth: 36,
        label: {
          show: true,
          position: 'top',
          color: '#70685f',
          formatter: (params: { dataIndex: number }) => `${dailyStats.value[params.dataIndex].count}笔`
        }
      }
    ]
  });
}

function resizeChart() {
  dailyChart?.resize();
}

function normalizeDate(value: string | null) {
  return (value || '').replace(/\./g, '-');
}

function dateValue(value: string | null) {
  return new Date(normalizeDate(value)).getTime();
}

function formatDateTime(value: string | null) {
  return normalizeDate(value).slice(0, 16);
}

function formatCurrency(value: number) {
  return `${value >= 0 ? '+' : '-'}$${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatPrice(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
</script>

<style scoped>
.mt5-page {
  width: min(1380px, 100%);
  margin: 0 auto;
}

.report-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  padding-bottom: 20px;
  border-bottom: 1px solid #e6dfd4;
}

.report-hero span {
  color: #81786f;
  font-size: 12px;
  font-weight: 760;
  text-transform: uppercase;
}

.report-hero h1 {
  margin: 8px 0 8px;
  font-size: 34px;
}

.report-hero p {
  margin: 0;
  color: #766e65;
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

.metric-card span,
.summary-list span,
.panel-title span {
  color: #81786f;
  font-size: 12px;
}

.metric-card strong {
  display: block;
  margin-top: 14px;
  font-size: 28px;
}

.metric-card small {
  display: block;
  margin-top: 8px;
  color: #81786f;
}

.report-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(280px, 0.8fr);
  gap: 14px;
  margin-bottom: 14px;
}

.panel {
  margin-bottom: 14px;
}

.panel-title {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.daily-chart {
  height: 360px;
}

.summary-list {
  display: grid;
  gap: 14px;
}

.summary-list div {
  padding: 14px;
  border-radius: 8px;
  background: #faf6ee;
}

.summary-list b {
  display: block;
  margin-top: 6px;
  font-size: 18px;
}

.pagination-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
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
  .report-hero {
    align-items: flex-start;
    flex-direction: column;
  }

  .metric-grid,
  .report-grid {
    grid-template-columns: 1fr;
  }
}
</style>
