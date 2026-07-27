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
  charactersInScene: string[];
  emotion: string;
  imageUrl?: string | null;
  audioUrl?: string | null;
  status: PageStatus;
}

export interface CoreSubject {
  name: string;
  headFeatures: string;
  bodyType: string;
  otherFeatures: string;
  personality?: string;
}

export interface ConsistencySettings {
  type: "character_story" | "lifecycle" | "concept" | "comparison";
  narrativeReason?: string;
  coreSubjects: CoreSubject[];
  artStyle: string;
  colorPalette: string;
  storyTheme?: string;
}

export interface ProjectConsistencySettings {
  science: ConsistencySettings | null;
  story: ConsistencySettings | null;
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
  consistencySettings: ProjectConsistencySettings;
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
  scienceKnowledgePointCountMin: number;
  scienceKnowledgePointCountMax: number;
  scienceImageStyle: string;
  storyImageStyle: string;
  imageStyle: string;
  scienceImageStylePrompt: string;
  scienceNegativePrompt: string;
  scienceImagePromptGuide: string;
  storyImageStylePrompt: string;
  storyNegativePrompt: string;
  storyImagePromptGuide: string;
  imageStylePresets: ImageStylePreset[];
  model: string;
  kimiEnabled: boolean;
  kimiRegion: "cn" | "global";
  generationMode: "local" | "kimi";
  dailyAiCallLimit: number;
  sciencePrompt: string;
  storyPrompt: string;
}

export interface ImageStylePreset {
  name: string;
  stylePrompt: string;
  negativePrompt: string;
}

export interface KimiConnectionResult {
  ok: true;
  availableModels: string[];
  selectedModelAvailable: boolean;
  balance: {
    available: number;
    cash: number;
    voucher: number;
  } | null;
}

export interface ServiceStatus {
  localOnly: true;
  database: "ready";
  kimi: {
    configured: boolean;
    enabled: boolean;
    keySource: "local-secret-file" | "environment" | null;
    keyHint: string | null;
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
