import React, { useState, useEffect } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
  Target,
  RefreshCw,
  Award,
} from 'lucide-react';
import { StudentProfile, AgentChatMessage, LearningPlan } from '../types';
import { agentApi } from '../services/api';
import { Badge } from '../components/ui/Badge';

interface CoachProps {
  profile: StudentProfile | null;
  onRefreshProfile?: () => void;
}

export const Coach: React.FC<CoachProps> = ({ profile, onRefreshProfile }) => {
  const [messages, setMessages] = useState<AgentChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'agent',
      text: `### 🤖 Welcome to your AI Placement Coach!\n\nI monitor your verified telemetry and deterministic skill scores across **DSA**, **Development**, **DBMS**, and **System Architecture**.\n\nAsk me anything about your placement preparation, company benchmarks, or week-by-week strategy!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activePlan, setActivePlan] = useState<LearningPlan | null>(null);
  const [planApplied, setPlanApplied] = useState(false);
  const [appliedCount, setAppliedCount] = useState(0);

  useEffect(() => {
    const loadSessionHistory = async () => {
      try {
        const session = await agentApi.getSession();
        if (session?.messages && session.messages.length > 0) {
          const loaded: AgentChatMessage[] = session.messages.map((m: any) => ({
            id: m.id || `msg-${Date.now()}-${Math.random()}`,
            sender: m.role === 'user' ? 'user' : 'agent',
            text: m.content || '',
            toolCalls: m.toolCallsJson ? JSON.parse(m.toolCallsJson) : undefined,
            timestamp: m.createdAt
              ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }));
          setMessages(loaded);
        }
        if (session?.plan) {
          setActivePlan(session.plan);
        }
      } catch (err) {
        console.warn('Could not load persistent agent session history:', err);
      }
    };

    loadSessionHistory();
  }, []);

  const quickPrompts = [
    '🎯 What should I focus on this week?',
    '🏢 Prepare me for Amazon',
    '📉 Why is my readiness score at this level?',
    '✅ I completed my DSA practice, what next?',
    '🔄 Refresh my profile and tell me what changed',
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const message = textToSend || inputMessage;
    if (!message.trim() || isLoading) return;

    const userMsg: AgentChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);
    setPlanApplied(false);

    try {
      const data = await agentApi.chat(message);

      const agentMsg: AgentChatMessage = {
        id: `agent-${Date.now()}`,
        sender: 'agent',
        text: data.message || 'Strategic assessment completed.',
        toolCalls: data.toolCalls,
        plan: data.plan,
        actions: data.actions,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, agentMsg]);
      if (data.plan) {
        setActivePlan(data.plan);
      }
      if (message.includes('Refresh') && onRefreshProfile) {
        onRefreshProfile();
      }
    } catch (err: any) {
      const errorMsg: AgentChatMessage = {
        id: `agent-${Date.now()}`,
        sender: 'agent',
        text: `Unable to complete agent consultation: ${err.response?.data?.error || err.message || 'Backend agent service unreachable'}. Please ensure the server is active.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyPlan = async () => {
    if (!activePlan) return;
    try {
      const res = await agentApi.applyPlan(activePlan);
      setPlanApplied(true);
      setAppliedCount(res.count || res.tasksCreated || 0);
      if (onRefreshProfile) {
        onRefreshProfile();
      }
    } catch (err: any) {
      console.error('Failed to apply plan tasks:', err);
    }
  };

  const studentName = profile?.user?.name || 'Student Candidate';
  const studentDepartment = profile?.user?.department || 'Engineering';
  const readiness = profile?.placementReadiness !== undefined ? Math.round(profile.placementReadiness) : 0;
  const connectedCount = profile?.connections?.filter((c) => c.isConnected).length || 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="border-b border-[#E5E7EB] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#1F2937] flex items-center space-x-2">
            <Bot className="w-5 h-5 text-[#374151]" />
            <span>AI Placement Coach & Career Strategist</span>
          </h1>
          <p className="text-xs text-[#6B7280] mt-1">
            Autonomous agent that continuously observes verified telemetry, identifies skill deficits, and dynamically constructs actionable roadmaps.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Badge variant="success">Active Placement Loop</Badge>
          <Badge variant="info">Multi-Step Reasoning</Badge>
        </div>
      </div>

      {/* Student Context Banner */}
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-full bg-[#374151] flex items-center justify-center text-white font-bold font-mono text-sm">
            {studentName.charAt(0)}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="font-bold text-sm text-[#1F2937]">{studentName}</h2>
              <span className="text-xs text-[#6B7280]">({studentDepartment})</span>
            </div>
            <p className="text-xs text-[#6B7280]">
              Target: <span className="font-semibold text-[#1F2937]">{profile?.targetRole || 'Software Development Engineer'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-6 text-xs">
          <div>
            <span className="text-[#6B7280] block text-[11px] uppercase font-mono">Verified PRI</span>
            <span className="font-mono font-bold text-base text-[#1F2937]">{readiness}/100</span>
          </div>
          <div className="h-8 w-[1px] bg-[#E5E7EB]"></div>
          <div>
            <span className="text-[#6B7280] block text-[11px] uppercase font-mono">Connected Telemetry</span>
            <span className="font-semibold text-emerald-600">{connectedCount} Platforms</span>
          </div>
          <div className="h-8 w-[1px] bg-[#E5E7EB]"></div>
          <div>
            <span className="text-[#6B7280] block text-[11px] uppercase font-mono">Scoring Engine</span>
            <span className="font-semibold text-[#374151]">Deterministic</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Chat on Left, Strategic Plan on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Chat Section */}
        <div className="lg:col-span-7 bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg shadow-xs flex flex-col h-[640px]">
          {/* Chat Header */}
          <div className="px-5 py-3.5 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F8F9FA] rounded-t-lg">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-[#374151]" />
              <span className="text-xs font-bold text-[#1F2937]">Coach Consultation & Tool Execution Stream</span>
            </div>
            <span className="text-[11px] font-mono text-[#6B7280]">Observe → Reason → Act</span>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((m) => (
              <div key={m.id} className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[88%] p-4 rounded-lg text-xs leading-relaxed ${
                    m.sender === 'user'
                      ? 'bg-[#374151] text-white'
                      : 'bg-[#F8F9FA] border border-[#E5E7EB] text-[#1F2937]'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.text}</div>

                  {/* Tool Calls Execution Trace */}
                  {m.toolCalls && m.toolCalls.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#E5E7EB] space-y-1.5">
                      <span className="text-[10px] font-mono font-bold uppercase text-[#6B7280] flex items-center space-x-1">
                        <Layers className="w-3 h-3 text-[#6B7280]" />
                        <span>Agent Execution Trace ({m.toolCalls.length} Tools Invoked)</span>
                      </span>
                      <div className="space-y-1">
                        {m.toolCalls.map((tc, idx) => (
                          <div
                            key={idx}
                            className="bg-[#FFFFFF] border border-[#E5E7EB] px-2 py-1 rounded text-[11px] font-mono flex items-center justify-between text-[#374151]"
                          >
                            <span className="truncate max-w-[260px]">{tc.description || tc.toolName}</span>
                            <span className="text-emerald-600 text-[10px] font-bold">✓ EXECUTED</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-[#9CA3AF] mt-1 px-1">{m.timestamp}</span>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center space-x-2 text-xs text-[#6B7280] p-3 bg-[#F8F9FA] rounded border border-[#E5E7EB] max-w-[280px]">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#374151]" />
                <span>Coach observing telemetry & reasoning...</span>
              </div>
            )}
          </div>

          {/* Quick Prompts */}
          <div className="p-2 border-t border-[#E5E7EB] bg-[#F8F9FA] flex gap-1.5 overflow-x-auto text-[11px]">
            {quickPrompts.map((qp, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(qp)}
                disabled={isLoading}
                className="whitespace-nowrap px-2.5 py-1 bg-[#FFFFFF] border border-[#E5E7EB] text-[#374151] rounded hover:bg-[#E5E7EB] hover:text-[#1F2937] transition-all disabled:opacity-50"
              >
                {qp}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <div className="p-3 border-t border-[#E5E7EB] flex items-center space-x-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask your coach (e.g. 'What should I study for Google interview?')"
              disabled={isLoading}
              className="flex-1 text-xs border border-[#E5E7EB] rounded-lg px-3 py-2.5 focus:outline-hidden focus:ring-1 focus:ring-[#374151] bg-[#FFFFFF] text-[#1F2937]"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={isLoading || !inputMessage.trim()}
              className="p-2.5 bg-[#374151] text-white rounded-lg hover:bg-[#1F2937] transition-all disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Section: Strategic Learning Plan */}
        <div className="lg:col-span-5 space-y-5">
          {activePlan ? (
            <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg p-5 shadow-xs space-y-4">
              <div className="border-b border-[#E5E7EB] pb-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-1.5">
                    <Target className="w-4 h-4 text-[#374151]" />
                    <h3 className="font-bold text-sm text-[#1F2937]">Current Strategic Plan</h3>
                  </div>
                  <p className="text-xs text-[#6B7280] mt-0.5">{activePlan.goal}</p>
                </div>
                <Badge variant="info">{activePlan.durationDays} Days</Badge>
              </div>

              {/* Priorities Breakdown */}
              <div className="space-y-2">
                <span className="text-[11px] font-mono uppercase font-bold text-[#6B7280]">Strategic Focus Areas</span>
                <div className="space-y-1.5">
                  {activePlan.priorities.map((p, idx) => (
                    <div key={idx} className="bg-[#F8F9FA] p-2.5 rounded border border-[#E5E7EB] text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#1F2937]">{p.skill}</span>
                        <Badge variant={p.priority === 'HIGH' ? 'error' : 'warning'} size="sm">
                          {p.priority}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-[#6B7280] mt-1">{p.reason}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Daily Roadmap */}
              <div className="space-y-2 pt-1">
                <span className="text-[11px] font-mono uppercase font-bold text-[#6B7280] flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5 text-[#6B7280]" />
                  <span>Day-by-Day Schedule</span>
                </span>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {activePlan.dailyPlan.map((d) => (
                    <div key={d.day} className="bg-[#F8F9FA] p-2.5 rounded border border-[#E5E7EB] text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#374151]">Day {d.day}: {d.focusArea}</span>
                        <span className="text-[10px] font-mono text-[#6B7280]">~{d.estimatedHours}h</span>
                      </div>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px] text-[#6B7280]">
                        {d.tasks.map((t, ti) => (
                          <li key={ti}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              {/* Apply Plan Button */}
              <div className="pt-2 border-t border-[#E5E7EB]">
                {planApplied ? (
                  <div className="flex items-center justify-center space-x-2 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Applied {appliedCount} Tasks to Action Center!</span>
                  </div>
                ) : (
                  <button
                    onClick={handleApplyPlan}
                    className="w-full py-2.5 px-4 bg-[#374151] hover:bg-[#1F2937] text-white text-xs font-semibold rounded transition-all flex items-center justify-center space-x-2"
                  >
                    <span>Start Plan & Sync to Action Center</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg p-6 shadow-xs text-center space-y-3">
              <Award className="w-8 h-8 text-[#374151] mx-auto" />
              <h3 className="font-bold text-sm text-[#1F2937]">No Active Learning Plan</h3>
              <p className="text-xs text-[#6B7280]">
                Ask your coach "What should I focus on this week?" to construct a personalized plan based on your verified telemetry.
              </p>
            </div>
          )}

          {/* Coach Architecture Principles */}
          <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg p-4 shadow-xs text-xs space-y-2">
            <h4 className="font-bold text-[#1F2937] flex items-center space-x-1.5">
              <TrendingUp className="w-4 h-4 text-[#374151]" />
              <span>Placement Agent Guardrails</span>
            </h4>
            <p className="text-[#6B7280] text-[11px] leading-relaxed">
              Objective skill scores are computed deterministically from platform telemetry. The AI Agent reasons over verified data using authorized tools to synthesize actionable roadmaps.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
