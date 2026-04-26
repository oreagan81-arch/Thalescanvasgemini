import { useState, useEffect, useMemo } from 'react';
import { resourceService, ResourceFile } from '../services/service.resource';
import { plannerService, PlannerRow } from '../services/service.planner';

// Module-level cache to prevent re-fetching/flicker
const statsCache: {
  resources: ResourceFile[];
  planner: Record<string, PlannerRow[]>;
} = {
  resources: [],
  planner: {}
};

export function useDashboardStats(weekId: string) {
  const [resources, setResources] = useState<ResourceFile[]>(statsCache.resources);
  const [plannerRows, setPlannerRows] = useState<PlannerRow[]>(statsCache.planner[weekId] || []);
  const [loading, setLoading] = useState(!statsCache.resources.length || !statsCache.planner[weekId]);

  useEffect(() => {
    // 1. Subscribe to Resources (Global Registry)
    const unsubscribeResources = resourceService.subscribeAll((data) => {
      statsCache.resources = data;
      setResources(data);
    });

    // 2. Subscribe to PlannerRows (Specific Week)
    const unsubscribePlanner = plannerService.subscribeToWeek(weekId, (data) => {
      statsCache.planner[weekId] = data;
      setPlannerRows(data);
      setLoading(false);
    });

    // CRITICAL: Cleanup listeners on unmount
    return () => {
      unsubscribeResources();
      unsubscribePlanner();
    };
  }, [weekId]);

  // Derived Stats - Memoized to prevent recalculation on every render
  const stats = useMemo(() => {
    const totalFiles = resources.length;
    const orphans = resources.filter(r => !r.mappedTo).length;
    const healthScore = totalFiles > 0 ? Math.round(((totalFiles - orphans) / totalFiles) * 100) : 100;
    const mappedResourcesCount = resources.filter(r => r.mappedTo).length;
    const lessonCount = plannerRows.filter(r => r.lessonTitle).length;

    return {
      totalFiles,
      orphans,
      healthScore,
      mappedResourcesCount,
      lessonCount
    };
  }, [resources, plannerRows]);

  return {
    resources,
    plannerRows,
    stats,
    loading
  };
}
