import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { AgentToolDefinition } from './agent.types';
import { skillEngineService } from '../services/skillEngine.service';
import { normalizerService } from '../services/normalizer.service';
import { NormalizedCodingStats, NormalizedDevStats } from '../types';
import { scoringConfig } from '../config/scoring.config';

const prisma = new PrismaClient();

// 1. Tool: get_student_profile
export const getStudentProfileTool: AgentToolDefinition = {
  name: 'get_student_profile',
  description: "Retrieve the authenticated student's profile details including name, academic department, target role, placement readiness index, and connected platforms.",
  parameters: {
    type: 'object',
    properties: {},
  },
  schema: z.object({}),
  execute: async (_args, context) => {
    const profile = await prisma.studentProfile.findUnique({
      where: { id: context.studentProfileId },
      include: {
        user: { select: { name: true, email: true, department: true, branch: true, passoutYear: true } },
        connections: true,
        resumeProfile: true,
        projects: { select: { id: true, name: true, architectureTier: true, difficultyScore: true } },
      },
    });

    if (!profile) {
      throw new Error(`Student profile "${context.studentProfileId}" not found in database.`);
    }

    context.state.studentName = profile.user.name;
    context.state.cachedProfile = profile;

    return {
      studentId: profile.id,
      name: profile.user.name,
      department: profile.user.department,
      branch: profile.user.branch,
      passoutYear: profile.user.passoutYear,
      targetRole: profile.targetRole,
      placementReadiness: profile.placementReadiness,
      hasResume: !!profile.resumeProfile,
      projectCount: profile.projects.length,
      connectedPlatforms: profile.connections.map((c) => ({
        platform: c.platform,
        url: c.profileUrl,
        isConnected: c.isConnected,
        lastSyncedAt: c.lastSyncedAt,
      })),
    };
  },
};

// 2. Tool: get_skill_scores
export const getSkillScoresTool: AgentToolDefinition = {
  name: 'get_skill_scores',
  description: "Retrieve the student's verified objective skill scores and complexity metrics calculated deterministically from platform telemetry and live projects.",
  parameters: {
    type: 'object',
    properties: {},
  },
  schema: z.object({}),
  execute: async (_args, context) => {
    const profile = await prisma.studentProfile.findUnique({
      where: { id: context.studentProfileId },
      include: {
        codingProfiles: true,
        gitHubProfile: true,
        connections: true,
        skillMetrics: { orderBy: { verifiedDepthScore: 'desc' } },
        projects: true,
      },
    });

    if (!profile) {
      throw new Error(`Student profile "${context.studentProfileId}" does not exist.`);
    }

    const codingStats: NormalizedCodingStats[] = (profile.codingProfiles || []).map((cp) => ({
      totalSolved: cp.totalSolved,
      easySolved: cp.easySolved,
      mediumSolved: cp.mediumSolved,
      hardSolved: cp.hardSolved,
      contestRating: cp.contestRating,
      globalRank: cp.globalRank,
      contestsParticipated: cp.contestsParticipated,
    }));

    let devStats: NormalizedDevStats | undefined = undefined;
    if (profile.gitHubProfile) {
      devStats = {
        totalRepos: profile.gitHubProfile.totalRepos,
        publicRepos: profile.gitHubProfile.publicRepos,
        totalStars: profile.gitHubProfile.totalStars,
        totalForks: profile.gitHubProfile.totalForks,
        totalCommits: profile.gitHubProfile.totalCommits,
        prCount: profile.gitHubProfile.prCount,
        issueCount: profile.gitHubProfile.issueCount,
        languages: JSON.parse(profile.gitHubProfile.languagesJson || '{}'),
        topRepos: JSON.parse(profile.gitHubProfile.topReposJson || '[]'),
      };
    }

    const hasLinkedIn = profile.connections.some((c) => c.platform === 'LINKEDIN' && c.isConnected);
    const scores = skillEngineService.calculateScores(codingStats, devStats, { linkedinConnected: hasLinkedIn });

    context.state.cachedSkillScores = scores;

    return {
      placementReadinessIndex: scores.overallReadinessIndex,
      dsaScore: scores.dsaScore,
      devScore: scores.devScore,
      dbmsScore: scores.dbmsScore,
      osScore: scores.osScore,
      systemDesignScore: scores.systemDesignScore,
      gitScore: scores.gitScore,
      oopScore: scores.oopScore,
      networksScore: scores.networksScore,
      aptitudeScore: scores.aptitudeScore,
      communicationScore: scores.communicationScore,
      verifiedSkillMetrics: profile.skillMetrics.map((sm) => ({
        skillName: sm.skillName,
        verifiedDepthScore: sm.verifiedDepthScore,
        maxProjectDifficulty: sm.maxProjectDifficulty,
        avgProjectDifficulty: sm.avgProjectDifficulty,
        evidenceSummary: sm.evidenceSummary,
      })),
      breakdown: scores.breakdown,
    };
  },
};

