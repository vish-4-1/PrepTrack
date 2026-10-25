import React, { useState, useEffect } from 'react';
import { Building2, CheckCircle2, AlertTriangle, Lightbulb, RefreshCw, AlertCircle } from 'lucide-react';
import { StudentProfile, TargetCompany } from '../types';
import { Badge } from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { companyApi } from '../services/api';

interface CompanyPrepProps {
  profile: StudentProfile | null;
}

interface CompanyReadinessResponse {
  company: TargetCompany;
  readinessScore: number;
  status: string;
  skillBreakdown: Array<{
    skillName: string;
    requiredScore: number;
    studentScore: number;
    matchPercentage: number;
    priority: string;
    isMet: boolean;
    topics: string[];
  }>;
  missingSkills: Array<{
    skillName: string;
    minScore: number;
    studentScore: number;
    gap: number;
    priority: string;
    topics: string[];
  }>;
  recommendedActions: string[];
}

export const CompanyPrep: React.FC<CompanyPrepProps> = ({ profile }) => {
  const [companies, setCompanies] = useState<TargetCompany[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<TargetCompany | null>(null);
  const [readinessData, setReadinessData] = useState<CompanyReadinessResponse | null>(null);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState<boolean>(true);
  const [isLoadingReadiness, setIsLoadingReadiness] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCompanies = async () => {
    try {
      setIsLoadingCompanies(true);
      setError(null);
      const res = await companyApi.getCompanies();
      if (res.companies && res.companies.length > 0) {
        setCompanies(res.companies);
        setSelectedCompany(res.companies[0]);
      } else {
        setCompanies([]);
        setSelectedCompany(null);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch target companies');
    } finally {
      setIsLoadingCompanies(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    if (!selectedCompany) return;

    const fetchCompanyReadiness = async () => {
      try {
        setIsLoadingReadiness(true);
        const res = await companyApi.getCompanyReadiness(selectedCompany.id);
        setReadinessData(res);
      } catch (err: any) {
        console.error(`Failed to calculate readiness for ${selectedCompany.name}:`, err);
      } finally {
        setIsLoadingReadiness(false);
      }
    };

    fetchCompanyReadiness();
  }, [selectedCompany, profile]);

  if (isLoadingCompanies && companies.length === 0) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto animate-pulse">
        <div className="h-16 bg-white border border-[#E5E7EB] rounded-lg"></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-white border border-[#E5E7EB] rounded-lg"></div>
          ))}
        </div>
        <div className="h-64 bg-white border border-[#E5E7EB] rounded-lg"></div>
      </div>
    );
  }

  if (error && companies.length === 0) {
    return (
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg p-12 text-center space-y-4 shadow-xs max-w-xl mx-auto mt-8">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-base font-bold text-[#1F2937]">Unable to Load Target Companies</h2>
        <p className="text-xs text-[#6B7280]">{error}</p>
        <button
          onClick={fetchCompanies}
          className="inline-flex items-center space-x-2 bg-[#374151] hover:bg-[#1F2937] text-white text-xs font-semibold px-4 py-2 rounded transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Loading Companies</span>
        </button>
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg p-12 text-center space-y-3 shadow-xs max-w-6xl mx-auto">
        <Building2 className="w-10 h-10 text-[#9CA3AF] mx-auto" />
        <h2 className="text-base font-bold text-[#1F2937]">No Target Companies Configured</h2>
        <p className="text-xs text-[#6B7280]">
          Company hiring benchmarks are currently empty in the placement database.
        </p>
      </div>
    );
  }

  const readinessScore = readinessData?.readinessScore ?? Math.round(profile?.placementReadiness || 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="border-b border-[#E5E7EB] pb-4">
        <h1 className="text-xl font-bold text-[#1F2937] flex items-center space-x-2">
          <Building2 className="w-5 h-5 text-[#374151]" />
          <span>Target Company Preparation</span>
        </h1>
        <p className="text-xs text-[#6B7280] mt-1">
          Evaluate your verified placement readiness index against company-specific technical hiring benchmarks.
        </p>
      </div>

      {/* Company Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {companies.map((comp) => {
          const isSelected = selectedCompany?.id === comp.id;
          return (
            <button
              key={comp.id}
              onClick={() => setSelectedCompany(comp)}
              className={`p-3 rounded-lg border text-left transition-all ${
                isSelected
                  ? 'bg-[#374151] border-[#374151] text-white shadow-xs'
                  : 'bg-[#FFFFFF] border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#1F2937]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">{comp.name}</span>
                <Badge variant={comp.difficultyLevel === 'TIER-1' ? 'error' : 'info'} size="sm">
                  {comp.difficultyLevel}
                </Badge>
              </div>
              <p className="text-[11px] opacity-80 mt-1 line-clamp-1">
                {comp.targetRoles && comp.targetRoles.length > 0 ? comp.targetRoles[0] : 'SDE'}
              </p>
            </button>
          );
        })}
      </div>

      {/* Selected Company Readiness Overview */}
      {selectedCompany && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-[#FFFFFF] border border-[#E5E7EB] p-6 rounded-lg space-y-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E7EB] pb-4">
              <div>
                <h2 className="text-lg font-bold text-[#1F2937]">{selectedCompany.name} Target Preparation</h2>
                <p className="text-xs text-[#6B7280] mt-0.5">{selectedCompany.overview}</p>
              </div>
              <div className="flex items-center space-x-2">
                {isLoadingReadiness && <RefreshCw className="w-4 h-4 animate-spin text-[#6B7280]" />}
                <Badge variant={readinessScore >= 80 ? 'success' : readinessScore >= 65 ? 'warning' : 'error'}>
                  Readiness: {readinessScore}/100
                </Badge>
              </div>
            </div>

            <ProgressBar
              label={`${selectedCompany.name} Readiness Score`}
              value={readinessScore}
              sublabel={
                readinessScore >= 80
                  ? 'Strong match for online screening assessment rounds.'
                  : readinessScore >= 65
                  ? 'Competitive for evaluation. Review priority skill requirements below.'
                  : 'Significant skill gap identified against verified benchmarks.'
              }
            />

            {/* Skill Requirements Matrix */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-mono font-semibold uppercase text-[#6B7280]">Required Skills & Key Topics</h3>
              <div className="space-y-3">
                {readinessData?.skillBreakdown ? (
                  readinessData.skillBreakdown.map((req, idx) => (
                    <div key={idx} className="bg-[#F8F9FA] p-4 rounded border border-[#E5E7EB] space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {req.isMet ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          )}
                          <span className="text-xs font-bold text-[#1F2937]">{req.skillName}</span>
                          <Badge variant={req.priority === 'HIGH' ? 'error' : 'neutral'} size="sm">
                            {req.priority}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-mono text-[#1F2937] font-bold">
                            Score: {req.studentScore} / Target: {req.requiredScore}+
                          </span>
                        </div>
                      </div>

                      {(() => {
                        const matchingMetric = profile?.skillMetrics?.find(
                          (sm) =>
                            sm.skillName.toLowerCase() === req.skillName.toLowerCase() ||
                            req.skillName.toLowerCase().includes(sm.skillName.toLowerCase()) ||
                            sm.skillName.toLowerCase().includes(req.skillName.toLowerCase())
                        );

                        if (matchingMetric) {
                          return (
                            <div className="flex items-center space-x-3 text-[11px] font-mono text-[#4B5563] pt-1">
                              <span>Verified Depth Score: <strong className="text-[#1F2937]">{Math.round(matchingMetric.verifiedDepthScore)}/100</strong></span>
                              <span>• Max Diff: <strong className="text-[#1F2937]">{matchingMetric.maxProjectDifficulty}/10</strong></span>
                              <span>• Repos: <strong className="text-[#1F2937]">{matchingMetric.frequencyCount}</strong></span>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {req.topics && req.topics.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {req.topics.map((top) => (
                            <span key={top} className="bg-[#FFFFFF] border border-[#E5E7EB] text-[11px] font-mono text-[#374151] px-2 py-0.5 rounded">
                              {top}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  selectedCompany.requirements.map((req) => (
                    <div key={req.id} className="bg-[#F8F9FA] p-4 rounded border border-[#E5E7EB] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#1F2937]">{req.skillName}</span>
                        <span className="text-xs font-mono text-[#6B7280]">Target: {req.minScore}+</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Company Targeted Action Plan */}
          <div className="bg-[#FFFFFF] border border-[#E5E7EB] p-6 rounded-lg space-y-4 shadow-xs">
            <h2 className="text-sm font-bold text-[#1F2937] border-b border-[#E5E7EB] pb-3 flex items-center space-x-2">
              <Lightbulb className="w-4 h-4 text-amber-600" />
              <span>Target Preparation Strategy</span>
            </h2>

            <div className="space-y-3 text-xs">
              {readinessData?.recommendedActions && readinessData.recommendedActions.length > 0 ? (
                readinessData.recommendedActions.map((action, idx) => (
                  <div key={idx} className="bg-[#F8F9FA] p-3.5 rounded border border-[#E5E7EB] space-y-1">
                    <span className="font-semibold text-[#1F2937]">Step {idx + 1}</span>
                    <p className="text-[#6B7280]">{action}</p>
                  </div>
                ))
              ) : (
                <div className="bg-[#F8F9FA] p-3.5 rounded border border-[#E5E7EB] space-y-1">
                  <span className="font-semibold text-[#1F2937]">Online Assessment</span>
                  <p className="text-[#6B7280]">
                    Maintain daily problem solving on targeted algorithmic patterns.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
