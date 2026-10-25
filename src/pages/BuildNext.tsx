import React, { useState, useEffect } from 'react';
import { Code2, Lightbulb, Clock, Layers, AlertCircle, RefreshCw, GitBranch, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { ProjectRecommendation, StudentProfile } from '../types';
import { Badge } from '../components/ui/Badge';
import { projectApi } from '../services/api';
import { Link } from 'react-router-dom';

interface BuildNextProps {
  profile: StudentProfile | null;
}

export const BuildNext: React.FC<BuildNextProps> = ({ profile }) => {
  const [projects, setProjects] = useState<ProjectRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await projectApi.getRecommendations();
      if (res.projects && res.projects.length > 0) {
        setProjects(res.projects);
      } else if (profile?.projectRecommendations && profile.projectRecommendations.length > 0) {
        setProjects(profile.projectRecommendations);
      } else {
        setProjects([]);
      }
    } catch (err: any) {
      if (profile?.projectRecommendations && profile.projectRecommendations.length > 0) {
        setProjects(profile.projectRecommendations);
      } else {
        setError(err.response?.data?.error || err.message || 'Failed to fetch project recommendations');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [profile]);

  if (isLoading && projects.length === 0) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto animate-pulse">
        <div className="h-16 bg-white border border-[#E5E7EB] rounded-lg"></div>
        <div className="space-y-6">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 bg-white border border-[#E5E7EB] rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error && projects.length === 0) {
    return (
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg p-12 text-center space-y-4 shadow-xs max-w-xl mx-auto mt-8">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-base font-bold text-[#1F2937]">Unable to Load Project Recommendations</h2>
        <p className="text-xs text-[#6B7280]">{error}</p>
        <button
          onClick={fetchProjects}
          className="inline-flex items-center space-x-2 bg-[#374151] hover:bg-[#1F2937] text-white text-xs font-semibold px-4 py-2 rounded transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Loading Projects</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="border-b border-[#E5E7EB] pb-4">
        <h1 className="text-xl font-bold text-[#1F2937] flex items-center space-x-2">
          <Code2 className="w-5 h-5 text-[#374151]" />
          <span>Build Next - Personalized Project Engine</span>
        </h1>
        <p className="text-xs text-[#6B7280] mt-1">
          System-suggested projects designed specifically to bridge your verified skill gaps and elevate your GitHub telemetry.
        </p>
      </div>

      {/* Current Tracked Codebases & Architecture Tiers */}
      {profile?.projects && profile.projects.length > 0 && (
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] p-5 rounded-lg space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
            <div>
              <h2 className="text-sm font-bold text-[#1F2937] flex items-center space-x-2">
                <GitBranch className="w-4 h-4 text-[#374151]" />
                <span>Current Tracked Codebases & Architecture Tiers</span>
              </h2>
              <p className="text-xs text-[#6B7280]">
                Live repositories analyzed for architectural depth and production signals.
              </p>
            </div>
            <Badge variant="neutral">{profile.projects.length} Repositories</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {profile.projects.map((proj) => (
              <div key={proj.id} className="bg-[#F8F9FA] border border-[#E5E7EB] p-3.5 rounded-lg space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-bold text-[#1F2937]">{proj.name}</span>
                  <Badge
                    variant={
                      proj.architectureTier === 'Advanced System'
                        ? 'success'
                        : proj.architectureTier === 'Full-Stack Production'
                        ? 'info'
                        : 'neutral'
                    }
                    size="sm"
                  >
                    {proj.architectureTier}
                  </Badge>
                </div>
                <p className="text-[11px] text-[#6B7280] line-clamp-2">{proj.description}</p>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                  <span className="px-2 py-0.5 bg-white border border-[#E5E7EB] rounded font-semibold text-[#1F2937]">
                    Difficulty: {proj.difficultyScore}/10
                  </span>
                  <span className={`px-2 py-0.5 rounded border ${proj.hasTests ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-white border-[#E5E7EB] text-[#9CA3AF]'}`}>
                    Tests: {proj.hasTests ? '✓' : '✗'}
                  </span>
                  <span className={`px-2 py-0.5 rounded border ${proj.hasCiCd ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-white border-[#E5E7EB] text-[#9CA3AF]'}`}>
                    CI/CD: {proj.hasCiCd ? '✓' : '✗'}
                  </span>
                  <span className={`px-2 py-0.5 rounded border ${proj.hasDocker ? 'bg-purple-50 border-purple-200 text-purple-800' : 'bg-white border-[#E5E7EB] text-[#9CA3AF]'}`}>
                    Docker: {proj.hasDocker ? '✓' : '✗'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended Projects List */}
      {projects.length === 0 ? (
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg p-12 text-center space-y-3 shadow-xs">
          <Layers className="w-10 h-10 text-[#9CA3AF] mx-auto" />
          <h2 className="text-base font-bold text-[#1F2937]">No Project Recommendations Generated Yet</h2>
          <p className="text-xs text-[#6B7280] max-w-md mx-auto">
            Connect your GitHub profile and competitive coding platforms to generate personalized project architectures tailored to your skill gaps.
          </p>
          <div className="pt-2">
            <Link
              to="/onboarding"
              className="inline-flex items-center space-x-2 bg-[#374151] hover:bg-[#1F2937] text-white text-xs font-semibold px-4 py-2 rounded"
            >
              <span>Connect Platforms in Profile Onboarding</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {projects.map((proj) => (
            <div key={proj.id} className="bg-[#FFFFFF] border border-[#E5E7EB] p-6 rounded-lg space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E7EB] pb-3">
                <div>
                  <h2 className="text-base font-bold text-[#1F2937]">{proj.title}</h2>
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge variant={proj.difficulty === 'ADVANCED' ? 'warning' : 'info'}>{proj.difficulty}</Badge>
                    <span className="text-xs font-mono text-[#6B7280] flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Est. {proj.estimatedDuration}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Why Suited */}
              <div className="bg-[#F8F9FA] p-3.5 rounded border border-[#E5E7EB] text-xs flex items-start space-x-2">
                <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-[#1F2937]">Why this project fits your profile: </span>
                  <span className="text-[#374151]">{proj.whySuited}</span>
                </div>
              </div>

              {/* Problem Statement */}
              <div className="space-y-1">
                <h3 className="text-xs font-mono font-semibold uppercase text-[#6B7280]">Problem Statement</h3>
                <p className="text-xs text-[#374151] leading-relaxed">{proj.problemStatement}</p>
              </div>

              {/* Tech Stack & Skills */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <h3 className="text-xs font-mono font-semibold uppercase text-[#6B7280] mb-2">Required Technologies</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {proj.technologies?.map((tech) => (
                      <span key={tech} className="bg-[#F8F9FA] text-[#1F2937] border border-[#E5E7EB] text-[11px] font-mono px-2 py-0.5 rounded">
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-mono font-semibold uppercase text-[#6B7280] mb-2">Skills Developed</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {proj.skillsDeveloped?.map((skill) => (
                      <span key={skill} className="bg-blue-50 text-blue-900 border border-blue-200 text-[11px] font-mono px-2 py-0.5 rounded font-medium">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Milestones */}
              {proj.milestones && proj.milestones.length > 0 && (
                <div className="pt-2 border-t border-[#E5E7EB]">
                  <h3 className="text-xs font-mono font-semibold uppercase text-[#6B7280] mb-2">Suggested Milestones</h3>
                  <div className="space-y-1.5">
                    {proj.milestones.map((m, idx) => (
                      <div key={idx} className="flex items-center space-x-2 text-xs text-[#374151] font-mono">
                        <span className="w-5 h-5 rounded bg-[#F8F9FA] border border-[#E5E7EB] text-[11px] font-bold flex items-center justify-center text-[#6B7280] shrink-0">
                          {idx + 1}
                        </span>
                        <span>{m}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
