export type NavViewId = 'chat' | 'kanban' | 'team' | 'community';

export type CommunityHubTab =
  | 'service_agents'
  | 'service_humans'
  | 'service_skills'
  | 'social_all'
  | 'social_projects'
  | 'social_events'
  | 'social_following'
  | 'social_pinned';

export type ConversationInteractionMode = 'chat' | 'task';

export type ChatChannelType =
  | 'new_session'
  | 'assistant'
  | 'group'
  | 'task_session'
  | 'dm'
  | 'human_dm';

export type ActiveChatChannel =
  | { type: 'new_session' }
  | { type: 'assistant' }
  | { type: 'group'; projectId: string }
  | { type: 'task_session'; taskId: string; projectId: string }
  | { type: 'dm'; agentId: string }
  | { type: 'human_dm'; expertId: string };

export type AgentCategory =
  | 'engineering'
  | 'design'
  | 'product'
  | 'architecture'
  | 'qa'
  | 'media';

export type NodeTier = 'official-cloud' | 'idle-peer';

export type ServiceMode = 'pure-agent' | 'human-agent';

export type EntityType = 'human' | 'agent';

export type AgentOwnership = 'marketplace' | 'private';

export type ZoneKind = 'official' | 'private';

export type PrivateCommunityScope = 'enterprise' | 'opc' | 'topic';

export type LeasePeriod = 'week' | 'month' | 'quarter';

export interface AgentSliceFirewallPolicy {
  /** Restrict slice file/context access strictly to the assigned project workspace */
  workspaceScopedOnly: boolean;
  /** Outbound network firewall rule: allowlist APIs only or fully air-gapped sandbox */
  networkPolicy: 'allowlist' | 'blocked';
  /** Require human confirmation before high-risk write/push/deploy actions */
  requireApprovalForWrite: boolean;
  /** Tenant kill-switch to temporarily pause/freeze the isolated Agent slice */
  slicePaused?: boolean;
}

export interface AgentLeaseRecord {
  agentId: string;
  period: LeasePeriod;
  priceUsd: number;
  startedAt: string;
  expiresLabel: string;
  targetWorkspaceId?: string;
  autoRenew?: boolean;
  /** Tenant-managed isolation firewall & governance controls for the leased Agent slice */
  firewallPolicy?: AgentSliceFirewallPolicy;
}

export type ExpertRelationType = 'project_collab' | 'mutual_friend';

export interface TeamExpertMembership {
  expertId: string;
  relation: ExpertRelationType;
  /** Zone from which this expert was invited or collaborated */
  sourceZoneId?: string;
  /** Project IDs this expert is actively assigned to */
  assignedWorkspaceIds: string[];
  outsourcingScope?: string;
  joinedAt: string;
}

export interface HumanExpert {
  id: string;
  name: string;
  title: string;
  category: AgentCategory;
  bio: string;
  /** Dedicated outsourcing direction offered by this human expert & their built-in Agents */
  outsourcingDomain?: string;
  outsourcingModes?: string[];
  ratingTier?: 'S' | 'A+' | 'A';
  primaryZoneId: string;
  zoneIds: string[];
  avatarInitials: string;
  avatarAccent: string;
  reputationScore: number;
  completedProjects: number;
  specialties: string[];
  isCurrentUser?: boolean;
}

export type SpaceMemberRole = 'owner' | 'admin' | 'member';

export interface SpaceMember {
  id: string;
  humanExpertId?: string;
  name: string;
  title: string;
  role: SpaceMemberRole;
  avatarInitials: string;
  avatarAccent: string;
  joinedAt: string;
}

export interface SpaceSharedNode {
  id: string;
  zoneId: string;
  name: string;
  os: NodeOsType;
  osVersion: string;
  origin: ComputeNodeOrigin;
  region: string;
  cpuCores: number;
  memoryGb: number;
  gpuSpec?: string;
  status: ComputeNodeStatus;
  supportedClis: string[];
  sharedSandboxQuota: number;
  usedSandboxes: number;
  accessPolicy: 'all_members' | 'admins_only';
  monthlyCostUsd: number;
  addedAt: string;
}

