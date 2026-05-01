import { create, StateCreator } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { calendarService } from './services/service.calendar';
import { PacingWeek } from './services/service.pacingImport';

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
  validateActiveWeek: () => void;
  clearCache: () => void;
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
  pendingNewsletterDraft: { html: string; targetDate: string; weekId: string } | null;
  setLastSynced: (date: Date) => void;
  setPlannerData: (data: PacingWeek[] | null) => void;
  setPendingNewsletterDraft: (draft: { html: string; targetDate: string; weekId: string } | null) => void;
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

interface MetaSlice {
  hasHydrated: boolean;
  setHasHydrated: (val: boolean) => void;
}

export type ThalesState = UISlice & AcademicSlice & DataSlice & CommandSlice & SettingsSlice & MetaSlice;

const initialContext = calendarService.getAcademicContext();

const createUISlice: StateCreator<ThalesState, [], [], UISlice> = (set) => ({
  sidebarOpen: true,
  theme: 'dark',
  heartbeatLogs: ["[SYSTEM] Thales OS v4.0 initialized.", "[HEARTBEAT] Determinism Engine Stable."],
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setTheme: (theme) => set({ theme }),
  addLog: (msg) => set((state) => ({ 
    heartbeatLogs: [...state.heartbeatLogs.slice(-20), `[${new Date().toLocaleTimeString()}] ${msg}`] 
  })),
  clearLogs: () => set({ heartbeatLogs: [] }),
});

const createAcademicSlice: StateCreator<ThalesState, [], [], AcademicSlice> = (set, get) => ({
  selectedWeek: calendarService.getWeekId(initialContext),
  selectedQuarter: initialContext.quarter,
  setWeek: (week) => {
    set({ selectedWeek: week });
    get().validateActiveWeek();
  },
  setQuarter: (quarter) => set({ selectedQuarter: quarter }),
  clearCache: () => {
    console.warn("[CACHE] Forceful wipe initiated.");
    set({ plannerData: null, lastSyncedAt: null });
  },
  validateActiveWeek: () => {
    const state = get();
    const data = state.plannerData;
    
    if (!data || data.length === 0) return;

    // The Lesson 91 Bug: Placeholder data leaking into active weeks
    const hasStalePlaceholder = data.some(pw => 
      (pw.mathLesson && pw.mathLesson.includes("Lesson 91")) || 
      (pw.readingWeek && pw.readingWeek.includes("Lesson 91"))
    );

    if (hasStalePlaceholder) {
      console.error("[CRITICAL] Lesson 91 Stale Cache detected. Wiping local state.");
      state.clearCache();
      // Fresh fetch is typically handled by the subscription or a manual sync trigger in the UI
    }
  }
});

const createDataSlice: StateCreator<ThalesState, [], [], DataSlice> = (set) => ({
  lastSyncedAt: null,
  plannerData: null,
  pendingNewsletterDraft: null,
  setLastSynced: (date) => set({ lastSyncedAt: date.toISOString() }),
  setPlannerData: (data) => set({ plannerData: data }),
  setPendingNewsletterDraft: (draft) => set({ pendingNewsletterDraft: draft }),
});

const createCommandSlice: StateCreator<ThalesState, [], [], CommandSlice> = (set) => ({
  recentCommands: [],
  favoriteTemplates: [],
  lastUsedSubject: 'Math',
  addRecentCommand: (cmd) => set((state) => ({
    recentCommands: [cmd, ...state.recentCommands.filter((c) => c !== cmd)].slice(0, 10)
  })),
  saveTemplate: (template) => set((state) => ({
    favoriteTemplates: [...state.favoriteTemplates, template]
  })),
  setLastUsedSubject: (subject) => set({ lastUsedSubject: subject }),
  clearHistory: () => set({ recentCommands: [], lastUsedSubject: null }),
});

const createSettingsSlice: StateCreator<ThalesState, [], [], SettingsSlice> = (set) => ({
  geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
  canvasApiToken: '',
  canvasCourseIds: {
    'Homeroom': '22254', 
    'Math': '21957', 
    'Reading': '21919', 
    'Spelling': '21919', 
    'ELA': '21944', 
    'Language Arts': '21944',
    'Science': '21970', 
    'History': '21934'
  },
  schoolStartDate: null,
  pacingGuideUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTRf9-kG7C2iO75HNB2y4roFZ55YS3gyMFMijGiJsVW8Qm7njs5rTsir6U8Cvi0pljaJAh17WvbqX7f/pub?output=csv',
  setSettings: (settings) => set((state) => ({ ...state, ...settings })),
  updateCourseId: (subject, newId) => set((state) => ({
    canvasCourseIds: { ...state.canvasCourseIds, [subject]: newId }
  })),
  // Command to pull secrets from AI Studio environment (handled by server.ts proxy usually)
});

const createMetaSlice: StateCreator<ThalesState, [], [], MetaSlice> = (set) => ({
  hasHydrated: false,
  setHasHydrated: (val) => set({ hasHydrated: val }),
});

export const useStore = create<ThalesState>()(
  persist(
    (set, get, api) => ({
      ...createUISlice(set, get, api),
      ...createAcademicSlice(set, get, api),
      ...createDataSlice(set, get, api),
      ...createCommandSlice(set, get, api),
      ...createSettingsSlice(set, get, api),
      ...createMetaSlice(set, get, api),
    }),
    {
      name: 'thales-os-storage',
      version: 1, 
      migrate: (persistedState: any, version: number) => {
        if (version === undefined || version === 0) {
          console.warn('Persisted state version outdated or missing. Wiping cache.');
          return {}; // Returning empty object for initial state reset
        }
        return persistedState;
      },
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: (state) => {
        return () => state.setHasHydrated(true);
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
        pendingNewsletterDraft: state.pendingNewsletterDraft,
      }),
    }
  )
);

export const useUIStore = useStore;
export const useThalesStore = useStore;
