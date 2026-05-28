<template>
  <el-card class="panel" shadow="never">
    <template #header>
      <div class="panel-header">
        <span>交易记录</span>
        <el-button type="primary">新增交易</el-button>
      </div>
    </template>

    <el-table :data="trades" size="large">
      <el-table-column prop="symbol" label="品种" min-width="120" />
      <el-table-column prop="market" label="市场" min-width="100" />
      <el-table-column prop="direction" label="方向" min-width="90" />
      <el-table-column prop="entry" label="入场价" min-width="110" />
      <el-table-column prop="exit" label="出场价" min-width="110" />
      <el-table-column prop="pnl" label="盈亏" min-width="110">
        <template #default="{ row }">
          <span :class="row.pnl >= 0 ? 'profit' : 'loss'">{{ row.pnl }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="closedAt" label="平仓时间" min-width="140" />
    </el-table>
  </el-card>
</template>

<script setup lang="ts">
const trades = [
  { symbol: 'EUR/USD', market: '外汇', direction: '做多', entry: 1.0824, exit: 1.0891, pnl: 670, closedAt: '2026-05-20' },
  { symbol: 'BTC/USDT', market: '加密货币', direction: '做空', entry: 68200, exit: 67540, pnl: 820, closedAt: '2026-05-21' },
  { symbol: 'GBP/JPY', market: '外汇', direction: '做多', entry: 191.42, exit: 190.88, pnl: -340, closedAt: '2026-05-22' }
];
</script>
