import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Archive,
  ArrowUpRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  Cpu,
  Database,
  FileCode2,
  FolderKanban,
  GitBranch,
  Globe,
  Inbox,
  LayoutGrid,
  Lock,
  MessageSquareCode,
  MessageSquarePlus,
  Play,
  Plus,
  RotateCcw,
  Server,
  Shapes,
  Star,
  TrendingUp,
  User,
  UserMinus,
  Users,
  X,
} from 'lucide-react';
import type {
  ActiveWorkflowStage,
  AgentLeaseRecord,
  ArtifactCategoryGroup,
  ArtifactKind,
  ArtifactScopeTab,
  ArtifactSourceType,
  CommunityZone,
  ComputeNode,
  ExpertAgent,
  HumanExpert,
  LeasePeriod,
  NegotiationThread,
  ProjectAgentAssignment,
  ProjectArtifact,
  ProjectLifecycleStatus,
  ProjectRole,
  ProjectTaskType,
  ProjectWorkspace,
  SettlementRecord,
  SpaceSharedNode,
  StorageVolume,
  TaskStatus,
  TaskTypeAccent,
  TeamExpertMembership,
  WorkflowTask,
  WorkspaceTabId,
} from '../../types/agentnexus';
import {
  AgentIdentityName,
  EntityAvatar,
  LEASE_PERIOD_META,
  displayEntityName,
  formatAgentDisplayName,
  getAgentLeasePricing,
} from '../shared/EntityIdentity';
import { EmptyStateCard, ModalShell } from '../shared/UiPrimitives';
import {
  RailNavButton,
  RailSectionLabel,
  ToolbarDropdown,
  ToolbarSearch,
  WORKSPACE_GUTTER_CLASS,
  WORKSPACE_MAX_WIDTH_CLASS,
  WorkspacePrimaryRail,
} from '../shared/ViewToolbar';
import { WORK_CARD_STAGES, WorkStatusBadge } from '../workcard/WorkCardFlow';
import { ProjectOrchestrationPanel } from '../workspace/ProjectOrchestrationPanel';
import {
  DEFAULT_PROJECT_TASK_TYPES,
  TASK_TYPE_ACCENT_STYLES,
  type TaskTemplatePackId,
  getTemplateCreatorIds,
  resolveTaskType,
} from '../../utils/pipelineSync';
import { ArtifactsView } from './ArtifactsView';

export type WorkKanbanTab = WorkspaceTabId;

interface WorkflowKanbanViewProps {
  zones: CommunityZone[];
  joinedZoneIds: string[];
  spaceSharedNodes: SpaceSharedNode[];
  workspaces: ProjectWorkspace[];
  computeNodes: ComputeNode[];
  storageVolumes: StorageVolume[];
  projectAgentAssignments: Record<string, ProjectAgentAssignment[]>;
  projectTaskTypes: Record<string, ProjectTaskType[]>;
  selectedProjectId?: string;
  onSelectProjectId?: (projectId: string) => void;
  projectSeed: string | null;
  onClearProjectSeed: () => void;
  tabSeed: WorkKanbanTab | null;
  onClearTabSeed: () => void;
  allTasks: WorkflowTask[];
  agents: ExpertAgent[];
  humanExperts: HumanExpert[];
  agentLeases: Record<string, AgentLeaseRecord>;
  teamExperts: TeamExpertMembership[];
  negotiations: NegotiationThread[];
  settlements: SettlementRecord[];
  executingTaskId: string | null;
  onCreateProject: (
    name: string,
    goal: string,
    sourceZoneId?: string,
    boundNodeIds?: string[],
    storageVolumeId?: string,
  ) => string;
  onRunTask: (taskId: string) => Promise<void>;
  onUpdateStatus: (taskId: string, status: TaskStatus) => void;
  onOpenTaskSession: (taskId: string) => void;
  onConfirmHire: (agentId: string, createFirstCard: boolean) => void;
  onJumpToMarket: () => void;
  onJumpToZoneMarket: (zoneId: string) => void;
  onJumpToDiscover: () => void;
  onJumpToTeam: () => void;
  onJumpToTeamNodes: () => void;
  onReleaseAgent: (agentId: string, projectId?: string) => void;
  onLeaseAgent: (agentId: string, period: LeasePeriod, targetWorkspaceId?: string) => void;
  onAssignExpertToWorkspace: (expertId: string, workspaceId: string) => void;
  onRemoveExpertFromWorkspace: (expertId: string, workspaceId: string) => void;
  onUpdateProjectLifecycle: (workspaceId: string, status: ProjectLifecycleStatus) => void;
  onAddProjectAgentAssignment: (
    projectId: string,
    agentId: string,
    initialStages?: ActiveWorkflowStage[],
  ) => void;
  onRemoveProjectAgentAssignment: (projectId: string, agentId: string) => void;
  onUpdateProjectAgentAssignment: (
    projectId: string,
    agentId: string,
    patch: Partial<Omit<ProjectAgentAssignment, 'agentId'>>,
  ) => void;
  onAddProjectTaskType: (
    projectId: string,
    input: {
      name: string;
      description: string;
      templateChecklist?: string;
      accent: TaskTypeAccent;
      creatorAgentIds?: string[];
    },
  ) => void;
  onUpdateProjectTaskType: (
    projectId: string,
    typeId: string,
    patch: Partial<Omit<ProjectTaskType, 'id'>>,
  ) => void;
  onDeleteProjectTaskType: (projectId: string, typeId: string) => void;
  onApplyTaskTypePresetPack: (projectId: string, packId: TaskTemplatePackId) => void;
  onStartTemplateConversation: (
    projectId: string,
    taskTypeId: string,
    options?: { prompt?: string; creatorAgentId?: string; autoSend?: boolean },
  ) => void;
  artifacts: ProjectArtifact[];
  onCreateArtifact: (input: {
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
  }) => void;
  onShareArtifactToChat: (artifactId: string, projectId: string, note?: string) => void;
  onToggleStarArtifact: (artifactId: string) => void;
  onDeleteArtifact: (artifactId: string) => void;
  onOpenProjectChat: (projectId: string) => void;
  onBreadcrumbContextChange?: (ctx: {
    tab: WorkKanbanTab;
    focusedProjectName?: string | null;
    artifactCategory?: ArtifactCategoryGroup;
    onClearFocus?: () => void;
  }) => void;
}


const ROLE_META: Record<ProjectRole, { label: string; cls: string }> = {
  leading: { label: '我主管', cls: 'text-blue-700' },
  participating: { label: '我参与', cls: 'text-indigo-700' },
};

const LIFECYCLE_META: Record<ProjectLifecycleStatus, { label: string; cls: string; dotCls: string }> = {
  active: { label: '进行中', cls: 'text-blue-700', dotCls: 'bg-blue-600' },
  completed: { label: '已完成', cls: 'text-emerald-700', dotCls: 'bg-emerald-500' },
  archived: { label: '已归档', cls: 'text-slate-500', dotCls: 'bg-slate-400' },
};

type AgentLiveAvailability = 'busy' | 'idle' | 'offline';

interface AgentRuntimeSnapshot {
  agent: ExpertAgent;
  availability: AgentLiveAvailability;
  availabilityLabel: string;
  availabilityDetail: string;
  projects: ProjectWorkspace[];
  pendingCount: number;
  inProgressCount: number;
  reviewCount: number;
  doneCount: number;
  totalTasks: number;
  activeTask: WorkflowTask | null;
}

interface ProjectActivityItem {
  id: string;
  projectId: string;
  stageLabel: string;
  stageTextCls: string;
  title: string;
  detail: string;
  timestamp: string;
  priorityWeight: number;
  taskId?: string;
}

const STAGE_DONUT_COLORS: Record<TaskStatus, string> = {
  pending: '#94a3b8',
  in_progress: '#2563eb',
  review: '#d97706',
  done: '#10b981',
};

