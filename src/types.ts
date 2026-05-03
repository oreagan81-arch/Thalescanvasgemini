
export interface SystemConfig {
  model: "gemini-1.5-pro" | "gemini-1.5-flash";
  fallbackModel: "gemini-1.5-flash";
  promptVersion: string;
  temperature: number;
  maxTokens: number;
  rules: {
    enforceFridayMessage: boolean;
    requireResources: boolean;
    strictHomeworkLogic: boolean;
  };
  features: {
    enableCaching: boolean;
    enableDiffSync: boolean;
    enableAI: boolean;
  };
}

export interface Metric {
  totalTokens: number;
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  avgLatencyMs: number;
  errors: number;
}

export interface PromptVersion {
  generator: string;
  parser: string;
  createdAt: number;
}

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Job {
  id: string;
  type: 'generate_week';
  status: JobStatus;
  input: any;
  result: any;
  steps: {
    parse: 'pending' | 'running' | 'done' | 'failed';
    generate: 'pending' | 'running' | 'done' | 'failed';
    validate: 'pending' | 'running' | 'done' | 'failed';
    deploy: 'pending' | 'running' | 'done' | 'failed';
  };
  progress: number;
  logs: string[];
  retries: number;
  createdAt: number;
  updatedAt: number;
}
