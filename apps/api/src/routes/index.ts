import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { authRouter } from './auth.routes.js';
import { categoryRouter } from './category.routes.js';
import { sourceRouter } from './source.routes.js';
import { destinationRouter } from './destination.routes.js';
import { destinationGroupRouter } from './destination-group.routes.js';
import { ruleRouter } from './rule.routes.js';
import { postRouter } from './post.routes.js';
import { publishRouter } from './publish.routes.js';
import { logRouter } from './log.routes.js';
import { queueRouter } from './queue.routes.js';
import { scheduleRouter } from './schedule.routes.js';
import { dashboardRouter } from './dashboard.routes.js';
import { mediaRouter } from './media.routes.js';
import { userRouter } from './user.routes.js';

const apiRouter = Router();

// Phase 1 & 2 API Endpoints
apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/categories', categoryRouter);
apiRouter.use('/sources', sourceRouter);
apiRouter.use('/destinations', destinationRouter);
apiRouter.use('/destination-groups', destinationGroupRouter);
apiRouter.use('/rules', ruleRouter);
apiRouter.use('/posts', postRouter);
apiRouter.use('/publish', publishRouter);
apiRouter.use('/logs', logRouter);
apiRouter.use('/queue', queueRouter);
apiRouter.use('/schedules', scheduleRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/media', mediaRouter);

export { apiRouter };
