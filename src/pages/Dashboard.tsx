import React, { useState, useEffect } from 'react';
import { useDashboardStats } from '../hooks/hook.useDashboardStats';
import { useThalesStore } from '../store';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { CommandCenter } from '../components/dashboard/CommandCenter';
import { DashboardStatsGrid } from '../components/dashboard/DashboardStatsGrid';
import { UpcomingTests } from '../components/dashboard/UpcomingTests';
import { RecentActivity } from '../components/dashboard/RecentActivity';
import { StatusSection } from '../components/dashboard/StatusSection';
import { calculatePacingWeek } from '../services/service.calendar';

export function Dashboard() {
  const selectedWeek = useThalesStore((state) => state.selectedWeek);
  const selectedQuarter = useThalesStore((state) => state.selectedQuarter);
  const schoolStartDate = useThalesStore((state) => state.schoolStartDate);

  // Dynamic greeting and date state
  const [greeting, setGreeting] = useState('Welcome');
  const [currentDate, setCurrentDate] = useState('');
  const [schoolWeek, setSchoolWeek] = useState<number | null>(null);
  const [schoolStatus, setSchoolStatus] = useState<string>("In Session");

  useEffect(() => {
    const updateTimeContext = () => {
      const now = new Date();
      const hour = now.getHours();
      
      if (hour < 12) {
        setGreeting('Good morning');
      } else if (hour < 17) {
        setGreeting('Good afternoon');
      } else {
        setGreeting('Good evening');
      }

      const formattedDate = new Intl.DateTimeFormat('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric' 
      }).format(now);
      
      setCurrentDate(formattedDate);

      // 2. Pacing Engine Context with Accurate Calendar Mappings
      if (schoolStartDate) {
        const pacing = calculatePacingWeek(now, schoolStartDate);
        setSchoolWeek(pacing.weekNumber);
        setSchoolStatus(pacing.status);
      }
    };

    updateTimeContext();
    const intervalId = setInterval(updateTimeContext, 60000);
    return () => clearInterval(intervalId);
  }, [schoolStartDate]);
  
  const { plannerRows, stats, loading } = useDashboardStats(selectedWeek);
  const { totalFiles, orphans, healthScore, lessonCount } = stats;

  return (
    <div className="max-w-[1400px] mx-auto space-y-12 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-1000 ease-in-out">
      {/* Header Section */}
      <DashboardHeader 
        name="Mr. Reagan" 
        greeting={greeting} 
        currentDate={currentDate} 
        schoolWeek={schoolWeek}
        schoolStatus={schoolStatus}
      />

      {/* Main Command Center - The Focal Point */}
      <section className="pt-4">
        <CommandCenter />
      </section>

      {/* Core Stats Overview */}
      <DashboardStatsGrid 
        selectedWeek={selectedWeek}
        selectedQuarter={selectedQuarter}
        totalFiles={totalFiles}
        orphans={orphans}
        healthScore={healthScore}
        lessonCount={lessonCount}
        schoolWeek={schoolWeek}
        schoolStatus={schoolStatus}
      />

      {/* Primary Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7">
          <UpcomingTests />
        </div>
        <div className="lg:col-span-5">
          <RecentActivity />
        </div>
      </div>

      {/* System Integrity (Footer/Status) */}
      <div className="pt-4">
        <div className="mb-6 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-slate-600">OS System Metrics</h3>
            <div className="h-[1px] flex-1 bg-white/5 mx-6"></div>
        </div>
        <StatusSection 
          orphans={orphans}
          plannerRowCount={plannerRows.length}
          selectedWeek={selectedWeek}
          loading={loading}
        />
      </div>
    </div>
  );
}

