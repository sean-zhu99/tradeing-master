<template>
  <section class="manage-page">
    <header class="manage-title">
      <div>
        <span>🔒 复盘管理模式</span>
        <h1>交易复盘管理</h1>
      </div>
      <el-button type="primary" plain :loading="tradingStore.loading" @click="syncOrders">
        同步 MT5 / 交易所订单
      </el-button>
    </header>

    <el-tabs v-model="activeTab" class="manage-tabs">
      <el-tab-pane label="持仓复盘" name="open">
        <div v-loading="tradingStore.loading" class="position-grid">
          <el-empty v-if="!openTrades.length" description="暂无持仓" />
          <el-card v-for="trade in openTrades" :key="trade.id" class="position-card" shadow="never">
            <div class="position-top">
              <strong>{{ trade.symbol }}</strong>
              <el-tag :type="trade.direction === 'long' ? 'success' : 'danger'" effect="plain">
                {{ trade.direction === 'long' ? '做多' : '做空' }}
              </el-tag>
            </div>
            <div class="position-price">
              <span>入场价</span>
              <b>{{ formatPrice(trade.entryPrice) }}</b>
            </div>
            <div class="position-meta">
              <span>当前价 {{ formatPrice(trade.exitPrice || trade.entryPrice) }}</span>
              <span :class="floatingPnl(trade) >= 0 ? 'profit-value' : 'loss-value'">
                浮盈 {{ formatCurrency(floatingPnl(trade)) }}
              </span>
            </div>
            <div class="card-actions">
              <el-button plain @click="openReadonlyDialog(trade)">查看订单</el-button>
              <el-button plain :loading="isGeneratingChart(trade.id)" @click="generateTradeChart(trade)">
                生成K线截图
              </el-button>
              <el-button type="primary" plain @click="openEditDialog(trade)">补充复盘</el-button>
            </div>
          </el-card>
        </div>
      </el-tab-pane>

      <el-tab-pane label="已平仓复盘" name="closed">
        <el-card class="manage-filter" shadow="never">
          <el-date-picker v-model="filters.dateRange" type="daterange" value-format="YYYY-MM-DD" start-placeholder="开始日期" end-placeholder="结束日期" />
          <el-select v-model="filters.symbols" multiple collapse-tags placeholder="品种">
            <el-option v-for="symbol in tradingStore.symbols" :key="symbol" :label="symbol" :value="symbol" />
          </el-select>
          <el-select v-model="filters.tags" multiple collapse-tags placeholder="标签">
            <el-option v-for="tag in tradingStore.tags" :key="tag" :label="tag" :value="tag" />
          </el-select>
          <el-select v-model="filters.pnlStatus" placeholder="盈亏状态">
            <el-option label="全部" value="all" />
            <el-option label="盈利" value="profit" />
            <el-option label="亏损" value="loss" />
          </el-select>
          <el-select v-model="filters.rating" clearable placeholder="评分">
            <el-option v-for="rating in 5" :key="rating" :label="`${rating} 星`" :value="rating" />
          </el-select>
          <el-input v-model="filters.keyword" clearable placeholder="搜索进场理由、备注" />
        </el-card>

        <div v-loading="tradingStore.loading" class="closed-list">
          <el-empty v-if="!closedTrades.length" description="暂无已平仓复盘" />
          <article v-for="trade in closedTrades" :key="trade.id" class="closed-card">
            <div class="closed-head">
              <div>
                <strong>{{ trade.symbol }}</strong>
                <el-tag :type="trade.direction === 'long' ? 'success' : 'danger'" effect="plain">
                  {{ trade.direction === 'long' ? '做多' : '做空' }}
                </el-tag>
              </div>
              <span :class="trade.pnl >= 0 ? 'profit-value' : 'loss-value'">{{ formatCurrency(trade.pnl) }}</span>
              <el-rate :model-value="trade.rating || 0" @change="(value: number) => updateRating(trade, value)" />
            </div>
            <div class="price-line">
              {{ formatPrice(trade.entryPrice) }} → {{ trade.exitPrice ? formatPrice(trade.exitPrice) : '-' }}
              <span>数量 {{ formatNumber(trade.quantity) }}</span>
              <span>{{ trade.leverage }}x</span>
              <span>{{ holdingDuration(trade) }}</span>
            </div>
            <p>{{ truncate(trade.entryReason || '暂无进场理由') }}</p>
            <div class="tag-row">
              <el-tag v-for="tag in trade.tags" :key="tag" round effect="plain">{{ tag }}</el-tag>
            </div>
            <div class="card-actions">
              <el-button plain @click="openReadonlyDialog(trade)">查看详情</el-button>
              <el-button plain :loading="isGeneratingChart(trade.id)" @click="generateTradeChart(trade)">
                生成K线截图
              </el-button>
              <el-button type="primary" plain @click="openEditDialog(trade)">补充复盘</el-button>
              <el-button type="danger" plain @click="confirmDelete(trade)">移除复盘</el-button>
            </div>
          </article>
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="formVisible" :title="formTitle" width="760px">
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <div class="synced-order">
          <div><span>订单ID</span><b>{{ activeTrade?.tradeId || '-' }}</b></div>
          <div><span>品种</span><b>{{ form.symbol }}</b></div>
          <div><span>方向</span><b>{{ form.direction === 'long' ? '做多' : '做空' }}</b></div>
          <div><span>入场价</span><b>{{ formatPrice(form.entryPrice) }}</b></div>
          <div><span>出场价</span><b>{{ form.exitPrice ? formatPrice(form.exitPrice) : '持仓中' }}</b></div>
          <div><span>数量 / 杠杆</span><b>{{ formatNumber(form.quantity) }} / {{ form.leverage }}x</b></div>
          <div><span>入场时间</span><b>{{ form.entryTime || '-' }}</b></div>
          <div><span>出场时间</span><b>{{ form.exitTime || '-' }}</b></div>
        </div>
        <p class="form-hint">订单价格、手数和时间来自 MT5 / 交易所同步。这里仅补充复盘内容，用来总结这笔交易的问题和经验。</p>
        <el-form-item label="进场理由" prop="entryReason"><el-input v-model="form.entryReason" type="textarea" :rows="4" /></el-form-item>
        <el-form-item label="出场理由"><el-input v-model="form.exitReason" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.notes" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="标签">
          <el-select v-model="form.tags" multiple filterable allow-create default-first-option class="full-width" placeholder="输入后回车创建标签" />
        </el-form-item>
        <el-form-item label="截图">
          <div class="screenshot-input">
            <el-input v-model="screenshotUrl" placeholder="粘贴截图 URL" />
            <el-button @click="addScreenshotUrl">添加</el-button>
            <el-button
              v-if="activeTrade"
              plain
              :loading="isGeneratingChart(activeTrade.id)"
              @click="generateTradeChart(activeTrade)"
            >
              生成K线截图
            </el-button>
            <el-upload :auto-upload="false" :show-file-list="false" :on-change="addScreenshotFile">
              <el-button plain>上传</el-button>
            </el-upload>
          </div>
          <div class="screenshot-list">
            <el-tag
              v-for="(url, index) in form.screenshots"
              :key="url"
              closable
              @close="removeScreenshot(url)"
            >
              截图 {{ index + 1 }}
            </el-tag>
          </div>
        </el-form-item>
        <el-form-item label="自我评分"><el-rate v-model="form.rating" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveForm">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailVisible" title="交易详情" width="760px">
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
        <h3>备注</h3>
        <p class="detail-text">{{ activeTrade.notes || '暂无' }}</p>
        <h3>截图</h3>
        <div class="detail-screenshots">
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
        <div class="dialog-tags">
          <el-tag v-for="tag in activeTrade.tags" :key="tag" effect="plain">{{ tag }}</el-tag>
          <el-rate :model-value="activeTrade.rating || 0" disabled />
        </div>
      </template>
    </el-dialog>

    <div class="chart-exporter" aria-hidden="true">
      <TradeKlineChart ref="klineChartRef" :trade="klineTrade" :candles="klineCandles" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import dayjs from 'dayjs';
