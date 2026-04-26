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

type StoreState = UISlice & AcademicSlice & DataSlice & CommandSlice;

// --- Initial Constants ---

const initialContext = calendarService.getAcademicContext();

// --- Main Store ---

export const useStore = create<StoreState>()(
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
    }),
    {
      name: 'thales-os-storage',
      storage: createJSONStorage(() => localStorage),
      // Optionally filter what to persist
      partialize: (state) => ({
        selectedWeek: state.selectedWeek,
        selectedQuarter: state.selectedQuarter,
        recentCommands: state.recentCommands,
        favoriteTemplates: state.favoriteTemplates,
        lastUsedSubject: state.lastUsedSubject,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
);

// Backwards compatibility or specific export for UI if needed
export const useUIStore = useStore;
export const useThalesStore = useStore;