export interface CommunityZone {
  id: string;
  name: string;
  shortCode: string;
  kind: ZoneKind;
  /** Optional positioning tag for private communities (enterprise team / OPC community / topic community) */
  privateScope?: PrivateCommunityScope;
  typeLabel: string;
  tagline: string;
  focusDomains: string[];
  accentColor: string;
  memberCount: number;
  principalName: string;
  isCurrentUserPrincipal?: boolean;
  /** Language-region or organizational label (e.g., 中文 · 官方运营, 企业内部 · 私有隔离) */
  regionCulture?: string;
  /** Platform-provided official default community every user joins automatically without application */
  isPlatformDefault?: boolean;
  /** True for upcoming official language-region communities not yet open */
  comingSoon?: boolean;
  /** True when private community accepts join applications reviewed by its principal */
  allowApplication?: boolean;
  /** True when created by the current user in Agent Communities */
  createdByMe?: boolean;
  /** Optional invite code for private communities */
  inviteCode?: string;
  /** Member roster for private community principal governance */
  members?: SpaceMember[];
  /** Agent IDs temporarily taken offline (suspended) in this community's service market */
  suspendedAgentIds?: string[];
}

export type CapabilityTier = 'S 级稀缺' | 'A+ 资深' | 'A 级专业';

export type DemandStatus = '供不应求' | '需求旺盛' | '档期充裕';

export type TaskStatus = 'pending' | 'in_progress' | 'review' | 'done';

export type WorkCardType = 'planning' | 'development' | 'testing' | 'review';

export type ActiveWorkflowStage = 'planning' | 'development' | 'testing';

export type TaskTypeAccent = 'blue' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate';

export interface ProjectTaskType {
  id: string;
  name: string;
  description: string;
  /** Standard deliverable skeleton / prompt checklist auto-applied when creating this card */
  templateChecklist?: string;
  accent: TaskTypeAccent;
  /** Specific specialist Agent(s) authorized to create/generate this card template via conversation */
  creatorAgentIds?: string[];
  /** Legacy fallback for single default Agent */
  defaultAgentId?: string;
  isBuiltin?: boolean;
}

export interface ProjectAgentAssignment {
  agentId: string;
  /** Active workflow positions this specialist Agent occupies: 计划 / 执行 / 验证 */
  stages: ActiveWorkflowStage[];
  /** Concise responsibility description within this project */
  roleNote: string;
  handoffMode: PipelineHandoffMode;
}

export type NegotiationStatus = 'negotiating' | 'quoted' | 'hired';

export type PlatformServiceCategory =
  | 'settlement'
  | 'order'
  | 'audit'
  | 'approval'
  | 'general';

