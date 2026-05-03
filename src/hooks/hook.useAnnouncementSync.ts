import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { announcementService, Announcement } from '../services/service.announcement';
import { plannerService } from '../services/service.planner';
import { UserSettings } from '../services/service.settings';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import { useStore } from '../store';

// Simple global cache for announcements to prevent re-fetching/flicker during navigation
const announcementCache: Record<string, Announcement[]> = {};

export function useAnnouncements(weekId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [announcements, setAnnouncements] = useState<Announcement[]>(announcementCache[weekId] || []);
  const [isLoading, setIsLoading] = useState(!announcementCache[weekId]);

  useEffect(() => {
    // Return early if no weekId or user
    if (!weekId || !user) return;

    // Reset loading if not in cache
    if (!announcementCache[weekId]) {
      setIsLoading(true);
    }

    const unsubscribe = announcementService.subscribeByWeek(user.uid, weekId, (data) => {
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
  }, [weekId, queryClient, user]);

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
  const { user } = useAuth();
  const [isDrafting, setIsDrafting] = useState(false);
  const setActiveJob = useStore((state) => state.setActiveJob);

  const draft = async (weekId: string, settings: UserSettings, command?: string) => {
    if (!user) return null;
    try {
      setIsDrafting(true);
      
      // Get planner context
      const plannerRows = await new Promise<any[]>((resolve) => {
        const unsubscribe = plannerService.subscribeToWeek(user.uid, weekId, (rows) => {
          unsubscribe();
          resolve(rows);
        });
      });

      const startAnnouncementGeneration = httpsCallable(functions, 'startAnnouncementGeneration');
      const response = await startAnnouncementGeneration({ 
        weekId, 
        settings, 
        command, 
        plannerRows 
      });
      
      const { jobId } = response.data as { jobId: string };
      setActiveJob(jobId);
      toast.info("Neural Engine Dispatch: Syncing academic clusters...");
      return jobId;
    } catch (error) {
      console.error("AI Briefing Error:", error);
      toast.error("Intelligence Failure: Failed to start generation job.");
      return null;
    } finally {
      setIsDrafting(false);
    }
  };

  return { draft, isDrafting };
}
