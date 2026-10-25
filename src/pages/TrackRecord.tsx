import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { TrendingUp, Award, GitBranch, Code, AlertCircle, RefreshCw, ShieldCheck, Layers, ArrowUpRight } from 'lucide-react';
import { StudentProfile } from '../types';
import { StatCard } from '../components/ui/StatCard';
import { Badge } from '../components/ui/Badge';
import { trackRecordApi } from '../services/api';
import { Link } from 'react-router-dom';

interface TrackRecordProps {
  profile: StudentProfile | null;
}

export const TrackRecord: React.FC<TrackRecordProps> = ({ profile }) => {
  const [trackRecordData, setTrackRecordData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrackRecord = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await trackRecordApi.getTrackRecord();
      if (res) {
        setTrackRecordData(res);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load track record telemetry');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrackRecord();
  }, [profile]);

  const snapshots = trackRecordData?.snapshots?.length
    ? trackRecordData.snapshots
    : profile?.skillSnapshots && profile.skillSnapshots.length > 0
    ? profile.skillSnapshots
    : [];

  const codingProfiles = trackRecordData?.codingProfiles || profile?.codingProfiles || [];
  const githubProfile = trackRecordData?.githubProfile || profile?.gitHubProfile;

  let totalEasy = 0;
  let totalMedium = 0;
  let totalHard = 0;
  let maxRating = 0;
  let totalContests = 0;

  codingProfiles.forEach((cp: any) => {
    totalEasy += cp.easySolved || 0;
    totalMedium += cp.mediumSolved || 0;
    totalHard += cp.hardSolved || 0;
    if ((cp.contestRating || 0) > maxRating) maxRating = Math.round(cp.contestRating);
    totalContests += cp.contestsParticipated || 0;
  });

  const totalSolved = totalEasy + totalMedium + totalHard;

  const difficultyData = [
    { name: 'Easy', count: totalEasy, color: '#059669' },
    { name: 'Medium', count: totalMedium, color: '#d97706' },
    { name: 'Hard', count: totalHard, color: '#dc2626' },
  ];

  let techLanguageData: { language: string; repos: number; commits: number }[] = [];
  if (githubProfile?.languagesJson) {
    try {
      const langs = JSON.parse(githubProfile.languagesJson);
      techLanguageData = Object.entries(langs).map(([lang, count]) => ({
        language: lang,
        repos: Number(count),
        commits: Number(count) * 20,
      }));
    } catch {
      // Ignored
    }
  }

  const initialScore = snapshots.length > 0 ? snapshots[0].overallScore : 0;
  const latestScore = snapshots.length > 0 ? snapshots[snapshots.length - 1].overallScore : 0;
  const growth = Math.round(latestScore - initialScore);
  const latestDsa = snapshots.length > 0 ? snapshots[snapshots.length - 1].dsaScore : 0;
  const latestDev = snapshots.length > 0 ? snapshots[snapshots.length - 1].devScore : 0;

  if (isLoading && snapshots.length === 0 && !profile) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto animate-pulse">
        <div className="h-16 bg-white border border-[#E5E7EB] rounded-lg"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-white border border-[#E5E7EB] rounded-lg"></div>
          ))}
        </div>
        <div className="h-72 bg-white border border-[#E5E7EB] rounded-lg"></div>
      </div>
    );
  }

  if (error && snapshots.length === 0) {
    return (
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg p-12 text-center space-y-4 shadow-xs max-w-xl mx-auto mt-8">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-base font-bold text-[#1F2937]">Unable to Load Track Record</h2>
        <p className="text-xs text-[#6B7280]">{error}</p>
        <button
          onClick={fetchTrackRecord}
          className="inline-flex items-center space-x-2 bg-[#374151] hover:bg-[#1F2937] text-white text-xs font-semibold px-4 py-2 rounded transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Loading Telemetry</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="border-b border-[#E5E7EB] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#1F2937] flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-[#374151]" />
            <span>Track Record & Historical Progression</span>
          </h1>
          <p className="text-xs text-[#6B7280] mt-1">
            Historical telemetry snapshots recorded over time to track measurable skill growth and coding consistency.
          </p>
        </div>

        <Badge variant="info">Historical Snapshots: {snapshots.length} Recorded</Badge>
      </div>

      {snapshots.length === 0 ? (
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg p-12 text-center space-y-3 shadow-xs">
          <TrendingUp className="w-10 h-10 text-[#9CA3AF] mx-auto" />
          <h2 className="text-base font-bold text-[#1F2937]">No Historical Snapshots Available</h2>
          <p className="text-xs text-[#6B7280] max-w-md mx-auto">
            Historical progression data begins tracking after your initial platform synchronization. Connect your profiles to record baseline telemetry.
          </p>
          <div className="pt-2">
            <Link
              to="/onboarding"
              className="inline-flex items-center space-x-2 bg-[#374151] hover:bg-[#1F2937] text-white text-xs font-semibold px-4 py-2 rounded"
            >
              <span>Connect Profiles in Onboarding</span>
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Overview Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              label="Overall Score Growth"
              value={`${initialScore} → ${latestScore}`}
              subtext={`${growth >= 0 ? '+' : ''}${growth} pts over ${snapshots.length} periods`}
              icon={TrendingUp}
            />
            <StatCard
              label="DSA Mastery"
              value={`${Math.round(latestDsa)}/100`}
              subtext={`Solves: ${totalSolved} total`}
              icon={Code}
            />
            <StatCard
              label="Dev & Projects"
              value={`${Math.round(latestDev)}/100`}
              subtext={`Public Repos: ${githubProfile?.publicRepos || 0}`}
              icon={GitBranch}
            />
            <StatCard
              label="Contests Attended"
              value={`${totalContests} Contests`}
              subtext={maxRating > 0 ? `Peak Rating: ${maxRating}` : 'Weekly Participation'}
              icon={Award}
            />
          </div>

          {/* Main Historical Growth Line Chart */}
          <div className="bg-[#FFFFFF] border border-[#E5E7EB] p-5 rounded-lg space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
              <div>
                <h2 className="text-sm font-bold text-[#1F2937]">Skill Score Progression Over Time</h2>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Monthly telemetry snapshots capturing DSA, Development, DBMS, and OS scores.
                </p>
              </div>
              <div className="flex items-center space-x-4 text-xs font-mono">
                <span className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#374151]"></span>
                  <span className="text-[#1F2937]">Overall</span>
                </span>
                <span className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                  <span className="text-[#1F2937]">DSA</span>
                </span>
                <span className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
                  <span className="text-[#1F2937]">Dev</span>
                </span>
              </div>
            </div>

            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={snapshots}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="snapshotMonth" stroke="#6B7280" fontSize={11} />
                  <YAxis domain={[0, 100]} stroke="#6B7280" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', color: '#1F2937', fontSize: '12px' }}
                  />
                  <Line type="monotone" dataKey="overallScore" stroke="#374151" strokeWidth={3} dot={{ r: 4 }} name="Overall Readiness" />
                  <Line type="monotone" dataKey="dsaScore" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} name="DSA Score" />
                  <Line type="monotone" dataKey="devScore" stroke="#d97706" strokeWidth={2} dot={{ r: 3 }} name="Development Score" />
                  <Line type="monotone" dataKey="dbmsScore" stroke="#7c3aed" strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 2 }} name="DBMS Score" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Two Column Grid: Problem Difficulty Split & Technology Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Difficulty Bar Chart */}
            <div className="bg-[#FFFFFF] border border-[#E5E7EB] p-5 rounded-lg space-y-4 shadow-xs">
              <h2 className="text-sm font-bold text-[#1F2937] border-b border-[#E5E7EB] pb-3">Problem Difficulty Distribution</h2>
              {totalSolved > 0 ? (
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={difficultyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="name" stroke="#6B7280" fontSize={11} />
                      <YAxis stroke="#6B7280" fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', color: '#1F2937', fontSize: '12px' }} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {difficultyData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="py-16 text-center text-xs text-[#6B7280]">
                  No coding difficulty statistics recorded yet.
                </div>
              )}
            </div>

            {/* Technology Language Usage Chart */}
            <div className="bg-[#FFFFFF] border border-[#E5E7EB] p-5 rounded-lg space-y-4 shadow-xs">
              <h2 className="text-sm font-bold text-[#1F2937] border-b border-[#E5E7EB] pb-3">Language & Technology Usage</h2>
              {techLanguageData.length > 0 ? (
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={techLanguageData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis type="number" stroke="#6B7280" fontSize={11} />
                      <YAxis dataKey="language" type="category" stroke="#6B7280" fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', color: '#1F2937', fontSize: '12px' }} />
                      <Bar dataKey="commits" fill="#374151" radius={[0, 4, 4, 0]} name="Commits" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="py-16 text-center text-xs text-[#6B7280]">
                  No repository language statistics available.
                </div>
              )}
            </div>
          </div>

          {/* Verified Skill Depth Scores Grid */}
          <div className="bg-[#FFFFFF] border border-[#E5E7EB] p-5 rounded-lg space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E7EB] pb-3">
              <div>
                <h2 className="text-sm font-bold text-[#1F2937] flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Telemetry Verified Skill Depth Scores</span>
                </h2>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Depth scores (0-100) based on Project Difficulty, Architectural Complexity, and Problem-Solving Depth.
                </p>
              </div>
              <Badge variant="info">
                {profile?.skillMetrics?.length || 0} Evaluated Skills
              </Badge>
            </div>

            {profile?.skillMetrics && profile.skillMetrics.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
                {profile.skillMetrics.map((sm) => (
                  <div key={sm.id || sm.skillName} className="bg-[#F8F9FA] border border-[#E5E7EB] p-3.5 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#1F2937]">{sm.skillName}</span>
                      <span className="text-xs font-mono font-bold text-[#1F2937]">
                        {Math.round(sm.verifiedDepthScore)}/100
                      </span>
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

                    <div className="flex items-center justify-between text-[11px] font-mono text-[#4B5563] pt-1 border-t border-[#E5E7EB]">
                      <span>Max Diff: <strong>{sm.maxProjectDifficulty}/10</strong></span>
                      <span>Avg Diff: <strong>{sm.avgProjectDifficulty}/10</strong></span>
                    </div>

                    {sm.evidenceSummary && (
                      <p className="text-[10px] text-[#6B7280] italic line-clamp-1">{sm.evidenceSummary}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-[#6B7280]">
                No skill metrics evaluated yet. Synchronize your accounts to record depth telemetry.
              </div>
            )}
          </div>

          {/* Project Complexity & Architecture Records */}
          <div className="bg-[#FFFFFF] border border-[#E5E7EB] p-5 rounded-lg space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E7EB] pb-3">
              <div>
                <h2 className="text-sm font-bold text-[#1F2937] flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-[#374151]" />
                  <span>Project Architectural Complexity Signals</span>
                </h2>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Production signals evaluated across all tracked repositories in the database.
                </p>
              </div>
              <Badge variant="neutral">
                {profile?.projects?.length || 0} Codebases
              </Badge>
            </div>

            {profile?.projects && profile.projects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                {profile.projects.map((p) => (
                  <div key={p.id} className="bg-[#F8F9FA] border border-[#E5E7EB] p-3.5 rounded-lg space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-[#1F2937]">{p.name}</span>
                      <Badge variant={p.architectureTier === 'Advanced System' ? 'success' : 'info'} size="sm">
                        {p.architectureTier}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
                      <span className="px-2 py-0.5 bg-white border border-[#E5E7EB] rounded font-semibold text-[#1F2937]">
                        Difficulty: {p.difficultyScore}/10
                      </span>
                      <span className={`px-2 py-0.5 rounded border ${p.hasTests ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-white border-[#E5E7EB] text-[#9CA3AF]'}`}>
                        Tests: {p.hasTests ? '✓' : '✗'}
                      </span>
                      <span className={`px-2 py-0.5 rounded border ${p.hasCiCd ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-white border-[#E5E7EB] text-[#9CA3AF]'}`}>
                        CI/CD: {p.hasCiCd ? '✓' : '✗'}
                      </span>
                      <span className={`px-2 py-0.5 rounded border ${p.hasDocker ? 'bg-purple-50 border-purple-200 text-purple-800' : 'bg-white border-[#E5E7EB] text-[#9CA3AF]'}`}>
                        Docker: {p.hasDocker ? '✓' : '✗'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-[#6B7280]">
                No codebases recorded yet. Connect GitHub to inspect repository complexity.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
