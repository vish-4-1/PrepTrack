import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import authRoutes from './routes/auth.routes';
import profileRoutes from './routes/profile.routes';
import trackRecordRoutes from './routes/trackRecord.routes';
import actionRoutes from './routes/action.routes';
import projectRoutes from './routes/project.routes';
import companyRoutes from './routes/company.routes';
import adminRoutes from './routes/admin.routes';
import agentRoutes from './routes/agent.routes';

import { createRateLimiter } from './middleware/rateLimiter';

const app = express();
const PORT = env.PORT;

const allowedOrigins = env.CORS_ORIGINS;

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, Postman, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);
app.use(express.json());

// Rate limiters for security using strictly validated env config
const authLimiter = createRateLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  message: 'Too many authentication attempts from this IP. Please try again later.',
});

const syncLimiter = createRateLimiter({
  windowMs: Math.max(60000, Math.round(env.RATE_LIMIT_WINDOW_MS / 3)),
  maxRequests: Math.max(5, Math.round(env.RATE_LIMIT_MAX_REQUESTS / 2)),
  message: 'Profile synchronization rate limit reached. Please wait before syncing again.',
});

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/profile/sync', syncLimiter);
app.use('/api/profile', profileRoutes);
app.use('/api/track-record', trackRecordRoutes);
app.use('/api/trackRecord', trackRecordRoutes);
app.use('/api/actions', actionRoutes);
app.use('/api/action', actionRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/project', projectRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/agent', agentRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    system: 'PrepTrack Placement & Skill Platform API',
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`PrepTrack Server listening on http://localhost:${PORT}`);
});
