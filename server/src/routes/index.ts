import type { Express } from 'express';
import apiRoutes from './api.js';
import reviewRoutes from './reviewRoutes.js';

export function registerRoutes(app: Express) {
  app.use('/api', apiRoutes);
  app.use('/api/reviews', reviewRoutes);
}
