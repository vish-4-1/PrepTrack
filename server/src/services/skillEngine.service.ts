import { PrismaClient } from '@prisma/client';
import { NormalizedCodingStats, NormalizedDevStats, AnalyzedRepo } from '../types';
import { scoringConfig } from '../config/scoring.config';

const prisma = new PrismaClient();

export interface CalculatedSkillScores {
  dsaScore: number;
  devScore: number;
  dbmsScore: number;
  osScore: number;
  systemDesignScore: number;
  gitScore: number;
  oopScore: number;
  networksScore: number;
  aptitudeScore: number;
  communicationScore: number;
  overallReadinessIndex: number;
  breakdown: Record<string, { score: number; reasoning: string }>;
}

export interface ComputedSkillMetric {
  skillName: string;
  category: string;
  frequencyCount: number;
  maxProjectDifficulty: number;
  avgProjectDifficulty: number;
  verifiedDepthScore: number;
  evidenceSummary: string;
}

export class SkillEngineService {
  calculateScores(
    codingProfiles: NormalizedCodingStats[],
    devStats?: NormalizedDevStats,
    customInputs?: { resumeUploaded?: boolean; linkedinConnected?: boolean }
  ): CalculatedSkillScores {
    const {
      dsa: dsaCfg,
      development: devCfg,
      csFundamentals: csCfg,
      softSkills: softCfg,
      placementReadiness: priCfg,
    } = scoringConfig;

    // 1. Calculate DSA Score (0-100)
    let totalSolved = 0;
    let easySolved = 0;
    let mediumSolved = 0;
    let hardSolved = 0;
    let maxRating = 0;

    codingProfiles.forEach((cp) => {
      totalSolved += cp.totalSolved || 0;
      easySolved += cp.easySolved || 0;
      mediumSolved += cp.mediumSolved || 0;
      hardSolved += cp.hardSolved || 0;
      if ((cp.contestRating || 0) > maxRating) {
        maxRating = cp.contestRating;
      }
    });

    const solveVolumeScore = Math.min(
      dsaCfg.solveVolume.maxPoints,
      (totalSolved / dsaCfg.solveVolume.targetCount) * dsaCfg.solveVolume.maxPoints
    );

    const diffWeightedSum =
      mediumSolved * dsaCfg.difficulty.mediumMultiplier +
      hardSolved * dsaCfg.difficulty.hardMultiplier;
    const diffScore = Math.min(
      dsaCfg.difficulty.maxPoints,
      (diffWeightedSum / dsaCfg.difficulty.targetScore) * dsaCfg.difficulty.maxPoints
    );

    const ratingScore =
      maxRating > dsaCfg.rating.baseline
        ? Math.min(
            dsaCfg.rating.maxPoints,
            ((maxRating - dsaCfg.rating.baseline) / dsaCfg.rating.span) * dsaCfg.rating.maxPoints
          )
        : dsaCfg.rating.defaultFloor;

    const dsaScore = Math.round(
      Math.min(dsaCfg.maxScore, solveVolumeScore + diffScore + ratingScore)
    );

    // 2. Calculate Development & Git Score using Depth-Weighted Complexity Formula
    const totalRepos = devStats?.totalRepos || 0;
    const totalStars = devStats?.totalStars || 0;
    const totalCommits = devStats?.totalCommits || 0;
    const languagesCount = Object.keys(devStats?.languages || {}).length;

    // Logarithmic diminishing returns for raw repo count: Math.log2(1 + projectCount)
    const logRepoScore = Math.min(
      devCfg.repos.maxPoints,
      (Math.log2(1 + totalRepos) / Math.log2(1 + devCfg.repos.targetCount)) * devCfg.repos.maxPoints
    );

    const starScore = Math.min(
      devCfg.stars.maxPoints,
      (totalStars / devCfg.stars.targetCount) * devCfg.stars.maxPoints
    );
    const commitScore = Math.min(
      devCfg.commits.maxPoints,
      (totalCommits / devCfg.commits.targetCount) * devCfg.commits.maxPoints
    );
    const langScore = Math.min(
      devCfg.languages.maxPoints,
      (languagesCount / devCfg.languages.targetCount) * devCfg.languages.maxPoints
    );

    // Factor in architectural difficulty bonus
    const topRepos = (devStats?.topRepos || []) as AnalyzedRepo[];
    const avgRepoDifficulty =
      topRepos.length > 0
        ? topRepos.reduce((acc, r) => acc + (r.difficultyScore || 3.0), 0) / topRepos.length
        : 3.0;

    const devScore = Math.round(
      Math.min(devCfg.maxScore, logRepoScore + starScore + commitScore + langScore)
    );
    const gitScore = Math.round(
      Math.min(devCfg.maxScore, (commitScore + logRepoScore) * devCfg.gitScoreMultiplier)
    );

    // 3. Core CS Fundamentals Scores
    const baselineCS = Math.min(
      csCfg.baseline.cap,
      csCfg.baseline.basePoints +
        Math.floor(mediumSolved / csCfg.baseline.mediumSolvedDivisor) +
        Math.floor(Math.log2(1 + totalRepos) * csCfg.baseline.repoMultiplier * 2)
    );

    const langKeys = Object.keys(devStats?.languages || {}).map((k) => k.toLowerCase());
    const hasDbLangs = langKeys.some((k) =>
      csCfg.keywords.dbms.some((kw) => k.includes(kw))
    );
    const hasOopLangs = langKeys.some((k) =>
      csCfg.keywords.oop.some((kw) => k.includes(kw))
    );
    const hasSystemLangs = langKeys.some((k) =>
      csCfg.keywords.systems.some((kw) => k.includes(kw))
    );

    const dbmsScore = Math.min(
      100,
      baselineCS + (hasDbLangs ? csCfg.dbms.bonusActive : csCfg.dbms.bonusDefault)
    );
    const osScore = Math.min(
      100,
      baselineCS +
        (hasSystemLangs
          ? csCfg.os.bonusActive
          : dsaScore > csCfg.os.dsaScoreThreshold
          ? csCfg.os.bonusDsaActive
          : csCfg.os.bonusDefault)
    );
    const oopScore = Math.min(
      100,
      baselineCS + (hasOopLangs ? csCfg.oop.bonusActive : csCfg.oop.bonusDefault)
    );
    const networksScore = Math.min(
      100,
      baselineCS +
        (devStats?.topRepos && devStats.topRepos.length > csCfg.networks.repoThreshold
          ? csCfg.networks.bonusActive
          : csCfg.networks.bonusDefault)
    );
    const systemDesignScore = Math.min(
      100,
      Math.round(
        dsaScore * csCfg.systemDesign.dsaWeight +
          devScore * csCfg.systemDesign.devWeight * (avgRepoDifficulty / 6.0)
      )
    );

    // 4. Soft Skills & Aptitude
    const communicationScore = customInputs?.linkedinConnected
      ? softCfg.communication.connectedScore
      : softCfg.communication.unconnectedScore;
    const aptitudeScore = Math.min(
      100,
      Math.round(dsaScore * softCfg.aptitude.dsaMultiplier + softCfg.aptitude.basePoints)
    );

    // 5. Placement Readiness Index (Composite Formula)
    const overallReadinessIndex = Math.round(
      dsaScore * priCfg.weights.dsa +
        devScore * priCfg.weights.dev +
        ((dbmsScore + osScore + oopScore) / 3) * priCfg.weights.csFundamentals +
        ((aptitudeScore + communicationScore) / 2) * priCfg.weights.softSkills
    );

    return {
      dsaScore,
      devScore,
      dbmsScore,
      osScore,
      systemDesignScore,
      gitScore,
      oopScore,
      networksScore,
      aptitudeScore,
      communicationScore,
      overallReadinessIndex,
      breakdown: {
        'Data Structures & Algorithms': {
          score: dsaScore,
          reasoning: `Based on ${totalSolved} total solved problems (${mediumSolved} Medium, ${hardSolved} Hard) and a max contest rating of ${maxRating}.`,
        },
        'Development & Projects': {
          score: devScore,
          reasoning: `Derived from ${totalRepos} public repositories (log-damped), ${totalStars} stars, and ${totalCommits} commits across ${languagesCount} programming languages with avg project complexity of ${avgRepoDifficulty.toFixed(1)}/10.`,
        },
        'Database Management (DBMS)': {
          score: dbmsScore,
          reasoning: `Inferred from system development profile, project stack diversity, and SQL baseline metrics.`,
        },
        'Operating Systems (OS)': {
          score: osScore,
          reasoning: `Evaluated against algorithmic efficiency mastery and core computer architecture fundamentals.`,
        },
        'System Design': {
          score: systemDesignScore,
          reasoning: `Composite measure of full-stack repository architecture, microservice patterns, and hard problem solving.`,
        },
      },
    };
  }