// 3. Tool: get_skill_history
export const getSkillHistoryTool: AgentToolDefinition = {
  name: 'get_skill_history',
  description: "Retrieve historical skill score snapshots and evaluate the student's learning trajectory trends (IMPROVING, STABLE, DECLINING).",
  parameters: {
    type: 'object',
    properties: {},
  },
  schema: z.object({}),
  execute: async (_args, context) => {
    const snapshots = await prisma.skillSnapshot.findMany({
      where: { studentProfileId: context.studentProfileId },
      orderBy: { createdAt: 'asc' },
    });

    if (snapshots.length === 0) {
      return {
        hasHistory: false,
        message: 'No historical snapshots recorded yet.',
        trend: 'UNKNOWN',
        snapshots: [],
      };
    }

    const first = snapshots[0];
    const latest = snapshots[snapshots.length - 1];

    const dsaDelta = latest.dsaScore - first.dsaScore;
    const devDelta = latest.devScore - first.devScore;
    const overallDelta = latest.overallScore - first.overallScore;

    const overallTrend = overallDelta > 5 ? 'IMPROVING' : overallDelta < -5 ? 'DECLINING' : 'STABLE';
    const dsaTrend = dsaDelta > 4 ? 'IMPROVING' : dsaDelta < -4 ? 'DECLINING' : 'STABLE';
    const devTrend = devDelta > 4 ? 'IMPROVING' : devDelta < -4 ? 'DECLINING' : 'STABLE';

    return {
      hasHistory: true,
      snapshotCount: snapshots.length,
      firstSnapshotPeriod: first.snapshotMonth,
      latestSnapshotPeriod: latest.snapshotMonth,
      trends: {
        overall: { trend: overallTrend, delta: overallDelta },
        dsa: { trend: dsaTrend, delta: dsaDelta },
        dev: { trend: devTrend, delta: devDelta },
      },
      snapshots: snapshots.map((s) => ({
        period: s.snapshotMonth,
        overall: s.overallScore,
        dsa: s.dsaScore,
        dev: s.devScore,
        dbms: s.dbmsScore,
        os: s.osScore,
      })),
    };
  },
};

// 4. Tool: get_platform_stats
export const getPlatformStatsTool: AgentToolDefinition = {
  name: 'get_platform_stats',
  description: "Retrieve telemetry metrics across GitHub (repos, commits, stars) and competitive programming platforms (LeetCode, CodeChef, HackerRank).",
  parameters: {
    type: 'object',
    properties: {},
  },
  schema: z.object({}),
  execute: async (_args, context) => {
    const profile = await prisma.studentProfile.findUnique({
      where: { id: context.studentProfileId },
      include: {
        gitHubProfile: true,
        codingProfiles: true,
      },
    });

    if (!profile) {
      throw new Error(`Profile not found for ID: ${context.studentProfileId}`);
    }

    return {
      gitHub: profile.gitHubProfile
        ? {
            publicRepos: profile.gitHubProfile.publicRepos,
            totalStars: profile.gitHubProfile.totalStars,
            totalCommits: profile.gitHubProfile.totalCommits,
            prCount: profile.gitHubProfile.prCount,
            languages: JSON.parse(profile.gitHubProfile.languagesJson || '{}'),
            topRepos: JSON.parse(profile.gitHubProfile.topReposJson || '[]'),
          }
        : null,
      codingPlatforms: profile.codingProfiles.map((cp) => ({
        platform: cp.platform,
        totalSolved: cp.totalSolved,
        easySolved: cp.easySolved,
        mediumSolved: cp.mediumSolved,
        hardSolved: cp.hardSolved,
        contestRating: cp.contestRating,
        globalRank: cp.globalRank,
      })),
    };
  },
};

