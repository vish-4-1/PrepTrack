import React, { useState, useEffect } from 'react';
import { CheckSquare, Square, Clock, Lightbulb, CheckCircle2, RefreshCw, AlertCircle } from 'lucide-react';
import { ActionItem, StudentProfile } from '../types';
import { Badge } from '../components/ui/Badge';
import { actionApi } from '../services/api';

interface ActionCenterProps {
  profile: StudentProfile | null;
  onRefresh: () => void;
}

export const ActionCenter: React.FC<ActionCenterProps> = ({ profile, onRefresh }) => {
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await actionApi.getActions();
      if (res.actions) {
        setActions(res.actions);
      } else if (profile?.actionItems) {
        setActions(profile.actionItems);
      } else {
        setActions([]);
      }
    } catch (err: any) {
      if (profile?.actionItems && profile.actionItems.length > 0) {
        setActions(profile.actionItems);
      } else {
        setError(err.response?.data?.error || err.message || 'Failed to fetch action tasks');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActions();
  }, [profile]);

  const toggleAction = async (id: string) => {
    setActions((prev) =>
      prev.map((act) =>
        act.id === id
          ? {
              ...act,
              completed: !act.completed,
              completedAt: !act.completed ? new Date().toISOString() : undefined,
            }
          : act
      )
    );

    try {
      await actionApi.toggleAction(id);
      onRefresh();
    } catch (err) {
      console.error('Failed to toggle action status:', err);
    }
  };

  const completedCount = actions.filter((a) => a.completed).length;

  if (isLoading && actions.length === 0) {
    return (
      <div className="space-y-4 max-w-5xl mx-auto animate-pulse">
        <div className="h-16 bg-white border border-[#E5E7EB] rounded-lg"></div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-white border border-[#E5E7EB] rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error && actions.length === 0) {
    return (
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg p-12 text-center space-y-4 shadow-xs max-w-xl mx-auto mt-8">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-base font-bold text-[#1F2937]">Unable to Load Action Center</h2>
        <p className="text-xs text-[#6B7280]">{error}</p>
        <button
          onClick={fetchActions}
          className="inline-flex items-center space-x-2 bg-[#374151] hover:bg-[#1F2937] text-white text-xs font-semibold px-4 py-2 rounded transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Loading Actions</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="border-b border-[#E5E7EB] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#1F2937] flex items-center space-x-2">
            <CheckSquare className="w-5 h-5 text-[#374151]" />
            <span>Action Center</span>
          </h1>
          <p className="text-xs text-[#6B7280] mt-1">
            Prioritized concrete next steps tailored to your specific skill gaps and target company profiles.
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs font-mono">
          <Badge variant="success">Completed: {completedCount}/{actions.length}</Badge>
        </div>
      </div>

      {/* Action Items List */}
      {actions.length === 0 ? (
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg p-12 text-center space-y-3 shadow-xs">
          <CheckSquare className="w-10 h-10 text-[#9CA3AF] mx-auto" />
          <h2 className="text-base font-bold text-[#1F2937]">No Action Items Assigned</h2>
          <p className="text-xs text-[#6B7280] max-w-md mx-auto">
            Your action center is currently empty. Synchronize your online platforms or consult your AI Placement Coach to generate high-impact practice items.
          </p>
          <button
            onClick={onRefresh}
            className="mt-2 inline-flex items-center space-x-2 bg-[#374151] hover:bg-[#1F2937] text-white text-xs font-semibold px-4 py-2 rounded transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Generate Action Items via Sync</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {actions.map((action) => (
            <div
              key={action.id}
              onClick={() => toggleAction(action.id)}
              className={`p-4 rounded-lg border transition-all cursor-pointer ${
                action.completed
                  ? 'bg-[#F8F9FA] border-[#E5E7EB] opacity-70'
                  : 'bg-[#FFFFFF] border-[#E5E7EB] hover:border-[#D1D5DB] shadow-xs'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start space-x-3">
                  <button className="mt-0.5 text-[#6B7280] hover:text-[#1F2937] transition-colors" type="button">
                    {action.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <Square className="w-5 h-5 text-[#9CA3AF]" />
                    )}
                  </button>

                  <div className="space-y-1">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <span className={`text-sm font-bold ${action.completed ? 'line-through text-[#6B7280]' : 'text-[#1F2937]'}`}>
                        {action.title}
                      </span>
                      <Badge variant={action.priority === 'HIGH' ? 'error' : 'warning'} size="sm">
                        {action.priority}
                      </Badge>
                      <Badge variant="neutral" size="sm">
                        {action.category}
                      </Badge>
                    </div>

                    <div className="bg-[#F8F9FA] p-2.5 rounded border border-[#E5E7EB] text-xs text-[#374151] flex items-start space-x-2">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span>{action.reason}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-1 text-xs font-mono text-[#6B7280] shrink-0 bg-[#F8F9FA] px-2.5 py-1 rounded border border-[#E5E7EB]">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Est. {action.estimatedHours}h</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