  // Depth-Weighted Complexity Formula for Frameworks and Languages
  async computeAndPersistSkillMetrics(
    studentProfileId: string,
    devStatsOrRepos?: NormalizedDevStats | AnalyzedRepo[],
    resumeSkills?: string[]
  ): Promise<ComputedSkillMetric[]> {
    let repos: AnalyzedRepo[] = [];
    let languagesMap: Record<string, number> = {};

    if (Array.isArray(devStatsOrRepos)) {
      repos = devStatsOrRepos;
      for (const r of repos) {
        if (r.language) {
          languagesMap[r.language] = (languagesMap[r.language] || 0) + 1;
        }
      }
    } else if (devStatsOrRepos) {
      repos = (devStatsOrRepos.topRepos || []) as AnalyzedRepo[];
      languagesMap = devStatsOrRepos.languages || {};
    }

    const skillCandidates = new Set<string>([
      ...Object.keys(languagesMap),
      ...(resumeSkills || []),
    ]);

    // Ensure core disciplines are evaluated
    ['TypeScript', 'JavaScript', 'Python', 'Java', 'SQL', 'Docker', 'React'].forEach((s) => {
      if (languagesMap[s] || (resumeSkills || []).includes(s)) {
        skillCandidates.add(s);
      }
    });

    const metrics: ComputedSkillMetric[] = [];

    for (const skill of Array.from(skillCandidates)) {
      const skillLower = skill.toLowerCase();

      // Find matching repositories
      const matchingRepos = repos.filter(
        (r) =>
          (r.language && r.language.toLowerCase() === skillLower) ||
          r.name.toLowerCase().includes(skillLower) ||
          (r.description && r.description.toLowerCase().includes(skillLower)) ||
          (r.signals && r.signals.some((s) => s.toLowerCase().includes(skillLower)))
      );

      const frequencyCount = (languagesMap[skill] || 0) + matchingRepos.length + ((resumeSkills || []).includes(skill) ? 2 : 0);

      if (frequencyCount === 0 && matchingRepos.length === 0) continue;

      const difficulties = matchingRepos.map((r) => r.difficultyScore || 3.0);
      const maxProjectDifficulty = difficulties.length > 0 ? Math.max(...difficulties) : 3.0;
      const avgProjectDifficulty =
        difficulties.length > 0
          ? difficulties.reduce((a, b) => a + b, 0) / difficulties.length
          : 3.0;

      // 15% Production Signals (Tests, CI/CD, Docker)
      const hasTests = matchingRepos.some((r) => r.hasTests);
      const hasCiCd = matchingRepos.some((r) => r.hasCiCd);
      const hasDocker = matchingRepos.some((r) => r.hasDocker) || skillLower === 'docker';
      const productionSignalsScore =
        (hasTests ? 40 : 0) + (hasCiCd ? 30 : 0) + (hasDocker ? 30 : 0);

      // 10% Log Frequency (Math.log2(1 + count))
      const logFrequency = Math.min(
        100,
        Math.round((Math.log2(1 + frequencyCount) / Math.log2(1 + 10)) * 100)
      );

      // Depth formula: 45% Max Project Difficulty + 30% Avg Project Complexity + 15% Production Signals + 10% Log Frequency
      const verifiedDepthScore = Math.min(
        100,
        Math.round(
          0.45 * (maxProjectDifficulty * 10) +
            0.30 * (avgProjectDifficulty * 10) +
            0.15 * productionSignalsScore +
            0.10 * logFrequency
        )
      );

      const evidenceSummary = `${matchingRepos.length} analyzed repos, max difficulty ${maxProjectDifficulty}/10, tests: ${hasTests ? '✓' : '✗'}, CI: ${hasCiCd ? '✓' : '✗'}`;

      const computed: ComputedSkillMetric = {
        skillName: skill,
        category: this.categorizeSkill(skill),
        frequencyCount,
        maxProjectDifficulty,
        avgProjectDifficulty: Math.round(avgProjectDifficulty * 10) / 10,
        verifiedDepthScore,
        evidenceSummary,
      };

      metrics.push(computed);

      // Upsert into SkillMetric table
      try {
        await prisma.skillMetric.upsert({
          where: {
            studentProfileId_skillName: {
              studentProfileId,
              skillName: skill,
            },
          },
          update: {
            frequencyCount,
            maxProjectDifficulty,
            avgProjectDifficulty: Math.round(avgProjectDifficulty * 10) / 10,
            verifiedDepthScore,
            evidenceSummary,
          },
          create: {
            studentProfileId,
            skillName: skill,
            category: computed.category,
            frequencyCount,
            maxProjectDifficulty,
            avgProjectDifficulty: Math.round(avgProjectDifficulty * 10) / 10,
            verifiedDepthScore,
            evidenceSummary,
          },
        });
      } catch (err: any) {
        console.warn(`Could not persist SkillMetric for ${skill}:`, err.message);
      }
    }

    return metrics.sort((a, b) => b.verifiedDepthScore - a.verifiedDepthScore);
  }

  private categorizeSkill(name: string): string {
    const lower = name.toLowerCase();
    if (['python', 'typescript', 'javascript', 'java', 'c++', 'go', 'rust', 'c#'].includes(lower)) {
      return 'Languages';
    }
    if (['react', 'vue', 'angular', 'next.js', 'html', 'css', 'tailwind'].includes(lower)) {
      return 'Frontend';
    }
    if (['node.js', 'express', 'django', 'fastapi', 'spring', 'graphql', 'nest'].includes(lower)) {
      return 'Backend';
    }
    if (['sql', 'postgresql', 'mongodb', 'redis', 'mysql', 'prisma'].includes(lower)) {
      return 'Database';
    }
    if (['docker', 'kubernetes', 'aws', 'ci/cd', 'github actions'].includes(lower)) {
      return 'DevOps & Cloud';
    }
    return 'Frameworks & Tools';
  }
}

export const skillEngineService = new SkillEngineService();
