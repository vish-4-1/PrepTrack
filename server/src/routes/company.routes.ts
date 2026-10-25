import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware';
import { skillEngineService } from '../services/skillEngine.service';
import { scoringConfig } from '../config/scoring.config';
import { NormalizedCodingStats, NormalizedDevStats } from '../types';

const router = Router();
const prisma = new PrismaClient();

// Get Target Companies
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const companies = await prisma.targetCompany.findMany({
      include: { requirements: true },
    });

    const parsedCompanies = companies.map((c) => ({
      ...c,
      targetRoles: JSON.parse(c.targetRolesJson || '[]'),
      requirements: c.requirements.map((r) => ({
        ...r,
        topics: JSON.parse(r.topicsJson || '[]'),
      })),
    }));

    return res.json({ companies: parsedCompanies });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch companies' });
  }
});

// Helper to map skill requirement names to student skill dimensions
function resolveStudentScore(skillName: string, scores: ReturnType<typeof skillEngineService.calculateScores>): number {
  const lower = skillName.toLowerCase();
  if (lower.includes('dsa') || lower.includes('algorithm') || lower.includes('data structure') || lower.includes('coding')) {
    return scores.dsaScore;
  }
  if (lower.includes('dbms') || lower.includes('database') || lower.includes('sql')) {
    return scores.dbmsScore;
  }
  if (lower.includes('os') || lower.includes('operating system') || lower.includes('linux')) {
    return scores.osScore;
  }
  if (lower.includes('system design') || lower.includes('distributed') || lower.includes('architecture')) {
    return scores.systemDesignScore;
  }
  if (lower.includes('dev') || lower.includes('full-stack') || lower.includes('project') || lower.includes('backend') || lower.includes('web')) {
    return scores.devScore;
  }
  if (lower.includes('git') || lower.includes('version control') || lower.includes('ci/cd')) {
    return scores.gitScore;
  }
  if (lower.includes('network')) {
    return scores.networksScore;
  }
  if (lower.includes('oop') || lower.includes('object oriented')) {
    return scores.oopScore;
  }
  return scores.overallReadinessIndex;
}

// Get Company Readiness for Current Student with True Multi-Dimensional Skill Vector Comparison
router.get('/:id/readiness', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const studentProfileId = req.user?.studentProfileId;
    const id = req.params.id as string;

    if (!studentProfileId) {
      return res.status(404).json({ error: 'Student profile not found' });
    }

    const company = await prisma.targetCompany.findUnique({
      where: { id },
      include: { requirements: true },
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const profile = await prisma.studentProfile.findUnique({
      where: { id: studentProfileId },
      include: {
        codingProfiles: true,
        gitHubProfile: true,
        skills: { include: { skill: true } },
      },
    });

    const codingStats: NormalizedCodingStats[] = (profile?.codingProfiles || []).map((cp) => ({
      totalSolved: cp.totalSolved,
      easySolved: cp.easySolved,
      mediumSolved: cp.mediumSolved,
      hardSolved: cp.hardSolved,
      contestRating: cp.contestRating,
      globalRank: cp.globalRank,
      contestsParticipated: cp.contestsParticipated,
    }));

    let devStats: NormalizedDevStats | undefined = undefined;
    if (profile?.gitHubProfile) {
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

    let totalWeightedScore = 0;
    let totalWeight = 0;
    const missingSkills: any[] = [];
    const skillBreakdown: any[] = [];

    const requirements = (company as any).requirements || [];
    const priorityWeights = scoringConfig.companyReadiness.priorityWeights;

    requirements.forEach((req: any) => {
      const studentScore = resolveStudentScore(req.skillName, scores);
      const weight = (priorityWeights as any)[req.priority] || 1.0;
      
      const matchPct = Math.min(100, Math.round((studentScore / req.minScore) * 100));
      const isMet = studentScore >= req.minScore;

      totalWeightedScore += Math.min(100, (studentScore / req.minScore) * 100) * weight;
      totalWeight += weight;

      const topics = JSON.parse(req.topicsJson || '[]');

      skillBreakdown.push({
        skillName: req.skillName,
        requiredScore: req.minScore,
        studentScore,
        matchPercentage: matchPct,
        priority: req.priority,
        isMet,
        topics,
      });

      if (!isMet) {
        missingSkills.push({
          skillName: req.skillName,
          minScore: req.minScore,
          studentScore,
          gap: req.minScore - studentScore,
          priority: req.priority,
          topics,
        });
      }
    });

    const readinessScore = totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : scores.overallReadinessIndex;
    const thresholds = scoringConfig.companyReadiness.thresholds;
    const status = readinessScore >= thresholds.ready ? 'READY' : readinessScore >= thresholds.moderate ? 'MODERATE' : 'NEEDS_WORK';

    const recommendedActions: string[] = [];
    if (missingSkills.length > 0) {
      missingSkills.slice(0, 3).forEach((gap) => {
        recommendedActions.push(
          `Close ${gap.skillName} gap (+${gap.gap} pts needed): Practice ${gap.topics.slice(0, 2).join(' & ')} to meet ${company.name}'s benchmark.`
        );
      });
    } else {
      recommendedActions.push(`Maintain strong benchmark standing for ${company.name} across DSA and system architecture.`);
      recommendedActions.push(`Perform timed behavioral & system design mock rounds targeted for ${company.name} interview loops.`);
    }

    try {
      await prisma.companyReadiness.upsert({
        where: {
          studentProfileId_companyId: {
            studentProfileId,
            companyId: company.id,
          },
        },
        update: {
          readinessScore,
          status,
          missingSkillsJson: JSON.stringify(missingSkills),
          recommendedActionsJson: JSON.stringify(recommendedActions),
        },
        create: {
          studentProfileId,
          companyId: company.id,
          readinessScore,
          status,
          missingSkillsJson: JSON.stringify(missingSkills),
          recommendedActionsJson: JSON.stringify(recommendedActions),
        },
      });
    } catch {
      // Ignore background persistence errors in read route
    }

    return res.json({
      company: {
        ...company,
        targetRoles: JSON.parse(company.targetRolesJson || '[]'),
      },
      readinessScore,
      status,
      skillBreakdown,
      missingSkills,
      recommendedActions,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to compute company readiness' });
  }
});

export default router;
