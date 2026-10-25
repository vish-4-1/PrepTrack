import { agentExecutor } from './agent.executor';
import { agentMemoryService } from './agent.memory';
import { AgentResponse, LearningPlan } from './agent.types';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class AgentService {
  async processChat(studentProfileId: string, userMessage: string): Promise<AgentResponse> {
    if (!studentProfileId) {
      throw new Error('Student profile ID is required for AI agent interaction');
    }

    if (!userMessage || userMessage.trim().length === 0) {
      throw new Error('Chat message cannot be empty');
    }

    return await agentExecutor.run(studentProfileId, userMessage.trim());
  }

  async getSessionHistory(studentProfileId: string) {
    return await agentMemoryService.getRecentSessions(studentProfileId);
  }

  async getChatMessages(studentProfileId: string) {
    return await agentMemoryService.getMessagesForProfile(studentProfileId);
  }

  async getActivePlan(studentProfileId: string): Promise<LearningPlan | null> {
    return await agentMemoryService.getLatestPlan(studentProfileId);
  }

  async applyPlanTasksToActionCenter(studentProfileId: string, plan: LearningPlan): Promise<{ count: number }> {
    let count = 0;

    for (const day of plan.dailyPlan) {
      for (const task of day.tasks) {
        await prisma.actionItem.create({
          data: {
            studentProfileId,
            title: `[Day ${day.day} - ${day.focusArea}] ${task}`,
            category:
              day.focusArea.includes('DSA') || day.focusArea.includes('Coding')
                ? 'Coding'
                : day.focusArea.includes('Mock')
                ? 'Mock Interview'
                : 'Theory',
            priority: day.day <= 3 ? 'HIGH' : 'MEDIUM',
            estimatedHours: Math.max(1, Math.round(day.estimatedHours / day.tasks.length)),
            reason: `Generated from AI Placement Coach ${plan.durationDays}-Day Strategic Plan for ${plan.goal}`,
          },
        });
        count += 1;
      }
    }

    return { count };
  }
}

export const agentService = new AgentService();
