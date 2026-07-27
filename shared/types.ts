export type ProjectStatus =
  | "idle"
  | "queued"
  | "planning"
  | "processing"
  | "review_needed"
  | "complete"
  | "paused"
  | "cancelled"
  | "error";

export type PageStatus =
  | "pending"
  | "ready"
  | "placeholder"
  | "complete"
  | "error";

export interface Subject {
  id: string;
  labelId: string;
  level1: string;
  level2: string;
  level3: string;
  chineseName: string;
  englishName: string;
  description: string;
  tags: string;
  generationStatus: ProjectStatus | "pending";
  projectId?: string | null;
  createdAt: string;
}

export interface BookPage {
  id: string;
  projectId: string;
  contentType: "science" | "story";
  pageIndex: number;
  title: string;
  text: string;
  imagePrompt: string;
  imageUrl?: string | null;
  audioUrl?: string | null;
  status: PageStatus;
}

export interface AuditIssue {
  type: "accuracy" | "age_fit" | "continuity" | "visual" | "safety";
  severity: "low" | "medium" | "high";
  pageIndex?: number;
  message: string;
  suggestion: string;
  status: "open" | "resolved";
}

export interface AuditResult {
  id: string;
  projectId: string;
  score: number;
  issues: AuditIssue[];
  mode: "local" | "kimi";
  createdAt: string;
}

export interface Project {
  id: string;
  subjectId?: string | null;
  labelId: string;
  topic: string;
  categories: string[];
  status: ProjectStatus;
  currentStep: string;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
  pages?: BookPage[];
  audit?: AuditResult | null;
}

export interface QueueState {
  paused: boolean;
  activeProjectId: string | null;
  waiting: number;
  completedToday: number;
  items: Array<{
    id: string;
    projectId: string;
    topic: string;
    status: string;
    progress: number;
    message: string;
  }>;
}

export interface AppSettings {
  targetAge: string;
  sciencePageCount: number;
  storyPageCount: number;
  imageStyle: string;
  model: string;
  generationMode: "local" | "kimi";
  dailyAiCallLimit: number;
  sciencePrompt: string;
  storyPrompt: string;
}

export interface ServiceStatus {
  localOnly: true;
  database: "ready";
  kimi: {
    configured: boolean;
    enabled: boolean;
    model: string;
    callsToday: number;
    dailyLimit: number;
    endpointRegion: "cn" | "global";
  };
  image: {
    provider: "local-placeholder";
    generationAvailable: false;
    uploadAvailable: true;
  };
  audio: {
    provider: "disabled";
    reserved: true;
  };
}

export interface DashboardSummary {
  subjectCount: number;
  projectCount: number;
  completedCount: number;
  reviewCount: number;
  queuedCount: number;
  generatedPages: number;
  recentProjects: Project[];
  queue: QueueState;
  services: ServiceStatus;
}
