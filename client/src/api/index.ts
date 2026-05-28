import axios, { AxiosError, type AxiosResponse } from 'axios';
import type {
  ApiEnvelope,
  Balance,
  DailySummary,
  ListResponse,
  OverallStats,
  Pagination,
  PaginationParams,
  SyncResult,
  TagStats,
  Trade,
  TradeFilter,
  TradePayload,
  TradeUpdatePayload
} from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

let loadingCount = 0;
const loadingListeners = new Set<(loading: boolean) => void>();

export const apiLoading = {
  subscribe(listener: (loading: boolean) => void) {
    loadingListeners.add(listener);
    listener(loadingCount > 0);

    return () => loadingListeners.delete(listener);
  },
  get value() {
    return loadingCount > 0;
  }
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000
});

apiClient.interceptors.request.use((config) => {
  setLoading(true);
  return config;
});

apiClient.interceptors.response.use(
  (response: AxiosResponse<ApiEnvelope<unknown>>) => {
    setLoading(false);
    return response.data as unknown as AxiosResponse;
  },
  (error: AxiosError<ApiEnvelope<unknown>>) => {
    setLoading(false);
    return Promise.reject(normalizeApiError(error));
  }
);

/**
 * Fetches paginated trades with optional filters.
 *
 * @param params - Filter and pagination parameters.
 * @returns Trades and pagination metadata.
 */
export async function fetchTrades(
  params: TradeFilter & PaginationParams = {}
): Promise<ListResponse<Trade>> {
  const response = await apiClient.get<ListResponse<Trade>, ApiEnvelope<Trade[]>>('/trades', {
    params
  });

  return {
    data: response.data,
    pagination: requirePagination(response.pagination)
  };
}

/**
 * Fetches one trade by id.
 *
 * @param id - Trade primary key.
 * @returns Trade detail.
 */
export async function fetchTradeDetail(id: number): Promise<Trade> {
  const response = await apiClient.get<Trade, ApiEnvelope<Trade>>(`/trades/${id}`);
  return response.data;
}

/**
 * Creates a manual trade.
 *
 * @param data - Trade payload.
 * @returns Created trade.
 */
export async function createTrade(data: TradePayload): Promise<Trade> {
  const response = await apiClient.post<Trade, ApiEnvelope<Trade>>('/trades', data);
  return response.data;
}

/**
 * Updates a trade.
 *
 * @param id - Trade primary key.
 * @param data - Partial trade payload.
 * @returns Updated trade.
 */
export async function updateTrade(id: number, data: TradeUpdatePayload): Promise<Trade> {
  const response = await apiClient.put<Trade, ApiEnvelope<Trade>>(`/trades/${id}`, data);
  return response.data;
}

/**
 * Deletes a trade.
 *
 * @param id - Trade primary key.
 */
export async function deleteTrade(id: number): Promise<void> {
  await apiClient.delete(`/trades/${id}`);
}

/**
 * Fetches paginated daily PnL summaries.
 *
 * @param params - Optional date and pagination filters.
 * @returns Daily summaries and pagination metadata.
 */
export async function fetchDailySummary(
  params: Pick<TradeFilter, 'startDate' | 'endDate'> & PaginationParams = {}
): Promise<ListResponse<DailySummary>> {
  const response = await apiClient.get<
    ListResponse<DailySummary>,
    ApiEnvelope<DailySummary[]>
  >('/summary/daily', { params });

  return {
    data: response.data,
    pagination: requirePagination(response.pagination)
  };
}

/**
 * Fetches overall account-level trading statistics.
 *
 * @returns Overall statistics.
 */
export async function fetchOverallStats(): Promise<OverallStats> {
  const response = await apiClient.get<OverallStats, ApiEnvelope<OverallStats>>('/summary/stats');
  return response.data;
}

/**
 * Fetches tag performance statistics.
 *
 * @param params - Pagination parameters.
 * @returns Tag statistics and pagination metadata.
 */
export async function fetchTagStats(
  params: PaginationParams = {}
): Promise<ListResponse<TagStats>> {
  const response = await apiClient.get<ListResponse<TagStats>, ApiEnvelope<TagStats[]>>(
    '/summary/tag-stats',
    { params }
  );

  return {
    data: response.data,
    pagination: requirePagination(response.pagination)
  };
}

/**
 * Fetches exchange account balance.
 *
 * @returns Account balance data.
 */
export async function fetchBalance(): Promise<Balance> {
  const response = await apiClient.get<Balance, ApiEnvelope<Balance>>('/exchange/balance');
  return response.data;
}

/**
 * Manually triggers backend data synchronization.
 *
 * @returns Sync result.
 */
export async function triggerSync(): Promise<SyncResult> {
  const response = await apiClient.post<SyncResult, ApiEnvelope<SyncResult>>('/sync/trigger');
  return response.data;
}

function setLoading(active: boolean) {
  loadingCount = Math.max(0, loadingCount + (active ? 1 : -1));
  const loading = loadingCount > 0;
  loadingListeners.forEach((listener) => listener(loading));
}

function normalizeApiError(error: AxiosError<ApiEnvelope<unknown>>): Error {
  const message =
    error.response?.data?.message ||
    error.message ||
    '请求失败，请稍后重试';

  return new Error(message);
}

function requirePagination(pagination: Pagination | undefined): Pagination {
  return (
    pagination || {
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0
    }
  );
}

export { apiClient };
