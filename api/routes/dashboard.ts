import { Router } from 'express';
import { dashboardController } from '../controllers/dashboardController';

const router = Router();

router.get('/runs', dashboardController.listRuns);
router.get('/runs/:runId/company/:domain', dashboardController.getCompanyDetails);
router.get('/runs/:runId/results', dashboardController.getRunResults);
router.get('/runs/:runId/tech-summary', dashboardController.getTechSummary);
router.get('/runs/:runId/files', dashboardController.getRunFiles);
router.get('/runs/:runId', dashboardController.getRunDetails);
router.get('/runs/:runId/screenshots/:domain/:filename', dashboardController.getScreenshot);

export { router as dashboardRoutes };
