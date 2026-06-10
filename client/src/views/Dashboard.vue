<template>
  <section class="journal-page">
    <div class="journal-hero">
      <div>
        <span class="eyebrow">TRADE JOURNAL + ANALYTICS</span>
        <h2>Trading Master</h2>
        <p>MT5 与交易所订单的合并记录、分析与复盘工作台</p>
      </div>
      <div class="hero-actions">
        <el-button :icon="Refresh" plain @click="tradingStore.triggerSync">同步数据源</el-button>
        <el-button type="primary" :icon="Plus" @click="router.push('/trades')">查看订单</el-button>
      </div>
    </div>

    <el-alert
      v-if="tradingStore.error"
      :title="tradingStore.error"
      type="error"
      show-icon
      :closable="false"
      class="journal-alert"
    />

    <div class="journal-nav-grid">
      <button v-for="item in navigationTiles" :key="item.label" class="nav-tile" @click="router.push(item.path)">
        <span class="tile-icon">
          <el-icon><component :is="item.icon" /></el-icon>
        </span>
        <strong>{{ item.label }}</strong>
        <small>{{ item.caption }}</small>
      </button>
    </div>

    <div class="journal-overview">
      <el-card class="primary-scorecard" shadow="never">
        <el-skeleton :loading="tradingStore.loading" animated :rows="3">
          <template #template>
            <el-skeleton-item variant="text" class="score-skeleton-label" />
            <el-skeleton-item variant="h1" class="score-skeleton-value" />
            <el-skeleton-item variant="text" class="score-skeleton-meta" />
          </template>
          <div class="scorecard-top">
            <span>Net P&L</span>
            <el-tag effect="plain" :type="tradingStore.overallStats.totalPnl >= 0 ? 'success' : 'danger'">
              {{ tradingStore.overallStats.totalPnl >= 0 ? 'Profitable' : 'Drawdown' }}
            </el-tag>
          </div>
          <strong :class="tradingStore.overallStats.totalPnl >= 0 ? 'profit-value' : 'loss-value'">
            {{ formatCurrency(tradingStore.overallStats.totalPnl) }}
          </strong>
          <div class="scorecard-meta">
            <span>{{ tradingStore.overallStats.tradeCount }} trades</span>
            <span>{{ formatNumber(tradingStore.overallStats.winRate) }}% win rate</span>
            <span>{{ formatCurrency(todayPnl) }} today</span>
          </div>
        </el-skeleton>
      </el-card>

      <el-card class="quick-actions" shadow="never">
        <template #header>
          <div class="section-title">
            <span>Quick Actions</span>
            <small>常用操作</small>
          </div>
        </template>
        <div class="action-list">
          <button @click="router.push('/trades')">
            <el-icon><Tickets /></el-icon>
            <span>查看订单</span>
          </button>
          <button @click="router.push('/review')">
            <el-icon><Notebook /></el-icon>
            <span>写复盘</span>
          </button>
          <button @click="router.push('/pnl-analysis')">
            <el-icon><TrendCharts /></el-icon>
            <span>看分析</span>
          </button>
        </div>
      </el-card>

      <el-card class="compact-stats" shadow="never">
        <div v-for="card in metricCards.slice(1)" :key="card.label" class="compact-stat">
          <el-skeleton :loading="tradingStore.loading" animated :rows="2">
            <template #template>
              <el-skeleton-item variant="text" class="compact-skeleton-title" />
              <el-skeleton-item variant="h3" class="compact-skeleton-value" />
            </template>
            <div>
              <span>{{ card.label }}</span>
              <strong :class="card.valueClass">{{ card.value }}</strong>
            </div>
          </el-skeleton>
        </div>
      </el-card>
    </div>

    <div class="analytics-grid">
      <el-card class="journal-panel pnl-panel" shadow="never">
        <template #header>
          <div class="panel-header">
            <div>
              <span>Performance Overview</span>
              <small>累计盈亏曲线</small>
            </div>
            <el-radio-group v-model="range" size="small">
              <el-radio-button v-for="option in rangeOptions" :key="option.value" :label="option.value">
                {{ option.label }}
              </el-radio-button>
            </el-radio-group>
          </div>
        </template>
        <div ref="pnlChartRef" class="chart chart-large"></div>
      </el-card>

      <el-card class="journal-panel distribution-panel" shadow="never">
        <template #header>
          <div class="panel-header">
            <div>
              <span>Symbol Performance</span>
              <small>品种盈亏分布</small>
            </div>
            <el-segmented v-model="distributionMode" :options="distributionOptions" size="small" />
          </div>
        </template>
        <div ref="distributionChartRef" class="chart"></div>
      </el-card>

      <el-card class="journal-panel recent-panel" shadow="never">
        <template #header>
          <div class="panel-header">
            <div>
              <span>Recent Trades</span>
              <small>最近 10 笔交易</small>
            </div>
            <el-link type="primary" :underline="false" @click="router.push('/trades')">查看全部</el-link>
          </div>
        </template>
        <el-table
          :data="recentTrades"
          size="large"
          empty-text="暂无交易记录"
          row-class-name="clickable-row"
          @row-click="openTrade"
        >
          <el-table-column label="时间" min-width="138">
            <template #default="{ row }">
              {{ formatDateTime(row.exitTime || row.entryTime) }}
            </template>
          </el-table-column>
          <el-table-column prop="symbol" label="品种" min-width="112" />
          <el-table-column label="方向" min-width="86">
            <template #default="{ row }">
              <el-tag :type="row.direction === 'long' ? 'success' : 'danger'" effect="plain">
                {{ row.direction === 'long' ? '多' : '空' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="盈亏" align="right" min-width="126">
            <template #default="{ row }">
              <span :class="row.pnl >= 0 ? 'profit-value' : 'loss-value'">
                {{ formatCurrency(row.pnl) }}
              </span>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <el-card class="journal-panel start-panel" shadow="never">
        <template #header>
          <div class="section-title">
            <span>Start Here</span>
            <small>复盘节奏</small>
          </div>
        </template>
        <div class="start-list">
          <div>
            <b>01</b>
            <span>核对开仓、平仓和截图</span>
          </div>
          <div>
            <b>02</b>
            <span>标记交易标签和执行偏差</span>
          </div>
          <div>
            <b>03</b>
            <span>按品种和标签复盘表现</span>
          </div>
        </div>
      </el-card>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import * as echarts from 'echarts';
import type { ECharts } from 'echarts';
import dayjs from 'dayjs';
import {
  Calendar,
  Coin,
  DataLine,
  Money,
  Notebook,
  Plus,
  Refresh,
  Tickets,
  TrendCharts,
  Trophy
} from '@element-plus/icons-vue';
import { useTradingStore } from '@/stores/trading';
import type { DailySummary, Trade } from '@/types';

type RangeValue = '7d' | '30d' | '90d' | 'all';
type DistributionMode = 'profit' | 'loss';

const router = useRouter();
const tradingStore = useTradingStore();
const pnlChartRef = ref<HTMLDivElement>();
const distributionChartRef = ref<HTMLDivElement>();
const range = ref<RangeValue>('all');
const distributionMode = ref<DistributionMode>('profit');
const pnlChart = ref<ECharts>();
const distributionChart = ref<ECharts>();

const rangeOptions: { label: string; value: RangeValue }[] = [
  { label: '7天', value: '7d' },
  { label: '30天', value: '30d' },
  { label: '90天', value: '90d' },
  { label: '全部', value: 'all' }
];

const distributionOptions = [
  { label: '盈利排行', value: 'profit' },
  { label: '亏损排行', value: 'loss' }
];

const navigationTiles = [
  { label: 'Orders', caption: '订单记录', path: '/trades', icon: markRaw(Tickets) },
  { label: 'Analytics', caption: '盈亏分析', path: '/pnl-analysis', icon: markRaw(TrendCharts) },
  { label: 'Calendar', caption: '每日汇总', path: '/calendar', icon: markRaw(Calendar) },
  { label: 'Review', caption: '交易复盘', path: '/review', icon: markRaw(Notebook) }
];

const todayPnl = computed(() => {
  const today = dayjs().format('YYYY-MM-DD');
  const summary = tradingStore.dailySummary.find((item) => item.date === today);

  if (summary) return summary.totalPnl;

  return tradingStore.trades
    .filter((trade) => dayjs(trade.exitTime || trade.entryTime).format('YYYY-MM-DD') === today)
    .reduce((sum, trade) => sum + trade.pnl, 0);
});

const metricCards = computed(() => [
  {
    label: '总盈亏',
    value: formatCurrency(tradingStore.overallStats.totalPnl),
    caption: `累计 ${tradingStore.overallStats.tradeCount} 笔交易`,
    icon: markRaw(Money),
    tone: tradingStore.overallStats.totalPnl >= 0 ? 'metric-positive' : 'metric-negative',
    valueClass: tradingStore.overallStats.totalPnl >= 0 ? 'profit-value' : 'loss-value'
  },
  {
    label: '今日盈亏',
    value: formatCurrency(todayPnl.value),
    caption: dayjs().format('YYYY年MM月DD日'),
    icon: markRaw(DataLine),
    tone: todayPnl.value >= 0 ? 'metric-positive' : 'metric-negative',
    valueClass: todayPnl.value >= 0 ? 'profit-value' : 'loss-value'
  },
  {
    label: '胜率',
    value: `${formatNumber(tradingStore.winRate)}%`,
    caption: `${tradingStore.overallStats.winCount} 胜 / ${tradingStore.overallStats.lossCount} 负`,
    icon: markRaw(Trophy),
    tone: 'metric-neutral',
    valueClass: ''
  },
  {
    label: '盈亏比',
    value: formatNumber(tradingStore.profitLossRatio),
    caption: '总盈利 / 总亏损',
    icon: markRaw(Coin),
    tone: 'metric-neutral',
    valueClass: ''
  }
]);

const rangedDailySummary = computed(() => {
  const sorted = [...tradingStore.dailySummary].sort((a, b) => a.date.localeCompare(b.date));
  if (range.value === 'all') return sorted;

  const days = Number(range.value.replace('d', ''));
  const start = dayjs().subtract(days - 1, 'day').startOf('day');

  return sorted.filter((item) => dayjs(item.date).isSame(start) || dayjs(item.date).isAfter(start));
});

const cumulativePnlData = computed(() => {
  let cumulative = 0;

  return rangedDailySummary.value.map((item) => {
    cumulative += item.totalPnl;
    return {
      date: item.date,
      value: Number(cumulative.toFixed(2))
    };
  });
});

const symbolDistribution = computed(() => {
  const map = new Map<string, number>();

  for (const trade of tradingStore.trades) {
    map.set(trade.symbol, (map.get(trade.symbol) || 0) + trade.pnl);
  }

  return Array.from(map.entries())
    .map(([symbol, pnl]) => ({ symbol, pnl: Number(pnl.toFixed(2)) }))
    .filter((item) => (distributionMode.value === 'profit' ? item.pnl > 0 : item.pnl < 0))
    .sort((a, b) =>
      distributionMode.value === 'profit' ? b.pnl - a.pnl : Math.abs(b.pnl) - Math.abs(a.pnl)
    )
    .slice(0, 8);
});

const recentTrades = computed(() => {
  return [...tradingStore.trades]
    .sort((a, b) => {
      const left = new Date(b.exitTime || b.entryTime).getTime();
      const right = new Date(a.exitTime || a.entryTime).getTime();
      return left - right;
    })
    .slice(0, 10);
});

onMounted(async () => {
  await tradingStore.loadTrades(1, 50);
  await Promise.allSettled([
    tradingStore.loadDailySummary(1),
    tradingStore.loadOverallStats()
  ]);

  await nextTick();
  initCharts();
  renderCharts();
  window.addEventListener('resize', resizeCharts);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCharts);
  pnlChart.value?.dispose();
  distributionChart.value?.dispose();
});

watch([cumulativePnlData, symbolDistribution, range, distributionMode], () => {
  renderCharts();
});

function initCharts() {
  if (pnlChartRef.value && !pnlChart.value) {
    pnlChart.value = echarts.init(pnlChartRef.value);
  }

  if (distributionChartRef.value && !distributionChart.value) {
    distributionChart.value = echarts.init(distributionChartRef.value);
  }
}

function renderCharts() {
  renderPnlChart();
  renderDistributionChart();
}

function renderPnlChart() {
  if (!pnlChart.value) return;

  const data = cumulativePnlData.value;
  const values = data.map((item) => item.value);
  const lastValue = values.length ? values[values.length - 1] : 0;
  const isPositive = lastValue >= 0;
  const lineColor = isPositive ? '#00b894' : '#e74c3c';

  pnlChart.value.setOption(
    {
      animationDuration: 500,
      tooltip: {
        trigger: 'axis',
        valueFormatter: (value: unknown) => formatCurrency(Number(value))
      },
      grid: { left: 56, right: 28, top: 36, bottom: 42 },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: data.map((item) => dayjs(item.date).format('MM/DD')),
        axisLine: { lineStyle: { color: '#d8dde7' } },
        axisLabel: { color: '#6b7280' }
      },
      yAxis: {
        type: 'value',
        name: 'USD',
        axisLabel: {
          color: '#6b7280',
          formatter: (value: number) => compactNumber(value)
        },
        splitLine: { lineStyle: { color: '#edf0f5' } }
      },
      series: [
        {
          name: '累计盈亏',
          type: 'line',
          smooth: false,
          symbol: 'circle',
          symbolSize: 5,
          lineStyle: { width: 3, color: lineColor },
          itemStyle: { color: lineColor },
          markPoint: {
            symbolSize: 56,
            label: { formatter: ({ name }: { name: string }) => name },
            data: [
              { type: 'max', name: '最高' },
              { type: 'min', name: '最低' }
            ]
          },
          data: values
        }
      ]
    },
    true
  );
}