import TradeKlineChart from '@/components/charts/TradeKlineChart.vue';
import { useTradingStore } from '@/stores/trading';
import type { KlineCandle, Trade, TradeDirection, TradeStatus, TradeUpdatePayload } from '@/types';

const tradingStore = useTradingStore();
const activeTab = ref<'open' | 'closed'>('open');
const formVisible = ref(false);
const detailVisible = ref(false);
const saving = ref(false);
const editingId = ref<number | null>(null);
const activeTrade = ref<Trade | null>(null);
const formRef = ref<FormInstance>();
const screenshotUrl = ref('');
const generatingChartIds = ref(new Set<number>());
const klineChartRef = ref<InstanceType<typeof TradeKlineChart>>();
const klineTrade = ref<Trade | null>(null);
const klineCandles = ref<KlineCandle[]>([]);

const filters = reactive({
  dateRange: [] as string[],
  symbols: [] as string[],
  tags: [] as string[],
  pnlStatus: 'all',
  rating: undefined as number | undefined,
  keyword: ''
});

const form = reactive({
  symbol: '',
  direction: 'long' as TradeDirection,
  entryPrice: 0,
  exitPrice: undefined as number | undefined,
  quantity: 0,
  leverage: 1,
  entryTime: '',
  exitTime: '',
  entryReason: '',
  exitReason: '',
  notes: '',
  tags: [] as string[],
  screenshots: [] as string[],
  rating: 0,
  status: 'open' as TradeStatus
});

