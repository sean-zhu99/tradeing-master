<template>
  <section class="review-page">
    <header class="review-title">
      <div>
        <span>Trade Review</span>
        <h1>交易复盘记录</h1>
      </div>
      <small>{{ filteredTrades.length }} 条公开复盘</small>
    </header>

    <el-card class="review-filter" shadow="never">
      <el-date-picker
        v-model="filters.dateRange"
        type="daterange"
        value-format="YYYY-MM-DD"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
      />
      <el-select v-model="filters.symbols" multiple collapse-tags placeholder="交易对">
        <el-option v-for="symbol in symbolOptions" :key="symbol" :label="symbol" :value="symbol" />
      </el-select>
      <el-select v-model="filters.tags" multiple collapse-tags placeholder="标签">
        <el-option v-for="tag in tagOptions" :key="tag" :label="tag" :value="tag" />
      </el-select>
      <el-select v-model="filters.pnlStatus" placeholder="盈亏状态">
        <el-option label="全部" value="all" />
        <el-option label="盈利" value="profit" />
        <el-option label="亏损" value="loss" />
      </el-select>
      <el-input v-model="filters.keyword" clearable placeholder="搜索进场理由、备注" />
    </el-card>

    <div v-loading="tradingStore.loading" class="review-list">
      <el-empty v-if="!filteredTrades.length" description="暂无复盘记录" />
      <article
        v-for="trade in filteredTrades"
        :key="trade.id"
        class="review-card"
        :class="trade.pnl >= 0 ? 'win-card' : 'loss-card'"
        @click="openDetail(trade)"
      >
        <div class="card-top">
          <div>
            <strong>{{ trade.symbol }}</strong>
            <el-tag :type="trade.direction === 'long' ? 'success' : 'danger'" effect="plain">
              {{ trade.direction === 'long' ? '做多' : '做空' }}
            </el-tag>
          </div>
          <div class="pnl-block" :class="trade.pnl >= 0 ? 'profit-value' : 'loss-value'">
            {{ formatCurrency(trade.pnl) }}
          </div>
        </div>

        <div class="price-row">
          <span>{{ formatPrice(trade.entryPrice) }}</span>
          <b>→</b>
          <span>{{ trade.exitPrice ? formatPrice(trade.exitPrice) : '未平仓' }}</span>
        </div>

        <div class="meta-grid">
          <span>数量 {{ formatNumber(trade.quantity) }}</span>
          <span>{{ trade.leverage }}x</span>
          <span>{{ holdingDuration(trade) }}</span>
          <el-rate :model-value="trade.rating || 0" disabled size="small" />
        </div>

        <p class="reason" :class="{ collapsed: !expandedIds.has(trade.id) }" @click.stop>
          {{ trade.entryReason || '暂无进场理由' }}
        </p>
        <el-button
          v-if="(trade.entryReason || '').length > 90"
          link
          type="primary"
          @click.stop="toggleReason(trade.id)"
        >
          {{ expandedIds.has(trade.id) ? '收起' : '展开' }}
        </el-button>

        <div class="tag-row">
          <el-tag v-for="tag in trade.tags" :key="tag" round effect="plain">{{ tag }}</el-tag>
        </div>
      </article>
    </div>

    <el-card class="review-stats" shadow="never">
      <template #header>
        <div class="section-heading">
          <span>按标签统计</span>
          <small>盈亏总额 / 使用次数 / 胜率</small>
        </div>
      </template>
      <div ref="tagChartRef" class="tag-chart"></div>
    </el-card>

    <el-dialog v-model="detailVisible" title="交易复盘详情" width="760px" class="review-dialog">
      <template v-if="activeTrade">
        <div class="detail-grid">
          <div><span>交易对</span><b>{{ activeTrade.symbol }}</b></div>
          <div><span>方向</span><b>{{ activeTrade.direction === 'long' ? '做多' : '做空' }}</b></div>
          <div><span>入场价</span><b>{{ formatPrice(activeTrade.entryPrice) }}</b></div>
          <div><span>出场价</span><b>{{ activeTrade.exitPrice ? formatPrice(activeTrade.exitPrice) : '-' }}</b></div>
          <div><span>数量</span><b>{{ formatNumber(activeTrade.quantity) }}</b></div>
          <div><span>杠杆</span><b>{{ activeTrade.leverage }}x</b></div>
          <div><span>入场时间</span><b>{{ formatDateTime(activeTrade.entryTime) }}</b></div>
          <div><span>出场时间</span><b>{{ activeTrade.exitTime ? formatDateTime(activeTrade.exitTime) : '-' }}</b></div>
        </div>

        <el-divider />
        <h3>进场理由</h3>
        <p class="detail-text">{{ activeTrade.entryReason || '暂无' }}</p>
        <h3>出场理由</h3>
        <p class="detail-text">{{ activeTrade.exitReason || '暂无' }}</p>

        <h3>备注历史</h3>
        <el-timeline>
          <el-timeline-item :timestamp="formatDateTime(activeTrade.createdAt)">创建交易记录</el-timeline-item>
          <el-timeline-item v-if="activeTrade.notes" :timestamp="formatDateTime(activeTrade.updatedAt)">
            {{ activeTrade.notes }}
          </el-timeline-item>
        </el-timeline>

        <h3>标签与评分</h3>
        <div class="dialog-tags">
          <el-tag v-for="tag in activeTrade.tags" :key="tag" effect="plain">{{ tag }}</el-tag>
          <el-rate :model-value="activeTrade.rating || 0" disabled />
        </div>

        <h3>截图</h3>
        <div class="screenshot-grid">
          <el-image
            v-for="url in activeTrade.screenshots"
            :key="url"
            :src="url"
            fit="cover"
            :preview-src-list="activeTrade.screenshots"
            preview-teleported
          />
          <el-empty v-if="!activeTrade.screenshots.length" description="暂无截图" :image-size="80" />
        </div>
      </template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import * as echarts from 'echarts';
