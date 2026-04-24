import { useQuery } from '@tanstack/react-query';
import { resourceService, ResourceFile } from '../services/resourceService';
import { plannerService, PlannerRow } from '../services/plannerService';

export function useDashboardStats(weekId: string) {
  const { data: resources = [], isLoading: loadingResources } = useQuery({
    queryKey: ['resources'],
    queryFn: async () => {
      return new Promise<ResourceFile[]>((resolve) => {
        const unsubscribe = resourceService.subscribeAll((data) => {
          unsubscribe();
          resolve(data);
        });
      });
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: plannerRows = [], isLoading: loadingPlanner } = useQuery({
    queryKey: ['planner', weekId],
    queryFn: async () => {
      return new Promise<PlannerRow[]>((resolve) => {
        const unsubscribe = plannerService.subscribeToWeek(weekId, (data) => {
          unsubscribe();
          resolve(data);
        });
      });
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Derived Stats
  const totalFiles = resources.length;
  const orphans = resources.filter(r => !r.mappedTo).length;
  const healthScore = totalFiles > 0 ? Math.round(((totalFiles - orphans) / totalFiles) * 100) : 100;
  const mappedResourcesCount = resources.filter(r => r.mappedTo).length;
  const lessonCount = plannerRows.filter(r => r.lessonTitle).length;

  return {
    resources,
    plannerRows,
    stats: {
      totalFiles,
      orphans,
      healthScore,
      mappedResourcesCount,
      lessonCount
    },
    loading: loadingResources || loadingPlanner
  };
}
