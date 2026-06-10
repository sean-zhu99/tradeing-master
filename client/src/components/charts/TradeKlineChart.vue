<template>
  <div ref="chartRef" class="trade-kline-chart" />
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import * as echarts from 'echarts';
import type { ECharts, EChartsOption } from 'echarts';
import dayjs from 'dayjs';
import type { KlineCandle, Trade } from '@/types';

const props = defineProps<{
  trade: Trade | null;
  candles: KlineCandle[];
}>();

const chartRef = ref<HTMLDivElement>();
let chart: ECharts | null = null;

watch(
  () => [props.trade, props.candles],
  () => {
    renderChart();
  },
  { deep: true }
);

onBeforeUnmount(() => {
  chart?.dispose();
  chart = null;
});

async function generateImage() {
  await nextTick();
  renderChart();
  await nextTick();

  if (!chart) throw new Error('K线图尚未初始化');

  return chart.getDataURL({
    type: 'png',
    pixelRatio: 2,
    backgroundColor: '#ffffff'
  });
}

function renderChart() {
  if (!chartRef.value || !props.trade || !props.candles.length) return;
  chart = chart || echarts.init(chartRef.value);
  chart.resize({ width: 960, height: 540 });
  chart.setOption(buildOption(props.trade, props.candles), true);
}

function buildOption(trade: Trade, candles: KlineCandle[]): EChartsOption {
  const categories = candles.map((candle) => dayjs(candle.time).format('MM-DD HH:mm'));
  const values = candles.map((candle) => [candle.open, candle.close, candle.low, candle.high]);
  const volumes = candles.map((candle) => candle.volume);
  const entryIndex = nearestCandleIndex(candles, trade.entryTime);
  const exitIndex = trade.exitTime ? nearestCandleIndex(candles, trade.exitTime) : candles.length - 1;
  const isProfit = trade.pnl >= 0;
  const directionText = trade.direction === 'long' ? 'Long' : 'Short';

  return {
    animation: false,
    backgroundColor: '#ffffff',
    title: {
      text: `${trade.symbol} ${directionText}`,
      subtext: `${dayjs(trade.entryTime).format('YYYY-MM-DD HH:mm')} -> ${
        trade.exitTime ? dayjs(trade.exitTime).format('YYYY-MM-DD HH:mm') : '持仓中'
      }   PnL ${formatPnl(trade.pnl)}`,
      left: 24,
      top: 16,
      textStyle: { color: '#202124', fontSize: 22, fontWeight: 700 },
      subtextStyle: { color: isProfit ? '#16885d' : '#b23b34', fontSize: 13 }
    },
    grid: [
      { left: 68, right: 36, top: 86, height: 320 },
      { left: 68, right: 36, top: 428, height: 56 }
    ],
    xAxis: [
      {
        type: 'category',
        data: categories,
        boundaryGap: false,
        axisLine: { lineStyle: { color: '#d5d0c8' } },
        axisLabel: { color: '#6f6a64' },
        min: 'dataMin',
        max: 'dataMax'
      },
      {
        type: 'category',
        gridIndex: 1,
        data: categories,
        boundaryGap: false,
        axisLabel: { show: false },
        axisLine: { show: false },
        axisTick: { show: false }
      }
    ],
    yAxis: [
      {
        scale: true,
        splitLine: { lineStyle: { color: '#ebe6dd' } },
        axisLabel: { color: '#6f6a64' }
      },
      {
        scale: true,
        gridIndex: 1,
        splitNumber: 2,
        axisLabel: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        type: 'candlestick',
        name: trade.symbol,
        data: values,
        itemStyle: {
          color: '#1ca66a',
          color0: '#d94b43',
          borderColor: '#1ca66a',
          borderColor0: '#d94b43'
        },
        markPoint: {
          symbolSize: 72,
          label: { color: '#ffffff', fontWeight: 700 },
          data: [
            {
              name: 'Entry',
              coord: [entryIndex, trade.entryPrice],
              value: 'Entry',
              itemStyle: { color: '#2f80ed' }
            },
            {
              name: 'Exit',
              coord: [exitIndex, trade.exitPrice || candles[exitIndex]?.close || trade.entryPrice],
              value: trade.exitTime ? 'Exit' : 'Now',
              itemStyle: { color: isProfit ? '#16885d' : '#b23b34' }
            }
          ]
        },
        markLine: {
          symbol: ['none', 'none'],
          lineStyle: { type: 'dashed', width: 1 },
          label: { color: '#4c4741' },
          data: [
            { yAxis: trade.entryPrice, name: 'Entry' },
            ...(trade.exitPrice ? [{ yAxis: trade.exitPrice, name: 'Exit' }] : [])
          ]
        }
      },
      {
        type: 'bar',
        name: 'Volume',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: volumes,
        itemStyle: { color: '#d7d1c8' }
      }
    ]
  };
}

function nearestCandleIndex(candles: KlineCandle[], time: string) {
  const target = dayjs(time).valueOf();
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  candles.forEach((candle, index) => {
    const distance = Math.abs(dayjs(candle.time).valueOf() - target);
    if (distance < bestDistance) {
      bestIndex = index;
      bestDistance = distance;
    }
  });

  return bestIndex;
}

function formatPnl(value: number) {
  return `${value >= 0 ? '+' : '-'}${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} USD`;
}

defineExpose({ generateImage });
</script>

<style scoped>
.trade-kline-chart {
  width: 960px;
  height: 540px;
}
</style>
