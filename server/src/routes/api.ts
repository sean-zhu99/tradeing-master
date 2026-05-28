import { Router, type NextFunction, type Request, type Response } from 'express';
import { ExchangeController } from '../controllers/exchangeController.js';
import { StatsController } from '../controllers/statsController.js';
import { TradeController, ValidationError } from '../controllers/tradeController.js';

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

const router = Router();
const tradeController = new TradeController();
const statsController = new StatsController();
const exchangeController = new ExchangeController();

router.get('/trades', asyncHandler((req, res) => tradeController.list(req, res)));
router.get('/trades/:id', asyncHandler((req, res) => tradeController.detail(req, res)));
router.post('/trades', asyncHandler((req, res) => tradeController.create(req, res)));
router.put('/trades/:id', asyncHandler((req, res) => tradeController.update(req, res)));
router.delete('/trades/:id', asyncHandler((req, res) => tradeController.remove(req, res)));

router.get('/summary/daily', asyncHandler((req, res) => statsController.daily(req, res)));
router.get('/summary/stats', asyncHandler((req, res) => statsController.stats(req, res)));
router.get('/summary/tag-stats', asyncHandler((req, res) => statsController.tagStats(req, res)));

router.get('/exchange/balance', asyncHandler((req, res) => exchangeController.balance(req, res)));
router.post('/sync/trigger', asyncHandler((req, res) => exchangeController.triggerSync(req, res)));

router.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ValidationError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }

  if (isDuplicateEntryError(error)) {
    res.status(409).json({ message: '交易所订单ID已存在' });
    return;
  }

  console.error(error);
  res.status(500).json({ message: '服务器内部错误' });
});

/**
 * Wraps async route handlers so errors flow into Express error middleware.
 *
 * @param handler - Async Express route handler.
 * @returns Express-compatible route handler.
 */
function asyncHandler(handler: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}

function isDuplicateEntryError(error: Error): boolean {
  return 'code' in error && (error as { code?: string }).code === 'ER_DUP_ENTRY';
}

export default router;
