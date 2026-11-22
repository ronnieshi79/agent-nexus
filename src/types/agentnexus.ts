export type NavViewId = 'chat' | 'kanban' | 'team' | 'market' | 'discover';

export type ChatChannelType = 'assistant' | 'group' | 'task_session' | 'dm';

export type ActiveChatChannel =
  | { type: 'assistant' }
  | { type: 'group'; projectId: string }
  | { type: 'task_session'; taskId: string; projectId: string }
  | { type: 'dm'; agentId: string };

export type AgentCategory = 'engineering' | 'design' | 'product' | 'architecture' | 'qa';

export type NodeTier = 'official-cloud' | 'idle-peer';

export type ServiceMode = 'pure-agent' | 'human-agent';

export type EntityType = 'human' | 'agent';

export type AgentOwnership = 'marketplace' | 'private';

export type ZoneKind = 'public' | 'community' | 'enterprise';

export interface HumanExpert {
  id: string;
  name: string;
  title: string;
  category: AgentCategory;
  bio: string;
  primaryZoneId: string;
  zoneIds: string[];
  avatarInitials: string;
  avatarAccent: string;
  reputationScore: number;
  completedProjects: number;
  specialties: string[];
  isCurrentUser?: boolean;
}

export interface CommunityZone {
  id: string;
  name: string;
  shortCode: string;
  kind: ZoneKind;
  typeLabel: string;
  tagline: string;
  focusDomains: string[];
  accentColor: string;
  memberCount: number;
}

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
  /** Human owner/operator who manages and deploys this Agent externally */
  ownerHumanId?: string;
  ownerHumanName?: string;
  ownerHumanTitle?: string;
  /** Primary certified community/enterprise zone (undefined for personal private nodes) */
  primaryZoneId?: string;
  /** Zone IDs where this agent is publicly/privately listed in that zone's expert market */
  listedZoneIds: string[];
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

export interface TaskSessionMessage {
  id: string;
  taskId: string;
  sender: 'employer' | 'agent' | 'system';
  content: string;
  timestamp: string;
  /** Concise remote Agent execution steps (e.g. Codex file reads, patch gen, tests) */
  executionSteps?: string[];
  /** Optional deliverable file path produced/updated in this turn */
  artifactPath?: string;
  /** Optional code or spec diff snippet produced in this turn */
  artifactSnippet?: string;
  /** Interactive quick-confirm / follow-up choices proposed by the remote Agent */
  suggestedActions?: string[];
  /** True when the Agent paused to wait for employer decision or further input */
  awaitingConfirmation?: boolean;
  /** True when this turn triggered an automatic milestone summary sync to the project group chat */
  milestoneSynced?: boolean;
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

export type ProjectRole = 'leading' | 'participating';

export interface ProjectWorkspace {
  id: string;
  name: string;
  goal: string;
  /** Whether the user leads this project as employer or participates as an expert contributor */
  role: ProjectRole;
  /** Optional community/enterprise zone this project is associated with or published to */
  sourceZoneId?: string;
  workspaceTier: '加密持久化工作区 (50GB)' | '24h 临时沙箱';
  /** Overall project budget ceiling (USD) */
  budgetCapUsd: number;
  /** Total contracted external expert project fees (USD) */
  spentUsd: number;
  hiredAgentIds: string[];
}

export interface ZoneProjectOpportunity {
  id: string;
  zoneId: string;
  title: string;
  publisher: string;
  summary: string;
  budgetUsd: number;
  durationDays: number;
  requiredRoles: string[];
  serviceModePref: 'any' | ServiceMode;
  /** 'recruiting': external zone project I can claim & participate in; 'published_by_me': project I published to this zone to recruit experts */
  direction: 'recruiting' | 'published_by_me';
  status: 'open' | 'claimed';
  linkedWorkspaceId?: string;
  postedAt: string;
}

export type CommunityPostType = 'project' | 'discussion' | 'showcase';

export interface CommunityComment {
  id: string;
  authorName: string;
  authorHandle: string;
  authorRole: string;
  content: string;
  timestamp: string;
  isAgent?: boolean;
}

export interface CommunityPost {
  id: string;
  zoneId: string;
  type: CommunityPostType;
  authorEntityType?: EntityType;
  authorOwnerName?: string;
  authorName: string;
  authorHandle: string;
  authorRole: string;
  authorAccent: string;
  authorCode: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  likes: number;
  likedByMe?: boolean;
  comments: CommunityComment[];
  /** Present when this feed post embeds a live project matchmaking opportunity */
  linkedProjectId?: string;
  /** Present when this feed post showcases an expert Agent available for DM/hiring */
  linkedAgentId?: string;
}


