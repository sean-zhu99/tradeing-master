import axios from 'axios';
import cron from 'node-cron';
import { TradeService } from './tradeService.js';
import type { KlineCandle, Trade, TradeKlineData } from '../models/tradeModel.js';

const tradeService = new TradeService();

export async function fetchExchangeTicker(symbol: string) {
  const response = await axios.get('https://api.binance.com/api/v3/ticker/24hr', {
    params: { symbol }
  });

  return response.data;
}

export function startMarketDataCron() {
  cron.schedule('*/15 * * * *', () => {
    console.log('Market data sync placeholder running every 15 minutes.');
  });
}

/**
 * Builds the K-line dataset used by the frontend to render a review screenshot.
 * The current implementation returns deterministic mock candles from order data;
 * replace {@link buildMockCandles} with an exchange OHLCV call when API access is connected.
 *
 * @param tradeId - Trade primary key.
 * @returns Trade detail plus surrounding OHLCV candles.
 */
export async function fetchTradeKlineData(tradeId: number): Promise<TradeKlineData | null> {
  const trade = await tradeService.getTradeById(tradeId);
  if (!trade) return null;

  return {
    trade,
    candles: buildMockCandles(trade)
  };
}

/**
 * Creates stable synthetic OHLCV candles around one order's entry and exit prices.
 * This lets the screenshot pipeline be developed before real exchange market data is wired in.
 *
 * @param trade - Trade used as the chart anchor.
 * @returns Synthetic candle series.
 */
function buildMockCandles(trade: Trade): KlineCandle[] {
  const candleCount = 64;
  const entryIndex = Math.floor(candleCount * 0.38);
  const exitIndex = Math.floor(candleCount * 0.72);
  const exitPrice = trade.exitPrice || trade.entryPrice;
  const endTime = new Date(trade.exitTime || trade.entryTime).getTime();
  const startTime = endTime - (candleCount - 1) * 15 * 60 * 1000;
  const seed = Array.from(trade.symbol).reduce((sum, char) => sum + char.charCodeAt(0), trade.id);
  const trend = (exitPrice - trade.entryPrice) / Math.max(1, exitIndex - entryIndex);
  let lastClose = trade.entryPrice - trend * entryIndex;

  return Array.from({ length: candleCount }, (_, index) => {
    const wave = Math.sin((index + seed) / 3.2) * trade.entryPrice * 0.003;
    const drift = trend * index;
    const anchor = trade.entryPrice - trend * entryIndex + drift + wave;
    const open = index === 0 ? anchor : lastClose;
    const close = index === entryIndex ? trade.entryPrice : index === exitIndex ? exitPrice : anchor;
    const spread = Math.max(Math.abs(close - open), trade.entryPrice * 0.0018);
    const high = Math.max(open, close) + spread * (0.7 + ((seed + index) % 5) / 10);
    const low = Math.min(open, close) - spread * (0.7 + ((seed + index * 2) % 5) / 10);
    lastClose = close;

    return {
      time: new Date(startTime + index * 15 * 60 * 1000).toISOString(),
      open: roundPrice(open),
      high: roundPrice(high),
      low: roundPrice(low),
      close: roundPrice(close),
      volume: Number((100 + ((seed + index * 13) % 90)).toFixed(2))
    };
  });
}

function roundPrice(value: number) {
  return Number(value.toFixed(8));
}
