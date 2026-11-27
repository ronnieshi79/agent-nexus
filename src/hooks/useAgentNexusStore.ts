import { useCallback, useMemo, useState } from 'react';
import {
  INITIAL_AGENT_LEASES,
  INITIAL_ASSISTANT_MESSAGES,
  INITIAL_AUDIT_LOGS,
  INITIAL_COMMUNITY_EVENTS,
  INITIAL_COMMUNITY_POSTS,
  INITIAL_COMPUTE_NODES,
  INITIAL_EXPERT_AGENTS,
  INITIAL_HUMAN_DMS,
  INITIAL_HUMAN_EXPERTS,
  INITIAL_MARKET_SKILLS,
  INITIAL_MESSAGES,
  INITIAL_NEGOTIATIONS,
  INITIAL_PROJECT_AGENT_ASSIGNMENTS,
  INITIAL_PROJECT_ARTIFACTS,
  INITIAL_PROJECT_PIPELINES,
  INITIAL_SETTLEMENTS,
  INITIAL_SPACE_APPLICATIONS,
  INITIAL_SPACE_SHARED_NODES,
  INITIAL_STORAGE_VOLUMES,
  INITIAL_TASKS,
  INITIAL_TASK_SESSIONS,
  INITIAL_TEAM_EXPERTS,
  INITIAL_WORKSPACES,
  INITIAL_ZONES,
  INITIAL_ZONE_PROJECTS,
} from '../data/initialData';
import {
  LEASE_PERIOD_META,
  formatAgentDisplayName,
  getAgentLeasePricing,
} from '../components/shared/EntityIdentity';
import {
  executeKanbanTask,
  orchestrateGroupChat,
  sendExpertDirectMessage,
  sendPlatformAssistantMessage,
  sendTaskSessionMessage,
} from '../services/api';
import {
  DEFAULT_PROJECT_TASK_TYPES,
  STAGE_TO_STATUS,
  STATUS_TO_STAGE,
  TASK_STATUS_LABEL_MAP,
  buildTaskTypesFromPack,
  createInitialProjectTaskTypes,
  deriveInitialAgentAssignments,
  getDefaultProjectPipelineSlots,
  getDefaultStagesForAgentCategory,
  getNextPipelineStage,
  getPipelineStageMeta,
  getPipelineStageMetaByStatus,
  getTemplateCreatorIds,
  syncSlotsFromAssignments,
  type TaskTemplatePackId,
} from '../utils/pipelineSync';
import {
  STAGE_LABEL_MAP,
  getTaskCurrentStage,
  resolveTaskWorkflowTeam,
} from '../utils/taskWorkflow';
import type {
  ActiveChatChannel,
  ActiveWorkflowStage,
  AgentCategory,
  AgentLeaseRecord,
  AgentNexusAccount,
  AgentSliceFirewallPolicy,
  ArtifactKind,
  ArtifactSourceType,
  AssistantMessage,
  ChatMessage,
  CliAuthMode,
  CliToolType,
  CommunityEvent,
  CommunityHubTab,
  CommunityPost,
  CommunityPostType,
  CommunityZone,
  ComputeNode,
  ConversationInteractionMode,
  DirectMessage,
  ExpertAgent,
  ExpertRelationType,
  HumanDirectThread,
  LeasePeriod,
  MarketSkill,
  NavViewId,
  NegotiationThread,
  NodeCliConfig,
  NodeCliEntry,
  NodeLeaseBillingCycle,
  NodeOsType,
  PipelineHandoffMode,
  PlatformAuditLog,
  PlatformServiceCategory,
  PrivateCommunityScope,
  ProjectAgentAssignment,
  ProjectArtifact,
  ProjectLifecycleStatus,
  ProjectStageSlot,
  ProjectTaskType,
  ProjectWorkspace,
  PublishCommunityEventInput,
  SettlementRecord,
  SkillKind,
  SpaceJoinApplication,
  SpaceMember,
  SpaceMemberRole,
  SpaceSharedNode,
  StorageBillingMode,
  StorageVolume,
  TaskSessionMessage,
  TaskStatus,
  TaskTypeAccent,
  TeamExpertMembership,
  TeamSectionTab,
  WorkCardType,
  WorkflowTask,
  WorkspaceTabId,
  ZoneProjectOpportunity,
} from '../types/agentnexus';

