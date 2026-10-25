import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  UserCheck,
  TrendingUp,
  CheckSquare,
  Code2,
  Building2,
  Sparkles,
  Bot,
  ShieldAlert,
} from 'lucide-react';
import { env } from '../../config/env';

interface SidebarProps {
  isAdminMode?: boolean;
  onToggleAdminMode?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isAdminMode, onToggleAdminMode }) => {
  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { label: 'AI Placement Coach', icon: Bot, path: '/coach' },
    { label: 'Build Your Profile', icon: UserCheck, path: '/onboarding' },
    { label: 'Track Record', icon: TrendingUp, path: '/track-record' },
    { label: 'Action Center', icon: CheckSquare, path: '/actions' },
    { label: 'Build Next', icon: Code2, path: '/build-next' },
    { label: 'Target Companies', icon: Building2, path: '/companies' },
    { label: 'Admin Portal', icon: ShieldAlert, path: '/admin' },
  ];

  return (
    <aside className="w-64 bg-[#FFFFFF] border-r border-[#E5E7EB] flex flex-col justify-between shrink-0 select-none shadow-sm">
      <div>
        {/* App Title Header */}
        <div className="h-16 flex items-center px-5 border-b border-[#E5E7EB] space-x-3 bg-[#FFFFFF]">
          <div className="w-8 h-8 rounded bg-[#374151] flex items-center justify-center text-white font-mono font-bold text-sm tracking-wider">
            PT
          </div>
          <div>
            <h1 className="font-bold text-[#1F2937] tracking-tight text-base leading-none">{env.VITE_APP_NAME}</h1>
            <p className="text-[11px] text-[#6B7280] font-mono mt-0.5">Career Intelligence</p>
          </div>
        </div>

        {/* Navigation Section */}
        <nav className="p-3 space-y-1">
          <div className="px-3 py-2 text-[11px] font-mono font-semibold uppercase tracking-wider text-[#6B7280]">
            Student Workspace
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3 py-2 rounded text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-[#374151] text-white font-semibold'
                      : 'text-[#374151] hover:bg-[#F3F4F6] hover:text-[#1F2937]'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-[#E5E7EB] bg-[#F8F9FA] space-y-2">
        <div className="bg-[#FFFFFF] p-2.5 rounded border border-[#E5E7EB] text-[11px] font-mono text-[#6B7280] flex items-center justify-between shadow-xs">
          <span className="flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#374151]" />
            <span>AI Reasoning</span>
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            Active
          </span>
        </div>
      </div>
    </aside>
  );
};
