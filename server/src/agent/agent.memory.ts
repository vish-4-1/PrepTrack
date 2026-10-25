import { PrismaClient } from '@prisma/client';
import { AgentState, LearningPlan } from './agent.types';

const prisma = new PrismaClient();

export class AgentMemoryService {
  async saveSession(state: AgentState, finalResponse: string): Promise<string> {
    try {
      const stateSnapshot = JSON.stringify({
        studentProfileId: state.studentProfileId,
        studentName: state.studentName,
        currentStep: state.currentStep,
        maxSteps: state.maxSteps,
        observations: state.observations,
        decisions: state.decisions,
        createdActions: state.createdActions,
        createdProjects: state.createdProjects,
        learningPlan: state.learningPlan,
        isComplete: true,
      });

      const toolCalls = state.observations.map((o) => ({
        toolName: o.toolCall.name,
        arguments: o.toolCall.arguments,
        success: o.result.success,
        error: o.result.error,
        data: o.result.data,
        timestamp: o.timestamp,
      }));

      const session = await prisma.agentSession.create({
        data: {
          studentProfileId: state.studentProfileId,
          userMessage: state.userMessage,
          agentResponse: finalResponse,
          stateSnapshot,
          toolCallsJson: JSON.stringify(toolCalls),
          planJson: state.learningPlan ? JSON.stringify(state.learningPlan) : null,
          actionsJson: state.createdActions.length > 0 ? JSON.stringify(state.createdActions) : null,
        },
      });

      // Persist individual messages into AgentMessage table for full conversational recall
      await prisma.agentMessage.create({
        data: {
          sessionId: session.id,
          role: 'user',
          content: state.userMessage,
        },
      });

      for (const obs of state.observations) {
        await prisma.agentMessage.create({
          data: {
            sessionId: session.id,
            role: 'tool',
            content: `Tool Execution: ${obs.toolCall.name}`,
            toolCallsJson: JSON.stringify(obs.toolCall),
            toolResultJson: JSON.stringify(obs.result),
          },
        });
      }

      await prisma.agentMessage.create({
        data: {
          sessionId: session.id,
          role: 'assistant',
          content: finalResponse,
          toolCallsJson: JSON.stringify(toolCalls),
        },
      });

      return session.id;
    } catch (err: any) {
      console.warn('Could not save agent session to database:', err.message);
      return `session-${Date.now()}`;
    }
  }

  async getRecentSessions(studentProfileId: string, limit: number = 10) {
    try {
      const sessions = await prisma.agentSession.findMany({
        where: { studentProfileId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return sessions.map((s) => ({
        id: s.id,
        userMessage: s.userMessage,
        agentResponse: s.agentResponse,
        stateSnapshot: s.stateSnapshot ? JSON.parse(s.stateSnapshot) : null,
        toolCalls: JSON.parse(s.toolCallsJson || '[]'),
        plan: s.planJson ? (JSON.parse(s.planJson) as LearningPlan) : undefined,
        actions: s.actionsJson ? JSON.parse(s.actionsJson) : [],
        messages: s.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          toolCallsJson: m.toolCallsJson,
          toolResultJson: m.toolResultJson,
          createdAt: m.createdAt,
        })),
        createdAt: s.createdAt,
      }));
    } catch (err: any) {
      console.error('Failed to retrieve agent sessions from DB:', err.message);
      return [];
    }
  }

  async getMessagesForProfile(studentProfileId: string) {
    try {
      const sessions = await prisma.agentSession.findMany({
        where: { studentProfileId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      const chatHistory: Array<{
        id: string;
        sender: 'user' | 'agent';
        text: string;
        toolCalls?: any[];
        plan?: LearningPlan;
        actions?: any[];
        timestamp: string;
      }> = [];

      for (const session of sessions) {
        if (session.userMessage) {
          chatHistory.push({
            id: `user-${session.id}`,
            sender: 'user',
            text: session.userMessage,
            timestamp: session.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          });
        }

        if (session.agentResponse) {
          chatHistory.push({
            id: `agent-${session.id}`,
            sender: 'agent',
            text: session.agentResponse,
            toolCalls: JSON.parse(session.toolCallsJson || '[]'),
            plan: session.planJson ? (JSON.parse(session.planJson) as LearningPlan) : undefined,
            actions: session.actionsJson ? JSON.parse(session.actionsJson) : [],
            timestamp: session.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          });
        }
      }

      return chatHistory;
    } catch (err: any) {
      console.error('Failed to get chat messages for profile:', err.message);
      return [];
    }
  }

  async getLatestPlan(studentProfileId: string): Promise<LearningPlan | null> {
    try {
      const latestWithPlan = await prisma.agentSession.findFirst({
        where: { studentProfileId, planJson: { not: null } },
        orderBy: { createdAt: 'desc' },
      });

      if (latestWithPlan?.planJson) {
        return JSON.parse(latestWithPlan.planJson) as LearningPlan;
      }
      return null;
    } catch {
      return null;
    }
  }
}

export const agentMemoryService = new AgentMemoryService();