// 5. Tool: get_company_requirements
export const getCompanyRequirementsTool: AgentToolDefinition = {
  name: 'get_company_requirements',
  description: 'Retrieve technical benchmark requirements for target placement companies (e.g. Amazon, Google, Microsoft).',
  parameters: {
    type: 'object',
    properties: {
      companyName: {
        type: 'string',
        description: 'Optional name of the target company. If omitted, all target companies are returned.',
      },
    },
  },
  schema: z.object({
    companyName: z.string().optional(),
  }),
  execute: async (args, _context) => {
    const where = args.companyName ? { name: { contains: args.companyName } } : {};

    const companies = await prisma.targetCompany.findMany({
      where,
      include: { requirements: true },
    });

    if (args.companyName && companies.length === 0) {
      throw new Error(`No benchmark profiles found matching company "${args.companyName}".`);
    }

    return {
      companies: companies.map((c: any) => ({
        id: c.id,
        name: c.name,
        difficultyLevel: c.difficultyLevel,
        overview: c.overview,
        targetRoles: JSON.parse(c.targetRolesJson || '[]'),
        requirements: (c.requirements || []).map((r: any) => ({
          skillName: r.skillName,
          minScore: r.minScore,
          priority: r.priority,
          topics: JSON.parse(r.topicsJson || '[]'),
        })),
      })),
    };
  },
};

// 6. Tool: calculate_company_readiness
export const calculateCompanyReadinessTool: AgentToolDefinition = {
  name: 'calculate_company_readiness',
  description: "Evaluate the student's multi-dimensional skill vector directly against a target company's benchmark requirements to determine readiness and missing gaps.",
  parameters: {
    type: 'object',
    properties: {
      companyName: {
        type: 'string',
        description: 'Name of the company to evaluate against.',
      },
    },
    required: ['companyName'],
  },
  schema: z.object({
    companyName: z.string().min(1),
  }),
  execute: async (args, context) => {
    const company = await prisma.targetCompany.findFirst({
      where: { name: { contains: args.companyName } },
      include: { requirements: true },
    });

    if (!company) {
      throw new Error(`Target company "${args.companyName}" not found in database.`);
    }

    const profile = await prisma.studentProfile.findUnique({
      where: { id: context.studentProfileId },
      include: {
        codingProfiles: true,
        gitHubProfile: true,
      },
    });

    if (!profile) {
      throw new Error(`Student profile "${context.studentProfileId}" not found in database.`);
    }

    const codingStats: NormalizedCodingStats[] = profile.codingProfiles.map((cp) => ({
      totalSolved: cp.totalSolved,
      easySolved: cp.easySolved,
      mediumSolved: cp.mediumSolved,
      hardSolved: cp.hardSolved,
      contestRating: cp.contestRating,
      globalRank: cp.globalRank,
      contestsParticipated: cp.contestsParticipated,
    }));

    let devStats: NormalizedDevStats | undefined = undefined;
    if (profile.gitHubProfile) {
      devStats = {
        totalRepos: profile.gitHubProfile.totalRepos,
        publicRepos: profile.gitHubProfile.publicRepos,
        totalStars: profile.gitHubProfile.totalStars,
        totalForks: profile.gitHubProfile.totalForks,
        totalCommits: profile.gitHubProfile.totalCommits,
        prCount: profile.gitHubProfile.prCount,
        issueCount: profile.gitHubProfile.issueCount,
        languages: JSON.parse(profile.gitHubProfile.languagesJson || '{}'),
        topRepos: JSON.parse(profile.gitHubProfile.topReposJson || '[]'),
      };
    }

    const scores = skillEngineService.calculateScores(codingStats, devStats);

    const resolveScore = (name: string): number => {
      const lower = name.toLowerCase();
      if (lower.includes('dsa') || lower.includes('algorithm') || lower.includes('coding')) return scores.dsaScore;
      if (lower.includes('dbms') || lower.includes('sql') || lower.includes('database')) return scores.dbmsScore;
      if (lower.includes('os') || lower.includes('operating system')) return scores.osScore;
      if (lower.includes('system design') || lower.includes('distributed')) return scores.systemDesignScore;
      if (lower.includes('dev') || lower.includes('project')) return scores.devScore;
      if (lower.includes('git')) return scores.gitScore;
      return scores.overallReadinessIndex;
    };

    let totalWeight = 0;
    let totalWeightedScore = 0;
    const skillBreakdown: any[] = [];
    const missingSkills: any[] = [];

    const requirements = (company as any).requirements || [];
    const priorityWeights = scoringConfig.companyReadiness.priorityWeights;

    requirements.forEach((req: any) => {
      const studentScore = resolveScore(req.skillName);
      const weight = (priorityWeights as any)[req.priority] || 1.0;
      const isMet = studentScore >= req.minScore;
      const matchPct = Math.min(100, Math.round((studentScore / req.minScore) * 100));

      totalWeightedScore += matchPct * weight;
      totalWeight += weight;

      const topics = JSON.parse(req.topicsJson || '[]');

      skillBreakdown.push({
        skillName: req.skillName,
        requiredScore: req.minScore,
        studentScore,
        matchPercentage: matchPct,
        isMet,
        topics,
      });

      if (!isMet) {
        missingSkills.push({
          skillName: req.skillName,
          requiredScore: req.minScore,
          studentScore,
          gap: req.minScore - studentScore,
          topics,
        });
      }
    });

    const readinessScore = totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : scores.overallReadinessIndex;
    const thresholds = scoringConfig.companyReadiness.thresholds;
    const status = readinessScore >= thresholds.ready ? 'READY' : readinessScore >= thresholds.moderate ? 'MODERATE' : 'NEEDS_WORK';

    return {
      companyName: company.name,
      difficultyLevel: company.difficultyLevel,
      readinessScore,
      status,
      missingSkills,
      skillBreakdown,
    };
  },
};

