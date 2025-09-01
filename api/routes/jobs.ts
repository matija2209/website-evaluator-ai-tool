import { Router } from 'express';
import { jobsController } from '../controllers/jobsController';

const router = Router();

router.get('/', jobsController.listJobs);
router.get('/:jobId', jobsController.getJobStatus);
router.delete('/:jobId', jobsController.deleteJob);

export { router as jobsRoutes };