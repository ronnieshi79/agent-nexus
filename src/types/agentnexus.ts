export type NavViewId = 'chat' | 'kanban' | 'team' | 'market';

export type ChatChannelType = 'assistant' | 'group' | 'dm';

export type ActiveChatChannel =
  | { type: 'assistant' }
  | { type: 'group'; projectId: string }
  | { type: 'dm'; agentId: string };

export type AgentCategory = 'product' | 'architecture' | 'engineering' | 'qa';

export type NodeTier = 'official-cloud' | 'idle-peer';

export type ServiceMode = 'pure-agent' | 'human-agent';

export type AgentOwnership = 'marketplace' | 'private';

export type CapabilityTier = 'S 级稀缺' | 'A+ 资深' | 'A 级专业';

export type DemandStatus = '供不应求' | '需求旺盛' | '档期充裕';

export type TaskStatus = 'pending' | 'in_progress' | 'review' | 'done';

export type WorkCardType = 'planning' | 'development' | 'testing' | 'review';

export type NegotiationStatus = 'negotiating' | 'quoted' | 'hired';

export type PlatformServiceCategory = 'settlement' | 'order' | 'audit' | 'general';

export interface AgentNexusAccount {
  id: string;
  name: string;
  email: string;
  planLabel: string;
  workspaceNodeId: string;
  avatarInitials: string;
}

export interface AgentPerformance {
  completedProjects: number;
  successRate: number;
  reputationScore: number;
  repeatHireRate: number;
  avgDeliveryDays: number;
  rating: number;
  capabilityTier: CapabilityTier;
  demandStatus: DemandStatus;
  demandNote: string;
  pricingBasis: string;
  recentReviews: {
    employer: string;
    project: string;
    comment: string;
    score: number;
  }[];
}

export interface ExpertAgent {
  id: string;
  handle: string;
  name: string;
  title: string;
  category: AgentCategory;
  region: string;
  nodeTier: NodeTier;
  serviceMode: ServiceMode;
  ownership: AgentOwnership;
  isListedInMarket: boolean;
  engineModel: string;
  skills: string[];
  mcpTools: string[];
  /** Standard project engagement fee (USD / project), priced by capability, reputation & supply-demand */
  projectPriceUsd: number;
  bio: string;
  avatarAccent: string;
  avatarCode: string;
  isOnlineForOrders: boolean;
  performance: AgentPerformance;
}

export interface DirectMessage {
  id: string;
  sender: 'employer' | 'agent';
  content: string;
  timestamp: string;
  quotedPriceUsd?: number;
}

export interface NegotiationThread {
  agentId: string;
  targetProjectId: string;
  status: NegotiationStatus;
  /** Negotiated project engagement fee (USD / project) */
  negotiatedPriceUsd: number;
  scopeNote: string;
  firstWorkCardTitle: string;
  updatedAt: string;
  messages: DirectMessage[];
}

export interface AssistantActionCard {
  id: string;
  category: PlatformServiceCategory;
  title: string;
  detail: string;
  metricLabel?: string;
  actionLabel?: string;
  actionTarget?:
    | { type: 'settle'; settlementId: string }
    | { type: 'open_dm'; agentId: string }
    | { type: 'open_kanban'; projectId?: string }
    | { type: 'open_team' };
  resolved?: boolean;
}

export interface AssistantMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  category?: PlatformServiceCategory;
  cards?: AssistantActionCard[];
}

export interface SettlementRecord {
  id: string;
  projectId: string;
  projectName: string;
  agentHandle: string;
  milestoneLabel: string;
  amountUsd: number;
  status: 'unsettled' | 'settled';
  createdAt: string;
}

export interface PlatformAuditLog {
  id: string;
  category: PlatformServiceCategory;
  title: string;
  detail: string;
  severity: 'info' | 'warning' | 'success';
  timestamp: string;
}

export interface WorkflowTask {
  id: string;
  sessionId: string;
  featureModule: string;
  workType: WorkCardType;
  title: string;
  description: string;
  assigneeId: string;
  assigneeHandle: string;
  status: TaskStatus;
  priority: '高' | '中' | '低';
  dependsOnTaskId?: string;
  deliverableSummary?: string;
  deliverableArtifact?: string;
  createdAt: string;
  updatedAt: string;
  sourceMessageId?: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  senderType: 'employer' | 'butler' | 'agent' | 'system';
  senderId: string;
  senderName: string;
  senderHandle: string;
  content: string;
  timestamp: string;
  linkedTaskIds?: string[];
  mentions?: string[];
}

export interface ProjectWorkspace {
  id: string;
  name: string;
  goal: string;
  workspaceTier: '加密持久化工作区 (50GB)' | '24h 临时沙箱';
  /** Overall project budget ceiling (USD) */
  budgetCapUsd: number;
  /** Total contracted external expert project fees (USD) */
  spentUsd: number;
  hiredAgentIds: string[];
}
