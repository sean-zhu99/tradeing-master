import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { registerRoutes } from './routes/index.js';
import { startMarketDataCron } from './services/marketDataService.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

registerRoutes(app);
startMarketDataCron();

app.listen(port, () => {
  console.log(`Trading Master API is running on http://localhost:${port}`);
});
