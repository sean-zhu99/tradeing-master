<template>
  <section class="calendar-page">
    <div class="calendar-layout">
      <aside class="calendar-sidebar">
        <div class="side-title">
          <span>Trading Calendar</span>
          <h1>{{ monthTitle }}</h1>
        </div>

        <div class="side-kpis">
          <div>
            <span>Monthly P/L</span>
            <strong :class="monthPnl >= 0 ? 'profit-value' : 'loss-value'">{{ formatCompact(monthPnl) }}</strong>
          </div>
          <div>
            <span>Trades</span>
            <strong>{{ monthTradeCount }}</strong>
          </div>
          <div>
            <span>Win Rate</span>
            <strong>{{ monthWinRate }}%</strong>
          </div>
          <div>
            <span>Trading Days</span>
            <strong>{{ activeTradingDays.length }}</strong>
          </div>
        </div>

        <div class="side-card">
          <div class="side-card-title">Best / Worst Day</div>
          <div class="rank-line">
            <span>Best</span>
            <b v-if="bestDay" class="profit-value">{{ bestDay.date }} · {{ formatPnl(bestDay.totalPnl) }}</b>
            <b v-else>-</b>
          </div>
          <div class="rank-line">
            <span>Worst</span>
            <b v-if="worstDay" class="loss-value">{{ worstDay.date }} · {{ formatPnl(worstDay.totalPnl) }}</b>
            <b v-else>-</b>
          </div>
        </div>

        <div class="side-card">
          <div class="side-card-title">Trading Days</div>
          <button
            v-for="summary in activeTradingDays"
            :key="summary.date"
            class="day-list-item"
            @click="openDay(summary.date)"
          >
            <span>{{ summary.date.slice(5) }}</span>
            <small>{{ summary.tradeCount }} trades</small>
            <b :class="summary.totalPnl >= 0 ? 'profit-value' : 'loss-value'">{{ formatPnl(summary.totalPnl) }}</b>
          </button>
          <el-empty v-if="!activeTradingDays.length" description="本月暂无交易" :image-size="70" />
        </div>
      </aside>

      <div class="calendar-shell">
        <header class="calendar-toolbar">
          <div class="month-controls">
            <button class="icon-button" @click="goPreviousMonth">
              <el-icon><ArrowLeft /></el-icon>
            </button>
            <h2>{{ monthTitle }}</h2>
            <button class="icon-button" @click="goNextMonth">
              <el-icon><ArrowRight /></el-icon>
            </button>
          </div>

          <div class="toolbar-actions">
            <button class="tool-button" @click="goCurrentMonth">
              <el-icon><Sunny /></el-icon>
            </button>
            <button class="tool-button" :class="{ spinning: tradingStore.loading }" @click="refreshData">
              <el-icon><Refresh /></el-icon>
            </button>
          </div>
        </header>

        <div class="calendar-grid calendar-weekdays">
          <div v-for="day in weekdays" :key="day">{{ day }}</div>
          <div>Summary</div>
        </div>

        <div class="calendar-body">
          <div v-for="week in calendarWeeks" :key="week.key" class="calendar-grid week-row">
            <button
              v-for="day in week.days"
              :key="day.date"
              class="day-cell"
              :class="[
                { muted: !day.isCurrentMonth, today: day.isToday },
                day.summary && day.summary.totalPnl > 0 ? 'positive-day' : '',
                day.summary && day.summary.totalPnl < 0 ? 'negative-day' : ''
              ]"
              @click="openDay(day.date)"
            >
              <span class="day-number">{{ day.dayNumber }}</span>
              <div v-if="day.summary" class="day-result">
                <strong>{{ day.summary.tradeCount }}</strong>
                <b :class="day.summary.totalPnl >= 0 ? 'profit-value' : 'loss-value'">
                  {{ formatPnl(day.summary.totalPnl) }}
                </b>
              </div>
            </button>

            <div class="summary-cell">
              <template v-if="week.summary.tradeCount">
                <strong>{{ week.summary.tradeCount }} trades</strong>
                <b :class="week.summary.totalPnl >= 0 ? 'profit-value' : 'loss-value'">
                  {{ formatPnl(week.summary.totalPnl) }}
                </b>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <el-dialog v-model="dayDialogVisible" :title="activeDateTitle" width="720px">
      <el-table :data="activeTrades" empty-text="当天暂无交易">
        <el-table-column prop="symbol" label="品种" min-width="120" />
        <el-table-column label="方向" min-width="80">
          <template #default="{ row }">{{ row.direction === 'long' ? '做多' : '做空' }}</template>
        </el-table-column>
        <el-table-column label="时间" min-width="160">
          <template #default="{ row }">{{ formatTime(row.exitTime || row.entryTime) }}</template>
        </el-table-column>
        <el-table-column label="盈亏" align="right" min-width="120">
          <template #default="{ row }">
            <span :class="row.pnl >= 0 ? 'profit-value' : 'loss-value'">{{ formatPnl(row.pnl) }}</span>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ArrowLeft, ArrowRight, Refresh, Sunny } from '@element-plus/icons-vue';
