import { useEffect } from 'react';
import { isThursday } from 'date-fns';
import { useStore } from '../store';
import { newsletterService } from '../services/service.newsletter';
import { calendarService } from '../services/service.calendar';

export const useAutoDraft = () => {
  const { pendingNewsletterDraft, setPendingNewsletterDraft, addLog } = useStore();

  useEffect(() => {
    const runAutoDraft = async () => {
      const today = new Date();
      
      // 1. Only run on Thursdays
      if (!isThursday(today)) return;

      // 2. Identify the upcoming week ID
      const nextThursday = new Date(today);
      nextThursday.setDate(today.getDate() + 7);
      const context = calendarService.getAcademicContext(nextThursday);
      const weekId = calendarService.getWeekId(context);

      // 3. Check if we already drafted this specific week
      if (pendingNewsletterDraft?.weekId === weekId) return;

      addLog(`Thursday detected: Initiating Newsletter Auto-Draft for ${weekId}...`);
      
      try {
        const draft = await newsletterService.autoDraftThursdayNewsletter();
        if (draft) {
          setPendingNewsletterDraft(draft);
          addLog(`Newsletter for ${weekId} drafted successfully.`);
        }
      } catch (error) {
        console.error("Auto-draft failed", error);
      }
    };

    runAutoDraft();
  }, [pendingNewsletterDraft, setPendingNewsletterDraft, addLog]);
};
