import { describe, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { agentService } from '../agent/agent.service';

const prisma = new PrismaClient();

describe('Live Preptalk AI Placement Coach Demo', () => {
  it('runs complete multi-scenario agent demonstration', async () => {
    console.log('\n===============================================================');
    console.log('       PREPTALK AI PLACEMENT COACH - LIVE AGENT DEMO          ');
    console.log('===============================================================\n');

    const demoEmail = `test_agent_demo_${Date.now()}@university.edu`;

    // 1. Seed candidate
    const user = await prisma.user.create({
      data: {
        email: demoEmail,
        password: 'demopassword123',
        name: 'Demo Candidate',
        role: 'STUDENT',
        department: 'Computer Science & Engineering',
        branch: 'B.E. Computer Science',
        passoutYear: 2027,
        studentProfile: {
          create: {
            username: `demo_user_${Date.now()}`,
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
                  { name: 'algo-visualizer', description: 'Interactive algorithm solver', stars: 6, forks: 2, language: 'TypeScript', commitCount: 38 },
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

    const profileId = user.studentProfile!.id;
    console.log(`Student Profile Active: ${user.name} (PRI: 74/100, Department: ${user.department})\n`);

    // Scenario 1: Strategic advice
    console.log('---------------------------------------------------------------');
    console.log('SCENARIO 1: Student Prompt: "What should I focus on this week?"');
    console.log('---------------------------------------------------------------');

    const res1 = await agentService.processChat(profileId, 'What should I focus on this week?');
    console.log('>>> AGENT TOOL TRACE:');
    res1.toolCalls.forEach((tc) => {
      console.log(`  [TOOL] ${tc.toolName} -> ${tc.description} (${tc.success ? 'SUCCESS' : 'FAILED'})`);
    });

    console.log('\n>>> AGENT STRATEGIC ASSESSMENT:');
    console.log(res1.message);

    if (res1.plan) {
      console.log('\n>>> GENERATED 7-DAY LEARNING PLAN:');
      console.log(`Goal: ${res1.plan.goal}`);
      console.log('Priorities:');
      res1.plan.priorities.forEach((p) => console.log(`  - [${p.priority}] ${p.skill}: ${p.reason}`));
      console.log('Daily Tasks:');
      res1.plan.dailyPlan.forEach((d) => console.log(`  - Day ${d.day} (${d.focusArea}): ${d.tasks.join(' | ')} (~${d.estimatedHours}h)`));
    }

    // Scenario 2: Amazon Target Prep
    console.log('\n---------------------------------------------------------------');
    console.log('SCENARIO 2: Student Prompt: "Prepare me for Amazon SDE placement"');
    console.log('---------------------------------------------------------------');

    const res2 = await agentService.processChat(profileId, 'Prepare me for Amazon SDE placement');
    console.log('>>> AGENT TOOL TRACE:');
    res2.toolCalls.forEach((tc) => {
      console.log(`  [TOOL] ${tc.toolName} -> ${tc.description} (${tc.success ? 'SUCCESS' : 'FAILED'})`);
    });

    console.log('\n>>> AGENT COMPANY READINESS PLAN:');
    console.log(res2.message);

    // Scenario 3: Apply plan to Action Center
    if (res1.plan) {
      console.log('\n---------------------------------------------------------------');
      console.log('SCENARIO 3: Transferring Plan to Action Center');
      console.log('---------------------------------------------------------------');
      const applyRes = await agentService.applyPlanTasksToActionCenter(profileId, res1.plan);
      console.log(`Transferred ${applyRes.count} strategic tasks into candidate Action Center!`);
    }

    console.log('\n===============================================================');
    console.log('                 DEMO COMPLETED SUCCESSFULLY                   ');
    console.log('===============================================================\n');

    // Cleanup
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  });
});
