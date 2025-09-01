import { Router } from 'express';
import { analysisController } from '../controllers/analysisController';
import { uploadMiddleware } from '../middleware/uploadMiddleware';

const router = Router();

router.post('/', uploadMiddleware.single('csv'), analysisController.startAnalysis);

export { router as analysisRoutes };