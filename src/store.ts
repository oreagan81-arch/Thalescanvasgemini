import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { calendarService } from './services/service.calendar';
import { PacingWeek } from './services/service.pacingImport';

// --- Types ---

interface UISlice {
  sidebarOpen: boolean;
  theme: 'light' | 'dark' | 'zinc';
  heartbeatLogs: string[];
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark' | 'zinc') => void;
  addLog: (msg: string) => void;
  clearLogs: () => void;
}

interface AcademicSlice {
  selectedWeek: string;
  selectedQuarter: number;
  setWeek: (week: string) => void;
  setQuarter: (quarter: number) => void;
}

interface CommandSlice {
  recentCommands: string[];
  favoriteTemplates: any[];
  lastUsedSubject: string | null;
  addRecentCommand: (cmd: string) => void;
  saveTemplate: (template: any) => void;
  setLastUsedSubject: (subject: string) => void;
  clearHistory: () => void;
}

interface DataSlice {
  lastSyncedAt: string | null; 
  plannerData: PacingWeek[] | null;
  setLastSynced: (date: Date) => void;
  setPlannerData: (data: PacingWeek[] | null) => void;
}

interface SettingsSlice {
  geminiApiKey: string;
  canvasApiToken: string;
  canvasCourseIds: Record<string, string>; 
  schoolStartDate: string | null;
  pacingGuideUrl: string; 
  setSettings: (settings: Partial<Pick<SettingsSlice, 'geminiApiKey' | 'canvasApiToken' | 'schoolStartDate' | 'pacingGuideUrl' | 'canvasCourseIds'>>) => void;
  updateCourseId: (subject: string, newId: string) => void;
}

export type ThalesState = UISlice & AcademicSlice & DataSlice & CommandSlice & SettingsSlice;

// --- Initial Constants ---
const initialContext = calendarService.getAcademicContext();

// --- Main Store ---

export const useStore = create<ThalesState>()(
  persist(
    (set) => ({
      // UI Slice
      sidebarOpen: true,
      theme: 'dark',
      heartbeatLogs: ["[SYSTEM] Thales OS v4.0 initialized.", "[HEARTBEAT] Determinism Engine Stable."],
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setTheme: (theme) => set({ theme }),
      addLog: (msg: string) => set((state) => ({ 
        heartbeatLogs: [...state.heartbeatLogs.slice(-20), `[${new Date().toLocaleTimeString()}] ${msg}`] 
      })),
      clearLogs: () => set({ heartbeatLogs: [] }),

      // Academic Slice
      selectedWeek: calendarService.getWeekId(initialContext),
      selectedQuarter: initialContext.quarter,
      setWeek: (week: string) => set({ selectedWeek: week }),
      setQuarter: (quarter: number) => set({ selectedQuarter: quarter }),

      // Data Slice
      lastSyncedAt: null,
      plannerData: null,
      setLastSynced: (date: Date) => set({ lastSyncedAt: date.toISOString() }),
      setPlannerData: (data: PacingWeek[] | null) => set({ plannerData: data }),

      // Command Slice
      recentCommands: [],
      favoriteTemplates: [],
      lastUsedSubject: 'Math',
      addRecentCommand: (cmd: string) => set((state) => ({
        recentCommands: [cmd, ...state.recentCommands.filter(c => c !== cmd)].slice(0, 10)
      })),
      saveTemplate: (template: any) => set((state) => ({
        favoriteTemplates: [...state.favoriteTemplates, template]
      })),
      setLastUsedSubject: (subject: string) => set({ lastUsedSubject: subject }),
      clearHistory: () => set({ recentCommands: [], lastUsedSubject: null }),

      // Settings Slice
      geminiApiKey: (typeof process !== 'undefined' && process.env.GEMINI_API_KEY) || '',
      canvasApiToken: (typeof process !== 'undefined' && process.env.CANVAS_API_TOKEN) || '',
      
      canvasCourseIds: {
        'Homeroom': '22254',
        'Math': '21957',
        'Reading': '21919',
        'Spelling': '21919', 
        'Language Arts': '21944',
        'ELA': '21944',      
        'Science': '21970',
        'History': '21934'
      },

      schoolStartDate: null,
      
      // Hardcoded exact Master Pacing Guide URL
      pacingGuideUrl: 'https://docs.google.com/spreadsheets/d/1RpMrcQqqrDl2Gaqo2LaGTDQWvrsYwBntbYOXlIrM7LA/edit?gid=287822418#gid=287822418',

      setSettings: (settings) => set((state) => ({ ...state, ...settings })),
      
      updateCourseId: (subject: string, newId: string) => set((state) => ({
        canvasCourseIds: {
          ...state.canvasCourseIds,
          [subject]: newId
        }
      })),
    }),
    {
      name: 'thales-os-storage',
      version: 6, 
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState: any, version: number) => {
        if (version < 6) return persistedState;
        return persistedState;
      },
      partialize: (state) => ({
        selectedWeek: state.selectedWeek,
        selectedQuarter: state.selectedQuarter,
        recentCommands: state.recentCommands,
        favoriteTemplates: state.favoriteTemplates,
        lastUsedSubject: state.lastUsedSubject,
        sidebarOpen: state.sidebarOpen,
        theme: state.theme,
        geminiApiKey: state.geminiApiKey,
        canvasApiToken: state.canvasApiToken,
        canvasCourseIds: state.canvasCourseIds, 
        schoolStartDate: state.schoolStartDate,
        pacingGuideUrl: state.pacingGuideUrl,
        plannerData: state.plannerData,
      }),
    }
  )
);

export const useUIStore = useStore;
export const useThalesStore = useStore;
