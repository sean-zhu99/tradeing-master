import { Router } from 'express';
import { ReviewController } from '../controllers/reviewController.js';

const router = Router();
const controller = new ReviewController();

router.get('/', controller.list);
router.post('/', controller.create);

export default router;