function renderDistributionChart() {
  if (!distributionChart.value) return;

  const color = distributionMode.value === 'profit' ? '#00b894' : '#e74c3c';
  const data = symbolDistribution.value.map((item) => ({
    name: item.symbol,
    value: Math.abs(item.pnl)
  }));

  distributionChart.value.setOption(
    {
      animationDuration: 500,
      tooltip: {
        trigger: 'item',
        formatter: (params: { name: string; value: number; percent: number }) =>
          `${params.name}<br/>${formatCurrency(params.value)} (${params.percent}%)`
      },
      legend: {
        bottom: 0,
        type: 'scroll',
        icon: 'circle'
      },
      color: buildPalette(color),
      series: [
        {
          name: distributionMode.value === 'profit' ? '盈利排行' : '亏损排行',
          type: 'pie',
          radius: ['42%', '68%'],
          center: ['50%', '44%'],
          label: {
            formatter: '{b}\n{d}%'
          },
          data
        }
      ]
    },
    true
  );
}

function resizeCharts() {
  pnlChart.value?.resize();
  distributionChart.value?.resize();
}

function openTrade(row: Trade) {
  router.push({ path: '/trades', query: { id: row.id } });
}

function formatCurrency(value: number) {
  return `${value >= 0 ? '+' : '-'}${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} USD`;
}

