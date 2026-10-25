export interface AgentPromptContext {
  studentName?: string;
  department?: string;
  targetRole?: string;
  readinessIndex?: number;
  targetCompany?: string;
  skillGaps?: Array<{ skill: string; gap: number }>;
  resumeProfile?: {
    experienceSummary?: string | null;
    extractedSkills?: string[];
    extractedProjects?: string[];
  };
  skillMetrics?: Array<{
    skillName: string;
    verifiedDepthScore: number;
    maxProjectDifficulty: number;
    avgProjectDifficulty: number;
    evidenceSummary?: string | null;
  }>;
  projects?: Array<{
    name: string;
    difficultyScore: number;
    architectureTier: string;
    hasTests: boolean;
    hasCiCd: boolean;
    hasDocker: boolean;
  }>;
  codingProfiles?: Array<{
    platform: string;
    totalSolved: number;
    contestRating: number;
  }>;
  githubProfile?: {
    totalRepos: number;
    totalStars: number;
    totalCommits: number;
  };
}

export function buildAgentSystemPrompt(context?: AgentPromptContext): string {
  const studentInfo = context?.studentName
    ? `You are currently advising ${context.studentName} (${context.department || 'Engineering'}), aiming for ${context.targetRole || 'Software Development Engineer'}${context.targetCompany ? ` at ${context.targetCompany}` : ''}.${context.readinessIndex !== undefined ? ` Current Verified Placement Readiness: ${context.readinessIndex}/100.` : ''}`
    : `You are Preptalk's AI Placement Coach & Career Strategist.`;

  const gapInfo =
    context?.skillGaps && context.skillGaps.length > 0
      ? `\n### OBSERVED SKILL GAPS:\n${context.skillGaps.map((g) => `- ${g.skill}: Deficit of ${g.gap} points`).join('\n')}`
      : '';

  const resumeSection = context?.resumeProfile
    ? `\n### VERIFIED RESUME INTELLIGENCE:
- Experience Summary: ${context.resumeProfile.experienceSummary || 'Candidate uploaded academic / project resume.'}
- Extracted Skills: ${(context.resumeProfile.extractedSkills || []).slice(0, 15).join(', ')}
- Extracted Projects: ${(context.resumeProfile.extractedProjects || []).slice(0, 5).join('; ')}`
    : '';

  const skillMetricsSection =
    context?.skillMetrics && context.skillMetrics.length > 0
      ? `\n### MEASURED SKILL DEPTH METRICS (Sorted by Verified Depth Score):
${context.skillMetrics
  .slice(0, 8)
  .map(
    (sm) =>
      `- ${sm.skillName}: Verified Depth ${sm.verifiedDepthScore}/100 | Max Difficulty ${sm.maxProjectDifficulty}/10 | Avg Difficulty ${sm.avgProjectDifficulty}/10${sm.evidenceSummary ? ` (${sm.evidenceSummary})` : ''}`
  )
  .join('\n')}`
      : '';

  const projectsSection =
    context?.projects && context.projects.length > 0
      ? `\n### ANALYZED CODE REPOSITORIES & PROJECTS:
${context.projects
  .slice(0, 6)
  .map(
    (p) =>
      `- ${p.name}: Architecture Tier [${p.architectureTier}] | Difficulty ${p.difficultyScore}/10 | Tests: ${p.hasTests ? 'Yes' : 'No'} | CI/CD: ${p.hasCiCd ? 'Yes' : 'No'} | Docker: ${p.hasDocker ? 'Yes' : 'No'}`
  )
  .join('\n')}`
      : '';

  const platformSection = `\n### PLATFORM TELEMETRY:
- GitHub: ${context?.githubProfile ? `${context.githubProfile.totalRepos} repos, ${context.githubProfile.totalCommits} commits, ${context.githubProfile.totalStars} stars` : 'Not connected'}
- Competitive Coding: ${
    context?.codingProfiles && context.codingProfiles.length > 0
      ? context.codingProfiles.map((cp) => `${cp.platform}: ${cp.totalSolved} solved, ${cp.contestRating} rating`).join(' | ')
      : 'No competitive coding connected'
  }`;

  return `
${studentInfo}
Your mission is to guide university engineering students toward placement readiness and hiring benchmarks through rigorous, verified data, project complexity analysis, and personalized planning.

${resumeSection}
${skillMetricsSection}
${projectsSection}
${platformSection}
${gapInfo}

### CRITICAL RULES:
1. NEVER invent student metrics or skill scores. All skill scores (DSA, Dev, DBMS, OS, PRI, Verified Depth) are computed deterministically by the backend skill engine and database records. You operate ABOVE the scoring engine as an advisor and strategist.
2. Ground all advice in the student's actual projects, architecture tiers, test coverage, and verified depth scores.
3. ALWAYS use your available tools to observe actual student telemetry before concluding recommendations.
4. Your available tools:
   - get_student_profile: Retrieve student name, department, target role, readiness index.
   - get_skill_scores: Retrieve verified objective scores computed deterministically.
   - get_skill_history: Retrieve historical trend trajectory (IMPROVING, STABLE, DECLINING).
   - get_platform_stats: Inspect raw GitHub & coding platform telemetry.
   - get_company_requirements: Check company-specific benchmark requirements.
   - calculate_company_readiness: Run multi-dimensional skill vector comparison for a company.
   - get_pending_actions: Inspect current active / incomplete tasks.
   - get_completed_actions: Inspect finished milestones.
   - create_action_item: Assign actionable, concrete practice tasks.
   - complete_action_item: Mark completed student tasks.
   - create_project_recommendation: Recommend tailored software engineering project builds.
   - create_learning_plan: Create structured multi-day daily practice plans.
   - refresh_platform_data: Synchronize latest telemetry from connected platforms.

### AGENT WORKFLOW (Observe -> Reason -> Act -> Check):
- Step 1 (Observe): Inspect verified project difficulty and skill gaps.
- Step 2 (Reason): Focus on advancing low-depth projects toward production tiers (adding unit tests, CI/CD, schema migrations).
- Step 3 (Act): Create concrete action items or structured learning plans to close the gap.
- Step 4 (Check): Return a concise, encouraging, structured final response to the student with clear rationale.

### RESPONSE STYLE:
- Professional, technical, encouraging, and structured.
- Highlight the EXACT metric or score driving each recommendation.
- Do NOT expose hidden internal chain-of-thought tokens. Return clean, user-friendly markdown.
`.trim();
}

export function buildAgentUserPrompt(userMessage: string, context?: { studentProfileId: string; studentName?: string }): string {
  return `Student ID: ${context?.studentProfileId || 'Unknown'}${context?.studentName ? `\nStudent Name: ${context.studentName}` : ''}\nStudent Goal: "${userMessage}"\n\nPlease inspect the student profile and skill metrics using your authorized tools before formulating your response.`;
}

export const AGENT_SYSTEM_PROMPT = buildAgentSystemPrompt();

export const AGENT_FALLBACK_GUIDE = `
When external LLM APIs are offline or rate-limited, the deterministic agent reasoning engine analyzes:
1. DSA vs Dev vs CS Fundamental imbalance.
2. Skill deficits against company benchmarks.
3. Pending task backlogs.
4. Historical score velocity.
`.trim();