// 7. Tool: get_pending_actions
export const getPendingActionsTool: AgentToolDefinition = {
  name: 'get_pending_actions',
  description: "Retrieve incomplete action items and tasks assigned to the student.",
  parameters: {
    type: 'object',
    properties: {},
  },
  schema: z.object({}),
  execute: async (_args, context) => {
    const actions = await prisma.actionItem.findMany({
      where: { studentProfileId: context.studentProfileId, completed: false },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });

    return {
      count: actions.length,
      pendingActions: actions.map((a) => ({
        id: a.id,
        title: a.title,
        category: a.category,
        priority: a.priority,
        estimatedHours: a.estimatedHours,
        reason: a.reason,
      })),
    };
  },
};

// 8. Tool: get_completed_actions
export const getCompletedActionsTool: AgentToolDefinition = {
  name: 'get_completed_actions',
  description: "Retrieve recently completed action items to evaluate student progress and milestones.",
  parameters: {
    type: 'object',
    properties: {},
  },
  schema: z.object({}),
  execute: async (_args, context) => {
    const actions = await prisma.actionItem.findMany({
      where: { studentProfileId: context.studentProfileId, completed: true },
      orderBy: { completedAt: 'desc' },
      take: 10,
    });

    return {
      count: actions.length,
      completedActions: actions.map((a) => ({
        id: a.id,
        title: a.title,
        category: a.category,
        completedAt: a.completedAt,
        reason: a.reason,
      })),
    };
  },
};