import type { ECharts } from 'echarts';
import dayjs from 'dayjs';
import { useTradingStore } from '@/stores/trading';
import type { Trade } from '@/types';

const tradingStore = useTradingStore();
const tagChartRef = ref<HTMLDivElement>();
const tagChart = ref<ECharts>();
const detailVisible = ref(false);
const activeTrade = ref<Trade | null>(null);
const expandedIds = ref(new Set<number>());

const filters = reactive({
  dateRange: [] as string[],
  symbols: [] as string[],
  tags: [] as string[],
  pnlStatus: 'all',
  keyword: ''
});

const symbolOptions = computed(() => tradingStore.symbols);
const tagOptions = computed(() => tradingStore.tags);

const filteredTrades = computed(() => {
  return tradingStore.trades
    .filter((trade) => trade.status === 'closed')
    .filter((trade) => {
      const closedDate = dayjs(trade.exitTime || trade.entryTime).format('YYYY-MM-DD');
      const keyword = filters.keyword.trim().toLowerCase();
      if (filters.dateRange.length === 2 && (closedDate < filters.dateRange[0] || closedDate > filters.dateRange[1])) return false;
      if (filters.symbols.length && !filters.symbols.includes(trade.symbol)) return false;
      if (filters.tags.length && !filters.tags.every((tag) => trade.tags.includes(tag))) return false;
      if (filters.pnlStatus === 'profit' && trade.pnl <= 0) return false;
      if (filters.pnlStatus === 'loss' && trade.pnl >= 0) return false;
      if (keyword && !`${trade.entryReason || ''} ${trade.notes || ''}`.toLowerCase().includes(keyword)) return false;
      return true;
    });
});

const tagStats = computed(() => {
  const map = new Map<string, { pnl: number; count: number; wins: number }>();
  for (const trade of filteredTrades.value) {
    for (const tag of trade.tags) {
      const item = map.get(tag) || { pnl: 0, count: 0, wins: 0 };
      item.pnl += trade.pnl;
      item.count += 1;
      item.wins += trade.pnl > 0 ? 1 : 0;
      map.set(tag, item);
    }
  }
  return Array.from(map.entries())
    .map(([tag, item]) => ({ tag, pnl: item.pnl, count: item.count, winRate: item.count ? (item.wins / item.count) * 100 : 0 }))
    .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));
});

onMounted(async () => {
  await tradingStore.loadTrades(1, 100);
  await nextTick();
  if (tagChartRef.value) tagChart.value = echarts.init(tagChartRef.value);
  renderTagChart();
  window.addEventListener('resize', resizeChart);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeChart);
  tagChart.value?.dispose();
});

watch(tagStats, renderTagChart);

function renderTagChart() {
  if (!tagChart.value) return;
  const data = tagStats.value.slice(0, 12);
  tagChart.value.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 84, right: 28, top: 20, bottom: 28 },
    xAxis: { type: 'value', axisLabel: { formatter: (value: number) => formatCompact(value) } },
    yAxis: { type: 'category', data: data.map((item) => item.tag) },
    series: [
      {
        type: 'bar',
        data: data.map((item) => ({
          value: Number(item.pnl.toFixed(2)),
          itemStyle: { color: item.pnl >= 0 ? '#00b894' : '#e74c3c' }
        })),
        label: {
          show: true,
          position: 'right',
          formatter: (item: { dataIndex: number }) => {
            const stat = data[item.dataIndex];
            return `${stat.count}次 / ${stat.winRate.toFixed(0)}%`;
          }
        }
      }
    ]
  });
}

