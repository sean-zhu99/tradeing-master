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
        v-model="filters.date"
        type="date"
        value-format="YYYY-MM-DD"
        placeholder="选择某一天"
        clearable
      />
      <el-select v-model="filters.symbols" multiple collapse-tags placeholder="品种">
        <el-option v-for="symbol in symbolOptions" :key="symbol" :label="symbol" :value="symbol" />
      </el-select>
      <el-select v-model="filters.pnlStatus" placeholder="盈亏状态">
        <el-option label="全部" value="all" />
        <el-option label="盈利" value="profit" />
        <el-option label="亏损" value="loss" />
      </el-select>
      <el-input v-model="filters.keyword" clearable placeholder="搜索进场理由、备注" />
    </el-card>

    <div class="gallery-heading">
      <span class="gallery-icon">
        <el-icon><Grid /></el-icon>
      </span>
      <strong>Trades Gallery</strong>
    </div>

    <div v-loading="tradingStore.loading" class="review-gallery">
      <el-empty v-if="!filteredTrades.length" description="暂无复盘记录" />
      <article
        v-for="trade in filteredTrades"
        :key="trade.id"
        class="gallery-card"
        @click="openDetail(trade)"
      >
        <div class="chart-shot">
          <img :src="coverImage(trade)" :alt="`${trade.symbol} chart`" />
        </div>
        <div class="gallery-body">
          <div class="gallery-symbol">
            <span class="star">✪</span>
            <strong>{{ shortSymbol(trade.symbol) }}</strong>
          </div>
          <div class="gallery-meta">
            <el-tag :type="trade.direction === 'long' ? 'success' : 'danger'" effect="plain" round>
              {{ trade.direction === 'long' ? 'Long' : 'Short' }}
            </el-tag>
            <span class="result-pill" :class="trade.pnl >= 0 ? 'result-profit' : 'result-loss'">
              {{ trade.pnl >= 0 ? '盈利' : '亏损' }}
            </span>
          </div>
          <strong class="gallery-pnl" :class="trade.pnl >= 0 ? 'profit-value' : 'loss-value'">
            {{ formatPnlAmount(trade.pnl) }}
          </strong>
        </div>
      </article>
    </div>

    <el-dialog v-model="detailVisible" title="交易复盘详情" width="760px" class="review-dialog">
      <template v-if="activeTrade">
        <div class="detail-grid">
          <div><span>品种</span><b>{{ activeTrade.symbol }}</b></div>
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
import { computed, onMounted, reactive, ref } from 'vue';
import { Grid } from '@element-plus/icons-vue';
import dayjs from 'dayjs';
import { useTradingStore } from '@/stores/trading';
import type { Trade } from '@/types';

const tradingStore = useTradingStore();
const detailVisible = ref(false);
const activeTrade = ref<Trade | null>(null);

const filters = reactive({
  date: '',
  symbols: [] as string[],
  pnlStatus: 'all',
  keyword: ''
});

const symbolOptions = computed(() => tradingStore.symbols);

const defaultStartDate = computed(() => {
  const latestTradeDate = tradingStore.trades
    .filter((trade) => trade.status === 'closed')
    .map((trade) => dayjs(trade.exitTime || trade.entryTime))
    .sort((a, b) => b.valueOf() - a.valueOf())[0];

  return (latestTradeDate || dayjs()).subtract(2, 'day').format('YYYY-MM-DD');
});

const filteredTrades = computed(() => {
  return tradingStore.trades
    .filter((trade) => trade.status === 'closed')
    .filter((trade) => {
      const closedDate = dayjs(trade.exitTime || trade.entryTime).format('YYYY-MM-DD');
      const keyword = filters.keyword.trim().toLowerCase();
      if (filters.date && closedDate !== filters.date) return false;
      if (!filters.date && closedDate < defaultStartDate.value) return false;
      if (filters.symbols.length && !filters.symbols.includes(trade.symbol)) return false;
      if (filters.pnlStatus === 'profit' && trade.pnl <= 0) return false;
      if (filters.pnlStatus === 'loss' && trade.pnl >= 0) return false;
      if (keyword && !`${trade.entryReason || ''} ${trade.notes || ''}`.toLowerCase().includes(keyword)) return false;
      return true;
    })
    .sort((a, b) => dayjs(b.exitTime || b.entryTime).valueOf() - dayjs(a.exitTime || a.entryTime).valueOf());
});

