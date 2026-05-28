import crypto from 'node:crypto';
import axios from 'axios';

/**
 * Provides exchange account calls. The default implementation targets Binance spot account balance.
 */
export class ExchangeService {
  /**
   * Fetches account balances using EXCHANGE_API_KEY and EXCHANGE_API_SECRET.
   *
   * @returns Raw exchange account balance payload with zero balances filtered out.
   */
  async getBalance() {
    const apiKey = process.env.EXCHANGE_API_KEY;
    const apiSecret = process.env.EXCHANGE_API_SECRET;

    if (!apiKey || !apiSecret) {
      throw new Error('缺少 EXCHANGE_API_KEY 或 EXCHANGE_API_SECRET');
    }

    const timestamp = Date.now();
    const query = `timestamp=${timestamp}`;
    const signature = crypto.createHmac('sha256', apiSecret).update(query).digest('hex');

    const response = await axios.get('https://api.binance.com/api/v3/account', {
      headers: {
        'X-MBX-APIKEY': apiKey
      },
      params: {
        timestamp,
        signature
      }
    });

    const balances = Array.isArray(response.data?.balances)
      ? response.data.balances.filter(
          (item: { free: string; locked: string }) => Number(item.free) || Number(item.locked)
        )
      : [];

    return {
      accountType: response.data?.accountType,
      balances
    };
  }
}
