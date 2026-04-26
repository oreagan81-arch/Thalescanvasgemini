import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { announcementService, Announcement } from '../services/service.announcement';
import { draftAnnouncement } from '../lib/geminiHelper';
import { plannerService } from '../services/service.planner';
import { UserSettings } from '../services/service.settings';
import { toast } from 'sonner';

// Simple global cache for announcements to prevent re-fetching/flicker during navigation
const announcementCache: Record<string, Announcement[]> = {};

export function useAnnouncements(weekId: string) {
  const queryClient = useQueryClient();
  const [announcements, setAnnouncements] = useState<Announcement[]>(announcementCache[weekId] || []);
  const [isLoading, setIsLoading] = useState(!announcementCache[weekId]);

  useEffect(() => {
    // Return early if no weekId
    if (!weekId) return;

    // Reset loading if not in cache
    if (!announcementCache[weekId]) {
      setIsLoading(true);
    }

    const unsubscribe = announcementService.subscribeByWeek(weekId, (data) => {
      announcementCache[weekId] = data;
      setAnnouncements(data);
      setIsLoading(false);
      
      // Update react-query cache just in case other components use it
      queryClient.setQueryData(['announcements', weekId], data);
    });

    // CRITICAL: Cleanup listener on unmount
    return () => {
      unsubscribe();
    };
  }, [weekId, queryClient]);

  // Mutation for saving
  const saveMutation = useMutation({
    mutationFn: ({ content, subject }: { content: string, subject?: string }) => announcementService.upsert(weekId, content, subject),
    onSuccess: (data) => {
      // Optimitic update or just invalidation
      toast.success('System: Cloud Synchronization Successful');
    },
    onError: () => toast.error('System: Cloud Synchronization Failed'),
  });

  return {
    announcements,
    isLoading,
    save: saveMutation.mutate,
    isSaving: saveMutation.isPending
  };
}

export function useDraftAnnouncement() {
  const [isDrafting, setIsDrafting] = useState(false);

  const draft = async (weekId: string, settings: UserSettings, command?: string) => {
    try {
      setIsDrafting(true);
      
      // Get planner context
      const plannerRows = await new Promise<any[]>((resolve) => {
        const unsubscribe = plannerService.subscribeToWeek(weekId, (rows) => {
          unsubscribe();
          resolve(rows);
        });
      });

      const result = await draftAnnouncement({ label: weekId }, plannerRows, settings, command);
      return result;
    } catch (error) {
      console.error("AI Briefing Error:", error);
      toast.error("Intelligence Failure: Failed to generate announcement briefing. Please verify your cloud connection.");
      return null;
    } finally {
      setIsDrafting(false);
    }
  };

  return { draft, isDrafting };
}