onMounted(async () => {
  await tradingStore.loadTrades(1, 100);
});

function openDetail(trade: Trade) {
  activeTrade.value = trade;
  detailVisible.value = true;
}

function formatPrice(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 8 });
}

function formatNumber(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

function formatPnlAmount(value: number) {
  const prefix = value >= 0 ? '+' : '-';
  return `${prefix}${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })}`;
}

function formatDateTime(value: string) {
  return dayjs(value).format('YYYY-MM-DD HH:mm');
}

function shortSymbol(symbol: string) {
  return symbol.split('/')[0];
}

function coverImage(trade: Trade) {
  return trade.screenshots[0] || chartPlaceholder(trade);
}

function chartPlaceholder(trade: Trade) {
  const up = trade.pnl >= 0;
  const candle = up ? '%2300b894' : '%23e74c3c';
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 480"><rect width="900" height="480" fill="%23d8d8d8"/><path d="M0 360 C120 260 160 310 250 210 S400 180 500 120 680 80 900 34" fill="none" stroke="%23333" stroke-width="4" opacity=".72"/><path d="M0 390 C140 330 250 360 350 260 S540 210 650 130 780 120 900 68" fill="none" stroke="%23777" stroke-width="2" opacity=".55"/><rect x="680" y="0" width="42" height="480" fill="%23bcbcbc" opacity=".8"/><line x1="0" y1="118" x2="900" y2="118" stroke="%23222" stroke-width="3"/><line x1="0" y1="255" x2="900" y2="255" stroke="%23333" stroke-width="2"/><g fill="${candle}"><rect x="150" y="246" width="16" height="74"/><rect x="320" y="164" width="16" height="92"/><rect x="510" y="110" width="16" height="108"/><rect x="760" y="70" width="16" height="86"/></g><g stroke="%23222" stroke-width="2"><line x1="158" y1="218" x2="158" y2="344"/><line x1="328" y1="130" x2="328" y2="280"/><line x1="518" y1="82" x2="518" y2="244"/><line x1="768" y1="42" x2="768" y2="184"/></g><text x="40" y="52" fill="%23333" font-family="Arial" font-size="22">${trade.symbol}</text></svg>`;
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
  grid-template-columns: 180px minmax(180px, 1fr) 150px minmax(220px, 1.2fr);
  gap: 10px;
}

.gallery-heading {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin: 24px 0;
  padding: 11px 18px;
  border-radius: 999px;
  background: #ecebea;
  color: #2f2f2f;
  font-size: 22px;
}

.gallery-icon {
  display: grid;
  place-items: center;
  font-size: 22px;
}

.review-gallery {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
}

.gallery-card {
  overflow: hidden;
  min-height: 238px;
  border: 1px solid #dedbd7;
  border-radius: 14px;
  background: #ffffff;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(31, 31, 31, 0.04);
}

.gallery-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 24px rgba(31, 31, 31, 0.08);
}

.chart-shot {
  width: 100%;
  height: 142px;
  overflow: hidden;
  background: #d7d7d7;
}

.chart-shot img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: grayscale(0.92);
}

.gallery-body {
  display: grid;
  gap: 10px;
  padding: 14px 16px 16px;
}

.gallery-symbol,
.gallery-meta,
.tag-row,
.dialog-tags {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.star {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  color: #ffffff;
  background: #5f5f5f;
  font-size: 13px;
}

.gallery-symbol strong {
  font-size: 18px;
  letter-spacing: 0;
}

.gallery-meta {
  justify-content: space-between;
}

.result-pill {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.result-profit {
  color: #16885d;
  background: #e8f6ee;
}

.result-loss {
  color: #b23b34;
  background: #f8e9e7;
}

.gallery-pnl {
  font-size: 20px;
  line-height: 1;
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

  .review-gallery {
    grid-template-columns: 1fr;
  }

  .review-title {
    align-items: flex-start;
    flex-direction: column;
  }
}

@media (min-width: 961px) and (max-width: 1180px) {
  .review-gallery {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 1181px) and (max-width: 1460px) {
  .review-gallery {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
