export type PlatformName = 'GITHUB' | 'LEETCODE' | 'CODECHEF' | 'HACKERRANK' | 'LINKEDIN';

export interface PlatformConnectionInput {
  platform: PlatformName;
  profileUrl: string;
}

export interface ConnectorResponse<T = any> {
  success: boolean;
  platform: PlatformName;
  rawProfileUrl: string;
  data?: T;
  error?: string;
  isPublicDataOnly: boolean;
}

export interface NormalizedCodingStats {
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  contestRating: number;
  globalRank: number;
  contestsParticipated: number;
}

export interface AnalyzedRepo {
  name: string;
  description: string;
  repoUrl: string;
  stars: number;
  forks: number;
  language: string;
  commitCount: number;
  sizeKb?: number;
  hasTests: boolean;
  hasCiCd: boolean;
  hasDocker: boolean;
  architectureTier: 'Basic CRUD' | 'Full-Stack Production' | 'Advanced System';
  difficultyScore: number; // 1.0 - 10.0
  signals?: string[];
}

export interface NormalizedDevStats {
  totalRepos: number;
  publicRepos: number;
  totalStars: number;
  totalForks: number;
  totalCommits: number;
  prCount: number;
  issueCount: number;
  languages: Record<string, number>;
  topRepos: AnalyzedRepo[];
}

export interface NormalizedStudentProfile {
  identity: {
    name: string;
    username: string;
    email: string;
    department?: string;
    branch?: string;
    passoutYear?: number;
  };
  coding: {
    leetcode?: NormalizedCodingStats;
    codechef?: NormalizedCodingStats;
    hackerrank?: NormalizedCodingStats;
    combinedTotalSolved: number;
    combinedContestRatingMax: number;
  };
  development: NormalizedDevStats;
  skills: Array<{
    category: string;
    name: string;
    score: number;
    verifiedBy: string;
  }>;
  placementReadinessIndex: number;
}

export interface GrokAnalysisResponse {
  summary: string;
  placementReadiness: number;
  strengths: string[];
  weaknesses: string[];
  skillGaps: Array<{
    skill: string;
    currentScore: number;
    requiredScore: number;
    gapSeverity: 'HIGH' | 'MEDIUM' | 'LOW';
    reason: string;
  }>;
  recommendedActions: Array<{
    title: string;
    category: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    estimatedHours: number;
    reason: string;
  }>;
  projectIdeas: Array<{
    title: string;
    problemStatement: string;
    whySuited: string;
    technologies: string[];
    skillsDeveloped: string[];
    difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
    estimatedDuration: string;
    milestones: string[];
  }>;
  learningTopics: string[];
  companySpecificInsights?: Record<string, string>;
}

export interface ParsedResumeResult {
  extractedSkills: string[];
  extractedProjects: Array<{
    name: string;
    description: string;
    technologies: string[];
    architectureTier: 'Basic CRUD' | 'Full-Stack Production' | 'Advanced System';
    difficultyScore: number;
    hasTests: boolean;
    hasCiCd: boolean;
    hasDocker: boolean;
  }>;
  experienceSummary: string;
  placementReadiness: number;
}