// 9. Tool: create_action_item
export const createActionItemTool: AgentToolDefinition = {
  name: 'create_action_item',
  description: "Create a verified, structured action item for the student to practice or study.",
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Clear, actionable title of the action item' },
      category: { type: 'string', enum: ['Coding', 'Project', 'Theory', 'Mock Interview', 'Documentation'] },
      priority: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
      estimatedHours: { type: 'number', description: 'Estimated hours needed to complete' },
      reason: { type: 'string', description: 'Explicit data-driven justification for why this action was assigned' },
    },
    required: ['title', 'category', 'priority', 'reason'],
  },
  schema: z.object({
    title: z.string().min(3),
    category: z.enum(['Coding', 'Project', 'Theory', 'Mock Interview', 'Documentation']),
    priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    estimatedHours: z.number().optional().default(3),
    reason: z.string().min(5),
  }),
  execute: async (args, context) => {
    const profile = await prisma.studentProfile.findUnique({
      where: { id: context.studentProfileId },
    });

    if (!profile) {
      throw new Error(`Cannot assign action item: Student profile "${context.studentProfileId}" not found.`);
    }

    const action = await prisma.actionItem.create({
      data: {
        studentProfileId: context.studentProfileId,
        title: args.title,
        category: args.category,
        priority: args.priority,
        estimatedHours: args.estimatedHours || 3,
        reason: args.reason,
      },
    });

    context.state.createdActions.push(action);

    return {
      success: true,
      message: `Action item "${action.title}" successfully created`,
      actionId: action.id,
    };
  },
};

// 10. Tool: complete_action_item
export const completeActionItemTool: AgentToolDefinition = {
  name: 'complete_action_item',
  description: 'Mark a student action item as completed.',
  parameters: {
    type: 'object',
    properties: {
      actionId: { type: 'string', description: 'ID of the action item to mark completed' },
    },
    required: ['actionId'],
  },
  schema: z.object({
    actionId: z.string().min(1),
  }),
  execute: async (args, context) => {
    const action = await prisma.actionItem.findFirst({
      where: { id: args.actionId, studentProfileId: context.studentProfileId },
    });

    if (!action) {
      throw new Error(`Action item ${args.actionId} not found in database for student ${context.studentProfileId}.`);
    }

    const updated = await prisma.actionItem.update({
      where: { id: args.actionId },
      data: {
        completed: true,
        completedAt: new Date(),
      },
    });

    return {
      success: true,
      message: `Action item "${updated.title}" marked as completed`,
    };
  },
};

// 11. Tool: create_project_recommendation
export const createProjectRecommendationTool: AgentToolDefinition = {
  name: 'create_project_recommendation',
  description: 'Create a tailored "Build Next" project recommendation to bridge developer and system architecture skill gaps.',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Title of the project idea' },
      problemStatement: { type: 'string', description: 'Detailed problem statement' },
      whySuited: { type: 'string', description: 'Why this project specifically fits the student' },
      technologies: { type: 'array', items: { type: 'string' } },
      skillsDeveloped: { type: 'array', items: { type: 'string' } },
      difficulty: { type: 'string', enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] },
      estimatedDuration: { type: 'string', description: 'e.g. "2 weeks", "3 weeks"' },
      milestones: { type: 'array', items: { type: 'string' } },
    },
    required: ['title', 'problemStatement', 'whySuited', 'technologies', 'skillsDeveloped'],
  },
  schema: z.object({
    title: z.string().min(3),
    problemStatement: z.string().min(10),
    whySuited: z.string().min(5),
    technologies: z.array(z.string()).min(1),
    skillsDeveloped: z.array(z.string()).min(1),
    difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).default('INTERMEDIATE'),
    estimatedDuration: z.string().default('2 weeks'),
    milestones: z.array(z.string()).default([]),
  }),
  execute: async (args, context) => {
    const profile = await prisma.studentProfile.findUnique({
      where: { id: context.studentProfileId },
    });

    if (!profile) {
      throw new Error(`Cannot create project recommendation: Student profile "${context.studentProfileId}" not found.`);
    }

    const project = await prisma.projectRecommendation.create({
      data: {
        studentProfileId: context.studentProfileId,
        title: args.title,
        problemStatement: args.problemStatement,
        whySuited: args.whySuited,
        technologiesJson: JSON.stringify(args.technologies),
        skillsDevelopedJson: JSON.stringify(args.skillsDeveloped),
        difficulty: args.difficulty,
        estimatedDuration: args.estimatedDuration,
        milestonesJson: JSON.stringify(args.milestones),
      },
    });

    context.state.createdProjects.push(project);

    return {
      success: true,
      projectId: project.id,
      title: project.title,
      message: `Project recommendation "${project.title}" created successfully`,
    };
  },
};

