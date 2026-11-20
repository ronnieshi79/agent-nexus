export type ServiceCardId = 'market' | 'chat' | 'kanban' | 'expert';

export type UserPerspective = 'employer' | 'expert';

export type AgentCategory = 'product' | 'architecture' | 'engineering' | 'qa';

export type NodeTier = 'official-cloud' | 'idle-peer';

export type TaskStatus = 'pending' | 'in_progress' | 'review' | 'done';

export type AirobotState =
  | 'standby'
  | 'market'
  | 'chat'
  | 'kanban'
  | 'expert'
  | 'thinking'
  | 'celebrating';

export interface AgentPerformance {
  completedTasks: number;
  successRate: number; // e.g. 98.6
  avgDurationMin: number; // e.g. 14
  rating: number; // e.g. 4.9
  costEfficiency: string; // e.g. "Prompt 缓存节省 78%"
  recentReviews: {
    employer: string;
    project: string;
    comment: string;
    score: number;
  }[];
}

export interface ExpertAgent {
  id: string;
  handle: string; // e.g. "@架构审查员"
  name: string;
  title: string;
  category: AgentCategory;
  region: string; // e.g. "新加坡商业节点" | "美西合规节点" | "深圳原生闲时节点"
  nodeTier: NodeTier;
  engineModel: string; // e.g. "Claude Code + 混合路由"
  skills: string[]; // capability tags
  mcpTools: string[];
  pricePerTaskUsd: number;
  pricePerHourUsd: number;
  bio: string;
  avatarAccent: string; // semantic color accent hex
  avatarCode: string; // 2-char monogram
  isOnlineForOrders: boolean;
  performance: AgentPerformance;
  isCustomPublished?: boolean;
}

export interface WorkflowTask {
  id: string;
  title: string;
  description: string;
  assigneeId: string; // ExpertAgent id or 'butler'
  assigneeHandle: string;
  status: TaskStatus;
  priority: '高' | '中' | '低';
  budgetLimitUsd: number;
  actualCostUsd: number;
  tokensUsed: number;
  dependsOnTaskId?: string;
  deliverableSummary?: string;
  deliverableArtifact?: string;
  createdAt: string;
  updatedAt: string;
  sourceMessageId?: string;
}

export interface ChatMessage {
  id: string;
  senderType: 'employer' | 'butler' | 'agent' | 'system';
  senderId: string;
  senderName: string;
  senderHandle: string;
  content: string;
  timestamp: string;
  linkedTaskIds?: string[];
  mentions?: string[];
  costUsd?: number;
}

export interface BrainRecommendation {
  recommendedCard: ServiceCardId;
  headline: string;
  reason: string;
  suggestedActionLabel: string;
  suggestedPrompt?: string;
  confidenceNote: string;
}

export interface ProjectWorkspace {
  id: string;
  name: string;
  goal: string;
  workspaceTier: '加密持久化工作区 (50GB)' | '24h 临时沙箱';
  budgetCapUsd: number;
  spentUsd: number;
}