const rules: FormRules = {
  entryReason: [{ required: true, message: '请输入进场理由', trigger: 'blur' }]
};

const openTrades = computed(() => tradingStore.trades.filter((trade) => trade.status === 'open'));
const closedTrades = computed(() => {
  return tradingStore.trades.filter((trade) => trade.status === 'closed').filter((trade) => {
    const closedDate = dayjs(trade.exitTime || trade.entryTime).format('YYYY-MM-DD');
    const keyword = filters.keyword.trim().toLowerCase();
    if (filters.dateRange.length === 2 && (closedDate < filters.dateRange[0] || closedDate > filters.dateRange[1])) return false;
    if (filters.symbols.length && !filters.symbols.includes(trade.symbol)) return false;
    if (filters.tags.length && !filters.tags.every((tag) => trade.tags.includes(tag))) return false;
    if (filters.pnlStatus === 'profit' && trade.pnl <= 0) return false;
    if (filters.pnlStatus === 'loss' && trade.pnl >= 0) return false;
    if (filters.rating && trade.rating !== filters.rating) return false;
    if (keyword && !`${trade.entryReason || ''} ${trade.notes || ''}`.toLowerCase().includes(keyword)) return false;
    return true;
  });
});

const formTitle = computed(() => `补充复盘：${activeTrade.value?.symbol || ''}`);

onMounted(() => {
  tradingStore.loadTrades(1, 100);
});

function openEditDialog(trade: Trade) {
  editingId.value = trade.id;
  activeTrade.value = trade;
  Object.assign(form, {
    symbol: trade.symbol,
    direction: trade.direction,
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice || undefined,
    quantity: trade.quantity,
    leverage: trade.leverage,
    entryTime: dayjs(trade.entryTime).format('YYYY-MM-DD HH:mm:ss'),
    exitTime: trade.exitTime ? dayjs(trade.exitTime).format('YYYY-MM-DD HH:mm:ss') : '',
    entryReason: trade.entryReason || '',
    exitReason: trade.exitReason || '',
    notes: trade.notes || '',
    tags: [...trade.tags],
    screenshots: [...trade.screenshots],
    rating: trade.rating || 0,
    status: trade.status
  });
  formVisible.value = true;
}

function openReadonlyDialog(trade: Trade) {
  activeTrade.value = trade;
  detailVisible.value = true;
}

async function saveForm() {
  await formRef.value?.validate();
  saving.value = true;
  try {
    const payload = buildPayload();
    if (!editingId.value) return;
    await tradingStore.updateTrade(editingId.value, payload);
    ElMessage.success('复盘已保存');
    formVisible.value = false;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败');
  } finally {
    saving.value = false;
  }
}

async function updateRating(trade: Trade, rating: number) {
  try {
    await tradingStore.updateTrade(trade.id, { rating });
    ElMessage.success('评分已更新');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '评分更新失败');
  }
}

async function confirmDelete(trade: Trade) {
  await ElMessageBox.confirm('确定要移除这笔复盘记录吗？此操作不会删除 MT5 / 交易所源订单，但会从当前复盘列表移除。', '移除确认', {
    type: 'warning',
    confirmButtonText: '移除',
    cancelButtonText: '取消'
  });
  try {
    await tradingStore.deleteTrade(trade.id);
    ElMessage.success('已移除');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '删除失败');
  }
}

async function syncOrders() {
  try {
    await tradingStore.triggerSync();
    await tradingStore.loadTrades(1, 100);
    ElMessage.success('订单同步完成');
  } catch {
    await tradingStore.loadTrades(1, 100);
    ElMessage.warning('当前使用 MT5 报表与本地订单预览，远端交易所同步暂不可用');
  }
}

async function generateTradeChart(trade: Trade) {
  if (generatingChartIds.value.has(trade.id)) return;
  const nextGeneratingIds = new Set(generatingChartIds.value);
  nextGeneratingIds.add(trade.id);
  generatingChartIds.value = nextGeneratingIds;

  try {
    const klineData = await tradingStore.loadTradeKline(trade.id);
    klineTrade.value = klineData.trade;
    klineCandles.value = klineData.candles;
    await nextTick();
    const imageUrl = await klineChartRef.value?.generateImage();
    if (!imageUrl) throw new Error('K线截图生成失败');

    const screenshots = [imageUrl, ...trade.screenshots.filter((url) => url !== imageUrl)];
    await tradingStore.updateTrade(trade.id, { screenshots });

    if (activeTrade.value?.id === trade.id) {
      activeTrade.value = { ...activeTrade.value, screenshots };
    }

    if (editingId.value === trade.id) {
      form.screenshots = screenshots;
    }

    ElMessage.success('K线截图已生成并保存到订单');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '生成K线截图失败');
  } finally {
    const doneGeneratingIds = new Set(generatingChartIds.value);
    doneGeneratingIds.delete(trade.id);
    generatingChartIds.value = doneGeneratingIds;
  }
}

