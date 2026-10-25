import { PrismaClient } from '@prisma/client';
import { agentService } from '../agent/agent.service';

const prisma = new PrismaClient();

async function runDemo() {
  const targetUsername = process.env.TEST_USERNAME || process.argv[2];

  if (!targetUsername) {
    console.log('\n[Notice] No target username provided via CLI or TEST_USERNAME env variable.');
    console.log('Usage: npx ts-node src/__tests__/runAgentDemo.ts <target_username>');
    console.log('Defaulting to candidate identifier: "demo_candidate"\n');
  }

  const effectiveUsername = targetUsername || 'demo_candidate';
  const effectiveEmail = `${effectiveUsername}@university.edu`;
  const effectiveName = effectiveUsername.replace(/[-_.]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  console.log('===============================================================');
  console.log('       PREPTALK AI PLACEMENT COACH - LIVE AGENT DEMO          ');
  console.log(`       Candidate: ${effectiveName} (${effectiveEmail})`);
  console.log('===============================================================\n');

  // Ensure a student profile exists in SQLite
  let user = await prisma.user.findFirst({
    where: { email: effectiveEmail },
    include: { studentProfile: true },
  });

  if (!user || !user.studentProfile) {
    console.log(`Creating student candidate profile: ${effectiveName}...`);
    user = await prisma.user.create({
      data: {
        email: effectiveEmail,
        password: 'demopassword123',
        name: effectiveName,
        role: 'STUDENT',
        department: 'Computer Science & Engineering',
        branch: 'B.E. Computer Science',
        passoutYear: 2027,
        studentProfile: {
          create: {
            username: effectiveUsername,
            placementReadiness: 74,
            targetRole: 'Software Development Engineer',
            summary: 'Strong algorithmic foundation, aiming for Tier-1 product placement.',
            codingProfiles: {
              create: [
                { platform: 'CODECHEF', totalSolved: 185, easySolved: 90, mediumSolved: 75, hardSolved: 20, contestRating: 1742, globalRank: 18200, contestsParticipated: 22 },
                { platform: 'HACKERRANK', totalSolved: 140, easySolved: 80, mediumSolved: 50, hardSolved: 10, contestRating: 1540, globalRank: 52000, contestsParticipated: 8 },
                { platform: 'LEETCODE', totalSolved: 43, easySolved: 25, mediumSolved: 15, hardSolved: 3, contestRating: 1620, globalRank: 65000, contestsParticipated: 6 },
              ],
            },
            gitHubProfile: {
              create: {
                totalRepos: 6,
                publicRepos: 6,
                totalStars: 14,
                totalForks: 5,
                totalCommits: 145,
                prCount: 8,
                issueCount: 3,
                languagesJson: JSON.stringify({ TypeScript: 4, Java: 3, Python: 2, 'C++': 1 }),
                topReposJson: JSON.stringify([
                  { name: 'algo-visualizer', description: 'Interactive graph and tree algorithm solver', stars: 6, forks: 2, language: 'TypeScript', commitCount: 38 },
                ]),
              },
            },
            skillSnapshots: {
              create: [
                { snapshotMonth: '2026-05', dsaScore: 68, devScore: 60, dbmsScore: 58, osScore: 56, overallScore: 62 },
                { snapshotMonth: '2026-06', dsaScore: 72, devScore: 65, dbmsScore: 62, osScore: 61, overallScore: 67 },
                { snapshotMonth: '2026-07', dsaScore: 76, devScore: 71, dbmsScore: 67, osScore: 68, overallScore: 72 },
                { snapshotMonth: '2026-08', dsaScore: 82, devScore: 78, dbmsScore: 72, osScore: 70, overallScore: 78 },
              ],
            },
          },
        },
      },
      include: { studentProfile: true },
    });
  }

  const profileId = user.studentProfile!.id;
  console.log(`Student Profile Active: ${user.name} (ID: ${profileId})\n`);

  // Scenario 1: "What should I focus on this week?"
  console.log('---------------------------------------------------------------');
  console.log('SCENARIO 1: Student Prompt: "What should I focus on this week?"');
  console.log('---------------------------------------------------------------');
  console.log('Agent starting Observe -> Reason -> Act loop...\n');

  const response1 = await agentService.processChat(profileId, 'What should I focus on this week?');

  console.log('>>> AGENT EXECUTION TRACE:');
  response1.toolCalls.forEach((tc) => {
    console.log(`  [TOOL] ${tc.toolName} -> ${tc.description} (${tc.success ? 'SUCCESS' : 'FAILED'})`);
  });

  console.log('\n>>> AGENT FINAL RESPONSE:');
  console.log(response1.message);

  if (response1.plan) {
    console.log('\n>>> STRATEGIC LEARNING PLAN GENERATED:');
    console.log(`Goal: ${response1.plan.goal}`);
    console.log(`Duration: ${response1.plan.durationDays} Days`);
    console.log('Priorities:');
    response1.plan.priorities.forEach((p) => console.log(`  - [${p.priority}] ${p.skill}: ${p.reason}`));
    console.log('Daily Schedule:');
    response1.plan.dailyPlan.slice(0, 3).forEach((d) => console.log(`  - Day ${d.day} (${d.focusArea}): ${d.tasks.join('; ')}`));
  }

  // Scenario 2: "Prepare me for Amazon SDE placement drive"
  console.log('\n---------------------------------------------------------------');
  console.log('SCENARIO 2: Student Prompt: "Prepare me for Amazon SDE placement drive"');
  console.log('---------------------------------------------------------------');

  const response2 = await agentService.processChat(profileId, 'Prepare me for Amazon SDE placement drive');

  console.log('>>> AGENT EXECUTION TRACE:');
  response2.toolCalls.forEach((tc) => {
    console.log(`  [TOOL] ${tc.toolName} -> ${tc.description} (${tc.success ? 'SUCCESS' : 'FAILED'})`);
  });

  console.log('\n>>> AGENT FINAL RESPONSE:');
  console.log(response2.message);

  // Scenario 3: Apply plan to Action Center
  if (response1.plan) {
    console.log('\n---------------------------------------------------------------');
    console.log('SCENARIO 3: Applying Strategic Plan to Student Action Center');
    console.log('---------------------------------------------------------------');
    const applyRes = await agentService.applyPlanTasksToActionCenter(profileId, response1.plan);
    console.log(`Successfully created ${applyRes.count} actionable tasks in Action Center database!`);
  }

  console.log('\n===============================================================');
  console.log('                 DEMO EXECUTION COMPLETED                      ');
  console.log('===============================================================');
}

runDemo().catch((err) => {
  console.error('Demo encountered an error:', err);
});
