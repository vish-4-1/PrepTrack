import { normalizerService } from '../services/normalizer.service';
import { skillEngineService } from '../services/skillEngine.service';
import { grokService } from '../services/grok.service';

async function syncTargetProfile() {
  const targetUsername = process.env.TEST_USERNAME || process.argv[2];

  if (!targetUsername) {
    console.error('\n[Error] Missing target username parameter.');
    console.log('Usage: npx ts-node src/__tests__/syncVishalKumarD.ts <target_username>');
    console.log('   or: TEST_USERNAME=<target_username> npx ts-node src/__tests__/syncVishalKumarD.ts\n');
    process.exit(1);
  }

  console.log(`\n======================================================`);
  console.log(`Synchronizing Public Telemetry for: ${targetUsername}`);
  console.log(`======================================================\n`);

  const urls = {
    GITHUB: `https://github.com/${targetUsername}`,
    HACKERRANK: `https://www.hackerrank.com/profile/${targetUsername}`,
    LEETCODE: `https://leetcode.com/u/${targetUsername}`,
    CODECHEF: `https://www.codechef.com/users/${targetUsername}`,
    LINKEDIN: `https://linkedin.com/in/${targetUsername}`,
  };

  const codingStatsList: any[] = [];
  let devStats: any = undefined;

  for (const [platform, url] of Object.entries(urls)) {
    try {
      console.log(`Syncing ${platform}: ${url}...`);
      const result = await normalizerService.syncPlatform(platform as any, url);
      console.log(`Result (${platform}): success=${result.success}`);

      if (result.success && result.data) {
        if (platform === 'GITHUB') {
          devStats = result.data;
          console.log(`GitHub Repos: ${devStats.publicRepos}, Commits: ${devStats.totalCommits}, Stars: ${devStats.totalStars}`);
        } else if (['LEETCODE', 'CODECHEF', 'HACKERRANK'].includes(platform)) {
          const cData = result.data as any;
          codingStatsList.push(cData);
          console.log(`${platform} Solved: ${cData.totalSolved}, Rating: ${cData.contestRating}`);
        }
      }
    } catch (err: any) {
      console.log(`Platform ${platform} notice:`, err.message);
    }
  }

  // Calculate Deterministic Skill Math
  const calculated = skillEngineService.calculateScores(codingStatsList, devStats, {
    linkedinConnected: true,
  });

  console.log(`\n------------------------------------------------------`);
  console.log(`Placement Readiness Index for ${targetUsername}: ${calculated.overallReadinessIndex}/100`);
  console.log(`DSA Score: ${calculated.dsaScore}/100`);
  console.log(`Dev Score: ${calculated.devScore}/100`);
  console.log(`DBMS Score: ${calculated.dbmsScore}/100`);
  console.log(`OS Score: ${calculated.osScore}/100`);
  console.log(`------------------------------------------------------\n`);

  const normalizedProfileForGroq: any = {
    identity: {
      name: targetUsername,
      username: targetUsername,
      email: `${targetUsername}@test.university.edu`,
      department: 'Computer Science & Engineering',
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
      verifiedBy: 'TELEMETRY',
    })),
    placementReadinessIndex: calculated.overallReadinessIndex,
  };

  console.log('Sending Telemetry to Configured LLM API...');
  const aiAnalysis = await grokService.analyzeProfile(normalizedProfileForGroq, 'Amazon');

  console.log('\n======================================================');
  console.log(`LIVE ANALYSIS FOR ${targetUsername.toUpperCase()}`);
  console.log('======================================================');
  console.log('Executive Summary:\n', aiAnalysis.summary);
  console.log('\nKey Strengths:\n', aiAnalysis.strengths);
  console.log('\nKey Weaknesses:\n', aiAnalysis.weaknesses);
  console.log('\nRecommended Priority Next Actions:\n', aiAnalysis.recommendedActions);
  console.log('\nPersonalized "Build Next" Project Ideas:\n', aiAnalysis.projectIdeas);
  console.log('======================================================\n');
}

syncTargetProfile().catch(console.error);