export function WorkflowKanbanView({
  zones,
  joinedZoneIds,
  spaceSharedNodes,
  workspaces,
  computeNodes,
  storageVolumes,
  projectAgentAssignments,
  projectTaskTypes,
  selectedProjectId,
  onSelectProjectId,
  projectSeed,
  onClearProjectSeed,
  tabSeed,
  onClearTabSeed,
  allTasks,
  agents,
  humanExperts,
  agentLeases,
  teamExperts,
  negotiations,
  settlements,
  executingTaskId,
  onCreateProject,
  onRunTask,
  onUpdateStatus,
  onOpenTaskSession,
  onJumpToMarket,
  onJumpToZoneMarket,
  onJumpToDiscover,
  onJumpToTeam,
  onJumpToTeamNodes,
  onLeaseAgent,
  onAssignExpertToWorkspace,
  onRemoveExpertFromWorkspace,
  onUpdateProjectLifecycle,
  onAddProjectAgentAssignment,
  onRemoveProjectAgentAssignment,
  onUpdateProjectAgentAssignment,
  onAddProjectTaskType,
  onUpdateProjectTaskType,
  onDeleteProjectTaskType,
  onApplyTaskTypePresetPack,
  onStartTemplateConversation,
  artifacts,
  onCreateArtifact,
  onShareArtifactToChat,
  onToggleStarArtifact,
  onDeleteArtifact,
  onOpenProjectChat,
  onBreadcrumbContextChange,
}: WorkflowKanbanViewProps) {
  const [activeTab, setActiveTab] = useState<WorkKanbanTab>('overview');
  const [artifactCategory, setArtifactCategory] = useState<ArtifactCategoryGroup>('all');
  const [assignExpertId, setAssignExpertId] = useState<string>('');

  // Shared right-toolbar keyword search
  const [searchKeyword, setSearchKeyword] = useState('');

  // Project Overview & Single-Project Cockpit state (shared across 项目看板 & 任务编排)
  const [lifecycleFilter, setLifecycleFilter] = useState<'all' | ProjectLifecycleStatus>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | ProjectRole>('all');
  const [internalProjectId, setInternalProjectId] = useState<string>(workspaces[0]?.id || '');
  const [showCreateProjectForm, setShowCreateProjectForm] = useState(false);
  const [projName, setProjName] = useState('');
  const [projGoal, setProjGoal] = useState('');
  const [projZoneId, setProjZoneId] = useState<string>(zones[0]?.id || 'zone_public');
  const [projNodeId, setProjNodeId] = useState<string>(
    computeNodes.find((n) => n.status === 'online')?.id || computeNodes[0]?.id || '',
  );
  const [projVolumeId, setProjVolumeId] = useState<string>(storageVolumes[0]?.id || '');

  // Single-project Kanban filter & AI conversation task dispatch state
  const [kanbanAgentFilter, setKanbanAgentFilter] = useState<string>('all');
  const [taskTypeFilter, setTaskTypeFilter] = useState<string>('all');
  const [showProjectTeamPanel, setShowProjectTeamPanel] = useState(false);
  const [showCompletedInbox, setShowCompletedInbox] = useState(false);
  const [showQuickTaskForm, setShowQuickTaskForm] = useState(false);
  const [quickTaskTypeId, setQuickTaskTypeId] = useState<string>(
    DEFAULT_PROJECT_TASK_TYPES[0].id,
  );
  const [quickCreatorAgentId, setQuickCreatorAgentId] = useState<string>('');
  const [quickTaskPrompt, setQuickTaskPrompt] = useState('');

  const effectiveProjectId = selectedProjectId || internalProjectId || workspaces[0]?.id || '';

  const selectProject = (projectId: string) => {
    setInternalProjectId(projectId);
    onSelectProjectId?.(projectId);
  };

  useEffect(() => {
    if (projectSeed) {
      const targetId =
        projectSeed !== 'all' ? projectSeed : workspaces[0]?.id || '';
      if (targetId) {
        setInternalProjectId(targetId);
        onSelectProjectId?.(targetId);
      }
      setKanbanAgentFilter('all');
      setTaskTypeFilter('all');
      onClearProjectSeed();
    }
  }, [projectSeed, onClearProjectSeed, onSelectProjectId, workspaces]);

  useEffect(() => {
    if (tabSeed) {
      setActiveTab(tabSeed);
      onClearTabSeed();
    }
  }, [tabSeed, onClearTabSeed]);

  const zoneMap = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);
  const joinedZones = useMemo(
    () => zones.filter((z) => !z.comingSoon && (z.isPlatformDefault || joinedZoneIds.includes(z.id))),
    [joinedZoneIds, zones],
  );
  const workspaceMap = useMemo(() => new Map(workspaces.map((w) => [w.id, w])), [workspaces]);
  const agentMap = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);
  const humanExpertMap = useMemo(() => new Map(humanExperts.map((h) => [h.id, h])), [humanExperts]);
  const teamExpertMap = useMemo(
    () => new Map(teamExperts.map((m) => [m.expertId, m])),
    [teamExperts],
  );
  const nodeMap = useMemo(() => new Map(computeNodes.map((n) => [n.id, n])), [computeNodes]);
  const sharedNodeMap = useMemo(
    () => new Map(spaceSharedNodes.map((n) => [n.id, n])),
    [spaceSharedNodes],
  );
  const accessibleSharedNodes = useMemo(
    () =>
      spaceSharedNodes.filter((n) => {
        const z = zoneMap.get(n.zoneId);
        if (!z) return false;
        const joined = Boolean(z.isPlatformDefault || joinedZoneIds.includes(z.id));
        if (!joined) return false;
        if (n.accessPolicy === 'admins_only' && !(z.createdByMe || z.isCurrentUserPrincipal)) {
          return false;
        }
        return true;
      }),
    [joinedZoneIds, spaceSharedNodes, zoneMap],
  );
  const volumeMap = useMemo(() => new Map(storageVolumes.map((v) => [v.id, v])), [storageVolumes]);

  const getAnyNodeLabel = (nodeId: string): string | null => {
    const personal = nodeMap.get(nodeId);
    if (personal) return personal.name;
    const shared = sharedNodeMap.get(nodeId);
    if (shared) {
      const z = zoneMap.get(shared.zoneId);
      return `${z ? `${z.shortCode}共享·` : '空间共享·'}${shared.name}`;
    }
    return null;
  };

  const renderSpaceOwnershipBadge = (sourceZoneId?: string) => {
    const z = sourceZoneId ? zoneMap.get(sourceZoneId) : undefined;
    if (!z) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-600">
          <Lock className="w-2.5 h-2.5 shrink-0" />
          <span>个人私有项目</span>
        </span>
      );
    }
    const isPrivate = z.kind === 'private';
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold ${
          isPrivate
            ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
            : 'bg-sky-50 border-sky-200 text-sky-700'
        }`}
      >
        {isPrivate ? (
          <Building2 className="w-2.5 h-2.5 shrink-0" />
        ) : (
          <Globe className="w-2.5 h-2.5 shrink-0" />
        )}
        <span>
          {z.typeLabel} · {z.name}
        </span>
      </span>
    );
  };

  // Live runtime snapshots for all involved/private Agents
  const agentSnapshots = useMemo<AgentRuntimeSnapshot[]>(() => {
    const involvedIds = new Set<string>();
    workspaces.forEach((w) => w.hiredAgentIds.forEach((id) => involvedIds.add(id)));
    allTasks.forEach((t) => involvedIds.add(t.assigneeId));
    agents.forEach((a) => {
      if (a.ownership === 'private') involvedIds.add(a.id);
    });

    const list: AgentRuntimeSnapshot[] = [];
    involvedIds.forEach((id) => {
      const agent = agentMap.get(id);
      if (!agent) return;
      const agentProjects = workspaces.filter((w) => w.hiredAgentIds.includes(id));
      const agentTasks = allTasks.filter((t) => t.assigneeId === id);
      const pendingCount = agentTasks.filter((t) => t.status === 'pending').length;
      const inProgressCount = agentTasks.filter(
        (t) => t.status === 'in_progress' || executingTaskId === t.id,
      ).length;
      const reviewCount = agentTasks.filter((t) => t.status === 'review').length;
      const doneCount = agentTasks.filter((t) => t.status === 'done').length;

      const activeTask =
        agentTasks.find((t) => executingTaskId === t.id || t.status === 'in_progress') ||
        agentTasks.find((t) => t.status === 'review') ||
        agentTasks.find((t) => t.status === 'pending') ||
        null;

      let availability: AgentLiveAvailability;
      let availabilityLabel: string;
      let availabilityDetail: string;

      if (!agent.isOnlineForOrders) {
        availability = 'offline';
        availabilityLabel = '离线';
        availabilityDetail = '节点暂未接单';
      } else if (inProgressCount > 0) {
        availability = 'busy';
        availabilityLabel = '在线 · 忙碌';
        availabilityDetail = `正在执行 ${inProgressCount} 项任务`;
      } else if (reviewCount > 0 || pendingCount >= 2) {
        availability = 'busy';
        availabilityLabel = '在线 · 忙碌';
        availabilityDetail =
          reviewCount > 0 ? `${reviewCount} 项产物待验证` : `${pendingCount} 项任务计划中`;
      } else {
        availability = 'idle';
        availabilityLabel = '在线 · 空闲';
        availabilityDetail =
          pendingCount === 1 ? '1 项计划中 · 可并行接单' : '档期充裕 · 可随时派单';
      }

      list.push({
        agent,
        availability,
        availabilityLabel,
        availabilityDetail,
        projects: agentProjects,
        pendingCount,
        inProgressCount,
        reviewCount,
        doneCount,
        totalTasks: agentTasks.length,
        activeTask,
      });
    });

    return list.sort((a, b) => {
      const aScore = a.inProgressCount * 10 + a.totalTasks * 3 + a.projects.length * 2;
      const bScore = b.inProgressCount * 10 + b.totalTasks * 3 + b.projects.length * 2;
      return bScore - aScore;
    });
  }, [agentMap, agents, allTasks, executingTaskId, workspaces]);

  const snapshotByAgentId = useMemo(
    () => new Map(agentSnapshots.map((s) => [s.agent.id, s])),
    [agentSnapshots],
  );

  // Space & Project Summary Metrics
  const onlineNodesCount = computeNodes.filter((n) => n.status === 'online').length;
  const activeProjCount = workspaces.filter(
    (w) => (w.lifecycleStatus || 'active') === 'active',
  ).length;
  const completedProjCount = workspaces.filter((w) => w.lifecycleStatus === 'completed').length;
  const archivedProjCount = workspaces.filter((w) => w.lifecycleStatus === 'archived').length;
  const leadingCount = workspaces.filter((w) => w.role === 'leading').length;
  const participatingCount = workspaces.filter((w) => w.role === 'participating').length;

  const doneCount = allTasks.filter((t) => t.status === 'done').length;
  const progressPct = allTasks.length > 0 ? Math.round((doneCount / allTasks.length) * 100) : 0;

  const totalExternalSpentUsd = workspaces.reduce((sum, w) => sum + w.spentUsd, 0);
  const totalBudgetCapUsd = workspaces.reduce((sum, w) => sum + w.budgetCapUsd, 0);
  const busyAgentCount = agentSnapshots.filter((s) => s.availability === 'busy').length;
  const idleAgentCount = agentSnapshots.filter((s) => s.availability === 'idle').length;

  // Global 4-stage task distribution (unified across 项目概要 / 项目看板 / 任务编排)
  const globalStageStats = useMemo(() => {
    const total = allTasks.length;
    return WORK_CARD_STAGES.map((stage) => {
      const stageTasks = allTasks.filter((t) =>
        stage.status === 'in_progress'
          ? t.status === 'in_progress' || executingTaskId === t.id
          : t.status === stage.status && executingTaskId !== t.id,
      );
      const count = stageTasks.length;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      return {
        stage,
        count,
        pct,
        color: STAGE_DONUT_COLORS[stage.status],
        firstProjectId: stageTasks[0]?.sessionId || workspaces[0]?.id,
      };
    });
  }, [allTasks, executingTaskId, workspaces]);

  const normalizedQuery = searchKeyword.trim().toLowerCase();

  const filteredMyProjects = useMemo(
    () =>
      workspaces.filter((w) => {
        const status = w.lifecycleStatus || 'active';
        if (lifecycleFilter !== 'all' && status !== lifecycleFilter) return false;
        if (roleFilter !== 'all' && w.role !== roleFilter) return false;
        if (!normalizedQuery) return true;
        return (
          w.name.toLowerCase().includes(normalizedQuery) ||
          w.goal.toLowerCase().includes(normalizedQuery)
        );
      }),
    [lifecycleFilter, normalizedQuery, roleFilter, workspaces],
  );

  const focusedProject = useMemo(
    () => (effectiveProjectId ? workspaceMap.get(effectiveProjectId) : undefined) || workspaces[0] || null,
    [effectiveProjectId, workspaceMap, workspaces],
  );

  // Project-scoped activity feed grouped by projectId for the Project List
  const activitiesByProjectId = useMemo(() => {
    const grouped = new Map<string, ProjectActivityItem[]>();
    const pushItem = (item: ProjectActivityItem) => {
      const list = grouped.get(item.projectId);
      if (list) list.push(item);
      else grouped.set(item.projectId, [item]);
    };

    allTasks.forEach((t) => {
      const proj = workspaceMap.get(t.sessionId);
      if (!proj) return;
      const effectiveStatus: TaskStatus =
        executingTaskId === t.id ? 'in_progress' : t.status;
      const taskType = resolveTaskType(t, projectTaskTypes[proj.id]);
      const agent = agentMap.get(t.assigneeId);
      const actor = agent
        ? formatAgentDisplayName(agent.handle, agent.runtimeAgent, agent.defaultModel)
        : displayEntityName(t.assigneeHandle);

      if (effectiveStatus === 'in_progress') {
        pushItem({
          id: `act_run_${t.id}`,
          projectId: proj.id,
          stageLabel: '任务执行',
          stageTextCls: 'text-blue-700',
          title: t.title,
          detail: `${actor} · ${taskType.name}`,
          timestamp: t.updatedAt,
          priorityWeight: 4,
          taskId: t.id,
        });
      } else if (effectiveStatus === 'review') {
        pushItem({
          id: `act_rev_${t.id}`,
          projectId: proj.id,
          stageLabel: '任务验证',
          stageTextCls: 'text-amber-700',
          title: t.title,
          detail: t.deliverableArtifact
            ? `${actor} · ${t.deliverableArtifact}`
            : `${actor} · ${taskType.name}`,
          timestamp: t.updatedAt,
          priorityWeight: 3,
          taskId: t.id,
        });
      } else if (effectiveStatus === 'pending') {
        pushItem({
          id: `act_pend_${t.id}`,
          projectId: proj.id,
          stageLabel: '任务计划',
          stageTextCls: 'text-slate-600',
          title: t.title,
          detail: `${actor} · ${taskType.name}`,
          timestamp: t.updatedAt,
          priorityWeight: 2,
          taskId: t.id,
        });
      } else {
        pushItem({
          id: `act_done_${t.id}`,
          projectId: proj.id,
          stageLabel: '已完成',
          stageTextCls: 'text-emerald-700',
          title: t.title,
          detail: `${actor} · ${taskType.name}`,
          timestamp: t.updatedAt,
          priorityWeight: 1,
          taskId: t.id,
        });
      }
    });

    negotiations.forEach((n) => {
      const proj = workspaceMap.get(n.targetProjectId);
      const ag = agentMap.get(n.agentId);
      if (!proj || !ag || n.status === 'hired') return;
      pushItem({
        id: `act_neg_${n.agentId}_${n.targetProjectId}`,
        projectId: proj.id,
        stageLabel: '协同协商',
        stageTextCls: 'text-indigo-700',
        title: `与 ${formatAgentDisplayName(ag.handle, ag.runtimeAgent, ag.defaultModel)} 协商合作`,
        detail: n.firstWorkCardTitle || n.scopeNote,
        timestamp: n.updatedAt,
        priorityWeight: 3,
      });
    });

    workspaces.forEach((w) => {
      if (w.lifecycleStatus === 'completed' && w.completedAt) {
        pushItem({
          id: `act_ws_${w.id}`,
          projectId: w.id,
          stageLabel: '项目完结',
          stageTextCls: 'text-emerald-700',
          title: '项目里程碑已验收归档',
          detail: `累计支出 $${w.spentUsd.toLocaleString('en-US')}`,
          timestamp: w.completedAt,
          priorityWeight: 1,
        });
      }
    });

    grouped.forEach((list, key) => {
      grouped.set(
        key,
        list.sort((a, b) => b.priorityWeight - a.priorityWeight),
      );
    });

    return grouped;
  }, [agentMap, allTasks, executingTaskId, negotiations, projectTaskTypes, workspaceMap, workspaces]);

  const artifactScopeCounts = useMemo(() => {
    const existingTaskIds = new Set(artifacts.map((a) => a.sourceTaskId).filter(Boolean));
    const derivedCount = allTasks.filter(
      (t) => Boolean(t.deliverableArtifact) && !existingTaskIds.has(t.id),
    ).length;
    return {
      all: artifacts.length + derivedCount,
      yours: artifacts.filter((a) => a.ownership === 'yours').length + derivedCount,
      shared: artifacts.filter((a) => a.ownership === 'shared').length,
      starred: artifacts.filter((a) => Boolean(a.starred)).length,
    };
  }, [allTasks, artifacts]);

  const isArtifactsTab = activeTab.startsWith('artifacts_');
  const activeArtifactScope: ArtifactScopeTab =
    activeTab === 'artifacts_yours'
      ? 'yours'
      : activeTab === 'artifacts_shared'
        ? 'shared'
        : activeTab === 'artifacts_starred'
          ? 'starred'
          : 'all';

  useEffect(() => {
    onBreadcrumbContextChange?.({
      tab: activeTab,
      focusedProjectName: activeTab === 'my_projects' && focusedProject ? focusedProject.name : null,
      artifactCategory: isArtifactsTab ? artifactCategory : 'all',
      onClearFocus: () => setActiveTab('overview'),
    });
  }, [activeTab, artifactCategory, focusedProject, isArtifactsTab, onBreadcrumbContextChange]);

  const focusedProjectTasks = useMemo(
    () => (focusedProject ? allTasks.filter((t) => t.sessionId === focusedProject.id) : []),
    [allTasks, focusedProject],
  );

  const focusedProjectTaskTypes = useMemo(
    () =>
      focusedProject
        ? projectTaskTypes[focusedProject.id] || DEFAULT_PROJECT_TASK_TYPES
        : DEFAULT_PROJECT_TASK_TYPES,
    [focusedProject, projectTaskTypes],
  );

  const focusedKanbanTasks = useMemo(() => {
    return focusedProjectTasks.filter((t) => {
      if (kanbanAgentFilter !== 'all' && t.assigneeId !== kanbanAgentFilter) return false;
      if (taskTypeFilter !== 'all') {
        const resolved = resolveTaskType(t, focusedProjectTaskTypes);
        if (resolved.id !== taskTypeFilter) return false;
      }
      if (normalizedQuery) {
        const resolved = resolveTaskType(t, focusedProjectTaskTypes);
        const match =
          t.title.toLowerCase().includes(normalizedQuery) ||
          t.description.toLowerCase().includes(normalizedQuery) ||
          t.featureModule.toLowerCase().includes(normalizedQuery) ||
          resolved.name.toLowerCase().includes(normalizedQuery) ||
          t.assigneeHandle.toLowerCase().includes(normalizedQuery);
        if (!match) return false;
      }
      return true;
    });
  }, [
    focusedProjectTaskTypes,
    focusedProjectTasks,
    kanbanAgentFilter,
    normalizedQuery,
    taskTypeFilter,
  ]);

  const focusedAssignableAgents = useMemo(() => {
    if (!focusedProject) return [];
    const ids = new Set<string>([
      ...focusedProject.hiredAgentIds,
      ...focusedProjectTasks.map((t) => t.assigneeId),
    ]);
    return agents.filter((a) => ids.has(a.id));
  }, [agents, focusedProject, focusedProjectTasks]);

  const activePipelineProject = focusedProject;

  const focusedAgentAssignments = useMemo(
    () => (focusedProject ? projectAgentAssignments[focusedProject.id] || [] : []),
    [focusedProject, projectAgentAssignments],
  );

  // Participating Agent experts & task volume statistics for current project summary
  const focusedAgentWorkloads = useMemo(() => {
    if (!focusedProject) return [];
    return focusedAssignableAgents
      .map((agent) => {
        const tasks = focusedProjectTasks.filter((t) => t.assigneeId === agent.id);
        const pending = tasks.filter((t) => t.status === 'pending' && executingTaskId !== t.id).length;
        const inProgress = tasks.filter(
          (t) => t.status === 'in_progress' || executingTaskId === t.id,
        ).length;
        const review = tasks.filter((t) => t.status === 'review' && executingTaskId !== t.id).length;
        const done = tasks.filter((t) => t.status === 'done' && executingTaskId !== t.id).length;
        const total = tasks.length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        return {
          agent,
          snap: snapshotByAgentId.get(agent.id),
          total,
          pending,
          inProgress,
          review,
          done,
          pct,
        };
      })
      .sort((a, b) => b.total - a.total || b.inProgress - a.inProgress);
  }, [executingTaskId, focusedAssignableAgents, focusedProject, focusedProjectTasks, snapshotByAgentId]);

  const openProjectWorkspace = (
    projectId: string,
    typeFilter: string = 'all',
    agentFilter: string = 'all',
  ) => {
    selectProject(projectId);
    setKanbanAgentFilter(agentFilter);
    setTaskTypeFilter(typeFilter);
    setSearchKeyword('');
    setShowProjectTeamPanel(false);
    setShowQuickTaskForm(false);
    setShowCreateProjectForm(false);
    setActiveTab('my_projects');
  };

  const handleCreateProjectSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!projName.trim()) return;
    const newId = onCreateProject(
      projName,
      projGoal,
      projZoneId || undefined,
      projNodeId ? [projNodeId] : undefined,
      projVolumeId || undefined,
    );
    setProjName('');
    setProjGoal('');
    setShowCreateProjectForm(false);
    if (newId) {
      selectProject(newId);
      setKanbanAgentFilter('all');
      setTaskTypeFilter('all');
      setSearchKeyword('');
      setActiveTab('my_projects');
    }
  };

  const renderAvailabilityIndicator = (snap: AgentRuntimeSnapshot) => {
    const dotCls =
      snap.availability === 'busy'
        ? 'bg-blue-600'
        : snap.availability === 'idle'
          ? 'bg-emerald-500'
          : 'bg-slate-400';
    const textCls =
      snap.availability === 'busy'
        ? 'text-blue-700'
        : snap.availability === 'idle'
          ? 'text-emerald-700'
          : 'text-slate-500';
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-[11px] font-semibold whitespace-nowrap ${textCls}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotCls}`} />
        <span>{snap.availabilityLabel}</span>
      </span>
    );
  };

  const searchPlaceholder =
    activeTab === 'my_projects'
      ? '搜索当前项目任务、模块或 Agent...'
      : '搜索项目名称、目标或范围...';

  const switchTab = (next: WorkKanbanTab) => {
    setActiveTab(next);
    setShowCreateProjectForm(false);
  };

  return (
    <div className="h-full flex min-h-0 bg-white relative @container/shell">
      {/* FAR-LEFT PRIMARY NAVIGATION RAIL: Work Projects + Artifacts (Parallel Independent Groups) */}
      <WorkspacePrimaryRail ariaLabel="工作台导航">
        <div className="space-y-1">
          <RailSectionLabel>工作项目</RailSectionLabel>
          <RailNavButton
            variant="primary"
            active={activeTab === 'overview'}
            onClick={() => switchTab('overview')}
            icon={<TrendingUp className="w-3.5 h-3.5" />}
            label="项目概要"
          />
          <RailNavButton
            variant="primary"
            active={activeTab === 'my_projects'}
            onClick={() => switchTab('my_projects')}
            icon={<LayoutGrid className="w-3.5 h-3.5" />}
            label="项目看板"
            count={focusedProjectTasks.length}
          />
          <RailNavButton
            variant="primary"
            active={activeTab === 'orchestration'}
            onClick={() => switchTab('orchestration')}
            icon={<GitBranch className="w-3.5 h-3.5" />}
            label="任务编排"
            count={focusedAgentAssignments.length}
          />
        </div>

        <div className="space-y-1 pt-3 border-t border-slate-100">
          <RailSectionLabel>Artifacts</RailSectionLabel>
          <RailNavButton
            variant="primary"
            active={activeTab === 'artifacts_all'}
            onClick={() => switchTab('artifacts_all')}
            icon={<Shapes className="w-3.5 h-3.5" />}
            label="全部产物"
            count={artifactScopeCounts.all}
          />
          <RailNavButton
            variant="primary"
            active={activeTab === 'artifacts_yours'}
            onClick={() => switchTab('artifacts_yours')}
            icon={<User className="w-3.5 h-3.5" />}
            label="我创建的"
            count={artifactScopeCounts.yours}
          />
          <RailNavButton
            variant="primary"
            active={activeTab === 'artifacts_shared'}
            onClick={() => switchTab('artifacts_shared')}
            icon={<Users className="w-3.5 h-3.5" />}
            label="分享给我的"
            count={artifactScopeCounts.shared}
          />
          <RailNavButton
            variant="primary"
            active={activeTab === 'artifacts_starred'}
            onClick={() => switchTab('artifacts_starred')}
            icon={
              <Star
                className={`w-3.5 h-3.5 ${
                  activeTab === 'artifacts_starred' ? 'text-amber-300' : 'text-amber-500'
                }`}
              />
            }
            label="标星收藏"
            count={artifactScopeCounts.starred}
          />
        </div>
      </WorkspacePrimaryRail>

      {/* RIGHT WORKSPACE COLUMN: Either Independent Artifacts Workspace OR Project Toolbar + Canvas */}
      {isArtifactsTab ? (
        <ArtifactsView
          embeddedMode
          controlledScope={activeArtifactScope}
          onChangeScope={(nextScope) => {
            const map: Record<ArtifactScopeTab, WorkKanbanTab> = {
              all: 'artifacts_all',
              yours: 'artifacts_yours',
              shared: 'artifacts_shared',
              starred: 'artifacts_starred',
            };
            switchTab(map[nextScope]);
          }}
          artifacts={artifacts}
          workspaces={workspaces}
          allTasks={allTasks}
          onCreateArtifact={onCreateArtifact}
          onShareArtifactToChat={onShareArtifactToChat}
          onToggleStarArtifact={onToggleStarArtifact}
          onDeleteArtifact={onDeleteArtifact}
          onOpenTaskSession={onOpenTaskSession}
          onOpenProjectChat={onOpenProjectChat}
          onBreadcrumbContextChange={({ category }) => setArtifactCategory(category)}
        />
      ) : (
        <div className="flex-1 min-w-0 flex flex-col h-full min-h-0 @container/view">
        {/* Main Scrollable Content Canvas */}
        <div
          className={`flex-1 min-h-0 overflow-y-auto clean-scroll bg-slate-50/70 ${WORKSPACE_GUTTER_CLASS} py-5`}
        >
          {/* Compact Narrow Strip (visible only when shell < 760px) */}
          <div
            className={`${WORKSPACE_MAX_WIDTH_CLASS} @[760px]/shell:hidden mb-4 flex items-center gap-1.5 overflow-x-auto pb-0.5`}
          >
            {(
              [
                { id: 'overview', label: '项目概要' },
                { id: 'my_projects', label: '项目看板' },
                { id: 'orchestration', label: '任务编排' },
                { id: 'artifacts_all', label: 'Artifacts' },
              ] as { id: WorkKanbanTab; label: string }[]
            ).map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => switchTab(item.id)}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer border transition-colors ${
                    active
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* ================= WORK PROJECTS 1: PROJECT OVERVIEW (Block 1: Global Summary | Block 2: Project-Centric List) ================= */}
          {activeTab === 'overview' && (
            <div className={`${WORKSPACE_MAX_WIDTH_CLASS} space-y-5`}>
              {/* ================= BLOCK 1: SIMPLIFIED GLOBAL SUMMARY + UNIFIED 4-STAGE DONUT & TABLE ================= */}
              <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-12 lg:divide-x lg:divide-slate-200/80">
                  {/* Left: Clean Unboxed Global Project Summary Metrics */}
                  <div className="lg:col-span-7 p-4 md:p-5 flex flex-col justify-between gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <h2 className="text-sm font-bold text-slate-900">全项目概要</h2>
                        <span className="text-xs text-slate-400">
                          项目进度、专家负载与资源总览
                        </span>
                      </div>
                      <span className="text-xs font-mono tabular-nums text-slate-500 shrink-0">
                        在线节点 {onlineNodesCount}/{computeNodes.length}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
                      <div className="space-y-1">
                        <div className="text-[11px] font-medium text-slate-500">项目总数</div>
                        <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                          {workspaces.length}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                          进行中 {activeProjCount} · 完成 {completedProjCount}
                          {archivedProjCount > 0 ? ` · 归档 ${archivedProjCount}` : ''}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-[11px] font-medium text-slate-500">任务完成率</div>
                        <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                          {progressPct}%
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                          已完成 {doneCount} / {allTasks.length} 卡
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-[11px] font-medium text-slate-500">专家 Agent</div>
                        <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                          {agentSnapshots.length}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                          忙碌 {busyAgentCount} · 空闲 {idleAgentCount}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-[11px] font-medium text-slate-500">项目预算</div>
                        <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                          ${totalExternalSpentUsd.toLocaleString('en-US')}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                          上限 ${totalBudgetCapUsd.toLocaleString('en-US')}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Global 4-Stage Donut Chart + Unified Table */}
                  <div className="lg:col-span-5 p-4 md:p-5 bg-slate-50/40 border-t lg:border-t-0 border-slate-200/80 flex flex-col justify-between gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-800">
                        全局任务分布（四阶段）
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (focusedProject) openProjectWorkspace(focusedProject.id);
                          else switchTab('my_projects');
                        }}
                        className="inline-flex items-center gap-0.5 text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer whitespace-nowrap"
                      >
                        <span>进入项目看板</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-5">
                      {/* Pure SVG Donut Chart */}
                      {(() => {
                        const radius = 36;
                        const circumference = 2 * Math.PI * radius;
                        const total = allTasks.length;
                        let cumulative = 0;
                        return (
                          <div className="relative w-24 h-24 shrink-0">
                            <svg
                              viewBox="0 0 100 100"
                              className="w-full h-full -rotate-90"
                              role="img"
                              aria-label={`全局任务四阶段分布，共 ${total} 项任务`}
                            >
                              <circle
                                cx="50"
                                cy="50"
                                r={radius}
                                fill="none"
                                stroke="#e2e8f0"
                                strokeWidth="11"
                              />
                              {total > 0 &&
                                globalStageStats.map((seg) => {
                                  if (seg.count <= 0) return null;
                                  const segLen = (seg.count / total) * circumference;
                                  const dashOffset = -cumulative;
                                  cumulative += segLen;
                                  return (
                                    <circle
                                      key={seg.stage.status}
                                      cx="50"
                                      cy="50"
                                      r={radius}
                                      fill="none"
                                      stroke={seg.color}
                                      strokeWidth="11"
                                      strokeDasharray={`${segLen} ${circumference}`}
                                      strokeDashoffset={dashOffset}
                                    />
                                  );
                                })}
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                              <span className="text-lg font-bold font-mono tabular-nums text-slate-900 leading-none">
                                {total}
                              </span>
                              <span className="text-[10px] text-slate-500 mt-1">总任务</span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Unified 4-Stage Compact Hairline Table */}
                      <table className="flex-1 min-w-0 text-left border-collapse text-xs">
                        <tbody className="divide-y divide-slate-200/70">
                          {globalStageStats.map((seg) => (
                            <tr
                              key={seg.stage.status}
                              onClick={() => {
                                if (seg.firstProjectId) {
                                  openProjectWorkspace(seg.firstProjectId);
                                } else {
                                  switchTab('my_projects');
                                }
                              }}
                              title={`点击进入包含「${seg.stage.label}」任务的项目看板`}
                              className="hover:bg-white cursor-pointer transition-colors"
                            >
                              <td className="py-1.5 pr-2">
                                <span className="inline-flex items-center gap-2 text-slate-700 font-medium whitespace-nowrap">
                                  <span
                                    className="w-2 h-2 rounded-sm shrink-0"
                                    style={{ backgroundColor: seg.color }}
                                  />
                                  <span>{seg.stage.label}</span>
                                </span>
                              </td>
                              <td className="py-1.5 px-2 text-right font-mono tabular-nums font-bold text-slate-900">
                                {seg.count}
                              </td>
                              <td className="py-1.5 pl-2 text-right font-mono tabular-nums text-[11px] text-slate-500 w-10">
                                {seg.pct}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </section>

              {/* ================= BLOCK 2: FULL-WIDTH PROJECT-CENTRIC PROJECT LIST ================= */}
              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2.5 px-0.5">
                  <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                    <div className="inline-flex items-center gap-2 shrink-0 mr-1">
                      <h2 className="text-sm font-bold text-slate-900">项目列表</h2>
                      <span className="text-xs font-mono tabular-nums text-slate-500">
                        {filteredMyProjects.length} / {workspaces.length}
                      </span>
                    </div>

                    <ToolbarDropdown
                      label="状态"
                      value={lifecycleFilter}
                      defaultValue="all"
                      onChange={setLifecycleFilter}
                      options={[
                        { id: 'all', label: '全部状态', hint: `${workspaces.length}` },
                        { id: 'active', label: '进行中', hint: `${activeProjCount}` },
                        { id: 'completed', label: '已完成', hint: `${completedProjCount}` },
                        { id: 'archived', label: '已归档', hint: `${archivedProjCount}` },
                      ]}
                    />
                    <ToolbarDropdown
                      label="视角"
                      value={roleFilter}
                      defaultValue="all"
                      onChange={setRoleFilter}
                      options={[
                        { id: 'all', label: '全部项目', hint: `${workspaces.length}` },
                        { id: 'leading', label: '我主管', hint: `${leadingCount}` },
                        { id: 'participating', label: '我参与', hint: `${participatingCount}` },
                      ]}
                    />
                    <ToolbarSearch
                      value={searchKeyword}
                      onChange={setSearchKeyword}
                      placeholder={searchPlaceholder}
                      widthClass="flex-1 min-w-[160px] max-w-[260px]"
                    />
                    {(lifecycleFilter !== 'all' ||
                      roleFilter !== 'all' ||
                      searchKeyword.trim() !== '') && (
                      <button
                        type="button"
                        onClick={() => {
                          setLifecycleFilter('all');
                          setRoleFilter('all');
                          setSearchKeyword('');
                        }}
                        className="inline-flex items-center gap-1 h-8 px-2 rounded-lg text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 cursor-pointer whitespace-nowrap"
                      >
                        <X className="w-3 h-3" />
                        <span>重置</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowCreateProjectForm(true)}
                    className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white whitespace-nowrap cursor-pointer shrink-0 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>新建项目</span>
                  </button>
                </div>

                {filteredMyProjects.length === 0 ? (
                  <EmptyStateCard
                    title="当前筛选下暂无项目"
                    description="可调整上方状态或视角筛选，或直接新建工作项目开始多 Agent 协同交付。"
                    action={
                      <button
                        type="button"
                        onClick={() => setShowCreateProjectForm(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>新建项目</span>
                      </button>
                    }
                  />
                ) : (
                  <div className="space-y-3.5">
                    {filteredMyProjects.map((proj) => {
                      const projTasks = allTasks.filter((t) => t.sessionId === proj.id);
                      const projPending = projTasks.filter(
                        (t) => t.status === 'pending' && executingTaskId !== t.id,
                      ).length;
                      const projInProgress = projTasks.filter(
                        (t) => t.status === 'in_progress' || executingTaskId === t.id,
                      ).length;
                      const projReview = projTasks.filter(
                        (t) => t.status === 'review' && executingTaskId !== t.id,
                      ).length;
                      const projDone = projTasks.filter(
                        (t) => t.status === 'done' && executingTaskId !== t.id,
                      ).length;

                      const status: ProjectLifecycleStatus = proj.lifecycleStatus || 'active';
                      const life = LIFECYCLE_META[status];
                      const roleInfo = ROLE_META[proj.role];
                      const projPct =
                        projTasks.length > 0
                          ? Math.round((projDone / projTasks.length) * 100)
                          : status === 'completed' || status === 'archived'
                            ? 100
                            : 0;

                      const boundNodeLabels = (proj.boundNodeIds || [])
                        .map((id) => getAnyNodeLabel(id))
                        .filter((v): v is string => Boolean(v));
                      const boundVol = proj.storageVolumeId
                        ? volumeMap.get(proj.storageVolumeId)
                        : undefined;
                      const projUnsettled = settlements
                        .filter((s) => s.projectId === proj.id && s.status === 'unsettled')
                        .reduce((sum, s) => sum + s.amountUsd, 0);
                      const spaceZone = proj.sourceZoneId
                        ? zoneMap.get(proj.sourceZoneId)
                        : undefined;

                      // Project Task Category distribution (aligned with 任务编排 -> 任务卡片模板)
                      const projTaskTypes =
                        projectTaskTypes[proj.id] || DEFAULT_PROJECT_TASK_TYPES;
                      const categoryCounts = new Map<string, number>();
                      projTasks.forEach((t) => {
                        const resolved = resolveTaskType(t, projTaskTypes);
                        categoryCounts.set(
                          resolved.id,
                          (categoryCounts.get(resolved.id) || 0) + 1,
                        );
                      });
                      const taskCategoryStats = projTaskTypes
                        .map((tt) => ({
                          taskType: tt,
                          count: categoryCounts.get(tt.id) || 0,
                        }))
                        .sort((a, b) => b.count - a.count);

                      // Project-scoped task activity feed
                      const projActivities = (activitiesByProjectId.get(proj.id) || []).slice(0, 3);

                      // Project specialist Agents & their live activity in this project
                      const projAssignments = projectAgentAssignments[proj.id] || [];
                      const projAgentIds = new Set<string>([
                        ...projAssignments.map((a) => a.agentId),
                        ...proj.hiredAgentIds,
                        ...projTasks.map((t) => t.assigneeId),
                      ]);
                      const projAgentRows = Array.from(projAgentIds)
                        .map((agentId) => {
                          const ag = agentMap.get(agentId);
                          if (!ag) return null;
                          const tasks = projTasks.filter((t) => t.assigneeId === agentId);
                          const inProg = tasks.filter(
                            (t) => t.status === 'in_progress' || executingTaskId === t.id,
                          ).length;
                          const rev = tasks.filter(
                            (t) => t.status === 'review' && executingTaskId !== t.id,
                          ).length;
                          const pend = tasks.filter(
                            (t) => t.status === 'pending' && executingTaskId !== t.id,
                          ).length;
                          const done = tasks.filter(
                            (t) => t.status === 'done' && executingTaskId !== t.id,
                          ).length;
                          const snap = snapshotByAgentId.get(agentId);
                          const isBusyInProj = inProg > 0 || rev > 0;
                          const stateLabel = !ag.isOnlineForOrders
                            ? '离线'
                            : inProg > 0
                              ? `执行中 ${inProg}`
                              : rev > 0
                                ? `待验证 ${rev}`
                                : pend > 0
                                  ? `计划中 ${pend}`
                                  : done > 0
                                    ? `已完成 ${done}`
                                    : snap?.availability === 'busy'
                                      ? '其他项目忙碌'
                                      : '空闲待命';
                          const stateCls = !ag.isOnlineForOrders
                            ? 'text-slate-400'
                            : inProg > 0
                              ? 'text-blue-700 font-semibold'
                              : rev > 0
                                ? 'text-amber-700 font-semibold'
                                : pend > 0
                                  ? 'text-slate-700 font-medium'
                                  : done > 0
                                    ? 'text-emerald-700 font-medium'
                                    : 'text-emerald-700';
                          const sortScore =
                            inProg * 20 + rev * 12 + pend * 5 + done * 2 + (ag.isOnlineForOrders ? 1 : 0);
                          return {
                            agent: ag,
                            total: tasks.length,
                            isBusyInProj,
                            stateLabel,
                            stateCls,
                            sortScore,
                          };
                        })
                        .filter((v): v is NonNullable<typeof v> => Boolean(v))
                        .sort((a, b) => b.sortScore - a.sortScore);

                      const activeAgentsInProjCount = projAgentRows.filter(
                        (r) => r.isBusyInProj,
                      ).length;

                      return (
                        <article
                          key={proj.id}
                          className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-colors overflow-hidden"
                        >
                          {/* Project Header: Summary, Metadata & Direct Actions */}
                          <div className="p-4 space-y-2">
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                              <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <FolderKanban className="w-4 h-4 text-blue-600 shrink-0" />
                                  <button
                                    type="button"
                                    onClick={() => openProjectWorkspace(proj.id)}
                                    className="text-sm font-bold text-slate-900 hover:text-blue-700 transition-colors text-left cursor-pointer"
                                  >
                                    {proj.name}
                                  </button>
                                  <span className="text-slate-300" aria-hidden="true">·</span>
                                  <span className={`text-[11px] font-semibold ${life.cls}`}>
                                    {life.label}
                                  </span>
                                  <span className="text-slate-300" aria-hidden="true">·</span>
                                  <span className={`text-[11px] font-semibold ${roleInfo.cls}`}>
                                    {roleInfo.label}
                                  </span>
                                  <span className="text-slate-300" aria-hidden="true">·</span>
                                  <span className="text-[11px] text-slate-500">
                                    {spaceZone ? `${spaceZone.typeLabel} · ${spaceZone.name}` : '个人私有项目'}
                                  </span>
                                  {proj.completedAt && (
                                    <span className="text-[11px] font-mono text-slate-400">
                                      ({proj.completedAt})
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-600 line-clamp-1">{proj.goal}</p>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                {status === 'active' && (
                                  <button
                                    type="button"
                                    onClick={() => onUpdateProjectLifecycle(proj.id, 'completed')}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100 text-[11px] font-semibold text-emerald-700 cursor-pointer whitespace-nowrap"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>完成</span>
                                  </button>
                                )}
                                {status !== 'archived' ? (
                                  <button
                                    type="button"
                                    onClick={() => onUpdateProjectLifecycle(proj.id, 'archived')}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-600 cursor-pointer whitespace-nowrap"
                                  >
                                    <Archive className="w-3 h-3" />
                                    <span>归档</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => onUpdateProjectLifecycle(proj.id, 'active')}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-[11px] font-semibold text-blue-700 cursor-pointer whitespace-nowrap"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>激活</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    selectProject(proj.id);
                                    switchTab('orchestration');
                                  }}
                                  className="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
                                >
                                  任务编排
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openProjectWorkspace(proj.id)}
                                  className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-white cursor-pointer whitespace-nowrap"
                                >
                                  <span>进入看板</span>
                                  <ArrowUpRight className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            {/* Compact Unboxed Project Metrics Line */}
                            <div className="pt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                              <div className="inline-flex items-center gap-2">
                                <span className="text-slate-400">完成度</span>
                                <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                  <div
                                    className={`h-full transition-all ${
                                      status === 'completed'
                                        ? 'bg-emerald-500'
                                        : status === 'archived'
                                          ? 'bg-slate-400'
                                          : 'bg-blue-600'
                                    }`}
                                    style={{ width: `${projPct}%` }}
                                  />
                                </div>
                                <span className="font-mono tabular-nums font-semibold text-slate-800">
                                  {projDone}/{projTasks.length} ({projPct}%)
                                </span>
                              </div>

                              <span className="text-slate-300" aria-hidden="true">·</span>

                              <span className="font-mono tabular-nums text-slate-600">
                                预算 ${proj.spentUsd.toLocaleString('en-US')} / $
                                {proj.budgetCapUsd.toLocaleString('en-US')}
                                {projUnsettled > 0 && (
                                  <span className="text-amber-700 ml-1">
                                    (待结 ${Math.round(projUnsettled).toLocaleString('en-US')})
                                  </span>
                                )}
                              </span>

                              <span className="text-slate-300" aria-hidden="true">·</span>

                              <span className="truncate">
                                算力：
                                {boundNodeLabels.length > 0
                                  ? boundNodeLabels.join('、')
                                  : '自动调度节点'}
                              </span>

                              {boundVol && (
                                <>
                                  <span className="text-slate-300" aria-hidden="true">·</span>
                                  <span className="font-mono tabular-nums">
                                    存储：{boundVol.name} ({boundVol.usedGb}/{boundVol.quotaGb}GB)
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* 3-Column Project-Centric Detail Strip: Task Categories | Task Activity | Active Specialist Agents */}
                          <div className="grid grid-cols-1 lg:grid-cols-12 lg:divide-x lg:divide-slate-200/70 border-t border-slate-100 bg-slate-50/40">
                            {/* Column 1: Project Task Categories & 4-Stage Counts */}
                            <div className="lg:col-span-4 p-3.5 space-y-2.5">
                              <div className="flex items-center justify-between gap-2 text-[11px]">
                                <span className="font-semibold text-slate-700">项目任务分类</span>
                                <span className="font-mono tabular-nums text-slate-500">
                                  计划 {projPending} ·{' '}
                                  <span className={projInProgress > 0 ? 'text-blue-700 font-semibold' : ''}>
                                    执行 {projInProgress}
                                  </span>{' '}
                                  ·{' '}
                                  <span className={projReview > 0 ? 'text-amber-700 font-semibold' : ''}>
                                    验证 {projReview}
                                  </span>{' '}
                                  ·{' '}
                                  <span className={projDone > 0 ? 'text-emerald-700 font-semibold' : ''}>
                                    完成 {projDone}
                                  </span>
                                </span>
                              </div>

                              <div className="divide-y divide-slate-200/60">
                                {taskCategoryStats.slice(0, 4).map(({ taskType, count }) => {
                                  const accentStyle = TASK_TYPE_ACCENT_STYLES[taskType.accent];
                                  return (
                                    <button
                                      key={taskType.id}
                                      type="button"
                                      onClick={() => openProjectWorkspace(proj.id, taskType.id)}
                                      title={`点击进入看板并筛选「${taskType.name}」任务`}
                                      className="w-full flex items-center justify-between gap-2 py-1.5 text-left hover:bg-white rounded px-1.5 -mx-1.5 transition-colors cursor-pointer"
                                    >
                                      <span className="inline-flex items-center gap-2 min-w-0 text-xs">
                                        <span
                                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${accentStyle.dotCls}`}
                                        />
                                        <span className="font-medium text-slate-800 truncate">
                                          {taskType.name}
                                        </span>
                                      </span>
                                      <span
                                        className={`text-[11px] font-mono tabular-nums shrink-0 ${
                                          count > 0
                                            ? 'font-semibold text-slate-900'
                                            : 'text-slate-400'
                                        }`}
                                      >
                                        {count} 卡
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Column 2: Project Task Activity */}
                            <div className="lg:col-span-4 p-3.5 border-t lg:border-t-0 border-slate-200/70 space-y-2">
                              <div className="flex items-center justify-between gap-2 text-[11px]">
                                <span className="font-semibold text-slate-700">项目任务动态</span>
                                <span className="font-mono tabular-nums text-slate-400">
                                  {(activitiesByProjectId.get(proj.id) || []).length} 条
                                </span>
                              </div>

                              {projActivities.length === 0 ? (
                                <div className="py-4 text-xs text-slate-400">
                                  暂无任务动态，进入看板发起对话规划任务
                                </div>
                              ) : (
                                <div className="divide-y divide-slate-200/60">
                                  {projActivities.map((act) => (
                                    <button
                                      key={act.id}
                                      type="button"
                                      onClick={() =>
                                        act.taskId
                                          ? onOpenTaskSession(act.taskId)
                                          : openProjectWorkspace(proj.id)
                                      }
                                      className="w-full text-left py-1.5 hover:bg-white rounded px-1.5 -mx-1.5 transition-colors cursor-pointer space-y-0.5"
                                    >
                                      <div className="flex items-center justify-between gap-2 text-[11px]">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <span
                                            className={`font-semibold whitespace-nowrap shrink-0 ${act.stageTextCls}`}
                                          >
                                            {act.stageLabel}
                                          </span>
                                          <span className="text-slate-300" aria-hidden="true">·</span>
                                          <span className="font-medium text-slate-900 truncate">
                                            {act.title}
                                          </span>
                                        </div>
                                        <span className="text-[10.5px] font-mono tabular-nums text-slate-400 shrink-0">
                                          {act.timestamp}
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-slate-500 truncate">
                                        {act.detail}
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Column 3: Project Specialist Agents Activity */}
                            <div className="lg:col-span-4 p-3.5 border-t lg:border-t-0 border-slate-200/70 space-y-2">
                              <div className="flex items-center justify-between gap-2 text-[11px]">
                                <span className="font-semibold text-slate-700">
                                  专家 Agent 活跃情况
                                </span>
                                <span className="font-mono tabular-nums text-slate-500">
                                  活跃 {activeAgentsInProjCount} / 共 {projAgentRows.length} 位
                                </span>
                              </div>

                              {projAgentRows.length === 0 ? (
                                <div className="py-4 text-xs text-slate-400">
                                  暂未配置专家 Agent，可前往任务编排添加
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <div className="divide-y divide-slate-200/60">
                                    {projAgentRows.slice(0, 4).map((row) => (
                                      <button
                                        key={row.agent.id}
                                        type="button"
                                        onClick={() =>
                                          openProjectWorkspace(proj.id, 'all', row.agent.id)
                                        }
                                        title={`点击进入看板查看 ${formatAgentDisplayName(
                                          row.agent.handle,
                                          row.agent.runtimeAgent,
                                          row.agent.defaultModel,
                                        )} 的任务`}
                                        className="w-full flex items-center justify-between gap-2 py-1.5 text-left hover:bg-white rounded px-1.5 -mx-1.5 transition-colors cursor-pointer"
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <EntityAvatar
                                            kind="agent"
                                            code={row.agent.avatarCode}
                                            accent={row.agent.avatarAccent}
                                            size="xs"
                                            showCornerMark={false}
                                          />
                                          <AgentIdentityName
                                            name={row.agent.handle}
                                            runtime={row.agent.runtimeAgent}
                                            model={row.agent.defaultModel}
                                            className="text-xs font-semibold text-slate-800"
                                          />
                                        </div>
                                        <span
                                          className={`text-[11px] font-mono tabular-nums whitespace-nowrap shrink-0 ${row.stateCls}`}
                                        >
                                          {row.stateLabel}
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                  {projAgentRows.length > 4 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        selectProject(proj.id);
                                        switchTab('orchestration');
                                      }}
                                      className="text-[11px] font-medium text-blue-700 hover:text-blue-900 pt-0.5 cursor-pointer"
                                    >
                                      另有 +{projAgentRows.length - 4} 位编排专家 · 查看全部 →
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* ================= WORK PROJECTS 2: MY PROJECTS (Multi-Project Tab Cockpit: Compact Brief + Always-Visible Kanban) ================= */}
          {activeTab === 'my_projects' && (
            <div className={`${WORKSPACE_MAX_WIDTH_CLASS} space-y-4`}>
              {!focusedProject ? (
                <EmptyStateCard
                  title="当前暂无工作项目"
                  description="创建您的第一个工作项目并绑定 Agent 专家，即可在看板中编排与推进交付任务。"
                  action={
                    <button
                      type="button"
                      onClick={() => setShowCreateProjectForm(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>新建第一个项目</span>
                    </button>
                  }
                />
              ) : (
                (() => {
                  const status: ProjectLifecycleStatus = focusedProject.lifecycleStatus || 'active';
                  const life = LIFECYCLE_META[status];
                  const roleInfo = ROLE_META[focusedProject.role];
                  const projDone = focusedProjectTasks.filter((t) => t.status === 'done').length;
                  const projPct =
                    focusedProjectTasks.length > 0
                      ? Math.round((projDone / focusedProjectTasks.length) * 100)
                      : status === 'completed' || status === 'archived'
                        ? 100
                        : 0;
                  const projMembers = agents.filter((a) =>
                    focusedProject.hiredAgentIds.includes(a.id),
                  );
                  const boundNodeLabels = (focusedProject.boundNodeIds || [])
                    .map((id) => getAnyNodeLabel(id))
                    .filter((v): v is string => Boolean(v));
                  const boundVol = focusedProject.storageVolumeId
                    ? volumeMap.get(focusedProject.storageVolumeId)
                    : undefined;
                  const projUnsettled = settlements
                    .filter((s) => s.projectId === focusedProject.id && s.status === 'unsettled')
                    .reduce((sum, s) => sum + s.amountUsd, 0);

                  const assignedExpertIds = focusedProject.hiredExpertIds || [];
                  const assignedExperts = assignedExpertIds
                    .map((id) => humanExpertMap.get(id))
                    .filter((h): h is HumanExpert => Boolean(h));
                  const availableExperts = humanExperts.filter(
                    (h) => !h.isCurrentUser && !assignedExpertIds.includes(h.id),
                  );
                  const effectiveAssignId = assignExpertId || availableExperts[0]?.id || '';
                  const effectiveQuickTypeId =
                    focusedProjectTaskTypes.find((t) => t.id === quickTaskTypeId)?.id ||
                    focusedProjectTaskTypes[0]?.id ||
                    DEFAULT_PROJECT_TASK_TYPES[0].id;
                  const selectedQuickType = focusedProjectTaskTypes.find(
                    (t) => t.id === effectiveQuickTypeId,
                  );
                  const quickCreatorIds = selectedQuickType
                    ? getTemplateCreatorIds(selectedQuickType)
                    : [];
                  const quickEligibleCreators: ExpertAgent[] = (
                    quickCreatorIds.length > 0
                      ? quickCreatorIds
                          .map((id) => agentMap.get(id))
                          .filter((a): a is ExpertAgent => Boolean(a))
                      : focusedAgentAssignments
                          .filter((a) => a.stages.includes('planning'))
                          .map((a) => agentMap.get(a.agentId))
                          .filter((a): a is ExpertAgent => Boolean(a))
                  );
                  const quickFallbackCreators =
                    quickEligibleCreators.length > 0
                      ? quickEligibleCreators
                      : focusedAssignableAgents;
                  const effectiveQuickCreatorId =
                    quickCreatorAgentId &&
                    quickFallbackCreators.some((a) => a.id === quickCreatorAgentId)
                      ? quickCreatorAgentId
                      : quickFallbackCreators[0]?.id || '';
                  const quickDispatchAgent = effectiveQuickCreatorId
                    ? agentMap.get(effectiveQuickCreatorId)
                    : undefined;
                  const isReadOnly = status === 'completed' || status === 'archived';

                  return (
                    <div className="space-y-4">
                      {isReadOnly && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900">
                          <div className="inline-flex items-center gap-2 min-w-0">
                            <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>
                              该项目已{status === 'completed' ? '结项完成' : '归档'}，看板任务流转、派发与阵容租赁已进入只读锁定状态。
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateProjectLifecycle(focusedProject.id, 'active')
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-semibold cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>重新激活项目</span>
                          </button>
                        </div>
                      )}

                      {/* Part 1: Flat Single-Elevation Split Project Summary (No Nested Cards) */}
                      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <div className="grid grid-cols-1 lg:grid-cols-12 lg:divide-x lg:divide-slate-200/80">
                          {/* Left Zone: Minimal Project Brief & Core Metrics */}
                          <div className="lg:col-span-6 p-4 flex flex-col justify-between gap-3">
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
                                  <FolderKanban className="w-4 h-4 text-blue-600 shrink-0" />
                                  <h2 className="text-sm font-bold text-slate-900 truncate">
                                    {focusedProject.name}
                                  </h2>
                                  <span
                                    className={`text-[11px] font-semibold ${life.cls}`}
                                  >
                                    {life.label}
                                  </span>
                                  <span className="text-slate-300" aria-hidden="true">·</span>
                                  <span className={`text-[11px] font-semibold ${roleInfo.cls}`}>
                                    {roleInfo.label}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  {status === 'active' && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onUpdateProjectLifecycle(focusedProject.id, 'completed')
                                      }
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100 text-[11px] font-semibold text-emerald-700 cursor-pointer whitespace-nowrap"
                                    >
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>完成</span>
                                    </button>
                                  )}
                                  {status !== 'archived' ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onUpdateProjectLifecycle(focusedProject.id, 'archived')
                                      }
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-600 cursor-pointer whitespace-nowrap"
                                    >
                                      <Archive className="w-3 h-3" />
                                      <span>归档</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onUpdateProjectLifecycle(focusedProject.id, 'active')
                                      }
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-[11px] font-semibold text-blue-700 cursor-pointer whitespace-nowrap"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                      <span>激活</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setShowProjectTeamPanel(true)}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer whitespace-nowrap transition-colors"
                                  >
                                    <Users className="w-3 h-3" />
                                    <span>管理阵容</span>
                                  </button>
                                </div>
                              </div>

                              <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                                {focusedProject.goal}
                              </p>
                            </div>

                            {/* Clean Unboxed Metadata Footer */}
                            <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-slate-600">
                              <div className="inline-flex items-center gap-2">
                                <span className="text-slate-400">完成度</span>
                                <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                  <div
                                    className={`h-full transition-all ${
                                      status === 'completed'
                                        ? 'bg-emerald-500'
                                        : status === 'archived'
                                          ? 'bg-slate-400'
                                          : 'bg-blue-600'
                                    }`}
                                    style={{ width: `${projPct}%` }}
                                  />
                                </div>
                                <span className="font-mono tabular-nums font-semibold text-slate-800">
                                  {projDone}/{focusedProjectTasks.length} ({projPct}%)
                                </span>
                              </div>

                              <span className="text-slate-300" aria-hidden="true">·</span>

                              <span className="font-mono tabular-nums">
                                ${focusedProject.spentUsd.toLocaleString('en-US')} / $
                                {focusedProject.budgetCapUsd.toLocaleString('en-US')}
                                {projUnsettled > 0 && (
                                  <span className="text-amber-700 ml-1">
                                    (待结 ${Math.round(projUnsettled).toLocaleString('en-US')})
                                  </span>
                                )}
                              </span>

                              {assignedExperts.length > 0 && (
                                <>
                                  <span className="text-slate-300" aria-hidden="true">·</span>
                                  <span className="text-slate-500 truncate">
                                    Agent 主理：{assignedExperts.map((e) => e.name).join('、')}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Right Zone: Compact Vertical Agent Expert Workload Table (Click Row to Filter) */}
                          <div className="lg:col-span-6 border-t lg:border-t-0 border-slate-200/80 bg-slate-50/40 flex flex-col">
                            {focusedAgentWorkloads.length === 0 ? (
                              <div className="px-4 py-8 text-center text-xs text-slate-400">
                                暂未分配参与 Agent，可通过「管理阵容」或「任务编排」配置专家 Agent。
                              </div>
                            ) : (
                              <div className="overflow-x-auto max-h-[168px] overflow-y-auto clean-scroll">
                                <table className="w-full text-left border-collapse text-[11px]">
                                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200/70 text-[10.5px] font-semibold text-slate-500">
                                    <tr>
                                      <th className="py-2 pl-3.5 pr-2 font-semibold">
                                        Agent 专家 ({focusedAgentWorkloads.length})
                                      </th>
                                      <th className="py-2 px-2 text-right font-semibold whitespace-nowrap">总数</th>
                                      <th className="py-2 px-2 text-right font-semibold whitespace-nowrap">计划</th>
                                      <th className="py-2 px-2 text-right font-semibold whitespace-nowrap">执行</th>
                                      <th className="py-2 px-2 text-right font-semibold whitespace-nowrap">验证</th>
                                      <th className="py-2 pl-2 pr-3.5 text-right font-semibold whitespace-nowrap">完成</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200/60">
                                    {focusedAgentWorkloads.map((item) => {
                                      const isSelected = kanbanAgentFilter === item.agent.id;
                                      return (
                                        <tr
                                          key={item.agent.id}
                                          onClick={() =>
                                            setKanbanAgentFilter((cur) =>
                                              cur === item.agent.id ? 'all' : item.agent.id,
                                            )
                                          }
                                          title="点击按该 Agent 筛选下方看板"
                                          className={`cursor-pointer transition-colors ${
                                            isSelected
                                              ? 'bg-blue-50/90 text-blue-900'
                                              : 'hover:bg-white'
                                          }`}
                                        >
                                          <td className="py-1.5 pl-3.5 pr-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                              <EntityAvatar
                                                kind="agent"
                                                code={item.agent.avatarCode}
                                                accent={item.agent.avatarAccent}
                                                size="xs"
                                                showCornerMark={false}
                                              />
                                              <span className="font-semibold text-slate-900 truncate max-w-[180px]">
                                                {formatAgentDisplayName(
                                                  item.agent.handle,
                                                  item.agent.runtimeAgent,
                                                  item.agent.defaultModel,
                                                )}
                                              </span>
                                            </div>
                                          </td>
                                          <td className="py-1.5 px-2 text-right font-mono tabular-nums font-bold text-slate-900">
                                            {item.total}
                                          </td>
                                          <td className="py-1.5 px-2 text-right font-mono tabular-nums text-slate-500">
                                            {item.pending}
                                          </td>
                                          <td
                                            className={`py-1.5 px-2 text-right font-mono tabular-nums ${
                                              item.inProgress > 0
                                                ? 'text-blue-700 font-semibold'
                                                : 'text-slate-400'
                                            }`}
                                          >
                                            {item.inProgress}
                                          </td>
                                          <td
                                            className={`py-1.5 px-2 text-right font-mono tabular-nums ${
                                              item.review > 0
                                                ? 'text-amber-700 font-semibold'
                                                : 'text-slate-400'
                                            }`}
                                          >
                                            {item.review}
                                          </td>
                                          <td
                                            className={`py-1.5 pl-2 pr-3.5 text-right font-mono tabular-nums ${
                                              item.done > 0
                                                ? 'text-emerald-700 font-semibold'
                                                : 'text-slate-400'
                                            }`}
                                          >
                                            {item.done}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Modal: Project Team, Compute Nodes & Lease Management */}
                        <ModalShell
                          open={showProjectTeamPanel}
                          onClose={() => setShowProjectTeamPanel(false)}
                          title={`管理项目协作阵容 · ${focusedProject.name}`}
                          subtitle="管理参与本项目的 Agent 主理人、专家 Agent 租期以及绑定的算力与存储资源"
                          icon={<Users className="w-4 h-4 text-slate-700" />}
                          maxWidthClass="max-w-3xl"
                          footer={
                            <button
                              type="button"
                              onClick={() => setShowProjectTeamPanel(false)}
                              className="h-8 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
                            >
                              完成
                            </button>
                          }
                        >
                          <div className="space-y-4">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600 p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                              {renderSpaceOwnershipBadge(focusedProject.sourceZoneId)}
                              <span className="inline-flex items-center gap-1">
                                <Server className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>
                                  算力节点：
                                  {boundNodeLabels.length > 0
                                    ? boundNodeLabels.join('、')
                                    : '自动调度节点'}
                                </span>
                              </span>
                              {boundVol && (
                                <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                                  <Database className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span>
                                    {boundVol.name} ({boundVol.usedGb}/{boundVol.quotaGb}GB)
                                  </span>
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <h3 className="text-xs font-bold text-slate-900 inline-flex items-center gap-1.5">
                                    <Users className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Agent 主理 ({assignedExperts.length})</span>
                                  </h3>
                                </div>
                                {assignedExperts.length === 0 ? (
                                  <p className="text-xs text-slate-400 py-2">
                                    暂未派驻 Agent 主理，可从下方直接指派。
                                  </p>
                                ) : (
                                  <div className="divide-y divide-slate-200/70 border border-slate-200/80 rounded-lg bg-white">
                                    {assignedExperts.map((exp) => {
                                      const member = teamExpertMap.get(exp.id);
                                      return (
                                        <div
                                          key={exp.id}
                                          className="flex items-center justify-between gap-2 text-xs px-2.5 py-2"
                                        >
                                          <div className="flex items-center gap-2 min-w-0">
                                            <EntityAvatar
                                              kind="human"
                                              code={exp.avatarInitials}
                                              accent={exp.avatarAccent}
                                              size="xs"
                                            />
                                            <div className="min-w-0">
                                              <div className="flex items-center gap-1.5">
                                                <span className="font-bold text-slate-900">
                                                  {exp.name}
                                                </span>
                                                <span className="text-[10px] font-mono font-bold text-violet-700">
                                                  {exp.ratingTier || 'A+'}级
                                                </span>
                                                {member && (
                                                  <span className="text-[10px] text-emerald-700 font-medium">
                                                    {member.relation === 'mutual_friend'
                                                      ? '互关好友'
                                                      : '项目合作'}
                                                  </span>
                                                )}
                                              </div>
                                              <div className="text-[11px] text-slate-500 truncate">
                                                {exp.outsourcingDomain || exp.specialties[0] || ''}
                                              </div>
                                            </div>
                                          </div>
                                          {!isReadOnly && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                onRemoveExpertFromWorkspace(exp.id, focusedProject.id)
                                              }
                                              title="移出该项目"
                                              className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer shrink-0"
                                            >
                                              <UserMinus className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                                {!isReadOnly && availableExperts.length > 0 && (
                                  <div className="pt-1 flex items-center gap-1.5">
                                    <select
                                      value={effectiveAssignId}
                                      onChange={(e) => setAssignExpertId(e.target.value)}
                                      aria-label="选择要派驻该项目的专家"
                                      className="flex-1 min-w-0 h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-800 focus:bg-white focus:outline-none"
                                    >
                                      {availableExperts.map((exp) => (
                                        <option key={exp.id} value={exp.id}>
                                          {exp.name} · {exp.outsourcingDomain || exp.specialties[0] || ''}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (effectiveAssignId) {
                                          onAssignExpertToWorkspace(
                                            effectiveAssignId,
                                            focusedProject.id,
                                          );
                                          setAssignExpertId('');
                                        }
                                      }}
                                      className="h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap shrink-0"
                                    >
                                      + 派驻
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <h3 className="text-xs font-bold text-slate-900 inline-flex items-center gap-1.5">
                                    <Cpu className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>专家 Agent ({projMembers.length})</span>
                                  </h3>
                                </div>
                                <div className="divide-y divide-slate-200/70 border border-slate-200/80 rounded-lg bg-white max-h-60 overflow-y-auto clean-scroll">
                                  {projMembers.map((ag) => {
                                    const snap = snapshotByAgentId.get(ag.id);
                                    const lease = agentLeases[ag.id];
                                    const pricing = getAgentLeasePricing({
                                      runtimeAgent: ag.runtimeAgent,
                                      defaultModel: ag.defaultModel,
                                      capabilityTier: ag.performance.capabilityTier,
                                      ownership: ag.ownership,
                                      projectPriceUsd: ag.projectPriceUsd,
                                      monthlyLeaseUsd: ag.monthlyLeaseUsd,
                                    });
                                    return (
                                      <div key={ag.id} className="p-2.5 space-y-1.5 text-xs">
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-2 min-w-0">
                                            <EntityAvatar
                                              kind="agent"
                                              code={ag.avatarCode}
                                              accent={ag.avatarAccent}
                                              size="xs"
                                            />
                                            <AgentIdentityName
                                              name={ag.handle}
                                              runtime={ag.runtimeAgent}
                                              model={ag.defaultModel}
                                              className="font-semibold text-slate-900"
                                            />
                                          </div>
                                          <span className="text-[10.5px] font-mono text-slate-500 shrink-0">
                                            {ag.ownership === 'private'
                                              ? '自有免租'
                                              : lease
                                                ? lease.expiresLabel
                                                : `$${pricing.monthlyUsd}/月`}
                                          </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                          {snap && renderAvailabilityIndicator(snap)}
                                          {ag.ownership === 'marketplace' && (
                                            <div className="inline-flex items-center gap-1">
                                              <CalendarClock className="w-3 h-3 text-indigo-500" />
                                              {(['week', 'month', 'quarter'] as LeasePeriod[]).map(
                                                (p) => {
                                                  const isCur = lease?.period === p;
                                                  return (
                                                    <button
                                                      key={p}
                                                      type="button"
                                                      disabled={isReadOnly}
                                                      onClick={() =>
                                                        onLeaseAgent(ag.id, p, focusedProject.id)
                                                      }
                                                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold cursor-pointer transition-colors disabled:opacity-45 disabled:cursor-not-allowed ${
                                                        isCur
                                                          ? 'bg-indigo-600 text-white'
                                                          : 'bg-slate-50 border border-slate-200 text-slate-600 hover:border-slate-400'
                                                      }`}
                                                    >
                                                      {LEASE_PERIOD_META[p].label}
                                                    </button>
                                                  );
                                                },
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        </ModalShell>
                      </section>

                      {/* Part 2: Always-Visible Unified 4-Column Kanban Board */}
                      <section className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2.5 px-0.5">
                          <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                            <div className="inline-flex items-center gap-2 shrink-0 mr-1">
                              <LayoutGrid className="w-4 h-4 text-slate-700" />
                              <h3 className="text-sm font-bold text-slate-900">项目看板</h3>
                              <span className="text-xs font-mono tabular-nums text-slate-500">
                                {focusedKanbanTasks.length} 项任务
                              </span>
                            </div>

                            <ToolbarDropdown
                              label="Agent"
                              value={kanbanAgentFilter}
                              defaultValue="all"
                              onChange={setKanbanAgentFilter}
                              options={[
                                { id: 'all', label: '全部 Agent' },
                                ...focusedAssignableAgents.map((a) => ({
                                  id: a.id,
                                  label: formatAgentDisplayName(
                                    a.handle,
                                    a.runtimeAgent,
                                    a.defaultModel,
                                  ),
                                  hint: `${focusedProjectTasks.filter((t) => t.assigneeId === a.id).length}`,
                                })),
                              ]}
                            />
                            <ToolbarDropdown
                              label="类型"
                              value={taskTypeFilter}
                              defaultValue="all"
                              onChange={setTaskTypeFilter}
                              options={[
                                { id: 'all', label: '全部类型' },
                                ...focusedProjectTaskTypes.map((tt) => ({
                                  id: tt.id,
                                  label: tt.name,
                                  hint: `${
                                    focusedProjectTasks.filter(
                                      (t) =>
                                        resolveTaskType(t, focusedProjectTaskTypes).id === tt.id,
                                    ).length
                                  }`,
                                })),
                              ]}
                            />
                            <ToolbarSearch
                              value={searchKeyword}
                              onChange={setSearchKeyword}
                              placeholder={searchPlaceholder}
                              widthClass="flex-1 min-w-[160px] max-w-[260px]"
                            />
                            {(kanbanAgentFilter !== 'all' ||
                              taskTypeFilter !== 'all' ||
                              searchKeyword.trim() !== '') && (
                              <button
                                type="button"
                                onClick={() => {
                                  setKanbanAgentFilter('all');
                                  setTaskTypeFilter('all');
                                  setSearchKeyword('');
                                }}
                                className="inline-flex items-center gap-1 h-8 px-2 rounded-lg text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 cursor-pointer whitespace-nowrap"
                              >
                                <X className="w-3 h-3" />
                                <span>重置</span>
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setShowCompletedInbox(true)}
                              title="查看已验收归档的任务卡片"
                              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-xs font-semibold text-slate-700 whitespace-nowrap cursor-pointer transition-colors"
                            >
                              <Inbox className="w-3.5 h-3.5 text-emerald-600" />
                              <span>已完成卡片</span>
                              <span className="font-mono tabular-nums text-[11px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                                {
                                  focusedKanbanTasks.filter(
                                    (t) => t.status === 'done' && executingTaskId !== t.id,
                                  ).length
                                }
                              </span>
                            </button>

                            <button
                              type="button"
                              disabled={isReadOnly}
                              title={isReadOnly ? '项目已锁定，请先重新激活' : '发起对话派发新任务'}
                              onClick={() => setShowQuickTaskForm(true)}
                              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white whitespace-nowrap cursor-pointer transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
                            >
                              <MessageSquarePlus className="w-3.5 h-3.5" />
                              <span>派发任务</span>
                            </button>
                          </div>
                        </div>

                        {/* AI Conversation-Driven Task Dispatch Modal */}
                        <ModalShell
                          open={showQuickTaskForm && !isReadOnly}
                          onClose={() => setShowQuickTaskForm(false)}
                          icon={<MessageSquarePlus className="w-4 h-4 text-blue-600" />}
                          title="发起对话派发任务"
                          subtitle={`${focusedProject.name} · AI 对话梳理后自动生成至「任务计划」列`}
                          maxWidthClass="max-w-xl"
                          onSubmit={(e) => {
                            e.preventDefault();
                            onStartTemplateConversation(
                              focusedProject.id,
                              effectiveQuickTypeId,
                              {
                                prompt: quickTaskPrompt.trim() || undefined,
                                creatorAgentId: effectiveQuickCreatorId || undefined,
                                autoSend: Boolean(quickTaskPrompt.trim()),
                              },
                            );
                            setQuickTaskPrompt('');
                            setShowQuickTaskForm(false);
                          }}
                          footer={
                            <>
                              <span className="text-[11px] text-slate-500">
                                发起后将自动进入该专家 Agent 的任务对话窗口
                              </span>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setShowQuickTaskForm(false)}
                                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                                >
                                  取消
                                </button>
                                <button
                                  type="submit"
                                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
                                >
                                  <MessageSquarePlus className="w-3.5 h-3.5" />
                                  <span>发起对话生成任务卡</span>
                                </button>
                              </div>
                            </>
                          }
                        >
                          <div className="space-y-3.5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-700">
                                  任务卡片模板
                                </label>
                                <select
                                  value={effectiveQuickTypeId}
                                  onChange={(e) => {
                                    setQuickTaskTypeId(e.target.value);
                                    setQuickCreatorAgentId('');
                                  }}
                                  aria-label="选择任务卡片模板"
                                  className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none"
                                >
                                  {focusedProjectTaskTypes.map((tt) => (
                                    <option key={tt.id} value={tt.id}>
                                      {tt.name}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-700">
                                  对话创作专家 Agent
                                </label>
                                <select
                                  value={effectiveQuickCreatorId}
                                  onChange={(e) => setQuickCreatorAgentId(e.target.value)}
                                  aria-label="选择对话创作专家 Agent"
                                  className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none"
                                >
                                  {quickFallbackCreators.map((ag) => (
                                    <option key={ag.id} value={ag.id}>
                                      {formatAgentDisplayName(ag.handle, ag.runtimeAgent, ag.defaultModel)}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-slate-700">
                                需求目标与上下文说明
                              </label>
                              <textarea
                                rows={4}
                                autoFocus
                                value={quickTaskPrompt}
                                onChange={(e) => setQuickTaskPrompt(e.target.value)}
                                placeholder={`向 ${
                                  quickDispatchAgent
                                    ? formatAgentDisplayName(
                                        quickDispatchAgent.handle,
                                        quickDispatchAgent.runtimeAgent,
                                        quickDispatchAgent.defaultModel,
                                      )
                                    : '指定专家 Agent'
                                } 描述需求目标，发起对话由 AI 生成任务计划卡...`}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 resize-none"
                              />
                            </div>

                            {selectedQuickType?.templateChecklist && (
                              <div className="rounded-lg bg-slate-50 border border-slate-200/80 px-3 py-2 text-[11px] text-slate-600">
                                <span className="font-semibold text-slate-700">交付骨架：</span>
                                {selectedQuickType.templateChecklist}
                              </div>
                            )}
                          </div>
                        </ModalShell>

                        <div className="grid grid-cols-1 @[720px]:grid-cols-3 gap-4">
                          {WORK_CARD_STAGES.filter((col) => col.status !== 'done').map((col) => {
                            const colTasks = focusedKanbanTasks.filter((t) =>
                              col.status === 'in_progress'
                                ? t.status === 'in_progress' || executingTaskId === t.id
                                : t.status === col.status && executingTaskId !== t.id,
                            );
                            return (
                              <div
                                key={col.status}
                                className="bg-slate-100/80 border border-slate-200/80 rounded-xl p-3 flex flex-col"
                              >
                                <div className="px-1.5 pb-2.5 mb-2.5 border-b border-slate-200 flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`w-2 h-2 rounded-full shrink-0 ${col.activeSegmentCls}`}
                                      />
                                      <h4 className={`text-sm font-bold ${col.textCls}`}>
                                        {col.label}
                                      </h4>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                                      {col.hint}
                                    </p>
                                  </div>
                                  <span className="text-xs font-mono tabular-nums font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md shrink-0">
                                    {colTasks.length}
                                  </span>
                                </div>

                                <div className="space-y-3 flex-1">
                                  {colTasks.length === 0 ? (
                                    <div className="h-28 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-400">
                                      暂无{col.label}任务
                                    </div>
                                  ) : (
                                    colTasks.map((task) => {
                                      const agent = agentMap.get(task.assigneeId);
                                      const snap = snapshotByAgentId.get(task.assigneeId);
                                      const isExecuting = executingTaskId === task.id;
                                      const taskType = resolveTaskType(
                                        task,
                                        focusedProjectTaskTypes,
                                      );
                                      const typeStyle = TASK_TYPE_ACCENT_STYLES[taskType.accent];

                                      return (
                                        <article
                                          key={task.id}
                                          className="bg-white rounded-lg p-3.5 border border-slate-200 hover:border-slate-300 transition-colors flex flex-col gap-2.5"
                                        >
                                          <div className="flex items-center justify-between gap-2">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setTaskTypeFilter((cur) =>
                                                  cur === taskType.id ? 'all' : taskType.id,
                                                )
                                              }
                                              title={`任务类型：${taskType.name}（点击筛选同类型卡片）`}
                                              className="inline-flex items-center gap-1.5 text-[11px] font-semibold hover:underline cursor-pointer min-w-0 truncate"
                                            >
                                              <span
                                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${typeStyle.dotCls}`}
                                              />
                                              <span className={typeStyle.textCls}>
                                                {taskType.name}
                                              </span>
                                              {task.featureModule &&
                                                task.featureModule !== taskType.name && (
                                                  <>
                                                    <span
                                                      className="text-slate-300"
                                                      aria-hidden="true"
                                                    >
                                                      ·
                                                    </span>
                                                    <span className="text-slate-400 font-normal truncate">
                                                      {task.featureModule}
                                                    </span>
                                                  </>
                                                )}
                                            </button>
                                            <WorkStatusBadge
                                              status={task.status}
                                              executing={isExecuting}
                                            />
                                          </div>

                                          <div>
                                            <h5 className="text-sm font-semibold text-slate-900 leading-snug">
                                              {task.title}
                                            </h5>
                                            <p className="text-xs text-slate-600 mt-1 leading-relaxed line-clamp-2">
                                              {task.description}
                                            </p>
                                          </div>

                                          {task.dependsOnTaskId && (
                                            <div className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                                              <GitBranch className="w-3 h-3 text-slate-400" />
                                              <span>依赖 {task.dependsOnTaskId}</span>
                                            </div>
                                          )}

                                          {task.deliverableArtifact && (
                                            <div className="rounded-md bg-slate-50 border border-slate-200/80 px-2.5 py-2 space-y-1">
                                              {task.deliverableSummary && (
                                                <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2">
                                                  {task.deliverableSummary}
                                                </p>
                                              )}
                                              <div className="flex items-center gap-1 font-mono text-[11px] text-blue-700 truncate">
                                                <FileCode2 className="w-3 h-3 shrink-0" />
                                                <span className="truncate">
                                                  {task.deliverableArtifact}
                                                </span>
                                              </div>
                                            </div>
                                          )}

                                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                              <EntityAvatar
                                                kind="agent"
                                                code={agent?.avatarCode || 'AI'}
                                                accent={agent?.avatarAccent || '#334155'}
                                                size="xs"
                                                showCornerMark={false}
                                              />
                                              <AgentIdentityName
                                                name={task.assigneeHandle}
                                                runtime={agent?.runtimeAgent}
                                                model={agent?.defaultModel}
                                                showModel
                                                className="font-semibold text-slate-900"
                                              />
                                            </div>
                                            {snap && (
                                              <span
                                                title={`${snap.availabilityLabel} · ${snap.availabilityDetail}`}
                                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                                  snap.availability === 'busy'
                                                    ? 'bg-blue-600'
                                                    : snap.availability === 'idle'
                                                      ? 'bg-emerald-500'
                                                      : 'bg-slate-400'
                                                }`}
                                              />
                                            )}
                                          </div>

                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <button
                                              type="button"
                                              onClick={() => onOpenTaskSession(task.id)}
                                              className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-semibold text-slate-800 whitespace-nowrap cursor-pointer shrink-0"
                                            >
                                              <MessageSquareCode className="w-3.5 h-3.5 text-indigo-600" />
                                              <span>任务会话</span>
                                            </button>

                                            {!isExecuting && (
                                              <select
                                                value={task.status}
                                                disabled={isReadOnly}
                                                onChange={(e) =>
                                                  onUpdateStatus(
                                                    task.id,
                                                    e.target.value as TaskStatus,
                                                  )
                                                }
                                                aria-label={`切换任务「${task.title}」阶段`}
                                                title={
                                                  isReadOnly
                                                    ? '项目已只读锁定，请先重新激活'
                                                    : '变更阶段将 1:1 实时同步至「任务编排」并交接对应阶段专家 Agent'
                                                }
                                                className="h-7 rounded-md border border-slate-200 bg-white hover:bg-slate-50 px-1.5 text-[11px] font-semibold text-slate-700 focus:outline-none cursor-pointer shrink-0 disabled:opacity-45 disabled:cursor-not-allowed"
                                              >
                                                <option value="pending">任务计划</option>
                                                <option value="in_progress">任务执行</option>
                                                <option value="review">任务验证</option>
                                                <option value="done">已完成</option>
                                              </select>
                                            )}

                                            {task.status === 'pending' && !isExecuting && (
                                              <button
                                                type="button"
                                                disabled={isReadOnly || Boolean(executingTaskId)}
                                                onClick={() => onRunTask(task.id)}
                                                className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-semibold bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                                              >
                                                <Play className="w-3 h-3" />
                                                <span>开始执行</span>
                                              </button>
                                            )}

                                            {(task.status === 'in_progress' || isExecuting) &&
                                              (isExecuting ? (
                                                <div className="flex-1 text-center py-1.5 px-2 text-[11px] font-semibold text-blue-700 bg-blue-50 rounded-md truncate">
                                                  执行中...
                                                </div>
                                              ) : (
                                                <button
                                                  type="button"
                                                  disabled={isReadOnly}
                                                  onClick={() => onUpdateStatus(task.id, 'review')}
                                                  className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-semibold bg-amber-500 hover:bg-amber-600 text-white whitespace-nowrap cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                                                >
                                                  <span>提交验证</span>
                                                </button>
                                              ))}

                                            {task.status === 'review' && !isExecuting && (
                                              <>
                                                <button
                                                  type="button"
                                                  disabled={isReadOnly}
                                                  onClick={() => onUpdateStatus(task.id, 'done')}
                                                  className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                                                >
                                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                                  <span>验收完成</span>
                                                </button>
                                                <button
                                                  type="button"
                                                  disabled={isReadOnly}
                                                  onClick={() => onUpdateStatus(task.id, 'pending')}
                                                  title="退回任务计划"
                                                  className="p-1.5 rounded-md border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 cursor-pointer shrink-0 disabled:opacity-45 disabled:cursor-not-allowed"
                                                >
                                                  <RotateCcw className="w-3.5 h-3.5" />
                                                </button>
                                              </>
                                            )}

                                            {task.status === 'done' && (
                                              <div className="flex-1 flex items-center justify-end gap-1 text-[11px] text-emerald-700 font-semibold whitespace-nowrap">
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                <span>已完成</span>
                                              </div>
                                            )}
                                          </div>
                                        </article>
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Completed Task Cards Inbox Modal */}
                        {(() => {
                          const completedTasks = focusedKanbanTasks.filter(
                            (t) => t.status === 'done' && executingTaskId !== t.id,
                          );
                          return (
                            <ModalShell
                              open={showCompletedInbox}
                              onClose={() => setShowCompletedInbox(false)}
                              icon={<Inbox className="w-4 h-4 text-emerald-600" />}
                              title={`已完成卡片 (${completedTasks.length})`}
                              subtitle={`${focusedProject.name} · 已验收交付的任务自动归档于此`}
                              maxWidthClass="max-w-2xl"
                            >
                              {completedTasks.length === 0 ? (
                                <EmptyStateCard
                                  compact
                                  title="暂无已完成卡片"
                                  description="在「任务验证」列点击「验收完成」后，对应任务卡片将统一收口至此处。"
                                />
                              ) : (
                                <div className="space-y-3">
                                  {completedTasks.map((task) => {
                                    const agent = agentMap.get(task.assigneeId);
                                    const taskType = resolveTaskType(
                                      task,
                                      focusedProjectTaskTypes,
                                    );
                                    const typeStyle = TASK_TYPE_ACCENT_STYLES[taskType.accent];
                                    return (
                                      <article
                                        key={task.id}
                                        className="bg-white rounded-xl p-3.5 border border-slate-200 flex flex-col gap-2.5"
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="min-w-0 space-y-1">
                                            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                              <span className={`font-semibold ${typeStyle.textCls}`}>
                                                {taskType.name}
                                              </span>
                                              {task.featureModule &&
                                                task.featureModule !== taskType.name && (
                                                  <>
                                                    <span className="text-slate-300" aria-hidden="true">
                                                      ·
                                                    </span>
                                                    <span className="text-slate-400">
                                                      {task.featureModule}
                                                    </span>
                                                  </>
                                                )}
                                            </div>
                                            <h5 className="text-sm font-semibold text-slate-900 leading-snug">
                                              {task.title}
                                            </h5>
                                          </div>
                                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 shrink-0">
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            <span>已完成</span>
                                          </span>
                                        </div>

                                        <p className="text-xs text-slate-600 leading-relaxed">
                                          {task.description}
                                        </p>

                                        {task.deliverableArtifact && (
                                          <div className="rounded-md bg-slate-50 border border-slate-200/80 px-2.5 py-2 space-y-1">
                                            {task.deliverableSummary && (
                                              <p className="text-[11px] text-slate-600 leading-relaxed">
                                                {task.deliverableSummary}
                                              </p>
                                            )}
                                            <div className="flex items-center gap-1 font-mono text-[11px] text-blue-700 truncate">
                                              <FileCode2 className="w-3 h-3 shrink-0" />
                                              <span className="truncate">
                                                {task.deliverableArtifact}
                                              </span>
                                            </div>
                                          </div>
                                        )}

                                        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <EntityAvatar
                                              kind="agent"
                                              code={agent?.avatarCode || 'AI'}
                                              accent={agent?.avatarAccent || '#334155'}
                                              size="xs"
                                              showCornerMark={false}
                                            />
                                            <AgentIdentityName
                                              name={task.assigneeHandle}
                                              runtime={agent?.runtimeAgent}
                                              model={agent?.defaultModel}
                                              showModel
                                              className="font-semibold text-slate-900"
                                            />
                                          </div>

                                          <div className="flex items-center gap-1.5 shrink-0">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setShowCompletedInbox(false);
                                                onOpenTaskSession(task.id);
                                              }}
                                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-semibold text-slate-800 cursor-pointer whitespace-nowrap"
                                            >
                                              <MessageSquareCode className="w-3.5 h-3.5 text-indigo-600" />
                                              <span>任务会话</span>
                                            </button>
                                            {!isReadOnly && (
                                              <button
                                                type="button"
                                                onClick={() => onUpdateStatus(task.id, 'review')}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-600 hover:text-slate-900 cursor-pointer whitespace-nowrap"
                                              >
                                                <RotateCcw className="w-3 h-3" />
                                                <span>退回验证</span>
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      </article>
                                    );
                                  })}
                                </div>
                              )}
                            </ModalShell>
                          );
                        })()}
                      </section>
                    </div>
                  );
                })()
              )}
            </div>
          )}

          {/* ================= WORK PROJECTS 3: TASK ORCHESTRATION ================= */}
          {activeTab === 'orchestration' && activePipelineProject && (
            <div className={WORKSPACE_MAX_WIDTH_CLASS}>
              <ProjectOrchestrationPanel
                project={activePipelineProject}
                assignments={projectAgentAssignments[activePipelineProject.id] || []}
                taskTypes={
                  projectTaskTypes[activePipelineProject.id] || DEFAULT_PROJECT_TASK_TYPES
                }
                agents={agents}
                agentLeases={agentLeases}
                computeNodes={computeNodes}
                spaceSharedNodes={spaceSharedNodes}
                zones={zones}
                storageVolumes={storageVolumes}
                onAddAgentAssignment={onAddProjectAgentAssignment}
                onRemoveAgentAssignment={onRemoveProjectAgentAssignment}
                onUpdateAgentAssignment={onUpdateProjectAgentAssignment}
                onAddTaskType={onAddProjectTaskType}
                onUpdateTaskType={onUpdateProjectTaskType}
                onDeleteTaskType={onDeleteProjectTaskType}
                onApplyTaskTypePresetPack={onApplyTaskTypePresetPack}
                onStartTemplateConversation={onStartTemplateConversation}
                onJumpToSpaceAgents={onJumpToTeam}
                onJumpToMarket={onJumpToMarket}
                onReactivateProject={() =>
                  onUpdateProjectLifecycle(activePipelineProject.id, 'active')
                }
              />
            </div>
          )}
        </div>
      </div>
      )}

      {/* Unified Create Project Modal */}
      <ModalShell
        open={showCreateProjectForm}
        onClose={() => setShowCreateProjectForm(false)}
        icon={<FolderKanban className="w-4 h-4 text-blue-600" />}
        title="新建工作项目"
        subtitle="支持绑定个人 Agent 节点或 Agent 社区共享节点，创建后自动建群并进入看板"
        maxWidthClass="max-w-lg"
        onSubmit={handleCreateProjectSubmit}
        footer={
          <>
            <span className="text-[11px] text-slate-500">
              项目创建后可随时在「任务编排」中调整专家与模板
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowCreateProjectForm(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
              >
                创建并进入项目看板
              </button>
            </div>
          </>
        }
      >
        <div className="space-y-3.5">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">项目名称 *</label>
            <input
              type="text"
              required
              autoFocus
              value={projName}
              onChange={(e) => setProjName(e.target.value)}
              placeholder="如：海外独立站支付重构"
              className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">核心交付目标（可选）</label>
            <input
              type="text"
              value={projGoal}
              onChange={(e) => setProjGoal(e.target.value)}
              placeholder="一句话描述项目阶段目标与交付范围"
              className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">所属社区 / 归属</label>
            <select
              value={projZoneId}
              onChange={(e) => {
                const nextZoneId = e.target.value;
                setProjZoneId(nextZoneId);
                const matchingShared = accessibleSharedNodes.find(
                  (sn) => sn.zoneId === nextZoneId && sn.status === 'online',
                );
                if (matchingShared) {
                  setProjNodeId(matchingShared.id);
                }
              }}
              className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs text-slate-900 focus:bg-white focus:outline-none"
            >
              <option value="">归属：个人私有项目</option>
              {joinedZones.map((z) => (
                <option key={z.id} value={z.id}>
                  归属：{z.name}（{z.typeLabel}）
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">运行 Agent 节点</label>
              <select
                value={projNodeId}
                onChange={(e) => setProjNodeId(e.target.value)}
                className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none"
              >
                <option value="">暂不指定运行节点</option>
                <optgroup label="个人 Agent 节点">
                  {computeNodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      个人节点：{n.name} ({n.cpuCores}C/{n.memoryGb}G)
                    </option>
                  ))}
                </optgroup>
                {accessibleSharedNodes.length > 0 && (
                  <optgroup label="Agent 社区 · 共享节点">
                    {accessibleSharedNodes.map((sn) => {
                      const z = zoneMap.get(sn.zoneId);
                      return (
                        <option key={sn.id} value={sn.id}>
                          [{z?.shortCode || '共享'}·{z?.name || 'Agent 社区'}] {sn.name} (
                          {sn.cpuCores}C/{sn.memoryGb}G)
                        </option>
                      );
                    })}
                  </optgroup>
                )}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">挂载存储卷</label>
              <select
                value={projVolumeId}
                onChange={(e) => setProjVolumeId(e.target.value)}
                className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none"
              >
                <option value="">暂不指定存储卷</option>
                {storageVolumes.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.quotaGb}GB)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </ModalShell>
    </div>
  );
}
