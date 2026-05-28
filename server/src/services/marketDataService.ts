import axios from 'axios';
import cron from 'node-cron';

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
