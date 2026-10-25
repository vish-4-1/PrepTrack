import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware';
import { agentService } from '../agent/agent.service';
import { z } from 'zod';

const router = Router();

const chatRequestSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty'),
});

// POST /api/agent/chat - Send message to AI Placement Coach
router.post('/chat', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const studentProfileId = req.user?.studentProfileId;
    if (!studentProfileId) {
      return res.status(404).json({ error: 'Student profile not found. Please log in.' });
    }

    const { message } = chatRequestSchema.parse(req.body);
    const response = await agentService.processChat(studentProfileId, message);

    return res.json(response);
  } catch (err: any) {
    if (err.errors) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    return res.status(500).json({ error: err.message || 'AI Placement Agent execution failed' });
  }
});

// GET /api/agent/session - Get persistent chat messages and latest state
router.get('/session', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const studentProfileId = req.user?.studentProfileId;
    if (!studentProfileId) {
      return res.status(404).json({ error: 'Student profile not found' });
    }

    const messages = await agentService.getChatMessages(studentProfileId);
    const plan = await agentService.getActivePlan(studentProfileId);

    return res.json({ messages, plan });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to retrieve agent session' });
  }
});

// GET /api/agent/history - Get past agent chat sessions
router.get('/history', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const studentProfileId = req.user?.studentProfileId;
    if (!studentProfileId) {
      return res.status(404).json({ error: 'Student profile not found' });
    }

    const history = await agentService.getSessionHistory(studentProfileId);
    return res.json({ history });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to retrieve agent history' });
  }
});

// GET /api/agent/plan - Get active learning plan
router.get('/plan', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const studentProfileId = req.user?.studentProfileId;
    if (!studentProfileId) {
      return res.status(404).json({ error: 'Student profile not found' });
    }

    const plan = await agentService.getActivePlan(studentProfileId);
    return res.json({ plan });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to retrieve active learning plan' });
  }
});

// POST /api/agent/plan/apply - Add learning plan tasks to student's Action Center
router.post('/plan/apply', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const studentProfileId = req.user?.studentProfileId;
    if (!studentProfileId) {
      return res.status(404).json({ error: 'Student profile not found' });
    }

    const plan = req.body.plan;
    if (!plan || !plan.dailyPlan) {
      return res.status(400).json({ error: 'Valid learning plan object is required' });
    }

    const result = await agentService.applyPlanTasksToActionCenter(studentProfileId, plan);
    return res.json({
      success: true,
      message: `Successfully transferred ${result.count} tasks from learning plan to Action Center`,
      tasksCreated: result.count,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to apply learning plan' });
  }
});

export default router;