function formatNumber(value: number) {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function compactNumber(value: number) {
  return value.toLocaleString('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1
  });
}

function formatDateTime(value: string) {
  return dayjs(value).format('YYYY-MM-DD HH:mm');
}

function buildPalette(base: string) {
  return [base, '#2d98da', '#f6b93b', '#8854d0', '#20bf6b', '#eb3b5a', '#4b7bec', '#fd9644'];
}
</script>

<style scoped>
.journal-page {
  width: min(1360px, 100%);
  margin: 0 auto;
  color: #252525;
}

.journal-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  padding: 10px 0 18px;
  border-bottom: 1px solid #e9e5df;
}

.journal-hero h2 {
  margin: 8px 0 6px;
  font-size: 40px;
  font-weight: 760;
  line-height: 1.05;
  letter-spacing: 0;
}

.journal-hero p {
  margin: 0;
  color: #6f6a64;
  font-size: 14px;
}

.eyebrow {
  color: #8f867a;
  font-size: 12px;
  font-weight: 760;
  text-transform: uppercase;
}

.hero-actions {
  display: flex;
  gap: 10px;
}

.journal-alert {
  margin-top: 18px;
  border-radius: 8px;
}

.journal-nav-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-top: 18px;
}

.nav-tile {
  display: grid;
  grid-template-columns: 40px 1fr;
  gap: 2px 12px;
  align-items: center;
  min-height: 74px;
  padding: 14px;
  text-align: left;
  border: 1px solid #e7e2da;
  border-radius: 8px;
  background: #fffdf9;
  cursor: pointer;
}