function resizeChart() {
  tagChart.value?.resize();
}

function openDetail(trade: Trade) {
  activeTrade.value = trade;
  detailVisible.value = true;
}

function toggleReason(id: number) {
  const next = new Set(expandedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expandedIds.value = next;
}

function holdingDuration(trade: Trade) {
  if (!trade.exitTime) return '持仓中';
  const minutes = dayjs(trade.exitTime).diff(dayjs(trade.entryTime), 'minute');
  if (minutes < 60) return `${minutes}分钟`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}小时${minutes % 60}分钟`;
  return `${Math.floor(minutes / 1440)}天`;
}

function formatCurrency(value: number) {
  return `${value >= 0 ? '+' : '-'}${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
}

function formatPrice(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 8 });
}

function formatNumber(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

function formatCompact(value: number) {
  return value.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 });
}

function formatDateTime(value: string) {
  return dayjs(value).format('YYYY-MM-DD HH:mm');
}
</script>

<style scoped>
.review-page {
  width: min(1360px, 100%);
  margin: 0 auto;
}

.review-title {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-end;
  padding-bottom: 18px;
  border-bottom: 1px solid #e8e1d7;
}

.review-title span {
  color: #8a8177;
  font-size: 12px;
  font-weight: 760;
  text-transform: uppercase;
}

.review-title h1 {
  margin: 8px 0 0;
  font-size: 34px;
}

.review-title small {
  color: #8a8177;
}

.review-filter {
  margin: 18px 0;
  border: 1px solid #e7e2da;
  border-radius: 8px;
  background: #fffdf9;
}

.review-filter :deep(.el-card__body) {
  display: grid;
  grid-template-columns: 280px repeat(3, minmax(150px, 1fr)) minmax(220px, 1.2fr);
  gap: 10px;
}

.review-list {
  display: grid;
  gap: 12px;
}

.review-card {
  padding: 18px;
  border: 1px solid #e7e2da;
  border-radius: 8px;
  background: #fffdf9;
  cursor: pointer;
}

.review-card:hover {
  border-color: #cfc7bb;
}

.win-card {
  background: linear-gradient(90deg, rgba(0, 184, 148, 0.1), rgba(255, 253, 249, 0.9) 34%);
}

.loss-card {
  background: linear-gradient(90deg, rgba(231, 76, 60, 0.1), rgba(255, 253, 249, 0.9) 34%);
}

.card-top,
.price-row,
.meta-grid,
.tag-row,
.dialog-tags {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.card-top {
  justify-content: space-between;
}

.card-top > div:first-child {
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-top strong {
  font-size: 20px;
}

.pnl-block {
  font-size: 24px;
}

.price-row {
  margin-top: 14px;
  color: #4c4741;
  font-size: 16px;
}

.price-row b {
  color: #a0968b;
}

.meta-grid {
  margin-top: 12px;
  color: #7a7167;
  font-size: 13px;
}

.reason {
  margin: 14px 0 6px;
  color: #3f3a35;
  line-height: 1.65;
}

.reason.collapsed {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.tag-row {
  margin-top: 10px;
}

.review-stats {
  margin-top: 18px;
  border: 1px solid #e7e2da;
  border-radius: 8px;
  background: #fffdf9;
}

.section-heading span {
  display: block;
  font-weight: 760;
}

.section-heading small {
  color: #8a8177;
}

.tag-chart {
  height: 360px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.detail-grid div {
  padding: 12px;
  border-radius: 8px;
  background: #faf7f1;
}

.detail-grid span {
  display: block;
  color: #8a8177;
  font-size: 12px;
}

.detail-grid b {
  display: block;
  margin-top: 6px;
}

.detail-text {
  white-space: pre-wrap;
  line-height: 1.7;
}

.screenshot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 10px;
}

.screenshot-grid :deep(.el-image) {
  height: 92px;
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid #e7e2da;
}

.profit-value {
  color: #00b894;
  font-weight: 760;
}

.loss-value {
  color: #e74c3c;
  font-weight: 760;
}

@media (max-width: 960px) {
  .review-filter :deep(.el-card__body),
  .detail-grid {
    grid-template-columns: 1fr;
  }

  .review-title,
  .card-top {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
