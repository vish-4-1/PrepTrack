import React, { useState, useEffect } from 'react';
import {
  Code,
  GitBranch,
  Target,
  Award,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Sparkles,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { StudentProfile } from '../types';
import { StatCard } from '../components/ui/StatCard';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Badge } from '../components/ui/Badge';
import { Link } from 'react-router-dom';
import { profileApi } from '../services/api';

interface DashboardProps {
  profile: StudentProfile | null;
  onSync: () => void;
  isSyncing: boolean;
  isLoading?: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({
  profile: initialProfile,
  onSync,
  isSyncing,
  isLoading: initialLoading,
}) => {
  const [profile, setProfile] = useState<StudentProfile | null>(initialProfile);
  const [isLoading, setIsLoading] = useState<boolean>(initialLoading ?? !initialProfile);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialProfile) {
      setProfile(initialProfile);
      setIsLoading(false);
      return;
    }

    const fetchLiveProfile = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await profileApi.getProfile();
        setProfile(data.profile);
      } catch (err: any) {
        setError(err.response?.data?.error || err.message || 'Failed to load profile telemetry');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLiveProfile();
  }, [initialProfile]);

  if (isLoading && !profile) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
        <div className="h-24 bg-white border border-[#E5E7EB] rounded-lg p-6"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-white border border-[#E5E7EB] rounded-lg"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-72 bg-white border border-[#E5E7EB] rounded-lg"></div>
          <div className="h-72 bg-white border border-[#E5E7EB] rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg p-12 text-center space-y-4 shadow-xs max-w-xl mx-auto mt-8">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-base font-bold text-[#1F2937]">Unable to Connect to Telemetry Engine</h2>
        <p className="text-xs text-[#6B7280]">{error}</p>
        <button
          onClick={onSync}
          disabled={isSyncing}
          className="inline-flex items-center space-x-2 bg-[#374151] hover:bg-[#1F2937] text-white text-xs font-semibold px-4 py-2 rounded transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>Retry Connection</span>
        </button>
      </div>
    );
  }

  const studentName = profile?.user?.name || 'Student Candidate';
  const readiness = profile?.placementReadiness !== undefined ? Math.round(profile.placementReadiness) : 0;

  const codingProfiles = profile?.codingProfiles || [];
  const codingTotal = codingProfiles.reduce((acc, c) => acc + (c.totalSolved || 0), 0);
  const leetcode = codingProfiles.find((c) => c.platform === 'LEETCODE');
  const github = profile?.gitHubProfile;

  const easySolved = codingProfiles.reduce((acc, c) => acc + (c.easySolved || 0), 0);
  const mediumSolved = codingProfiles.reduce((acc, c) => acc + (c.mediumSolved || 0), 0);
  const hardSolved = codingProfiles.reduce((acc, c) => acc + (c.hardSolved || 0), 0);

  const maxRating = codingProfiles.reduce((max, c) => Math.max(max, Math.round(c.contestRating || 0)), 0);
  const latestSnapshot =
    profile?.skillSnapshots && profile.skillSnapshots.length > 0
      ? profile.skillSnapshots[profile.skillSnapshots.length - 1]
      : null;

  const hasData = codingTotal > 0 || (github?.publicRepos || 0) > 0 || (profile?.connections || []).some((c) => c.isConnected);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] p-6 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-[#1F2937]">Welcome, {studentName}</h1>
          <p className="text-xs text-[#6B7280] mt-1">Here is where your placement preparation stands today.</p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            to="/actions"
            className="bg-[#374151] hover:bg-[#1F2937] text-white text-xs font-semibold px-4 py-2 rounded flex items-center space-x-2 transition-colors shadow-xs"
          >
            <span>View Today's Action Plan</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Placement Readiness"
          value={`${readiness}/100`}
          subtext="Benchmark Goal: 80+"
          icon={Target}
        />
        <StatCard
          label="Problems Solved"
          value={codingTotal}
          subtext={leetcode ? `LeetCode: ${leetcode.totalSolved} | Contest: ${Math.round(leetcode.contestRating)}` : 'Competitive programming platforms'}
          icon={Code}
        />
        <StatCard
          label="GitHub Activity"
          value={`${github?.totalCommits || 0} commits`}
          subtext={`${github?.publicRepos || 0} Repos | ${github?.totalStars || 0} Stars`}
          icon={GitBranch}
        />
        <StatCard
          label="Peak Contest Rating"
          value={maxRating > 0 ? maxRating : 'Unranked'}
          subtext={leetcode?.globalRank ? `Global Rank: #${leetcode.globalRank.toLocaleString()}` : 'Participate in weekly contests'}
          icon={Award}
        />
      </div>

      {/* Placement Readiness Index Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#FFFFFF] border border-[#E5E7EB] p-5 rounded-lg space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
            <div>
              <h2 className="text-sm font-bold text-[#1F2937] flex items-center space-x-2">
                <Target className="w-4 h-4 text-[#374151]" />
                <span>Placement Readiness Index Breakdown</span>
              </h2>
              <p className="text-xs text-[#6B7280] mt-0.5">Transparent calculation based on normalized student telemetry.</p>
            </div>
            <Badge variant="info">Index: {readiness}/100</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <ProgressBar
              label="Data Structures & Algorithms"
              value={latestSnapshot ? Math.round(latestSnapshot.dsaScore) : 0}
              sublabel={`${codingTotal} problems solved across platforms`}
            />
            <ProgressBar
              label="Development & Projects"
              value={latestSnapshot ? Math.round(latestSnapshot.devScore) : 0}
              sublabel={`${github?.publicRepos || 0} GitHub repos, ${github?.totalCommits || 0} commits`}
            />
            <ProgressBar
              label="Database Management (DBMS)"
              value={latestSnapshot ? Math.round(latestSnapshot.dbmsScore) : 0}
              sublabel="Relational schema design and indexing mastery"
            />
            <ProgressBar
              label="Operating Systems & Concurrency"
              value={latestSnapshot ? Math.round(latestSnapshot.osScore) : 0}
              sublabel="Process synchronization & thread fundamentals"
            />
          </div>

          {/* Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-[#E5E7EB]">
            <div className="bg-[#F8F9FA] p-3 rounded border border-[#E5E7EB] flex items-start space-x-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-semibold text-[#1F2937]">Current Strength: </span>
                <span className="text-[#374151]">
                  {codingTotal >= 100
                    ? 'Data Structures & Algorithms'
                    : (github?.publicRepos || 0) > 3
                    ? 'Project Breadth'
                    : hasData
                    ? 'Foundational Progress'
                    : 'Awaiting Telemetry'}
                </span>
                <p className="text-[#6B7280] text-[11px] mt-0.5">
                  {codingTotal > 0
                    ? `Verified volume of ${codingTotal} solved problems.`
                    : 'Connect platforms in profile onboarding to record verified telemetry.'}
                </p>
              </div>
            </div>

            <div className="bg-[#F8F9FA] p-3 rounded border border-[#E5E7EB] flex items-start space-x-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-semibold text-[#1F2937]">Primary Growth Opportunity: </span>
                <span className="text-[#374151]">
                  {(github?.publicRepos || 0) < 3 ? 'Expand GitHub Repositories' : 'System Design & Distributed Data'}
                </span>
                <p className="text-[#6B7280] text-[11px] mt-0.5">Review personalized recommendations in Action Center.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Difficulty Distribution */}
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] p-5 rounded-lg flex flex-col justify-between space-y-4 shadow-xs">
          <div>
            <h2 className="text-sm font-bold text-[#1F2937] border-b border-[#E5E7EB] pb-3 flex items-center justify-between">
              <span>Coding Difficulty Breakdown</span>
              <span className="text-xs font-mono text-[#6B7280]">{codingTotal} Solved</span>
            </h2>

            {codingTotal > 0 ? (
              <div className="space-y-3 mt-4">
                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-emerald-700 font-semibold">Easy</span>
                    <span className="text-[#374151] font-medium">{easySolved} problems</span>
                  </div>
                  <div className="w-full bg-[#F8F9FA] h-2 rounded-full border border-[#E5E7EB] overflow-hidden">
                    <div className="bg-emerald-600 h-full" style={{ width: `${codingTotal > 0 ? (easySolved / codingTotal) * 100 : 0}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-amber-700 font-semibold">Medium</span>
                    <span className="text-[#374151] font-medium">{mediumSolved} problems</span>
                  </div>
                  <div className="w-full bg-[#F8F9FA] h-2 rounded-full border border-[#E5E7EB] overflow-hidden">
                    <div className="bg-amber-600 h-full" style={{ width: `${codingTotal > 0 ? (mediumSolved / codingTotal) * 100 : 0}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-rose-700 font-semibold">Hard</span>
                    <span className="text-[#374151] font-medium">{hardSolved} problems</span>
                  </div>
                  <div className="w-full bg-[#F8F9FA] h-2 rounded-full border border-[#E5E7EB] overflow-hidden">
                    <div className="bg-rose-600 h-full" style={{ width: `${codingTotal > 0 ? (hardSolved / codingTotal) * 100 : 0}%` }}></div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-[#6B7280] space-y-2">
                <p>No problem solves recorded yet.</p>
                <Link to="/onboarding" className="text-[#374151] font-semibold underline inline-block">
                  Connect LeetCode / CodeChef
                </Link>
              </div>
            )}
          </div>

          <div className="bg-[#F8F9FA] p-3.5 rounded border border-[#E5E7EB] text-xs space-y-1">
            <div className="flex items-center justify-between font-mono">
              <span className="text-[#6B7280]">Connected Platforms</span>
              <span className="text-[#374151] font-bold">
                {profile?.connections?.filter((c) => c.isConnected).length || 0} Platforms
              </span>
            </div>
            <p className="text-[#6B7280] text-[11px]">Sync regularly to refresh telemetry indicators.</p>
          </div>
        </div>
      </div>

      {/* Verified Skill Depth & Complexity Scores */}
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] p-5 rounded-lg space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E7EB] pb-3">
          <div>
            <h2 className="text-sm font-bold text-[#1F2937] flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Verified Skill Depth & Architectural Mastery</span>
            </h2>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Scored via Depth-Weighted Complexity: 45% Max Project Difficulty + 30% Avg Project Complexity + 15% Production Signals (Tests/CI/Docker) + 10% Log Frequency.
            </p>
          </div>
          <Badge variant="info">
            {profile?.skillMetrics?.length || 0} Evaluated Technologies
          </Badge>
        </div>

        {profile?.skillMetrics && profile.skillMetrics.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
            {profile.skillMetrics.map((sm) => (
              <div key={sm.id || sm.skillName} className="bg-[#F8F9FA] border border-[#E5E7EB] p-3.5 rounded-lg space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-[#1F2937]">{sm.skillName}</h3>
                    <span className="text-[10px] text-[#6B7280] font-mono">{sm.category}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-[#1F2937]">
                      {Math.round(sm.verifiedDepthScore)}/100
                    </span>
                    <span className="block text-[9px] text-[#6B7280] uppercase tracking-wider font-semibold">Depth Score</span>
                  </div>
                </div>

                <div className="w-full bg-[#E5E7EB] h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      sm.verifiedDepthScore >= 75
                        ? 'bg-emerald-600'
                        : sm.verifiedDepthScore >= 50
                        ? 'bg-blue-600'
                        : 'bg-amber-600'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(5, sm.verifiedDepthScore))}%` }}
                  ></div>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-[#4B5563] pt-0.5 border-t border-[#E5E7EB]">
                  <span>Max Diff: <strong className="text-[#1F2937]">{sm.maxProjectDifficulty}/10</strong></span>
                  <span>Avg: <strong className="text-[#1F2937]">{sm.avgProjectDifficulty}/10</strong></span>
                  <span>Used: <strong className="text-[#1F2937]">{sm.frequencyCount}x</strong></span>
                </div>

                {sm.evidenceSummary && (
                  <p className="text-[10px] text-[#6B7280] line-clamp-1 italic">{sm.evidenceSummary}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-[#6B7280] space-y-2">
            <p>No verified skill depth records yet. Sync your GitHub and complete onboarding to evaluate architecture complexity.</p>
            <Link to="/onboarding" className="text-[#374151] font-semibold underline inline-block">
              Upload Resume or Connect Repositories
            </Link>
          </div>
        )}
      </div>

      {/* Architected Projects & Systems Portfolio */}
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] p-5 rounded-lg space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E7EB] pb-3">
          <div>
            <h2 className="text-sm font-bold text-[#1F2937] flex items-center space-x-2">
              <Layers className="w-4 h-4 text-[#374151]" />
              <span>Architected Projects & Production Codebases</span>
            </h2>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Live database records inspected for automated tests, CI/CD pipelines, Docker containers, and architectural tier.
            </p>
          </div>
          <Badge variant="neutral">
            {profile?.projects?.length || 0} Codebases Tracked
          </Badge>
        </div>

        {profile?.projects && profile.projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {profile.projects.map((proj) => {
              const tierVariant =
                proj.architectureTier === 'Advanced System'
                  ? 'success'
                  : proj.architectureTier === 'Full-Stack Production'
                  ? 'info'
                  : 'neutral';

              return (
                <div key={proj.id} className="bg-[#F8F9FA] border border-[#E5E7EB] p-4 rounded-lg space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-bold text-[#1F2937] flex items-center space-x-1.5">
                        <span>{proj.name}</span>
                        {proj.repoUrl && (
                          <a
                            href={proj.repoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#6B7280] hover:text-[#1F2937]"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </h3>
                      <p className="text-[11px] text-[#6B7280] line-clamp-2 mt-0.5">{proj.description}</p>
                    </div>
                    <Badge variant={tierVariant} size="sm">
                      {proj.architectureTier}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
                    <span className="px-2 py-0.5 bg-white border border-[#E5E7EB] rounded font-semibold text-[#1F2937]">
                      Difficulty: {proj.difficultyScore}/10
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded border ${
                        proj.hasTests
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-semibold'
                          : 'bg-white border-[#E5E7EB] text-[#9CA3AF]'
                      }`}
                    >
                      Tests: {proj.hasTests ? '✓' : '✗'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded border ${
                        proj.hasCiCd
                          ? 'bg-blue-50 border-blue-200 text-blue-800 font-semibold'
                          : 'bg-white border-[#E5E7EB] text-[#9CA3AF]'
                      }`}
                    >
                      CI/CD: {proj.hasCiCd ? '✓' : '✗'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded border ${
                        proj.hasDocker
                          ? 'bg-purple-50 border-purple-200 text-purple-800 font-semibold'
                          : 'bg-white border-[#E5E7EB] text-[#9CA3AF]'
                      }`}
                    >
                      Docker: {proj.hasDocker ? '✓' : '✗'}
                    </span>
                  </div>

                  {proj.commitCount > 0 && (
                    <div className="flex items-center space-x-3 text-[10px] text-[#6B7280] font-mono pt-1 border-t border-[#E5E7EB]">
                      <span>{proj.commitCount} Commits</span>
                      <span>• {proj.stars} Stars</span>
                      <span>• {proj.forks} Forks</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-[#6B7280] space-y-2">
            <p>No repository architectures analyzed yet. Synchronize your GitHub profile to record project complexity.</p>
            <Link to="/onboarding" className="text-[#374151] font-semibold underline inline-block">
              Connect GitHub Profile
            </Link>
          </div>
        )}
      </div>

      {/* Action Center Widget & AI Intelligence */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#FFFFFF] border border-[#E5E7EB] p-5 rounded-lg space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
            <div>
              <h2 className="text-sm font-bold text-[#1F2937] flex items-center space-x-2">
                <Lightbulb className="w-4 h-4 text-amber-600" />
                <span>Recommended Next Actions</span>
              </h2>
              <p className="text-xs text-[#6B7280] mt-0.5">High-priority tasks selected based on your profile telemetry.</p>
            </div>
            <Link to="/actions" className="text-xs text-[#374151] hover:text-[#1F2937] font-mono flex items-center space-x-1 font-semibold">
              <span>View all actions</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {profile?.actionItems && profile.actionItems.length > 0 ? (
              profile.actionItems.slice(0, 3).map((action) => (
                <div key={action.id} className="bg-[#F8F9FA] p-3.5 rounded border border-[#E5E7EB] flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <Badge variant={action.priority === 'HIGH' ? 'error' : 'warning'} size="sm">
                        {action.priority} PRIORITY
                      </Badge>
                      <span className="text-xs font-semibold text-[#1F2937]">{action.title}</span>
                    </div>
                    <p className="text-xs text-[#6B7280] pl-1">{action.reason}</p>
                  </div>
                  <span className="text-[11px] font-mono text-[#6B7280] shrink-0 border border-[#E5E7EB] px-2 py-0.5 rounded bg-[#FFFFFF]">
                    Est. {action.estimatedHours}h
                  </span>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-[#6B7280] space-y-2">
                <p>No actions pending. Synchronize your platforms to receive personalized guidance.</p>
                <button
                  onClick={onSync}
                  disabled={isSyncing}
                  className="px-3 py-1.5 bg-[#374151] text-white rounded text-xs font-semibold inline-flex items-center space-x-1.5"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Sync Telemetry Now</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* AI Reasoning Summary */}
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] p-5 rounded-lg space-y-3 shadow-xs">
          <h2 className="text-sm font-bold text-[#1F2937] border-b border-[#E5E7EB] pb-3 flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-[#374151]" />
            <span>AI Placement Reasoning</span>
          </h2>

          <p className="text-xs text-[#374151] leading-relaxed">
            {profile?.summary ||
              'Connect your coding and development accounts to generate objective telemetry-driven placement strategy.'}
          </p>

          <div className="pt-2">
            <Link
              to="/build-next"
              className="w-full bg-[#F8F9FA] hover:bg-[#F3F4F6] border border-[#E5E7EB] text-xs text-[#1F2937] py-2 rounded flex items-center justify-center space-x-2 transition-colors font-semibold"
            >
              <span>Explore "Build Next" Project Ideas</span>
              <ChevronRight className="w-3.5 h-3.5 text-[#6B7280]" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
