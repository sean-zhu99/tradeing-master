import { Router } from 'express';
import { TradeController } from '../controllers/tradeController.js';

const router = Router();
const controller = new TradeController();

router.get('/', controller.list);
router.get('/:id', controller.detail);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
