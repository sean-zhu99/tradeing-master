<template>
  <el-container class="app-shell">
    <el-header class="app-topbar">
      <div class="topbar-inner">
        <RouterLink to="/dashboard" class="brand">
          <div class="brand-mark">TM</div>
          <div>
            <strong>Trading Master</strong>
            <span>Trade Journal + Analytics</span>
          </div>
        </RouterLink>

        <nav class="top-nav">
          <RouterLink
            v-for="item in navItems"
            :key="item.path"
            :to="item.path"
            class="top-nav-item"
            :class="{ active: activePath === item.path }"
          >
            <el-icon><component :is="item.icon" /></el-icon>
            <span>{{ item.label }}</span>
          </RouterLink>
        </nav>

        <div class="topbar-meta">
          <span>{{ today }}</span>
        </div>
      </div>
    </el-header>

    <el-main class="app-main">
      <RouterView />
    </el-main>
  </el-container>
</template>

<script setup lang="ts">
import { computed, markRaw } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import { DataBoard, Notebook, Tickets, TrendCharts } from '@element-plus/icons-vue';

const route = useRoute();
dayjs.locale('zh-cn');

const navItems = [
  { path: '/dashboard', label: '仪表盘', icon: markRaw(DataBoard) },
  { path: '/trades', label: '交易记录', icon: markRaw(Tickets) },
  { path: '/pnl-analysis', label: '盈亏分析', icon: markRaw(TrendCharts) },
  { path: '/review', label: '交易复盘', icon: markRaw(Notebook) }
];

const activePath = computed(() => route.path);
const today = computed(() => dayjs().format('YYYY年MM月DD日 dddd'));
</script>
