# Trading Master

Trading Master 是一个面向外汇和加密货币交易者的交易数据看板，用于记录订单、查看盈亏表现、按日历复盘交易节奏，并为每一笔交易补充复盘备注。

## 功能概览

- 仪表盘：展示总盈亏、今日盈亏、胜率、盈亏比、盈亏曲线、交易对表现和最近交易。
- 交易日历：按交易日统计每日交易次数和总盈亏，并汇总每周表现。
- 交易复盘：公开只读查看复盘记录，支持按日期、交易对、标签、盈亏状态和关键词筛选。
- 复盘管理：隐藏管理页 `/review/manage`，用于基于交易所同步订单补充进场理由、出场理由、备注、标签、截图和评分。
- 后端 API：Express + TypeScript + MySQL，提供交易 CRUD、每日汇总、总体统计、标签统计和交易所同步接口骨架。

## 技术栈

- 前端：Vue 3、Vite、TypeScript、Pinia、Vue Router、Element Plus、ECharts、Axios、Dayjs
- 后端：Node.js、Express、TypeScript、MySQL2、Axios、node-cron、dotenv、cors
- 数据库：MySQL

## 项目结构

```text
client/  Vue 3 前端应用
server/  Express 后端服务
```

## 本地启动

安装依赖：

```bash
npm install --prefix client
npm install --prefix server
```

配置后端环境变量：

```bash
cp server/.env.example server/.env
```

启动后端：

```bash
npm run dev:server
```

启动前端：

```bash
npm run dev:client
```

默认访问地址：

- 前端：http://localhost:5173
- 后端：http://localhost:3000

## 常用页面

- `/dashboard`：交易数据首页
- `/calendar`：交易日历
- `/trades`：交易记录
- `/pnl-analysis`：盈亏分析
- `/review`：公开复盘记录
- `/review/manage`：复盘管理页，隐藏路由

## 构建检查

```bash
npm run build:client
npm run build:server
```

## 说明

当前前端内置了几笔案例交易数据，用于在后端或交易所 API 尚未接入时预览整体界面效果。后续接入真实交易所订单同步后，复盘管理页会基于已有订单补充复盘内容。
