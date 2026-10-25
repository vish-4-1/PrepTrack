import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import {
  AgentObservation,
  AgentResponse,
  AgentState,
  ToolResult,
} from './agent.types';
import { agentToolsRegistry, getAgentToolSpecs } from './agent.tools';
import { buildAgentSystemPrompt, buildAgentUserPrompt } from './agent.prompts';
import { agentMemoryService } from './agent.memory';
import { aiConfig } from '../config/ai.config';
import { scoringConfig } from '../config/scoring.config';

const prisma = new PrismaClient();

export class AgentExecutor {
  private apiKey = aiConfig.apiKey;
  private apiUrl = aiConfig.baseUrl;
  private model = aiConfig.model;
  private temperature = aiConfig.temperature;
  private maxSteps = aiConfig.agentMaxSteps;
  private timeoutMs = aiConfig.requestTimeoutMs;

  async run(studentProfileId: string, userMessage: string): Promise<AgentResponse> {
    const state: AgentState = {
      studentProfileId,
      userMessage,
      currentStep: 0,
      maxSteps: this.maxSteps,
      observations: [],
      decisions: [],
      createdActions: [],
      createdProjects: [],
      isComplete: false,
    };

    // Pre-fetch live profile, resume, projects, and complexity metrics from Prisma
    const liveProfile = await prisma.studentProfile.findUnique({
      where: { id: studentProfileId },
      include: {
        user: { select: { name: true, department: true } },
        resumeProfile: true,
        skillMetrics: { orderBy: { verifiedDepthScore: 'desc' } },
        projects: { orderBy: { difficultyScore: 'desc' } },
        codingProfiles: true,
        gitHubProfile: true,
      },
    });

    state.studentName = liveProfile?.user?.name;

    // 1. Attempt LLM-driven multi-step tool-calling loop if API key is configured
    if (this.apiKey) {
      try {
        const response = await this.executeLlmLoop(state, liveProfile);
        if (response) return response;
      } catch (err: any) {
        console.warn('LLM Agent loop failed or timed out. Switching to deterministic agent strategy:', err.message);
      }
    }

    // 2. Deterministic Agent Strategy
    return await this.executeDeterministicAgentLoop(state, liveProfile);
  }

  private async executeLlmLoop(state: AgentState, profileData: any): Promise<AgentResponse | null> {
    const resumeProfile = profileData?.resumeProfile
      ? {
          experienceSummary: profileData.resumeProfile.experienceSummary,
          extractedSkills: JSON.parse(profileData.resumeProfile.extractedSkillsJson || '[]'),
          extractedProjects: JSON.parse(profileData.resumeProfile.extractedProjectsJson || '[]'),
        }
      : undefined;

    const skillMetrics = (profileData?.skillMetrics || []).map((sm: any) => ({
      skillName: sm.skillName,
      verifiedDepthScore: sm.verifiedDepthScore,
      maxProjectDifficulty: sm.maxProjectDifficulty,
      avgProjectDifficulty: sm.avgProjectDifficulty,
      evidenceSummary: sm.evidenceSummary,
    }));

    const projects = (profileData?.projects || []).map((p: any) => ({
      name: p.name,
      difficultyScore: p.difficultyScore,
      architectureTier: p.architectureTier,
      hasTests: p.hasTests,
      hasCiCd: p.hasCiCd,
      hasDocker: p.hasDocker,
    }));

    const codingProfiles = (profileData?.codingProfiles || []).map((cp: any) => ({
      platform: cp.platform,
      totalSolved: cp.totalSolved,
      contestRating: cp.contestRating,
    }));

    const systemPrompt = buildAgentSystemPrompt({
      studentName: profileData?.user?.name,
      department: profileData?.user?.department,
      targetRole: profileData?.targetRole,
      readinessIndex: profileData?.placementReadiness,
      resumeProfile,
      skillMetrics,
      projects,
      codingProfiles,
      githubProfile: profileData?.gitHubProfile,
    });

    const userPrompt = buildAgentUserPrompt(state.userMessage, {
      studentProfileId: state.studentProfileId,
      studentName: profileData?.user?.name,
    });

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const toolSpecs = getAgentToolSpecs();

    while (state.currentStep < state.maxSteps) {
      state.currentStep += 1;

      const res = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages,
          tools: toolSpecs,
          tool_choice: 'auto',
          temperature: this.temperature,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          timeout: this.timeoutMs,
        }
      );

