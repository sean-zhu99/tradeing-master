<template>
  <section class="trades-page">
    <header class="trades-title">
      <div>
        <span>Trade Records</span>
        <h1>交易记录</h1>
      </div>
      <el-tag effect="plain" round>
        合计 {{ tradingStore.trades.length }} 笔 · MT5 {{ tradingStore.mt5ReportTrades.length }} · 交易所 {{ tradingStore.exchangeTrades.length }}
      </el-tag>
    </header>

    <el-card class="panel trades-filter" shadow="never">
      <el-select v-model="filters.symbol" clearable placeholder="品种">
        <el-option v-for="symbol in tradingStore.symbols" :key="symbol" :label="symbol" :value="symbol" />
      </el-select>
      <el-select v-model="filters.direction" clearable placeholder="方向">
        <el-option label="Long" value="long" />
        <el-option label="Short" value="short" />
      </el-select>
      <el-select v-model="filters.pnlStatus" placeholder="盈亏状态">
        <el-option label="全部" value="all" />
        <el-option label="盈利" value="profit" />
        <el-option label="亏损" value="loss" />
      </el-select>
      <el-input v-model="filters.keyword" clearable placeholder="搜索订单号" />
    </el-card>

    <el-card class="panel" shadow="never">
      <template #header>
        <div class="panel-header">
          <span>订单明细</span>
          <small>按平仓时间倒序</small>
        </div>
      </template>

      <el-table :data="pagedTrades" size="large" stripe empty-text="暂无交易记录">
        <el-table-column prop="tradeId" label="订单ID" min-width="130" />
        <el-table-column prop="symbol" label="品种" min-width="100" />
        <el-table-column prop="direction" label="方向" min-width="90">
          <template #default="{ row }">
            <el-tag :type="row.direction === 'long' ? 'success' : 'danger'" effect="plain">
              {{ row.direction === 'long' ? 'Long' : 'Short' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="入场价" min-width="110" align="right">
          <template #default="{ row }">{{ formatPrice(row.entryPrice) }}</template>
        </el-table-column>
        <el-table-column label="出场价" min-width="110" align="right">
          <template #default="{ row }">{{ row.exitPrice ? formatPrice(row.exitPrice) : '-' }}</template>
        </el-table-column>
        <el-table-column label="手数" min-width="80" align="right">
          <template #default="{ row }">{{ formatNumber(row.quantity) }}</template>
        </el-table-column>
        <el-table-column label="盈亏" min-width="120" align="right">
          <template #default="{ row }">
            <span :class="row.pnl >= 0 ? 'profit-value' : 'loss-value'">{{ formatCurrency(row.pnl) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="平仓时间" min-width="160">
          <template #default="{ row }">{{ formatDateTime(row.exitTime || row.entryTime) }}</template>
        </el-table-column>
      </el-table>

      <div class="pagination-row">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          layout="prev, pager, next"
          :total="filteredTrades.length"
        />
      </div>
    </el-card>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import dayjs from 'dayjs';
import { useTradingStore } from '@/stores/trading';

const tradingStore = useTradingStore();
const page = ref(1);
const pageSize = 20;
const filters = reactive({
  symbol: '',
  direction: '',
  pnlStatus: 'all',
  keyword: ''
});

const filteredTrades = computed(() => {
  const keyword = filters.keyword.trim().toLowerCase();

  return [...tradingStore.trades]
    .filter((trade) => !filters.symbol || trade.symbol === filters.symbol)
    .filter((trade) => !filters.direction || trade.direction === filters.direction)
    .filter((trade) => filters.pnlStatus !== 'profit' || trade.pnl > 0)
    .filter((trade) => filters.pnlStatus !== 'loss' || trade.pnl < 0)
    .filter((trade) => !keyword || (trade.tradeId || '').toLowerCase().includes(keyword))
    .sort((a, b) => dayjs(b.exitTime || b.entryTime).valueOf() - dayjs(a.exitTime || a.entryTime).valueOf());
});

const pagedTrades = computed(() => {
  const start = (page.value - 1) * pageSize;
  return filteredTrades.value.slice(start, start + pageSize);
});

watch(filters, () => {
  page.value = 1;
});

onMounted(() => {
  tradingStore.loadTrades(1, 500);
});

function formatCurrency(value: number) {
  return `${value >= 0 ? '+' : '-'}$${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatPrice(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatNumber(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatDateTime(value: string) {
  return dayjs(value).format('YYYY-MM-DD HH:mm');
}
</script>

<style scoped>
.trades-page {
  width: min(1380px, 100%);
  margin: 0 auto;
}

.trades-title {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 18px;
  border-bottom: 1px solid #e6dfd4;
}

.trades-title span {
  color: #81786f;
  font-size: 12px;
  font-weight: 760;
  text-transform: uppercase;
}

.trades-title h1 {
  margin: 8px 0 0;
  font-size: 34px;
}

.panel {
  border: 1px solid #e6dfd4;
  border-radius: 8px;
  background: #fffdf9;
}

.trades-filter {
  margin: 18px 0 14px;
}

.trades-filter :deep(.el-card__body) {
  display: grid;
  grid-template-columns: repeat(3, minmax(140px, 1fr)) minmax(220px, 1.3fr);
  gap: 10px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.panel-header small {
  color: #81786f;
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
  .trades-title {
    align-items: flex-start;
    flex-direction: column;
  }

  .trades-filter :deep(.el-card__body) {
    grid-template-columns: 1fr;
  }
}
</style>
