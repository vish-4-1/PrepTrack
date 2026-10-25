import React, { useState, useEffect } from 'react';
import { ShieldAlert, Users, TrendingUp, AlertTriangle, Filter, Lock, RefreshCw } from 'lucide-react';
import { StatCard } from '../components/ui/StatCard';
import { Badge } from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { api } from '../services/api';

interface AdminDashboardData {
  overview: {
    totalStudents: number;
    averageReadiness: number;
    studentsRequiringIntervention: number;
    topSkillCategory: string;
  };
  departmentBreakdown: Array<{
    department: string;
    studentCount: number;
    averageReadiness: number;
  }>;
  interventionList: Array<{
    id: string;
    name: string;
    email: string;
    department: string;
    branch?: string;
    placementReadiness: number;
    primaryGap: string;
  }>;
}

interface StudentRecord {
  id: string;
  placementReadiness: number;
  user: {
    id: string;
    name: string;
    email: string;
    department: string;
    branch?: string;
    passoutYear?: number;
  };
}

export const AdminDashboard: React.FC = () => {
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(null);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const fetchAdminData = async () => {
    try {
      setIsLoading(true);
      setAuthError(null);

      const [dashRes, studentsRes] = await Promise.allSettled([
        api.get('/admin/dashboard'),
        api.get('/admin/students'),
      ]);

      if (dashRes.status === 'fulfilled' && dashRes.value.data) {
        setDashboardData(dashRes.value.data);
      } else if (dashRes.status === 'rejected') {
        const err = dashRes.reason;
        if (err.response?.status === 403) {
          setAuthError('Admin privileges required. Please log in with a Placement Officer or Institutional Admin account.');
        } else {
          setAuthError(err.message || 'Failed to load institutional telemetry');
        }
      }

      if (studentsRes.status === 'fulfilled' && studentsRes.value.data?.students) {
        setStudents(studentsRes.value.data.students);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const filteredStudents = deptFilter === 'ALL'
    ? students
    : students.filter((s) => s.user?.department === deptFilter);

  if (isLoading && !dashboardData && !authError) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto animate-pulse">
        <div className="h-16 bg-white border border-[#E5E7EB] rounded-lg"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-white border border-[#E5E7EB] rounded-lg"></div>
          ))}
        </div>
        <div className="h-64 bg-white border border-[#E5E7EB] rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Admin Header */}
      <div className="border-b border-[#E5E7EB] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#1F2937] flex items-center space-x-2">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
            <span>Placement Cell Administration Portal</span>
          </h1>
          <p className="text-xs text-[#6B7280] mt-1">
            Institutional overview of student batch placement readiness, department skill gaps, and intervention alerts.
          </p>
        </div>

        <Badge variant="warning">Institutional Admin View</Badge>
      </div>

      {authError ? (
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg p-10 text-center space-y-3 shadow-xs">
          <Lock className="w-10 h-10 text-amber-600 mx-auto" />
          <h2 className="text-base font-bold text-[#1F2937]">Restricted Access</h2>
          <p className="text-xs text-[#6B7280] max-w-md mx-auto">{authError}</p>
          <div className="pt-2">
            <button
              onClick={fetchAdminData}
              className="inline-flex items-center space-x-2 bg-[#374151] hover:bg-[#1F2937] text-white text-xs font-semibold px-4 py-2 rounded"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Admin Authorization</span>
            </button>
          </div>
        </div>
      ) : dashboardData ? (
        <>
          {/* Overview Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              label="Total Tracked Students"
              value={dashboardData.overview.totalStudents}
              subtext="Enrolled batch roster"
              icon={Users}
            />
            <StatCard
              label="Average Readiness Index"
              value={`${dashboardData.overview.averageReadiness}/100`}
              subtext="Verified batch average"
              icon={TrendingUp}
            />
            <StatCard
              label="Requires Intervention"
              value={`${dashboardData.overview.studentsRequiringIntervention} Students`}
              subtext="Readiness Index < 65"
              icon={AlertTriangle}
            />
            <StatCard
              label="Top Skill Category"
              value={dashboardData.overview.topSkillCategory}
              subtext="Highest batch metric"
              icon={ShieldAlert}
            />
          </div>

          {/* Department Readiness Breakdown */}
          {dashboardData.departmentBreakdown && dashboardData.departmentBreakdown.length > 0 && (
            <div className="bg-[#FFFFFF] border border-[#E5E7EB] p-6 rounded-lg space-y-4 shadow-xs">
              <h2 className="text-sm font-bold text-[#1F2937] border-b border-[#E5E7EB] pb-3">
                Department Placement Readiness Comparison
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {dashboardData.departmentBreakdown.map((dept, idx) => (
                  <ProgressBar
                    key={idx}
                    label={`${dept.department} (${dept.studentCount} Students)`}
                    value={dept.averageReadiness}
                    sublabel={`Avg. Readiness: ${dept.averageReadiness}/100`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Student Intervention & Tracking Table */}
          <div className="bg-[#FFFFFF] border border-[#E5E7EB] p-6 rounded-lg space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E7EB] pb-4">
              <div>
                <h2 className="text-sm font-bold text-[#1F2937]">Student Readiness Roster</h2>
                <p className="text-xs text-[#6B7280] mt-0.5">Filter by department to identify students requiring targeted intervention.</p>
              </div>

              {/* Department Filter */}
              <div className="flex items-center space-x-2">
                <Filter className="w-3.5 h-3.5 text-[#6B7280]" />
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="bg-[#F8F9FA] border border-[#E5E7EB] text-xs font-mono text-[#1F2937] px-3 py-1.5 rounded focus:outline-none focus:border-[#374151]"
                >
                  <option value="ALL">All Departments</option>
                  {dashboardData.departmentBreakdown.map((d, i) => (
                    <option key={i} value={d.department}>
                      {d.department}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Scannable Data Table */}
            {filteredStudents.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#6B7280]">
                No student profiles recorded for the selected department filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono border-collapse">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] text-[#6B7280] uppercase text-[11px]">
                      <th className="py-2.5 px-3">Student Name</th>
                      <th className="py-2.5 px-3">Department</th>
                      <th className="py-2.5 px-3">Readiness Index</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB] text-[#1F2937]">
                    {filteredStudents.map((std) => {
                      const score = Math.round(std.placementReadiness || 0);
                      const status = score >= 80 ? 'EXCELLENT' : score < 65 ? 'INTERVENTION' : 'NORMAL';

                      return (
                        <tr key={std.id} className="hover:bg-[#F8F9FA] transition-colors">
                          <td className="py-3 px-3">
                            <span className="font-semibold text-[#1F2937] block">{std.user?.name || 'Candidate'}</span>
                            <span className="text-[10px] text-[#6B7280]">{std.user?.email}</span>
                          </td>
                          <td className="py-3 px-3">{std.user?.department || 'Engineering'}</td>
                          <td className="py-3 px-3 font-bold text-[#1F2937]">{score}/100</td>
                          <td className="py-3 px-3">
                            <Badge
                              variant={
                                status === 'EXCELLENT'
                                  ? 'success'
                                  : status === 'INTERVENTION'
                                  ? 'error'
                                  : 'info'
                              }
                            >
                              {status}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg p-12 text-center space-y-3 shadow-xs">
          <Users className="w-10 h-10 text-[#9CA3AF] mx-auto" />
          <h2 className="text-base font-bold text-[#1F2937]">No Institutional Data Available</h2>
          <p className="text-xs text-[#6B7280] max-w-md mx-auto">
            Student placement candidate records have not yet been synchronized.
          </p>
        </div>
      )}
    </div>
  );
};