      const choice = res.data?.choices?.[0];
      const message = choice?.message;

      if (!message) break;

      // Handle Tool Calls
      if (message.tool_calls && message.tool_calls.length > 0) {
        messages.push(message);

        for (const tc of message.tool_calls) {
          const toolName = tc.function?.name;
          let toolArgs: Record<string, any> = {};
          try {
            toolArgs = JSON.parse(tc.function?.arguments || '{}');
          } catch {
            toolArgs = {};
          }

          const toolDef = agentToolsRegistry[toolName];
          let toolResult: ToolResult;

          if (!toolDef) {
            toolResult = {
              toolCallId: tc.id,
              name: toolName,
              success: false,
              error: `Tool "${toolName}" is not a recognized agent tool.`,
            };
          } else {
            try {
              const validatedArgs = toolDef.schema.parse(toolArgs);
              const data = await toolDef.execute(validatedArgs, {
                studentProfileId: state.studentProfileId,
                state,
              });
              toolResult = {
                toolCallId: tc.id,
                name: toolName,
                success: true,
                data,
              };
            } catch (execErr: any) {
              toolResult = {
                toolCallId: tc.id,
                name: toolName,
                success: false,
                error: execErr.message || 'Tool execution failed',
              };
            }
          }

          state.observations.push({
            step: state.currentStep,
            toolCall: { id: tc.id, name: toolName, arguments: toolArgs },
            result: toolResult,
            timestamp: new Date().toISOString(),
          });

          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            name: toolName,
            content: JSON.stringify(toolResult.success ? toolResult.data : { error: toolResult.error }),
          });
        }
        continue;
      }

      // Final Response
      if (message.content) {
        const finalMessage = message.content;
        const sessionId = await agentMemoryService.saveSession(state, finalMessage);

        return {
          sessionId,
          message: finalMessage,
          studentProfileId: state.studentProfileId,
          actions: state.createdActions,
          plan: state.learningPlan,
          projectRecommendations: state.createdProjects,
          toolCalls: state.observations.map((o) => ({
            toolName: o.toolCall.name,
            description: `Step ${o.step}: Invoked ${o.toolCall.name}`,
            success: o.result.success,
          })),
          timestamp: new Date().toISOString(),
        };
      }
    }

    return null;
  }

  // Deterministic multi-step agent reasoning for offline or test environments
  private async executeDeterministicAgentLoop(state: AgentState, liveProfile: any): Promise<AgentResponse> {
    // Step 1: Observe student profile
    const profileTool = agentToolsRegistry['get_student_profile'];
    const profileData = await profileTool.execute({}, { studentProfileId: state.studentProfileId, state });
    state.observations.push({
      step: 1,
      toolCall: { id: 't1', name: 'get_student_profile', arguments: {} },
      result: { toolCallId: 't1', name: 'get_student_profile', success: true, data: profileData },
      timestamp: new Date().toISOString(),
    });

    // Step 2: Observe deterministic skill scores
    const skillTool = agentToolsRegistry['get_skill_scores'];
    const skillData = await skillTool.execute({}, { studentProfileId: state.studentProfileId, state });
    state.observations.push({
      step: 2,
      toolCall: { id: 't2', name: 'get_skill_scores', arguments: {} },
      result: { toolCallId: 't2', name: 'get_skill_scores', success: true, data: skillData },
      timestamp: new Date().toISOString(),
    });

    // Step 3: Observe historical progression
    const historyTool = agentToolsRegistry['get_skill_history'];
    const historyData = await historyTool.execute({}, { studentProfileId: state.studentProfileId, state });
    state.observations.push({
      step: 3,
      toolCall: { id: 't3', name: 'get_skill_history', arguments: {} },
      result: { toolCallId: 't3', name: 'get_skill_history', success: true, data: historyData },
      timestamp: new Date().toISOString(),
    });

    // Step 4: Check if company mentioned in user message
    let companyData: any = null;
    const lower = state.userMessage.toLowerCase();
    const targetCompanies = await prisma.targetCompany.findMany({ select: { name: true } });
    const matched = targetCompanies.find((c) => lower.includes(c.name.toLowerCase()));

    if (matched) {
      const compTool = agentToolsRegistry['calculate_company_readiness'];
      try {
        companyData = await compTool.execute({ companyName: matched.name }, { studentProfileId: state.studentProfileId, state });
        state.observations.push({
          step: 4,
          toolCall: { id: 't4', name: 'calculate_company_readiness', arguments: { companyName: matched.name } },
          result: { toolCallId: 't4', name: 'calculate_company_readiness', success: true, data: companyData },
          timestamp: new Date().toISOString(),
        });
      } catch {
        // Continue
      }
    }

    // Step 5: Observe pending actions
    const pendingTool = agentToolsRegistry['get_pending_actions'];
    const pendingData = await pendingTool.execute({}, { studentProfileId: state.studentProfileId, state });
    state.observations.push({
      step: 5,
      toolCall: { id: 't5', name: 'get_pending_actions', arguments: {} },
      result: { toolCallId: 't5', name: 'get_pending_actions', success: true, data: pendingData },
      timestamp: new Date().toISOString(),
    });

    // Step 6: Reason on lowest skill dimension & project architecture depth
    const dsa = skillData.dsaScore;
    const dev = skillData.devScore;
    const dbms = skillData.dbmsScore;
    const pri = skillData.placementReadinessIndex;

    const highestDepthSkill = liveProfile?.skillMetrics?.[0]?.skillName || 'DSA';
    const lowestDepthSkill = liveProfile?.skillMetrics && liveProfile.skillMetrics.length > 0
      ? liveProfile.skillMetrics[liveProfile.skillMetrics.length - 1].skillName
      : null;

    let primaryFocus = 'DBMS & SQL';
    let focusReason = `Your DBMS score (${dbms}/100) is your highest-impact growth area compared to DSA (${dsa}/100).`;

    if (lowestDepthSkill && liveProfile.skillMetrics[liveProfile.skillMetrics.length - 1].verifiedDepthScore < 60) {
      primaryFocus = lowestDepthSkill;
      focusReason = `Your verified depth in ${lowestDepthSkill} is currently ${liveProfile.skillMetrics[liveProfile.skillMetrics.length - 1].verifiedDepthScore}/100. Elevating architectural complexity will boost your placement index.`;
    } else if (dev < dsa - 15) {
      primaryFocus = 'Development & Projects';
      focusReason = `Your Development score (${dev}/100) lags behind your algorithmic foundation (${dsa}/100). Expand GitHub repository depth.`;
    } else if (dsa < scoringConfig.companyReadiness.thresholds.moderate) {
      primaryFocus = 'Data Structures & Algorithms';
      focusReason = `Elevating DSA from ${dsa}/100 is essential for passing technical screening rounds.`;
    } else if (companyData && companyData.missingSkills?.length > 0) {
      primaryFocus = companyData.missingSkills[0].skillName;
      focusReason = `Primary requirement gap for ${companyData.companyName} target hiring benchmarks.`;
    }

    // Step 7: Act - Create structured learning plan
    const planTool = agentToolsRegistry['create_learning_plan'];
    await planTool.execute(
      {
        goal: `Elevate Placement Readiness Index from ${pri} to ${Math.min(100, pri + 10)}`,
        durationDays: 7,
        priorities: [
          { skill: primaryFocus, priority: 'HIGH', reason: focusReason },
          { skill: 'Data Structures & Algorithms', priority: 'MEDIUM', reason: 'Maintain consistent daily coding rhythm.' },
        ],
        dailyPlan: [
          { day: 1, focusArea: primaryFocus, tasks: [`Study core theoretical concepts of ${primaryFocus}`, 'Review top 5 interview questions'], estimatedHours: 2 },
          { day: 2, focusArea: primaryFocus, tasks: ['Solve 5 hands-on practice problems', 'Analyze space and time complexity tradeoffs'], estimatedHours: 3 },
          { day: 3, focusArea: 'DSA Practice', tasks: ['Solve 2 Medium LeetCode problems', 'Focus on Dynamic Programming or Graph patterns'], estimatedHours: 2 },
          { day: 4, focusArea: primaryFocus, tasks: ['Implement a mini-project module or schema optimization', 'Document architectural rationale'], estimatedHours: 3 },
          { day: 5, focusArea: 'CS Fundamentals', tasks: ['Review OS Process Scheduling & DBMS ACID transactions', 'Prepare STAR behavioral stories'], estimatedHours: 2 },
          { day: 6, focusArea: 'Mock Technical Interview', tasks: ['Conduct 1 timed mock interview round', 'Simulate whiteboard coding constraint'], estimatedHours: 2 },
          { day: 7, focusArea: 'Weekly Review', tasks: ['Retest skill benchmarks and sync external profile telemetry'], estimatedHours: 1 },
        ],
        milestones: [
          `Close ${primaryFocus} deficit`,
          'Complete 1 timed mock technical round',
          'Synchronize fresh telemetry to reflect progress',
        ],
        expectedOutcome: `Increase verified readiness index to ${Math.min(100, pri + 10)}/100 for campus placement drives.`,
      },
      { studentProfileId: state.studentProfileId, state }
    );

    // Step 8: Act - Create 1 high priority action item
    const actionTool = agentToolsRegistry['create_action_item'];
    await actionTool.execute(
      {
        title: `Master ${primaryFocus} Foundations & Core Interview Patterns`,
        category: primaryFocus.includes('Dev') ? 'Project' : 'Theory',
        priority: 'HIGH',
        estimatedHours: 4,
        reason: focusReason,
      },
      { studentProfileId: state.studentProfileId, state }
    );

    const message = `
### 🎯 Placement Coach Strategic Assessment

Hello **${profileData.name}**! Based on your verified telemetry:

- **Placement Readiness Index (PRI)**: **${pri}/100**
- **Strongest Dimension**: DSA (**${dsa}/100**)
- **Primary Strategic Focus**: **${primaryFocus}** (**${focusReason}**)
${companyData ? `- **${companyData.companyName} Benchmark Readiness**: **${companyData.readinessScore}/100** (${companyData.status})` : ''}

---

### 📋 Recommended 7-Day Action Plan
I have generated a structured **7-Day Learning Plan** and created a new priority action item in your **Action Center**.

1. **Days 1–2**: Target **${primaryFocus}** core paradigms and interview problems.
2. **Days 3–4**: Solve targeted LeetCode dynamic programming & graph patterns.
3. **Days 5–6**: Review core CS fundamentals (OS & DBMS) and conduct 1 timed mock technical interview.
4. **Day 7**: Re-sync your telemetry to measure score progression.

You can click **"Start Plan"** in the Coach dashboard to begin tracking your tasks!
    `.trim();

    const sessionId = await agentMemoryService.saveSession(state, message);

    return {
      sessionId,
      message,
      studentProfileId: state.studentProfileId,
      actions: state.createdActions,
      plan: state.learningPlan,
      projectRecommendations: state.createdProjects,
      toolCalls: state.observations.map((o) => ({
        toolName: o.toolCall.name,
        description: `Step ${o.step}: Invoked ${o.toolCall.name}`,
        success: o.result.success,
      })),
      timestamp: new Date().toISOString(),
    };
  }
}

export const agentExecutor = new AgentExecutor();
