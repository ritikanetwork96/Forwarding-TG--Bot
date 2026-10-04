import { Router } from 'express';
import { DestinationGroupController } from '../controllers/destination-group.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// All destination group routes require authentication
router.use(authenticate);

router.get('/', (req, res, next) => {
  DestinationGroupController.list(req, res).catch(next);
});

router.post('/', (req, res, next) => {
  DestinationGroupController.create(req, res).catch(next);
});

router.get('/:id', (req, res, next) => {
  DestinationGroupController.getById(req, res).catch(next);
});

router.patch('/:id', (req, res, next) => {
  DestinationGroupController.update(req, res).catch(next);
});

router.delete('/:id', (req, res, next) => {
  DestinationGroupController.delete(req, res).catch(next);
});

export { router as destinationGroupRouter };
