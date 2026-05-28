<template>
  <section class="page-grid two-columns">
    <el-card class="panel" shadow="never">
      <template #header>市场盈亏分布</template>
      <div ref="pieRef" class="chart"></div>
    </el-card>

    <el-card class="panel" shadow="never">
      <template #header>月度盈亏</template>
      <div ref="barRef" class="chart"></div>
    </el-card>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import * as echarts from 'echarts';

const pieRef = ref<HTMLDivElement>();
const barRef = ref<HTMLDivElement>();

onMounted(() => {
  if (pieRef.value) {
    echarts.init(pieRef.value).setOption({
      tooltip: { trigger: 'item' },
      series: [
        {
          type: 'pie',
          radius: ['45%', '70%'],
          data: [
            { value: 7480, name: '外汇' },
            { value: 5000, name: '加密货币' }
          ]
        }
      ]
    });
  }

  if (barRef.value) {
    echarts.init(barRef.value).setOption({
      tooltip: {},
      xAxis: { type: 'category', data: ['1月', '2月', '3月', '4月', '5月'] },
      yAxis: { type: 'value' },
      series: [{ type: 'bar', data: [1200, -450, 3400, 2180, 6150] }]
    });
  }
});
</script>
