import { Router } from 'express';
import { downloadController } from '../controllers/downloadController';

const router = Router();

router.get('/:runId', downloadController.downloadResults);

export { router as downloadRoutes };