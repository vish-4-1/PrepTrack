import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware';
import { connectPlatformSchema } from '../validators';
import { normalizerService } from '../services/normalizer.service';
import { skillEngineService } from '../services/skillEngine.service';
import { grokService } from '../services/grok.service';
import { NormalizedDevStats } from '../types';


const router = Router();
const prisma = new PrismaClient();

// Get Unified Student Profile
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const studentProfileId = req.user?.studentProfileId;
    if (!studentProfileId) {
      return res.status(404).json({ error: 'Student profile not found' });
    }

    const profile = await prisma.studentProfile.findUnique({
      where: { id: studentProfileId },
      include: {
        user: { select: { name: true, email: true, department: true, branch: true, passoutYear: true, onboardingCompleted: true } },
        connections: true,
        gitHubProfile: true,
        codingProfiles: true,
        projects: { orderBy: { difficultyScore: 'desc' } },
        skills: { include: { skill: true } },
        skillMetrics: { orderBy: { verifiedDepthScore: 'desc' } },
        skillSnapshots: { orderBy: { createdAt: 'asc' } },
        actionItems: { orderBy: { priority: 'asc' } },
        projectRecommendations: true,
        aiAnalyses: { orderBy: { analyzedAt: 'desc' }, take: 1 },
        resumeProfile: true,
      },
    });

    if (!profile) {
      return res.status(404).json({ error: 'Profile record missing' });
    }

    return res.json({ profile });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error fetching profile' });
  }
});

// Connect Platform URL
router.post('/connect', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const studentProfileId = req.user?.studentProfileId;
    if (!studentProfileId) {
      return res.status(404).json({ error: 'Student profile not found' });
    }

    const validated = connectPlatformSchema.parse(req.body);
    const isValidUrl = normalizerService.validatePlatformUrl(validated.platform as any, validated.profileUrl);

    if (!isValidUrl) {
      return res.status(400).json({
        error: `Invalid URL format for ${validated.platform}. Please provide a valid public profile URL.`,
      });
    }

    const connection = await prisma.platformConnection.upsert({
      where: {
        studentProfileId_platform: {
          studentProfileId,
          platform: validated.platform,
        },
      },
      update: {
        profileUrl: validated.profileUrl,
        isConnected: true,
        errorState: null,
      },
      create: {
        studentProfileId,
        platform: validated.platform,
        profileUrl: validated.profileUrl,
        isConnected: true,
      },
    });

    return res.json({
      message: `${validated.platform} profile URL connected successfully`,
      connection,
    });
  } catch (err: any) {
    if (err.errors) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    return res.status(500).json({ error: err.message || 'Error connecting profile' });
  }
});