// 12. Tool: create_learning_plan
export const createLearningPlanTool: AgentToolDefinition = {
  name: 'create_learning_plan',
  description: 'Create a structured multi-day daily learning plan to address identified skill priorities and interview readiness.',
  parameters: {
    type: 'object',
    properties: {
      goal: { type: 'string', description: 'Primary objective of the plan' },
      durationDays: { type: 'number', description: 'Number of days (e.g. 7, 14)' },
      priorities: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            skill: { type: 'string' },
            priority: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
            reason: { type: 'string' },
          },
          required: ['skill', 'priority', 'reason'],
        },
      },
      dailyPlan: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            day: { type: 'number' },
            focusArea: { type: 'string' },
            tasks: { type: 'array', items: { type: 'string' } },
            estimatedHours: { type: 'number' },
          },
          required: ['day', 'focusArea', 'tasks'],
        },
      },
      milestones: { type: 'array', items: { type: 'string' } },
      expectedOutcome: { type: 'string' },
    },
    required: ['goal', 'durationDays', 'priorities', 'dailyPlan'],
  },
  schema: z.object({
    goal: z.string().min(5),
    durationDays: z.number().min(1).max(30),
    priorities: z.array(
      z.object({
        skill: z.string(),
        priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
        reason: z.string(),
      })
    ),
    dailyPlan: z.array(
      z.object({
        day: z.number(),
        focusArea: z.string(),
        tasks: z.array(z.string()),
        estimatedHours: z.number().default(2),
      })
    ),
    milestones: z.array(z.string()).default([]),
    expectedOutcome: z.string().default('Increased placement readiness and closed skill gaps'),
  }),
  execute: async (args, context) => {
    const plan = {
      goal: args.goal,
      targetRole: context.state.cachedProfile?.targetRole || 'Software Development Engineer',
      durationDays: args.durationDays,
      priorities: args.priorities,
      dailyPlan: args.dailyPlan,
      milestones: args.milestones || [],
      expectedOutcome: args.expectedOutcome || 'Stronger placement interview readiness',
    };

    context.state.learningPlan = plan;

    return {
      success: true,
      message: `Structured ${args.durationDays}-day learning plan established.`,
      plan,
    };
  },
};

// 13. Tool: refresh_platform_data
export const refreshPlatformDataTool: AgentToolDefinition = {
  name: 'refresh_platform_data',
  description: 'Refresh and synchronize external coding platform telemetry for the student using established connector pipelines.',
  parameters: {
    type: 'object',
    properties: {},
  },
  schema: z.object({}),
  execute: async (_args, context) => {
    const connections = await prisma.platformConnection.findMany({
      where: { studentProfileId: context.studentProfileId, isConnected: true },
    });

    if (connections.length === 0) {
      return {
        success: false,
        message: 'No connected profile URLs found. Please connect GitHub or LeetCode profiles first.',
      };
    }

    const syncResults: Record<string, boolean> = {};

    for (const conn of connections) {
      try {
        const result = await normalizerService.syncPlatform(conn.platform as any, conn.profileUrl);
        syncResults[conn.platform] = result.success;
      } catch {
        syncResults[conn.platform] = false;
      }
    }

    return {
      success: true,
      message: 'Platform telemetry refreshed successfully.',
      platformsUpdated: syncResults,
    };
  },
};

// Tool Registry Map
export const agentToolsRegistry: Record<string, AgentToolDefinition> = {
  get_student_profile: getStudentProfileTool,
  get_skill_scores: getSkillScoresTool,
  get_skill_history: getSkillHistoryTool,
  get_platform_stats: getPlatformStatsTool,
  get_company_requirements: getCompanyRequirementsTool,
  calculate_company_readiness: calculateCompanyReadinessTool,
  get_pending_actions: getPendingActionsTool,
  get_completed_actions: getCompletedActionsTool,
  create_action_item: createActionItemTool,
  complete_action_item: completeActionItemTool,
  create_project_recommendation: createProjectRecommendationTool,
  create_learning_plan: createLearningPlanTool,
  refresh_platform_data: refreshPlatformDataTool,
};

// Export tool specifications in OpenAI function calling format
export function getAgentToolSpecs() {
  return Object.values(agentToolsRegistry).map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}
