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

## MT5 自动同步

项目支持通过本地 MT5 EA 将订单同步到云服务器：

```text
本地 MT5 -> POST /api/mt5/sync -> MySQL -> 前端看板
```

后端需要在 `.env` 中配置同步密钥：

```bash
MT5_SYNC_TOKEN=replace_with_a_long_random_token
```

MT5 端使用 `mt5/TradingMasterSyncEA.mq5`，将 `EndpointUrl` 设置为你的服务器地址，例如：

```text
http://your-server-ip/api/mt5/sync
```

并把 EA 的 `SyncToken` 设置为和服务器 `.env` 中相同的值。MT5 关闭时数据不会实时更新；下次打开 MT5 后，EA 会按配置的历史回看天数补同步订单。同步时会按 `trade_id` 去重，已有订单只更新交易价格、盈亏和状态，不覆盖复盘备注、标签、截图和评分。

## 构建检查

```bash
npm run build:client
npm run build:server
```

## 说明

开发环境会在后端没有数据时加载静态 MT5 报表作为预览兜底；生产环境默认只展示云服务器数据库中的订单数据。
