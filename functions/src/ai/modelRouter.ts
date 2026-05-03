import { getAggregatedMetrics } from "../control/metrics";

export async function selectModel(task: string, config: any) {
  const metrics = await getAggregatedMetrics();
  
  // Rule-based routing
  const flashTasks = ['parse', 'validate', 'diff', 'optimize'];
  if (flashTasks.includes(task.toLowerCase())) return config.fallbackModel;
  if (task.toLowerCase() === 'generate_day') return config.model;

  // Existing heuristic for auto-optimization
  const costHigh = metrics.costPerWeek > 50; 
  const qualityLow = metrics.failureRate > 0.05; 
  
  if (costHigh) return config.fallbackModel; 
  if (qualityLow) return config.model; 
  
  return config.fallbackModel;
}
