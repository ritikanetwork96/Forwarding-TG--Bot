import { Router } from 'express';
import { SourceController } from '../controllers/source.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// All source routes require authentication
router.use(authenticate);

router.get('/', (req, res, next) => {
  SourceController.list(req, res).catch(next);
});

router.post('/', (req, res, next) => {
  SourceController.create(req, res).catch(next);
});

router.get('/:id', (req, res, next) => {
  SourceController.getById(req, res).catch(next);
});

router.patch('/:id', (req, res, next) => {
  SourceController.update(req, res).catch(next);
});

router.delete('/:id', (req, res, next) => {
  SourceController.delete(req, res).catch(next);
});

export { router as sourceRouter };