.nav-tile:hover {
  border-color: #cfc7bb;
  background: #fbf7f1;
}

.tile-icon {
  display: grid;
  grid-row: span 2;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: #f2eee8;
  color: #4c4741;
  font-size: 19px;
}

.nav-tile strong {
  color: #2f2b27;
  font-size: 15px;
}

.nav-tile small {
  color: #8a8177;
}

.journal-overview {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(250px, 0.62fr) minmax(270px, 0.7fr);
  gap: 14px;
  margin-top: 18px;
}

.primary-scorecard,
.quick-actions,
.compact-stats,
.journal-panel {
  border: 1px solid #e7e2da;
  border-radius: 8px;
  background: #fffdf9;
  box-shadow: none;
}

.primary-scorecard {
  background:
    linear-gradient(135deg, rgba(0, 184, 148, 0.12), rgba(255, 255, 255, 0) 52%),
    #fffdf9;
}

.scorecard-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: #756d63;
  font-size: 13px;
  font-weight: 700;
}

.primary-scorecard strong {
  display: block;
  margin: 20px 0 18px;
  font-size: 44px;
  line-height: 1;
}

.scorecard-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.scorecard-meta span {
  padding: 7px 10px;
  border-radius: 8px;
  color: #5f5850;
  background: rgba(242, 238, 232, 0.78);
  font-size: 12px;
}

