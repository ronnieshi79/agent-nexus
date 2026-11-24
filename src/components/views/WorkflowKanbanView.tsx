import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Activity,
  Archive,
  ArrowLeft,
  ArrowUpRight,
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  Compass,
  Cpu,
  Database,
  DollarSign,
  FileCode2,
  FolderKanban,
  GitBranch,
  Globe,
  Lock,
  MessageSquareCode,
  Play,
  Plus,
  RotateCcw,
  Server,
  TrendingUp,
  UserMinus,
  Users,
  X,
} from 'lucide-react';
import type {
  AgentLeaseRecord,
  CommunityZone,
  ComputeNode,
  ExpertAgent,
  HumanExpert,
  LeasePeriod,
  NegotiationThread,
  ProjectLifecycleStatus,
  ProjectRole,
  ProjectStageSlot,
  ProjectWorkspace,
  SettlementRecord,
  SpaceSharedNode,
  StorageVolume,
  TaskStatus,
  TeamExpertMembership,
  WorkCardType,
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
import {
  RailNavButton,
  RailSectionLabel,
  ToolbarDropdown,
  ToolbarSearch,
  ViewToolbar,
  WORKSPACE_GUTTER_CLASS,
  WORKSPACE_MAX_WIDTH_CLASS,
  WorkspacePrimaryRail,
} from '../shared/ViewToolbar';
import { WORK_CARD_STAGES, WorkStatusBadge } from '../workcard/WorkCardFlow';
import { ProjectOrchestrationPanel } from '../workspace/ProjectOrchestrationPanel';

export type WorkKanbanTab = WorkspaceTabId;

interface WorkflowKanbanViewProps {
  zones: CommunityZone[];
  joinedZoneIds: string[];
  spaceSharedNodes: SpaceSharedNode[];
  workspaces: ProjectWorkspace[];
  computeNodes: ComputeNode[];
  storageVolumes: StorageVolume[];
  projectPipelines: Record<string, ProjectStageSlot[]>;
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
  onUpdateAgentRuntimeConfig: (
    agentId: string,
    runtimeAgent: string,
    defaultModel: string,
  ) => void;
  onUpdateProjectLifecycle: (workspaceId: string, status: ProjectLifecycleStatus) => void;
  onUpdateProjectStageSlot: (
    projectId: string,
    stage: WorkCardType,
    patch: Partial<Omit<ProjectStageSlot, 'stage'>>,
  ) => void;
  onSyncPipelineAgentsToProject: (projectId: string) => void;
}

const WORK_TYPE_LABELS: Record<WorkCardType, string> = {
  planning: '产品策划',
  development: '功能开发',
  testing: '功能测试',
  review: '架构评审',
};

const WORK_TYPE_COLORS: Record<WorkCardType, string> = {
  planning: 'text-indigo-700',
  development: 'text-blue-700',
  testing: 'text-teal-700',
  review: 'text-amber-700',
};

const ROLE_META: Record<ProjectRole, { label: string; cls: string }> = {
  leading: { label: '我主管', cls: 'text-blue-700' },
  participating: { label: '我参与', cls: 'text-indigo-700' },
};

const LIFECYCLE_META: Record<ProjectLifecycleStatus, { label: string; cls: string; dotCls: string }> = {
  active: { label: '开发中', cls: 'text-blue-700', dotCls: 'bg-blue-600' },
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
  privateTokensK: number;
  privateTokenCostUsd: number;
}

function estimatePrivateTokensK(agent: ExpertAgent, taskList: WorkflowTask[]): number {
  if (agent.ownership !== 'private') return 0;
  const baseK = agent.performance.completedProjects * 34;
  const taskK = taskList.reduce((sum, t) => {
    if (t.status === 'done') return sum + 92;
    if (t.status === 'review') return sum + 78;
    if (t.status === 'in_progress') return sum + 54;
    return sum + 14;
  }, 0);
  return baseK + taskK;
}

function formatTokensK(k: number): string {
  if (k >= 1000) return `${(k / 1000).toFixed(2)}M`;
  return `${Math.round(k)}k`;
}

export function WorkflowKanbanView({
  zones,
  joinedZoneIds,
  spaceSharedNodes,
  workspaces,
  computeNodes,
  storageVolumes,
  projectPipelines,
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
  onUpdateAgentRuntimeConfig,
  onUpdateProjectLifecycle,
  onUpdateProjectStageSlot,
  onSyncPipelineAgentsToProject,
}: WorkflowKanbanViewProps) {
  const [activeTab, setActiveTab] = useState<WorkKanbanTab>('overview');
  const [assignExpertId, setAssignExpertId] = useState<string>('');

  // Shared right-toolbar keyword search
  const [searchKeyword, setSearchKeyword] = useState('');

  // My Projects & Overview state
  const [lifecycleFilter, setLifecycleFilter] = useState<'all' | ProjectLifecycleStatus>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | ProjectRole>('all');
  const [focusedProjectId, setFocusedProjectId] = useState<string | null>(null);
  const [showCreateProjectForm, setShowCreateProjectForm] = useState(false);
  const [projName, setProjName] = useState('');
  const [projGoal, setProjGoal] = useState('');
  const [projZoneId, setProjZoneId] = useState<string>(zones[0]?.id || 'zone_public');
  const [projNodeId, setProjNodeId] = useState<string>(
    computeNodes.find((n) => n.status === 'online')?.id || computeNodes[0]?.id || '',
  );
  const [projVolumeId, setProjVolumeId] = useState<string>(storageVolumes[0]?.id || '');

  // Kanban Task Flow state
  const [kanbanProjectScope, setKanbanProjectScope] = useState<string>('all');
  const [kanbanAgentFilter, setKanbanAgentFilter] = useState<string>('all');
  const [workTypeFilter, setWorkTypeFilter] = useState<'all' | WorkCardType>('all');

  // Work Orchestration state
  const [pipelineProjectId, setPipelineProjectId] = useState<string>(workspaces[0]?.id || '');

  useEffect(() => {
    if (projectSeed) {
      setKanbanProjectScope(projectSeed);
      if (projectSeed !== 'all') {
        setFocusedProjectId(projectSeed);
        setPipelineProjectId(projectSeed);
      }
      onClearProjectSeed();
    }
  }, [projectSeed, onClearProjectSeed]);

  useEffect(() => {
    if (tabSeed) {
      setActiveTab(tabSeed);
      onClearTabSeed();
    }
  }, [tabSeed, onClearTabSeed]);

  const zoneMap = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);
  const joinedZones = useMemo(
    () => zones.filter((z) => z.isPlatformDefault || joinedZoneIds.includes(z.id)),
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
    const isEnterprise = z.kind === 'enterprise';
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold ${
          isEnterprise
            ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
            : 'bg-sky-50 border-sky-200 text-sky-700'
        }`}
      >
        {isEnterprise ? (
          <Building2 className="w-2.5 h-2.5 shrink-0" />
        ) : (
          <Globe className="w-2.5 h-2.5 shrink-0" />
        )}
        <span>
          {isEnterprise ? '企业封闭' : '开放社区'} · {z.name}
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
          reviewCount > 0 ? `${reviewCount} 项产物待验证` : `${pendingCount} 项任务待批准`;
      } else {
        availability = 'idle';
        availabilityLabel = '在线 · 空闲';
        availabilityDetail =
          pendingCount === 1 ? '1 项待批准 · 可并行接单' : '档期充裕 · 可随时派单';
      }

      const privateTokensK = estimatePrivateTokensK(agent, agentTasks);
      const privateTokenCostUsd = Number(((privateTokensK / 1000) * 12).toFixed(1));

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
        privateTokensK,
        privateTokenCostUsd,
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

  // Space Metrics
  const onlineNodesCount = computeNodes.filter((n) => n.status === 'online').length;
  const totalCpuCores = computeNodes.reduce((s, n) => s + n.cpuCores, 0);
  const totalVolQuotaGb = storageVolumes.reduce((s, v) => s + v.quotaGb, 0);
  const totalVolUsedGb = storageVolumes.reduce((s, v) => s + v.usedGb, 0);
  const storagePct =
    totalVolQuotaGb > 0 ? Math.round((totalVolUsedGb / totalVolQuotaGb) * 100) : 0;
  const totalInstalledClisCount = computeNodes.reduce(
    (sum, n) => sum + n.installedClis.length,
    0,
  );

  // Project Metrics
  const activeProjCount = workspaces.filter(
    (w) => (w.lifecycleStatus || 'active') === 'active',
  ).length;
  const completedProjCount = workspaces.filter((w) => w.lifecycleStatus === 'completed').length;
  const archivedProjCount = workspaces.filter((w) => w.lifecycleStatus === 'archived').length;
  const leadingCount = workspaces.filter((w) => w.role === 'leading').length;
  const participatingCount = workspaces.filter((w) => w.role === 'participating').length;

  const reviewCount = allTasks.filter((t) => t.status === 'review').length;
  const doneCount = allTasks.filter((t) => t.status === 'done').length;
  const progressPct = allTasks.length > 0 ? Math.round((doneCount / allTasks.length) * 100) : 0;

  const totalExternalSpentUsd = workspaces.reduce((sum, w) => sum + w.spentUsd, 0);
  const totalBudgetCapUsd = workspaces.reduce((sum, w) => sum + w.budgetCapUsd, 0);
  const totalPrivateTokensK = agentSnapshots.reduce((sum, s) => sum + s.privateTokensK, 0);
  const totalPrivateTokenCostUsd = agentSnapshots.reduce(
    (sum, s) => sum + s.privateTokenCostUsd,
    0,
  );
  const busyAgentCount = agentSnapshots.filter((s) => s.availability === 'busy').length;
  const idleAgentCount = agentSnapshots.filter((s) => s.availability === 'idle').length;
  const pendingNegotiationCount = negotiations.filter((n) => n.status !== 'hired').length;

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
    () => (focusedProjectId ? workspaceMap.get(focusedProjectId) || null : null),
    [focusedProjectId, workspaceMap],
  );

  const focusedProjectTasks = useMemo(
    () => (focusedProject ? allTasks.filter((t) => t.sessionId === focusedProject.id) : []),
    [allTasks, focusedProject],
  );

  const focusedModules = useMemo(() => {
    if (!focusedProject) return [];
    const map = new Map<string, WorkflowTask[]>();
    focusedProjectTasks.forEach((t) => {
      const list = map.get(t.featureModule) || [];
      list.push(t);
      map.set(t.featureModule, list);
    });
    return Array.from(map.entries());
  }, [focusedProject, focusedProjectTasks]);

  const kanbanTasks = useMemo(() => {
    return allTasks.filter((t) => {
      if (kanbanProjectScope !== 'all' && t.sessionId !== kanbanProjectScope) return false;
      if (kanbanAgentFilter !== 'all' && t.assigneeId !== kanbanAgentFilter) return false;
      if (workTypeFilter !== 'all' && t.workType !== workTypeFilter) return false;
      if (normalizedQuery) {
        const wsName = workspaceMap.get(t.sessionId)?.name || '';
        const match =
          t.title.toLowerCase().includes(normalizedQuery) ||
          t.description.toLowerCase().includes(normalizedQuery) ||
          t.featureModule.toLowerCase().includes(normalizedQuery) ||
          t.assigneeHandle.toLowerCase().includes(normalizedQuery) ||
          wsName.toLowerCase().includes(normalizedQuery);
        if (!match) return false;
      }
      return true;
    });
  }, [
    allTasks,
    kanbanAgentFilter,
    kanbanProjectScope,
    normalizedQuery,
    workTypeFilter,
    workspaceMap,
  ]);

  const kanbanAssignableAgents = useMemo(() => {
    const ids = new Set(allTasks.map((t) => t.assigneeId));
    return agents.filter((a) => ids.has(a.id));
  }, [agents, allTasks]);

  const activePipelineProject =
    workspaces.find((w) => w.id === pipelineProjectId) || workspaces[0];

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
      setFocusedProjectId(newId);
      setPipelineProjectId(newId);
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
    activeTab === 'kanban'
      ? '搜索任务标题、模块、项目或执行 Agent...'
      : '搜索项目名称、目标或范围...';

  const switchTab = (next: WorkKanbanTab) => {
    setActiveTab(next);
    if (next !== 'my_projects') setFocusedProjectId(null);
  };

  return (
    <div className="h-full flex min-h-0 bg-white relative @container/shell">
      {/* FAR-LEFT PRIMARY NAVIGATION RAIL: Focused Pure Work Projects Group */}
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
            onClick={() => {
              setActiveTab('my_projects');
              setFocusedProjectId(null);
            }}
            icon={<FolderKanban className="w-3.5 h-3.5" />}
            label="我的项目"
            count={workspaces.length}
          />
          <RailNavButton
            variant="primary"
            active={activeTab === 'kanban'}
            onClick={() => switchTab('kanban')}
            icon={<Briefcase className="w-3.5 h-3.5" />}
            label="项目看板"
            count={allTasks.length}
          />
          <RailNavButton
            variant="primary"
            active={activeTab === 'orchestration'}
            onClick={() => switchTab('orchestration')}
            icon={<GitBranch className="w-3.5 h-3.5" />}
            label="工作编排"
            count={4}
          />
        </div>
      </WorkspacePrimaryRail>

      {/* RIGHT WORKSPACE COLUMN: Flush-Aligned Toolbar + Main Canvas */}
      <div className="flex-1 min-w-0 flex flex-col h-full min-h-0 @container/view">
        <ViewToolbar
          left={
            <>
              {activeTab === 'my_projects' && focusedProject ? (
                <button
                  type="button"
                  onClick={() => setFocusedProjectId(null)}
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 whitespace-nowrap cursor-pointer shrink-0"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>返回我的项目</span>
                </button>
              ) : activeTab === 'orchestration' && activePipelineProject ? (
                <ToolbarDropdown
                  label="编排项目"
                  value={activePipelineProject.id}
                  defaultValue=""
                  onChange={setPipelineProjectId}
                  options={workspaces.map((w) => ({
                    id: w.id,
                    label: w.name,
                    hint: LIFECYCLE_META[w.lifecycleStatus || 'active'].label,
                  }))}
                />
              ) : (
                <ToolbarSearch
                  value={searchKeyword}
                  onChange={setSearchKeyword}
                  placeholder={searchPlaceholder}
                  widthClass="flex-1 min-w-[160px] max-w-[290px]"
                />
              )}

              {/* Overview & My Projects secondary filters */}
              {(activeTab === 'overview' || (activeTab === 'my_projects' && !focusedProject)) && (
                <>
                  <ToolbarDropdown
                    label="状态"
                    value={lifecycleFilter}
                    defaultValue="all"
                    onChange={setLifecycleFilter}
                    options={[
                      { id: 'all', label: '全部状态', hint: `${workspaces.length}` },
                      { id: 'active', label: '开发中', hint: `${activeProjCount}` },
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
                </>
              )}

              {/* Kanban secondary filters */}
              {activeTab === 'kanban' && (
                <>
                  <ToolbarDropdown
                    label="项目"
                    value={kanbanProjectScope}
                    defaultValue="all"
                    onChange={setKanbanProjectScope}
                    options={[
                      { id: 'all', label: '全部项目', hint: `${allTasks.length}` },
                      ...workspaces.map((w) => ({
                        id: w.id,
                        label: w.name,
                        hint: `${allTasks.filter((t) => t.sessionId === w.id).length}`,
                      })),
                    ]}
                  />
                  <ToolbarDropdown
                    label="执行 Agent"
                    value={kanbanAgentFilter}
                    defaultValue="all"
                    onChange={setKanbanAgentFilter}
                    options={[
                      { id: 'all', label: '全部 Agent' },
                      ...kanbanAssignableAgents.map((a) => ({
                        id: a.id,
                        label: formatAgentDisplayName(a.handle, a.runtimeAgent),
                        hint: `${allTasks.filter((t) => t.assigneeId === a.id).length}`,
                      })),
                    ]}
                  />
                  <ToolbarDropdown
                    label="阶段"
                    value={workTypeFilter}
                    defaultValue="all"
                    onChange={setWorkTypeFilter}
                    options={[
                      { id: 'all', label: '全部阶段' },
                      { id: 'planning', label: '产品策划' },
                      { id: 'development', label: '功能开发' },
                      { id: 'testing', label: '功能测试' },
                      { id: 'review', label: '架构评审' },
                    ]}
                  />
                </>
              )}
            </>
          }
          right={
            <>
              {(activeTab === 'overview' || (activeTab === 'my_projects' && !focusedProject)) && (
                <>
                  <span className="hidden @[960px]:inline-flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums mr-1">
                    <span>节点 {onlineNodesCount}/{computeNodes.length}</span>
                    <span className="text-slate-300" aria-hidden="true">·</span>
                    <span>开发中 {activeProjCount}</span>
                    <span className="text-slate-300" aria-hidden="true">·</span>
                    <span>待验证 {reviewCount}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('my_projects');
                      setFocusedProjectId(null);
                      setShowCreateProjectForm(true);
                    }}
                    className="inline-flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white whitespace-nowrap cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>新建项目</span>
                  </button>
                </>
              )}

              {activeTab === 'kanban' && (
                <span className="hidden @[860px]:inline-flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
                  <span>完成 {progressPct}%</span>
                  <span className="text-slate-300" aria-hidden="true">·</span>
                  <span>待验证 {reviewCount}</span>
                </span>
              )}

              {activeTab === 'orchestration' && (
                <button
                  type="button"
                  onClick={onJumpToTeam}
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 whitespace-nowrap cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5 text-indigo-600" />
                  <span>管理 AGN 空间 Agent</span>
                </button>
              )}
            </>
          }
        />

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
                { id: 'my_projects', label: '我的项目' },
                { id: 'kanban', label: '项目看板' },
                { id: 'orchestration', label: '工作编排' },
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

          {/* ================= WORK PROJECTS 1: PROJECT OVERVIEW ================= */}
          {activeTab === 'overview' && (
            <div className={`${WORKSPACE_MAX_WIDTH_CLASS} space-y-5`}>
              {/* Top 4 KPI Cards: Agent Nodes & Storage | Project Lifecycle | Cost & Tokens | Agent Fleet */}
              <div className="grid grid-cols-1 @[520px]:grid-cols-2 @[980px]:grid-cols-4 gap-3.5">
                <button
                  type="button"
                  onClick={onJumpToTeamNodes}
                  className="text-left bg-white rounded-xl border border-slate-200 hover:border-slate-300 p-4 space-y-2 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-medium">Agent 节点与存储</span>
                    <Server className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                      {onlineNodesCount}/{computeNodes.length}
                      <span className="text-xs font-sans font-normal text-slate-400 ml-1">节点</span>
                    </span>
                    <span className="text-xs font-mono tabular-nums text-emerald-700 font-semibold">
                      {totalCpuCores}C · 存储 {storagePct}%
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center justify-between gap-2">
                    <span>
                      {storageVolumes.length} 存储卷 · {totalInstalledClisCount} CLI
                    </span>
                    <span className="text-blue-700 font-semibold">AGN 空间设置 →</span>
                  </div>
                </button>

                <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-medium">工作项目生命周期</span>
                    <TrendingUp className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                      {workspaces.length}
                      <span className="text-xs font-sans font-normal text-slate-400 ml-1">项目</span>
                    </span>
                    <span className="text-xs font-mono tabular-nums font-semibold text-blue-700">
                      任务完成 {progressPct}%
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center justify-between gap-2 font-mono tabular-nums">
                    <span>
                      开发中 {activeProjCount} · 已完成 {completedProjCount} · 归档{' '}
                      {archivedProjCount}
                    </span>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-medium">外部费用与自有 Token</span>
                    <DollarSign className="w-4 h-4 text-sky-600" />
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                      ${totalExternalSpentUsd.toLocaleString('en-US')}
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-slate-400">
                      / ${totalBudgetCapUsd.toLocaleString('en-US')} 预算
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center justify-between gap-2 font-mono tabular-nums">
                    <span>自有 {formatTokensK(totalPrivateTokensK)} tok</span>
                    <span className="text-sky-700">≈ ${totalPrivateTokenCostUsd.toFixed(1)}</span>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-medium">协同 Agent 在线与闲忙</span>
                    <Activity className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                      {agentSnapshots.length}
                      <span className="text-xs font-sans font-normal text-slate-400 ml-1">位</span>
                    </span>
                    <span className="text-xs font-semibold text-emerald-700 whitespace-nowrap">
                      空闲 {idleAgentCount} · 忙碌 {busyAgentCount}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center justify-between gap-2">
                    <span>
                      {pendingNegotiationCount > 0
                        ? `${pendingNegotiationCount} 项协商中`
                        : '全部工位就绪'}
                    </span>
                    <button
                      type="button"
                      onClick={() => switchTab('orchestration')}
                      className="text-blue-700 font-semibold cursor-pointer"
                    >
                      工作编排 →
                    </button>
                  </div>
                </div>
              </div>

              {/* 4-Stage Multi-Agent Workflow Summary Strip */}
              <section className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs font-bold text-slate-900">项目任务四态实时分布</h2>
                    <span className="text-[11px] text-slate-400">
                      待批准 → 执行中 → 待验证 → 已完成
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setKanbanProjectScope('all');
                      setKanbanAgentFilter('all');
                      switchTab('kanban');
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
                  >
                    <span>进入项目看板</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {WORK_CARD_STAGES.map((stage) => {
                    const stageTasks = allTasks.filter((t) =>
                      stage.status === 'in_progress'
                        ? t.status === 'in_progress' || executingTaskId === t.id
                        : t.status === stage.status && executingTaskId !== t.id,
                    );
                    const uniqueAgents = Array.from(
                      new Set(stageTasks.map((t) => displayEntityName(t.assigneeHandle))),
                    );

                    return (
                      <button
                        key={stage.status}
                        type="button"
                        onClick={() => {
                          setKanbanProjectScope('all');
                          switchTab('kanban');
                        }}
                        className="text-left rounded-lg bg-slate-50/80 hover:bg-slate-100/80 border border-slate-200/80 p-3 transition-colors cursor-pointer space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <WorkStatusBadge status={stage.status} />
                          <span className="text-lg font-bold font-mono tabular-nums text-slate-900">
                            {stageTasks.length}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {uniqueAgents.length > 0
                            ? `执行：${uniqueAgents.slice(0, 2).join('、')}${
                                uniqueAgents.length > 2 ? ` 等${uniqueAgents.length}位` : ''
                              }`
                            : stage.hint}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Lower Split: Project Overview List + Frequent Agents */}
              <div className="grid grid-cols-1 @[920px]:grid-cols-12 gap-4">
                <section className="@[920px]:col-span-7 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
                  <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">项目状态、空间载体与进度</h2>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        按生命周期总览各项目进展、绑定的运行节点与预算执行
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => switchTab('my_projects')}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer whitespace-nowrap"
                    >
                      我的项目 →
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100 flex-1">
                    {filteredMyProjects.map((proj) => {
                      const projTasks = allTasks.filter((t) => t.sessionId === proj.id);
                      const pDone = projTasks.filter((t) => t.status === 'done').length;
                      const pct =
                        projTasks.length > 0
                          ? Math.round((pDone / projTasks.length) * 100)
                          : proj.lifecycleStatus === 'completed' ||
                              proj.lifecycleStatus === 'archived'
                            ? 100
                            : 0;
                      const life = LIFECYCLE_META[proj.lifecycleStatus || 'active'];
                      const roleInfo = ROLE_META[proj.role];
                      const boundNodes = (proj.boundNodeIds || [])
                        .map((id) => getAnyNodeLabel(id))
                        .filter((v): v is string => Boolean(v));

                      return (
                        <div
                          key={proj.id}
                          className="p-4 hover:bg-slate-50/70 transition-colors space-y-2"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <FolderKanban className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                <span className="text-xs font-bold text-slate-900 truncate">
                                  {proj.name}
                                </span>
                                {renderSpaceOwnershipBadge(proj.sourceZoneId)}
                                <span
                                  className={`inline-flex items-center gap-1 text-[11px] font-semibold ${life.cls}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${life.dotCls}`} />
                                  <span>{life.label}</span>
                                </span>
                                <span className="text-slate-300" aria-hidden="true">·</span>
                                <span className={`text-[11px] font-semibold ${roleInfo.cls}`}>
                                  {roleInfo.label}
                                </span>
                              </div>
                              <div className="mt-1 text-[11px] text-slate-500 truncate">
                                载体节点：
                                {boundNodes.length > 0 ? boundNodes.join('、') : '按工位节点自动调度'}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setPipelineProjectId(proj.id);
                                  switchTab('orchestration');
                                }}
                                className="px-2 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
                              >
                                编排
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setKanbanProjectScope(proj.id);
                                  switchTab('kanban');
                                }}
                                className="px-2 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-white cursor-pointer whitespace-nowrap"
                              >
                                看板
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-3 pt-0.5">
                            <div className="flex items-center gap-2 flex-1 min-w-[120px]">
                              <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    proj.lifecycleStatus === 'completed'
                                      ? 'bg-emerald-500'
                                      : proj.lifecycleStatus === 'archived'
                                        ? 'bg-slate-400'
                                        : 'bg-blue-600'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-mono tabular-nums font-semibold text-slate-700">
                                {pct}%
                              </span>
                            </div>
                            <span className="text-[11px] font-mono tabular-nums text-slate-600">
                              ${proj.spentUsd.toLocaleString('en-US')} / $
                              {proj.budgetCapUsd.toLocaleString('en-US')}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="@[920px]:col-span-5 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
                  <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        <Cpu className="w-4 h-4 text-indigo-600" />
                        <span>活跃专业 Agent 与宿主机</span>
                      </h2>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        实时追踪 Agent 闲忙状态与物理/云载体节点
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onJumpToTeamNodes}
                      className="text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer whitespace-nowrap"
                    >
                      节点配置 →
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100 flex-1">
                    {agentSnapshots.slice(0, 6).map((snap) => {
                      const hostNodeLabel = snap.agent.hostNodeId
                        ? getAnyNodeLabel(snap.agent.hostNodeId)
                        : null;
                      return (
                        <div
                          key={snap.agent.id}
                          className="px-4 py-3 hover:bg-slate-50/70 transition-colors flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <EntityAvatar
                              kind="agent"
                              code={snap.agent.avatarCode}
                              accent={snap.agent.avatarAccent}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <AgentIdentityName
                                name={snap.agent.handle}
                                runtime={snap.agent.runtimeAgent}
                                model={snap.agent.defaultModel}
                                showModel
                                className="text-xs font-bold text-slate-900"
                              />
                              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500 truncate">
                                {renderAvailabilityIndicator(snap)}
                                <span className="text-slate-300" aria-hidden="true">·</span>
                                <span className="truncate">
                                  {hostNodeLabel
                                    ? hostNodeLabel
                                    : snap.agent.ownership === 'marketplace'
                                      ? `云端专家 (${snap.agent.region})`
                                      : '待绑定节点'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-[11px] font-mono tabular-nums font-semibold text-slate-800">
                              {snap.totalTasks} 任务
                            </div>
                            {snap.activeTask ? (
                              <button
                                type="button"
                                onClick={() => onOpenTaskSession(snap.activeTask!.id)}
                                className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 cursor-pointer whitespace-nowrap"
                              >
                                Session →
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400">待派单</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            </div>
          )}

          {/* ================= WORK PROJECTS 2: MY PROJECTS (Lifecycle + Space Binding) ================= */}
          {activeTab === 'my_projects' && (
            <div className={`${WORKSPACE_MAX_WIDTH_CLASS} space-y-4`}>
              {showCreateProjectForm && !focusedProject && (
                <form
                  onSubmit={handleCreateProjectSubmit}
                  className="p-4 rounded-xl bg-white border border-slate-200 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">
                      新建工作项目（支持绑定个人 Agent 节点或协作空间共享节点）
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCreateProjectForm(false)}
                      className="text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    <input
                      type="text"
                      required
                      value={projName}
                      onChange={(e) => setProjName(e.target.value)}
                      placeholder="项目名称（如：海外独立站支付重构）"
                      className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                    <input
                      type="text"
                      value={projGoal}
                      onChange={(e) => setProjGoal(e.target.value)}
                      placeholder="核心交付目标（可选）"
                      className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
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
                      className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:bg-white focus:outline-none"
                    >
                      <option value="">归属：个人私有项目</option>
                      {joinedZones.map((z) => (
                        <option key={z.id} value={z.id}>
                          归属：{z.name}（{z.typeLabel}）
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    <select
                      value={projNodeId}
                      onChange={(e) => setProjNodeId(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:bg-white focus:outline-none"
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
                        <optgroup label="协作空间 · 共享节点">
                          {accessibleSharedNodes.map((sn) => {
                            const z = zoneMap.get(sn.zoneId);
                            return (
                              <option key={sn.id} value={sn.id}>
                                [{z?.shortCode || '共享'}·{z?.name || '协作空间'}] {sn.name} (
                                {sn.cpuCores}C/{sn.memoryGb}G)
                              </option>
                            );
                          })}
                        </optgroup>
                      )}
                    </select>
                    <select
                      value={projVolumeId}
                      onChange={(e) => setProjVolumeId(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:bg-white focus:outline-none"
                    >
                      <option value="">暂不指定存储卷</option>
                      {storageVolumes.map((v) => (
                        <option key={v.id} value={v.id}>
                          挂载存储卷：{v.name} ({v.quotaGb}GB)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
                    >
                      创建并进入项目
                    </button>
                  </div>
                </form>
              )}

              {!focusedProject ? (
                filteredMyProjects.length === 0 ? (
                  <div className="py-14 text-center rounded-xl border border-dashed border-slate-300 bg-white space-y-3">
                    <p className="text-sm font-medium text-slate-700">当前筛选下暂无项目</p>
                    <button
                      type="button"
                      onClick={onJumpToDiscover}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer"
                    >
                      <Compass className="w-3.5 h-3.5" />
                      <span>前往交流社区承接或发布项目</span>
                    </button>
                  </div>
                ) : (
                  filteredMyProjects.map((proj) => {
                    const projTasks = allTasks.filter((t) => t.sessionId === proj.id);
                    const projDone = projTasks.filter((t) => t.status === 'done').length;
                    const projReview = projTasks.filter((t) => t.status === 'review').length;
                    const status: ProjectLifecycleStatus = proj.lifecycleStatus || 'active';
                    const life = LIFECYCLE_META[status];
                    const projPct =
                      projTasks.length > 0
                        ? Math.round((projDone / projTasks.length) * 100)
                        : status === 'completed' || status === 'archived'
                          ? 100
                          : 0;
                    const projMembers = agents.filter((a) => proj.hiredAgentIds.includes(a.id));
                    const roleInfo = ROLE_META[proj.role];
                    const boundNodeLabels = (proj.boundNodeIds || [])
                      .map((id) => getAnyNodeLabel(id))
                      .filter((v): v is string => Boolean(v));
                    const boundVol = proj.storageVolumeId
                      ? volumeMap.get(proj.storageVolumeId)
                      : undefined;
                    const projUnsettled = settlements
                      .filter((s) => s.projectId === proj.id && s.status === 'unsettled')
                      .reduce((sum, s) => sum + s.amountUsd, 0);

                    return (
                      <section
                        key={proj.id}
                        className="bg-white rounded-xl border border-slate-200 p-5 space-y-4"
                      >
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <FolderKanban className="w-4 h-4 text-blue-600 shrink-0" />
                              <h2 className="text-base font-bold text-slate-900">{proj.name}</h2>
                              {renderSpaceOwnershipBadge(proj.sourceZoneId)}
                              <span
                                className={`inline-flex items-center gap-1 text-xs font-semibold ${life.cls}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${life.dotCls}`} />
                                <span>{life.label}</span>
                              </span>
                              <span className="text-slate-300" aria-hidden="true">·</span>
                              <span className={`text-xs font-semibold ${roleInfo.cls}`}>
                                {roleInfo.label}
                              </span>
                              {proj.completedAt && (
                                <span className="text-[11px] font-mono text-slate-400">
                                  ({proj.completedAt})
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 mt-1">{proj.goal}</p>
                            {/* Space Node & Volume Binding Line */}
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                              <span className="inline-flex items-center gap-1">
                                <Server className="w-3.5 h-3.5 text-slate-400" />
                                <span>
                                  算力载体：
                                  {boundNodeLabels.length > 0
                                    ? boundNodeLabels.join('、')
                                    : '未绑定节点'}
                                </span>
                              </span>
                              {boundVol && (
                                <span className="inline-flex items-center gap-1 font-mono">
                                  <Database className="w-3.5 h-3.5 text-slate-400" />
                                  <span>
                                    {boundVol.name} ({boundVol.usedGb}/{boundVol.quotaGb}GB)
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            {status === 'active' && (
                              <button
                                type="button"
                                onClick={() => onUpdateProjectLifecycle(proj.id, 'completed')}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100 text-xs font-semibold text-emerald-700 cursor-pointer whitespace-nowrap"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>标记完成</span>
                              </button>
                            )}
                            {status !== 'archived' ? (
                              <button
                                type="button"
                                onClick={() => onUpdateProjectLifecycle(proj.id, 'archived')}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-600 cursor-pointer whitespace-nowrap"
                              >
                                <Archive className="w-3.5 h-3.5" />
                                <span>归档</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onUpdateProjectLifecycle(proj.id, 'active')}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-xs font-semibold text-blue-700 cursor-pointer whitespace-nowrap"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>重新激活</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setFocusedProjectId(proj.id)}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer whitespace-nowrap"
                            >
                              项目详情
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPipelineProjectId(proj.id);
                                switchTab('orchestration');
                              }}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-indigo-700 cursor-pointer whitespace-nowrap"
                            >
                              工作编排
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setKanbanProjectScope(proj.id);
                                switchTab('kanban');
                              }}
                              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
                            >
                              项目看板
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
                          <div>
                            <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                              <span>交付完成度</span>
                              <span className="font-mono tabular-nums font-semibold text-slate-800">
                                {projDone}/{projTasks.length} ({projPct}%)
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
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
                            <div className="mt-1.5 text-[11px] text-slate-500">
                              {projReview > 0
                                ? `${projReview} 张任务卡待验证`
                                : status === 'completed'
                                  ? '里程碑已全部验收归档'
                                  : status === 'archived'
                                    ? '只读归档状态'
                                    : '多 Agent 流转顺畅'}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs text-slate-500 mb-1.5">阶段工位编排</div>
                            <div className="space-y-1">
                              {(projectPipelines[proj.id] || []).slice(0, 4).map((slot) => {
                                const ag = agentMap.get(slot.agentId);
                                return (
                                  <div
                                    key={slot.stage}
                                    className="flex items-center justify-between gap-2 text-xs"
                                  >
                                    <span className="text-slate-600 truncate">
                                      {WORK_TYPE_LABELS[slot.stage]} · {slot.roleTitle}
                                    </span>
                                    <span className="text-slate-900 font-semibold shrink-0">
                                      {ag ? displayEntityName(ag.handle) : '未指定'}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                              <span>
                                项目阵容（{(proj.hiredExpertIds || []).length} 专家 ·{' '}
                                {projMembers.length} Agent）
                              </span>
                              <span className="font-mono tabular-nums text-slate-700">
                                ${proj.spentUsd.toLocaleString('en-US')} / $
                                {proj.budgetCapUsd.toLocaleString('en-US')}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-700">
                              {projMembers.map((m) => {
                                const snap = snapshotByAgentId.get(m.id);
                                const lease = agentLeases[m.id];
                                const dotCls =
                                  snap?.availability === 'busy'
                                    ? 'bg-blue-600'
                                    : snap?.availability === 'idle'
                                      ? 'bg-emerald-500'
                                      : 'bg-slate-400';
                                return (
                                  <span key={m.id} className="inline-flex items-center gap-1">
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotCls}`} />
                                    <AgentIdentityName
                                      name={m.handle}
                                      runtime={m.runtimeAgent}
                                      model={m.defaultModel}
                                    />
                                    {lease && (
                                      <span className="text-[10px] font-mono text-indigo-600 font-semibold">
                                        ({LEASE_PERIOD_META[lease.period].shortLabel})
                                      </span>
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                            {projUnsettled > 0 && (
                              <div className="mt-1.5 text-[11px] text-amber-700 font-mono tabular-nums">
                                待结外部费用 ${Math.round(projUnsettled).toLocaleString('en-US')}
                              </div>
                            )}
                          </div>
                        </div>
                      </section>
                    );
                  })
                )
              ) : (
                /* Single-Project Focused Detail Cockpit */
                <div className="space-y-4">
                  <section className="bg-white rounded-xl border border-slate-200 p-5">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <FolderKanban className="w-4 h-4 text-blue-600" />
                          <h2 className="text-base font-bold text-slate-900">
                            {focusedProject.name}
                          </h2>
                          {renderSpaceOwnershipBadge(focusedProject.sourceZoneId)}
                          <span
                            className={`text-xs font-semibold ${
                              LIFECYCLE_META[focusedProject.lifecycleStatus || 'active'].cls
                            }`}
                          >
                            {LIFECYCLE_META[focusedProject.lifecycleStatus || 'active'].label}
                          </span>
                          <span className="text-slate-300" aria-hidden="true">·</span>
                          <span className={`text-xs font-semibold ${ROLE_META[focusedProject.role].cls}`}>
                            {ROLE_META[focusedProject.role].label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                          {focusedProject.goal}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setPipelineProjectId(focusedProject.id);
                            switchTab('orchestration');
                          }}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-indigo-700 cursor-pointer whitespace-nowrap"
                        >
                          配置工作编排
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setKanbanProjectScope(focusedProject.id);
                            switchTab('kanban');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
                        >
                          切至项目看板
                        </button>
                      </div>
                    </div>
                  </section>

                  <div className="grid grid-cols-1 @[920px]:grid-cols-12 gap-4">
                    <section className="@[920px]:col-span-8 bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-slate-900">
                          协作任务节点 ({focusedProjectTasks.length})
                        </h3>
                      </div>

                      {focusedModules.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-500">
                          该项目暂无任务卡片，在项目群对话框中直接描述需求或 @ Agent 即可自动生成。
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-200">
                          {focusedModules.map(([modName, modTasks]) => {
                            const modDone = modTasks.filter((t) => t.status === 'done').length;
                            return (
                              <div key={modName} className="p-4 space-y-2.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-bold text-slate-900">{modName}</span>
                                  <span className="font-mono tabular-nums text-slate-500">
                                    已完成 {modDone}/{modTasks.length}
                                  </span>
                                </div>
                                <div className="space-y-2">
                                  {modTasks.map((task) => {
                                    const isExec = executingTaskId === task.id;
                                    const ag = agentMap.get(task.assigneeId);
                                    return (
                                      <div
                                        key={task.id}
                                        className="rounded-lg bg-slate-50 border border-slate-200/80 px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                                      >
                                        <div className="min-w-0 space-y-1">
                                          <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                            <WorkStatusBadge status={task.status} executing={isExec} />
                                            <span className="inline-flex items-center gap-1.5 text-slate-700 font-medium">
                                              <EntityAvatar
                                                kind="agent"
                                                code={ag?.avatarCode || 'AI'}
                                                accent={ag?.avatarAccent || '#334155'}
                                                size="xs"
                                                showCornerMark={false}
                                              />
                                              <AgentIdentityName
                                                name={task.assigneeHandle}
                                                runtime={ag?.runtimeAgent}
                                                model={ag?.defaultModel}
                                              />
                                            </span>
                                            <span className={`font-semibold ${WORK_TYPE_COLORS[task.workType]}`}>
                                              · {WORK_TYPE_LABELS[task.workType]}
                                            </span>
                                          </div>
                                          <div className="text-xs font-semibold text-slate-900">
                                            {task.title}
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <button
                                            type="button"
                                            onClick={() => onOpenTaskSession(task.id)}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-semibold text-slate-800 cursor-pointer whitespace-nowrap"
                                          >
                                            <MessageSquareCode className="w-3 h-3 text-indigo-600" />
                                            <span>Agent 任务</span>
                                          </button>
                                          {task.status === 'pending' && (
                                            <button
                                              type="button"
                                              disabled={Boolean(executingTaskId)}
                                              onClick={() => onRunTask(task.id)}
                                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-[11px] font-semibold text-white cursor-pointer disabled:opacity-45 whitespace-nowrap"
                                            >
                                              <Play className="w-3 h-3" />
                                              <span>{isExec ? '执行中' : '批准执行'}</span>
                                            </button>
                                          )}
                                          {task.status === 'review' && (
                                            <button
                                              type="button"
                                              onClick={() => onUpdateStatus(task.id, 'done')}
                                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-[11px] font-semibold text-white cursor-pointer whitespace-nowrap"
                                            >
                                              <CheckCircle2 className="w-3 h-3" />
                                              <span>验证通过</span>
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>

                    <div className="@[920px]:col-span-4 space-y-4">
                      {/* Cooperative Human Experts Panel */}
                      {(() => {
                        const assignedExpertIds = focusedProject.hiredExpertIds || [];
                        const assignedExperts = assignedExpertIds
                          .map((id) => humanExpertMap.get(id))
                          .filter((h): h is HumanExpert => Boolean(h));
                        const availableExperts = humanExperts.filter(
                          (h) => !h.isCurrentUser && !assignedExpertIds.includes(h.id),
                        );
                        const effectiveAssignId = assignExpertId || availableExperts[0]?.id || '';

                        return (
                          <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="text-xs font-bold text-slate-900 inline-flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5 text-emerald-600" />
                                <span>项目合作专家 ({assignedExperts.length})</span>
                              </h3>
                              <button
                                type="button"
                                onClick={() =>
                                  focusedProject.sourceZoneId
                                    ? onJumpToZoneMarket(focusedProject.sourceZoneId)
                                    : onJumpToMarket()
                                }
                                className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
                              >
                                人类专家 →
                              </button>
                            </div>

                            {assignedExperts.length === 0 ? (
                              <p className="text-xs text-slate-400">
                                暂未派驻合作专家，可从下方直接指派团队或社区专家。
                              </p>
                            ) : (
                              <div className="space-y-2.5">
                                {assignedExperts.map((exp) => {
                                  const member = teamExpertMap.get(exp.id);
                                  return (
                                    <div
                                      key={exp.id}
                                      className="flex items-start justify-between gap-2 text-xs rounded-lg bg-slate-50/80 border border-slate-100 p-2.5"
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <EntityAvatar
                                          kind="human"
                                          code={exp.avatarInitials}
                                          accent={exp.avatarAccent}
                                          size="sm"
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
                                          <div className="text-[11px] text-slate-600 truncate mt-0.5">
                                            {exp.outsourcingDomain || exp.specialties[0] || ''}
                                          </div>
                                        </div>
                                      </div>
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
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {availableExperts.length > 0 && (
                              <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5">
                                <select
                                  value={effectiveAssignId}
                                  onChange={(e) => setAssignExpertId(e.target.value)}
                                  aria-label="选择要派驻该项目的专家"
                                  className="flex-1 min-w-0 h-7 rounded-md border border-slate-200 bg-slate-50 px-2 text-[11px] text-slate-800 focus:bg-white focus:outline-none"
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
                                  className="h-7 px-2.5 rounded-md bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-white cursor-pointer whitespace-nowrap shrink-0"
                                >
                                  + 派驻
                                </button>
                              </div>
                            )}
                          </section>
                        );
                      })()}

                      {/* Project Executing & Leased Agents Panel */}
                      <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold text-slate-900 inline-flex items-center gap-1.5">
                            <Cpu className="w-3.5 h-3.5 text-indigo-600" />
                            <span>项目专业 Agent ({focusedProject.hiredAgentIds.length})</span>
                          </h3>
                          <button
                            type="button"
                            onClick={() =>
                              focusedProject.sourceZoneId
                                ? onJumpToZoneMarket(focusedProject.sourceZoneId)
                                : onJumpToMarket()
                            }
                            className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
                          >
                            + 租赁 Agent
                          </button>
                        </div>
                        <div className="space-y-2.5">
                          {focusedProject.hiredAgentIds.map((agentId) => {
                            const snap = snapshotByAgentId.get(agentId);
                            const ag = agentMap.get(agentId);
                            if (!ag) return null;
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
                              <div
                                key={ag.id}
                                className="rounded-lg bg-slate-50/70 border border-slate-100 p-2.5 space-y-2 text-xs"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <EntityAvatar
                                    kind="agent"
                                    code={ag.avatarCode}
                                    accent={ag.avatarAccent}
                                    size="sm"
                                  />
                                  <div className="min-w-0">
                                    <AgentIdentityName
                                      name={ag.handle}
                                      runtime={ag.runtimeAgent}
                                      model={ag.defaultModel}
                                      showModel
                                      className="font-semibold text-slate-900"
                                    />
                                    <div className="text-[11px] text-slate-500 truncate mt-0.5 flex items-center gap-1.5">
                                      {snap && renderAvailabilityIndicator(snap)}
                                      <span className="text-slate-300" aria-hidden="true">·</span>
                                      <span className="font-mono tabular-nums">
                                        {ag.ownership === 'private'
                                          ? '自有免租'
                                          : lease
                                            ? lease.expiresLabel
                                            : `$${pricing.monthlyUsd}/月`}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {ag.ownership === 'marketplace' && (
                                  <div className="pt-1.5 border-t border-slate-200/70 flex items-center justify-between gap-2">
                                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                                      <CalendarClock className="w-3 h-3 text-indigo-500" />
                                      <span>续租周期</span>
                                    </span>
                                    <div className="inline-flex items-center gap-1">
                                      {(['week', 'month', 'quarter'] as LeasePeriod[]).map((p) => {
                                        const isCur = lease?.period === p;
                                        return (
                                          <button
                                            key={p}
                                            type="button"
                                            onClick={() =>
                                              onLeaseAgent(ag.id, p, focusedProject.id)
                                            }
                                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold cursor-pointer transition-colors ${
                                              isCur
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-400'
                                            }`}
                                          >
                                            {LEASE_PERIOD_META[p].label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= WORK PROJECTS 3: PROJECT KANBAN BOARD ================= */}
          {activeTab === 'kanban' && (
            <div
              className={`${WORKSPACE_MAX_WIDTH_CLASS} grid grid-cols-1 @[620px]:grid-cols-2 @[1040px]:grid-cols-4 gap-4 min-h-full`}
            >
              {WORK_CARD_STAGES.map((col) => {
                const colTasks = kanbanTasks.filter((t) =>
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
                          <span className={`w-2 h-2 rounded-full shrink-0 ${col.activeSegmentCls}`} />
                          <h2 className={`text-sm font-bold ${col.textCls}`}>{col.label}</h2>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">{col.hint}</p>
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
                          const proj = workspaceMap.get(task.sessionId);
                          const isExecuting = executingTaskId === task.id;

                          return (
                            <article
                              key={task.id}
                              className="bg-white rounded-lg p-3.5 border border-slate-200 hover:border-slate-300 transition-colors flex flex-col gap-2.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-medium text-slate-500 truncate">
                                  {kanbanProjectScope === 'all' && proj ? `${proj.name} · ` : ''}
                                  {task.featureModule}
                                </span>
                                <WorkStatusBadge status={task.status} executing={isExecuting} />
                              </div>

                              <div>
                                <h3 className="text-sm font-semibold text-slate-900 leading-snug">
                                  {task.title}
                                </h3>
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
                                    <span className="truncate">{task.deliverableArtifact}</span>
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
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span
                                    className={`text-[11px] font-semibold whitespace-nowrap ${WORK_TYPE_COLORS[task.workType]}`}
                                  >
                                    {WORK_TYPE_LABELS[task.workType]}
                                  </span>
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
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => onOpenTaskSession(task.id)}
                                  className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800 whitespace-nowrap cursor-pointer shrink-0"
                                >
                                  <MessageSquareCode className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Agent 任务</span>
                                </button>

                                {task.status === 'pending' && !isExecuting && (
                                  <button
                                    type="button"
                                    disabled={Boolean(executingTaskId)}
                                    onClick={() => onRunTask(task.id)}
                                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap cursor-pointer disabled:opacity-45"
                                  >
                                    <Play className="w-3 h-3" />
                                    <span>批准执行</span>
                                  </button>
                                )}

                                {(task.status === 'in_progress' || isExecuting) && (
                                  <div className="flex-1 text-center py-1.5 px-2 text-xs font-semibold text-blue-700 bg-blue-50 rounded-md truncate">
                                    执行中...
                                  </div>
                                )}

                                {task.status === 'review' && !isExecuting && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => onUpdateStatus(task.id, 'done')}
                                      className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap cursor-pointer"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>验证通过</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onUpdateStatus(task.id, 'pending')}
                                      title="退回待批准"
                                      className="p-1.5 rounded-md border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 cursor-pointer shrink-0"
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
          )}

          {/* ================= WORK PROJECTS 4: WORK ORCHESTRATION PIPELINE ================= */}
          {activeTab === 'orchestration' && activePipelineProject && (
            <div className={WORKSPACE_MAX_WIDTH_CLASS}>
              <ProjectOrchestrationPanel
                project={activePipelineProject}
                slots={projectPipelines[activePipelineProject.id] || []}
                agents={agents}
                computeNodes={computeNodes}
                spaceSharedNodes={spaceSharedNodes}
                zones={zones}
                storageVolumes={storageVolumes}
                projectTasks={allTasks.filter((t) => t.sessionId === activePipelineProject.id)}
                onUpdateStageSlot={onUpdateProjectStageSlot}
                onSyncPipelineToProject={onSyncPipelineAgentsToProject}
                onUpdateAgentRuntimeConfig={onUpdateAgentRuntimeConfig}
                onOpenStageKanban={(projId, wt) => {
                  setKanbanProjectScope(projId);
                  setWorkTypeFilter(wt);
                  switchTab('kanban');
                }}
                onJumpToSpaceAgents={onJumpToTeam}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