import dayjs from 'dayjs';
import { useTradingStore } from '@/stores/trading';
import type { DailySummary, Trade } from '@/types';

interface CalendarDay {
  date: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  summary?: DailySummary;
}

interface WeekRow {
  key: string;
  days: CalendarDay[];
  summary: Pick<DailySummary, 'totalPnl' | 'tradeCount' | 'winCount' | 'lossCount' | 'totalFee'>;
}

const tradingStore = useTradingStore();
const currentMonth = ref(dayjs().startOf('month'));
const activeDate = ref('');
const dayDialogVisible = ref(false);
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const monthTitle = computed(() => currentMonth.value.format('MMMM-YYYY'));

const summaryMap = computed(() => {
  return new Map(tradingStore.dailySummary.map((summary) => [summary.date, summary]));
});

const calendarWeeks = computed<WeekRow[]>(() => {
  const start = currentMonth.value.startOf('month');
  const end = currentMonth.value.endOf('month');
  let cursor = start.subtract((start.day() + 6) % 7, 'day');
  const finalDay = end.add(4 - ((end.day() + 6) % 7), 'day');
  const weeks: WeekRow[] = [];

  while (cursor.isBefore(finalDay) || cursor.isSame(finalDay, 'day')) {
    const days: CalendarDay[] = [];
    for (let index = 0; index < 5; index += 1) {
      const date = cursor.add(index, 'day');
      const dateKey = date.format('YYYY-MM-DD');
      days.push({
        date: dateKey,
        dayNumber: date.date(),
        isCurrentMonth: date.month() === currentMonth.value.month(),
        isToday: date.isSame(dayjs(), 'day'),
        summary: summaryMap.value.get(dateKey)
      });
    }

    weeks.push({
      key: cursor.format('YYYY-MM-DD'),
      days,
      summary: buildWeekSummary(cursor)
    });

    cursor = cursor.add(7, 'day');
  }

  return weeks;
});

function buildWeekSummary(weekStart: dayjs.Dayjs): WeekRow['summary'] {
  const summary = { totalPnl: 0, tradeCount: 0, winCount: 0, lossCount: 0, totalFee: 0 };

  for (let index = 0; index < 7; index += 1) {
    const date = weekStart.add(index, 'day');
    if (!date.isSame(currentMonth.value, 'month')) continue;

    const daySummary = summaryMap.value.get(date.format('YYYY-MM-DD'));
    if (!daySummary) continue;

    summary.totalPnl = Number((summary.totalPnl + daySummary.totalPnl).toFixed(2));
    summary.tradeCount += daySummary.tradeCount;
    summary.winCount += daySummary.winCount;
    summary.lossCount += daySummary.lossCount;
    summary.totalFee = Number((summary.totalFee + daySummary.totalFee).toFixed(2));
  }

  return summary;
}

const monthSummaries = computed(() => {
  return tradingStore.dailySummary.filter((summary) => dayjs(summary.date).isSame(currentMonth.value, 'month'));
});

const monthPnl = computed(() => monthSummaries.value.reduce((sum, item) => sum + item.totalPnl, 0));
const monthTradeCount = computed(() => monthSummaries.value.reduce((sum, item) => sum + item.tradeCount, 0));
const activeTradingDays = computed(() => [...monthSummaries.value].sort((a, b) => b.date.localeCompare(a.date)));
const monthWinRate = computed(() => {
  const wins = monthSummaries.value.reduce((sum, item) => sum + item.winCount, 0);
  const trades = monthTradeCount.value;
  return trades ? ((wins / trades) * 100).toFixed(0) : '0';
});
const bestDay = computed(() => {
  return [...monthSummaries.value].sort((a, b) => b.totalPnl - a.totalPnl)[0];
});
const worstDay = computed(() => {
  return [...monthSummaries.value].sort((a, b) => a.totalPnl - b.totalPnl)[0];
});

const activeTrades = computed(() => {
  return tradingStore.trades.filter((trade) => formatTradeDate(trade) === activeDate.value);
});

const activeDateTitle = computed(() => (activeDate.value ? `${activeDate.value} 交易明细` : '交易明细'));

onMounted(async () => {
  await Promise.all([tradingStore.loadTrades(1, 100), tradingStore.loadDailySummary(1)]);
});

function goPreviousMonth() {
  currentMonth.value = currentMonth.value.subtract(1, 'month');
}

function goNextMonth() {
  currentMonth.value = currentMonth.value.add(1, 'month');
}

function goCurrentMonth() {
  currentMonth.value = dayjs().startOf('month');
}

async function refreshData() {
  await Promise.all([tradingStore.loadTrades(1, 100), tradingStore.loadDailySummary(1)]);
}

function openDay(date: string) {
  activeDate.value = date;
  dayDialogVisible.value = true;
}