export interface SpaceJoinApplication {
  id: string;
  zoneId: string;
  zoneName: string;
  applicantName: string;
  applicantTitle: string;
  humanExpertId?: string;
  avatarInitials: string;
  avatarAccent: string;
  requestedRole: SpaceMemberRole;
  note: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

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
  /** Host Agent runtime identity (e.g. Codex, Claude Code, Gemini CLI, Cursor, Playwright) */
  runtimeAgent: string;
  /** Default orchestrated model for this runtime agent (e.g. GPT-6.2, Claude 4.5 Sonnet, Gemini 3.1 Pro) */
  defaultModel: string;
  engineModel: string;
  skills: string[];
  mcpTools: string[];
  /** Structured Skill / MCP asset IDs equipped from AGN Space -> 空间资源 -> Skills / MCP */
  installedSkillIds?: string[];
  /** Standard project engagement fee (USD / project), priced by capability, reputation & supply-demand */
  projectPriceUsd: number;
  /** Optional explicit monthly lease price (USD / month); falls back to tier-based pricing helper */
  monthlyLeaseUsd?: number;
  bio: string;
  avatarAccent: string;
  avatarCode: string;
  /** Optional physical/cloud Space ComputeNode ID hosting this Agent runtime */
  hostNodeId?: string;
  /** Optional NodeCliEntry ID configured on the host ComputeNode */
  hostCliId?: string;
  /** Optional shared cloud StorageVolume ID mounted for this Agent */
  storageVolumeId?: string;
  /** Optional CLI runtime configuration snapshot (Claude Code / Antigravity / Codex / Gemini CLI) */
  cliConfig?: NodeCliConfig;
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

export interface HumanDirectMessage {
  id: string;
  sender: 'employer' | 'human';
  content: string;
  timestamp: string;
  linkedTaskId?: string;
}

export interface HumanDirectThread {
  expertId: string;
  updatedAt: string;
  messages: HumanDirectMessage[];
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
    | { type: 'open_team' }
    | { type: 'space_application'; applicationId: string };
  resolved?: boolean;
  resolvedLabel?: string;
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
  /** Optional custom task card type ID defined in 任务编排 */
  taskTypeId?: string;
  /** Optional cached label for the custom task card type */
  taskTypeLabel?: string;
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

export type ProjectLifecycleStatus = 'active' | 'completed' | 'archived';

export type NodeOsType = 'win11' | 'linux' | 'macos';
export type ComputeNodeOrigin = 'private' | 'cloud';
export type ComputeNodeStatus = 'online' | 'standby';

export type CliToolType = 'claude_code' | 'antigravity' | 'codex' | 'gemini_cli' | 'qoder';
export type CliAuthMode = 'account_oauth' | 'api_key';

export interface NodeCliConfig {
  cliTool: CliToolType;
  cliVersion: string;
  authMode: CliAuthMode;
  /** Display identifier for OAuth account or masked API key reference */
  credentialLabel: string;
  authStatus: 'connected' | 'unconfigured';
  /** Concurrent sessions / auto-managed isolated sandboxes (e.g. 4 = 4 concurrent Claude Code slots) */
  concurrency: number;
  activeSlots?: number;
  /** Bound shared cloud work storage volume ID */
  storageVolumeId?: string;
}

export interface NodeCliEntry {
  id: string;
  cliTool: CliToolType;
  runtimeAgent: string;
  cliVersion: string;
  /** Deprecated on node level — model is selected per specialist Agent member */
  defaultModel?: string;
  authMode: CliAuthMode;
  /** Display identifier for OAuth account or masked API key reference (kept strictly local on host node) */
  credentialLabel: string;
  authStatus: 'connected' | 'unconfigured';
  /** Concurrent CLI sandboxes isolated internally by the node runtime */
  concurrency: number;
  enabled: boolean;
}

export type NodeLeaseBillingCycle = 'monthly' | 'yearly';

export interface ComputeNode {
  id: string;
  name: string;
  os: NodeOsType;
  osVersion: string;
  origin: ComputeNodeOrigin;
  region: string;
  cpuCores: number;
  memoryGb: number;
  gpuSpec?: string;
  storageQuotaGb: number;
  storageUsedGb: number;
  status: ComputeNodeStatus;
  endpoint: string;
  /** 0 for self-mounted personal/office hardware; monthly USD rental for platform cloud nodes */
  monthlyCostUsd: number;
  /** Optional yearly USD cost when leased annually from platform */
  yearlyCostUsd?: number;
  /** Active billing cycle for platform cloud nodes */
  leaseBillingCycle?: NodeLeaseBillingCycle;
  mountedAt: string;
  description: string;
  /** Agent CLIs installed and configured on this node */
  installedClis: NodeCliEntry[];
  /** Shared cloud StorageVolume IDs mounted on this node */
  mountedStorageIds: string[];
}

export type StorageBillingMode = 'monthly' | 'permanent';

export interface StorageVolume {
  id: string;
  name: string;
  tierLabel: string;
  region: string;
  quotaGb: number;
  usedGb: number;
  billingMode: StorageBillingMode;
  /** Monthly fee (if monthly) or one-time permanent purchase fee (if permanent) */
  priceUsd: number;
  encrypted: boolean;
  mountPath: string;
  boundNodeIds: string[];
  boundProjectIds: string[];
  updatedAt: string;
}

export type PipelineHandoffMode = 'auto' | 'manual';

export interface ProjectStageSlot {
  stage: WorkCardType;
  roleTitle: string;
  agentId: string;
  handoffMode: PipelineHandoffMode;
  deliverableContract: string;
}

export type ArtifactKind = 'ppt' | 'design' | 'solution' | 'prd' | 'architecture' | 'code_test';

export type ArtifactSourceType = 'task_session' | 'project_group' | 'manual';

export type ArtifactOwnership = 'yours' | 'shared';

export type ArtifactScopeTab = 'all' | 'yours' | 'shared' | 'starred';

export type ArtifactCategoryGroup = 'all' | 'docs' | 'slides' | 'design' | 'code';

export interface ProjectArtifact {
  id: string;
  projectId: string;
  title: string;
  kind: ArtifactKind;
  ownership: ArtifactOwnership;
  sharedByName?: string;
  sharedToProjectIds?: string[];
  summary: string;
  content: string;
  slides?: { heading: string; bullets: string[] }[];
  designSpec?: {
    palette: string[];
    typography: string;
    components: string[];
  };
  sourceType: ArtifactSourceType;
  sourceTaskId?: string;
  authorName: string;
  authorType: 'agent' | 'human';
  version: string;
  updatedAt: string;
  starred?: boolean;
  tags: string[];
}

export type WorkspaceTabId =
  | 'overview'
  | 'my_projects'
  | 'orchestration'
  | 'artifacts_all'
  | 'artifacts_yours'
  | 'artifacts_shared'
  | 'artifacts_starred';

export type TeamSectionTab =
  | 'agents'
  | 'principals'
  | 'collab_my'
  | 'collab_manage'
  | 'collab_discover'
  | 'nodes'
  | 'nodes_purchase'
  | 'storage'
  | 'storage_purchase'
  | 'skills'
  | 'skills_purchase';

export interface ProjectWorkspace {
  id: string;
  name: string;
  goal: string;
  /** Whether the user leads this project as employer or participates as an expert contributor */
  role: ProjectRole;
  /** Project lifecycle state for filtering and archival */
  lifecycleStatus?: ProjectLifecycleStatus;
  /** Optional completion or archival date string */
  completedAt?: string;
  /** Dedicated Space compute nodes bound to this project */
  boundNodeIds?: string[];
  /** Dedicated Space persistent storage volume bound to this project */
  storageVolumeId?: string;
  /** Optional community/enterprise zone this project is associated with or published to */
  sourceZoneId?: string;
  workspaceTier: '加密持久化工作区 (50GB)' | '24h 临时沙箱';
  /** Overall project budget ceiling (USD) */
  budgetCapUsd: number;
  /** Total contracted external expert project fees (USD) */
  spentUsd: number;
  hiredAgentIds: string[];
  /** Human experts engaged in this project (outsourcing / advisory / joint delivery) */
  hiredExpertIds?: string[];
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

export type CommunityPostType =
  | 'discussion'
  | 'project'
  | 'event'
  | 'skill_share'
  | 'agn_recommend'
  | 'announcement';

export type CommunityEventFormat = 'offline_meetup' | 'online_live' | 'workshop_training';

export interface CommunityEvent {
  id: string;
  zoneId: string;
  title: string;
  summary: string;
  format: CommunityEventFormat;
  hostName: string;
  hostRole: string;
  hostAccent: string;
  hostCode: string;
  startTimeLabel: string;
  location: string;
  isFree: boolean;
  priceCny: number;
  capacity: number;
  registeredCount: number;
  registeredByMe?: boolean;
  registrationCode?: string;
  registrationNote?: string;
  tags: string[];
  agenda: string[];
  createdAt: string;
}

export interface PublishCommunityEventInput {
  zoneId: string;
  title: string;
  summary: string;
  format: CommunityEventFormat;
  startTimeLabel: string;
  location: string;
  isFree: boolean;
  priceCny: number;
  capacity: number;
  agenda?: string[];
  tags?: string[];
}

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
  pinned?: boolean;
  pinnedBy?: string;
  comments: CommunityComment[];
  /** Present when this feed post embeds a live project matchmaking opportunity */
  linkedProjectId?: string;
  /** Present when this feed post embeds a community themed event (meetup / live / workshop) */
  linkedEventId?: string;
  /** Present when this feed post showcases an expert Agent available in Service Market */
  linkedAgentId?: string;
  /** Present when this feed post publishes a Skill / MCP available in Service Market */
  linkedSkillId?: string;
}

export type SkillKind = 'skill' | 'mcp' | 'workflow';

export type SkillOrigin = 'platform' | 'custom' | 'community';

export interface MarketSkill {
  id: string;
  slug: string;
  name: string;
  summary: string;
  category: AgentCategory;
  kind: SkillKind;
  /** Asset source: platform-maintained value-added service, team custom self-built, or community-contributed */
  origin?: SkillOrigin;
  /** Community distribution revenue-share rate (%) when a platform skill is distributed via a community */
  distributionSharePct?: number;
  /** True when team-created skill is kept private inside AGN Space (not distributed to any community yet) */
  isPrivate?: boolean;
  compatibleRuntimes: string[];
  authorName: string;
  version: string;
  installs: number;
  rating: number;
  /** Optional explicit rating tier ('S' | 'A+' | 'A') and one-time purchase price USD (0 = free) */
  ratingTier?: 'S' | 'A+' | 'A';
  priceUsd?: number;
  license: '免费开源' | '社区共享' | '付费买断';
  zoneIds: string[];
  installCommand: string;
  highlights: string[];
  readmeSnippet: string;
}
