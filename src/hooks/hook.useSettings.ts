import { useState, useEffect } from "react";
import { settingsService, UserSettings } from "../services/service.settings";
import { auth } from "../lib/firebase";

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings>({
    teacherName: 'Owen Reagan',
    schoolName: 'Thales Academy',
    signature: 'Owen Reagan',
    tone: 'Warm'
  });

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const unsubscribe = settingsService.subscribeSettings(userId, (newSettings) => {
      setSettings(newSettings);
    });

    return () => unsubscribe();
  }, []);

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    return await settingsService.updateSettings(userId, newSettings);
  };

  return { settings, updateSettings };
}
