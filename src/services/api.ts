import axios from 'axios';
import {
  StudentProfile,
  TargetCompany,
  ActionItem,
  ProjectRecommendation,
  User,
  SkillSnapshot,
  CodingProfile,
  GitHubProfile,
  AgentToolTrace,
  LearningPlan,
} from '../types';

const rawApiUrl = (import.meta.env.VITE_API_URL as string | undefined) || '';
const baseURL = rawApiUrl ? `${rawApiUrl.replace(/\/+$/, '')}/api` : '/api';

export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('preptrack_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Strongly-typed API client services matching backend routes

export const authApi = {
  login: async (credentials: { email: string; password: string }): Promise<{ token: string; user: User }> => {
    const res = await api.post('/auth/login', credentials);
    return res.data;
  },
  register: async (data: {
    name: string;
    email: string;
    password: string;
    department?: string;
    branch?: string;
    passoutYear?: number;
  }): Promise<{ token: string; user: User }> => {
    const res = await api.post('/auth/register', data);
    return res.data;
  },
  getMe: async (): Promise<{ user: User; studentProfileId?: string }> => {
    const res = await api.get('/auth/me');
    return res.data;
  },
};

export const profileApi = {
  getProfile: async (): Promise<{ profile: StudentProfile }> => {
    const res = await api.get('/profile');
    return res.data;
  },
  syncPlatforms: async (urls?: {
    githubUrl?: string;
    leetcodeUrl?: string;
    codechefUrl?: string;
    hackerrankUrl?: string;
    linkedinUrl?: string;
  }): Promise<{ profile: StudentProfile; message: string }> => {
    const res = await api.post('/profile/sync', urls || {});
    return res.data;
  },
  uploadResume: async (file: File): Promise<{ resumeUrl: string; message: string }> => {
    const formData = new FormData();
    formData.append('resume', file);
    const res = await api.post('/profile/upload-resume', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  completeOnboarding: async (data: {
    resumeText?: string;
    resumeFileName?: string;
    targetRole?: string;
    handles?: Record<string, string>;
  }): Promise<{ success: boolean; message: string; onboardingCompleted: boolean; parsedResume?: any }> => {
    const res = await api.post('/profile/onboarding-complete', data);
    return res.data;
  },
  getResume: async (): Promise<{ hasResume: boolean; resume: any }> => {
    const res = await api.get('/profile/resume');
    return res.data;
  },
  submitResumeText: async (data: { rawText: string; fileName?: string }): Promise<any> => {
    const res = await api.post('/profile/resume', data);
    return res.data;
  },
  getAnalysis: async (): Promise<any> => {
    const res = await api.get('/profile/analysis');
    return res.data;
  },
};

export const companyApi = {
  getCompanies: async (): Promise<{ companies: TargetCompany[] }> => {
    const res = await api.get('/companies');
    return res.data;
  },
  getCompany: async (id: string): Promise<{ company: TargetCompany }> => {
    const res = await api.get(`/companies/${id}`);
    return res.data;
  },
  getCompanyReadiness: async (id: string): Promise<{
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
  }> => {
    const res = await api.get(`/companies/${id}/readiness`);
    return res.data;
  },
  getAllCompaniesReadiness: async (): Promise<{ readinessScores: any[] }> => {
    const res = await api.get('/companies/readiness/all');
    return res.data;
  },
};

export const projectApi = {
  getRecommendations: async (): Promise<{ projects: ProjectRecommendation[] }> => {
    const res = await api.get('/projects/recommendations');
    return res.data;
  },
};

export const actionApi = {
  getActions: async (): Promise<{ actions: ActionItem[] }> => {
    const res = await api.get('/actions');
    return res.data;
  },
  toggleAction: async (id: string): Promise<{ success: boolean; action: ActionItem }> => {
    const res = await api.post(`/actions/${id}/complete`);
    return res.data;
  },
  createAction: async (data: {
    title: string;
    category?: string;
    priority?: 'HIGH' | 'MEDIUM' | 'LOW';
    estimatedHours?: number;
    reason?: string;
  }): Promise<{ action: ActionItem }> => {
    const res = await api.post('/actions', data);
    return res.data;
  },
};

export const trackRecordApi = {
  getTrackRecord: async (): Promise<{
    snapshots: SkillSnapshot[];
    activitySnapshots: any[];
    codingProfiles: CodingProfile[];
    githubProfile?: GitHubProfile;
  }> => {
    const res = await api.get('/track-record');
    return res.data;
  },
};

export const agentApi = {
  chat: async (message: string): Promise<{
    sessionId: string;
    message: string;
    plan?: LearningPlan;
    actions?: ActionItem[];
    toolCalls?: AgentToolTrace[];
  }> => {
    const res = await api.post('/agent/chat', { message });
    return res.data;
  },
  applyPlan: async (plan: LearningPlan): Promise<{ success: boolean; count: number; tasksCreated: number }> => {
    const res = await api.post('/agent/plan/apply', { plan });
    return res.data;
  },
  getHistory: async (): Promise<{ sessions: any[] }> => {
    const res = await api.get('/agent/history');
    return res.data;
  },
  getSession: async (): Promise<{ messages: any[]; plan?: LearningPlan }> => {
    const res = await api.get('/agent/session');
    return res.data;
  },
};

export const adminApi = {
  getDashboard: async (): Promise<any> => {
    const res = await api.get('/admin/dashboard');
    return res.data;
  },
  getStudents: async (params?: { department?: string; sort?: string }): Promise<any> => {
    const res = await api.get('/admin/students', { params });
    return res.data;
  },
};
