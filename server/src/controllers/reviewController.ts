import type { Request, Response } from 'express';
import type { Review } from '../models/reviewModel.js';

const reviews: Review[] = [];

export class ReviewController {
  list(_req: Request, res: Response) {
    res.json({ data: reviews });
  }

  create(req: Request, res: Response) {
    const review: Review = {
      id: reviews.length + 1,
      tradeId: req.body.tradeId,
      title: req.body.title,
      plan: req.body.plan,
      execution: req.body.execution,
      emotion: req.body.emotion,
      lessons: req.body.lessons,
      createdAt: new Date().toISOString()
    };

    reviews.push(review);
    res.status(201).json({ data: review });
  }
}
