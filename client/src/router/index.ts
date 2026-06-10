import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import AppLayout from '@/components/layout/AppLayout.vue';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: AppLayout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '仪表盘' }
      },
      {
        path: 'trades',
        name: 'Trades',
        component: () => import('@/views/Trades.vue'),
        meta: { title: '交易记录' }
      },
      {
        path: 'pnl-analysis',
        name: 'PnLAnalysis',
        component: () => import('@/views/PnLAnalysis.vue'),
        meta: { title: '盈亏分析' }
      },
      {
        path: 'mt5-report',
        name: 'Mt5Report',
        component: () => import('@/views/Mt5StaticReport.vue'),
        meta: { title: 'MT5报表' }
      },
      {
        path: 'calendar',
        name: 'Calendar',
        component: () => import('@/views/Calender.vue'),
        meta: { title: '交易日历', hidden: true }
      },
      {
        path: 'review',
        name: 'Review',
        component: () => import('@/views/ReviewView.vue'),
        meta: { title: '交易复盘' }
      },
      {
        path: 'review/manage',
        name: 'ReviewManage',
        component: () => import('@/views/ReviewManage.vue'),
        meta: { title: '复盘管理', hidden: true }
      }
    ]
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to) => {
  if (to.path === '/review/manage') {
    return true;
  }

  return true;
});

export default router;