.section-title span,
.panel-header span {
  display: block;
  color: #302c28;
  font-size: 16px;
  font-weight: 760;
}

.section-title small,
.panel-header small {
  display: block;
  margin-top: 4px;
  color: #8a8177;
  font-size: 12px;
}

.quick-actions :deep(.el-card__header),
.journal-panel :deep(.el-card__header) {
  padding: 14px 16px;
  border-bottom: 1px solid #eee9e1;
  background: #fffdf9;
}

.quick-actions :deep(.el-card__body),
.compact-stats :deep(.el-card__body),
.journal-panel :deep(.el-card__body),
.primary-scorecard :deep(.el-card__body) {
  padding: 16px;
}

.action-list {
  display: grid;
  gap: 8px;
}

.action-list button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 42px;
  padding: 0 12px;
  color: #403b35;
  border: 1px solid #e8e2d9;
  border-radius: 8px;
  background: #faf7f1;
  cursor: pointer;
}

.action-list button:hover {
  background: #f2ede5;
}

.compact-stats {
  display: grid;
}

.compact-stat + .compact-stat {
  border-top: 1px solid #eee9e1;
}

.compact-stat span {
  color: #7a7167;
  font-size: 12px;
}

.compact-stat strong {
  display: block;
  margin-top: 8px;
  color: #252525;
  font-size: 24px;
}

.profit-value {
  color: #00b894 !important;
  font-weight: 760;
}

.loss-value {
  color: #e74c3c !important;
  font-weight: 760;
}

.score-skeleton-label,
.compact-skeleton-title {
  width: 42%;
}

.score-skeleton-value {
  width: 64%;
  margin-top: 20px;
}

.score-skeleton-meta,
.compact-skeleton-value {
  width: 72%;
  margin-top: 12px;
}

.analytics-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(340px, 0.85fr);
  gap: 14px;
  margin-top: 14px;
}

.pnl-panel {
  grid-row: span 2;
}

.start-panel {
  grid-column: 1 / -1;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.chart {
  width: 100%;
  height: 330px;
}

.chart-large {
  height: 560px;
}

.start-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.start-list div {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 12px;
  border: 1px solid #eee9e1;
  border-radius: 8px;
  background: #faf7f1;
}

.start-list b {
  color: #9b8b78;
}

.start-list span {
  color: #4c4741;
  font-size: 13px;
}

:deep(.el-radio-button__inner),
:deep(.el-segmented) {
  border-radius: 8px;
}

:deep(.el-table) {
  --el-table-header-bg-color: #fffdf9;
  --el-table-header-text-color: #7a7167;
  --el-table-row-hover-bg-color: #faf7f1;
  font-size: 13px;
}

:deep(.el-table th.el-table__cell) {
  font-weight: 700;
}

:deep(.clickable-row) {
  cursor: pointer;
}

@media (max-width: 1180px) {
  .journal-overview,
  .analytics-grid {
    grid-template-columns: 1fr;
  }

  .pnl-panel,
  .start-panel {
    grid-column: auto;
    grid-row: auto;
  }

  .chart-large {
    height: 420px;
  }
}

@media (max-width: 820px) {
  .journal-hero {
    align-items: stretch;
    flex-direction: column;
  }

  .journal-nav-grid,
  .start-list {
    grid-template-columns: 1fr;
  }

  .hero-actions,
  .panel-header {
    align-items: stretch;
    flex-direction: column;
  }

  .journal-hero h2 {
    font-size: 32px;
  }
}
</style>
