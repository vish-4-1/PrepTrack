import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { Dashboard } from './pages/Dashboard';
import { ProfileOnboarding } from './pages/ProfileOnboarding';
import { TrackRecord } from './pages/TrackRecord';
import { ActionCenter } from './pages/ActionCenter';
import { BuildNext } from './pages/BuildNext';
import { CompanyPrep } from './pages/CompanyPrep';
import { AdminDashboard } from './pages/AdminDashboard';
import { Coach } from './pages/Coach';
import { StudentProfile } from './types';
import { api } from './services/api';

export const App: React.FC = () => {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const fetchRealProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      let res;
      try {
        res = await api.get('/profile');
      } catch (err: any) {
        if (err.response?.status === 401 || err.response?.status === 403 || !localStorage.getItem('preptrack_token')) {
          // Initialize session with demo student candidate credentials
          const authRes = await api
            .post('/auth/register', {
              name: 'Candidate Student',
              email: 'student.candidate@preptrack.edu',
              password: 'demopassword123',
              department: 'Computer Science & Engineering',
              branch: 'B.Tech CSE',
              passoutYear: 2027,
            })
            .catch(() =>
              api.post('/auth/login', {
                email: 'student.candidate@preptrack.edu',
                password: 'demopassword123',
              })
            );

          if (authRes.data?.token) {
            localStorage.setItem('preptrack_token', authRes.data.token);
            res = await api.get('/profile');
          }
        }
      }

      if (res?.data?.profile) {
        setProfile(res.data.profile);
      }
    } catch (err) {
      console.error('Failed to retrieve student profile:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRealProfile();
  }, [fetchRealProfile]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await api.post('/profile/sync');
      await fetchRealProfile();
    } catch (err) {
      console.error('Profile synchronization error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Router>
      <div className="flex h-screen bg-[#F8F9FA] text-[#1F2937] overflow-hidden font-sans">
        {/* Navigation Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Topbar
            profile={profile}
            onSync={handleSync}
            isSyncing={isSyncing}
            isLoading={isLoading}
          />

          <main className="flex-1 overflow-y-auto p-6 bg-[#F8F9FA]">
            <Routes>
              <Route
                path="/"
                element={
                  profile && profile.user && profile.user.onboardingCompleted === false ? (
                    <Navigate to="/onboarding" replace />
                  ) : (
                    <Dashboard profile={profile} onSync={handleSync} isSyncing={isSyncing} isLoading={isLoading} />
                  )
                }
              />
              <Route
                path="/dashboard"
                element={
                  profile && profile.user && profile.user.onboardingCompleted === false ? (
                    <Navigate to="/onboarding" replace />
                  ) : (
                    <Dashboard profile={profile} onSync={handleSync} isSyncing={isSyncing} isLoading={isLoading} />
                  )
                }
              />
              <Route path="/coach" element={<Coach profile={profile} onRefreshProfile={handleSync} />} />
              <Route
                path="/onboarding"
                element={<ProfileOnboarding profile={profile} onSync={handleSync} isSyncing={isSyncing} />}
              />
              <Route path="/track-record" element={<TrackRecord profile={profile} />} />
              <Route path="/actions" element={<ActionCenter profile={profile} onRefresh={handleSync} />} />
              <Route path="/build-next" element={<BuildNext profile={profile} />} />
              <Route path="/companies" element={<CompanyPrep profile={profile} />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
};