// Synchronize Profiles & Run Engine
router.post('/sync', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const studentProfileId = req.user?.studentProfileId;
    if (!studentProfileId) {
      return res.status(404).json({ error: 'Student profile not found' });
    }

    const connections = await prisma.platformConnection.findMany({
      where: { studentProfileId, isConnected: true },
    });

    if (connections.length === 0) {
      return res.status(400).json({
        error: 'No connected profile URLs found. Please connect your GitHub or LeetCode profile first.',
      });
    }

    const codingStatsList: any[] = [];
    let devStats: any = undefined;

    for (const conn of connections) {
      try {
        const result = await normalizerService.syncPlatform(conn.platform as any, conn.profileUrl);
        await prisma.platformConnection.update({
          where: { id: conn.id },
          data: {
            lastSyncedAt: new Date(),
            errorState: result.error || null,
          },
        });

        if (result.success && result.data) {
          if (conn.platform === 'GITHUB') {
            devStats = result.data as NormalizedDevStats;
            await prisma.gitHubProfile.upsert({
              where: { studentProfileId },
              update: {
                totalRepos: devStats.totalRepos,
                publicRepos: devStats.publicRepos,
                totalStars: devStats.totalStars,
                totalForks: devStats.totalForks,
                totalCommits: devStats.totalCommits,
                prCount: devStats.prCount,
                issueCount: devStats.issueCount,
                languagesJson: JSON.stringify(devStats.languages),
                topReposJson: JSON.stringify(devStats.topRepos),
              },
              create: {
                studentProfileId,
                totalRepos: devStats.totalRepos,
                publicRepos: devStats.publicRepos,
                totalStars: devStats.totalStars,
                totalForks: devStats.totalForks,
                totalCommits: devStats.totalCommits,
                prCount: devStats.prCount,
                issueCount: devStats.issueCount,
                languagesJson: JSON.stringify(devStats.languages),
                topReposJson: JSON.stringify(devStats.topRepos),
              },
            });

            // Persist analyzed repos into the Project table
            if (devStats.topRepos && Array.isArray(devStats.topRepos)) {
              for (const repo of devStats.topRepos) {
                const existingProj = await prisma.project.findFirst({
                  where: { studentProfileId, name: repo.name },
                });
                const projData = {
                  studentProfileId,
                  name: repo.name,
                  description: repo.description || 'GitHub repository project',
                  repoUrl: repo.repoUrl,
                  technologiesJson: JSON.stringify(repo.language ? [repo.language] : []),
                  stars: repo.stars || 0,
                  forks: repo.forks || 0,
                  commitCount: repo.commitCount || 0,
                  architectureTier: repo.architectureTier || 'Basic CRUD',
                  difficultyScore: repo.difficultyScore || 3.0,
                  hasTests: repo.hasTests || false,
                  hasCiCd: repo.hasCiCd || false,
                  hasDocker: repo.hasDocker || false,
                  activityLevel: repo.stars > 5 || repo.commitCount > 20 ? 'HIGH' : 'MEDIUM',
                };

                if (existingProj) {
                  await prisma.project.update({
                    where: { id: existingProj.id },
                    data: projData,
                  });
                } else {
                  await prisma.project.create({
                    data: projData,
                  });
                }
              }
            }
          } else if (['LEETCODE', 'CODECHEF', 'HACKERRANK'].includes(conn.platform)) {
            const codingData = result.data as any;
            codingStatsList.push(codingData);
            await prisma.codingProfile.upsert({
              where: {
                studentProfileId_platform: {
                  studentProfileId,
                  platform: conn.platform,
                },
              },
              update: {
                totalSolved: codingData.totalSolved,
                easySolved: codingData.easySolved,
                mediumSolved: codingData.mediumSolved,
                hardSolved: codingData.hardSolved,
                contestRating: codingData.contestRating,
                globalRank: codingData.globalRank,
                contestsParticipated: codingData.contestsParticipated,
              },
              create: {
                studentProfileId,
                platform: conn.platform,
                totalSolved: codingData.totalSolved,
                easySolved: codingData.easySolved,
                mediumSolved: codingData.mediumSolved,
                hardSolved: codingData.hardSolved,
                contestRating: codingData.contestRating,
                globalRank: codingData.globalRank,
                contestsParticipated: codingData.contestsParticipated,
              },
            });
          }

        }
      } catch (connErr: any) {
        await prisma.platformConnection.update({
          where: { id: conn.id },
          data: { errorState: connErr.message },
        });
      }
    }

    // Run Deterministic Skill Engine
    const calculated = skillEngineService.calculateScores(codingStatsList, devStats, {
      linkedinConnected: connections.some((c) => c.platform === 'LINKEDIN'),
    });

    // Update Placement Readiness Index
    await prisma.studentProfile.update({
      where: { id: studentProfileId },
      data: { placementReadiness: calculated.overallReadinessIndex },
    });

    // Recompute and persist SkillMetrics with depth-weighted scoring
    const existingResumeProf = await prisma.resumeProfile.findUnique({
      where: { studentProfileId },
    });
    const parsedSkills = existingResumeProf?.extractedSkillsJson ? JSON.parse(existingResumeProf.extractedSkillsJson) : [];
    const parsedProjects = existingResumeProf?.extractedProjectsJson ? JSON.parse(existingResumeProf.extractedProjectsJson) : [];

    await skillEngineService.computeAndPersistSkillMetrics(
      studentProfileId,
      devStats?.topRepos || [],
      parsedSkills
    );

    // Store Skill Snapshot for Track Record
    const monthKey = new Date().toISOString().slice(0, 7); // e.g. "2026-08"
    await prisma.skillSnapshot.create({
      data: {
        studentProfileId,
        snapshotMonth: monthKey,
        dsaScore: calculated.dsaScore,
        devScore: calculated.devScore,
        dbmsScore: calculated.dbmsScore,
        osScore: calculated.osScore,
        overallScore: calculated.overallReadinessIndex,
      },
    });

    // Run Grok AI Service Analysis
    const studentUser = await prisma.user.findFirst({
      where: { studentProfile: { id: studentProfileId } },
    });

    const normalizedProfileForGrok: any = {
      identity: {
        name: studentUser?.name || 'Student',
        username: 'student',
        email: studentUser?.email || '',
      },
      coding: {
        combinedTotalSolved: codingStatsList.reduce((acc, c) => acc + (c.totalSolved || 0), 0),
        combinedContestRatingMax: codingStatsList.reduce((max, c) => Math.max(max, c.contestRating || 0), 0),
      },
      development: devStats || {
        totalRepos: 0,
        publicRepos: 0,
        totalStars: 0,
        totalForks: 0,
        totalCommits: 0,
        prCount: 0,
        issueCount: 0,
        languages: {},
        topRepos: [],
      },
      skills: Object.entries(calculated.breakdown).map(([name, val]) => ({
        category: 'Technical',
        name,
        score: val.score,
        verifiedBy: 'DETERMINISTIC_TELEMETRY',
      })),
      placementReadinessIndex: calculated.overallReadinessIndex,
    };

    const aiAnalysis = await grokService.analyzeProfile(normalizedProfileForGrok);

    // Save AI Analysis in Database
    await prisma.aIAnalysis.create({
      data: {
        studentProfileId,
        rawInputJson: JSON.stringify(normalizedProfileForGrok),
        structuredOutputJson: JSON.stringify(aiAnalysis),
        readinessScore: aiAnalysis.placementReadiness,
      },
    });

    // Populate/Update Action Items from AI recommendations
    if (aiAnalysis.recommendedActions && aiAnalysis.recommendedActions.length > 0) {
      // Clear old uncompleted action items for fresh syncing
      await prisma.actionItem.deleteMany({
        where: { studentProfileId, completed: false },
      });

      for (const act of aiAnalysis.recommendedActions) {
        await prisma.actionItem.create({
          data: {
            studentProfileId,
            title: act.title,
            category: act.category,
            priority: act.priority,
            estimatedHours: act.estimatedHours,
            reason: act.reason,
            completed: false,
          },
        });
      }
    }

    // Populate Project Recommendations
    if (aiAnalysis.projectIdeas && aiAnalysis.projectIdeas.length > 0) {
      await prisma.projectRecommendation.deleteMany({
        where: { studentProfileId },
      });

      for (const proj of aiAnalysis.projectIdeas) {
        await prisma.projectRecommendation.create({
          data: {
            studentProfileId,
            title: proj.title,
            problemStatement: proj.problemStatement,
            whySuited: proj.whySuited,
            technologiesJson: JSON.stringify(proj.technologies),
            skillsDevelopedJson: JSON.stringify(proj.skillsDeveloped),
            difficulty: proj.difficulty,
            estimatedDuration: proj.estimatedDuration,
            milestonesJson: JSON.stringify(proj.milestones),
          },
        });
      }
    }

    return res.json({
      message: 'Profile synchronization and Grok AI analysis completed successfully',
      placementReadiness: calculated.overallReadinessIndex,
      calculated,
      aiAnalysis,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Synchronization failed' });
  }
});