function formatPnl(value: number) {
  if (Math.abs(value) >= 1000) return `${value >= 0 ? '' : '-'}${(Math.abs(value) / 1000).toFixed(1)}K`;
  return value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatCompact(value: number) {
  if (Math.abs(value) >= 1000) return `${value >= 0 ? '' : '-'}${(Math.abs(value) / 1000).toFixed(1)}K`;
  return value.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

function formatTime(value: string) {
  return dayjs(value).format('YYYY-MM-DD HH:mm');
}

function formatTradeDate(trade: Trade) {
  return dayjs(trade.exitTime || trade.entryTime).format('YYYY-MM-DD');
}
</script>

<style scoped>
.calendar-page {
  width: min(1420px, 100%);
  margin: 0 auto;
}

.calendar-layout {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.calendar-sidebar,
.calendar-shell {
  overflow: hidden;
  border: 1px solid #dedede;
  border-radius: 12px;
  background: #ffffff;
}

.calendar-sidebar {
  display: grid;
  gap: 14px;
  padding: 18px;
}

.side-title span {
  color: #76767e;
  font-size: 12px;
  font-weight: 760;
  text-transform: uppercase;
}

.side-title h1 {
  margin: 8px 0 0;
  font-size: 26px;
  letter-spacing: 0;
}

.side-kpis {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.side-kpis div,
.side-card {
  border: 1px solid #eeeeee;
  border-radius: 10px;
  background: #fbfbfb;
}

.side-kpis div {
  padding: 12px;
}

.side-kpis span,
.rank-line span {
  display: block;
  color: #76767e;
  font-size: 12px;
}

.side-kpis strong {
  display: block;
  margin-top: 8px;
  color: #111111;
  font-size: 20px;
}

.side-card {
  padding: 12px;
}

.side-card-title {
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 760;
}

.rank-line {
  display: grid;
  gap: 4px;
  padding: 8px 0;
}

.rank-line + .rank-line {
  border-top: 1px solid #eeeeee;
}

.day-list-item {
  display: grid;
  grid-template-columns: 52px 1fr auto;
  gap: 8px;
  align-items: center;
  width: 100%;
  min-height: 38px;
  padding: 0;
  border: 0;
  border-bottom: 1px solid #eeeeee;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.day-list-item:hover {
  background: #f8f8f8;
}

.day-list-item span {
  font-weight: 760;
}

.day-list-item small {
  color: #76767e;
}

.calendar-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 64px;
  padding: 10px 18px;
  border-bottom: 1px solid #eeeeee;
}

.month-controls,
.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.month-controls h2 {
  min-width: 190px;
  margin: 0;
  text-align: center;
  font-size: 22px;
  letter-spacing: 0;
}

.icon-button,
.tool-button {
  display: grid;
  place-items: center;
  border: 0;
  background: transparent;
  cursor: pointer;
  font-size: 22px;
}

.tool-button {
  width: 42px;
  height: 42px;
  border: 1px solid #dedee4;
  border-radius: 10px;
  background: #ffffff;
}

.spinning {
  animation: spin 0.8s linear infinite;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr)) minmax(128px, 0.72fr);
}

.calendar-weekdays {
  min-height: 44px;
  border-bottom: 1px solid #eeeeee;
}

.calendar-weekdays div {
  display: grid;
  place-items: center;
  color: #75757f;
  border-right: 1px solid #eeeeee;
  font-size: 15px;
  font-weight: 600;
}

.calendar-weekdays div:last-child {
  border-right: 0;
}

.week-row {
  min-height: 116px;
}

.day-cell,
.summary-cell {
  position: relative;
  min-height: 116px;
  padding: 10px;
  border: 1px solid #eeeeee;
  border-width: 0 1px 1px 0;
  background: #ffffff;
}

.day-cell {
  text-align: left;
  cursor: pointer;
}

.day-cell:hover {
  box-shadow: inset 0 0 0 2px #d6d6d6;
}

.summary-cell {
  display: grid;
  place-items: center;
  gap: 8px;
  border-right: 0;
  color: #74747d;
  text-align: center;
}

.muted {
  background: #f4f4f6;
  color: #b0b0b8;
}

.today {
  box-shadow: inset 0 0 0 2px #2f2b27;
}

.positive-day {
  background: #eef8f2;
}

.negative-day {
  background: #f8eeee;
}

.day-number {
  color: #0e0e10;
  font-size: 19px;
  font-weight: 650;
}

.day-result {
  position: absolute;
  top: 50%;
  left: 50%;
  display: grid;
  gap: 4px;
  min-width: 90px;
  text-align: center;
  transform: translate(-50%, -38%);
}

.day-result strong,
.summary-cell strong {
  color: #74747d;
  font-size: 16px;
}

.day-result b,
.summary-cell b {
  font-size: 18px;
}

.profit-value {
  color: #16a34a !important;
  font-weight: 760;
}

.loss-value {
  color: #dc2626 !important;
  font-weight: 760;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1120px) {
  .calendar-layout {
    grid-template-columns: 1fr;
  }

  .side-kpis {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 980px) {
  .calendar-toolbar {
    align-items: flex-start;
    flex-direction: column;
    padding: 18px;
  }

  .month-controls {
    flex-wrap: wrap;
    gap: 12px;
  }

  .month-controls h2 {
    min-width: 170px;
    font-size: 24px;
  }

  .calendar-shell {
    overflow-x: auto;
  }

  .calendar-grid {
    min-width: 840px;
  }
}

@media (max-width: 720px) {
  .side-kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
