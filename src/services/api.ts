import type {
  BrainRecommendation,
  ChatMessage,
  ExpertAgent,
  ProjectWorkspace,
  ServiceCardId,
  UserPerspective,
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

export function fetchBrainRecommendation(payload: {
  userIntent?: string;
  perspective: UserPerspective;
  activeCard: ServiceCardId;
  workspace: ProjectWorkspace;
  hiredAgents: ExpertAgent[];
  tasks: WorkflowTask[];
}): Promise<BrainRecommendation> {
  return postJson<BrainRecommendation>('/api/brain/recommend', payload);
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

export interface ChatOrchestrateResult {
  replies: {
    senderId: string;
    senderHandle: string;
    senderName: string;
    senderType: 'butler' | 'agent';
    content: string;
  }[];
  newTasks: {
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