// Complete Onboarding with Resume Parsing & Initial Handles
router.post('/onboarding-complete', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const studentProfileId = req.user?.studentProfileId;
    const userId = req.user?.id;
    if (!studentProfileId || !userId) {
      return res.status(404).json({ error: 'User or student profile not found' });
    }

    const { resumeText, resumeFileName, targetRole, handles } = req.body;

    let parsedResume: any = null;
    if (resumeText && typeof resumeText === 'string' && resumeText.trim().length > 0) {
      parsedResume = await grokService.parseResume(resumeText.trim());

      // Save to ResumeProfile
      await prisma.resumeProfile.upsert({
        where: { studentProfileId },
        update: {
          rawText: resumeText,
          extractedSkillsJson: JSON.stringify(parsedResume.extractedSkills),
          extractedProjectsJson: JSON.stringify(parsedResume.extractedProjects),
          experienceSummary: parsedResume.experienceSummary,
        },
        create: {
          studentProfileId,
          rawText: resumeText,
          extractedSkillsJson: JSON.stringify(parsedResume.extractedSkills),
          extractedProjectsJson: JSON.stringify(parsedResume.extractedProjects),
          experienceSummary: parsedResume.experienceSummary,
        },
      });

      // Persist projects extracted from resume
      for (const proj of parsedResume.extractedProjects) {
        const existing = await prisma.project.findFirst({
          where: { studentProfileId, name: proj.name },
        });
        const projData = {
          studentProfileId,
          name: proj.name,
          description: proj.description,
          technologiesJson: JSON.stringify(proj.technologies || []),
          architectureTier: proj.architectureTier,
          difficultyScore: proj.difficultyScore,
          hasTests: proj.hasTests,
          hasCiCd: proj.hasCiCd,
          hasDocker: proj.hasDocker,
          activityLevel: 'HIGH',
        };
        if (existing) {
          await prisma.project.update({ where: { id: existing.id }, data: projData });
        } else {
          await prisma.project.create({ data: projData });
        }
      }

      // Compute and persist SkillMetric records
      await skillEngineService.computeAndPersistSkillMetrics(
        studentProfileId,
        parsedResume.extractedProjects.map((p: any) => ({
          name: p.name,
          description: p.description,
          repoUrl: '',
          stars: 0,
          forks: 0,
          language: p.technologies?.[0] || 'TypeScript',
          commitCount: 15,
          hasTests: p.hasTests,
          hasCiCd: p.hasCiCd,
          hasDocker: p.hasDocker,
          architectureTier: p.architectureTier,
          difficultyScore: p.difficultyScore,
        })),
        parsedResume.extractedSkills
      );
    }

    // Connect handles if provided
    if (handles && typeof handles === 'object') {
      const platformMap: Record<string, string> = {
        github: 'GITHUB',
        leetcode: 'LEETCODE',
        codechef: 'CODECHEF',
        hackerrank: 'HACKERRANK',
        linkedin: 'LINKEDIN',
      };

      for (const [key, rawUrl] of Object.entries(handles)) {
        if (!rawUrl || typeof rawUrl !== 'string') continue;
        const platform = platformMap[key.toLowerCase()];
        if (!platform) continue;

        let formattedUrl = rawUrl.trim();
        if (!formattedUrl.startsWith('http')) {
          if (platform === 'GITHUB') formattedUrl = `https://github.com/${formattedUrl}`;
          else if (platform === 'LEETCODE') formattedUrl = `https://leetcode.com/${formattedUrl}`;
          else if (platform === 'CODECHEF') formattedUrl = `https://www.codechef.com/users/${formattedUrl}`;
          else if (platform === 'HACKERRANK') formattedUrl = `https://www.hackerrank.com/${formattedUrl}`;
          else if (platform === 'LINKEDIN') formattedUrl = `https://www.linkedin.com/in/${formattedUrl}`;
        }

        await prisma.platformConnection.upsert({
          where: { studentProfileId_platform: { studentProfileId, platform } },
          update: { profileUrl: formattedUrl, isConnected: true, errorState: null },
          create: { studentProfileId, platform, profileUrl: formattedUrl, isConnected: true },
        });
      }
    }

    // Mark onboarding completed on User model
    await prisma.user.update({
      where: { id: userId },
      data: { onboardingCompleted: true },
    });

    if (targetRole || resumeFileName || parsedResume) {
      await prisma.studentProfile.update({
        where: { id: studentProfileId },
        data: {
          targetRole: targetRole || undefined,
          resumeUrl: resumeFileName ? `uploaded://${resumeFileName}` : undefined,
          summary: parsedResume?.experienceSummary || undefined,
          placementReadiness: parsedResume?.placementReadiness || undefined,
        },
      });
    }

    return res.json({
      success: true,
      message: 'Onboarding completed successfully',
      onboardingCompleted: true,
      parsedResume,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Onboarding processing failed' });
  }
});

