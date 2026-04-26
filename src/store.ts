import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { calendarService } from './services/service.calendar';

// --- Types ---

interface UISlice {
  sidebarOpen: boolean;
  heartbeatLogs: string[];
  toggleSidebar: () => void;
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

// Data slice for caching or global data state
interface DataSlice {
  lastSyncedAt: string | null; // Changed to string for serializability in persist
  setLastSynced: (date: Date) => void;
}

interface SettingsSlice {
  geminiApiKey: string;
  canvasApiToken: string;
  canvasCourseId: string;
  schoolStartDate: string | null;
  setSettings: (settings: Partial<Pick<SettingsSlice, 'geminiApiKey' | 'canvasApiToken' | 'canvasCourseId' | 'schoolStartDate'>>) => void;
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
      heartbeatLogs: ["[SYSTEM] Thales OS v4.0 initialized.", "[HEARTBEAT] Determinism Engine Stable."],
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
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
      setLastSynced: (date: Date) => set({ lastSyncedAt: date.toISOString() }),

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
      canvasCourseId: import.meta.env.VITE_CANVAS_COURSE_ID || '',
      schoolStartDate: null,
      setSettings: (settings) => set((state) => ({ ...state, ...settings })),
    }),
    {
      name: 'thales-os-storage',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState: any, version: number) => {
        if (version < 2) {
          // Simple migration: just return the old state
          // New fields will be initialized with defaults during hydration
          return persistedState;
        }
        return persistedState;
      },
      // Optionally filter what to persist
      partialize: (state) => ({
        selectedWeek: state.selectedWeek,
        selectedQuarter: state.selectedQuarter,
        recentCommands: state.recentCommands,
        favoriteTemplates: state.favoriteTemplates,
        lastUsedSubject: state.lastUsedSubject,
        sidebarOpen: state.sidebarOpen,
        geminiApiKey: state.geminiApiKey,
        canvasApiToken: state.canvasApiToken,
        canvasCourseId: state.canvasCourseId,
        schoolStartDate: state.schoolStartDate,
      }),
    }
  )
);

// Backwards compatibility or specific export for UI if needed
export const useUIStore = useStore;
export const useThalesStore = useStore;
