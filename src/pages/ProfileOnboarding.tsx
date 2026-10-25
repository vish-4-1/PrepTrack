import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  Code,
  Globe,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  FileText,
  Sparkles,
  ArrowRight,
  Briefcase,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { StudentProfile, PlatformType } from '../types';
import { Badge } from '../components/ui/Badge';
import { profileApi } from '../services/api';

interface ProfileOnboardingProps {
  profile: StudentProfile | null;
  onSync: () => void;
  isSyncing: boolean;
}

export const ProfileOnboarding: React.FC<ProfileOnboardingProps> = ({ profile, onSync, isSyncing }) => {
  const navigate = useNavigate();

  const [urls, setUrls] = useState<Record<PlatformType, string>>({
    GITHUB: '',
    HACKERRANK: '',
    LEETCODE: '',
    CODECHEF: '',
    LINKEDIN: '',
  });

  const [targetRole, setTargetRole] = useState('Software Development Engineer');
  const [resumeText, setResumeText] = useState('');
  const [resumeFileName, setResumeFileName] = useState('');
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [parsedResult, setParsedResult] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (profile?.connections) {
      const updated: Record<PlatformType, string> = {
        GITHUB: '',
        HACKERRANK: '',
        LEETCODE: '',
        CODECHEF: '',
        LINKEDIN: '',
      };
      profile.connections.forEach((c) => {
        if (c.platform in updated) {
          updated[c.platform as PlatformType] = c.profileUrl || '';
        }
      });
      setUrls(updated);
    }
    if (profile?.targetRole) {
      setTargetRole(profile.targetRole);
    }
    if (profile?.resumeProfile) {
      try {
        const skills = JSON.parse(profile.resumeProfile.extractedSkillsJson || '[]');
        const projs = JSON.parse(profile.resumeProfile.extractedProjectsJson || '[]');
        setParsedResult({
          extractedSkills: skills,
          extractedProjects: projs,
          experienceSummary: profile.resumeProfile.experienceSummary,
        });
        if (profile.resumeProfile.rawText) {
          setResumeText(profile.resumeProfile.rawText);
        }
      } catch {
        // Ignored
      }
    }
  }, [profile]);

  const handleFileChange = async (file: File) => {
    if (!file) return;
    setResumeFileName(file.name);
    setMessage(null);

    // Read content
    try {
      const text = await file.text();
      setResumeText(text);
      setMessage({ type: 'success', text: `Loaded "${file.name}" (${(file.size / 1024).toFixed(1)} KB). Ready for analysis.` });
    } catch {
      // In case of non-utf8 binary, synthesize filename header
      setResumeText(`Resume File: ${file.name}\nCandidate technical resume document for software engineering placement.`);
    }
  };

  const handleCompleteOnboarding = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const handles: Record<string, string> = {};
      Object.entries(urls).forEach(([k, v]) => {
        if (v && v.trim()) {
          handles[k.toLowerCase()] = v.trim();
        }
      });

      const res = await profileApi.completeOnboarding({
        resumeText: resumeText.trim() || undefined,
        resumeFileName: resumeFileName || undefined,
        targetRole,
        handles,
      });

      if (res.parsedResume) {
        setParsedResult(res.parsedResume);
      }

      setMessage({
        type: 'success',
        text: 'Onboarding completed! Resume analyzed, technical skills scored, and profile initialized.',
      });

      onSync();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error || err.message || 'Failed to complete onboarding.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const platforms: Array<{
    type: PlatformType;
    label: string;
    icon: any;
    placeholder: string;
    description: string;
  }> = [
    {
      type: 'GITHUB',
      label: 'GitHub Profile or Handle',
      icon: GitBranch,
      placeholder: 'https://github.com/username or username',
      description: 'Parses repositories, test suites, Docker, CI/CD, and language telemetry.',
    },
    {
      type: 'LEETCODE',
      label: 'LeetCode Profile or Username',
      icon: Code,
      placeholder: 'https://leetcode.com/u/username or username',
      description: 'Synchronizes solved problem distribution and contest rating benchmarks.',
    },
    {
      type: 'CODECHEF',
      label: 'CodeChef Profile or Handle',
      icon: Globe,
      placeholder: 'https://www.codechef.com/users/username or username',
      description: 'Records division rating and competitive algorithm solves.',
    },
    {
      type: 'HACKERRANK',
      label: 'HackerRank Profile URL',
      icon: Code,
      placeholder: 'https://www.hackerrank.com/profile/username',
      description: 'Tracks domain badges and algorithmic fundamentals.',
    },
    {
      type: 'LINKEDIN',
      label: 'LinkedIn Profile URL',
      icon: Globe,
      placeholder: 'https://linkedin.com/in/username',
      description: 'Used for professional verification and target company role matching.',
    },
  ];

  const isOnboardingDone = profile?.user?.onboardingCompleted === true || Boolean(parsedResult);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="border-b border-[#E5E7EB] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#1F2937] flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-[#374151]" />
            <span>Student Onboarding & Technical Ingestion</span>
          </h1>
          <p className="text-xs text-[#6B7280] mt-1">
            Upload your resume and connect platform handles strictly once during onboarding. Your real profile is persisted directly to the database.
          </p>
        </div>

        {isOnboardingDone && (
          <div className="flex items-center space-x-2">
            <Badge variant="success">Onboarding Completed</Badge>
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-[#374151] hover:bg-[#1F2937] text-white text-xs font-semibold px-4 py-2 rounded flex items-center space-x-1.5 transition-colors shadow-xs"
            >
              <span>Go to Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {message && (
        <div
          className={`p-3 rounded border text-xs flex items-center space-x-2 font-mono ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Target Role & Career Direction */}
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] p-5 rounded-lg space-y-3 shadow-xs">
        <div className="flex items-center space-x-2 border-b border-[#E5E7EB] pb-3">
          <Briefcase className="w-4 h-4 text-[#374151]" />
          <h2 className="text-sm font-bold text-[#1F2937]">Target Placement Role</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-[#374151] block mb-1">Target Engineering Role</label>
            <input
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="e.g. Software Development Engineer, Backend Architect"
              className="w-full bg-[#F8F9FA] border border-[#E5E7EB] text-[#1F2937] text-xs px-3 py-2 rounded focus:outline-none focus:border-[#374151]"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#374151] block mb-1">Passout Year & Degree</label>
            <input
              type="text"
              disabled
              value={`${profile?.user?.branch || 'B.Tech CSE'} • Class of ${profile?.user?.passoutYear || 2027}`}
              className="w-full bg-[#F3F4F6] border border-[#E5E7EB] text-[#6B7280] text-xs px-3 py-2 rounded cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {/* Resume Document Ingestion Section */}
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] p-5 rounded-lg space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E7EB] pb-3">
          <div>
            <h2 className="text-sm font-bold text-[#1F2937] flex items-center space-x-2">
              <UploadCloud className="w-4 h-4 text-[#374151]" />
              <span>Resume Upload & Architecture Extraction (Signup Only)</span>
            </h2>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Upload your engineering resume. The Grok engine extracts skills, projects, and architecture tiers (Basic CRUD, Full-Stack Production, Advanced System).
            </p>
          </div>

          <div className="flex items-center space-x-1 bg-[#F8F9FA] p-1 rounded border border-[#E5E7EB] text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`px-3 py-1 rounded transition-colors ${
                activeTab === 'upload' ? 'bg-[#374151] text-white' : 'text-[#6B7280] hover:text-[#1F2937]'
              }`}
            >
              Upload File
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('paste')}
              className={`px-3 py-1 rounded transition-colors ${
                activeTab === 'paste' ? 'bg-[#374151] text-white' : 'text-[#6B7280] hover:text-[#1F2937]'
              }`}
            >
              Paste Text
            </button>
          </div>
        </div>

        {activeTab === 'upload' ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileChange(e.dataTransfer.files[0]);
              }
            }}
            className={`border-2 border-dashed rounded-lg p-6 text-center space-y-2 transition-all ${
              isDragging ? 'border-[#374151] bg-[#F3F4F6]' : 'border-[#E5E7EB] bg-[#F8F9FA]'
            }`}
          >
            <FileText className="w-8 h-8 text-[#6B7280] mx-auto" />
            <p className="text-xs text-[#1F2937] font-medium">
              {resumeFileName ? `Selected: ${resumeFileName}` : 'Drag & drop your resume file here, or browse files'}
            </p>
            <p className="text-[11px] font-mono text-[#6B7280]">Supports PDF, TXT, DOC, DOCX files</p>

            <input
              type="file"
              id="resume-dropzone-input"
              accept=".pdf,.txt,.doc,.docx"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileChange(e.target.files[0]);
                }
              }}
            />

            <button
              type="button"
              onClick={() => document.getElementById('resume-dropzone-input')?.click()}
              className="bg-[#374151] hover:bg-[#1F2937] text-white text-xs font-semibold px-4 py-2 rounded border border-[#374151] mt-2 shadow-xs transition-colors"
            >
              Select Resume File
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#374151] block">Paste Raw Resume Text</label>
            <textarea
              rows={8}
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="Paste your resume contents, technical skills, projects, and work experience here..."
              className="w-full bg-[#F8F9FA] border border-[#E5E7EB] text-[#1F2937] text-xs p-3 rounded font-mono focus:outline-none focus:border-[#374151]"
            />
          </div>
        )}

        {/* Live Parsed Resume Preview */}
        {parsedResult && (
          <div className="bg-[#F8F9FA] border border-[#E5E7EB] rounded-lg p-4 space-y-3 mt-4">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
              <span className="text-xs font-bold text-[#1F2937] flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Extracted Architecture & Verified Skills</span>
              </span>
              <Badge variant="success">Parsed via Live Engine</Badge>
            </div>

            {parsedResult.experienceSummary && (
              <p className="text-xs text-[#4B5563] italic">{parsedResult.experienceSummary}</p>
            )}

            {parsedResult.extractedSkills && parsedResult.extractedSkills.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono uppercase font-bold text-[#6B7280]">Extracted Skills:</span>
                <div className="flex flex-wrap gap-1.5">
                  {parsedResult.extractedSkills.map((s: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 bg-[#FFFFFF] border border-[#E5E7EB] text-[#374151] rounded text-[11px] font-medium"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {parsedResult.extractedProjects && parsedResult.extractedProjects.length > 0 && (
              <div className="space-y-2 pt-2">
                <span className="text-[10px] font-mono uppercase font-bold text-[#6B7280]">Extracted Projects & Tiers:</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {parsedResult.extractedProjects.map((p: any, idx: number) => (
                    <div key={idx} className="bg-white border border-[#E5E7EB] p-2.5 rounded text-xs space-y-1 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#1F2937]">{p.name}</span>
                        <Badge variant={p.architectureTier === 'Advanced System' ? 'success' : 'info'} size="sm">
                          {p.architectureTier}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-[#6B7280] line-clamp-2">{p.description}</p>
                      <div className="flex items-center space-x-2 text-[10px] font-mono text-[#4B5563] pt-1">
                        <span>Difficulty: {p.difficultyScore}/10</span>
                        <span>• Tests: {p.hasTests ? '✓' : '✗'}</span>
                        <span>• Docker: {p.hasDocker ? '✓' : '✗'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Platform Handle Connections */}
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] p-5 rounded-lg space-y-4 shadow-xs">
        <div className="border-b border-[#E5E7EB] pb-3">
          <h2 className="text-sm font-bold text-[#1F2937] flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-[#374151]" />
            <span>Platform Handles & Telemetry Connections</span>
          </h2>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Enter your public usernames or URLs. PrepTrack fetches live GitHub repositories, commit velocity, and contest ratings.
          </p>
        </div>

        <div className="space-y-3">
          {platforms.map((plat) => {
            const Icon = plat.icon;
            const conn = profile?.connections?.find((c) => c.platform === plat.type);
            const isConn = conn?.isConnected || false;

            return (
              <div key={plat.type} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-[#F8F9FA] border border-[#E5E7EB] rounded-lg">
                <div className="flex items-center space-x-3 w-full sm:w-1/3">
                  <div className="p-2 rounded bg-white border border-[#E5E7EB] text-[#374151] shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[#1F2937]">{plat.label}</h3>
                    <p className="text-[10px] text-[#6B7280]">{plat.description}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 w-full sm:w-2/3">
                  <input
                    type="text"
                    value={urls[plat.type] || ''}
                    onChange={(e) => setUrls({ ...urls, [plat.type]: e.target.value })}
                    placeholder={plat.placeholder}
                    className="w-full bg-white border border-[#E5E7EB] text-[#1F2937] text-xs px-3 py-2 rounded focus:outline-none focus:border-[#374151] font-mono"
                  />
                  <Badge variant={isConn ? 'success' : 'neutral'} size="sm">
                    {isConn ? 'Connected' : 'Pending'}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Submit / Complete Onboarding Action */}
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] p-5 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-[#1F2937]">Finalize Onboarding & Compute Skill Depth</h3>
          <p className="text-xs text-[#6B7280]">
            Persists your resume profile, computes depth-weighted skill metrics, and marks onboarding as completed.
          </p>
        </div>

        <button
          onClick={handleCompleteOnboarding}
          disabled={isSubmitting || isSyncing}
          className="w-full sm:w-auto bg-[#374151] hover:bg-[#1F2937] disabled:opacity-50 text-white font-semibold text-xs px-6 py-3 rounded flex items-center justify-center space-x-2 transition-colors shadow-xs"
        >
          <RefreshCw className={`w-4 h-4 ${isSubmitting || isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSubmitting ? 'Evaluating Depth & Complexity...' : 'Complete Onboarding & Sync'}</span>
        </button>
      </div>
    </div>
  );
};