function isGeneratingChart(id: number) {
  return generatingChartIds.value.has(id);
}

function buildPayload(): TradeUpdatePayload {
  return {
    entryReason: form.entryReason,
    exitReason: form.exitReason || null,
    notes: form.notes || null,
    tags: form.tags,
    screenshots: form.screenshots,
    rating: form.rating || null
  };
}

function addScreenshotUrl() {
  if (!screenshotUrl.value.trim()) return;
  form.screenshots.push(screenshotUrl.value.trim());
  screenshotUrl.value = '';
}

function addScreenshotFile(file: { raw?: File; name: string }) {
  if (file.raw) form.screenshots.push(URL.createObjectURL(file.raw));
}

function removeScreenshot(url: string) {
  form.screenshots = form.screenshots.filter((item) => item !== url);
}

function floatingPnl(trade: Trade) {
  const currentPrice = trade.exitPrice || trade.entryPrice;
  const diff = trade.direction === 'long' ? currentPrice - trade.entryPrice : trade.entryPrice - currentPrice;
  return Number((diff * trade.quantity * trade.leverage).toFixed(2));
}

function holdingDuration(trade: Trade) {
  if (!trade.exitTime) return '持仓中';
  const minutes = dayjs(trade.exitTime).diff(dayjs(trade.entryTime), 'minute');
  if (minutes < 60) return `${minutes}分钟`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}小时`;
  return `${Math.floor(minutes / 1440)}天`;
}

function truncate(value: string) {
  return value.length > 100 ? `${value.slice(0, 100)}...` : value;
}

function formatCurrency(value: number) {
  return `${value >= 0 ? '+' : '-'}${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
}

function formatPrice(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 8 });
}

function formatNumber(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

function formatDateTime(value: string) {
  return dayjs(value).format('YYYY-MM-DD HH:mm');
}
</script>

<style scoped>
.manage-page {
  width: min(1360px, 100%);
  margin: 0 auto;
}

.manage-title {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
  padding-bottom: 18px;
  border-bottom: 1px solid #e8e1d7;
}

.manage-title span {
  color: #8a8177;
  font-weight: 760;
}

.manage-title h1 {
  margin: 8px 0 0;
  font-size: 34px;
}

.manage-tabs {
  margin-top: 18px;
}

.position-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

.position-card,
.manage-filter,
.closed-card {
  border: 1px solid #e7e2da;
  border-radius: 8px;
  background: #fffdf9;
}

.position-top,
.position-meta,
.closed-head,
.price-line,
.tag-row,
.card-actions,
.screenshot-input,
.screenshot-list {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.position-top,
.closed-head {
  justify-content: space-between;
}

.position-price {
  margin: 18px 0;
}

.position-price span {
  display: block;
  color: #8a8177;
  font-size: 12px;
}

.position-price b {
  display: block;
  margin-top: 6px;
  font-size: 24px;
}

.card-actions {
  margin-top: 14px;
}

.manage-filter {
  margin-bottom: 14px;
}

.manage-filter :deep(.el-card__body) {
  display: grid;
  grid-template-columns: 260px repeat(4, minmax(130px, 1fr)) minmax(220px, 1.2fr);
  gap: 10px;
}

.closed-list {
  display: grid;
  gap: 12px;
}

.closed-card {
  padding: 16px;
}

.closed-head > div {
  display: flex;
  align-items: center;
  gap: 10px;
}

.price-line {
  margin-top: 12px;
  color: #6f6a64;
}

.closed-card p {
  margin: 12px 0;
  line-height: 1.6;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 12px;
}

.synced-order {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.synced-order div {
  padding: 12px;
  border: 1px solid #eee9e1;
  border-radius: 8px;
  background: #faf7f1;
}

.synced-order span {
  display: block;
  color: #8a8177;
  font-size: 12px;
}

.synced-order b {
  display: block;
  margin-top: 6px;
}

.form-hint {
  margin: 0 0 16px;
  color: #8a8177;
  font-size: 13px;
}

.full-width {
  width: 100%;
}

.screenshot-input {
  width: 100%;
}

.screenshot-input .el-input {
  flex: 1;
}

.screenshot-list {
  margin-top: 10px;
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

.detail-screenshots {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}

.detail-screenshots :deep(.el-image) {
  height: 96px;
  overflow: hidden;
  border: 1px solid #e7e2da;
  border-radius: 8px;
}

.dialog-tags {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.chart-exporter {
  position: fixed;
  left: -2000px;
  top: 0;
  width: 960px;
  height: 540px;
  pointer-events: none;
  opacity: 0;
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
  .manage-title,
  .closed-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .manage-filter :deep(.el-card__body),
  .form-grid,
  .synced-order,
  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
