import React from 'react';
import { RefreshCw, User } from 'lucide-react';
import { StudentProfile } from '../../types';

interface TopbarProps {
  profile: StudentProfile | null;
  onSync: () => void;
  isSyncing: boolean;
  isLoading?: boolean;
}

export const Topbar: React.FC<TopbarProps> = ({ profile, onSync, isSyncing, isLoading }) => {
  const studentName = profile?.user?.name || (isLoading ? 'Loading profile...' : 'Student Candidate');
  const studentDepartment = profile?.user?.department || profile?.user?.branch || 'Engineering';
  const readinessIndex = profile?.placementReadiness !== undefined ? Math.round(profile.placementReadiness) : null;

  return (
    <header className="h-16 bg-[#FFFFFF] border-b border-[#E5E7EB] px-6 flex items-center justify-between shrink-0 shadow-xs">
      {/* Telemetry Status Bar */}
      <div className="flex items-center space-x-3 text-xs font-mono">
        <span className="flex items-center space-x-1.5 bg-[#F8F9FA] px-2.5 py-1 rounded border border-[#E5E7EB] text-[#374151]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="font-medium text-[#1F2937]">Live Telemetry Engine Active</span>
        </span>

        {readinessIndex !== null && (
          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded text-[11px] font-semibold">
            PRI: {readinessIndex}/100
          </span>
        )}
      </div>

      {/* Profile Actions */}
      <div className="flex items-center space-x-4">
        {/* Sync Button */}
        <button
          onClick={onSync}
          disabled={isSyncing || isLoading}
          className="flex items-center space-x-2 bg-[#374151] hover:bg-[#1F2937] disabled:opacity-50 text-white text-xs font-medium px-3.5 py-1.5 rounded border border-[#374151] transition-colors shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Syncing Profiles...' : 'Sync Telemetry'}</span>
        </button>

        <div className="h-4 w-[1px] bg-[#E5E7EB]"></div>

        {/* User Card */}
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-full bg-[#F8F9FA] border border-[#E5E7EB] flex items-center justify-center text-[#374151] font-semibold text-xs font-mono">
            {profile?.user?.name ? profile.user.name.charAt(0) : <User className="w-4 h-4" />}
          </div>
          <div className="text-xs">
            <p className="font-semibold text-[#1F2937] leading-tight">{studentName}</p>
            <p className="text-[11px] text-[#6B7280] font-mono leading-tight">{studentDepartment}</p>
          </div>
        </div>
      </div>
    </header>
  );
};
