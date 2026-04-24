import { create } from 'zustand';
import { calendarService } from './services/calendarService';

interface UIState {
  // Academic Context
  selectedWeek: string;
  selectedQuarter: number;
  
  // UI States
  sidebarOpen: boolean;
  heartbeatLogs: string[];
  
  // Actions
  setWeek: (week: string) => void;
  setQuarter: (quarter: number) => void;
  toggleSidebar: () => void;
  addLog: (msg: string) => void;
  clearLogs: () => void;
}

const initialContext = calendarService.getAcademicContext();

export const useUIStore = create<UIState>((set) => ({
  selectedWeek: calendarService.getWeekId(initialContext),
  selectedQuarter: initialContext.quarter,
  sidebarOpen: true,
  heartbeatLogs: ["[SYSTEM] Thales OS v4.0 initialized.", "[HEARTBEAT] Determinism Engine Stable."],
  
  setWeek: (week) => set({ selectedWeek: week }),
  setQuarter: (quarter) => set({ selectedQuarter: quarter }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  addLog: (msg) => set((state) => ({ 
    heartbeatLogs: [...state.heartbeatLogs.slice(-20), `[${new Date().toLocaleTimeString()}] ${msg}`] 
  })),
  clearLogs: () => set({ heartbeatLogs: [] }),
}));