function nowTimeStr(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatUsd(amount: number): string {
  return `$${Math.round(amount).toLocaleString('en-US')}`;
}

function isWorkspaceReadOnly(workspace?: ProjectWorkspace | null): boolean {
  return (
    workspace?.lifecycleStatus === 'completed' || workspace?.lifecycleStatus === 'archived'
  );
}

function isAgentAuthorizedForProject(
  workspace: ProjectWorkspace | undefined,
  agent: ExpertAgent,
  leases: Record<string, AgentLeaseRecord>,
): boolean {
  if (agent.ownership === 'private') return true;
  if (workspace && workspace.hiredAgentIds.includes(agent.id)) return true;
  if (Boolean(leases[agent.id])) return true;
  return false;
}

function buildArtifactFromTask(
  task: WorkflowTask,
  artifactPath?: string,
  summary?: string,
  updatedAt?: string,
): ProjectArtifact {
  const resolvedPath = artifactPath?.trim() || task.deliverableArtifact || `artifacts/${task.id}.md`;
  const resolvedSummary = summary?.trim() || task.deliverableSummary || task.description;
  const resolvedTime = updatedAt || task.updatedAt || nowTimeStr();
  return {
    id: `art_task_${task.id}`,
    projectId: task.sessionId,
    title: `${task.title}（${resolvedPath}）`,
    kind:
      task.workType === 'planning'
        ? 'prd'
        : task.workType === 'review'
          ? 'architecture'
          : 'code_test',
    ownership: 'yours',
    summary: resolvedSummary,
    content: `来源任务：#${task.id} ${task.title}\n产物路径：${resolvedPath}\n\n${resolvedSummary}`,
    sourceType: 'task_session',
    sourceTaskId: task.id,
    authorName: task.assigneeHandle.replace(/^@/, ''),
    authorType: 'agent',
    version: 'v1.0',
    updatedAt: resolvedTime,
    tags: [task.featureModule || '任务交付', '任务自动生成'],
  };
}

function mapStatusToActiveStage(status: TaskStatus): ActiveWorkflowStage | null {
  if (status === 'pending') return 'planning';
  if (status === 'in_progress') return 'development';
  if (status === 'review') return 'testing';
  return null;
}

function pickLoadBalancedStageAgent(
  projectId: string,
  targetStage: ActiveWorkflowStage,
  currentAssigneeId: string | undefined,
  assignments: ProjectAgentAssignment[],
  allAgents: ExpertAgent[],
  tasks: WorkflowTask[],
  excludeAgentId?: string,
): ExpertAgent | undefined {
  const candidates = assignments
    .filter(
      (a) =>
        a.stages.includes(targetStage) &&
        a.agentId !== excludeAgentId &&
        allAgents.some((ag) => ag.id === a.agentId),
    )
    .map((a) => allAgents.find((ag) => ag.id === a.agentId)!)
    .filter(Boolean);

  if (candidates.length === 0) return undefined;

  // Keep current assignee if they are already stationed at this stage and not excluded
  if (
    currentAssigneeId &&
    currentAssigneeId !== excludeAgentId &&
    candidates.some((c) => c.id === currentAssigneeId)
  ) {
    return candidates.find((c) => c.id === currentAssigneeId);
  }

  // Load-balance across concurrent experts stationed at this stage by active task count
  let best = candidates[0];
  let bestLoad = Number.POSITIVE_INFINITY;
  for (const ag of candidates) {
    const load = tasks.filter(
      (t) => t.sessionId === projectId && t.status !== 'done' && t.assigneeId === ag.id,
    ).length;
    if (load < bestLoad) {
      bestLoad = load;
      best = ag;
    }
  }
  return best;
}

export interface CreateWorkCardInput {
  sessionId?: string;
  featureModule: string;
  workType: WorkCardType;
  title: string;
  description: string;
  assigneeId: string;
  priority: '高' | '中' | '低';
}

export function useAgentNexusStore() {
  const [zones, setZones] = useState<CommunityZone[]>(INITIAL_ZONES);
  const [humanExperts] = useState(INITIAL_HUMAN_EXPERTS);
  const [activeZoneId, setActiveZoneId] = useState<string>('zone_aibuilder');
  const [joinedZoneIds, setJoinedZoneIds] = useState<string[]>([
    'zone_public',
    'zone_my_company',
    'zone_aibuilder',
    'zone_hz_dnx',
    'zone_zj_opc',
    'zone_ai_robotics',
  ]);
  const [spaceSharedNodes, setSpaceSharedNodes] = useState<SpaceSharedNode[]>(
    INITIAL_SPACE_SHARED_NODES,
  );
  const [communityEvents, setCommunityEvents] = useState<CommunityEvent[]>(
    INITIAL_COMMUNITY_EVENTS,
  );

  const [activeView, setActiveView] = useState<NavViewId>('chat');
  const [workspaces, setWorkspaces] = useState<ProjectWorkspace[]>(INITIAL_WORKSPACES);
  const [zoneProjects, setZoneProjects] = useState<ZoneProjectOpportunity[]>(INITIAL_ZONE_PROJECTS);
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>(INITIAL_COMMUNITY_POSTS);
  const [followedEntityKeys, setFollowedEntityKeys] = useState<string[]>([
    'human:程予安',
    'human:唐星河',
    'human:陈可心',
    'human:沈知行',
    'agent:全栈创客极速手',
    'agent:架构审查员',
  ]);
  const [activeSessionId, setActiveSessionId] = useState<string>(INITIAL_WORKSPACES[0].id);

  // Unified Chat Channel: New Session Launcher | Platform Assistant | Project Group | Human DM | Agent DM | Task Session
  const [activeChatChannel, setActiveChatChannel] = useState<ActiveChatChannel>({
    type: 'new_session',
  });
  const [lastChatChannel, setLastChatChannel] = useState<ActiveChatChannel>({
    type: 'group',
    projectId: INITIAL_WORKSPACES[0].id,
  });
  const [lastTaskSessionId, setLastTaskSessionId] = useState<string>(
    INITIAL_TASKS[1]?.id || INITIAL_TASKS[0]?.id || '',
  );
  const [preferredConversationMode, setPreferredConversationMode] =
    useState<ConversationInteractionMode>('task');

  const conversationMode: ConversationInteractionMode =
    activeChatChannel.type === 'task_session'
      ? 'task'
      : activeChatChannel.type === 'new_session'
        ? preferredConversationMode
        : 'chat';

  const [agents, setAgents] = useState<ExpertAgent[]>(INITIAL_EXPERT_AGENTS);
  const [allTasks, setAllTasks] = useState<WorkflowTask[]>(INITIAL_TASKS);
  const [allMessages, setAllMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [taskSessions, setTaskSessions] =
    useState<Record<string, TaskSessionMessage[]>>(INITIAL_TASK_SESSIONS);
  const [negotiations, setNegotiations] = useState<NegotiationThread[]>(INITIAL_NEGOTIATIONS);
  const [humanDmThreads, setHumanDmThreads] = useState<HumanDirectThread[]>(INITIAL_HUMAN_DMS);
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>(
    INITIAL_ASSISTANT_MESSAGES,
  );
  const [settlements, setSettlements] = useState<SettlementRecord[]>(INITIAL_SETTLEMENTS);
  const [spaceApplications, setSpaceApplications] = useState<SpaceJoinApplication[]>(
    INITIAL_SPACE_APPLICATIONS,
  );
  const [auditLogs, setAuditLogs] = useState<PlatformAuditLog[]>(INITIAL_AUDIT_LOGS);
  const [agentLeases, setAgentLeases] =
    useState<Record<string, AgentLeaseRecord>>(INITIAL_AGENT_LEASES);
  const [purchasedSkillIds, setPurchasedSkillIds] = useState<string[]>([
    'skill_ts_scaffold',
    'skill_git_pr_guard',
    'skill_playwright_suite',
    'skill_stripe_idempotency',
    'skill_custom_internal_pay',
    'skill_robot_cloud_mcp',
  ]);
  const [teamExperts, setTeamExperts] = useState<TeamExpertMembership[]>(INITIAL_TEAM_EXPERTS);
  const [computeNodes, setComputeNodes] = useState<ComputeNode[]>(INITIAL_COMPUTE_NODES);
  const [storageVolumes, setStorageVolumes] = useState<StorageVolume[]>(INITIAL_STORAGE_VOLUMES);
  const [projectPipelines, setProjectPipelines] =
    useState<Record<string, ProjectStageSlot[]>>(INITIAL_PROJECT_PIPELINES);
  const [projectAgentAssignments, setProjectAgentAssignments] = useState<
    Record<string, ProjectAgentAssignment[]>
  >(() => ({
    ...deriveInitialAgentAssignments(
      INITIAL_WORKSPACES,
      INITIAL_PROJECT_PIPELINES,
      INITIAL_EXPERT_AGENTS,
    ),
    ...INITIAL_PROJECT_AGENT_ASSIGNMENTS,
  }));
  const [projectTaskTypes, setProjectTaskTypes] = useState<Record<string, ProjectTaskType[]>>(
    () =>
      createInitialProjectTaskTypes(INITIAL_WORKSPACES, {
        ...deriveInitialAgentAssignments(
          INITIAL_WORKSPACES,
          INITIAL_PROJECT_PIPELINES,
          INITIAL_EXPERT_AGENTS,
        ),
        ...INITIAL_PROJECT_AGENT_ASSIGNMENTS,
      }),
  );
  const [artifacts, setArtifacts] = useState<ProjectArtifact[]>(() => {
    const existingTaskIds = new Set(
      INITIAL_PROJECT_ARTIFACTS.map((a) => a.sourceTaskId).filter(Boolean),
    );
    const derived = INITIAL_TASKS.filter(
      (t) => Boolean(t.deliverableArtifact) && !existingTaskIds.has(t.id),
    ).map((t) => buildArtifactFromTask(t));
    return [...INITIAL_PROJECT_ARTIFACTS, ...derived];
  });
  const [marketSkills, setMarketSkills] = useState<MarketSkill[]>(INITIAL_MARKET_SKILLS);
  const [activeCommunityTab, setActiveCommunityTab] = useState<CommunityHubTab>('social_all');

  const [dmBusyAgentId, setDmBusyAgentId] = useState<string | null>(null);
  const [dmError, setDmError] = useState<string | null>(null);
  const [taskSessionBusyId, setTaskSessionBusyId] = useState<string | null>(null);
  const [taskSessionError, setTaskSessionError] = useState<string | null>(null);
  const [assistantBusy, setAssistantBusy] = useState(false);

  const [isAiBusy, setIsAiBusy] = useState(false);
  const [executingTaskId, setExecutingTaskId] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const [chatDraftSeed, setChatDraftSeed] = useState<string>('');
  const [marketCategorySeed, setMarketCategorySeed] = useState<'all' | AgentCategory>('all');
  const [openMountDrawerSignal, setOpenMountDrawerSignal] = useState(0);
  const [kanbanProjectSeed, setKanbanProjectSeed] = useState<string | null>(null);
  const [kanbanTabSeed, setKanbanTabSeed] = useState<WorkspaceTabId | null>(null);
  const [teamTabSeed, setTeamTabSeed] = useState<TeamSectionTab | null>(null);
  const [discoverZoneSeed, setDiscoverZoneSeed] = useState<string | null>(null);
  const ACCOUNT_STORAGE_KEY = 'agentnexus_account_session_v1';
  const DEFAULT_ACCOUNT: AgentNexusAccount = {
    id: 'usr_ronnie_01',
    name: 'Ronnie',
    email: 'Ronnie.Shi79@gmail.com',
    planLabel: 'Pro 主理',
    workspaceNodeId: 'anx-node-cn-01',
    avatarInitials: 'RO',
  };

  const [account, setAccount] = useState<AgentNexusAccount | null>(() => {
    if (typeof window === 'undefined') return DEFAULT_ACCOUNT;
    try {
      const saved = window.localStorage.getItem(ACCOUNT_STORAGE_KEY);
      if (saved === '__LOGGED_OUT__') return null;
      if (saved) {
        const parsed = JSON.parse(saved) as AgentNexusAccount;
        if (parsed && parsed.email) return parsed;
      }
    } catch {
      // Fallback to default active account if storage is unavailable
    }
    return DEFAULT_ACCOUNT;
  });
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const loginAccount = useCallback((email: string, name?: string) => {
    const cleanEmail = email.trim();
    const derivedName =
      name?.trim() ||
      cleanEmail
        .split('@')[0]
        .replace(/[._-]+/g, ' ')
        .trim() ||
      'AgentNexus 用户';
    const initials = derivedName.slice(0, 2).toUpperCase();
    const nextAccount: AgentNexusAccount = {
      id: `usr_${Date.now().toString().slice(-5)}`,
      name: derivedName,
      email: cleanEmail,
      planLabel: 'Pro 主理',
      workspaceNodeId: 'anx-node-cn-01',
      avatarInitials: initials,
    };
    setAccount(nextAccount);
    try {
      window.localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(nextAccount));
    } catch {
      // ignore storage errors
    }
  }, []);

  const logoutAccount = useCallback(() => {
    setAccount(null);
    try {
      window.localStorage.setItem(ACCOUNT_STORAGE_KEY, '__LOGGED_OUT__');
    } catch {
      // ignore storage errors
    }
  }, []);

  const joinedZones = useMemo(
    () => zones.filter((z) => !z.comingSoon && (z.isPlatformDefault || joinedZoneIds.includes(z.id))),
    [joinedZoneIds, zones],
  );

  const activeZone = useMemo(
    () => joinedZones.find((z) => z.id === activeZoneId) || joinedZones[0] || zones[0],
    [joinedZones, zones, activeZoneId],
  );

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeSessionId) || workspaces[0],
    [workspaces, activeSessionId],
  );

  const hiredIds = activeWorkspace.hiredAgentIds;

  const hiredAgents = useMemo(
    () => agents.filter((a) => hiredIds.includes(a.id)),
    [agents, hiredIds],
  );

  // Zone-scoped Expert Market: controlled inside Expert Market view (excludes space-suspended Agents)
  const marketplaceAgents = useMemo(() => {
    const suspended = new Set(activeZone.suspendedAgentIds || []);
    return agents.filter(
      (a) => a.listedZoneIds.includes(activeZone.id) && !suspended.has(a.id),
    );
  }, [agents, activeZone.id, activeZone.suspendedAgentIds]);

  const totalMarketExpertsCount = useMemo(
    () => agents.filter((a) => a.isListedInMarket).length,
    [agents],
  );

  const privateAgents = useMemo(
    () => agents.filter((a) => a.ownership === 'private'),
    [agents],
  );

  const sessionTasks = useMemo(
    () => allTasks.filter((t) => t.sessionId === activeWorkspace.id),
    [allTasks, activeWorkspace.id],
  );

  const sessionMessages = useMemo(
    () => allMessages.filter((m) => m.sessionId === activeWorkspace.id),
    [allMessages, activeWorkspace.id],
  );

  const dmHistories = useMemo(() => {
    const map: Record<string, DirectMessage[]> = {};
    negotiations.forEach((n) => {
      map[n.agentId] = n.messages;
    });
    return map;
  }, [negotiations]);

  const activeNegotiationCount = useMemo(
    () => negotiations.filter((n) => n.status !== 'hired').length,
    [negotiations],
  );

  const unsettledCount = useMemo(
    () => settlements.filter((s) => s.status === 'unsettled').length,
    [settlements],
  );

  const reviewTaskCount = useMemo(
    () => allTasks.filter((t) => t.status === 'review').length,
    [allTasks],
  );

  const managedZoneIdSet = useMemo(
    () =>
      new Set(
        zones
          .filter((z) => z.kind === 'private' && Boolean(z.createdByMe || z.isCurrentUserPrincipal))
          .map((z) => z.id),
      ),
    [zones],
  );

  const managedSpaceApplications = useMemo(
    () =>
      spaceApplications.filter(
        (a) => managedZoneIdSet.has(a.zoneId) && a.humanExpertId !== 'human_me',
      ),
    [managedZoneIdSet, spaceApplications],
  );

  const pendingSpaceApplicationCount = useMemo(
    () => managedSpaceApplications.filter((a) => a.status === 'pending').length,
    [managedSpaceApplications],
  );

  const assistantPendingCount =
    unsettledCount + reviewTaskCount + activeNegotiationCount + pendingSpaceApplicationCount;

  const openNewSessionLauncher = useCallback(() => {
    setActiveChatChannel({ type: 'new_session' });
    setActiveView('chat');
  }, []);

  const openAssistantChat = useCallback(() => {
    setPreferredConversationMode('chat');
    setActiveChatChannel({ type: 'assistant' });
    setActiveView('chat');
  }, []);

  const selectSession = useCallback((sessionId: string) => {
    setPreferredConversationMode('chat');
    setActiveSessionId(sessionId);
    setActiveChatChannel({ type: 'group', projectId: sessionId });
    setActiveView('chat');
  }, []);

  const openKanbanForProject = useCallback(
    (projectId?: string) => {
      setKanbanProjectSeed(projectId || activeWorkspace.id);
      setKanbanTabSeed('my_projects');
      setActiveView('kanban');
    },
    [activeWorkspace.id],
  );

  const openWorkspaceTab = useCallback((tab: WorkspaceTabId) => {
    setKanbanTabSeed(tab);
    setActiveView('kanban');
  }, []);

  const openTeamTab = useCallback((tab: TeamSectionTab) => {
    setTeamTabSeed(tab);
    setActiveView('team');
  }, []);

  const openCommunityService = useCallback(
    (zoneId?: string, subTab: CommunityHubTab = 'service_agents') => {
      if (zoneId) setActiveZoneId(zoneId);
      setActiveCommunityTab(subTab);
      setActiveView('community');
    },
    [],
  );

  const openCommunityDiscover = useCallback((zoneId?: string) => {
    if (zoneId) {
      setActiveZoneId(zoneId);
      setDiscoverZoneSeed(zoneId);
    }
    setActiveCommunityTab('social_all');
    setActiveView('community');
  }, []);

  const openMarketForZone = useCallback((zoneId: string) => {
    setActiveZoneId(zoneId);
    setActiveCommunityTab('service_agents');
    setActiveView('community');
  }, []);

  const createProjectArtifact = useCallback(
    (input: {
      projectId: string;
      title: string;
      kind: ArtifactKind;
      summary: string;
      content: string;
      sourceType: ArtifactSourceType;
      sourceTaskId?: string;
      tags: string[];
      slides?: { heading: string; bullets: string[] }[];
      designSpec?: { palette: string[]; typography: string; components: string[] };
    }) => {
      const cleanTitle = input.title.trim();
      if (!cleanTitle) return;
      const ts = nowTimeStr();
      const creatorName = account?.name || '林致远（我）';
      const newArtifact: ProjectArtifact = {
        id: `art_${Date.now().toString().slice(-6)}`,
        projectId: input.projectId,
        title: cleanTitle,
        kind: input.kind,
        ownership: 'yours',
        summary: input.summary.trim() || '由 Artifacts 工作空间新建或归档的协作产物。',
        content: input.content.trim() || input.summary.trim() || cleanTitle,
        slides: input.slides,
        designSpec: input.designSpec,
        sourceType: input.sourceType,
        sourceTaskId: input.sourceTaskId,
        authorName: creatorName,
        authorType: 'human',
        version: 'v1.0',
        updatedAt: `今天 ${ts}`,
        tags: input.tags.length > 0 ? input.tags : ['Artifact'],
      };
      setArtifacts((prev) => [newArtifact, ...prev]);
      const projName = workspaces.find((w) => w.id === input.projectId)?.name || '当前项目';
      setAuditLogs((prev) => [
        {
          id: `aud_art_${Date.now()}`,
          category: 'audit',
          title: `已创建 Artifact：${cleanTitle}`,
          detail: `关联项目：${projName}，已同步归档至 Artifacts 产物库。`,
          severity: 'success',
          timestamp: ts,
        },
        ...prev,
      ]);
    },
    [account?.name, workspaces],
  );

  const upsertTaskDeliverableArtifact = useCallback(
    (task: WorkflowTask, artifactPath?: string, summary?: string, updatedAt?: string) => {
      const resolvedPath = artifactPath?.trim() || task.deliverableArtifact;
      if (!resolvedPath) return;
      const nextArt = buildArtifactFromTask(task, resolvedPath, summary, updatedAt);
      setArtifacts((prev) => {
        const idx = prev.findIndex((a) => a.sourceTaskId === task.id || a.id === nextArt.id);
        if (idx === -1) return [nextArt, ...prev];
        const existing = prev[idx];
        const updated: ProjectArtifact = {
          ...existing,
          title: nextArt.title,
          summary: nextArt.summary,
          content: nextArt.content,
          authorName: nextArt.authorName,
          updatedAt: nextArt.updatedAt,
        };
        const copy = [...prev];
        copy[idx] = updated;
        return copy;
      });
    },
    [],
  );

  const shareArtifactToProjectChat = useCallback(
    (artifactId: string, targetProjectId: string, note?: string) => {
      const targetProj = workspaces.find((w) => w.id === targetProjectId);
      if (!targetProj || isWorkspaceReadOnly(targetProj)) return;
      let targetArt = artifacts.find((a) => a.id === artifactId);
      if (!targetArt && artifactId.startsWith('art_task_')) {
        const sourceTaskId = artifactId.replace(/^art_task_/, '');
        const sourceTask = allTasks.find((t) => t.id === sourceTaskId);
        if (sourceTask) {
          targetArt = buildArtifactFromTask(sourceTask);
          const materialized = targetArt;
          setArtifacts((prev) =>
            prev.some((a) => a.id === materialized.id) ? prev : [materialized, ...prev],
          );
        }
      }
      if (!targetArt) return;
      const ts = nowTimeStr();
      const senderName = account?.name || '林致远（我）';
      const resolvedArt = targetArt;
      setArtifacts((prev) =>
        prev.map((a) =>
          a.id === resolvedArt.id
            ? {
                ...a,
                sharedToProjectIds: Array.from(
                  new Set([...(a.sharedToProjectIds || []), targetProjectId]),
                ),
              }
            : a,
        ),
      );
      setAllMessages((prev) => [
        ...prev,
        {
          id: `msg_art_share_${Date.now()}`,
          sessionId: targetProjectId,
          senderType: 'employer',
          senderId: 'employer',
          senderName,
          senderHandle: `@${senderName}`,
          content: `📎 分享了 Artifact「${resolvedArt.title}」（${resolvedArt.version}）：${
            note?.trim() || resolvedArt.summary
          }`,
          timestamp: ts,
        },
      ]);
      setAuditLogs((prev) => [
        {
          id: `aud_art_share_${Date.now()}`,
          category: 'general',
          title: `已分享 Artifact 至项目群「${targetProj.name}」`,
          detail: `产物：${resolvedArt.title}（${resolvedArt.version}）`,
          severity: 'success',
          timestamp: ts,
        },
        ...prev,
      ]);
    },
    [account?.name, allTasks, artifacts, workspaces],
  );

  const toggleStarArtifact = useCallback((artifactId: string) => {
    setArtifacts((prev) =>
      prev.map((a) => (a.id === artifactId ? { ...a, starred: !a.starred } : a)),
    );
  }, []);

  const deleteProjectArtifact = useCallback((artifactId: string) => {
    setArtifacts((prev) => prev.filter((a) => a.id !== artifactId));
  }, []);

  const toggleJoinZone = useCallback(
    (zoneId: string) => {
      const target = zones.find((z) => z.id === zoneId);
      if (!target || target.comingSoon) return;
      if (target.isPlatformDefault || target.kind === 'official') return;

      const currentlyJoined = joinedZoneIds.includes(zoneId);
      setJoinedZoneIds((prev) =>
        currentlyJoined ? prev.filter((id) => id !== zoneId) : [...prev, zoneId],
      );
      setZones((prev) =>
        prev.map((z) =>
          z.id === zoneId
            ? { ...z, memberCount: Math.max(1, z.memberCount + (currentlyJoined ? -1 : 1)) }
            : z,
        ),
      );
      if (currentlyJoined && activeZoneId === zoneId) {
        setActiveZoneId('zone_public');
      }
      setAuditLogs((prev) => [
        {
          id: `aud_zone_${Date.now()}`,
          category: 'general',
          title: currentlyJoined ? `已退出私有社区：${target.name}` : `已加入私有社区：${target.name}`,
          detail: currentlyJoined
            ? '已从服务市场与社区交流的可切换社区列表中移除，可随时在「AGN空间 → Agent 团队 → Agent 社区」重新加入。'
            : `社区类型：${target.typeLabel}；已同步开放至「AGN 社区」切换器。`,
          severity: currentlyJoined ? 'info' : 'success',
          timestamp: nowTimeStr(),
        },
        ...prev,
      ]);
    },
    [activeZoneId, joinedZoneIds, zones],
  );

  const applyToJoinZone = useCallback(
    (zoneId: string, note: string) => {
      const target = zones.find((z) => z.id === zoneId);
      if (!target || target.kind !== 'private' || target.comingSoon) return;
      const applicantName = account?.name || '林致远（我）';
      const alreadyPending = spaceApplications.some(
        (a) => a.zoneId === zoneId && a.humanExpertId === 'human_me' && a.status === 'pending',
      );
      if (alreadyPending) return;
      const ts = nowTimeStr();
      const newApp: SpaceJoinApplication = {
        id: `app_self_${Date.now().toString().slice(-5)}`,
        zoneId: target.id,
        zoneName: target.name,
        applicantName,
        applicantTitle: 'OPC 成员 / 全栈工程负责人',
        humanExpertId: 'human_me',
        avatarInitials: account?.avatarInitials || '致远',
        avatarAccent: '#0284c7',
        requestedRole: 'member',
        note: note.trim() || `申请加入私有社区「${target.name}」，参与项目共创与专家协作。`,
        createdAt: ts,
        status: 'pending',
      };
      setSpaceApplications((prev) => [newApp, ...prev]);
      setAuditLogs((prev) => [
        {
          id: `aud_zone_apply_${Date.now()}`,
          category: 'approval',
          title: `已提交私有社区加入申请：${target.name}`,
          detail: `等待主理人 ${target.principalName} 审批；若持有邀请码也可直接验证加入。`,
          severity: 'info',
          timestamp: ts,
        },
        ...prev,
      ]);
    },
    [account?.avatarInitials, account?.name, spaceApplications, zones],
  );

  const updateZoneInviteCode = useCallback(
    (zoneId: string, newCode: string) => {
      const clean = newCode.trim().toUpperCase();
      if (!clean) return;
      setZones((prev) =>
        prev.map((z) => (z.id === zoneId && z.kind === 'private' ? { ...z, inviteCode: clean } : z)),
      );
      const target = zones.find((z) => z.id === zoneId);
      if (target) {
        setAuditLogs((prev) => [
          {
            id: `aud_zone_code_${Date.now()}`,
            category: 'general',
            title: `已更新社区邀请码：${target.name}`,
            detail: `最新邀请码：${clean}`,
            severity: 'info',
            timestamp: nowTimeStr(),
          },
          ...prev,
        ]);
      }
    },
    [zones],
  );

  const createCollabZone = useCallback(
    (input: {
      name: string;
      shortCode: string;
      privateScope: PrivateCommunityScope;
      regionCulture: string;
      tagline: string;
      focusDomains: string[];
      accentColor: string;
      inviteCode?: string;
    }) => {
      const newId = `zone_custom_${Date.now().toString().slice(-5)}`;
      const scopeTypeLabelMap: Record<PrivateCommunityScope, string> = {
        enterprise: '私有社区 · 企业',
        opc: '私有社区 · OPC',
        topic: '私有社区 · 主题',
      };
      const ownerName = account?.name || '林致远（我）';
      const resolvedCode =
        input.inviteCode?.trim().toUpperCase() || `AGN-${Date.now().toString().slice(-4)}`;
      const newZone: CommunityZone = {
        id: newId,
        name: input.name.trim(),
        shortCode: input.shortCode.trim().slice(0, 2) || input.name.trim().slice(0, 1),
        kind: 'private',
        privateScope: input.privateScope,
        typeLabel: scopeTypeLabelMap[input.privateScope],
        regionCulture: input.regionCulture.trim(),
        tagline: input.tagline.trim(),
        focusDomains: input.focusDomains,
        accentColor: input.accentColor,
        memberCount: 1,
        principalName: ownerName,
        isCurrentUserPrincipal: true,
        allowApplication: true,
        createdByMe: true,
        inviteCode: resolvedCode,
        members: [
          {
            id: `mem_owner_${newId}`,
            humanExpertId: 'human_me',
            name: ownerName,
            title:
              input.privateScope === 'enterprise'
                ? '社区主理人 · 企业负责人'
                : '社区主理人 · 发起人',
            role: 'owner',
            avatarInitials: account?.avatarInitials || '致远',
            avatarAccent: input.accentColor,
            joinedAt: nowTimeStr(),
          },
        ],
        suspendedAgentIds: [],
      };
      setZones((prev) => [newZone, ...prev]);
      setJoinedZoneIds((prev) => (prev.includes(newId) ? prev : [...prev, newId]));
      setCommunityPosts((prev) => [
        {
          id: `post_init_${newId}`,
          zoneId: newId,
          type: 'announcement',
          pinned: true,
          pinnedBy: newZone.principalName,
          authorName: newZone.principalName,
          authorHandle: '@zhiyuan_opc',
          authorRole: `${newZone.name} · 社区主理人`,
          authorAccent: newZone.accentColor,
          authorCode: newZone.shortCode,
          title: `【社区公告】欢迎加入私有社区「${newZone.name}」`,
          content: `${newZone.tagline}（社区准入邀请码：${resolvedCode}，亦支持外部成员提交加入申请由主理人审批）`,
          tags: newZone.focusDomains.slice(0, 3),
          createdAt: nowTimeStr(),
          likes: 1,
          comments: [],
        },
        ...prev,
      ]);
      setAuditLogs((prev) => [
        {
          id: `aud_zone_new_${Date.now()}`,
          category: 'general',
          title: `已创建私有 Agent 社区：${newZone.name}`,
          detail: `${newZone.typeLabel} · ${newZone.regionCulture || '主理人自治'}；已自动加入并同步至 AGN 社区。`,
          severity: 'success',
          timestamp: nowTimeStr(),
        },
        ...prev,
      ]);
      return newId;
    },
    [account?.avatarInitials, account?.name],
  );

  const deleteCollabZone = useCallback(
    (zoneId: string) => {
      const target = zones.find((z) => z.id === zoneId);
      if (!target || target.isPlatformDefault || target.kind === 'official' || !target.createdByMe)
        return;
      setZones((prev) => prev.filter((z) => z.id !== zoneId));
      setJoinedZoneIds((prev) => prev.filter((id) => id !== zoneId));
      setSpaceSharedNodes((prev) => prev.filter((n) => n.zoneId !== zoneId));
      if (activeZoneId === zoneId) {
        setActiveZoneId('zone_public');
      }
      setAuditLogs((prev) => [
        {
          id: `aud_zone_del_${Date.now()}`,
          category: 'general',
          title: `已解散私有社区：${target.name}`,
          detail: '该自建私有社区及其共享资源已从您的 Agent 社区列表与切换器中移除。',
          severity: 'warning',
          timestamp: nowTimeStr(),
        },
        ...prev,
      ]);
    },
    [activeZoneId, zones],
  );

  // ---------------- Self-Created Collaboration Space Governance ----------------

  const inviteSpaceMember = useCallback(
    (
      zoneId: string,
      input: {
        humanExpertId?: string;
        name: string;
        title: string;
        role: SpaceMemberRole;
        avatarInitials?: string;
        avatarAccent?: string;
      },
    ) => {
      const target = zones.find((z) => z.id === zoneId);
      if (!target) return;
      const cleanName = input.name.trim();
      if (!cleanName) return;
      const newMember: SpaceMember = {
        id: `mem_${Date.now().toString().slice(-5)}`,
        humanExpertId: input.humanExpertId,
        name: cleanName,
        title: input.title.trim() || '私有社区成员',
        role: input.role,
        avatarInitials: input.avatarInitials || cleanName.slice(0, 2).toUpperCase(),
        avatarAccent: input.avatarAccent || '#1d4ed8',
        joinedAt: nowTimeStr(),
      };
      setZones((prev) =>
        prev.map((z) => {
          if (z.id !== zoneId) return z;
          const existing = z.members || [];
          if (
            input.humanExpertId &&
            existing.some((m) => m.humanExpertId === input.humanExpertId)
          ) {
            return z;
          }
          return {
            ...z,
            members: [...existing, newMember],
            memberCount: Math.max(existing.length + 1, z.memberCount + 1),
          };
        }),
      );
      setAuditLogs((prev) => [
        {
          id: `aud_mem_add_${Date.now()}`,
          category: 'general',
          title: `空间成员加入：${cleanName} → ${target.name}`,
          detail: `角色：${input.role === 'admin' ? '空间管理员' : '普通成员'} · ${newMember.title}`,
          severity: 'success',
          timestamp: nowTimeStr(),
        },
        ...prev,
      ]);
    },
    [zones],
  );

  const updateSpaceMemberRole = useCallback(
    (zoneId: string, memberId: string, role: SpaceMemberRole) => {
      setZones((prev) =>
        prev.map((z) => {
          if (z.id !== zoneId) return z;
          return {
            ...z,
            members: (z.members || []).map((m) =>
              m.id === memberId && m.role !== 'owner' ? { ...m, role } : m,
            ),
          };
        }),
      );
    },
    [],
  );

  const kickSpaceMember = useCallback(
    (zoneId: string, memberId: string) => {
      const target = zones.find((z) => z.id === zoneId);
      const member = target?.members?.find((m) => m.id === memberId);
      if (!target || !member || member.role === 'owner') return;
      setZones((prev) =>
        prev.map((z) => {
          if (z.id !== zoneId) return z;
          const nextMembers = (z.members || []).filter((m) => m.id !== memberId);
          return {
            ...z,
            members: nextMembers,
            memberCount: Math.max(nextMembers.length, z.memberCount - 1),
          };
        }),
      );
      setAuditLogs((prev) => [
        {
          id: `aud_mem_kick_${Date.now()}`,
          category: 'general',
          title: `已将 ${member.name} 移出「${target.name}」`,
          detail: '该成员已失去该私有社区的共享节点与内部服务市场访问权限。',
          severity: 'warning',
          timestamp: nowTimeStr(),
        },
        ...prev,
      ]);
    },
    [zones],
  );

  const addSpaceSharedNode = useCallback(
    (
      zoneId: string,
      input: {
        name: string;
        os: NodeOsType;
        osVersion: string;
        origin: 'private' | 'cloud';
        region: string;
        cpuCores: number;
        memoryGb: number;
        gpuSpec?: string;
        supportedClis: string[];
        sharedSandboxQuota: number;
        accessPolicy: 'all_members' | 'admins_only';
        monthlyCostUsd: number;
      },
    ) => {
      const target = zones.find((z) => z.id === zoneId);
      if (!target) return;
      const newNode: SpaceSharedNode = {
        id: `snode_${Date.now().toString().slice(-5)}`,
        zoneId,
        name: input.name.trim() || `${target.shortCode} 共享节点`,
        os: input.os,
        osVersion: input.osVersion,
        origin: input.origin,
        region: input.region,
        cpuCores: Math.max(2, Math.round(input.cpuCores)),
        memoryGb: Math.max(4, Math.round(input.memoryGb)),
        gpuSpec: input.gpuSpec,
        status: 'online',
        supportedClis: input.supportedClis.length > 0 ? input.supportedClis : ['Claude Code'],
        sharedSandboxQuota: Math.max(1, Math.round(input.sharedSandboxQuota)),
        usedSandboxes: 0,
        accessPolicy: input.accessPolicy,
        monthlyCostUsd: Math.max(0, Math.round(input.monthlyCostUsd)),
        addedAt: nowTimeStr(),
      };
      setSpaceSharedNodes((prev) => [newNode, ...prev]);
      setAuditLogs((prev) => [
        {
          id: `aud_snode_add_${Date.now()}`,
          category: 'general',
          title: `已为「${target.name}」接入共享 Agent 节点：${newNode.name}`,
          detail: `${newNode.osVersion} · ${newNode.cpuCores}C/${newNode.memoryGb}G · 共享 ${newNode.sharedSandboxQuota} 并发沙箱。`,
          severity: 'success',
          timestamp: nowTimeStr(),
        },
        ...prev,
      ]);
    },
    [zones],
  );

  const toggleSpaceSharedNodeStatus = useCallback((nodeId: string) => {
    setSpaceSharedNodes((prev) =>
      prev.map((n) =>
        n.id === nodeId
          ? { ...n, status: n.status === 'online' ? 'standby' : 'online' }
          : n,
      ),
    );
  }, []);

  const updateSpaceSharedNode = useCallback(
    (
      nodeId: string,
      patch: Partial<Pick<SpaceSharedNode, 'sharedSandboxQuota' | 'accessPolicy'>>,
    ) => {
      setSpaceSharedNodes((prev) =>
        prev.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)),
      );
    },
    [],
  );

  const removeSpaceSharedNode = useCallback(
    (nodeId: string) => {
      const node = spaceSharedNodes.find((n) => n.id === nodeId);
      setSpaceSharedNodes((prev) => prev.filter((n) => n.id !== nodeId));
      setAgents((prev) =>
        prev.map((a) =>
          a.hostNodeId === nodeId ? { ...a, hostNodeId: undefined, hostCliId: undefined } : a,
        ),
      );
      setWorkspaces((prev) =>
        prev.map((w) => ({
          ...w,
          boundNodeIds: (w.boundNodeIds || []).filter((id) => id !== nodeId),
        })),
      );
      if (node) {
        setAuditLogs((prev) => [
          {
            id: `aud_snode_del_${Date.now()}`,
            category: 'general',
            title: `已移除空间共享节点：${node.name}`,
            detail: node.origin === 'cloud' ? '云端共享节点已退租释放。' : '自有共享节点已解除空间绑定。',
            severity: 'info',
            timestamp: nowTimeStr(),
          },
          ...prev,
        ]);
      }
    },
    [spaceSharedNodes],
  );

  const toggleSpaceAgentOnline = useCallback(
    (zoneId: string, agentId: string) => {
      const targetZone = zones.find((z) => z.id === zoneId);
      const targetAgent = agents.find((a) => a.id === agentId);
      if (!targetZone || !targetAgent) return;
      const currentlySuspended = (targetZone.suspendedAgentIds || []).includes(agentId);
      setZones((prev) =>
        prev.map((z) => {
          if (z.id !== zoneId) return z;
          const cur = z.suspendedAgentIds || [];
          return {
            ...z,
            suspendedAgentIds: currentlySuspended
              ? cur.filter((id) => id !== agentId)
              : [...cur, agentId],
          };
        }),
      );
      setAuditLogs((prev) => [
        {
          id: `aud_zagent_toggle_${Date.now()}`,
          category: 'general',
          title: currentlySuspended
            ? `已恢复上线：${targetAgent.handle}（${targetZone.name}）`
            : `已下线停服：${targetAgent.handle}（${targetZone.name}）`,
          detail: currentlySuspended
            ? '该专业 Agent 已重新展示在该社区的服务市场并恢复接单。'
            : '该专业 Agent 已从该社区服务市场暂时下线，不影响其他社区或历史项目。',
          severity: currentlySuspended ? 'success' : 'warning',
          timestamp: nowTimeStr(),
        },
        ...prev,
      ]);
    },
    [agents, zones],
  );

  const publishAgentToSpace = useCallback(
    (zoneId: string, agentId: string) => {
      const targetZone = zones.find((z) => z.id === zoneId);
      const targetAgent = agents.find((a) => a.id === agentId);
      if (!targetZone || !targetAgent) return;
      setAgents((prev) =>
        prev.map((a) =>
          a.id === agentId
            ? {
                ...a,
                isListedInMarket: true,
                listedZoneIds: Array.from(new Set([...a.listedZoneIds, zoneId])),
              }
            : a,
        ),
      );
      setZones((prev) =>
        prev.map((z) =>
          z.id === zoneId
            ? {
                ...z,
                suspendedAgentIds: (z.suspendedAgentIds || []).filter((id) => id !== agentId),
              }
            : z,
        ),
      );
      setAuditLogs((prev) => [
        {
          id: `aud_zagent_pub_${Date.now()}`,
          category: 'general',
          title: `已发布专业 Agent 至「${targetZone.name}」：${targetAgent.handle}`,
          detail: '已在空间服务市场上线，空间成员可直接咨询与雇佣。',
          severity: 'success',
          timestamp: nowTimeStr(),
        },
        ...prev,
      ]);
    },
    [agents, zones],
  );

  const removeAgentFromSpace = useCallback(
    (zoneId: string, agentId: string) => {
      const targetZone = zones.find((z) => z.id === zoneId);
      const targetAgent = agents.find((a) => a.id === agentId);
      if (!targetZone || !targetAgent) return;
      setAgents((prev) =>
        prev.map((a) =>
          a.id === agentId
            ? { ...a, listedZoneIds: a.listedZoneIds.filter((id) => id !== zoneId) }
            : a,
        ),
      );
      setZones((prev) =>
        prev.map((z) =>
          z.id === zoneId
            ? {
                ...z,
                suspendedAgentIds: (z.suspendedAgentIds || []).filter((id) => id !== agentId),
              }
            : z,
        ),
      );
      setAuditLogs((prev) => [
        {
          id: `aud_zagent_rm_${Date.now()}`,
          category: 'general',
          title: `已从「${targetZone.name}」移除专业 Agent：${targetAgent.handle}`,
          detail: '该 Agent 已取消在该社区的服务市场发布。',
          severity: 'info',
          timestamp: nowTimeStr(),
        },
        ...prev,
      ]);
    },
    [agents, zones],
  );

  const createSession = useCallback(
    (
      name: string,
      goal: string,
      sourceZoneId?: string,
      boundNodeIds?: string[],
      storageVolumeId?: string,
      options?: { stayOnCurrentChannel?: boolean },
    ) => {
      const cleanedName = name.trim();
      if (!cleanedName) return '';
      const newId = `ses_${Date.now().toString().slice(-5)}`;
      const resolvedNodes =
        boundNodeIds && boundNodeIds.length > 0
          ? boundNodeIds
          : computeNodes.filter((n) => n.status === 'online').slice(0, 1).map((n) => n.id);
      const resolvedVolumeId = storageVolumeId || storageVolumes[0]?.id;
      const defaultInitialAgents = ['agent_pm_lin', 'agent_dev_us', 'agent_qa_peer'].filter((id) =>
        agents.some((a) => a.id === id),
      );
      const initialRosterIds =
        defaultInitialAgents.length > 0 ? defaultInitialAgents : agents.slice(0, 1).map((a) => a.id);
      const newWorkspace: ProjectWorkspace = {
        id: newId,
        name: cleanedName,
        goal: goal.trim() || '协同产品与研发专家 Agent 按工作卡片推进项目交付',
        role: 'leading',
        lifecycleStatus: 'active',
        boundNodeIds: resolvedNodes,
        storageVolumeId: resolvedVolumeId,
        sourceZoneId,
        workspaceTier: '加密持久化工作区 (50GB)',
        budgetCapUsd: 8000,
        spentUsd: 0,
        hiredAgentIds: initialRosterIds,
      };
      const ts = nowTimeStr();
      const initialNewAssignments: ProjectAgentAssignment[] = (
        [
          {
            agentId: 'agent_pm_lin',
            stages: ['planning'],
            roleNote: '任务规划与需求拆解',
            handoffMode: 'manual',
          },
          {
            agentId: 'agent_dev_us',
            stages: ['development'],
            roleNote: '主力方案落地与执行',
            handoffMode: 'auto',
          },
          {
            agentId: 'agent_qa_peer',
            stages: ['testing'],
            roleNote: '交付验证与回归把关',
            handoffMode: 'manual',
          },
        ] as ProjectAgentAssignment[]
      ).filter((a) => agents.some((ag) => ag.id === a.agentId));

      setWorkspaces((prev) => [newWorkspace, ...prev]);
      setProjectAgentAssignments((prev) => ({
        ...prev,
        [newId]: initialNewAssignments,
      }));
      setProjectPipelines((prev) => ({
        ...prev,
        [newId]: syncSlotsFromAssignments(initialNewAssignments),
      }));
      setProjectTaskTypes((prev) => ({
        ...prev,
        [newId]: buildTaskTypesFromPack('engineering', initialNewAssignments),
      }));
      if (resolvedVolumeId) {
        setStorageVolumes((prev) =>
          prev.map((v) =>
            v.id === resolvedVolumeId
              ? { ...v, boundProjectIds: Array.from(new Set([...v.boundProjectIds, newId])) }
              : v,
          ),
        );
      }
      setActiveSessionId(newId);
      if (!options?.stayOnCurrentChannel) {
        setPreferredConversationMode('chat');
        setActiveChatChannel({ type: 'group', projectId: newId });
      }
      setAllMessages((prev) => [
        ...prev,
        {
          id: `msg_init_${Date.now()}`,
          sessionId: newId,
          senderType: 'butler',
          senderId: 'butler',
          senderName: 'Nexa 助理',
          senderHandle: '@Nexa',
          content: `已创建项目群「${newWorkspace.name}」，已关联 Agent 节点与持久化存储，默认编排计划/执行/验证 3 位基础专家。你可以在「任务编排」中调整专家与卡片模板。`,
          timestamp: ts,
        },
      ]);
      setAuditLogs((prev) => [
        {
          id: `aud_${Date.now()}`,
          category: 'audit',
          title: `新建主管项目「${newWorkspace.name}」`,
          detail: `已挂载 Agent 算力节点与共享存储卷，项目总预算设定为 ${formatUsd(newWorkspace.budgetCapUsd)}，初始已用 $0。`,
          severity: 'success',
          timestamp: ts,
        },
        ...prev,
      ]);
      return newId;
    },
    [agents, computeNodes, storageVolumes],
  );

  const publishZoneProject = useCallback(
    (input: {
      zoneId: string;
      title: string;
      summary: string;
      budgetUsd: number;
      durationDays: number;
      requiredRoles: string[];
    }) => {
      const cleanedTitle = input.title.trim();
      if (!cleanedTitle) return '';
      const zoneName = zones.find((z) => z.id === input.zoneId)?.name || 'Agent 社区';
      const ts = nowTimeStr();
      const newWorkspaceId = `ses_${Date.now().toString().slice(-5)}`;
      const newOppId = `zproj_${Date.now().toString().slice(-5)}`;
      const resolvedNodes = computeNodes
        .filter((n) => n.status === 'online')
        .slice(0, 1)
        .map((n) => n.id);
      const resolvedVolumeId = storageVolumes[0]?.id;
      const defaultRoster = ['agent_pm_lin', 'agent_dev_us', 'agent_qa_peer'].filter((id) =>
        agents.some((a) => a.id === id),
      );
      const initialAssignments: ProjectAgentAssignment[] = (
        [
          {
            agentId: 'agent_pm_lin',
            stages: ['planning'],
            roleNote: '项目范围拆解与需求规划',
            handoffMode: 'manual',
          },
          {
            agentId: 'agent_dev_us',
            stages: ['development'],
            roleNote: '核心研发与方案实现',
            handoffMode: 'auto',
          },
          {
            agentId: 'agent_qa_peer',
            stages: ['testing'],
            roleNote: '交付回归与质量验证',
            handoffMode: 'manual',
          },
        ] as ProjectAgentAssignment[]
      ).filter((a) => agents.some((ag) => ag.id === a.agentId));

      const newWorkspace: ProjectWorkspace = {
        id: newWorkspaceId,
        name: cleanedTitle,
        goal: input.summary.trim() || `已发布至「${zoneName}」招募社区专家团队协同交付`,
        role: 'leading',
        lifecycleStatus: 'active',
        boundNodeIds: resolvedNodes,
        storageVolumeId: resolvedVolumeId,
        sourceZoneId: input.zoneId,
        workspaceTier: '加密持久化工作区 (50GB)',
        budgetCapUsd: Math.max(1000, Math.round(input.budgetUsd)),
        spentUsd: 0,
        hiredAgentIds: defaultRoster.length > 0 ? defaultRoster : ['agent_pm_lin'],
      };

      const newOpp: ZoneProjectOpportunity = {
        id: newOppId,
        zoneId: input.zoneId,
        title: cleanedTitle,
        publisher: account ? `${account.name}（我方发布）` : '我方项目团队',
        summary: input.summary.trim() || '面向该社区专家团队开放项目共创，欢迎直接私聊报价签约。',
        budgetUsd: Math.max(1000, Math.round(input.budgetUsd)),
        durationDays: Math.max(1, Math.round(input.durationDays || 7)),
        requiredRoles:
          input.requiredRoles.length > 0 ? input.requiredRoles : ['核心架构', '研发交付'],
        serviceModePref: 'any',
        direction: 'published_by_me',
        status: 'open',
        linkedWorkspaceId: newWorkspaceId,
        postedAt: '刚刚',
      };

      setWorkspaces((prev) => [newWorkspace, ...prev]);
      setProjectAgentAssignments((prev) => ({
        ...prev,
        [newWorkspaceId]: initialAssignments,
      }));
      setProjectPipelines((prev) => ({
        ...prev,
        [newWorkspaceId]: syncSlotsFromAssignments(initialAssignments),
      }));
      setProjectTaskTypes((prev) => ({
        ...prev,
        [newWorkspaceId]: buildTaskTypesFromPack('engineering', initialAssignments),
      }));
      if (resolvedVolumeId) {
        setStorageVolumes((prev) =>
          prev.map((v) =>
            v.id === resolvedVolumeId
              ? { ...v, boundProjectIds: Array.from(new Set([...v.boundProjectIds, newWorkspaceId])) }
              : v,
          ),
        );
      }
      setZoneProjects((prev) => [newOpp, ...prev]);
      setCommunityPosts((prev) => [
        {
          id: `post_proj_${Date.now().toString().slice(-5)}`,
          zoneId: input.zoneId,
          type: 'project',
          authorName: account ? account.name : '我（项目负责人）',
          authorHandle: account ? `@${account.name}` : '@指挥官',
          authorRole: '项目发起人',
          authorAccent: '#1d4ed8',
          authorCode: account ? account.avatarInitials : '我',
          title: `【项目撮合】${cleanedTitle}`,
          content:
            input.summary.trim() ||
            `已在「${zoneName}」发起项目需求，预算 ${formatUsd(newOpp.budgetUsd)} / 项目，期望 ${newOpp.durationDays} 天交付，欢迎社区专家或团队在评论区交流或直接承接！`,
          tags: ['项目撮合', ...newOpp.requiredRoles.slice(0, 2)],
          createdAt: '刚刚',
          likes: 1,
          likedByMe: true,
          comments: [],
          linkedProjectId: newOppId,
        },
        ...prev,
      ]);
      setAllMessages((prev) => [
        ...prev,
        {
          id: `msg_pub_${Date.now()}`,
          sessionId: newWorkspaceId,
          senderType: 'butler',
          senderId: 'butler',
          senderName: 'Nexa 助理',
          senderHandle: '@Nexa',
          content: `已将项目「${cleanedTitle}」发布至「${zoneName}」项目大厅（预算 ${formatUsd(newOpp.budgetUsd)} · 周期 ${newOpp.durationDays} 天），并已初始化项目看板、任务编排与默认工作流模板。`,
          timestamp: ts,
        },
      ]);
      setAuditLogs((prev) => [
        {
          id: `aud_pub_${Date.now()}`,
          category: 'order',
          title: `已向「${zoneName}」发布项目：${cleanedTitle}`,
          detail: `项目预算 ${formatUsd(newOpp.budgetUsd)}，已同步建立项目工作台与初始任务编排。`,
          severity: 'success',
          timestamp: ts,
        },
        ...prev,
      ]);

      return newWorkspaceId;
    },
    [account, agents, computeNodes, storageVolumes, zones],
  );

  const claimZoneProject = useCallback(
    (oppId: string) => {
      const opp = zoneProjects.find((p) => p.id === oppId);
      if (!opp || opp.status === 'claimed') return '';
      const zoneName = zones.find((z) => z.id === opp.zoneId)?.name || 'Agent 社区';
      const ts = nowTimeStr();
      const newWorkspaceId = `ses_part_${Date.now().toString().slice(-5)}`;
      const myPrivateAgents = agents.filter((a) => a.ownership === 'private').slice(0, 3);
      const rosterAgents =
        myPrivateAgents.length > 0
          ? myPrivateAgents
          : agents.filter((a) => a.id === 'agent_pm_lin').slice(0, 1);
      const rosterIds = rosterAgents.map((a) => a.id);
      const assignedAgent = rosterAgents[0] || agents[0];
      const resolvedNodes = computeNodes
        .filter((n) => n.status === 'online')
        .slice(0, 1)
        .map((n) => n.id);
      const resolvedVolumeId = storageVolumes[0]?.id;

      const initialAssignments: ProjectAgentAssignment[] = rosterAgents.map((ag, idx) => {
        const defaultStages = getDefaultStagesForAgentCategory(ag.category);
        // Ensure at least the first agent covers planning so kickoff works cleanly
        const stages: ActiveWorkflowStage[] =
          idx === 0 && !defaultStages.includes('planning')
            ? ['planning', ...defaultStages]
            : defaultStages;
        return {
          agentId: ag.id,
          stages,
          roleNote: ag.title,
          handoffMode: stages.includes('development') ? 'auto' : 'manual',
        };
      });

      const newWorkspace: ProjectWorkspace = {
        id: newWorkspaceId,
        name: opp.title,
        goal: `承接「${zoneName}」社区共创项目：${opp.summary}`,
        role: 'participating',
        lifecycleStatus: 'active',
        boundNodeIds: resolvedNodes,
        storageVolumeId: resolvedVolumeId,
        sourceZoneId: opp.zoneId,
        workspaceTier: '加密持久化工作区 (50GB)',
        budgetCapUsd: opp.budgetUsd,
        spentUsd: 0,
        hiredAgentIds: rosterIds.length > 0 ? rosterIds : ['agent_pm_lin'],
      };

      const kickoffTask: WorkflowTask = {
        id: `tsk_${Date.now().toString().slice(-4)}`,
        sessionId: newWorkspaceId,
        featureModule: `${zoneName} · 承接交付模块`,
        workType: 'development',
        title: `承接交付：${opp.title}`,
        description: opp.summary,
        assigneeId: assignedAgent?.id || 'butler',
        assigneeHandle: assignedAgent?.handle || '@Nexa',
        status: 'pending',
        priority: '高',
        createdAt: ts,
        updatedAt: ts,
      };

      setWorkspaces((prev) => [newWorkspace, ...prev]);
      setProjectAgentAssignments((prev) => ({
        ...prev,
        [newWorkspaceId]: initialAssignments,
      }));
      setProjectPipelines((prev) => ({
        ...prev,
        [newWorkspaceId]: syncSlotsFromAssignments(initialAssignments),
      }));
      setProjectTaskTypes((prev) => ({
        ...prev,
        [newWorkspaceId]: buildTaskTypesFromPack('engineering', initialAssignments),
      }));
      if (resolvedVolumeId) {
        setStorageVolumes((prev) =>
          prev.map((v) =>
            v.id === resolvedVolumeId
              ? { ...v, boundProjectIds: Array.from(new Set([...v.boundProjectIds, newWorkspaceId])) }
              : v,
          ),
        );
      }
      setZoneProjects((prev) =>
        prev.map((p) =>
          p.id === oppId ? { ...p, status: 'claimed', linkedWorkspaceId: newWorkspaceId } : p,
        ),
      );
      setAllTasks((prev) => [kickoffTask, ...prev]);
      setAllMessages((prev) => [
        ...prev,
        {
          id: `msg_claim_${Date.now()}`,
          sessionId: newWorkspaceId,
          senderType: 'system',
          senderId: 'system',
          senderName: '系统协同同步',
          senderHandle: '系统通知',
          content: `已承接「${zoneName}」社区共创项目「${opp.title}」（合同预算 ${formatUsd(opp.budgetUsd)}），我方 Agent 团队已完成任务编排进驻并立项首张工作卡片。`,
          timestamp: ts,
          linkedTaskIds: [kickoffTask.id],
        },
      ]);
      setAuditLogs((prev) => [
        {
          id: `aud_claim_${Date.now()}`,
          category: 'order',
          title: `已承接「${zoneName}」项目：${opp.title}`,
          detail: `已归入「项目工作台 → 项目概要（我参与）」，首张交付卡片与任务编排已同步就绪。`,
          severity: 'success',
          timestamp: ts,
        },
        ...prev,
      ]);

      return newWorkspaceId;
    },
    [agents, computeNodes, storageVolumes, zoneProjects, zones],
  );

  const createCommunityPost = useCallback(
    (input: {
      zoneId: string;
      type: Exclude<CommunityPostType, 'project'>;
      title: string;
      content: string;
      tags?: string[];
      pinned?: boolean;
      pinnedBy?: string;
      linkedEventId?: string;
      linkedAgentId?: string;
      linkedSkillId?: string;
    }) => {
      const cleanedContent = input.content.trim();
      const cleanedTitle = input.title.trim() || cleanedContent.slice(0, 32);
      if (!cleanedContent) return;
      const defaultTagMap: Record<Exclude<CommunityPostType, 'project'>, string> = {
        discussion: '分享讨论',
        event: '主题活动',
        skill_share: '发布 Skill',
        agn_recommend: '发布专家 Agent',
        announcement: '社区公告',
      };

      // If publishing/showcasing an Agent in this community, automatically ensure it is listed in the community's Service Market
      if (input.linkedAgentId) {
        setAgents((prev) =>
          prev.map((ag) => {
            if (ag.id !== input.linkedAgentId) return ag;
            const listedZoneIds = ag.listedZoneIds.includes(input.zoneId)
              ? ag.listedZoneIds
              : [...ag.listedZoneIds, input.zoneId];
            return {
              ...ag,
              isListedInMarket: true,
              listedZoneIds,
            };
          }),
        );
      }

      const newPost: CommunityPost = {
        id: `post_${Date.now().toString().slice(-6)}`,
        zoneId: input.zoneId,
        type: input.type,
        authorName: account ? account.name : '林致远（我）',
        authorHandle: account ? `@${account.name}` : '@zhiyuan_opc',
        authorRole: input.type === 'announcement' ? '社区主理' : 'OPC 成员',
        authorAccent: '#0f172a',
        authorCode: account ? account.avatarInitials : '致远',
        title: cleanedTitle,
        content: cleanedContent,
        tags:
          input.tags && input.tags.length > 0
            ? input.tags
            : [defaultTagMap[input.type]],
        createdAt: '刚刚',
        likes: 0,
        likedByMe: false,
        pinned: Boolean(input.pinned),
        pinnedBy: input.pinned ? input.pinnedBy || (account ? account.name : '林致远（我）') : undefined,
        linkedEventId: input.linkedEventId,
        linkedAgentId: input.linkedAgentId,
        linkedSkillId: input.linkedSkillId,
        comments: [],
      };
      setCommunityPosts((prev) => [newPost, ...prev]);
    },
    [account],
  );

  const publishCommunityEvent = useCallback(
    (input: PublishCommunityEventInput) => {
      const cleanedTitle = input.title.trim();
      if (!cleanedTitle) return '';
      const id = `ev_${Date.now().toString().slice(-6)}`;
      const hostName = account ? account.name : '林致远（我）';
      const hostCode = account ? account.avatarInitials : '致远';
      const priceCny = input.isFree ? 0 : Math.max(1, Math.round(input.priceCny));
      const capacity = Math.max(5, Math.min(2000, Math.round(input.capacity || 30)));
      const formatLabel =
        input.format === 'offline_meetup'
          ? '线下交流'
          : input.format === 'online_live'
            ? '线上直播分享'
            : '实战培训';

      const newEvent: CommunityEvent = {
        id,
        zoneId: input.zoneId,
        title: cleanedTitle,
        summary: input.summary.trim() || `${formatLabel}主题活动，欢迎社区成员报名参加并深度交流。`,
        format: input.format,
        hostName,
        hostRole: '社区主理 · 活动发起人',
        hostAccent: '#0284c7',
        hostCode,
        startTimeLabel: input.startTimeLabel.trim() || '近期开场（具体时间报名后通知）',
        location:
          input.location.trim() ||
          (input.format === 'online_live' ? 'AGN 社区直播间' : '线下活动场地待定'),
        isFree: priceCny <= 0,
        priceCny,
        capacity,
        registeredCount: 1,
        registeredByMe: true,
        registrationCode: `AGN-EV-${Date.now().toString().slice(-4)}`,
        tags:
          input.tags && input.tags.length > 0
            ? input.tags
            : ['主题活动', formatLabel, priceCny <= 0 ? '免费活动' : '付费活动'],
        agenda: (input.agenda || []).map((s) => s.trim()).filter(Boolean),
        createdAt: '刚刚',
      };

      setCommunityEvents((prev) => [newEvent, ...prev]);
      createCommunityPost({
        zoneId: input.zoneId,
        type: 'event',
        title: `【${formatLabel}】${cleanedTitle}${priceCny <= 0 ? '（免费报名）' : `（¥${priceCny}/人）`}`,
        content:
          `${newEvent.summary}\n\n时间：${newEvent.startTimeLabel} · 地点/方式：${newEvent.location}（限 ${capacity} 席）`,
        tags: ['主题活动', formatLabel],
        linkedEventId: id,
      });
      setAuditLogs((prev) => [
        {
          id: `aud_ev_pub_${Date.now()}`,
          category: 'general',
          title: `已发布社区主题活动：${cleanedTitle.slice(0, 26)}`,
          detail: `${formatLabel} · ${priceCny <= 0 ? '免费' : `收费 ¥${priceCny}/人`} · 限 ${capacity} 人`,
          severity: 'info',
          timestamp: nowTimeStr(),
        },
        ...prev,
      ]);
      return id;
    },
    [account, createCommunityPost],
  );

  const toggleRegisterCommunityEvent = useCallback((eventId: string, note?: string) => {
    const target = communityEvents.find((ev) => ev.id === eventId);
    if (!target) return;

    const nextRegistered = !target.registeredByMe;
    if (nextRegistered && target.registeredCount >= target.capacity) {
      return;
    }

    const ticketCode =
      target.registrationCode || `AGN-EV-${Math.floor(1000 + Math.random() * 9000)}`;

    setCommunityEvents((prev) =>
      prev.map((ev) => {
        if (ev.id !== eventId) return ev;
        return {
          ...ev,
          registeredByMe: nextRegistered,
          registeredCount: Math.max(
            0,
            Math.min(ev.capacity, ev.registeredCount + (nextRegistered ? 1 : -1)),
          ),
          registrationCode: nextRegistered ? ticketCode : undefined,
          registrationNote: nextRegistered ? note || ev.registrationNote : undefined,
        };
      }),
    );

    setAuditLogs((prev) => [
      {
        id: `aud_ev_reg_${Date.now()}`,
        category: 'general',
        title: nextRegistered
          ? `已报名主题活动：${target.title.slice(0, 24)}`
          : `已取消活动报名：${target.title.slice(0, 24)}`,
        detail: nextRegistered
          ? `${target.isFree || target.priceCny <= 0 ? '免费席位' : `已支付报名费 ¥${target.priceCny}`} · 入场凭证 ${ticketCode}`
          : '已释放该活动席位。',
        severity: 'info',
        timestamp: nowTimeStr(),
      },
      ...prev,
    ]);
  }, [communityEvents]);

  const publishCommunitySkill = useCallback(
    (input: {
      zoneId: string;
      name: string;
      summary: string;
      kind: SkillKind;
      category: AgentCategory;
      priceUsd: number;
      postContent?: string;
    }) => {
      const cleanedName = input.name.trim();
      const cleanedSummary = input.summary.trim();
      if (!cleanedName) return '';
      const id = `skill_${Date.now().toString().slice(-6)}`;
      const slugBase = cleanedName
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 24) || 'custom-skill';
      const prefix = input.kind === 'mcp' ? 'mcp' : input.kind === 'workflow' ? 'workflow' : 'skill';
      const slug = `${prefix}/${slugBase}`;
      const author = account ? account.name : '林致远（我）';
      const price = Math.max(0, Math.round(input.priceUsd));

      const newSkill: MarketSkill = {
        id,
        slug,
        name: cleanedName,
        summary: cleanedSummary || '社区成员发布的标准化能力包，可直接挂载至 Agent 节点复用。',
        category: input.category,
        kind: input.kind,
        origin: 'custom',
        isPrivate: false,
        compatibleRuntimes: ['Claude Code', 'Codex', 'Gemini CLI', 'Qoder'],
        authorName: author,
        version: 'v1.0.0',
        installs: 1,
        rating: 5.0,
        ratingTier: 'A+',
        priceUsd: price,
        license: price === 0 ? '免费开源' : '社区共享',
        zoneIds: [input.zoneId],
        installCommand:
          input.kind === 'mcp' ? `anx mcp install ${slug}` : `anx skill add ${slug}`,
        highlights: [
          cleanedSummary || '开箱即用的标准化 Prompt / MCP 能力封装',
          '由团队自建并分发至 Agent 社区，同时保留在 AGN空间资产库供自建 Agent 加载',
        ],
        readmeSnippet: `---\nname: ${slugBase}\nkind: ${input.kind}\n---\n${cleanedSummary || cleanedName}`,
      };

      setMarketSkills((prev) => [newSkill, ...prev]);
      setPurchasedSkillIds((prev) => (prev.includes(id) ? prev : [id, ...prev]));
      createCommunityPost({
        zoneId: input.zoneId,
        type: 'skill_share',
        title: `【发布 Skill】${cleanedName}${price === 0 ? '（免费开源）' : `（$${price}）`}已同步上架服务市场`,
        content:
          (input.postContent || cleanedSummary || cleanedName).trim() +
          `\n\n安装命令：${newSkill.installCommand}`,
        tags: ['发布 Skill', input.kind === 'mcp' ? 'MCP' : input.kind === 'workflow' ? '工作流' : 'Skill'],
        linkedSkillId: id,
      });
      return id;
    },
    [account, createCommunityPost],
  );

  const togglePinPost = useCallback(
    (postId: string, principalName?: string) => {
      setCommunityPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          const nextPinned = !p.pinned;
          return {
            ...p,
            pinned: nextPinned,
            pinnedBy: nextPinned
              ? principalName || (account ? account.name : '林致远（我）')
              : undefined,
          };
        }),
      );
    },
    [account],
  );

  const deleteCommunityPost = useCallback(
    (postId: string) => {
      const target = communityPosts.find((p) => p.id === postId);
      setCommunityPosts((prev) => prev.filter((p) => p.id !== postId));
      if (target) {
        setAuditLogs((prev) => [
          {
            id: `aud_post_del_${Date.now()}`,
            category: 'general',
            title: `主理人已移除社区动态：${target.title.slice(0, 24)}`,
            detail: '内容已从该私有社区动态流中删除。',
            severity: 'info',
            timestamp: nowTimeStr(),
          },
          ...prev,
        ]);
      }
    },
    [communityPosts],
  );

  const toggleLikePost = useCallback((postId: string) => {
    setCommunityPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const nextLiked = !p.likedByMe;
        return {
          ...p,
          likedByMe: nextLiked,
          likes: Math.max(0, p.likes + (nextLiked ? 1 : -1)),
        };
      }),
    );
  }, []);

  const addPostComment = useCallback(
    (postId: string, content: string) => {
      const cleaned = content.trim();
      if (!cleaned) return;
      const newComment = {
        id: `cmt_${Date.now().toString().slice(-6)}`,
        authorName: account ? account.name : '我',
        authorHandle: account ? `@${account.name}` : '@指挥官',
        authorRole: '社区成员',
        content: cleaned,
        timestamp: '刚刚',
      };
      setCommunityPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, comments: [...p.comments, newComment] } : p,
        ),
      );
    },
    [account],
  );

  const createWorkCard = useCallback(
    (input: CreateWorkCardInput) => {
      const targetSessionId = input.sessionId || activeWorkspace.id;
      const targetProj = workspaces.find((w) => w.id === targetSessionId);
      if (isWorkspaceReadOnly(targetProj)) return undefined;
      const assignee = agents.find((a) => a.id === input.assigneeId);
      const ts = nowTimeStr();
      const newTask: WorkflowTask = {
        id: `tsk_${Date.now().toString().slice(-4)}`,
        sessionId: targetSessionId,
        featureModule: input.featureModule.trim() || '核心功能模块',
        workType: input.workType,
        title: input.title.trim(),
        description: input.description.trim() || '按项目目标执行并输出可验收产物。',
        assigneeId: assignee?.id || 'butler',
        assigneeHandle: assignee?.handle || '@Nexa',
        status: 'pending',
        priority: input.priority,
        createdAt: ts,
        updatedAt: ts,
      };

      setAllTasks((prev) => [newTask, ...prev]);
      setAllMessages((prev) => [
        ...prev,
        {
          id: `msg_card_${Date.now()}`,
          sessionId: targetSessionId,
          senderType: 'butler',
          senderId: 'butler',
          senderName: 'Nexa 助理',
          senderHandle: '@Nexa',
          content: `已在项目群创建工作卡片「${newTask.title}」（所属模块：${newTask.featureModule}），指派给 ${newTask.assigneeHandle}，已自动同步至「项目看板」与左侧「Agent 任务」。`,
          timestamp: ts,
          linkedTaskIds: [newTask.id],
        },
      ]);
      return newTask;
    },
    [activeWorkspace.id, agents, workspaces],
  );

  const createAndOpenTaskSession = useCallback(
    (input: CreateWorkCardInput) => {
      const targetSessionId = input.sessionId || activeWorkspace.id;
      const targetProj = workspaces.find((w) => w.id === targetSessionId);
      if (isWorkspaceReadOnly(targetProj)) return undefined;
      const assignee = agents.find((a) => a.id === input.assigneeId);
      const ts = nowTimeStr();
      const newTask: WorkflowTask = {
        id: `tsk_${Date.now().toString().slice(-4)}`,
        sessionId: targetSessionId,
        featureModule: input.featureModule.trim() || '核心功能模块',
        workType: input.workType,
        title: input.title.trim(),
        description: input.description.trim() || '按项目目标执行并输出可验收产物。',
        assigneeId: assignee?.id || 'butler',
        assigneeHandle: assignee?.handle || '@Nexa',
        status: 'in_progress',
        priority: input.priority,
        createdAt: ts,
        updatedAt: ts,
      };

      setAllTasks((prev) => [newTask, ...prev]);
      setTaskSessions((prev) => ({
        ...prev,
        [newTask.id]: [
          {
            id: `tsm_init_${Date.now()}`,
            taskId: newTask.id,
            sender: 'agent',
            content: `已挂载至目标项目工作区并开启专属任务 Session（#${newTask.id} · ${newTask.title}）。我是 ${formatAgentDisplayName(assignee?.handle || newTask.assigneeHandle, assignee?.runtimeAgent, assignee?.defaultModel)}，本会话将专注于该任务的多轮拆解、执行与产物迭代，关键里程碑会自动以任务卡片同步至所属项目群。请补充你的具体要求或直接点击快捷操作启动。`,
            timestamp: ts,
            executionSteps: [
              `绑定项目上下文与任务卡 #${newTask.id}`,
              `初始化 ${assignee?.runtimeAgent || 'Agent'} 独立执行沙箱`,
            ],
            suggestedActions: [
              '先输出执行计划与关键边界确认项',
              '按任务描述直接开始编码/产出初稿',
            ],
            awaitingConfirmation: true,
          },
        ],
      }));

      setAllMessages((prev) => [
        ...prev,
        {
          id: `msg_card_${Date.now()}`,
          sessionId: targetSessionId,
          senderType: 'butler',
          senderId: 'butler',
          senderName: 'Nexa 助理',
          senderHandle: '@Nexa',
          content: `已新建任务卡片「${newTask.title}」并指派给 ${newTask.assigneeHandle} 开启专属任务对话，可点击下方任务卡片直接进入协作。`,
          timestamp: ts,
          linkedTaskIds: [newTask.id],
        },
      ]);

      setPreferredConversationMode('task');
      setActiveSessionId(targetSessionId);
      setActiveChatChannel({
        type: 'task_session',
        taskId: newTask.id,
        projectId: targetSessionId,
      });
      setActiveView('chat');
      setTaskSessionError(null);
      return newTask;
    },
    [activeWorkspace.id, agents, workspaces],
  );

  const launchNewTaskSessionFromPrompt = useCallback(
    async (input: {
      sessionId: string;
      assigneeId: string;
      workType: WorkCardType;
      prompt: string;
      featureModule?: string;
      syncToGroup?: boolean;
    }) => {
      const cleanedPrompt = input.prompt.trim();
      if (!cleanedPrompt) return;

      const targetSessionId = input.sessionId || activeWorkspace.id;
      const targetWorkspace =
        workspaces.find((w) => w.id === targetSessionId) || activeWorkspace;
      if (isWorkspaceReadOnly(targetWorkspace)) {
        setTaskSessionError('该项目已完成或归档，请先在项目概要中重新激活后再派发新任务。');
        return;
      }
      const assignee = agents.find((a) => a.id === input.assigneeId) || agents[0];
      if (assignee && !isAgentAuthorizedForProject(targetWorkspace, assignee, agentLeases)) {
        setTaskSessionError(
          `${assignee.handle} 尚未在本项目签约或租用，请先在「AGN 社区 → 服务市场」完成签约或租用。`,
        );
        return;
      }
      const ts = nowTimeStr();

      // Derive clean concise task title from the first line of the prompt
      const firstLine = cleanedPrompt.split(/\r?\n/)[0].trim();
      const derivedTitle =
        firstLine.length > 28 ? `${firstLine.slice(0, 28)}…` : firstLine;

      const newTask: WorkflowTask = {
        id: `tsk_${Date.now().toString().slice(-4)}`,
        sessionId: targetSessionId,
        featureModule: input.featureModule?.trim() || '快速任务',
        workType: input.workType,
        title: derivedTitle,
        description: cleanedPrompt,
        assigneeId: assignee?.id || 'butler',
        assigneeHandle: assignee?.handle || '@Nexa',
        status: 'in_progress',
        priority: '高',
        createdAt: ts,
        updatedAt: ts,
      };

      // Sync authorized private/leased agent into workspace roster & orchestration if not yet linked
      if (assignee && !targetWorkspace.hiredAgentIds.includes(assignee.id)) {
        setWorkspaces((prev) =>
          prev.map((w) =>
            w.id === targetSessionId
              ? { ...w, hiredAgentIds: [...w.hiredAgentIds, assignee.id] }
              : w,
          ),
        );
        const existingAssignments = projectAgentAssignments[targetSessionId] || [];
        if (!existingAssignments.some((a) => a.agentId === assignee.id)) {
          const stages = getDefaultStagesForAgentCategory(assignee.category);
          const nextAssignments: ProjectAgentAssignment[] = [
            ...existingAssignments,
            {
              agentId: assignee.id,
              stages,
              roleNote: assignee.title,
              handoffMode: stages.includes('development') ? 'auto' : 'manual',
            },
          ];
          setProjectAgentAssignments((prev) => ({ ...prev, [targetSessionId]: nextAssignments }));
          setProjectPipelines((prev) => ({
            ...prev,
            [targetSessionId]: syncSlotsFromAssignments(nextAssignments, prev[targetSessionId]),
          }));
        }
      }

      const initialUserTurn: TaskSessionMessage = {
        id: `tsm_u_${Date.now()}`,
        taskId: newTask.id,
        sender: 'employer',
        content: cleanedPrompt,
        timestamp: ts,
      };

      setAllTasks((prev) => [newTask, ...prev]);
      setTaskSessions((prev) => ({
        ...prev,
        [newTask.id]: [initialUserTurn],
      }));

      if (input.syncToGroup !== false) {
        setAllMessages((prev) => [
          ...prev,
          {
            id: `msg_card_${Date.now()}`,
            sessionId: targetSessionId,
            senderType: 'butler',
            senderId: 'butler',
            senderName: 'Nexa 助理',
            senderHandle: '@Nexa',
            content: `已通过快速启动台新建任务「${newTask.title}」并指派给 ${newTask.assigneeHandle} 开启专属任务 Session，关键里程碑将同步回本项目群。`,
            timestamp: ts,
            linkedTaskIds: [newTask.id],
          },
        ]);
      }

      setPreferredConversationMode('task');
      setLastTaskSessionId(newTask.id);
      setActiveSessionId(targetSessionId);
      setActiveChatChannel({
        type: 'task_session',
        taskId: newTask.id,
        projectId: targetSessionId,
      });
      setActiveView('chat');
      setTaskSessionError(null);
      setTaskSessionBusyId(newTask.id);

      try {
        const result = await sendTaskSessionMessage({
          task: newTask,
          agent: assignee,
          workspace: targetWorkspace,
          history: [initialUserTurn],
          message: cleanedPrompt,
        });

        const replyTs = nowTimeStr();
        const shouldSyncMilestone = Boolean(result.readyForReview);
        const agentTurn: TaskSessionMessage = {
          id: `tsm_a_${Date.now()}`,
          taskId: newTask.id,
          sender: 'agent',
          content: result.reply,
          timestamp: replyTs,
          executionSteps: (result.executionSteps || []).filter(Boolean),
          artifactPath: result.artifactPath?.trim() || undefined,
          artifactSnippet: result.artifactSnippet?.trim() || undefined,
          suggestedActions: (result.suggestedActions || []).filter(Boolean),
          awaitingConfirmation: Boolean(result.awaitingConfirmation),
          milestoneSynced: shouldSyncMilestone,
        };

        setTaskSessions((prev) => ({
          ...prev,
          [newTask.id]: [...(prev[newTask.id] || [initialUserTurn]), agentTurn],
        }));

        if (shouldSyncMilestone) {
          const finalArtifact =
            result.artifactPath?.trim() || `artifacts/${newTask.id}_deliverable.md`;
          const assignments = projectAgentAssignments[targetSessionId] || [];
          const completingAssignment = assignments.find((a) => a.agentId === newTask.assigneeId);
          const isAutoHandoff = completingAssignment?.handoffMode === 'auto';
          const verifierAgent = isAutoHandoff
            ? pickLoadBalancedStageAgent(
                targetSessionId,
                'testing',
                newTask.assigneeId,
                assignments,
                agents,
                allTasks,
              )
            : undefined;
          const nextAssigneeId = verifierAgent ? verifierAgent.id : newTask.assigneeId;
          const nextAssigneeHandle = verifierAgent ? verifierAgent.handle : newTask.assigneeHandle;

          const updatedTask: WorkflowTask = {
            ...newTask,
            status: 'review',
            assigneeId: nextAssigneeId,
            assigneeHandle: nextAssigneeHandle,
            deliverableSummary: result.reply,
            deliverableArtifact: finalArtifact,
            updatedAt: replyTs,
          };

          setAllTasks((prev) => prev.map((t) => (t.id === newTask.id ? updatedTask : t)));
          upsertTaskDeliverableArtifact(updatedTask, finalArtifact, result.reply, replyTs);
        } else if (result.artifactPath?.trim()) {
          const updatedTask: WorkflowTask = {
            ...newTask,
            deliverableArtifact: result.artifactPath.trim(),
            updatedAt: replyTs,
          };
          setAllTasks((prev) => prev.map((t) => (t.id === newTask.id ? updatedTask : t)));
          upsertTaskDeliverableArtifact(updatedTask, result.artifactPath.trim(), result.reply, replyTs);
        }
      } catch (err) {
        setTaskSessionError(
          err instanceof Error ? err.message : '任务 Session 启动失败，请稍后重试。',
        );
      } finally {
        setTaskSessionBusyId(null);
      }
    },
    [
      activeWorkspace,
      agentLeases,
      agents,
      allTasks,
      projectAgentAssignments,
      upsertTaskDeliverableArtifact,
      workspaces,
    ],
  );

  const hireAgentIntoProject = useCallback(
    (
      agentId: string,
      projectId?: string,
      initialCard?: { title: string; scope: string; contractedPriceUsd?: number },
    ) => {
      const targetProjectId = projectId || activeWorkspace.id;
      const targetProject = workspaces.find((w) => w.id === targetProjectId) || activeWorkspace;
      const target = agents.find((a) => a.id === agentId);
      if (!target || isWorkspaceReadOnly(targetProject)) return;

      const contractedFee =
        target.ownership === 'private'
          ? 0
          : Math.round(initialCard?.contractedPriceUsd || target.projectPriceUsd);
      const alreadyInProject = targetProject.hiredAgentIds.includes(agentId);
      const ts = nowTimeStr();

      if (!alreadyInProject) {
        setWorkspaces((prev) =>
          prev.map((w) =>
            w.id === targetProject.id
              ? {
                  ...w,
                  hiredAgentIds: [...w.hiredAgentIds, agentId],
                  spentUsd: w.spentUsd + contractedFee,
                }
              : w,
          ),
        );

        if (contractedFee > 0) {
          const newSettlementId = `stl_${Date.now().toString().slice(-4)}`;
          setSettlements((prev) => [
            {
              id: newSettlementId,
              projectId: targetProject.id,
              projectName: targetProject.name,
              agentHandle: target.handle,
              milestoneLabel: `项目签约托管（${target.performance.capabilityTier} · ${target.serviceMode === 'human-agent' ? '人+Agent 协同' : '纯 Agent 租用'}）`,
              amountUsd: contractedFee,
              status: 'unsettled',
              createdAt: ts,
            },
            ...prev,
          ]);
        }
      }

      // Sync hired expert directly into Task Orchestration (single source of truth)
      const existingAssignments = projectAgentAssignments[targetProject.id] || [];
      if (!existingAssignments.some((a) => a.agentId === agentId)) {
        const stages = getDefaultStagesForAgentCategory(target.category);
        const nextAssignments: ProjectAgentAssignment[] = [
          ...existingAssignments,
          {
            agentId,
            stages,
            roleNote: initialCard?.scope?.trim() || target.title,
            handoffMode: stages.includes('development') ? 'auto' : 'manual',
          },
        ];
        setProjectAgentAssignments((prev) => ({
          ...prev,
          [targetProject.id]: nextAssignments,
        }));
        setProjectPipelines((prev) => ({
          ...prev,
          [targetProject.id]: syncSlotsFromAssignments(nextAssignments, prev[targetProject.id]),
        }));
      }

      let createdTaskId: string | undefined;

      if (initialCard && initialCard.title.trim()) {
        const workType: WorkCardType =
          target.category === 'product'
            ? 'planning'
            : target.category === 'qa'
              ? 'testing'
              : target.category === 'architecture'
                ? 'review'
                : 'development';
        const newTask: WorkflowTask = {
          id: `tsk_${Date.now().toString().slice(-4)}`,
          sessionId: targetProject.id,
          featureModule: '协商立项工作卡',
          workType,
          title: initialCard.title.trim(),
          description: initialCard.scope.trim() || '按项目签约确认的交付范围执行并提交验收。',
          assigneeId: target.id,
          assigneeHandle: target.handle,
          status: 'pending',
          priority: '高',
          createdAt: ts,
          updatedAt: ts,
        };
        createdTaskId = newTask.id;
        setAllTasks((prev) => [newTask, ...prev]);
      }

      setNegotiations((prev) =>
        prev.map((n) =>
          n.agentId === agentId
            ? { ...n, targetProjectId: targetProject.id, status: 'hired', updatedAt: ts }
            : n,
        ),
      );

      const sourceText = target.ownership === 'private' ? '私有节点' : '外部专家';
      const modeText = target.serviceMode === 'human-agent' ? '人+Agent 协同' : '纯 Agent 租用';
      const feeText = contractedFee > 0 ? `，项目签约价 ${formatUsd(contractedFee)}` : '（私有自用）';

      setAllMessages((prev) => [
        ...prev,
        {
          id: `msg_hire_${Date.now()}`,
          sessionId: targetProject.id,
          senderType: 'system',
          senderId: 'system',
          senderName: '系统协同同步',
          senderHandle: '系统通知',
          content: `已签约${sourceText} ${target.handle}（${modeText}${feeText}）加入项目群「${targetProject.name}」，并已同步至「任务编排」。`,
          timestamp: ts,
        },
        {
          id: `msg_greet_${Date.now() + 1}`,
          sessionId: targetProject.id,
          senderType: 'agent',
          senderId: target.id,
          senderName: target.name,
          senderHandle: target.handle,
          content: `已正式入群就位！我是 ${target.name}（${modeText}），加密工作区已同步挂载。${
            createdTaskId
              ? '咱们刚才确认的首项工作已经挂上去了，批准后我立即推进。'
              : `随时可以直接 ${target.handle} 沟通需求。`
          }`,
          timestamp: ts,
          linkedTaskIds: createdTaskId ? [createdTaskId] : undefined,
        },
      ]);

      setAuditLogs((prev) => [
        {
          id: `aud_hire_${Date.now()}`,
          category: 'order',
          title: `已签约 ${target.handle} 加入「${targetProject.name}」`,
          detail: `${modeText}${feeText}；已按最小权限授予加密工作区挂载凭证并同步至任务编排。`,
          severity: 'success',
          timestamp: ts,
        },
        ...prev,
      ]);

      setActiveSessionId(targetProject.id);
      setActiveChatChannel({ type: 'group', projectId: targetProject.id });
    },
    [activeWorkspace, agents, projectAgentAssignments, workspaces],
  );

  const hireAgent = useCallback(
    (agentId: string) => {
      hireAgentIntoProject(agentId, activeWorkspace.id);
    },
    [activeWorkspace.id, hireAgentIntoProject],
  );

  const releaseAgent = useCallback(
    (agentId: string, projectId?: string) => {
      const targetProjectId = projectId || activeWorkspace.id;
      const target = agents.find((a) => a.id === agentId);
      const proj = workspaces.find((w) => w.id === targetProjectId);
      if (!target || isWorkspaceReadOnly(proj)) return;
      const ts = nowTimeStr();

      const existingAssignments = projectAgentAssignments[targetProjectId] || [];
      const nextAssignments = existingAssignments.filter((a) => a.agentId !== agentId);

      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === targetProjectId
            ? { ...w, hiredAgentIds: w.hiredAgentIds.filter((id) => id !== agentId) }
            : w,
        ),
      );
      setProjectAgentAssignments((prev) => ({
        ...prev,
        [targetProjectId]: nextAssignments,
      }));
      setProjectPipelines((prev) => ({
        ...prev,
        [targetProjectId]: syncSlotsFromAssignments(nextAssignments, prev[targetProjectId]),
      }));
      setProjectTaskTypes((prev) => {
        const list = prev[targetProjectId];
        if (!list) return prev;
        return {
          ...prev,
          [targetProjectId]: list.map((tpl) => ({
            ...tpl,
            creatorAgentIds: (tpl.creatorAgentIds || []).filter((id) => id !== agentId),
          })),
        };
      });

      // Reassign unfinished tasks owned by the released agent so no ghost assignees remain on Kanban
      const affectedTasks = allTasks.filter(
        (t) => t.sessionId === targetProjectId && t.status !== 'done' && t.assigneeId === agentId,
      );
      if (affectedTasks.length > 0) {
        const fallbackAgent = nextAssignments
          .map((a) => agents.find((ag) => ag.id === a.agentId))
          .find((ag): ag is ExpertAgent => Boolean(ag));

        setAllTasks((prev) =>
          prev.map((t) => {
            if (t.sessionId !== targetProjectId || t.status === 'done' || t.assigneeId !== agentId) {
              return t;
            }
            const stage = mapStatusToActiveStage(t.status) || 'development';
            const replacement =
              pickLoadBalancedStageAgent(
                targetProjectId,
                stage,
                undefined,
                nextAssignments,
                agents,
                prev,
                agentId,
              ) || fallbackAgent;
            return {
              ...t,
              assigneeId: replacement ? replacement.id : 'butler',
              assigneeHandle: replacement ? replacement.handle : '@Nexa',
              updatedAt: ts,
            };
          }),
        );
      }

      setAllMessages((prev) => [
        ...prev,
        {
          id: `msg_rel_${Date.now()}`,
          sessionId: targetProjectId,
          senderType: 'system',
          senderId: 'system',
          senderName: '系统协同同步',
          senderHandle: '系统通知',
          content: `已将 ${target.handle} 移出该项目群与任务编排，权限已回收卸载${
            affectedTasks.length > 0
              ? `；名下 ${affectedTasks.length} 项未完成任务已自动转派给同阶段在岗专家`
              : ''
          }。`,
          timestamp: ts,
        },
      ]);

      setAuditLogs((prev) => [
        {
          id: `aud_rel_${Date.now()}`,
          category: 'audit',
          title: `权限自动回收：${target.handle}`,
          detail: `已从「${proj?.name || '项目'}」卸载技能包、同步移出任务编排${
            affectedTasks.length > 0 ? `并转派 ${affectedTasks.length} 项未完成任务` : ''
          }。`,
          severity: 'info',
          timestamp: ts,
        },
        ...prev,
      ]);
    },
    [activeWorkspace.id, agents, allTasks, projectAgentAssignments, workspaces],
  );

  const startOrOpenNegotiation = useCallback(
    (agentId: string, jumpToChat = true) => {
      const target = agents.find((a) => a.id === agentId);
      if (!target) return;

      setNegotiations((prev) => {
        if (prev.some((n) => n.agentId === agentId)) return prev;
        const ts = nowTimeStr();
        const isAlreadyHired = workspaces.some((w) => w.hiredAgentIds.includes(agentId));
        const newThread: NegotiationThread = {
          agentId,
          targetProjectId: activeWorkspace.id,
          status: isAlreadyHired ? 'hired' : 'negotiating',
          negotiatedPriceUsd: target.projectPriceUsd,
          scopeNote: `负责「${activeWorkspace.name}」项目的 ${target.title}`,
          firstWorkCardTitle: `${
            target.category === 'qa'
              ? '测试'
              : target.category === 'architecture'
                ? '审查'
                : target.category === 'product'
                  ? '规划'
                  : '开发'
          }：${target.skills[0] || '核心专项任务'}`,
          updatedAt: ts,
          messages: [],
        };
        return [newThread, ...prev];
      });

      setDmError(null);
      setActiveChatChannel({ type: 'dm', agentId });
      if (jumpToChat) {
        setActiveView('chat');
      }
    },
    [activeWorkspace.id, activeWorkspace.name, agents, workspaces],
  );

  const updateNegotiationTerms = useCallback(
    (
      agentId: string,
      patch: Partial<
        Pick<
          NegotiationThread,
          'targetProjectId' | 'negotiatedPriceUsd' | 'scopeNote' | 'firstWorkCardTitle'
        >
      >,
    ) => {
      setNegotiations((prev) =>
        prev.map((n) => (n.agentId === agentId ? { ...n, ...patch } : n)),
      );
    },
    [],
  );

  const sendDirectMessage = useCallback(
    async (agentId: string, text: string) => {
      const target = agents.find((a) => a.id === agentId);
      const cleaned = text.trim();
      if (!target || !cleaned) return;

      setDmError(null);
      const ts = nowTimeStr();
      const existingThread = negotiations.find((n) => n.agentId === agentId);
      const targetProjId = existingThread?.targetProjectId || activeWorkspace.id;
      const targetProject = workspaces.find((w) => w.id === targetProjId) || activeWorkspace;

      const userMsg: DirectMessage = {
        id: `dm_u_${Date.now()}`,
        sender: 'employer',
        content: cleaned,
        timestamp: ts,
      };

      const baseThread: NegotiationThread = existingThread || {
        agentId,
        targetProjectId: targetProject.id,
        status: 'negotiating',
        negotiatedPriceUsd: target.projectPriceUsd,
        scopeNote: `负责「${targetProject.name}」项目的 ${target.title}`,
        firstWorkCardTitle: `项目启动：${target.skills[0] || target.title}`,
        updatedAt: ts,
        messages: [],
      };

      const nextMessages = [...baseThread.messages, userMsg];

      setNegotiations((prev) => {
        const exists = prev.some((n) => n.agentId === agentId);
        if (exists) {
          return prev.map((n) =>
            n.agentId === agentId ? { ...n, messages: nextMessages, updatedAt: ts } : n,
          );
        }
        return [{ ...baseThread, messages: nextMessages }, ...prev];
      });

      setDmBusyAgentId(agentId);

      try {
        const res = await sendExpertDirectMessage({
          agent: target,
          workspace: targetProject,
          history: nextMessages,
          message: cleaned,
          currentTerms: {
            negotiatedPriceUsd: baseThread.negotiatedPriceUsd,
            scopeNote: baseThread.scopeNote,
          },
        });

        const replyTs = nowTimeStr();
        const quotedPrice =
          typeof res.quotedPriceUsd === 'number' && res.quotedPriceUsd >= 100
            ? Math.round(res.quotedPriceUsd)
            : baseThread.negotiatedPriceUsd;

        const replyMsg: DirectMessage = {
          id: `dm_a_${Date.now()}`,
          sender: 'agent',
          content: res.reply,
          timestamp: replyTs,
          quotedPriceUsd: quotedPrice,
        };

        setNegotiations((prev) =>
          prev.map((n) =>
            n.agentId === agentId
              ? {
                  ...n,
                  status: n.status === 'hired' ? 'hired' : 'quoted',
                  negotiatedPriceUsd: quotedPrice,
                  scopeNote: res.proposedScope || n.scopeNote,
                  firstWorkCardTitle: res.proposedWorkCardTitle || n.firstWorkCardTitle,
                  updatedAt: replyTs,
                  messages: [...n.messages, replyMsg],
                }
              : n,
          ),
        );
      } catch (err) {
        setDmError(err instanceof Error ? err.message : '外部专家私聊回复失败');
      } finally {
        setDmBusyAgentId(null);
      }
    },
    [activeWorkspace, agents, negotiations, workspaces],
  );

  const confirmHireFromNegotiation = useCallback(
    (agentId: string, createFirstCard = true) => {
      const thread = negotiations.find((n) => n.agentId === agentId);
      if (!thread) {
        hireAgentIntoProject(agentId, activeWorkspace.id);
        setActiveView('chat');
        return;
      }
      hireAgentIntoProject(
        agentId,
        thread.targetProjectId,
        createFirstCard
          ? {
              title: thread.firstWorkCardTitle,
              scope: thread.scopeNote,
              contractedPriceUsd: thread.negotiatedPriceUsd,
            }
          : { title: '', scope: '', contractedPriceUsd: thread.negotiatedPriceUsd },
      );
      setActiveView('chat');
    },
    [activeWorkspace.id, hireAgentIntoProject, negotiations],
  );

  const settleRecord = useCallback(
    (settlementId: string) => {
      const record = settlements.find((s) => s.id === settlementId);
      if (!record || record.status === 'settled') return;
      const ts = nowTimeStr();

      setSettlements((prev) =>
        prev.map((s) => (s.id === settlementId ? { ...s, status: 'settled' } : s)),
      );

      setAssistantMessages((prev) => [
        ...prev.map((m) =>
          m.cards
            ? {
                ...m,
                cards: m.cards.map((c) =>
                  c.actionTarget?.type === 'settle' &&
                  c.actionTarget.settlementId === settlementId
                    ? { ...c, resolved: true }
                    : c,
                ),
              }
            : m,
        ),
        {
          id: `asst_stl_${Date.now()}`,
          sender: 'assistant',
          category: 'settlement',
          content: `已完成项目结算核销：账单 ${record.id}（${record.projectName} · ${record.agentHandle}）项目签约款 ${formatUsd(record.amountUsd)} 已划转归档。`,
          timestamp: ts,
        },
      ]);

      setAuditLogs((prev) => [
        {
          id: `aud_stl_${Date.now()}`,
          category: 'settlement',
          title: `项目签约款已结算：${formatUsd(record.amountUsd)}`,
          detail: `${record.projectName} · ${record.agentHandle}（${record.milestoneLabel}）已完成放款。`,
          severity: 'success',
          timestamp: ts,
        },
        ...prev,
      ]);
    },
    [settlements],
  );

  const settleAllUnsettled = useCallback(() => {
    const pending = settlements.filter((s) => s.status === 'unsettled');
    if (pending.length === 0) return;
    const total = pending.reduce((sum, s) => sum + s.amountUsd, 0);
    const ts = nowTimeStr();

    setSettlements((prev) => prev.map((s) => ({ ...s, status: 'settled' })));
    setAssistantMessages((prev) => [
      ...prev.map((m) =>
        m.cards
          ? {
              ...m,
              cards: m.cards.map((c) =>
                c.actionTarget?.type === 'settle' ? { ...c, resolved: true } : c,
              ),
            }
          : m,
      ),
      {
        id: `asst_stl_all_${Date.now()}`,
        sender: 'assistant',
        category: 'settlement',
        content: `已批量完成 ${pending.length} 笔项目签约结算核销，合计金额 ${formatUsd(total)}，各项目托管账本已全部对齐结清。`,
        timestamp: ts,
      },
    ]);
    setAuditLogs((prev) => [
      {
        id: `aud_stl_all_${Date.now()}`,
        category: 'settlement',
        title: `批量项目结算完成（${pending.length} 笔 · ${formatUsd(total)}）`,
        detail: '所有到期项目里程碑签约费用已核销归档。',
        severity: 'success',
        timestamp: ts,
      },
      ...prev,
    ]);
  }, [settlements]);

  const resolveSpaceApplication = useCallback(
    (applicationId: string, decision: 'approved' | 'rejected') => {
      const app = spaceApplications.find((a) => a.id === applicationId);
      if (!app || app.status !== 'pending') return;
      if (!managedZoneIdSet.has(app.zoneId)) return;
      const ts = nowTimeStr();

      setSpaceApplications((prev) =>
        prev.map((a) => (a.id === applicationId ? { ...a, status: decision } : a)),
      );

      if (decision === 'approved') {
        const newMember: SpaceMember = {
          id: `mem_app_${Date.now().toString().slice(-5)}`,
          humanExpertId: app.humanExpertId,
          name: app.applicantName,
          title: app.applicantTitle,
          role: app.requestedRole,
          avatarInitials: app.avatarInitials,
          avatarAccent: app.avatarAccent,
          joinedAt: ts,
        };
        setZones((prev) =>
          prev.map((z) => {
            if (z.id !== app.zoneId) return z;
            const existing = z.members || [];
            if (
              app.humanExpertId &&
              existing.some((m) => m.humanExpertId === app.humanExpertId)
            ) {
              return z;
            }
            return {
              ...z,
              members: [...existing, newMember],
              memberCount: Math.max(existing.length + 1, z.memberCount + 1),
            };
          }),
        );
        if (app.humanExpertId === 'human_me') {
          setJoinedZoneIds((prev) => (prev.includes(app.zoneId) ? prev : [...prev, app.zoneId]));
        }
      }

      const resolvedLabel = decision === 'approved' ? '已同意入驻' : '已拒绝';
      setAssistantMessages((prev) => [
        ...prev.map((m) =>
          m.cards
            ? {
                ...m,
                cards: m.cards.map((c) =>
                  c.actionTarget?.type === 'space_application' &&
                  c.actionTarget.applicationId === applicationId
                    ? { ...c, resolved: true, resolvedLabel }
                    : c,
                ),
              }
            : m,
        ),
        {
          id: `asst_app_${Date.now()}`,
          sender: 'assistant',
          category: 'approval',
          content:
            decision === 'approved'
              ? `已通过入驻申请：${app.applicantName}（${app.applicantTitle}）已正式加入「${app.zoneName}」成员列表，并同步获得该空间的协作访问权限。`
              : `已拒绝入驻申请：已向 ${app.applicantName} 通知未通过「${app.zoneName}」的成员加入申请。`,
          timestamp: ts,
        },
      ]);

      setAuditLogs((prev) => [
        {
          id: `aud_app_${Date.now()}`,
          category: 'approval',
          title:
            decision === 'approved'
              ? `成员入驻审批通过：${app.applicantName}`
              : `成员入驻审批拒绝：${app.applicantName}`,
          detail: `${app.zoneName} · ${app.applicantTitle}`,
          severity: decision === 'approved' ? 'success' : 'info',
          timestamp: ts,
        },
        ...prev,
      ]);
    },
    [managedZoneIdSet, spaceApplications],
  );

  const sendAssistantMessage = useCallback(
    async (text: string) => {
      const cleaned = text.trim();
      if (!cleaned) return;
      setAiError(null);

      const ts = nowTimeStr();
      const userMsg: AssistantMessage = {
        id: `asst_u_${Date.now()}`,
        sender: 'user',
        content: cleaned,
        timestamp: ts,
      };

      const nextHistory = [...assistantMessages, userMsg];
      setAssistantMessages(nextHistory);
      setAssistantBusy(true);

      try {
        const res = await sendPlatformAssistantMessage({
          message: cleaned,
          history: nextHistory,
          workspaces,
          tasks: allTasks,
          negotiations,
          settlements,
          privateAgents,
        });

        const validCat = new Set<PlatformServiceCategory>([
          'approval',
          'settlement',
          'order',
          'audit',
          'general',
        ]);
        const isApprovalIntent = /审批|申请|入驻|加入空间|成员/.test(cleaned);
        const category: PlatformServiceCategory = validCat.has(res.category)
          ? res.category
          : isApprovalIntent
            ? 'approval'
            : 'general';

        const firstPendingApp = managedSpaceApplications.find((a) => a.status === 'pending');
        const firstUnsettled = settlements.find((s) => s.status === 'unsettled');
        const firstActiveNeg = negotiations.find((n) => n.status !== 'hired');

        let actionLabel: string | undefined;
        let actionTarget:
          | { type: 'settle'; settlementId: string }
          | { type: 'open_dm'; agentId: string }
          | { type: 'open_kanban'; projectId?: string }
          | { type: 'open_team' }
          | { type: 'space_application'; applicationId: string }
          | undefined;

        if ((category === 'approval' || isApprovalIntent) && firstPendingApp) {
          actionLabel = '同意加入';
          actionTarget = { type: 'space_application', applicationId: firstPendingApp.id };
        } else if (category === 'settlement' && firstUnsettled) {
          actionLabel = `确认结算 ${formatUsd(firstUnsettled.amountUsd)}`;
          actionTarget = { type: 'settle', settlementId: firstUnsettled.id };
        } else if (category === 'order' && firstActiveNeg) {
          actionLabel = '打开私聊协商';
          actionTarget = { type: 'open_dm', agentId: firstActiveNeg.agentId };
        } else if (category === 'audit') {
          actionLabel = '去项目看板复核';
          actionTarget = { type: 'open_kanban' };
        }

        const replyMsg: AssistantMessage = {
          id: `asst_a_${Date.now()}`,
          sender: 'assistant',
          category,
          content: res.reply,
          timestamp: nowTimeStr(),
          cards: res.cardTitle
            ? [
                {
                  id: `acard_${Date.now()}`,
                  category,
                  title: res.cardTitle,
                  detail: res.cardDetail,
                  metricLabel: res.metricLabel,
                  actionLabel,
                  actionTarget,
                },
              ]
            : undefined,
        };

        setAssistantMessages((prev) => [...prev, replyMsg]);
      } catch (err) {
        setAiError(err instanceof Error ? err.message : 'Nexa 平台助理响应失败');
      } finally {
        setAssistantBusy(false);
      }
    },
    [
      allTasks,
      assistantMessages,
      managedSpaceApplications,
      negotiations,
      privateAgents,
      settlements,
      workspaces,
    ],
  );

  const savePrivateAgent = useCallback(
    (expert: ExpertAgent, isNew: boolean) => {
      const normalizedZones = Array.from(new Set(expert.listedZoneIds || []));
      const normalizedExpert: ExpertAgent = {
        ...expert,
        listedZoneIds: normalizedZones,
        isListedInMarket: normalizedZones.length > 0,
      };
      if (isNew) {
        setAgents((prev) => [normalizedExpert, ...prev]);
      } else {
        setAgents((prev) => prev.map((a) => (a.id === normalizedExpert.id ? normalizedExpert : a)));
      }
      const ts = nowTimeStr();
      if (normalizedZones.length > 0) {
        const zoneNames = normalizedZones
          .map((zid) => zones.find((z) => z.id === zid)?.name || zid)
          .join('、');
        setAuditLogs((prev) => [
          {
            id: `aud_list_${Date.now()}`,
            category: 'order',
            title: `私有节点 ${normalizedExpert.handle} 已上架至：${zoneNames}`,
            detail: `项目签约挂牌价 ${formatUsd(normalizedExpert.projectPriceUsd)}/项目，Nexa 助理将自动跟进外部雇主咨询与结算。`,
            severity: 'success',
            timestamp: ts,
          },
          ...prev,
        ]);
      }
    },
    [zones],
  );

  const toggleMarketListing = useCallback(
    (agentId: string, targetZoneId?: string) => {
      const target = agents.find((a) => a.id === agentId);
      if (!target || target.ownership !== 'private') return;
      const zoneId = targetZoneId || activeZone.id;
      const zoneName = zones.find((z) => z.id === zoneId)?.name || '当前社区';
      const isInZone = target.listedZoneIds.includes(zoneId);
      const nextZones = isInZone
        ? target.listedZoneIds.filter((id) => id !== zoneId)
        : [...target.listedZoneIds, zoneId];
      const ts = nowTimeStr();

      setAgents((prev) =>
        prev.map((a) =>
          a.id === agentId
            ? {
                ...a,
                listedZoneIds: nextZones,
                isListedInMarket: nextZones.length > 0,
                isOnlineForOrders: true,
              }
            : a,
        ),
      );

      setAuditLogs((prev) => [
        {
          id: `aud_tgl_${Date.now()}`,
          category: 'order',
          title: !isInZone
            ? `私有节点 ${target.handle} 已上架「${zoneName}」`
            : `私有节点 ${target.handle} 已从「${zoneName}」下架`,
          detail: !isInZone
            ? `已在「${zoneName}」服务市场曝光接单，平台助理将实时播报雇佣协商与收益结算。`
            : nextZones.length > 0
              ? `已撤回在「${zoneName}」的曝光，其余已勾选社区仍保持接单。`
              : '已撤回全部对外市场曝光，当前仅保留个人私有自用权限。',
          severity: 'info',
          timestamp: ts,
        },
        ...prev,
      ]);
    },
    [activeZone.id, agents, zones],
  );

  // (sendGroupMessage defined right after updateTaskStatus to support @-driven workflow advancement)


  const updateTaskStatus = useCallback(
    (taskId: string, nextStatus: TaskStatus) => {
      const target = allTasks.find((t) => t.id === taskId);
      if (!target || target.status === nextStatus) return;
      const proj = workspaces.find((w) => w.id === target.sessionId);
      if (isWorkspaceReadOnly(proj)) return;
      const ts = nowTimeStr();
      const fromStage = getTaskCurrentStage(target.status);
      const targetStage = STATUS_TO_STAGE[nextStatus];
      const stageMeta = getPipelineStageMetaByStatus(nextStatus);
      const assignments = projectAgentAssignments[target.sessionId] || [];
      const slots = projectPipelines[target.sessionId] || getDefaultProjectPipelineSlots();
      const targetSlot = slots.find((s) => s.stage === targetStage);
      const workflowTeam = resolveTaskWorkflowTeam(target, proj, agents, assignments, slots);

      let targetStageAgent: ExpertAgent | undefined;
      const activeTargetStage = mapStatusToActiveStage(nextStatus);
      if (activeTargetStage) {
        const mappedStageAgent = workflowTeam.stageAgents[activeTargetStage];
        if (mappedStageAgent) {
          targetStageAgent = mappedStageAgent;
        } else {
          const balanced = pickLoadBalancedStageAgent(
            target.sessionId,
            activeTargetStage,
            target.assigneeId,
            assignments,
            agents,
            allTasks,
          );
          if (balanced) {
            targetStageAgent = balanced;
          } else if (targetSlot?.agentId) {
            targetStageAgent = agents.find((a) => a.id === targetSlot.agentId);
          }
        }
      }

      const shouldReassign =
        Boolean(targetStageAgent) && targetStageAgent!.id !== target.assigneeId;

      const nextAssigneeId = shouldReassign ? targetStageAgent!.id : target.assigneeId;
      const nextAssigneeHandle = shouldReassign ? targetStageAgent!.handle : target.assigneeHandle;

      const updatedTask: WorkflowTask = {
        ...target,
        status: nextStatus,
        assigneeId: nextAssigneeId,
        assigneeHandle: nextAssigneeHandle,
        updatedAt: ts,
      };

      const finalTasks = allTasks.map((t) => (t.id === taskId ? updatedTask : t));
      setAllTasks(finalTasks);

      if (shouldReassign && targetStageAgent) {
        setWorkspaces((prev) =>
          prev.map((w) =>
            w.id === target.sessionId && !w.hiredAgentIds.includes(targetStageAgent.id)
              ? { ...w, hiredAgentIds: [...w.hiredAgentIds, targetStageAgent.id] }
              : w,
          ),
        );
      }

      if (nextStatus === 'done') {
        if (updatedTask.deliverableArtifact) {
          upsertTaskDeliverableArtifact(
            updatedTask,
            updatedTask.deliverableArtifact,
            updatedTask.deliverableSummary,
            ts,
          );
        }
        const verifierAgent =
          workflowTeam.stageAgents.testing || agents.find((a) => a.id === nextAssigneeId);
        setAllMessages((prev) => [
          ...prev,
          {
            id: `msg_approve_${Date.now()}`,
            sessionId: target.sessionId,
            senderType: 'agent',
            senderId: verifierAgent?.id || nextAssigneeId,
            senderName: verifierAgent?.name || nextAssigneeHandle,
            senderHandle: verifierAgent?.handle || nextAssigneeHandle,
            content: `已完成「${target.title}」验收核查并归档交付物${
              updatedTask.deliverableArtifact ? `（${updatedTask.deliverableArtifact}）` : ''
            }，任务状态已更新为「已完成」。`,
            timestamp: ts,
            linkedTaskIds: [taskId],
          },
        ]);
        setTaskSessions((prev) => {
          const existing = prev[taskId] || [];
          return {
            ...prev,
            [taskId]: [
              ...existing.map((m) =>
                m.awaitingConfirmation ? { ...m, awaitingConfirmation: false } : m,
              ),
              {
                id: `tsm_done_${Date.now()}`,
                taskId,
                sender: 'system',
                workflowStage: 'testing',
                content: `「${target.title}」已验证通过并流转至「已完成」，产物归档完成，结论已同步至项目群卡片。`,
                timestamp: ts,
                milestoneSynced: true,
              },
            ],
          };
        });
        setAuditLogs((prev) => [
          {
            id: `aud_ok_${Date.now()}`,
            category: 'audit',
            title: `任务验收完成：${target.title}`,
            detail: `${proj?.name || '项目'} · ${nextAssigneeHandle} 交付产物已验证归档。`,
            severity: 'success',
            timestamp: ts,
          },
          ...prev,
        ]);
      } else {
        if (activeTargetStage && activeTargetStage !== fromStage) {
          const toLabel = STAGE_LABEL_MAP[activeTargetStage];
          const fromLabel = STAGE_LABEL_MAP[fromStage];
          const nextAgentObj = targetStageAgent || agents.find((a) => a.id === nextAssigneeId);
          const nextAgentName = nextAgentObj
            ? formatAgentDisplayName(
                nextAgentObj.handle,
                nextAgentObj.runtimeAgent,
                nextAgentObj.defaultModel,
              )
            : nextAssigneeHandle;

          setTaskSessions((prev) => {
            const existing = (prev[taskId] || []).map((m) =>
              m.awaitingConfirmation ? { ...m, awaitingConfirmation: false } : m,
            );
            const handoffMsg: TaskSessionMessage = {
              id: `tsm_ho_${Date.now()}`,
              taskId,
              sender: 'system',
              workflowStage: activeTargetStage,
              handoff: {
                fromStage,
                toStage: activeTargetStage,
                fromAgentId: target.assigneeId,
                toAgentId: nextAssigneeId,
              },
              content: `${fromLabel}阶段已确认，交棒给 ${nextAgentName} 进入${toLabel}阶段`,
              timestamp: ts,
            };
            const pickupMsg: TaskSessionMessage = {
              id: `tsm_pk_${Date.now() + 1}`,
              taskId,
              sender: 'agent',
              agentId: nextAssigneeId,
              agentHandle: nextAssigneeHandle,
              workflowStage: activeTargetStage,
              content:
                activeTargetStage === 'development'
                  ? `已接棒「${fromLabel}」阶段产出并进入执行。我将围绕任务目标「${target.title}」落地实现与单测，如有额外约束请直接告诉我，或点击下方快捷指令开始执行。`
                  : activeTargetStage === 'testing'
                    ? `已接棒「${fromLabel}」阶段交付物进入验收。我将核验核心边界、回归用例与代码质量，如需重点关注某项风险可以直接指示，或确认后放行结项。`
                    : `已切回「${toLabel}」阶段，请说明需要补充或调整的规划边界。`,
              timestamp: ts,
              suggestedActions:
                activeTargetStage === 'development'
                  ? ['按计划规格直接开始实现并产出初版代码', '先确认核心接口签名与异常处理边界']
                  : activeTargetStage === 'testing'
                    ? ['执行边界审查并输出验收结论', '直接验收通过并归档任务']
                    : ['重新梳理任务范围与验收标准'],
              awaitingConfirmation: true,
            };
            return {
              ...prev,
              [taskId]: [...existing, handoffMsg, pickupMsg],
            };
          });

          // Broadcast concise stage execution result & status change to the Project Group Chat from the finishing specialist
          const prevStageAgent =
            workflowTeam.stageAgents[fromStage] ||
            agents.find((a) => a.id === target.assigneeId) ||
            nextAgentObj;
          const groupStageResult =
            activeTargetStage === 'development'
              ? `已完成「${target.title}」计划拆解与边界确认，状态推进至「执行中」，已交棒 ${nextAssigneeHandle} 进入实现。`
              : activeTargetStage === 'testing'
                ? `已完成「${target.title}」核心实现与自测${
                    updatedTask.deliverableArtifact ? `（产物：${updatedTask.deliverableArtifact}）` : ''
                  }，状态推进至「待验收」，已交棒 ${nextAssigneeHandle} 复核。`
                : `已将「${target.title}」调整至「${toLabel}」阶段，当前由 ${nextAssigneeHandle} 负责跟进。`;

          setAllMessages((prev) => [
            ...prev,
            {
              id: `msg_stage_${Date.now()}`,
              sessionId: target.sessionId,
              senderType: 'agent',
              senderId: prevStageAgent?.id || target.assigneeId,
              senderName: prevStageAgent?.name || target.assigneeHandle,
              senderHandle: prevStageAgent?.handle || target.assigneeHandle,
              content: groupStageResult,
              timestamp: ts,
              linkedTaskIds: [taskId],
            },
          ]);
        }

        setAuditLogs((prev) => [
          {
            id: `aud_sync_${Date.now()}`,
            category: 'audit',
            title: `任务流转至「${stageMeta.label}」`,
            detail: `${proj?.name || '项目'} · 「${target.title}」已进入「${TASK_STATUS_LABEL_MAP[nextStatus]}」${
              shouldReassign ? `，已交棒给阶段专业 Agent ${nextAssigneeHandle}` : ''
            }，任务编排阶段进度已实时同步。`,
            severity: 'info',
            timestamp: ts,
          },
          ...prev,
        ]);
      }
    },
    [
      agents,
      allTasks,
      projectAgentAssignments,
      projectPipelines,
      upsertTaskDeliverableArtifact,
      workspaces,
    ],
  );

  const sendGroupMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (isWorkspaceReadOnly(activeWorkspace)) {
        setAiError('该项目已完成或归档，请先重新激活项目后再发起群聊协作。');
        return;
      }
      setAiError(null);

      const userTs = nowTimeStr();
      const userMsgId = `msg_user_${Date.now()}`;
      const userMsg: ChatMessage = {
        id: userMsgId,
        sessionId: activeWorkspace.id,
        senderType: 'employer',
        senderId: 'employer',
        senderName: account?.name || '我（项目负责人）',
        senderHandle: account ? `@${account.name}` : '@指挥官',
        content: trimmed,
        timestamp: userTs,
      };

      const nextSessionMessages = [...sessionMessages, userMsg];
      setAllMessages((prev) => [...prev, userMsg]);

      const curAssignments = projectAgentAssignments[activeWorkspace.id] || [];
      const curSlots = projectPipelines[activeWorkspace.id] || getDefaultProjectPipelineSlots();
      const curTaskTypes = projectTaskTypes[activeWorkspace.id] || DEFAULT_PROJECT_TASK_TYPES;

      // Support human @-driven workflow progression right inside Project Group Chat
      const wantsCreateNew = /新增|新建|拆解|拆成|创建新/.test(trimmed);
      const wantsApprove = /验收通过|确认通过|验证通过|放行归档|放行验收|确认归档/.test(trimmed);
      const wantsReview = /提交验收|进入验收|去验收|开始验收|复核|评审/.test(trimmed);
      const wantsExecute = /交棒|接棒|进入执行|开始执行|开始开发|推进|开干|自动接力|自动推进/.test(
        trimmed,
      );
      const mentionedAgent = agents.find(
        (a) =>
          trimmed.includes(a.handle) ||
          trimmed.includes(`@${a.handle.replace(/^@/, '')}`),
      );

      if (!wantsCreateNew && (wantsApprove || wantsReview || wantsExecute)) {
        const nonDoneTasks = sessionTasks.filter((t) => t.status !== 'done');
        const explicitlyReferenced = nonDoneTasks.find(
          (t) =>
            trimmed.includes(t.id) ||
            trimmed.includes(`#${t.id}`) ||
            (t.title.length >= 4 && trimmed.includes(t.title.slice(0, 6))),
        );

        let targetTask = explicitlyReferenced;
        if (!targetTask) {
          if (wantsApprove) {
            targetTask = nonDoneTasks.find((t) => t.status === 'review');
          } else if (wantsReview) {
            targetTask =
              nonDoneTasks.find((t) => t.status === 'in_progress') ||
              nonDoneTasks.find((t) => t.status === 'pending');
          } else if (wantsExecute) {
            targetTask =
              nonDoneTasks.find((t) => t.status === 'pending') ||
              nonDoneTasks.find((t) => t.status === 'in_progress') ||
              nonDoneTasks.find((t) => t.status === 'review');
          }
        }

        if (targetTask) {
          let nextStatus: TaskStatus | null = null;
          if (wantsApprove && targetTask.status === 'review') {
            nextStatus = 'done';
          } else if (wantsReview && targetTask.status !== 'review') {
            nextStatus = 'review';
          } else if (wantsExecute) {
            if (targetTask.status === 'pending') nextStatus = 'in_progress';
            else if (targetTask.status === 'in_progress') nextStatus = 'review';
            else if (targetTask.status === 'review') nextStatus = 'done';
          }

          if (nextStatus && nextStatus !== targetTask.status) {
            const targetId = targetTask.id;
            setTaskSessions((prev) => ({
              ...prev,
              [targetId]: [
                ...(prev[targetId] || []),
                {
                  id: `tsm_grp_u_${Date.now()}`,
                  taskId: targetId,
                  sender: 'employer',
                  workflowStage: getTaskCurrentStage(targetTask!.status),
                  content: `【来自项目群指令】${trimmed}`,
                  timestamp: userTs,
                },
              ],
            }));
            updateTaskStatus(targetId, nextStatus);
            return;
          }
        }
      }

      setIsAiBusy(true);

      try {
        const result = await orchestrateGroupChat({
          message: trimmed,
          workspace: activeWorkspace,
          hiredAgents,
          projectAssignments: curAssignments,
          projectTaskTypes: curTaskTypes,
          recentMessages: nextSessionMessages,
          existingTasks: sessionTasks,
        });

        const ts = nowTimeStr();
        const validTypes = new Set<WorkCardType>(['planning', 'development', 'testing', 'review']);
        const planningFallback = pickLoadBalancedStageAgent(
          activeWorkspace.id,
          'planning',
          undefined,
          curAssignments,
          agents,
          allTasks,
        );
        const createdTasks: WorkflowTask[] = (result.newTasks || []).map((nt, idx) => {
          const validAssignee =
            hiredAgents.find((a) => a.id === nt.assigneeId) ||
            mentionedAgent ||
            planningFallback ||
            hiredAgents[0];
          const wType: WorkCardType = validTypes.has(nt.workType) ? nt.workType : 'development';
          const draftTask: WorkflowTask = {
            id: `tsk_${Date.now().toString().slice(-4)}_${idx + 1}`,
            sessionId: activeWorkspace.id,
            featureModule: nt.featureModule?.trim() || `${activeWorkspace.name} · 核心模块`,
            workType: wType,
            title: nt.title,
            description: nt.description,
            assigneeId: validAssignee ? validAssignee.id : 'butler',
            assigneeHandle: validAssignee ? validAssignee.handle : nt.assigneeHandle || '@Nexa',
            status: 'pending',
            priority: nt.priority === '高' || nt.priority === '低' ? nt.priority : '中',
            createdAt: ts,
            updatedAt: ts,
            sourceMessageId: userMsgId,
          };
          const wf = resolveTaskWorkflowTeam(
            draftTask,
            activeWorkspace,
            agents,
            curAssignments,
            curSlots,
          );
          return {
            ...draftTask,
            stageAgents: {
              planning: wf.stageAgents.planning?.id,
              development: wf.stageAgents.development?.id,
              testing: wf.stageAgents.testing?.id,
            },
          };
        });

        if (createdTasks.length > 0) {
          setAllTasks((prev) => [...createdTasks, ...prev]);
          // Seed each new task session with the human's original prompt + starting specialist kickoff
          setTaskSessions((prev) => {
            const next = { ...prev };
            createdTasks.forEach((t, idx) => {
              const startAgent = agents.find((a) => a.id === t.assigneeId);
              next[t.id] = [
                {
                  id: `tsm_seed_u_${Date.now()}_${idx}`,
                  taskId: t.id,
                  sender: 'employer',
                  workflowStage: 'planning',
                  content: trimmed,
                  timestamp: userTs,
                },
                {
                  id: `tsm_seed_a_${Date.now()}_${idx}`,
                  taskId: t.id,
                  sender: 'agent',
                  agentId: startAgent?.id || t.assigneeId,
                  agentHandle: startAgent?.handle || t.assigneeHandle,
                  workflowStage: 'planning',
                  content: `已接收项目群需求并启动「${t.title}」多阶段协作工作流（计划 → 执行 → 验收）。请确认核心边界或直接点击「交棒执行」推进下一步。`,
                  timestamp: ts,
                  suggestedActions: [
                    '确认方案并交棒研发进入执行阶段',
                    '补充异常边界与验收口径',
                  ],
                  awaitingConfirmation: true,
                },
              ];
            });
            return next;
          });
        }

        const aiReplies: ChatMessage[] = (result.replies || []).map((r, idx) => ({
          id: `msg_ai_${Date.now()}_${idx}`,
          sessionId: activeWorkspace.id,
          senderType: r.senderType === 'butler' ? 'butler' : 'agent',
          senderId: r.senderId,
          senderName: r.senderName,
          senderHandle: r.senderHandle,
          content: r.content,
          timestamp: ts,
          linkedTaskIds:
            idx === result.replies.length - 1 ? createdTasks.map((t) => t.id) : undefined,
        }));

        if (aiReplies.length > 0) {
          setAllMessages((prev) => [...prev, ...aiReplies]);
        }
      } catch (err) {
        setAiError(err instanceof Error ? err.message : '群聊智能体响应失败');
      } finally {
        setIsAiBusy(false);
      }
    },
    [
      account,
      activeWorkspace,
      agents,
      allTasks,
      hiredAgents,
      projectAgentAssignments,
      projectPipelines,
      projectTaskTypes,
      sessionMessages,
      sessionTasks,
      updateTaskStatus,
    ],
  );

  const openTaskSession = useCallback(
    (taskId: string) => {
      const target = allTasks.find((t) => t.id === taskId);
      if (!target) return;
      const proj = workspaces.find((w) => w.id === target.sessionId);
      const assignments = projectAgentAssignments[target.sessionId] || [];
      const slots = projectPipelines[target.sessionId] || getDefaultProjectPipelineSlots();
      const workflowTeam = resolveTaskWorkflowTeam(target, proj, agents, assignments, slots);
      const activeAg = workflowTeam.activeAgent || agents.find((a) => a.id === target.assigneeId);

      setTaskSessions((prev) => {
        if (prev[taskId] && prev[taskId].length > 0) return prev;
        return {
          ...prev,
          [taskId]: [
            {
              id: `tsm_init_${Date.now()}`,
              taskId,
              sender: 'agent',
              agentId: activeAg?.id || target.assigneeId,
              agentHandle: activeAg?.handle || target.assigneeHandle,
              workflowStage: workflowTeam.currentStage,
              content: `已进入任务「${target.title}」（#${target.id}）的多 Agent 协同工作流。当前处于「${STAGE_LABEL_MAP[workflowTeam.currentStage]}」阶段，由我接棒推进；你可以直接发送指令，或随时 @ 本任务其他阶段专家一起协作，所有过程细节均收敛在本会话内。`,
              timestamp: nowTimeStr(),
              suggestedActions: [
                '请先输出本阶段执行计划与待确认边界',
                '按任务规格直接开始执行并产出初版方案',
              ],
              awaitingConfirmation: target.status !== 'done',
            },
          ],
        };
      });

      setActiveSessionId(target.sessionId);
      setActiveChatChannel({ type: 'task_session', taskId, projectId: target.sessionId });
      setActiveView('chat');
      setTaskSessionError(null);
    },
    [agents, allTasks],
  );

  const openAgentTaskSession = useCallback(
    (agentId: string) => {
      const agentTasks = allTasks.filter((t) => t.assigneeId === agentId);
      if (agentTasks.length > 0) {
        const statusOrder: Record<TaskStatus, number> = {
          in_progress: 0,
          review: 1,
          pending: 2,
          done: 3,
        };
        const sorted = [...agentTasks].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
        openTaskSession(sorted[0].id);
        return;
      }
      const targetAgent = agents.find((a) => a.id === agentId);
      if (!targetAgent) return;
      const hostWs =
        workspaces.find((w) => w.hiredAgentIds.includes(agentId)) || activeWorkspace;
      createAndOpenTaskSession({
        sessionId: hostWs.id,
        featureModule: '核心协作任务',
        workType: 'development',
        title: `与 ${targetAgent.handle} 协同推进：${hostWs.name} 专项任务`,
        description: `围绕「${hostWs.name}」的当前目标开启专属 Agent 任务 Session。`,
        assigneeId: agentId,
        priority: '中',
      });
    },
    [activeWorkspace, agents, allTasks, createAndOpenTaskSession, openTaskSession, workspaces],
  );

  const switchConversationMode = useCallback(
    (nextMode: ConversationInteractionMode) => {
      setPreferredConversationMode(nextMode);

      // If currently on the New Session Launcher, simply switch the sidebar list mode without leaving the launchpad
      if (activeChatChannel.type === 'new_session') {
        return;
      }

      if (nextMode === 'task') {
        if (activeChatChannel.type !== 'task_session') {
          setLastChatChannel(activeChatChannel);
        }
        // Pick the most contextually relevant task session
        const statusOrder: Record<TaskStatus, number> = {
          in_progress: 0,
          review: 1,
          pending: 2,
          done: 3,
        };
        const sortedAll = [...allTasks].sort(
          (a, b) => statusOrder[a.status] - statusOrder[b.status],
        );

        let targetTask: WorkflowTask | undefined;
        if (activeChatChannel.type === 'task_session') {
          targetTask = allTasks.find((t) => t.id === activeChatChannel.taskId);
        } else if (activeChatChannel.type === 'group') {
          targetTask = sortedAll.find((t) => t.sessionId === activeChatChannel.projectId);
        } else if (activeChatChannel.type === 'dm') {
          targetTask = sortedAll.find((t) => t.assigneeId === activeChatChannel.agentId);
        } else if (activeChatChannel.type === 'human_dm') {
          const ownedIds = new Set(
            agents
              .filter((a) => a.ownerHumanId === activeChatChannel.expertId)
              .map((a) => a.id),
          );
          targetTask = sortedAll.find((t) => ownedIds.has(t.assigneeId));
        }

        if (!targetTask && lastTaskSessionId) {
          targetTask = allTasks.find((t) => t.id === lastTaskSessionId);
        }
        if (!targetTask) {
          targetTask = sortedAll[0];
        }

        if (targetTask) {
          setLastTaskSessionId(targetTask.id);
          openTaskSession(targetTask.id);
        } else {
          setActiveView('chat');
        }
        return;
      }

      // Switching back to 'chat' (IM dialog mode)
      if (activeChatChannel.type === 'task_session') {
        setLastTaskSessionId(activeChatChannel.taskId);
        const fallbackGroup: ActiveChatChannel = {
          type: 'group',
          projectId: activeChatChannel.projectId,
        };
        const target =
          lastChatChannel.type !== 'task_session' && lastChatChannel.type !== 'new_session'
            ? lastChatChannel
            : fallbackGroup;
        if (target.type === 'group') {
          setActiveSessionId(target.projectId);
        }
        setActiveChatChannel(target);
        setActiveView('chat');
      } else {
        setActiveView('chat');
      }
    },
    [activeChatChannel, agents, allTasks, lastChatChannel, lastTaskSessionId, openTaskSession],
  );

  const openHumanDm = useCallback((expertId: string) => {
    setHumanDmThreads((prev) => {
      if (prev.some((t) => t.expertId === expertId)) return prev;
      return [
        {
          expertId,
          updatedAt: nowTimeStr(),
          messages: [],
        },
        ...prev,
      ];
    });
    setActiveChatChannel({ type: 'human_dm', expertId });
    setActiveView('chat');
  }, []);

  const sendHumanDmMessage = useCallback(
    (expertId: string, rawText: string, linkedTaskId?: string) => {
      const cleaned = rawText.trim();
      if (!cleaned) return;
      const ts = nowTimeStr();
      const expert = humanExperts.find((h) => h.id === expertId);
      const ownedAgents = agents.filter((a) => a.ownerHumanId === expertId);
      const primaryOwned = ownedAgents[0];

      setHumanDmThreads((prev) => {
        const exists = prev.some((t) => t.expertId === expertId);
        const userMsg = {
          id: `hdm_u_${Date.now()}`,
          sender: 'employer' as const,
          content: cleaned,
          timestamp: ts,
          linkedTaskId,
        };
        if (!exists) {
          return [{ expertId, updatedAt: ts, messages: [userMsg] }, ...prev];
        }
        return prev.map((t) =>
          t.expertId === expertId
            ? { ...t, updatedAt: ts, messages: [...t.messages, userMsg] }
            : t,
        );
      });

      // Simulated prompt human expert reply keeping multi-agent collaboration loop alive
      setTimeout(() => {
        const replyTs = nowTimeStr();
        const linkedTask = linkedTaskId ? allTasks.find((t) => t.id === linkedTaskId) : undefined;
        const replyText = linkedTask
          ? `收到，我刚看了任务卡 #${linkedTask.id}「${linkedTask.title}」的进展。细节确认可以直接在 ${linkedTask.assigneeHandle} 的任务 Session 里敲定，我这边会同步把关关键验收标准。`
          : primaryOwned
            ? `好的，明白了！这件事我可以先安排我名下的 ${primaryOwned.handle}（${primaryOwned.runtimeAgent}）起一个任务卡片 Session 来落地，方案出来后我们再在项目群对齐。`
            : `收到，我已同步记录你的想法。需要拉我进哪个项目群或开新任务卡，直接告诉我即可。`;

        setHumanDmThreads((prev) =>
          prev.map((t) =>
            t.expertId === expertId
              ? {
                  ...t,
                  updatedAt: replyTs,
                  messages: [
                    ...t.messages,
                    {
                      id: `hdm_h_${Date.now()}`,
                      sender: 'human',
                      content: expert ? replyText : `收到：${cleaned}`,
                      timestamp: replyTs,
                      linkedTaskId,
                    },
                  ],
                }
              : t,
          ),
        );
      }, 450);
    },
    [agents, allTasks, humanExperts],
  );

  const openNegotiationsHub = useCallback(() => {
    const firstThread = negotiations[0];
    if (firstThread) {
      setActiveChatChannel({ type: 'dm', agentId: firstThread.agentId });
      setActiveView('chat');
      return;
    }
    const fallbackAgent = agents.find((a) => a.isListedInMarket) || agents[0];
    if (fallbackAgent) {
      startOrOpenNegotiation(fallbackAgent.id, true);
    }
  }, [agents, negotiations, startOrOpenNegotiation]);

  const sendTaskSessionTurn = useCallback(
    async (taskId: string, rawText: string, targetAgentId?: string) => {
      const cleaned = rawText.trim();
      if (!cleaned) return;
      const task = allTasks.find((t) => t.id === taskId);
      if (!task) return;

      const taskWorkspace = workspaces.find((w) => w.id === task.sessionId) || activeWorkspace;
      if (isWorkspaceReadOnly(taskWorkspace)) {
        setTaskSessionError('该项目已完成或归档，请先重新激活项目后再继续任务会话。');
        return;
      }

      const assignments = projectAgentAssignments[task.sessionId] || [];
      const slots = projectPipelines[task.sessionId] || getDefaultProjectPipelineSlots();
      const workflowTeam = resolveTaskWorkflowTeam(task, taskWorkspace, agents, assignments, slots);

      // Route to explicitly selected specialist from Codex-style selector, or fallback to current stage specialist
      const explicitlySelectedAgent = targetAgentId
        ? agents.find((a) => a.id === targetAgentId)
        : undefined;
      const respondingAgent =
        explicitlySelectedAgent ||
        workflowTeam.activeAgent ||
        agents.find((a) => a.id === task.assigneeId);

      // Determine the workflow stage context for this turn
      const matchedStage = (['planning', 'development', 'testing'] as ActiveWorkflowStage[]).find(
        (st) => workflowTeam.stageAgents[st]?.id === respondingAgent?.id,
      );
      const turnStage: ActiveWorkflowStage = explicitlySelectedAgent
        ? matchedStage || workflowTeam.currentStage
        : workflowTeam.currentStage;

      const prevHistory = taskSessions[taskId] || [];
      const ts = nowTimeStr();

      setTaskSessionError(null);
      setTaskSessionBusyId(taskId);

      const userTurn: TaskSessionMessage = {
        id: `tsm_u_${Date.now()}`,
        taskId,
        sender: 'employer',
        workflowStage: turnStage,
        content: cleaned,
        timestamp: ts,
      };

      // Clear previous awaitingConfirmation flags and append employer message
      const nextHistory: TaskSessionMessage[] = [
        ...prevHistory.map((m) => (m.awaitingConfirmation ? { ...m, awaitingConfirmation: false } : m)),
        userTurn,
      ];

      setTaskSessions((prev) => ({
        ...prev,
        [taskId]: nextHistory,
      }));

      // Build concise team roster context for the backend prompt
      const workflowTeamSummary = (['planning', 'development', 'testing'] as ActiveWorkflowStage[])
        .map((st) => {
          const ag = workflowTeam.stageAgents[st];
          return ag ? `${STAGE_LABEL_MAP[st]}: ${ag.handle}` : '';
        })
        .filter(Boolean)
        .join(' → ');

      // If user explicitly confirms final acceptance in review stage, complete directly
      if (
        task.status === 'review' &&
        (cleaned.includes('验收通过') || cleaned.includes('归档任务') || cleaned.includes('确认通过')) &&
        !explicitlySelectedAgent
      ) {
        setTaskSessionBusyId(null);
        updateTaskStatus(taskId, 'done');
        return;
      }

      // If task was pending and user signals handoff to execution, advance cleanly with a handoff divider
      let effectiveStatus = task.status;
      let effectiveAgent = respondingAgent;
      let effectiveStage = turnStage;
      if (
        task.status === 'pending' &&
        (cleaned.includes('交棒执行') || cleaned.includes('直接开跑') || cleaned.includes('立即执行'))
      ) {
        const execAgent = workflowTeam.stageAgents.development || respondingAgent;
        effectiveStatus = 'in_progress';
        effectiveAgent = execAgent || respondingAgent;
        effectiveStage = 'development';
        const execName = effectiveAgent
          ? formatAgentDisplayName(
              effectiveAgent.handle,
              effectiveAgent.runtimeAgent,
              effectiveAgent.defaultModel,
            )
          : task.assigneeHandle;

        setAllTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: 'in_progress',
                  assigneeId: effectiveAgent?.id || t.assigneeId,
                  assigneeHandle: effectiveAgent?.handle || t.assigneeHandle,
                  updatedAt: ts,
                }
              : t,
          ),
        );
        const handoffLine: TaskSessionMessage = {
          id: `tsm_ho_start_${Date.now()}`,
          taskId,
          sender: 'system',
          workflowStage: 'development',
          handoff: {
            fromStage: 'planning',
            toStage: 'development',
            fromAgentId: workflowTeam.stageAgents.planning?.id,
            toAgentId: effectiveAgent?.id,
          },
          content: `计划阶段已确认，交棒给 ${execName} 进入执行阶段`,
          timestamp: ts,
        };
        nextHistory.push(handoffLine);
        setTaskSessions((prev) => ({
          ...prev,
          [taskId]: [...nextHistory],
        }));
      }

      try {
        const result = await sendTaskSessionMessage({
          task: { ...task, status: effectiveStatus },
          agent: effectiveAgent || undefined,
          workspace: taskWorkspace,
          history: nextHistory,
          message: cleaned,
          stageLabel: STAGE_LABEL_MAP[effectiveStage],
          workflowTeamSummary,
        });

        const replyTs = nowTimeStr();
        const shouldSyncMilestone = Boolean(result.readyForReview);

        const agentTurn: TaskSessionMessage = {
          id: `tsm_a_${Date.now()}`,
          taskId,
          sender: 'agent',
          agentId: effectiveAgent?.id || task.assigneeId,
          agentHandle: effectiveAgent?.handle || task.assigneeHandle,
          workflowStage: effectiveStage,
          content: result.reply,
          timestamp: replyTs,
          executionSteps: (result.executionSteps || []).filter(Boolean),
          artifactPath: result.artifactPath?.trim() || undefined,
          artifactSnippet: result.artifactSnippet?.trim() || undefined,
          suggestedActions: (result.suggestedActions || []).filter(Boolean),
          awaitingConfirmation: Boolean(result.awaitingConfirmation),
          milestoneSynced: shouldSyncMilestone,
        };

        const appendedTurns: TaskSessionMessage[] = [agentTurn];

        if (shouldSyncMilestone) {
          const finalArtifact =
            result.artifactPath?.trim() || task.deliverableArtifact || `artifacts/${task.id}_deliverable.md`;
          const verifierAgent = workflowTeam.stageAgents.testing;
          const handedOff = Boolean(
            effectiveStage !== 'testing' && verifierAgent && verifierAgent.id !== effectiveAgent?.id,
          );
          const nextAssigneeId = handedOff ? verifierAgent!.id : effectiveAgent?.id || task.assigneeId;
          const nextAssigneeHandle = handedOff
            ? verifierAgent!.handle
            : effectiveAgent?.handle || task.assigneeHandle;

          if (handedOff && verifierAgent) {
            appendedTurns.push({
              id: `tsm_ho_rev_${Date.now() + 1}`,
              taskId,
              sender: 'system',
              workflowStage: 'testing',
              handoff: {
                fromStage: effectiveStage,
                toStage: 'testing',
                fromAgentId: effectiveAgent?.id,
                toAgentId: verifierAgent.id,
              },
              content: `${STAGE_LABEL_MAP[effectiveStage]}产物已提交，交棒给 ${formatAgentDisplayName(
                verifierAgent.handle,
                verifierAgent.runtimeAgent,
                verifierAgent.defaultModel,
              )} 进入验收阶段`,
              timestamp: replyTs,
            });
          }

          const updatedTask: WorkflowTask = {
            ...task,
            status: task.status === 'done' ? 'done' : 'review',
            assigneeId: nextAssigneeId,
            assigneeHandle: nextAssigneeHandle,
            deliverableSummary: result.reply,
            deliverableArtifact: finalArtifact,
            updatedAt: replyTs,
          };

          const milestoneText =
            result.groupMilestoneSummary?.trim() ||
            `已完成当前阶段产出并交棒进入「验收」，点击下方任务卡片查看协作详情。`;

          setAllTasks((prev) => prev.map((t) => (t.id === taskId ? updatedTask : t)));
          upsertTaskDeliverableArtifact(updatedTask, finalArtifact, result.reply, replyTs);

          setAllMessages((prev) => [
            ...prev,
            {
              id: `msg_ts_rev_${Date.now()}`,
              sessionId: task.sessionId,
              senderType: 'agent',
              senderId: effectiveAgent?.id || 'butler',
              senderName: effectiveAgent?.name || 'Nexa 助理',
              senderHandle: effectiveAgent?.handle || task.assigneeHandle,
              content: milestoneText,
              timestamp: replyTs,
              linkedTaskIds: [taskId],
            },
          ]);

          setAuditLogs((prev) => [
            {
              id: `aud_ts_${Date.now()}`,
              category: 'audit',
              title: `任务交付就绪待验收：${task.title}`,
              detail: `${taskWorkspace.name} · ${effectiveAgent?.handle || task.assigneeHandle} 已完成迭代${
                handedOff ? `并交棒给 ${nextAssigneeHandle}` : ''
              }，产物已沉淀至 Artifacts。`,
              severity: 'warning',
              timestamp: replyTs,
            },
            ...prev,
          ]);
        } else if (result.artifactPath?.trim()) {
          const updatedTask: WorkflowTask = {
            ...task,
            deliverableArtifact: result.artifactPath.trim(),
            updatedAt: replyTs,
          };
          setAllTasks((prev) => prev.map((t) => (t.id === taskId ? updatedTask : t)));
          upsertTaskDeliverableArtifact(updatedTask, result.artifactPath.trim(), result.reply, replyTs);
        }

        setTaskSessions((prev) => ({
          ...prev,
          [taskId]: [...(prev[taskId] || nextHistory), ...appendedTurns],
        }));
      } catch (err) {
        setTaskSessionError(err instanceof Error ? err.message : 'Agent 任务 Session 调用失败');
      } finally {
        setTaskSessionBusyId(null);
      }
    },
    [
      activeWorkspace,
      agents,
      allTasks,
      projectAgentAssignments,
      projectPipelines,
      taskSessions,
      updateTaskStatus,
      upsertTaskDeliverableArtifact,
      workspaces,
    ],
  );

  const syncTaskSummaryToGroup = useCallback(
    (taskId: string, customNote?: string) => {
      const task = allTasks.find((t) => t.id === taskId);
      if (!task) return;
      const proj = workspaces.find((w) => w.id === task.sessionId);
      if (isWorkspaceReadOnly(proj)) return;
      const assignedAgent = agents.find((a) => a.id === task.assigneeId);
      const history = taskSessions[taskId] || [];
      const lastAgentTurn = [...history].reverse().find((m) => m.sender === 'agent');
      const ts = nowTimeStr();
      const summary =
        customNote?.trim() ||
        (lastAgentTurn
          ? lastAgentTurn.content.slice(0, 88) + (lastAgentTurn.content.length > 88 ? '...' : '')
          : `「${task.title}」已在 Agent Session 同步阶段进展。`);

      if (task.deliverableArtifact) {
        upsertTaskDeliverableArtifact(task, task.deliverableArtifact, summary, ts);
      }

      setAllMessages((prev) => [
        ...prev,
        {
          id: `msg_ts_sync_${Date.now()}`,
          sessionId: task.sessionId,
          senderType: 'agent',
          senderId: assignedAgent?.id || 'butler',
          senderName: assignedAgent?.name || 'Nexa 助理',
          senderHandle: assignedAgent?.handle || task.assigneeHandle,
          content: `【Agent 任务阶段同步】${summary}${task.deliverableArtifact ? `（产物：${task.deliverableArtifact}）` : ''}`,
          timestamp: ts,
          linkedTaskIds: [taskId],
        },
      ]);

      setTaskSessions((prev) => ({
        ...prev,
        [taskId]: [
          ...(prev[taskId] || []),
          {
            id: `tsm_sync_${Date.now()}`,
            taskId,
            sender: 'system',
            content: '已将本轮阶段结论手动摘要回写至所属项目群聊。',
            timestamp: ts,
            milestoneSynced: true,
          },
        ],
      }));
    },
    [agents, allTasks, taskSessions, upsertTaskDeliverableArtifact, workspaces],
  );

  const runAutonomousTask = useCallback(
    async (taskId: string) => {
      const task = allTasks.find((t) => t.id === taskId);
      if (!task) return;
      const taskWorkspace = workspaces.find((w) => w.id === task.sessionId) || activeWorkspace;
      if (isWorkspaceReadOnly(taskWorkspace)) {
        setAiError('该项目已完成或归档，请先重新激活项目后再执行任务。');
        return;
      }
      setAiError(null);
      setExecutingTaskId(taskId);

      // Step 1: Ensure execution-stage load-balanced expert picks up the task when starting from pending
      const assignments = projectAgentAssignments[task.sessionId] || [];
      const execAgent =
        task.status === 'pending'
          ? pickLoadBalancedStageAgent(
              task.sessionId,
              'development',
              task.assigneeId,
              assignments,
              agents,
              allTasks,
            ) || agents.find((a) => a.id === task.assigneeId)
          : agents.find((a) => a.id === task.assigneeId);

      const runningAssigneeId = execAgent?.id || task.assigneeId;
      const runningAssigneeHandle = execAgent?.handle || task.assigneeHandle;

      setAllTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: 'in_progress',
                assigneeId: runningAssigneeId,
                assigneeHandle: runningAssigneeHandle,
                updatedAt: nowTimeStr(),
              }
            : t,
        ),
      );

      try {
        const result = await executeKanbanTask({
          task: {
            ...task,
            status: 'in_progress',
            assigneeId: runningAssigneeId,
            assigneeHandle: runningAssigneeHandle,
          },
          agent: execAgent,
          workspace: taskWorkspace,
        });

        const ts = nowTimeStr();
        const executorAssignment = assignments.find((a) => a.agentId === runningAssigneeId);
        const isAutoHandoff = executorAssignment?.handoffMode !== 'manual';
        const verifierAgent = isAutoHandoff
          ? pickLoadBalancedStageAgent(
              task.sessionId,
              'testing',
              runningAssigneeId,
              assignments,
              agents,
              allTasks,
            )
          : undefined;
        const handedOffToVerifier = Boolean(verifierAgent && verifierAgent.id !== runningAssigneeId);
        const finalAssigneeId = handedOffToVerifier ? verifierAgent!.id : runningAssigneeId;
        const finalAssigneeHandle = handedOffToVerifier
          ? verifierAgent!.handle
          : runningAssigneeHandle;

        const completedTask: WorkflowTask = {
          ...task,
          status: 'review',
          assigneeId: finalAssigneeId,
          assigneeHandle: finalAssigneeHandle,
          deliverableSummary: result.deliverableSummary,
          deliverableArtifact: result.deliverableArtifact,
          updatedAt: ts,
        };

        setAllTasks((prev) => prev.map((t) => (t.id === taskId ? completedTask : t)));
        upsertTaskDeliverableArtifact(
          completedTask,
          result.deliverableArtifact,
          result.deliverableSummary,
          ts,
        );

        const handoffSuffix = handedOffToVerifier
          ? `已按「自动流转」交接给验证专家 ${finalAssigneeHandle} 进行验证。`
          : isAutoHandoff
            ? '已流转至「任务验证」阶段。'
            : '当前专家配置为「人工确认」交接模式，待雇主复核确认后交接下一阶段。';

        setTaskSessions((prev) => {
          const base = (prev[taskId] || []).map((m) =>
            m.awaitingConfirmation ? { ...m, awaitingConfirmation: false } : m,
          );
          const execTurn: TaskSessionMessage = {
            id: `tsm_exec_${Date.now()}`,
            taskId,
            sender: 'agent',
            agentId: runningAssigneeId,
            agentHandle: runningAssigneeHandle,
            workflowStage: 'development',
            content: `${result.deliverableSummary}\n\n本轮自动执行已完成，产物已沉淀至工作区。${handoffSuffix}`,
            timestamp: ts,
            artifactPath: result.deliverableArtifact,
            suggestedActions: handedOffToVerifier
              ? undefined
              : ['补充高并发边界单测后再定稿', '验收通过并归档任务'],
            awaitingConfirmation: !handedOffToVerifier,
            milestoneSynced: true,
          };
          const extraTurns: TaskSessionMessage[] = [execTurn];
          if (handedOffToVerifier && verifierAgent) {
            extraTurns.push({
              id: `tsm_exec_ho_${Date.now() + 1}`,
              taskId,
              sender: 'system',
              workflowStage: 'testing',
              handoff: {
                fromStage: 'development',
                toStage: 'testing',
                fromAgentId: runningAssigneeId,
                toAgentId: verifierAgent.id,
              },
              content: `执行阶段已完成，交棒给 ${formatAgentDisplayName(
                verifierAgent.handle,
                verifierAgent.runtimeAgent,
                verifierAgent.defaultModel,
              )} 进入验收阶段`,
              timestamp: ts,
            });
            extraTurns.push({
              id: `tsm_exec_ver_${Date.now() + 2}`,
              taskId,
              sender: 'agent',
              agentId: verifierAgent.id,
              agentHandle: verifierAgent.handle,
              workflowStage: 'testing',
              content: `已接棒「${task.title}」产物（${result.deliverableArtifact}）并完成初步扫描，请确认是否直接验收通过，或补充特定边界检查。`,
              timestamp: ts,
              suggestedActions: ['验收通过并归档任务', '补充高并发边界审查后再放行'],
              awaitingConfirmation: true,
            });
          }
          return {
            ...prev,
            [taskId]: [...base, ...extraTurns],
          };
        });

        setAuditLogs((prev) => [
          {
            id: `aud_exec_${Date.now()}`,
            category: 'audit',
            title: `新交付物待验证：${task.title}`,
            detail: `${taskWorkspace.name} · ${runningAssigneeHandle} 已提交产物 ${result.deliverableArtifact}${
              handedOffToVerifier ? `，并自动交接给 ${finalAssigneeHandle}` : ''
            }。`,
            severity: 'warning',
            timestamp: ts,
          },
          ...prev,
        ]);

        setAllMessages((prev) => [
          ...prev,
          {
            id: `msg_exec_${Date.now()}`,
            sessionId: task.sessionId,
            senderType: 'agent',
            senderId: execAgent?.id || 'butler',
            senderName: execAgent?.name || 'Nexa 助理',
            senderHandle: execAgent?.handle || runningAssigneeHandle,
            content: `${result.chatBroadcast}（产物已归档至 Artifacts：${result.deliverableArtifact}；${handoffSuffix}）`,
            timestamp: ts,
            linkedTaskIds: [taskId],
          },
        ]);
      } catch (err) {
        setAiError(err instanceof Error ? err.message : '专家自主执行任务失败');
        setAllTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: 'pending' } : t)),
        );
      } finally {
        setExecutingTaskId(null);
      }
    },
    [
      activeWorkspace,
      agents,
      allTasks,
      projectAgentAssignments,
      upsertTaskDeliverableArtifact,
      workspaces,
    ],
  );

  const jumpToChatWithMention = useCallback((handle: string, projectId?: string) => {
    const targetProj = projectId || activeSessionId;
    setActiveSessionId(targetProj);
    setActiveChatChannel({ type: 'group', projectId: targetProj });
    setActiveView('chat');
    setChatDraftSeed(`${handle} `);
  }, [activeSessionId]);

  const jumpToMarketWithCategory = useCallback((category: 'all' | AgentCategory) => {
    setMarketCategorySeed(category);
    setActiveCommunityTab('service_agents');
    setActiveView('community');
  }, []);

  const jumpToMountPrivateAgent = useCallback(() => {
    setActiveView('team');
    setOpenMountDrawerSignal((n) => n + 1);
  }, []);

  const openZoneProjectsCount = useMemo(
    () => zoneProjects.filter((p) => p.direction === 'recruiting' && p.status === 'open').length,
    [zoneProjects],
  );

  const awaitingTaskSessionCount = useMemo(
    () =>
      allTasks.filter((t) => {
        if (t.status === 'done') return false;
        const msgs = taskSessions[t.id] || [];
        const last = msgs[msgs.length - 1];
        return Boolean(last?.awaitingConfirmation) || t.status === 'review';
      }).length,
    [allTasks, taskSessions],
  );

  const toggleFollowEntity = useCallback((entityKey: string) => {
    setFollowedEntityKeys((prev) =>
      prev.includes(entityKey) ? prev.filter((k) => k !== entityKey) : [entityKey, ...prev],
    );
  }, []);

  const leaseAgent = useCallback(
    (
      agentId: string,
      period: LeasePeriod,
      targetWorkspaceId?: string,
      firewallPolicy?: Partial<AgentSliceFirewallPolicy>,
    ) => {
      const target = agents.find((a) => a.id === agentId);
      if (!target) return;
      const workspaceId = targetWorkspaceId || activeWorkspace.id;
      const targetProj = workspaces.find((w) => w.id === workspaceId) || activeWorkspace;
      if (isWorkspaceReadOnly(targetProj)) return;

      const pricing = getAgentLeasePricing({
        runtimeAgent: target.runtimeAgent,
        defaultModel: target.defaultModel,
        capabilityTier: target.performance.capabilityTier,
        ownership: target.ownership,
        projectPriceUsd: target.projectPriceUsd,
        monthlyLeaseUsd: target.monthlyLeaseUsd,
      });
      const priceUsd = pricing.getPriceForPeriod(period);
      const periodMeta = LEASE_PERIOD_META[period];
      const ts = nowTimeStr();
      const alreadyInProj = targetProj.hiredAgentIds.includes(agentId);

      setAgentLeases((prev) => {
        const prevPolicy = prev[agentId]?.firewallPolicy;
        const mergedPolicy: AgentSliceFirewallPolicy = {
          workspaceScopedOnly:
            firewallPolicy?.workspaceScopedOnly ?? prevPolicy?.workspaceScopedOnly ?? true,
          networkPolicy: firewallPolicy?.networkPolicy ?? prevPolicy?.networkPolicy ?? 'allowlist',
          requireApprovalForWrite:
            firewallPolicy?.requireApprovalForWrite ?? prevPolicy?.requireApprovalForWrite ?? true,
          slicePaused: firewallPolicy?.slicePaused ?? false,
        };
        return {
          ...prev,
          [agentId]: {
            agentId,
            period,
            priceUsd,
            startedAt: '刚刚',
            expiresLabel: `${periodMeta.shortLabel} · 剩余 ${periodMeta.days} 天`,
            targetWorkspaceId: targetProj.id,
            autoRenew: true,
            firewallPolicy: mergedPolicy,
          },
        };
      });

      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === targetProj.id
            ? {
                ...w,
                hiredAgentIds: alreadyInProj ? w.hiredAgentIds : [...w.hiredAgentIds, agentId],
                spentUsd: w.spentUsd + priceUsd,
              }
            : w,
        ),
      );

      // Record lease payment into the unified settlement ledger so spentUsd & settlements always reconcile
      if (priceUsd > 0) {
        setSettlements((prev) => [
          {
            id: `stl_lease_${Date.now().toString().slice(-4)}`,
            projectId: targetProj.id,
            projectName: targetProj.name,
            agentHandle: target.handle,
            milestoneLabel: `${alreadyInProj ? '续租' : '周期租用'}（${periodMeta.label} · ${periodMeta.days}天）`,
            amountUsd: priceUsd,
            status: 'settled',
            createdAt: ts,
            settledAt: ts,
          },
          ...prev,
        ]);
      }

      // Sync leased expert into Task Orchestration (single source of truth)
      const existingAssignments = projectAgentAssignments[targetProj.id] || [];
      if (!existingAssignments.some((a) => a.agentId === agentId)) {
        const stages = getDefaultStagesForAgentCategory(target.category);
        const nextAssignments: ProjectAgentAssignment[] = [
          ...existingAssignments,
          {
            agentId,
            stages,
            roleNote: target.title,
            handoffMode: stages.includes('development') ? 'auto' : 'manual',
          },
        ];
        setProjectAgentAssignments((prev) => ({
          ...prev,
          [targetProj.id]: nextAssignments,
        }));
        setProjectPipelines((prev) => ({
          ...prev,
          [targetProj.id]: syncSlotsFromAssignments(nextAssignments, prev[targetProj.id]),
        }));
      }

      setAllMessages((prev) => [
        ...prev,
        {
          id: `msg_lease_${Date.now()}`,
          sessionId: targetProj.id,
          senderType: 'system',
          senderId: 'system',
          senderName: '系统协同同步',
          senderHandle: '系统通知',
          content: `已按${periodMeta.label}（${formatUsd(priceUsd)}${periodMeta.unitSuffix}）${
            alreadyInProj ? '续租' : '租赁'
          } ${target.handle} 并同步至项目群「${targetProj.name}」与「任务编排」（已入账结算台账）。`,
          timestamp: ts,
        },
      ]);

      setAuditLogs((prev) => [
        {
          id: `aud_lease_${Date.now()}`,
          category: 'order',
          title: `已${alreadyInProj ? '续租' : '租赁'}专家 Agent 隔离切片：${target.handle}（${periodMeta.label}）`,
          detail: `租期费用 ${formatUsd(priceUsd)}${periodMeta.unitSuffix}，已开启安全防火墙并派驻项目「${targetProj.name}」（零账号交易，已记入结算台账）。`,
          severity: 'success',
          timestamp: ts,
        },
        ...prev,
      ]);
    },
    [activeWorkspace, agents, projectAgentAssignments, workspaces],
  );

  const updateAgentSliceFirewall = useCallback(
    (agentId: string, patch: Partial<AgentSliceFirewallPolicy>) => {
      const target = agents.find((a) => a.id === agentId);
      const ts = nowTimeStr();
      setAgentLeases((prev) => {
        const existing = prev[agentId];
        const prevPolicy: AgentSliceFirewallPolicy = existing?.firewallPolicy || {
          workspaceScopedOnly: true,
          networkPolicy: 'allowlist',
          requireApprovalForWrite: true,
          slicePaused: false,
        };
        const nextPolicy: AgentSliceFirewallPolicy = {
          ...prevPolicy,
          ...patch,
        };
        const baseRecord: AgentLeaseRecord = existing || {
          agentId,
          period: 'month',
          priceUsd: target?.monthlyLeaseUsd || 199,
          startedAt: '已生效',
          expiresLabel: '按月切片 · 隔离运行中',
        };
        return {
          ...prev,
          [agentId]: {
            ...baseRecord,
            firewallPolicy: nextPolicy,
          },
        };
      });

      if (target) {
        const stateSummary =
          patch.slicePaused !== undefined
            ? patch.slicePaused
              ? '已熔断暂停隔离切片，阻断所有工具与会话调用'
              : '已恢复隔离切片运行'
            : '已更新租户隔离防火墙与权限边界策略';
        setAuditLogs((prev) => [
          {
            id: `aud_fw_${Date.now()}`,
            category: 'audit',
            title: `切片防火墙变更：${target.handle}`,
            detail: stateSummary,
            severity: patch.slicePaused ? 'warning' : 'info',
            timestamp: ts,
          },
          ...prev,
        ]);
      }
    },
    [agents],
  );

  const acquireSkill = useCallback(
    (skillId: string, skillName?: string, priceUsd = 0, sourceZoneId?: string) => {
      const alreadyOwned = purchasedSkillIds.includes(skillId);
      const targetSkill = marketSkills.find((s) => s.id === skillId);
      const effectiveName = skillName || targetSkill?.name || skillId;
      const sourceZone = sourceZoneId ? zones.find((z) => z.id === sourceZoneId) : undefined;
      const isCommunityDistribution =
        targetSkill?.origin === 'platform' &&
        Boolean(sourceZone && !sourceZone.isPlatformDefault);
      const sharePct = targetSkill?.distributionSharePct ?? 20;

      setPurchasedSkillIds((prev) => (prev.includes(skillId) ? prev : [skillId, ...prev]));
      if (!alreadyOwned) {
        setMarketSkills((prev) =>
          prev.map((s) => (s.id === skillId ? { ...s, installs: s.installs + 1 } : s)),
        );
      }

      const ts = nowTimeStr();
      if (!alreadyOwned && priceUsd > 0) {
        const milestoneLabel = isCommunityDistribution
          ? `平台官方 Skill/MCP 买断（${sourceZone?.name}分销 · 分润 ${sharePct}%）`
          : targetSkill?.origin === 'platform'
            ? '平台官方 Skill / MCP 永久买断'
            : '社区 Skill / MCP 永久买断授权';
        setSettlements((prev) => [
          {
            id: `stl_skill_${Date.now().toString().slice(-4)}`,
            projectId: activeWorkspace.id,
            projectName: 'AGN 空间资产库',
            agentHandle: `Skill · ${effectiveName}`,
            milestoneLabel,
            amountUsd: Math.round(priceUsd),
            status: 'settled',
            createdAt: ts,
          },
          ...prev,
        ]);
      }

      setAuditLogs((prev) => [
        {
          id: `aud_skill_buy_${Date.now()}`,
          category: 'order',
          title:
            priceUsd > 0
              ? `已买断 Skill/MCP：${effectiveName}（${formatUsd(priceUsd)}）`
              : `已免费获取 Skill/MCP：${effectiveName}`,
          detail: isCommunityDistribution
            ? `通过「${sourceZone?.name}」社区分销渠道购入平台官方资产（社区分润 ${sharePct}%），已入库「AGN空间 → 空间资源 → Skills / MCP」，可直接装配给自建 Agent。`
            : priceUsd > 0
              ? '一次性买断永久授权已入库「AGN空间 → 空间资源 → Skills / MCP」并记入结算台账，可在任意自建 Agent 中无限次装配。'
              : '已加入「AGN空间 → 空间资源 → Skills / MCP」，可直接勾选装配至自建 Agent 成员。',
          severity: 'success',
          timestamp: ts,
        },
        ...prev,
      ]);
    },
    [activeWorkspace.id, marketSkills, purchasedSkillIds, zones],
  );

  const createSpaceSkill = useCallback(
    (input: {
      name: string;
      summary: string;
      kind: SkillKind;
      category: AgentCategory;
      priceUsd?: number;
      compatibleRuntimes?: string[];
      zoneIds?: string[];
      bindAgentIds?: string[];
    }) => {
      const cleanedName = input.name.trim();
      if (!cleanedName) return '';
      const id = `skill_custom_${Date.now().toString().slice(-6)}`;
      const slugBase =
        cleanedName
          .toLowerCase()
          .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 26) || 'team-skill';
      const prefix =
        input.kind === 'mcp' ? 'mcp' : input.kind === 'workflow' ? 'workflow' : 'team-skill';
      const slug = `${prefix}/${slugBase}`;
      const price = Math.max(0, Math.round(input.priceUsd ?? 0));
      const targetZones = Array.from(new Set(input.zoneIds || []));
      const author = account ? account.name : '林致远（我）';
      const runtimes =
        input.compatibleRuntimes && input.compatibleRuntimes.length > 0
          ? input.compatibleRuntimes
          : ['Claude Code', 'Codex', 'Cursor', 'Gemini CLI'];

      const newSkill: MarketSkill = {
        id,
        slug,
        name: cleanedName,
        summary:
          input.summary.trim() ||
          '团队在 AGN空间自建封装的专属能力包，可在 Agent 成员管理中按需加载，并按需分发至 Agent 社区。',
        category: input.category,
        kind: input.kind,
        origin: 'custom',
        isPrivate: targetZones.length === 0,
        compatibleRuntimes: runtimes,
        authorName: author,
        version: 'v1.0.0',
        installs: Math.max(1, (input.bindAgentIds || []).length),
        rating: 5.0,
        ratingTier: 'A+',
        priceUsd: price,
        license: price === 0 ? '免费开源' : '付费买断',
        zoneIds: targetZones,
        installCommand:
          input.kind === 'mcp' ? `anx mcp install ${slug}` : `anx skill add ${slug}`,
        highlights: [
          input.summary.trim() || '团队自建标准化能力规范与工具封装',
          targetZones.length > 0
            ? `已同步分发至 ${targetZones.length} 个 Agent 社区服务市场`
            : '当前仅限 AGN空间内部私有使用，随时可一键上架至 Agent 社区',
        ],
        readmeSnippet: `---\nname: ${slugBase}\nkind: ${input.kind}\norigin: custom\n---\n${input.summary.trim() || cleanedName}`,
      };

      setMarketSkills((prev) => [newSkill, ...prev]);
      setPurchasedSkillIds((prev) => (prev.includes(id) ? prev : [id, ...prev]));

      const bindIds = Array.from(new Set(input.bindAgentIds || []));
      if (bindIds.length > 0) {
        setAgents((prev) =>
          prev.map((ag) => {
            if (!bindIds.includes(ag.id) || ag.ownership !== 'private') return ag;
            const nextInstalled = Array.from(new Set([...(ag.installedSkillIds || []), id]));
            const nextSkills =
              input.kind === 'mcp'
                ? ag.skills
                : Array.from(new Set([...ag.skills, cleanedName]));
            const nextMcps =
              input.kind === 'mcp'
                ? Array.from(new Set([...ag.mcpTools, cleanedName]))
                : ag.mcpTools;
            return {
              ...ag,
              installedSkillIds: nextInstalled,
              skills: nextSkills,
              mcpTools: nextMcps,
            };
          }),
        );
      }

      const ts = nowTimeStr();
      setAuditLogs((prev) => [
        {
          id: `aud_space_skill_${Date.now()}`,
          category: 'audit',
          title: `新建空间自建 ${input.kind === 'mcp' ? 'MCP' : 'Skill'}：${cleanedName}`,
          detail: `${
            bindIds.length > 0 ? `已立即装配至 ${bindIds.length} 位自建 Agent；` : ''
          }${
            targetZones.length > 0
              ? `已同步上架分发至 ${targetZones.length} 个 Agent 社区。`
              : '当前设为空间私有资产。'
          }`,
          severity: 'success',
          timestamp: ts,
        },
        ...prev,
      ]);

      return id;
    },
    [account],
  );

  const toggleAgentSkillBinding = useCallback(
    (agentId: string, skillId: string) => {
      const skill = marketSkills.find((s) => s.id === skillId);
      const agent = agents.find((a) => a.id === agentId);
      if (!skill || !agent || agent.ownership !== 'private') return;

      const currentlyBound = (agent.installedSkillIds || []).includes(skillId);
      setAgents((prev) =>
        prev.map((ag) => {
          if (ag.id !== agentId) return ag;
          const prevIds = ag.installedSkillIds || [];
          const nextIds = currentlyBound
            ? prevIds.filter((id) => id !== skillId)
            : Array.from(new Set([...prevIds, skillId]));
          const nextSkills =
            skill.kind === 'mcp'
              ? ag.skills
              : currentlyBound
                ? ag.skills.filter((s) => s !== skill.name)
                : Array.from(new Set([...ag.skills, skill.name]));
          const nextMcps =
            skill.kind === 'mcp'
              ? currentlyBound
                ? ag.mcpTools.filter((m) => m !== skill.name)
                : Array.from(new Set([...ag.mcpTools, skill.name]))
              : ag.mcpTools;
          return {
            ...ag,
            installedSkillIds: nextIds,
            skills: nextSkills.length > 0 ? nextSkills : ag.skills,
            mcpTools: nextMcps.length > 0 ? nextMcps : ag.mcpTools,
          };
        }),
      );
    },
    [agents, marketSkills],
  );

  const toggleZoneSkillDistribution = useCallback(
    (zoneId: string, skillId: string) => {
      const zone = zones.find((z) => z.id === zoneId);
      const skill = marketSkills.find((s) => s.id === skillId);
      if (!zone || !skill) return;

      const isCurrentlyListed = skill.zoneIds.includes(zoneId);
      const nextZoneIds = isCurrentlyListed
        ? skill.zoneIds.filter((id) => id !== zoneId)
        : Array.from(new Set([...skill.zoneIds, zoneId]));

      setMarketSkills((prev) =>
        prev.map((s) =>
          s.id === skillId
            ? {
                ...s,
                zoneIds: nextZoneIds,
                isPrivate: s.origin === 'custom' ? nextZoneIds.length === 0 : s.isPrivate,
              }
            : s,
        ),
      );

      const ts = nowTimeStr();
      const isPlatform = skill.origin === 'platform';
      setAuditLogs((prev) => [
        {
          id: `aud_skill_dist_${Date.now()}`,
          category: 'audit',
          title: isCurrentlyListed
            ? `已从「${zone.name}」下架 ${skill.name}`
            : isPlatform
              ? `已引入平台官方资产分销至「${zone.name}」：${skill.name}`
              : `已将自建 Skill/MCP 分发至「${zone.name}」：${skill.name}`,
          detail: isCurrentlyListed
            ? '该 Skill / MCP 已停止在当前社区服务市场展示。'
            : isPlatform
              ? `社区成员可在「${zone.name} → 服务市场」直接购买/获取，平台与社区按 ${skill.distributionSharePct ?? 20}% 分润结算。`
              : `已同步上架「${zone.name} → 服务市场」，供社区成员获取与装配。`,
          severity: 'info',
          timestamp: ts,
        },
        ...prev,
      ]);
    },
    [marketSkills, zones],
  );

  const inviteTeamExpert = useCallback(
    (input: {
      expertId: string;
      relation: ExpertRelationType;
      targetWorkspaceId?: string;
      sourceZoneId?: string;
      outsourcingScope?: string;
    }) => {
      const expert = humanExperts.find((h) => h.id === input.expertId);
      if (!expert) return;
      const ts = nowTimeStr();
      const targetProj = input.targetWorkspaceId
        ? workspaces.find((w) => w.id === input.targetWorkspaceId)
        : undefined;

      setTeamExperts((prev) => {
        const existing = prev.find((m) => m.expertId === input.expertId);
        if (existing) {
          const nextWorkspaceIds = targetProj
            ? Array.from(new Set([...existing.assignedWorkspaceIds, targetProj.id]))
            : existing.assignedWorkspaceIds;
          return prev.map((m) =>
            m.expertId === input.expertId
              ? {
                  ...m,
                  relation: input.relation,
                  assignedWorkspaceIds: nextWorkspaceIds,
                  outsourcingScope: input.outsourcingScope || m.outsourcingScope,
                }
              : m,
          );
        }
        return [
          {
            expertId: input.expertId,
            relation: input.relation,
            sourceZoneId: input.sourceZoneId || expert.zoneIds[0] || activeZone.id,
            assignedWorkspaceIds: targetProj ? [targetProj.id] : [],
            outsourcingScope:
              input.outsourcingScope || expert.outsourcingDomain || expert.specialties[0] || '',
            joinedAt: '刚刚',
            status: 'active',
          },
          ...prev,
        ];
      });

      if (input.relation === 'mutual_friend') {
        const followKey = `human:${expert.name}`;
        setFollowedEntityKeys((prev) => (prev.includes(followKey) ? prev : [...prev, followKey]));
      }

      if (targetProj) {
        setWorkspaces((prev) =>
          prev.map((w) =>
            w.id === targetProj.id
              ? {
                  ...w,
                  hiredExpertIds: Array.from(new Set([...(w.hiredExpertIds || []), input.expertId])),
                }
              : w,
          ),
        );
      }

      const sourceZoneName =
        zones.find((z) => z.id === (input.sourceZoneId || expert.zoneIds[0] || activeZone.id))
          ?.name || '中文 AI 社区';

      setAuditLogs((prev) => [
        {
          id: `aud_exp_inv_${Date.now()}`,
          category: 'order',
          title: `已将 ${expert.name} 加入专家团队（${input.relation === 'mutual_friend' ? '互关好友' : '项目合作'}）`,
          detail: targetProj
            ? `来源空间：${sourceZoneName}；已同步派驻项目「${targetProj.name}」。`
            : `来源空间：${sourceZoneName}；已加入 AGN 专家团队，可随时派驻项目。`,
          severity: 'success',
          timestamp: ts,
        },
        ...prev,
      ]);
    },
    [activeZone.id, humanExperts, workspaces, zones],
  );

  const assignExpertToWorkspace = useCallback(
    (expertId: string, workspaceId: string) => {
      const expert = humanExperts.find((h) => h.id === expertId);
      const proj = workspaces.find((w) => w.id === workspaceId);
      if (!expert || !proj) return;

      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === workspaceId
            ? {
                ...w,
                hiredExpertIds: Array.from(new Set([...(w.hiredExpertIds || []), expertId])),
              }
            : w,
        ),
      );

      setTeamExperts((prev) => {
        const exists = prev.some((m) => m.expertId === expertId);
        if (exists) {
          return prev.map((m) =>
            m.expertId === expertId
              ? {
                  ...m,
                  assignedWorkspaceIds: Array.from(new Set([...m.assignedWorkspaceIds, workspaceId])),
                }
              : m,
          );
        }
        return [
          {
            expertId,
            relation: 'project_collab',
            sourceZoneId: expert.zoneIds[0] || activeZone.id,
            assignedWorkspaceIds: [workspaceId],
            outsourcingScope: expert.outsourcingDomain || expert.specialties[0] || '',
            joinedAt: '刚刚',
            status: 'active',
          },
          ...prev,
        ];
      });
    },
    [activeZone.id, humanExperts, workspaces],
  );

  const removeExpertFromWorkspace = useCallback((expertId: string, workspaceId: string) => {
    setWorkspaces((prev) =>
      prev.map((w) =>
        w.id === workspaceId
          ? {
              ...w,
              hiredExpertIds: (w.hiredExpertIds || []).filter((id) => id !== expertId),
            }
          : w,
      ),
    );
    setTeamExperts((prev) =>
      prev.map((m) =>
        m.expertId === expertId
          ? {
              ...m,
              assignedWorkspaceIds: m.assignedWorkspaceIds.filter((id) => id !== workspaceId),
            }
          : m,
      ),
    );
  }, []);

  const updateTeamExpertRelation = useCallback(
    (expertId: string, relation: ExpertRelationType) => {
      setTeamExperts((prev) =>
        prev.map((m) => (m.expertId === expertId ? { ...m, relation } : m)),
      );
    },
    [],
  );

  const removeTeamExpert = useCallback((expertId: string) => {
    setTeamExperts((prev) => prev.filter((m) => m.expertId !== expertId));
    setWorkspaces((prev) =>
      prev.map((w) => ({
        ...w,
        hiredExpertIds: (w.hiredExpertIds || []).filter((id) => id !== expertId),
      })),
    );
  }, []);

  // ================= DEDICATED SPACE (OS NODES, CLOUD STORAGE, CLI AGENTS) =================
  const mountPrivateNode = useCallback(
    (input: {
      name: string;
      os: NodeOsType;
      osVersion: string;
      region: string;
      cpuCores: number;
      memoryGb: number;
      storageQuotaGb: number;
      description: string;
    }) => {
      const cleaned = input.name.trim();
      if (!cleaned) return '';
      const id = `node_priv_${Date.now().toString().slice(-5)}`;
      const slug = id.replace('node_priv_', '');
      const newNode: ComputeNode = {
        id,
        name: cleaned,
        os: input.os,
        osVersion: input.osVersion,
        origin: 'private',
        region: input.region.trim() || '自有设备',
        cpuCores: Math.max(2, Math.round(input.cpuCores || 8)),
        memoryGb: Math.max(4, Math.round(input.memoryGb || 16)),
        storageQuotaGb: Math.max(50, Math.round(input.storageQuotaGb || 256)),
        storageUsedGb: 12,
        status: 'online',
        endpoint: `tunnel://${input.os}-${slug}.local`,
        monthlyCostUsd: 0,
        mountedAt: '刚刚挂载',
        description:
          input.description.trim() ||
          `挂载的自有 ${input.osVersion} 设备，可在「Agent 配置」安装 Claude Code / Antigravity / Codex 等 CLI 并挂载共享存储。`,
        installedClis: [],
        mountedStorageIds: [],
      };
      setComputeNodes((prev) => [newNode, ...prev]);
      setAuditLogs((prev) => [
        {
          id: `aud_node_${Date.now()}`,
          category: 'audit',
          title: `挂载自有设备节点「${newNode.name}」`,
          detail: `${newNode.osVersion} · ${newNode.cpuCores}C / ${newNode.memoryGb}GB · 零月租费用`,
          severity: 'success',
          timestamp: nowTimeStr(),
        },
        ...prev,
      ]);
      return id;
    },
    [],
  );

  const provisionCloudNode = useCallback(
    (input: {
      name: string;
      os: NodeOsType;
      osVersion: string;
      region: string;
      cpuCores: number;
      memoryGb: number;
      gpuSpec?: string;
      storageQuotaGb: number;
      monthlyCostUsd: number;
      yearlyCostUsd?: number;
      leaseBillingCycle?: NodeLeaseBillingCycle;
      description: string;
    }) => {
      const cleaned = input.name.trim();
      if (!cleaned) return '';
      const id = `node_cloud_${Date.now().toString().slice(-5)}`;
      const slug = id.replace('node_cloud_', '');
      const monthly = Math.max(0, Math.round(input.monthlyCostUsd || 59));
      const yearly = Math.max(0, Math.round(input.yearlyCostUsd ?? monthly * 10));
      const cycle: NodeLeaseBillingCycle = input.leaseBillingCycle || 'monthly';
      const newNode: ComputeNode = {
        id,
        name: cleaned,
        os: input.os,
        osVersion: input.osVersion,
        origin: 'cloud',
        region: input.region.trim() || '华东-上海云区',
        cpuCores: Math.max(4, Math.round(input.cpuCores || 8)),
        memoryGb: Math.max(8, Math.round(input.memoryGb || 32)),
        gpuSpec: input.gpuSpec?.trim() || undefined,
        storageQuotaGb: Math.max(100, Math.round(input.storageQuotaGb || 256)),
        storageUsedGb: 16,
        status: 'online',
        endpoint: `cloud://${input.os}-${slug}.agentnexus.io`,
        monthlyCostUsd: monthly,
        yearlyCostUsd: yearly,
        leaseBillingCycle: cycle,
        mountedAt: cycle === 'yearly' ? '刚刚按年租用' : '刚刚按月租用',
        description:
          input.description.trim() ||
          `云端租用的 7×24 在线 ${input.osVersion} 裸机节点，可在列表配置多路 Agent CLI 与并发沙箱。`,
        installedClis: [],
        mountedStorageIds: [],
      };
      setComputeNodes((prev) => [newNode, ...prev]);
      setAuditLogs((prev) => [
        {
          id: `aud_cloud_${Date.now()}`,
          category: 'settlement',
          title: `${cycle === 'yearly' ? '按年' : '按月'}租用云端节点「${newNode.name}」`,
          detail: `${newNode.osVersion} · ${newNode.region} · ${newNode.cpuCores}C/${newNode.memoryGb}GB · ${
            cycle === 'yearly' ? `$${yearly}/年` : `$${monthly}/月`
          }`,
          severity: 'success',
          timestamp: nowTimeStr(),
        },
        ...prev,
      ]);
      return id;
    },
    [],
  );

  const toggleNodeStatus = useCallback((nodeId: string) => {
    setComputeNodes((prev) =>
      prev.map((n) =>
        n.id === nodeId
          ? { ...n, status: n.status === 'online' ? 'standby' : 'online' }
          : n,
      ),
    );
  }, []);

  const removeComputeNode = useCallback((nodeId: string) => {
    setComputeNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setAgents((prev) =>
      prev.map((a) =>
        a.hostNodeId === nodeId ? { ...a, hostNodeId: undefined, hostCliId: undefined } : a,
      ),
    );
    setStorageVolumes((prev) =>
      prev.map((v) => ({
        ...v,
        boundNodeIds: v.boundNodeIds.filter((id) => id !== nodeId),
      })),
    );
    setWorkspaces((prev) =>
      prev.map((w) => ({
        ...w,
        boundNodeIds: (w.boundNodeIds || []).filter((id) => id !== nodeId),
      })),
    );
  }, []);

  const createStorageVolume = useCallback(
    (input: {
      name: string;
      tierLabel: string;
      region: string;
      quotaGb: number;
      billingMode: StorageBillingMode;
      priceUsd: number;
      encrypted: boolean;
      boundNodeIds: string[];
      boundProjectIds: string[];
    }) => {
      const cleaned = input.name.trim();
      if (!cleaned) return '';
      const id = `vol_${Date.now().toString().slice(-5)}`;
      const newVol: StorageVolume = {
        id,
        name: cleaned,
        tierLabel: input.tierLabel,
        region: input.region || '华东-上海多可用区',
        quotaGb: Math.max(50, Math.round(input.quotaGb || 200)),
        usedGb: 2,
        billingMode: input.billingMode,
        priceUsd: Math.max(0, Math.round(input.priceUsd)),
        encrypted: input.encrypted,
        mountPath: `cloud://space-storage/${id}`,
        boundNodeIds: input.boundNodeIds,
        boundProjectIds: input.boundProjectIds,
        updatedAt: '刚刚开通',
      };
      setStorageVolumes((prev) => [newVol, ...prev]);
      if (input.boundNodeIds.length > 0) {
        setComputeNodes((prev) =>
          prev.map((n) =>
            input.boundNodeIds.includes(n.id)
              ? {
                  ...n,
                  mountedStorageIds: Array.from(new Set([...n.mountedStorageIds, id])),
                }
              : n,
          ),
        );
      }
      setAuditLogs((prev) => [
        {
          id: `aud_vol_${Date.now()}`,
          category: 'settlement',
          title: `${input.billingMode === 'permanent' ? '购买永久云存储' : '租用云存储'}「${newVol.name}」`,
          detail: `${newVol.quotaGb}GB · ${
            newVol.billingMode === 'permanent'
              ? `$${newVol.priceUsd} 永久买断`
              : `$${newVol.priceUsd}/月`
          } · 供多 Agent 共同读写`,
          severity: 'success',
          timestamp: nowTimeStr(),
        },
        ...prev,
      ]);
      return id;
    },
    [],
  );

  const expandStorageVolume = useCallback((volumeId: string, addGb: number) => {
    setStorageVolumes((prev) =>
      prev.map((v) =>
        v.id === volumeId
          ? { ...v, quotaGb: v.quotaGb + Math.max(50, addGb), updatedAt: '刚刚扩容' }
          : v,
      ),
    );
  }, []);

  const addNodeCli = useCallback(
    (
      nodeId: string,
      input: {
        cliTool: CliToolType;
        runtimeAgent: string;
        authMode: CliAuthMode;
        credentialLabel: string;
        concurrency: number;
      },
    ) => {
      const node = computeNodes.find((n) => n.id === nodeId);
      if (!node) return '';
      const cliVersionMap: Record<CliToolType, string> = {
        claude_code: 'v1.4.2',
        antigravity: 'v2.1.0',
        codex: 'v0.38.0',
        gemini_cli: 'v0.9.4',
        qoder: 'v1.2.0',
      };
      const id = `cli_${Date.now().toString().slice(-5)}`;
      const cleanCred = input.credentialLabel.trim();
      const entry: NodeCliEntry = {
        id,
        cliTool: input.cliTool,
        runtimeAgent: input.runtimeAgent,
        cliVersion: cliVersionMap[input.cliTool] || 'v1.0.0',
        authMode: input.authMode,
        credentialLabel:
          cleanCred ||
          (input.authMode === 'account_oauth' ? 'ronnie.shi@workspace.io' : 'sk-cli-••••••9a1f'),
        authStatus: 'connected',
        concurrency: Math.min(16, Math.max(1, Math.round(input.concurrency || 2))),
        enabled: true,
      };
      setComputeNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId ? { ...n, installedClis: [...n.installedClis, entry] } : n,
        ),
      );
      setAuditLogs((prev) => [
        {
          id: `aud_cli_add_${Date.now()}`,
          category: 'audit',
          title: `节点「${node.name}」新增 ${entry.runtimeAgent} CLI`,
          detail: `${entry.concurrency} 路并发 · ${
            entry.authMode === 'account_oauth' ? '账号登录' : 'API Key'
          }（模型由各 Agent 专家独立指定）`,
          severity: 'success',
          timestamp: nowTimeStr(),
        },
        ...prev,
      ]);
      return id;
    },
    [computeNodes],
  );

  const updateNodeCli = useCallback(
    (nodeId: string, cliId: string, patch: Partial<Omit<NodeCliEntry, 'id'>>) => {
      setComputeNodes((prev) =>
        prev.map((n) => {
          if (n.id !== nodeId) return n;
          return {
            ...n,
            installedClis: n.installedClis.map((cli) =>
              cli.id === cliId
                ? {
                    ...cli,
                    ...patch,
                    concurrency:
                      patch.concurrency !== undefined
                        ? Math.min(16, Math.max(1, Math.round(patch.concurrency)))
                        : cli.concurrency,
                  }
                : cli,
            ),
          };
        }),
      );
      // Sync CLI auth & concurrency only; each Expert Agent keeps its own independent model choice
      setAgents((prev) =>
        prev.map((ag) => {
          if (ag.hostCliId !== cliId) return ag;
          const nextConcurrency =
            patch.concurrency !== undefined
              ? Math.min(16, Math.max(1, Math.round(patch.concurrency)))
              : ag.cliConfig?.concurrency;
          return {
            ...ag,
            cliConfig: ag.cliConfig
              ? {
                  ...ag.cliConfig,
                  authMode: patch.authMode ?? ag.cliConfig.authMode,
                  credentialLabel: patch.credentialLabel ?? ag.cliConfig.credentialLabel,
                  concurrency: nextConcurrency ?? ag.cliConfig.concurrency,
                }
              : ag.cliConfig,
          };
        }),
      );
    },
    [],
  );

  const removeNodeCli = useCallback((nodeId: string, cliId: string) => {
    setComputeNodes((prev) =>
      prev.map((n) =>
        n.id === nodeId
          ? { ...n, installedClis: n.installedClis.filter((c) => c.id !== cliId) }
          : n,
      ),
    );
    setAgents((prev) =>
      prev.map((ag) => (ag.hostCliId === cliId ? { ...ag, hostCliId: undefined } : ag)),
    );
  }, []);

  const toggleNodeStorageMount = useCallback((nodeId: string, volumeId: string) => {
    let mountedNow = false;
    setComputeNodes((prev) =>
      prev.map((n) => {
        if (n.id !== nodeId) return n;
        const exists = n.mountedStorageIds.includes(volumeId);
        mountedNow = !exists;
        return {
          ...n,
          mountedStorageIds: exists
            ? n.mountedStorageIds.filter((id) => id !== volumeId)
            : [...n.mountedStorageIds, volumeId],
        };
      }),
    );
    setStorageVolumes((prev) =>
      prev.map((v) => {
        if (v.id !== volumeId) return v;
        const exists = v.boundNodeIds.includes(nodeId);
        return {
          ...v,
          boundNodeIds: exists
            ? v.boundNodeIds.filter((id) => id !== nodeId)
            : [...v.boundNodeIds, nodeId],
          updatedAt: mountedNow ? '刚刚挂载' : '刚刚卸载',
        };
      }),
    );
  }, []);

  const deployAgentOnNode = useCallback(
    (input: {
      nodeId: string;
      handle: string;
      name: string;
      title: string;
      category: AgentCategory;
      cliTool: CliToolType;
      runtimeAgent: string;
      defaultModel: string;
      authMode: CliAuthMode;
      credentialLabel: string;
      concurrency: number;
      storageVolumeId?: string;
      skills: string[];
      bio: string;
      bindToProjectId?: string;
    }) => {
      const node = computeNodes.find((n) => n.id === input.nodeId);
      const cleanedName = input.name.trim() || input.handle.replace(/^@/, '').trim();
      if (!node || !cleanedName) return '';
      const rawHandle = input.handle.trim() || cleanedName;
      const normalizedHandle = rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`;
      const id = `agent_space_${Date.now().toString().slice(-5)}`;
      const accents = ['#0284c7', '#4f46e5', '#0f766e', '#7c3aed', '#b45309'];
      const accent = accents[agents.length % accents.length];
      const code =
        cleanedName.replace(/[^A-Za-z0-9\u4e00-\u9fa5]/g, '').slice(0, 2).toUpperCase() || 'AG';

      const cliVersionMap: Record<CliToolType, string> = {
        claude_code: 'v1.4.2',
        antigravity: 'v2.1.0',
        codex: 'v0.38.0',
        gemini_cli: 'v0.9.4',
        qoder: 'v1.2.0',
      };

      const cleanCred = input.credentialLabel.trim();
      const newAgent: ExpertAgent = {
        id,
        handle: normalizedHandle,
        name: cleanedName,
        title: input.title.trim() || `${input.runtimeAgent} CLI 节点实例`,
        category: input.category,
        region: node.region,
        nodeTier: node.origin === 'cloud' ? 'official-cloud' : 'idle-peer',
        serviceMode: 'pure-agent',
        ownership: 'private',
        ownerHumanId: 'human_me',
        ownerHumanName: account?.name || '我（个人节点）',
        ownerHumanTitle: '节点负责人',
        listedZoneIds: [],
        isListedInMarket: false,
        runtimeAgent: input.runtimeAgent,
        defaultModel: input.defaultModel,
        engineModel: `${input.runtimeAgent} CLI (${input.defaultModel})`,
        skills: input.skills.length > 0 ? input.skills : ['CLI 自动化编码', '多路并发交付'],
        mcpTools: ['Cloud Work Storage', 'Git CLI'],
        projectPriceUsd: 0,
        bio:
          input.bio.trim() ||
          `配置在「${node.name}」的 ${input.runtimeAgent} CLI 专业 Agent，支持 ${Math.max(
            1,
            input.concurrency,
          )} 路并发并自动调度隔离环境。`,
        avatarAccent: accent,
        avatarCode: code,
        hostNodeId: node.id,
        cliConfig: {
          cliTool: input.cliTool,
          cliVersion: cliVersionMap[input.cliTool] || 'v1.0.0',
          authMode: input.authMode,
          credentialLabel:
            cleanCred ||
            (input.authMode === 'account_oauth' ? 'workspace-pro@account' : 'sk-cli-••••••9a1f'),
          authStatus: 'connected',
          concurrency: Math.min(16, Math.max(1, Math.round(input.concurrency || 2))),
          activeSlots: 0,
          storageVolumeId: input.storageVolumeId || storageVolumes[0]?.id,
        },
        isOnlineForOrders: node.status === 'online',
        performance: {
          completedProjects: 0,
          successRate: 100,
          reputationScore: 95,
          repeatHireRate: 100,
          avgDeliveryDays: 1.0,
          rating: 5.0,
          capabilityTier: 'A 级专业',
          demandStatus: '档期充裕',
          demandNote: `运行于 ${node.name}`,
          pricingBasis: '自有/租用节点 CLI 实例，按自身账号或 Key 配额消耗',
          recentReviews: [],
        },
      };

      setAgents((prev) => [newAgent, ...prev]);
      if (input.bindToProjectId) {
        setWorkspaces((prev) =>
          prev.map((w) =>
            w.id === input.bindToProjectId
              ? {
                  ...w,
                  hiredAgentIds: Array.from(new Set([...w.hiredAgentIds, id])),
                  boundNodeIds: Array.from(new Set([...(w.boundNodeIds || []), node.id])),
                }
              : w,
          ),
        );
      }
      setAuditLogs((prev) => [
        {
          id: `aud_dep_${Date.now()}`,
          category: 'audit',
          title: `配置节点 CLI Agent：${newAgent.handle}`,
          detail: `节点 ${node.name} · ${newAgent.runtimeAgent} CLI · ${
            newAgent.cliConfig?.concurrency || 1
          } 路并发`,
          severity: 'success',
          timestamp: nowTimeStr(),
        },
        ...prev,
      ]);
      return id;
    },
    [account?.name, agents.length, computeNodes, storageVolumes],
  );

  const assignAgentHostNode = useCallback((agentId: string, nodeId: string | undefined) => {
    setAgents((prev) =>
      prev.map((a) => (a.id === agentId ? { ...a, hostNodeId: nodeId } : a)),
    );
  }, []);

  const updateAgentCliConfig = useCallback(
    (agentId: string, patch: Partial<NodeCliConfig>) => {
      setAgents((prev) =>
        prev.map((a) => {
          if (a.id !== agentId) return a;
          const base: NodeCliConfig = a.cliConfig || {
            cliTool:
              a.runtimeAgent === 'Antigravity'
                ? 'antigravity'
                : a.runtimeAgent === 'Codex'
                  ? 'codex'
                  : a.runtimeAgent === 'Gemini CLI'
                    ? 'gemini_cli'
                    : 'claude_code',
            cliVersion: 'v1.4.2',
            authMode: 'account_oauth',
            credentialLabel: 'ronnie.shi@workspace.io',
            authStatus: 'connected',
            concurrency: 2,
            activeSlots: 0,
            storageVolumeId: storageVolumes[0]?.id,
          };
          return {
            ...a,
            cliConfig: {
              ...base,
              ...patch,
              concurrency:
                patch.concurrency !== undefined
                  ? Math.min(16, Math.max(1, Math.round(patch.concurrency)))
                  : base.concurrency,
            },
          };
        }),
      );
    },
    [storageVolumes],
  );

  // ================= WORK PROJECT LIFECYCLE & STAGE PIPELINE ORCHESTRATION =================
  const updateProjectLifecycle = useCallback(
    (workspaceId: string, status: ProjectLifecycleStatus) => {
      const today = new Date().toISOString().slice(0, 10);
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === workspaceId
            ? {
                ...w,
                lifecycleStatus: status,
                completedAt: status === 'active' ? undefined : w.completedAt || today,
              }
            : w,
        ),
      );
      const proj = workspaces.find((w) => w.id === workspaceId);
      if (proj) {
        const label =
          status === 'completed' ? '标记已完成' : status === 'archived' ? '已归档' : '重新激活为开发中';
        setAuditLogs((prev) => [
          {
            id: `aud_life_${Date.now()}`,
            category: 'audit',
            title: `项目状态变更：${proj.name}`,
            detail: `生命周期已更新为「${label}」。`,
            severity: 'info',
            timestamp: nowTimeStr(),
          },
          ...prev,
        ]);
      }
    },
    [workspaces],
  );

  const updateProjectSpaceBinding = useCallback(
    (workspaceId: string, boundNodeIds: string[], storageVolumeId?: string) => {
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === workspaceId
            ? { ...w, boundNodeIds, storageVolumeId: storageVolumeId || w.storageVolumeId }
            : w,
        ),
      );
      if (storageVolumeId) {
        setStorageVolumes((prev) =>
          prev.map((v) =>
            v.id === storageVolumeId
              ? { ...v, boundProjectIds: Array.from(new Set([...v.boundProjectIds, workspaceId])) }
              : v,
          ),
        );
      }
    },
    [],
  );

  const updateProjectStageSlot = useCallback(
    (projectId: string, stage: WorkCardType, patch: Partial<Omit<ProjectStageSlot, 'stage'>>) => {
      setProjectPipelines((prev) => {
        const existing = prev[projectId] || getDefaultProjectPipelineSlots();
        return {
          ...prev,
          [projectId]: existing.map((slot) =>
            slot.stage === stage ? { ...slot, ...patch } : slot,
          ),
        };
      });

      // Bidirectional sync: when a stage's bound Agent changes in Work Orchestration,
      // sync the agent into the project's roster and update unfinished tasks in that stage on the Kanban board.
      if (patch.agentId) {
        const nextAgent = agents.find((a) => a.id === patch.agentId);
        if (nextAgent) {
          const ts = nowTimeStr();
          setWorkspaces((prev) =>
            prev.map((w) =>
              w.id === projectId && !w.hiredAgentIds.includes(nextAgent.id)
                ? { ...w, hiredAgentIds: [...w.hiredAgentIds, nextAgent.id] }
                : w,
            ),
          );
          const stageStatus = STAGE_TO_STATUS[stage];
          setAllTasks((prev) =>
            prev.map((t) =>
              t.sessionId === projectId && t.status === stageStatus && stageStatus !== 'done'
                ? {
                    ...t,
                    assigneeId: nextAgent.id,
                    assigneeHandle: nextAgent.handle,
                    updatedAt: ts,
                  }
                : t,
            ),
          );
        }
      }
    },
    [agents],
  );

  const addProjectAgentAssignment = useCallback(
    (projectId: string, agentId: string, initialStages?: ActiveWorkflowStage[]) => {
      const targetProj = workspaces.find((w) => w.id === projectId);
      if (isWorkspaceReadOnly(targetProj)) return;
      const targetAgent = agents.find((a) => a.id === agentId);
      if (!targetAgent) return;

      // Commercial gatekeeping: uncontracted external marketplace experts cannot bypass Market/Negotiation/Lease
      if (!isAgentAuthorizedForProject(targetProj, targetAgent, agentLeases)) {
        setAuditLogs((prev) => [
          {
            id: `aud_gate_${Date.now()}`,
            category: 'order',
            title: `编排拦截：${targetAgent.handle} 尚未签约或租用`,
            detail: `外部市场专家需先在「AGN 社区 → 服务市场」完成签约或租用后，方可加入「${targetProj?.name || '项目'}」任务编排。`,
            severity: 'warning',
            timestamp: nowTimeStr(),
          },
          ...prev,
        ]);
        return;
      }

      const existing = projectAgentAssignments[projectId] || [];
      if (existing.some((a) => a.agentId === agentId)) return;

      const stages =
        initialStages && initialStages.length > 0
          ? initialStages
          : getDefaultStagesForAgentCategory(targetAgent.category);

      const nextAssignments: ProjectAgentAssignment[] = [
        ...existing,
        {
          agentId,
          stages,
          roleNote: targetAgent.title,
          handoffMode: stages.includes('development') ? 'auto' : 'manual',
        },
      ];

      setProjectAgentAssignments((prev) => ({
        ...prev,
        [projectId]: nextAssignments,
      }));

      setProjectPipelines((prev) => ({
        ...prev,
        [projectId]: syncSlotsFromAssignments(nextAssignments, prev[projectId]),
      }));

      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === projectId && !w.hiredAgentIds.includes(agentId)
            ? { ...w, hiredAgentIds: [...w.hiredAgentIds, agentId] }
            : w,
        ),
      );
    },
    [agentLeases, agents, projectAgentAssignments, workspaces],
  );

  const removeProjectAgentAssignment = useCallback(
    (projectId: string, agentId: string) => {
      const targetProj = workspaces.find((w) => w.id === projectId);
      if (isWorkspaceReadOnly(targetProj)) return;
      const existing = projectAgentAssignments[projectId] || [];
      if (existing.length <= 1) return;
      const nextAssignments = existing.filter((a) => a.agentId !== agentId);
      const removedAgent = agents.find((a) => a.id === agentId);
      const ts = nowTimeStr();

      setProjectAgentAssignments((prev) => ({
        ...prev,
        [projectId]: nextAssignments,
      }));

      setProjectPipelines((prev) => ({
        ...prev,
        [projectId]: syncSlotsFromAssignments(nextAssignments, prev[projectId]),
      }));

      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === projectId
            ? { ...w, hiredAgentIds: w.hiredAgentIds.filter((id) => id !== agentId) }
            : w,
        ),
      );

      setProjectTaskTypes((prev) => {
        const list = prev[projectId];
        if (!list) return prev;
        return {
          ...prev,
          [projectId]: list.map((tpl) => ({
            ...tpl,
            creatorAgentIds: (tpl.creatorAgentIds || []).filter((id) => id !== agentId),
          })),
        };
      });

      // Reassign unfinished tasks owned by the removed agent to a load-balanced active stage expert
      const affectedTasks = allTasks.filter(
        (t) => t.sessionId === projectId && t.status !== 'done' && t.assigneeId === agentId,
      );
      if (affectedTasks.length > 0) {
        const fallbackAgent = nextAssignments
          .map((a) => agents.find((ag) => ag.id === a.agentId))
          .find((ag): ag is ExpertAgent => Boolean(ag));

        setAllTasks((prev) =>
          prev.map((t) => {
            if (t.sessionId !== projectId || t.status === 'done' || t.assigneeId !== agentId) {
              return t;
            }
            const stage = mapStatusToActiveStage(t.status) || 'development';
            const replacement =
              pickLoadBalancedStageAgent(
                projectId,
                stage,
                undefined,
                nextAssignments,
                agents,
                prev,
                agentId,
              ) || fallbackAgent;
            return {
              ...t,
              assigneeId: replacement ? replacement.id : 'butler',
              assigneeHandle: replacement ? replacement.handle : '@Nexa',
              updatedAt: ts,
            };
          }),
        );

        setAllMessages((prev) => [
          ...prev,
          {
            id: `msg_rm_assign_${Date.now()}`,
            sessionId: projectId,
            senderType: 'system',
            senderId: 'system',
            senderName: '任务编排同步',
            senderHandle: '任务编排',
            content: `已将 ${removedAgent?.handle || agentId} 移出项目编排，其名下 ${affectedTasks.length} 项未完成任务已自动转派给同阶段在岗专家。`,
            timestamp: ts,
          },
        ]);
      }
    },
    [agents, allTasks, projectAgentAssignments, workspaces],
  );

  const updateProjectAgentAssignment = useCallback(
    (
      projectId: string,
      agentId: string,
      patch: Partial<Omit<ProjectAgentAssignment, 'agentId'>>,
    ) => {
      const targetProj = workspaces.find((w) => w.id === projectId);
      if (isWorkspaceReadOnly(targetProj)) return;
      const existing = projectAgentAssignments[projectId] || [];
      const nextAssignments = existing.map((item) =>
        item.agentId === agentId ? { ...item, ...patch } : item,
      );

      setProjectAgentAssignments((prev) => ({
        ...prev,
        [projectId]: nextAssignments,
      }));

      setProjectPipelines((prev) => ({
        ...prev,
        [projectId]: syncSlotsFromAssignments(nextAssignments, prev[projectId]),
      }));
    },
    [projectAgentAssignments, workspaces],
  );

  const addProjectTaskType = useCallback(
    (
      projectId: string,
      input: {
        name: string;
        description: string;
        templateChecklist?: string;
        accent: TaskTypeAccent;
        creatorAgentIds?: string[];
      },
    ) => {
      const targetProj = workspaces.find((w) => w.id === projectId);
      if (isWorkspaceReadOnly(targetProj)) return;
      const cleanName = input.name.trim();
      if (!cleanName) return;
      const creators = (input.creatorAgentIds || []).filter(Boolean);
      const newType: ProjectTaskType = {
        id: `tt_${Date.now().toString(36)}`,
        name: cleanName,
        description: input.description.trim() || '自定义任务卡片模板',
        templateChecklist: input.templateChecklist?.trim() || undefined,
        accent: input.accent,
        creatorAgentIds: creators,
        defaultAgentId: creators[0],
        isBuiltin: false,
      };
      setProjectTaskTypes((prev) => {
        const existing = prev[projectId] || DEFAULT_PROJECT_TASK_TYPES.map((item) => ({ ...item }));
        return {
          ...prev,
          [projectId]: [...existing, newType],
        };
      });
    },
    [workspaces],
  );

  const updateProjectTaskType = useCallback(
    (
      projectId: string,
      typeId: string,
      patch: Partial<Omit<ProjectTaskType, 'id'>>,
    ) => {
      const targetProj = workspaces.find((w) => w.id === projectId);
      if (isWorkspaceReadOnly(targetProj)) return;
      setProjectTaskTypes((prev) => {
        const existing = prev[projectId] || DEFAULT_PROJECT_TASK_TYPES.map((item) => ({ ...item }));
        return {
          ...prev,
          [projectId]: existing.map((item) =>
            item.id === typeId
              ? {
                  ...item,
                  ...patch,
                  defaultAgentId:
                    patch.creatorAgentIds !== undefined
                      ? patch.creatorAgentIds[0]
                      : item.defaultAgentId,
                }
              : item,
          ),
        };
      });
      if (patch.name) {
        const cleanName = patch.name.trim();
        if (cleanName) {
          setAllTasks((prev) =>
            prev.map((t) =>
              t.sessionId === projectId && t.taskTypeId === typeId
                ? { ...t, taskTypeLabel: cleanName }
                : t,
            ),
          );
        }
      }
    },
    [workspaces],
  );

  const deleteProjectTaskType = useCallback(
    (projectId: string, typeId: string) => {
      const targetProj = workspaces.find((w) => w.id === projectId);
      if (isWorkspaceReadOnly(targetProj)) return;
      setProjectTaskTypes((prev) => {
        const existing = prev[projectId] || DEFAULT_PROJECT_TASK_TYPES.map((item) => ({ ...item }));
        if (existing.length <= 1) return prev;
        return {
          ...prev,
          [projectId]: existing.filter((item) => item.id !== typeId),
        };
      });
    },
    [workspaces],
  );

  const applyTaskTypePresetPack = useCallback(
    (projectId: string, packId: TaskTemplatePackId) => {
      const targetProj = workspaces.find((w) => w.id === projectId);
      if (isWorkspaceReadOnly(targetProj)) return;
      const assignments = projectAgentAssignments[projectId] || [];
      const nextTypes = buildTaskTypesFromPack(packId, assignments);
      setProjectTaskTypes((prev) => ({
        ...prev,
        [projectId]: nextTypes,
      }));
    },
    [projectAgentAssignments, workspaces],
  );

  const startTemplateConversation = useCallback(
    async (
      projectId: string,
      taskTypeId: string,
      options?: { prompt?: string; creatorAgentId?: string; autoSend?: boolean },
    ) => {
      const targetWorkspace = workspaces.find((w) => w.id === projectId);
      if (isWorkspaceReadOnly(targetWorkspace)) {
        setAiError('该项目已完成或归档，请先重新激活项目后再发起任务规划对话。');
        return;
      }
      const types = projectTaskTypes[projectId] || DEFAULT_PROJECT_TASK_TYPES;
      const tpl = types.find((t) => t.id === taskTypeId) || types[0];
      const creatorIds = tpl ? getTemplateCreatorIds(tpl) : [];
      const chosenCreatorId =
        options?.creatorAgentId ||
        creatorIds[0] ||
        projectAgentAssignments[projectId]?.find((a) => a.stages.includes('planning'))?.agentId;
      const creatorAgent = chosenCreatorId
        ? agents.find((a) => a.id === chosenCreatorId)
        : undefined;
      const mentionPrefix = creatorAgent ? `${creatorAgent.handle} ` : '';
      const checklistHint = tpl?.templateChecklist
        ? `（按交付骨架：${tpl.templateChecklist}）`
        : '';
      const userPrompt = options?.prompt?.trim() || '';

      const messageText = userPrompt
        ? `${mentionPrefix}请基于【${tpl?.name || '任务'}】模板与我对话梳理，并生成标准任务计划卡${checklistHint}：\n${userPrompt}`
        : `${mentionPrefix}请按【${tpl?.name || '任务'}】模板与我对话梳理，并生成一张标准任务计划卡${checklistHint}：`;

      setActiveSessionId(projectId);
      setPreferredConversationMode('chat');
      setActiveChatChannel({ type: 'group', projectId });
      setActiveView('chat');

      if (!options?.autoSend || !userPrompt) {
        setChatDraftSeed(messageText);
        return;
      }

      if (!targetWorkspace) {
        setChatDraftSeed(messageText);
        return;
      }

      setChatDraftSeed('');
      setAiError(null);

      const userMsgId = `msg_user_${Date.now()}`;
      const userMsg: ChatMessage = {
        id: userMsgId,
        sessionId: targetWorkspace.id,
        senderType: 'employer',
        senderId: 'employer',
        senderName: '我（项目负责人）',
        senderHandle: '@指挥官',
        content: messageText,
        timestamp: nowTimeStr(),
      };

      const projectHiredAgents = agents.filter((a) =>
        targetWorkspace.hiredAgentIds.includes(a.id),
      );
      const curAssignments = projectAgentAssignments[targetWorkspace.id] || [];
      const recentProjectMessages = [
        ...allMessages.filter((m) => m.sessionId === targetWorkspace.id),
        userMsg,
      ];
      const existingProjectTasks = allTasks.filter((t) => t.sessionId === targetWorkspace.id);

      setAllMessages((prev) => [...prev, userMsg]);
      setIsAiBusy(true);

      try {
        const result = await orchestrateGroupChat({
          message: messageText,
          workspace: targetWorkspace,
          hiredAgents: projectHiredAgents,
          projectAssignments: curAssignments,
          projectTaskTypes: types,
          recentMessages: recentProjectMessages,
          existingTasks: existingProjectTasks,
        });

        const ts = nowTimeStr();
        const validTypes = new Set<WorkCardType>(['planning', 'development', 'testing', 'review']);
        const createdTasks: WorkflowTask[] = (result.newTasks || []).map((nt, idx) => {
          const validAssignee =
            projectHiredAgents.find((a) => a.id === nt.assigneeId) ||
            creatorAgent ||
            projectHiredAgents[0];
          const wType: WorkCardType = validTypes.has(nt.workType) ? nt.workType : 'planning';
          return {
            id: `tsk_${Date.now().toString().slice(-4)}_${idx + 1}`,
            sessionId: targetWorkspace.id,
            featureModule: nt.featureModule?.trim() || tpl?.name || '任务计划',
            workType: wType,
            taskTypeId: tpl?.id,
            taskTypeLabel: tpl?.name,
            title: nt.title,
            description: nt.description,
            assigneeId: validAssignee ? validAssignee.id : 'butler',
            assigneeHandle: validAssignee ? validAssignee.handle : nt.assigneeHandle || '@Nexa',
            status: 'pending',
            priority: nt.priority === '高' || nt.priority === '低' ? nt.priority : '中',
            createdAt: ts,
            updatedAt: ts,
            sourceMessageId: userMsgId,
          };
        });

        if (createdTasks.length > 0) {
          setAllTasks((prev) => [...createdTasks, ...prev]);
        }

        const aiReplies: ChatMessage[] = (result.replies || []).map((r, idx) => ({
          id: `msg_ai_${Date.now()}_${idx}`,
          sessionId: targetWorkspace.id,
          senderType: r.senderType === 'butler' ? 'butler' : 'agent',
          senderId: r.senderId,
          senderName: r.senderName,
          senderHandle: r.senderHandle,
          content: r.content,
          timestamp: ts,
          linkedTaskIds:
            idx === result.replies.length - 1 ? createdTasks.map((t) => t.id) : undefined,
        }));

        if (aiReplies.length > 0) {
          setAllMessages((prev) => [...prev, ...aiReplies]);
        }
      } catch (err) {
        setAiError(err instanceof Error ? err.message : '发起任务对话失败');
      } finally {
        setIsAiBusy(false);
      }
    },
    [agents, allMessages, allTasks, projectAgentAssignments, projectTaskTypes, workspaces],
  );

  const createPipelineStageTask = useCallback(
    (projectId: string, stage: WorkCardType, customTitle?: string, taskTypeId?: string) => {
      const assignments = projectAgentAssignments[projectId] || [];
      const slots = projectPipelines[projectId] || getDefaultProjectPipelineSlots();
      const slot = slots.find((s) => s.stage === stage);
      const stageMeta = getPipelineStageMeta(stage);
      const types = projectTaskTypes[projectId] || DEFAULT_PROJECT_TASK_TYPES;
      const selectedType =
        (taskTypeId ? types.find((t) => t.id === taskTypeId) : undefined) || types[0];
      const creatorIds = selectedType ? getTemplateCreatorIds(selectedType) : [];
      const activeStage: ActiveWorkflowStage =
        stage === 'review' ? 'testing' : stage;
      const stageAssignedId = assignments.find((a) => a.stages.includes(activeStage))?.agentId;

      const preferredAgentId =
        stage === 'planning'
          ? creatorIds[0] || stageAssignedId || slot?.agentId
          : stageAssignedId || creatorIds[0] || slot?.agentId;

      const assignee =
        (preferredAgentId ? agents.find((a) => a.id === preferredAgentId) : undefined) ||
        agents[0];
      const ts = nowTimeStr();
      const title =
        customTitle?.trim() || `${selectedType?.name || stageMeta.label}：新建任务`;

      const newTask: WorkflowTask = {
        id: `tsk_${Date.now().toString().slice(-4)}`,
        sessionId: projectId,
        featureModule: selectedType?.name || stageMeta.label,
        workType: stage,
        taskTypeId: selectedType?.id,
        taskTypeLabel: selectedType?.name,
        title,
        description:
          selectedType?.templateChecklist ||
          selectedType?.description ||
          `按「${stageMeta.label}」阶段要求完成交付与验证。`,
        assigneeId: assignee?.id || 'butler',
        assigneeHandle: assignee?.handle || '@Nexa',
        status: STAGE_TO_STATUS[stage],
        priority: '高',
        createdAt: ts,
        updatedAt: ts,
      };

      setAllTasks((prev) => [newTask, ...prev]);
      if (assignee) {
        setWorkspaces((prev) =>
          prev.map((w) =>
            w.id === projectId && !w.hiredAgentIds.includes(assignee.id)
              ? { ...w, hiredAgentIds: [...w.hiredAgentIds, assignee.id] }
              : w,
          ),
        );
      }
      setAllMessages((prev) => [
        ...prev,
        {
          id: `msg_stage_task_${Date.now()}`,
          sessionId: projectId,
          senderType: 'butler',
          senderId: 'butler',
          senderName: 'Nexa 助理',
          senderHandle: '@Nexa',
          content: `已按【${selectedType?.name || '任务'}】模板创建「${newTask.title}」并加入「${stageMeta.label}」，指派给 ${newTask.assigneeHandle}。`,
          timestamp: ts,
          linkedTaskIds: [newTask.id],
        },
      ]);
      return newTask;
    },
    [agents, projectAgentAssignments, projectPipelines, projectTaskTypes],
  );

  const handoffPipelineStage = useCallback(
    (projectId: string, fromStage: WorkCardType) => {
      const nextStage = getNextPipelineStage(fromStage);
      if (!nextStage) return;

      const slots = projectPipelines[projectId] || getDefaultProjectPipelineSlots();
      const fromMeta = getPipelineStageMeta(fromStage);
      const nextMeta = getPipelineStageMeta(nextStage);
      const nextSlot = slots.find((s) => s.stage === nextStage);
      const nextAgent = agents.find((a) => a.id === nextSlot?.agentId) || agents[0];
      const ts = nowTimeStr();

      const fromStatus = STAGE_TO_STATUS[fromStage];
      const nextStatus = STAGE_TO_STATUS[nextStage];
      const stageTasks = allTasks.filter(
        (t) => t.sessionId === projectId && t.status === fromStatus,
      );

      if (stageTasks.length === 0) return;

      const movedIds = new Set(stageTasks.map((t) => t.id));
      const reassignNext =
        Boolean(nextAgent) && (nextStatus === 'in_progress' || nextStatus === 'review');

      setAllTasks((prev) =>
        prev.map((t) =>
          movedIds.has(t.id)
            ? {
                ...t,
                status: nextStatus,
                assigneeId: reassignNext && nextAgent ? nextAgent.id : t.assigneeId,
                assigneeHandle: reassignNext && nextAgent ? nextAgent.handle : t.assigneeHandle,
                updatedAt: ts,
              }
            : t,
        ),
      );

      if (reassignNext && nextAgent) {
        setWorkspaces((prev) =>
          prev.map((w) =>
            w.id === projectId && !w.hiredAgentIds.includes(nextAgent.id)
              ? { ...w, hiredAgentIds: [...w.hiredAgentIds, nextAgent.id] }
              : w,
          ),
        );
      }

      setAllMessages((prev) => [
        ...prev,
        {
          id: `msg_handoff_${Date.now()}`,
          sessionId: projectId,
          senderType: 'system',
          senderId: 'system',
          senderName: '阶段流转',
          senderHandle: '任务编排',
          content: `已将「${fromMeta.label}」中的 ${stageTasks.length} 项任务流转至「${nextMeta.label}」${
            reassignNext && nextAgent ? `，并交接给 ${nextAgent.handle}` : ''
          }。`,
          timestamp: ts,
          linkedTaskIds: stageTasks.map((t) => t.id),
        },
      ]);
    },
    [agents, allTasks, projectPipelines],
  );

  const syncPipelineAgentsToProject = useCallback(
    (projectId: string) => {
      const slots = projectPipelines[projectId] || [];
      const slotAgentIds = slots.map((s) => s.agentId).filter(Boolean);
      const slotNodeIds = slotAgentIds
        .map((aid) => agents.find((a) => a.id === aid)?.hostNodeId)
        .filter((nid): nid is string => Boolean(nid));

      if (slotAgentIds.length === 0) return;

      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === projectId
            ? {
                ...w,
                hiredAgentIds: Array.from(new Set([...w.hiredAgentIds, ...slotAgentIds])),
                boundNodeIds: Array.from(new Set([...(w.boundNodeIds || []), ...slotNodeIds])),
              }
            : w,
        ),
      );
      const proj = workspaces.find((w) => w.id === projectId);
      setAuditLogs((prev) => [
        {
          id: `aud_pipe_${Date.now()}`,
          category: 'audit',
          title: `任务编排已同步：${proj?.name || projectId}`,
          detail: `已将 ${slotAgentIds.length} 个阶段专业 Agent 及其运行节点同步至项目协同阵容。`,
          severity: 'success',
          timestamp: nowTimeStr(),
        },
        ...prev,
      ]);
    },
    [agents, projectPipelines, workspaces],
  );

  return {
    zones,
    joinedZones,
    activeZoneId,
    activeZone,
    setActiveZoneId,
    joinedZoneIds,
    spaceSharedNodes,
    toggleJoinZone,
    applyToJoinZone,
    updateZoneInviteCode,
    createCollabZone,
    deleteCollabZone,
    inviteSpaceMember,
    updateSpaceMemberRole,
    kickSpaceMember,
    addSpaceSharedNode,
    toggleSpaceSharedNodeStatus,
    updateSpaceSharedNode,
    removeSpaceSharedNode,
    toggleSpaceAgentOnline,
    publishAgentToSpace,
    removeAgentFromSpace,
    activeView,
    setActiveView,
    activeChatChannel,
    setActiveChatChannel,
    conversationMode,
    switchConversationMode,
    workspaces,
    zoneProjects,
    communityPosts,
    openZoneProjectsCount,
    activeWorkspace,
    selectSession,
    createSession,
    publishZoneProject,
    claimZoneProject,
    createCommunityPost,
    publishCommunitySkill,
    togglePinPost,
    deleteCommunityPost,
    toggleLikePost,
    addPostComment,
    followedEntityKeys,
    toggleFollowEntity,
    openNewSessionLauncher,
    openAssistantChat,
    openTaskSession,
    openAgentTaskSession,
    createAndOpenTaskSession,
    launchNewTaskSessionFromPrompt,
    openHumanDm,
    sendHumanDmMessage,
    humanDmThreads,
    openNegotiationsHub,
    openKanbanForProject,
    openWorkspaceTab,
    openTeamTab,
    openCommunityService,
    openCommunityDiscover,
    openMarketForZone,
    activeCommunityTab,
    setActiveCommunityTab,
    artifacts,
    marketSkills,
    createProjectArtifact,
    shareArtifactToProjectChat,
    toggleStarArtifact,
    deleteProjectArtifact,
    kanbanProjectSeed,
    clearKanbanProjectSeed: () => setKanbanProjectSeed(null),
    kanbanTabSeed,
    clearKanbanTabSeed: () => setKanbanTabSeed(null),
    teamTabSeed,
    clearTeamTabSeed: () => setTeamTabSeed(null),
    discoverZoneSeed,
    clearDiscoverZoneSeed: () => setDiscoverZoneSeed(null),
    agents,
    humanExperts,
    agentLeases,
    purchasedSkillIds,
    teamExperts,
    computeNodes,
    storageVolumes,
    projectPipelines,
    projectAgentAssignments,
    projectTaskTypes,
    mountPrivateNode,
    provisionCloudNode,
    toggleNodeStatus,
    removeComputeNode,
    updateAgentSliceFirewall,
    createStorageVolume,
    expandStorageVolume,
    addNodeCli,
    updateNodeCli,
    removeNodeCli,
    toggleNodeStorageMount,
    deployAgentOnNode,
    assignAgentHostNode,
    updateAgentCliConfig,
    updateProjectLifecycle,
    updateProjectSpaceBinding,
    updateProjectStageSlot,
    addProjectAgentAssignment,
    removeProjectAgentAssignment,
    updateProjectAgentAssignment,
    addProjectTaskType,
    updateProjectTaskType,
    deleteProjectTaskType,
    applyTaskTypePresetPack,
    startTemplateConversation,
    createPipelineStageTask,
    handoffPipelineStage,
    syncPipelineAgentsToProject,
    leaseAgent,
    acquireSkill,
    createSpaceSkill,
    toggleAgentSkillBinding,
    toggleZoneSkillDistribution,
    inviteTeamExpert,
    assignExpertToWorkspace,
    removeExpertFromWorkspace,
    updateTeamExpertRelation,
    removeTeamExpert,
    marketplaceAgents,
    totalMarketExpertsCount,
    privateAgents,
    hiredIds,
    hiredAgents,
    allTasks,
    sessionTasks,
    allMessages,
    sessionMessages,
    taskSessions,
    taskSessionBusyId,
    taskSessionError,
    clearTaskSessionError: () => setTaskSessionError(null),
    awaitingTaskSessionCount,
    sendTaskSessionTurn,
    syncTaskSummaryToGroup,
    negotiations,
    activeNegotiationCount,
    assistantMessages,
    assistantBusy,
    assistantPendingCount,
    spaceApplications,
    managedSpaceApplications,
    pendingSpaceApplicationCount,
    resolveSpaceApplication,
    settlements,
    unsettledCount,
    auditLogs,
    reviewTaskCount,
    dmHistories,
    dmBusyAgentId,
    dmError,
    clearDmError: () => setDmError(null),
    startOrOpenNegotiation,
    updateNegotiationTerms,
    sendDirectMessage,
    confirmHireFromNegotiation,
    sendAssistantMessage,
    settleRecord,
    settleAllUnsettled,
    isAiBusy,
    executingTaskId,
    aiError,
    clearAiError: () => setAiError(null),
    chatDraftSeed,
    clearChatDraftSeed: () => setChatDraftSeed(''),
    marketCategorySeed,
    clearMarketCategorySeed: () => setMarketCategorySeed('all'),
    openMountDrawerSignal,
    account,
    authModalOpen,
    setAuthModalOpen,
    loginAccount,
    logoutAccount,
    createWorkCard,
    hireAgent,
    hireAgentIntoProject,
    releaseAgent,
    savePrivateAgent,
    toggleMarketListing,
    sendGroupMessage,
    updateTaskStatus,
    runAutonomousTask,
    communityEvents,
    publishCommunityEvent,
    toggleRegisterCommunityEvent,
    jumpToChatWithMention,
    jumpToMarketWithCategory,
    jumpToMountPrivateAgent,
  };
}
