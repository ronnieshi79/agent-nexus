import type {
  AssistantMessage,
  ChatMessage,
  DirectMessage,
  ExpertAgent,
  NegotiationThread,
  PlatformServiceCategory,
  ProjectWorkspace,
  SettlementRecord,
  WorkCardType,
  WorkflowTask,
} from '../types/agentnexus';

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `请求失败 (${res.status})`);
  }
  return data as T;
}

export interface PlatformAssistantResult {
  category: PlatformServiceCategory;
  reply: string;
  cardTitle: string;
  cardDetail: string;
  metricLabel: string;
}

export function sendPlatformAssistantMessage(payload: {
  message: string;
  history: AssistantMessage[];
  workspaces: ProjectWorkspace[];
  tasks: WorkflowTask[];
  negotiations: NegotiationThread[];
  settlements: SettlementRecord[];
  privateAgents: ExpertAgent[];
}): Promise<PlatformAssistantResult> {
  return postJson<PlatformAssistantResult>('/api/assistant/chat', payload);
}

export interface MarketMatchResult {
  summary: string;
  estimatedBudgetUsd: number;
  matches: {
    agentId: string;
    reason: string;
  }[];
}

export function fetchMarketMatches(payload: {
  requirement: string;
  agents: ExpertAgent[];
  hiredIds: string[];
}): Promise<MarketMatchResult> {
  return postJson<MarketMatchResult>('/api/market/match', payload);
}

export interface ExpertDmResult {
  reply: string;
  quotedPriceUsd: number;
  proposedScope: string;
  proposedWorkCardTitle: string;
}

export function sendExpertDirectMessage(payload: {
  agent: ExpertAgent;
  workspace: ProjectWorkspace;
  history: DirectMessage[];
  message: string;
  currentTerms?: {
    negotiatedPriceUsd: number;
    scopeNote: string;
  };
}): Promise<ExpertDmResult> {
  return postJson<ExpertDmResult>('/api/market/dm', payload);
}

export interface ChatOrchestrateResult {
  replies: {
    senderId: string;
    senderHandle: string;
    senderName: string;
    senderType: 'butler' | 'agent';
    content: string;
  }[];
  newTasks: {
    featureModule: string;
    workType: WorkCardType;
    title: string;
    description: string;
    assigneeId: string;
    assigneeHandle: string;
    priority: '高' | '中' | '低';
    budgetLimitUsd: number;
  }[];
}

export function orchestrateGroupChat(payload: {
  message: string;
  workspace: ProjectWorkspace;
  hiredAgents: ExpertAgent[];
  recentMessages: ChatMessage[];
  existingTasks: WorkflowTask[];
}): Promise<ChatOrchestrateResult> {
  return postJson<ChatOrchestrateResult>('/api/chat/orchestrate', payload);
}

export interface KanbanExecuteResult {
  deliverableSummary: string;
  deliverableArtifact: string;
  chatBroadcast: string;
  tokensUsed: number;
  actualCostUsd: number;
}

export function executeKanbanTask(payload: {
  task: WorkflowTask;
  agent?: ExpertAgent;
  workspace: ProjectWorkspace;
}): Promise<KanbanExecuteResult> {
  return postJson<KanbanExecuteResult>('/api/kanban/execute', payload);
}

export interface ExpertOptimizeResult {
  optimizedBio: string;
  recommendedSkills: string[];
  recommendedMcpTools: string[];
  suggestedPricePerTaskUsd: number;
  marketAdvice: string;
}

export function optimizeExpertProfile(payload: {
  name: string;
  title: string;
  category: string;
  skills: string[];
  bio: string;
}): Promise<ExpertOptimizeResult> {
  return postJson<ExpertOptimizeResult>('/api/expert/optimize', payload);
}