// Upload & Parse Resume Document (Live DB Persisted)
router.post('/resume', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const studentProfileId = req.user?.studentProfileId;
    if (!studentProfileId) {
      return res.status(404).json({ error: 'Student profile not found' });
    }

    const { fileName, fileData, fileSize, rawText } = req.body;
    if (!fileName && !rawText) {
      return res.status(400).json({ error: 'File name or resume text is required' });
    }

    const textToParse = rawText || `Resume of candidate containing technical skills, projects and experience for ${fileName}`;
    const parsed = await grokService.parseResume(textToParse);

    const resumeUrl = fileData ? `uploaded://${fileName}` : `https://preptrack.internal/resumes/${studentProfileId}/${encodeURIComponent(fileName || 'resume.txt')}`;

    // Persist to ResumeProfile
    await prisma.resumeProfile.upsert({
      where: { studentProfileId },
      update: {
        rawText: textToParse,
        extractedSkillsJson: JSON.stringify(parsed.extractedSkills),
        extractedProjectsJson: JSON.stringify(parsed.extractedProjects),
        experienceSummary: parsed.experienceSummary,
      },
      create: {
        studentProfileId,
        rawText: textToParse,
        extractedSkillsJson: JSON.stringify(parsed.extractedSkills),
        extractedProjectsJson: JSON.stringify(parsed.extractedProjects),
        experienceSummary: parsed.experienceSummary,
      },
    });

    // Persist extracted projects
    for (const proj of parsed.extractedProjects) {
      const existing = await prisma.project.findFirst({
        where: { studentProfileId, name: proj.name },
      });
      const projData = {
        studentProfileId,
        name: proj.name,
        description: proj.description,
        technologiesJson: JSON.stringify(proj.technologies || []),
        architectureTier: proj.architectureTier,
        difficultyScore: proj.difficultyScore,
        hasTests: proj.hasTests,
        hasCiCd: proj.hasCiCd,
        hasDocker: proj.hasDocker,
        activityLevel: 'HIGH',
      };
      if (existing) {
        await prisma.project.update({ where: { id: existing.id }, data: projData });
      } else {
        await prisma.project.create({ data: projData });
      }
    }

    // Compute & persist SkillMetric
    await skillEngineService.computeAndPersistSkillMetrics(
      studentProfileId,
      parsed.extractedProjects.map((p: any) => ({
        name: p.name,
        description: p.description,
        repoUrl: '',
        stars: 0,
        forks: 0,
        language: p.technologies?.[0] || 'TypeScript',
        commitCount: 15,
        hasTests: p.hasTests,
        hasCiCd: p.hasCiCd,
        hasDocker: p.hasDocker,
        architectureTier: p.architectureTier,
        difficultyScore: p.difficultyScore,
      })),
      parsed.extractedSkills
    );

    // Update StudentProfile
    const updatedProfile = await prisma.studentProfile.update({
      where: { id: studentProfileId },
      data: {
        resumeUrl,
        summary: parsed.experienceSummary,
        placementReadiness: parsed.placementReadiness,
      },
    });

    return res.json({
      success: true,
      message: `Resume parsed and persisted successfully`,
      resume: {
        fileName: fileName || 'resume.txt',
        fileSize: fileSize || '1.0 MB',
        resumeUrl,
        uploadedAt: new Date().toISOString(),
        extractedSkills: parsed.extractedSkills,
        parsedProjects: parsed.extractedProjects,
        experienceSummary: parsed.experienceSummary,
      },
      profile: updatedProfile,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Resume processing failed' });
  }
});

