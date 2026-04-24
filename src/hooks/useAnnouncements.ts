import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { announcementService, Announcement } from '../services/announcementService';
import { draftAnnouncement } from '../lib/geminiHelper';
import { plannerService } from '../services/plannerService';
import { UserSettings } from '../services/settingsService';
import { toast } from 'sonner';

export function useAnnouncements(weekId: string) {
  const queryClient = useQueryClient();

  // Fetch announcements for the week
  const { data: announcements, isLoading } = useQuery({
    queryKey: ['announcements', weekId],
    queryFn: async () => {
      // Since our service uses listeners, we'll return a promise for the first snapshot
      return new Promise<Announcement[]>((resolve) => {
        const unsubscribe = announcementService.subscribeByWeek(weekId, (data) => {
          unsubscribe();
          resolve(data);
        });
      });
    },
    staleTime: 1000 * 60, // 1 minute
  });

  // Mutation for saving
  const saveMutation = useMutation({
    mutationFn: (content: string) => announcementService.upsert(weekId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements', weekId] });
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
    } finally {
      setIsDrafting(false);
    }
  };

  return { draft, isDrafting };
}