// Get Live Resume Details
router.get('/resume', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const studentProfileId = req.user?.studentProfileId;
    if (!studentProfileId) {
      return res.status(404).json({ error: 'Student profile not found' });
    }

    const [profile, resumeProfile] = await Promise.all([
      prisma.studentProfile.findUnique({
        where: { id: studentProfileId },
        select: { resumeUrl: true, summary: true, updatedAt: true },
      }),
      prisma.resumeProfile.findUnique({
        where: { studentProfileId },
      }),
    ]);

    if (!profile?.resumeUrl && !resumeProfile) {
      return res.json({ hasResume: false, resume: null });
    }

    const fileName = profile?.resumeUrl
      ? decodeURIComponent(profile.resumeUrl.split('/').pop()?.replace('uploaded://', '') || 'resume.pdf')
      : 'Uploaded_Resume.txt';

    const extractedSkills = resumeProfile ? JSON.parse(resumeProfile.extractedSkillsJson || '[]') : [];
    const parsedProjects = resumeProfile ? JSON.parse(resumeProfile.extractedProjectsJson || '[]') : [];

    return res.json({
      hasResume: true,
      resume: {
        fileName,
        resumeUrl: profile?.resumeUrl || null,
        uploadedAt: resumeProfile?.updatedAt || profile?.updatedAt || new Date().toISOString(),
        summary: resumeProfile?.experienceSummary || profile?.summary || null,
        extractedSkills,
        parsedProjects,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to retrieve resume details' });
  }
});

export default router;

