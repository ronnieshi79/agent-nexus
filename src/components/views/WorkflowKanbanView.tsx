import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  Compass,
  Cpu,
  DollarSign,
  FileCode2,
  FolderKanban,
  GitBranch,
  Handshake,
  MessageSquareCode,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Store,
  TrendingUp,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type {
  AgentLeaseRecord,
  CommunityZone,
  ExpertAgent,
  HumanExpert,
  LeasePeriod,
  NegotiationStatus,
  NegotiationThread,
  ProjectRole,
  ProjectWorkspace,
  ServiceMode,
  SettlementRecord,
  TaskStatus,
  TeamExpertMembership,
  WorkCardType,
  WorkflowTask,
} from '../../types/agentnexus';
import {
  AGENT_RUNTIME_PRESETS,
  AgentIdentityName,
  EntityAvatar,
  LEASE_PERIOD_META,
  displayEntityName,
  formatAgentDisplayName,
  formatShortModel,
  getAgentLeasePricing,
  getRuntimePreset,
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

export type WorkKanbanTab = 'overview' | 'my_projects' | 'kanban' | 'agents';

interface WorkflowKanbanViewProps {
  zones: CommunityZone[];
  workspaces: ProjectWorkspace[];
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
  onCreateProject: (name: string, goal: string, sourceZoneId?: string) => string;
  onRunTask: (taskId: string) => Promise<void>;
  onUpdateStatus: (taskId: string, status: TaskStatus) => void;
  onOpenTaskSession: (taskId: string) => void;
  onConfirmHire: (agentId: string, createFirstCard: boolean) => void;
  onJumpToMarket: () => void;
  onJumpToZoneMarket: (zoneId: string) => void;
  onJumpToDiscover: () => void;
  onReleaseAgent: (agentId: string, projectId?: string) => void;
  onLeaseAgent: (agentId: string, period: LeasePeriod, targetWorkspaceId?: string) => void;
  onAssignExpertToWorkspace: (expertId: string, workspaceId: string) => void;
  onRemoveExpertFromWorkspace: (expertId: string, workspaceId: string) => void;
  onUpdateAgentRuntimeConfig: (agentId: string, runtimeAgent: string, defaultModel: string) => void;
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

const NEGOTIATION_STATUS_META: Record<NegotiationStatus, { label: string; cls: string }> = {
  negotiating: { label: '洽谈中', cls: 'text-slate-600' },
  quoted: { label: '待确认报价', cls: 'text-amber-700' },
  hired: { label: '已雇佣入群', cls: 'text-emerald-700' },
};

const SERVICE_MODE_LABELS: Record<ServiceMode, string> = {
  'pure-agent': '纯 Agent 租用',
  'human-agent': '人 + Agent 协同',
};

const ROLE_META: Record<ProjectRole, { label: string; cls: string }> = {
  leading: { label: '我主管', cls: 'text-blue-700' },
  participating: { label: '我参与', cls: 'text-indigo-700' },
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
  /** External contract spend across assigned projects (USD) */
  externalCostUsd: number;
  /** Private/own Agent estimated token usage (in thousands of tokens) */
  privateTokensK: number;
  /** Estimated compute cost for own Agent tokens (USD) */
  privateTokenCostUsd: number;
}

function estimatePrivateTokensK(agent: ExpertAgent, taskList: WorkflowTask[]): number {
  if (agent.ownership !== 'private') return 0;
  // Deterministic realistic token usage based on historical completed projects + active task rounds
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
  workspaces,
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
  onConfirmHire,
  onJumpToMarket,
  onJumpToZoneMarket,
  onJumpToDiscover,
  onReleaseAgent,
  onLeaseAgent,
  onAssignExpertToWorkspace,
  onRemoveExpertFromWorkspace,
  onUpdateAgentRuntimeConfig,
}: WorkflowKanbanViewProps) {
  const [activeTab, setActiveTab] = useState<WorkKanbanTab>('overview');
  const [assignExpertId, setAssignExpertId] = useState<string>('');

  // My Projects state
  const [roleFilter, setRoleFilter] = useState<'all' | ProjectRole>('all');
  const [focusedProjectId, setFocusedProjectId] = useState<string | null>(null);
  const [showCreateProjectForm, setShowCreateProjectForm] = useState(false);
  const [projName, setProjName] = useState('');
  const [projGoal, setProjGoal] = useState('');
  const [projZoneId, setProjZoneId] = useState<string>(zones[0]?.id || 'zone_public');

  // Kanban Task Flow state
  const [kanbanProjectScope, setKanbanProjectScope] = useState<string>('all');
  const [kanbanAgentFilter, setKanbanAgentFilter] = useState<string>('all');
  const [workTypeFilter, setWorkTypeFilter] = useState<'all' | WorkCardType>('all');

  // Shared right-toolbar keyword search
  const [searchKeyword, setSearchKeyword] = useState('');

  // Agent Fleet & Orchestration Tab filters
  const [fleetOwnershipFilter, setFleetOwnershipFilter] = useState<'all' | 'marketplace' | 'private'>('all');
  const [fleetStatusFilter, setFleetStatusFilter] = useState<'all' | AgentLiveAvailability>('all');
  const [pipelineProjectId, setPipelineProjectId] = useState<string>(workspaces[0]?.id || '');

  useEffect(() => {
    if (projectSeed) {
      setKanbanProjectScope(projectSeed);
      if (projectSeed !== 'all') {
        setFocusedProjectId(projectSeed);
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

  const zoneMap = useMemo(() => {
    const map = new Map<string, CommunityZone>();
    zones.forEach((z) => map.set(z.id, z));
    return map;
  }, [zones]);

  const workspaceMap = useMemo(() => {
    const map = new Map<string, ProjectWorkspace>();
    workspaces.forEach((w) => map.set(w.id, w));
    return map;
  }, [workspaces]);

  const agentMap = useMemo(() => {
    const map = new Map<string, ExpertAgent>();
    agents.forEach((a) => map.set(a.id, a));
    return map;
  }, [agents]);

  const humanExpertMap = useMemo(() => {
    const map = new Map<string, HumanExpert>();
    humanExperts.forEach((h) => map.set(h.id, h));
    return map;
  }, [humanExperts]);

  const teamExpertMap = useMemo(() => {
    const map = new Map<string, TeamExpertMembership>();
    teamExperts.forEach((m) => map.set(m.expertId, m));
    return map;
  }, [teamExperts]);

  // Compute live runtime snapshots for every involved/private Agent across all projects
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

      const externalCostUsd =
        agent.ownership === 'private' ? 0 : agent.projectPriceUsd * Math.max(agentProjects.length, 0);
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
        externalCostUsd,
        privateTokensK,
        privateTokenCostUsd,
      });
    });

    // Sort by active work + total usage frequency
    return list.sort((a, b) => {
      const aScore = a.inProgressCount * 10 + a.totalTasks * 3 + a.projects.length * 2;
      const bScore = b.inProgressCount * 10 + b.totalTasks * 3 + b.projects.length * 2;
      return bScore - aScore;
    });
  }, [agentMap, agents, allTasks, executingTaskId, workspaces]);

  const snapshotByAgentId = useMemo(() => {
    const map = new Map<string, AgentRuntimeSnapshot>();
    agentSnapshots.forEach((s) => map.set(s.agent.id, s));
    return map;
  }, [agentSnapshots]);

  // Global metrics for Overview & Header
  const pendingCount = allTasks.filter((t) => t.status === 'pending').length;
  const inProgressCount = allTasks.filter(
    (t) => t.status === 'in_progress' || executingTaskId === t.id,
  ).length;
  const reviewCount = allTasks.filter((t) => t.status === 'review').length;
  const doneCount = allTasks.filter((t) => t.status === 'done').length;
  const progressPct = allTasks.length > 0 ? Math.round((doneCount / allTasks.length) * 100) : 0;

  const leadingCount = workspaces.filter((w) => w.role === 'leading').length;
  const participatingCount = workspaces.filter((w) => w.role === 'participating').length;

  const totalExternalSpentUsd = workspaces.reduce((sum, w) => sum + w.spentUsd, 0);
  const totalBudgetCapUsd = workspaces.reduce((sum, w) => sum + w.budgetCapUsd, 0);
  const settledTotalUsd = settlements
    .filter((s) => s.status === 'settled')
    .reduce((sum, s) => sum + s.amountUsd, 0);
  const unsettledTotalUsd = settlements
    .filter((s) => s.status === 'unsettled')
    .reduce((sum, s) => sum + s.amountUsd, 0);

  const totalPrivateTokensK = agentSnapshots.reduce((sum, s) => sum + s.privateTokensK, 0);
  const totalPrivateTokenCostUsd = agentSnapshots.reduce(
    (sum, s) => sum + s.privateTokenCostUsd,
    0,
  );

  const busyAgentCount = agentSnapshots.filter((s) => s.availability === 'busy').length;
  const idleAgentCount = agentSnapshots.filter((s) => s.availability === 'idle').length;
  const offlineAgentCount = agentSnapshots.filter((s) => s.availability === 'offline').length;
  const externalFleetCount = agentSnapshots.filter((s) => s.agent.ownership === 'marketplace').length;
  const privateFleetCount = agentSnapshots.filter((s) => s.agent.ownership === 'private').length;

  const pendingNegotiationCount = negotiations.filter((n) => n.status !== 'hired').length;

  const normalizedQuery = searchKeyword.trim().toLowerCase();

  // Filtered lists
  const filteredMyProjects = useMemo(
    () =>
      workspaces.filter((w) => {
        if (roleFilter !== 'all' && w.role !== roleFilter) return false;
        if (!normalizedQuery) return true;
        return (
          w.name.toLowerCase().includes(normalizedQuery) ||
          w.goal.toLowerCase().includes(normalizedQuery)
        );
      }),
    [normalizedQuery, roleFilter, workspaces],
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
  }, [allTasks, kanbanAgentFilter, kanbanProjectScope, normalizedQuery, workTypeFilter, workspaceMap]);

  const kanbanAssignableAgents = useMemo(() => {
    const ids = new Set(allTasks.map((t) => t.assigneeId));
    return agents.filter((a) => ids.has(a.id));
  }, [agents, allTasks]);

  const filteredFleet = useMemo(() => {
    return agentSnapshots.filter((snap) => {
      if (fleetOwnershipFilter !== 'all' && snap.agent.ownership !== fleetOwnershipFilter) {
        return false;
      }
      if (fleetStatusFilter !== 'all' && snap.availability !== fleetStatusFilter) {
        return false;
      }
      if (normalizedQuery) {
        const match =
          snap.agent.handle.toLowerCase().includes(normalizedQuery) ||
          snap.agent.name.toLowerCase().includes(normalizedQuery) ||
          snap.agent.title.toLowerCase().includes(normalizedQuery) ||
          snap.agent.runtimeAgent.toLowerCase().includes(normalizedQuery) ||
          snap.agent.defaultModel.toLowerCase().includes(normalizedQuery) ||
          snap.projects.some((p) => p.name.toLowerCase().includes(normalizedQuery));
        if (!match) return false;
      }
      return true;
    });
  }, [agentSnapshots, fleetOwnershipFilter, fleetStatusFilter, normalizedQuery]);

  const handleCreateProjectSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!projName.trim()) return;
    const newId = onCreateProject(projName, projGoal, projZoneId);
    setProjName('');
    setProjGoal('');
    setShowCreateProjectForm(false);
    if (newId) {
      setFocusedProjectId(newId);
    }
  };

  const renderAvailabilityIndicator = (snap: AgentRuntimeSnapshot) => {
    const dotCls =
      snap.availability === 'busy'
        ? 'bg-blue-600 animate-pulse'
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
      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold whitespace-nowrap ${textCls}`}>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotCls}`} />
        <span>{snap.availabilityLabel}</span>
      </span>
    );
  };

  const searchPlaceholder =
    activeTab === 'kanban'
      ? '搜索任务标题、模块、项目或执行 Agent...'
      : activeTab === 'agents'
        ? '搜索 Agent 名称、底座、模型或所在项目...'
        : '搜索项目名称、目标或范围...';

  return (
    <div className="h-full flex min-h-0 bg-white relative @container/shell">
      {/* FAR-LEFT PRIMARY FILTER RAIL: Workspace Views + Contextual Primary Scope */}
      <WorkspacePrimaryRail ariaLabel="工作看板主筛选">
        <div className="space-y-1">
          <RailSectionLabel>工作视图</RailSectionLabel>
          <RailNavButton
            variant="primary"
            active={activeTab === 'overview'}
            onClick={() => {
              setActiveTab('overview');
              setFocusedProjectId(null);
            }}
            icon={<TrendingUp className="w-3.5 h-3.5" />}
            label="项目概览"
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
            onClick={() => {
              setActiveTab('kanban');
              setFocusedProjectId(null);
            }}
            icon={<Briefcase className="w-3.5 h-3.5" />}
            label="任务看板"
            count={allTasks.length}
          />
          <RailNavButton
            variant="primary"
            active={activeTab === 'agents'}
            onClick={() => {
              setActiveTab('agents');
              setFocusedProjectId(null);
            }}
            icon={<Cpu className="w-3.5 h-3.5" />}
            label="Agent 编排"
            count={agentSnapshots.length}
          />
        </div>

        {(activeTab === 'overview' || activeTab === 'my_projects') && (
          <div className="pt-3 border-t border-slate-100 space-y-1">
            <RailSectionLabel>项目工作区</RailSectionLabel>
            {workspaces.map((ws) => {
              const wsTaskCount = allTasks.filter((t) => t.sessionId === ws.id).length;
              return (
                <RailNavButton
                  key={ws.id}
                  active={activeTab === 'my_projects' && focusedProjectId === ws.id}
                  onClick={() => {
                    setActiveTab('my_projects');
                    setFocusedProjectId(ws.id);
                  }}
                  label={ws.name}
                  count={wsTaskCount}
                />
              );
            })}
          </div>
        )}

        {activeTab === 'kanban' && (
          <div className="pt-3 border-t border-slate-100 space-y-1">
            <RailSectionLabel>项目范围</RailSectionLabel>
            <RailNavButton
              active={kanbanProjectScope === 'all'}
              onClick={() => setKanbanProjectScope('all')}
              label="全部项目"
              count={allTasks.length}
            />
            {workspaces.map((ws) => {
              const wsTaskCount = allTasks.filter((t) => t.sessionId === ws.id).length;
              return (
                <RailNavButton
                  key={ws.id}
                  active={kanbanProjectScope === ws.id}
                  onClick={() => setKanbanProjectScope(ws.id)}
                  label={ws.name}
                  count={wsTaskCount}
                />
              );
            })}
          </div>
        )}

        {activeTab === 'agents' && (
          <div className="pt-3 border-t border-slate-100 space-y-1">
            <RailSectionLabel>节点归属</RailSectionLabel>
            <RailNavButton
              active={fleetOwnershipFilter === 'all'}
              onClick={() => setFleetOwnershipFilter('all')}
              label="全部 Agent"
              count={agentSnapshots.length}
            />
            <RailNavButton
              active={fleetOwnershipFilter === 'marketplace'}
              onClick={() => setFleetOwnershipFilter('marketplace')}
              label="外部雇佣"
              count={externalFleetCount}
            />
            <RailNavButton
              active={fleetOwnershipFilter === 'private'}
              onClick={() => setFleetOwnershipFilter('private')}
              label="自有节点"
              count={privateFleetCount}
            />
          </div>
        )}
      </WorkspacePrimaryRail>

      {/* RIGHT WORKSPACE COLUMN: Top Search & Secondary Filter Bar Aligned Flush with Content Below */}
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
                  <span>返回项目列表</span>
                </button>
              ) : (
                <ToolbarSearch
                  value={searchKeyword}
                  onChange={setSearchKeyword}
                  placeholder={searchPlaceholder}
                  widthClass="flex-1 min-w-[160px] max-w-[300px]"
                />
              )}

              {(activeTab === 'overview' || (activeTab === 'my_projects' && !focusedProject)) && (
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
              )}

              {activeTab === 'kanban' && (
                <>
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
                    label="类型"
                    value={workTypeFilter}
                    defaultValue="all"
                    onChange={setWorkTypeFilter}
                    options={[
                      { id: 'all', label: '全部类型' },
                      { id: 'planning', label: '产品策划' },
                      { id: 'development', label: '功能开发' },
                      { id: 'testing', label: '功能测试' },
                      { id: 'review', label: '架构评审' },
                    ]}
                  />
                </>
              )}

              {activeTab === 'agents' && (
                <ToolbarDropdown
                  label="状态"
                  value={fleetStatusFilter}
                  defaultValue="all"
                  onChange={setFleetStatusFilter}
                  options={[
                    { id: 'all', label: '全部状态' },
                    { id: 'busy', label: '在线 · 忙碌', hint: `${busyAgentCount}` },
                    { id: 'idle', label: '在线 · 空闲', hint: `${idleAgentCount}` },
                    { id: 'offline', label: '离线', hint: `${offlineAgentCount}` },
                  ]}
                />
              )}
            </>
          }
          right={
            <>
              <span className="hidden @[900px]:inline-flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums mr-1">
                <span>完成 {progressPct}%</span>
                <span className="text-slate-300" aria-hidden="true">·</span>
                <span>待验证 {reviewCount}</span>
                <span className="text-slate-300" aria-hidden="true">·</span>
                <span className="text-emerald-700 font-semibold">
                  在线 {idleAgentCount + busyAgentCount}/{agentSnapshots.length}
                </span>
              </span>

              {(activeTab === 'overview' || (activeTab === 'my_projects' && !focusedProject)) && (
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
              )}

              {activeTab === 'agents' && (
                <button
                  type="button"
                  onClick={onJumpToMarket}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white whitespace-nowrap cursor-pointer"
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>去服务市场</span>
                </button>
              )}
            </>
          }
        />

        {/* Main Scrollable Content Canvas */}
        <div className={`flex-1 min-h-0 overflow-y-auto clean-scroll bg-slate-50/70 ${WORKSPACE_GUTTER_CLASS} py-5`}>
          {/* Compact Narrow Strip (visible only when shell < 760px) */}
          <div className={`${WORKSPACE_MAX_WIDTH_CLASS} @[760px]/shell:hidden mb-4 flex items-center gap-1.5 overflow-x-auto pb-0.5`}>
            {[
              { id: 'overview' as const, label: '项目概览', count: undefined },
              { id: 'my_projects' as const, label: '我的项目', count: workspaces.length },
              { id: 'kanban' as const, label: '任务看板', count: allTasks.length },
              { id: 'agents' as const, label: 'Agent 编排', count: agentSnapshots.length },
            ].map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    if (item.id !== 'my_projects') setFocusedProjectId(null);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer border transition-colors ${
                    active
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.count !== undefined && (
                    <span className="text-[11px] font-mono opacity-75">{item.count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ================= TAB 1: PROJECT OVERVIEW (Executive Cockpit) ================= */}
          {activeTab === 'overview' && (
            <div className={`${WORKSPACE_MAX_WIDTH_CLASS} space-y-5`}>
            {/* Top KPI Strip: Progress & Competitiveness | External Cost | Own Token Usage | Agent Fleet Status */}
            <div className="grid grid-cols-1 @[520px]:grid-cols-2 @[980px]:grid-cols-4 gap-3.5">
              {/* KPI 1: Project Progress & Delivery Competitiveness */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-medium">项目进展与竞争效率</span>
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                    {progressPct}%
                  </span>
                  <span className="text-xs font-semibold text-emerald-700 whitespace-nowrap">
                    交付提速 +34%
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 flex items-center justify-between gap-2">
                  <span>
                    {workspaces.length} 个项目（主管 {leadingCount} · 参与 {participatingCount}）
                  </span>
                  <span className="font-mono tabular-nums">
                    {doneCount}/{allTasks.length} 卡
                  </span>
                </div>
              </div>

              {/* KPI 2: External Agent Contract Cost */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-medium">外部 Agent 雇佣费用</span>
                  <DollarSign className="w-4 h-4 text-indigo-600" />
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
                  <span>已结 ${settledTotalUsd.toLocaleString('en-US')}</span>
                  <span className={unsettledTotalUsd > 0 ? 'text-amber-700 font-semibold' : ''}>
                    待结 ${unsettledTotalUsd.toLocaleString('en-US')}
                  </span>
                </div>
              </div>

              {/* KPI 3: Own Private Agent Token Consumption */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-medium">自有 Agent Token 消耗</span>
                  <Sparkles className="w-4 h-4 text-sky-600" />
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                    {formatTokensK(totalPrivateTokensK)}
                  </span>
                  <span className="text-xs font-mono tabular-nums text-slate-600">
                    ≈ ${totalPrivateTokenCostUsd.toFixed(1)}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 flex items-center justify-between gap-2">
                  <span>{privateFleetCount} 个私有节点零签约费</span>
                  <span className="font-mono tabular-nums text-sky-700">输入 64% / 输出 36%</span>
                </div>
              </div>

              {/* KPI 4: Live Multi-Agent Fleet Status */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-medium">项目 Agent 在线与闲忙</span>
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
                    外部雇佣 {externalFleetCount} · 自有 {privateFleetCount}
                  </span>
                  {pendingNegotiationCount > 0 ? (
                    <span className="text-amber-700 font-semibold">
                      {pendingNegotiationCount} 项洽谈中
                    </span>
                  ) : (
                    <span>全部就位</span>
                  )}
                </div>
              </div>
            </div>

            {/* Built-in 4-Stage Multi-Agent Workflow Summary Strip */}
            <section className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-bold text-slate-900">
                    多 Agent 协作流程实时分布
                  </h2>
                  <span className="text-[11px] text-slate-400">
                    待批准 → 执行中 → 待验证 → 已完成
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setKanbanProjectScope('all');
                    setKanbanAgentFilter('all');
                    setActiveTab('kanban');
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
                >
                  <span>进入任务看板</span>
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
                        setActiveTab('kanban');
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
                          ? `执行：${uniqueAgents.slice(0, 2).join('、')}${uniqueAgents.length > 2 ? ` 等${uniqueAgents.length}位` : ''}`
                          : stage.hint}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Lower Split: Project Comparison Table (Left 7) + Frequent Agents & Live Status (Right 5) */}
            <div className="grid grid-cols-1 @[920px]:grid-cols-12 gap-4">
              {/* Project Overview & Cost/Efficiency Comparison */}
              <section className="@[920px]:col-span-7 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
                <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">项目状态、竞争效率与成本核算</h2>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      总览各项目四态任务进展、外部 Agent 签约费用与自有节点 Token 消耗
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('my_projects')}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer whitespace-nowrap"
                  >
                    全部项目 →
                  </button>
                </div>

                <div className="divide-y divide-slate-100 flex-1">
                  {filteredMyProjects.map((proj) => {
                    const projTasks = allTasks.filter((t) => t.sessionId === proj.id);
                    const pPending = projTasks.filter((t) => t.status === 'pending').length;
                    const pRunning = projTasks.filter(
                      (t) => t.status === 'in_progress' || executingTaskId === t.id,
                    ).length;
                    const pReview = projTasks.filter((t) => t.status === 'review').length;
                    const pDone = projTasks.filter((t) => t.status === 'done').length;
                    const pct = projTasks.length > 0 ? Math.round((pDone / projTasks.length) * 100) : 0;

                    const projPrivateTokensK = proj.hiredAgentIds.reduce((sum, aid) => {
                      const ag = agentMap.get(aid);
                      if (!ag || ag.ownership !== 'private') return sum;
                      const agProjTasks = projTasks.filter((t) => t.assigneeId === aid);
                      return sum + estimatePrivateTokensK(ag, agProjTasks);
                    }, 0);

                    const linkedZone = proj.sourceZoneId ? zoneMap.get(proj.sourceZoneId) : undefined;
                    const roleInfo = ROLE_META[proj.role];
                    const compSignal =
                      pReview > 0
                        ? { text: `${pReview} 项待验证`, cls: 'text-amber-700' }
                        : pct >= 50
                          ? { text: '效率领先同区 +28%', cls: 'text-emerald-700' }
                          : { text: '按排期推进中', cls: 'text-blue-700' };

                    return (
                      <div
                        key={proj.id}
                        className="p-4 hover:bg-slate-50/70 transition-colors space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <FolderKanban className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span className="text-xs font-bold text-slate-900 truncate">
                                {proj.name}
                              </span>
                              <span className={`text-[11px] font-semibold ${roleInfo.cls}`}>
                                {roleInfo.label}
                              </span>
                              {linkedZone && (
                                <span
                                  className="text-[11px] font-medium"
                                  style={{ color: linkedZone.accentColor }}
                                >
                                  · {linkedZone.name}
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 font-mono tabular-nums">
                              <span>待批准 {pPending}</span>
                              <span className="text-blue-700">执行中 {pRunning}</span>
                              <span className="text-amber-700">待验证 {pReview}</span>
                              <span className="text-emerald-700">已完成 {pDone}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setFocusedProjectId(proj.id);
                                setActiveTab('my_projects');
                              }}
                              className="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
                            >
                              详情
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setKanbanProjectScope(proj.id);
                                setActiveTab('kanban');
                              }}
                              className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-white cursor-pointer whitespace-nowrap"
                            >
                              看板
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                          <div className="flex items-center gap-2 flex-1 min-w-[140px]">
                            <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full bg-blue-600 rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-mono tabular-nums font-semibold text-slate-700">
                              {pct}%
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums">
                            <span className="text-slate-600">
                              外部 <strong className="text-slate-900">${proj.spentUsd.toLocaleString('en-US')}</strong>
                            </span>
                            <span className="text-slate-600">
                              Token{' '}
                              <strong className="text-sky-700">
                                {projPrivateTokensK > 0 ? formatTokensK(projPrivateTokensK) : '0'}
                              </strong>
                            </span>
                            <span className={`font-sans font-semibold ${compSignal.cls}`}>
                              {compSignal.text}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Frequent Agents + Live Availability */}
              <section className="@[920px]:col-span-5 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
                <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <Cpu className="w-4 h-4 text-indigo-600" />
                      <span>常用 Agent 与实时状态</span>
                    </h2>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      按协作频次排序，实时追踪在线、闲忙与计费类型
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('agents')}
                    className="text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer whitespace-nowrap"
                  >
                    Agent 编排 →
                  </button>
                </div>

                <div className="divide-y divide-slate-100 flex-1">
                  {agentSnapshots.slice(0, 6).map((snap) => (
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
                          <div className="flex items-center gap-1.5 min-w-0">
                            <AgentIdentityName
                              name={snap.agent.handle}
                              runtime={snap.agent.runtimeAgent}
                              model={snap.agent.defaultModel}
                              showModel
                              className="text-xs font-bold text-slate-900"
                            />
                            <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap shrink-0">
                              {snap.agent.ownership === 'private' ? '自有' : '外部'}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500 truncate">
                            {renderAvailabilityIndicator(snap)}
                            <span className="text-slate-300" aria-hidden="true">·</span>
                            <span className="truncate font-mono tabular-nums">
                              {snap.agent.ownership === 'private'
                                ? `${formatTokensK(snap.privateTokensK)} tok`
                                : `$${snap.agent.projectPriceUsd.toLocaleString('en-US')}/项目`}
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
                            进入 Session →
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">待派单</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* ================= TAB 2: MY PROJECTS (Leading & Participating) ================= */}
        {activeTab === 'my_projects' && (
          <div className={`${WORKSPACE_MAX_WIDTH_CLASS} space-y-4`}>
            {/* Inline Create Project Form */}
            {showCreateProjectForm && !focusedProject && (
              <form
                onSubmit={handleCreateProjectSubmit}
                className="p-4 rounded-xl bg-white border border-slate-200 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">新建我主管的项目</span>
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
                    onChange={(e) => setProjZoneId(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  >
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        关联招募专区：{z.name}
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
                  const projPct =
                    projTasks.length > 0 ? Math.round((projDone / projTasks.length) * 100) : 0;
                  const projMembers = agents.filter((a) => proj.hiredAgentIds.includes(a.id));
                  const projUnsettled = settlements
                    .filter((s) => s.projectId === proj.id && s.status === 'unsettled')
                    .reduce((sum, s) => sum + s.amountUsd, 0);
                  const linkedZone = proj.sourceZoneId ? zoneMap.get(proj.sourceZoneId) : undefined;
                  const roleInfo = ROLE_META[proj.role];

                  const moduleMap = new Map<string, { total: number; done: number }>();
                  projTasks.forEach((t) => {
                    const entry = moduleMap.get(t.featureModule) || { total: 0, done: 0 };
                    entry.total += 1;
                    if (t.status === 'done') entry.done += 1;
                    moduleMap.set(t.featureModule, entry);
                  });
                  const modules = Array.from(moduleMap.entries());

                  return (
                    <section
                      key={proj.id}
                      className="bg-white rounded-xl border border-slate-200 p-5 space-y-4"
                    >
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <FolderKanban className="w-4 h-4 text-blue-600 shrink-0" />
                            <h2 className="text-base font-bold text-slate-900">{proj.name}</h2>
                            <span className="text-slate-300" aria-hidden="true">·</span>
                            <span className={`text-xs font-semibold ${roleInfo.cls}`}>
                              {roleInfo.label}
                            </span>
                            {linkedZone && (
                              <>
                                <span className="text-slate-300" aria-hidden="true">·</span>
                                <span
                                  className="text-xs font-semibold"
                                  style={{ color: linkedZone.accentColor }}
                                >
                                  {linkedZone.name}
                                </span>
                              </>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 mt-1">{proj.goal}</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setFocusedProjectId(proj.id)}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer whitespace-nowrap"
                          >
                            项目详情
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setKanbanProjectScope(proj.id);
                              setActiveTab('kanban');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
                          >
                            任务看板
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
                              className="h-full bg-blue-600 transition-all"
                              style={{ width: `${projPct}%` }}
                            />
                          </div>
                          <div className="mt-1.5 text-[11px] text-slate-500">
                            {projReview > 0 ? `${projReview} 张任务卡待验证` : '多 Agent 流转顺畅'}
                          </div>
                        </div>

                        <div>
                          <div className="text-xs text-slate-500 mb-1.5">功能模块进度</div>
                          {modules.length === 0 ? (
                            <div className="text-xs text-slate-400">暂无任务卡片</div>
                          ) : (
                            <div className="space-y-1">
                              {modules.map(([modName, stat]) => (
                                <div
                                  key={modName}
                                  className="flex items-center justify-between gap-2 text-xs"
                                >
                                  <span className="text-slate-700 truncate">{modName}</span>
                                  <span className="font-mono tabular-nums text-slate-500 shrink-0">
                                    {stat.done}/{stat.total}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                            <span>
                              项目阵容（{(proj.hiredExpertIds || []).length} 专家 · {projMembers.length} Agent）
                            </span>
                            <span className="font-mono tabular-nums text-slate-700">
                              ${proj.spentUsd.toLocaleString('en-US')} / $
                              {proj.budgetCapUsd.toLocaleString('en-US')}
                            </span>
                          </div>
                          {(proj.hiredExpertIds || []).length > 0 && (
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-emerald-800 mb-1.5">
                              {(proj.hiredExpertIds || []).map((eid) => {
                                const exp = humanExpertMap.get(eid);
                                if (!exp) return null;
                                return (
                                  <span
                                    key={eid}
                                    title={`擅长方向：${exp.outsourcingDomain || exp.specialties[0] || ''}`}
                                    className="inline-flex items-center gap-1 font-semibold"
                                  >
                                    <Users className="w-3 h-3 text-emerald-600 shrink-0" />
                                    <span>{exp.name}</span>
                                  </span>
                                );
                              })}
                            </div>
                          )}
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
                                <span
                                  key={m.id}
                                  title={
                                    lease
                                      ? `${lease.expiresLabel} · $${lease.priceUsd}${LEASE_PERIOD_META[lease.period].unitSuffix}`
                                      : snap
                                        ? `${snap.availabilityLabel} · ${snap.availabilityDetail}`
                                        : ''
                                  }
                                  className="inline-flex items-center gap-1"
                                >
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
                      <button
                        type="button"
                        onClick={() => setFocusedProjectId(null)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 mb-2 cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>返回全部我的项目</span>
                      </button>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <FolderKanban className="w-4 h-4 text-blue-600" />
                        <h2 className="text-base font-bold text-slate-900">
                          {focusedProject.name}
                        </h2>
                        <span className="text-slate-300" aria-hidden="true">·</span>
                        <span className={`text-xs font-semibold ${ROLE_META[focusedProject.role].cls}`}>
                          {ROLE_META[focusedProject.role].label}
                        </span>
                        {focusedProject.sourceZoneId && zoneMap.get(focusedProject.sourceZoneId) && (
                          <>
                            <span className="text-slate-300" aria-hidden="true">·</span>
                            <span
                              className="text-xs font-semibold"
                              style={{
                                color: zoneMap.get(focusedProject.sourceZoneId)?.accentColor,
                              }}
                            >
                              {zoneMap.get(focusedProject.sourceZoneId)?.name}
                            </span>
                          </>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                        {focusedProject.goal}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setKanbanProjectScope(focusedProject.id);
                          setActiveTab('kanban');
                        }}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer whitespace-nowrap"
                      >
                        切至四列看板
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
                    {/* Project Cooperative Experts Panel */}
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
                              <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
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
                                const ownedCount = agents.filter(
                                  (a) => a.ownerHumanId === exp.id && a.isListedInMarket,
                                ).length;
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
                                          <span className="font-bold text-slate-900">{exp.name}</span>
                                          <span className="px-1 py-0.5 rounded bg-violet-50 border border-violet-200 text-[10px] font-mono font-bold text-violet-700 leading-none">
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
                                        <div className="text-[10px] text-slate-400 mt-0.5">
                                          内建 {ownedCount} 个专业 Agent
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
                                className="flex-1 min-w-0 h-7 rounded-md border border-slate-200 bg-slate-50 px-2 text-[11px] text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600/30"
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
                                    onAssignExpertToWorkspace(effectiveAssignId, focusedProject.id);
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
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <EntityAvatar
                                    kind="agent"
                                    code={ag.avatarCode}
                                    accent={ag.avatarAccent}
                                    size="sm"
                                  />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <AgentIdentityName
                                        name={ag.handle}
                                        runtime={ag.runtimeAgent}
                                        model={ag.defaultModel}
                                        showModel
                                        className="font-semibold text-slate-900"
                                      />
                                    </div>
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
                              </div>

                              {ag.ownership === 'marketplace' && (
                                <div className="pt-1.5 border-t border-slate-200/70 flex items-center justify-between gap-2">
                                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                                    <CalendarClock className="w-3 h-3 text-indigo-500" />
                                    <span>切换租期</span>
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

        {/* ================= TAB 3: TASK FLOW KANBAN (Clean 4-Column Multi-Agent Board) ================= */}
        {activeTab === 'kanban' && (
          <div className={`${WORKSPACE_MAX_WIDTH_CLASS} grid grid-cols-1 @[620px]:grid-cols-2 @[1040px]:grid-cols-4 gap-4 min-h-full`}>
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
                  {/* Column Header: Unified 3-char status */}
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

                  {/* Clean Task Cards: Current Status + Executing Agent ONLY (no redundant horizontal flow line) */}
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
                            {/* Top Row: Scope / Module + Current 3-Char Status */}
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-medium text-slate-500 truncate">
                                {kanbanProjectScope === 'all' && proj ? `${proj.name} · ` : ''}
                                {task.featureModule}
                              </span>
                              <WorkStatusBadge status={task.status} executing={isExecuting} />
                            </div>

                            {/* Task Title & Brief */}
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

                            {/* Executing Agent Expert Row */}
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

                            {/* Action Row */}
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

        {/* ================= TAB 4: PROJECT AGENT ORCHESTRATION, STATUS & HIRING ================= */}
        {activeTab === 'agents' && (
          <div className={`${WORKSPACE_MAX_WIDTH_CLASS} space-y-5`}>
            {/* Compact Fleet Status Summary Strip */}
            <div className="grid grid-cols-2 @[640px]:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
                <div className="text-[11px] text-slate-500">项目整体 Agent</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-xl font-bold font-mono tabular-nums text-slate-900">
                    {agentSnapshots.length}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    外部 {externalFleetCount} · 自有 {privateFleetCount}
                  </span>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
                <div className="text-[11px] text-slate-500">在线 · 空闲可派单</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-xl font-bold font-mono tabular-nums text-emerald-700">
                    {idleAgentCount}
                  </span>
                  <span className="text-[11px] text-slate-500">随时承接新节点</span>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
                <div className="text-[11px] text-slate-500">在线 · 忙碌执行中</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-xl font-bold font-mono tabular-nums text-blue-700">
                    {busyAgentCount}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {inProgressCount} 执行中 · {reviewCount} 待验证
                  </span>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
                <div className="text-[11px] text-slate-500">外部签约 / 待确认协商</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-xl font-bold font-mono tabular-nums text-slate-900">
                    ${totalExternalSpentUsd.toLocaleString('en-US')}
                  </span>
                  <span className="text-[11px] text-amber-700 font-semibold">
                    {pendingNegotiationCount} 项协商中
                  </span>
                </div>
              </div>
            </div>

            {/* Section 0: Interactive Multi-Agent Workflow Pipeline Orchestration */}
            {(() => {
              const activePipeProj =
                workspaces.find((w) => w.id === pipelineProjectId) || workspaces[0];
              if (!activePipeProj) return null;
              const projAgents = activePipeProj.hiredAgentIds
                .map((id) => agentMap.get(id))
                .filter((a): a is ExpertAgent => Boolean(a));

              const pipelineStages: {
                step: string;
                workType: WorkCardType;
                label: string;
                preferredCategory: ExpertAgent['category'];
              }[] = [
                { step: '01', workType: 'planning', label: '产品策划', preferredCategory: 'product' },
                { step: '02', workType: 'development', label: '功能开发', preferredCategory: 'engineering' },
                { step: '03', workType: 'review', label: '架构评审', preferredCategory: 'architecture' },
                { step: '04', workType: 'testing', label: '功能测试', preferredCategory: 'qa' },
              ];

              return (
                <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        <GitBranch className="w-4 h-4 text-blue-600" />
                        <span>多 Agent 流程编排管道（本体 Agent · 默认模型）</span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        按项目编排各协作节点的执行 Agent 及其底层本体与默认模型，任务看板将按此配置流转执行。
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={activePipeProj.id}
                        onChange={(e) => setPipelineProjectId(e.target.value)}
                        aria-label="选择编排项目"
                        className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      >
                        {workspaces.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setKanbanProjectScope(activePipeProj.id);
                          setActiveTab('kanban');
                        }}
                        className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white whitespace-nowrap cursor-pointer"
                      >
                        <span>按此编排走看板</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {pipelineStages.map((st, idx) => {
                      const stageTask = allTasks.find(
                        (t) => t.sessionId === activePipeProj.id && t.workType === st.workType,
                      );
                      const boundAgent =
                        (stageTask ? agentMap.get(stageTask.assigneeId) : undefined) ||
                        projAgents.find((a) => a.category === st.preferredCategory) ||
                        agents.find((a) => a.category === st.preferredCategory);
                      const snap = boundAgent ? snapshotByAgentId.get(boundAgent.id) : undefined;
                      const preset = getRuntimePreset(boundAgent?.runtimeAgent);
                      const modelOptions = boundAgent
                        ? Array.from(new Set([boundAgent.defaultModel, ...preset.models]))
                        : preset.models;

                      return (
                        <div
                          key={st.workType}
                          className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 flex flex-col justify-between gap-2.5"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                                <span className="font-mono text-slate-400">{st.step}</span>
                                <span className={WORK_TYPE_COLORS[st.workType]}>{st.label}</span>
                              </span>
                              {idx < pipelineStages.length - 1 && (
                                <span className="text-[10px] font-mono text-slate-400">
                                  → 下游
                                </span>
                              )}
                            </div>

                            {boundAgent ? (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2 min-w-0">
                                  <EntityAvatar
                                    kind="agent"
                                    code={boundAgent.avatarCode}
                                    accent={boundAgent.avatarAccent}
                                    size="xs"
                                    showCornerMark={false}
                                  />
                                  <AgentIdentityName
                                    name={boundAgent.handle}
                                    runtime={boundAgent.runtimeAgent}
                                    model={boundAgent.defaultModel}
                                    className="text-xs font-bold text-slate-900"
                                  />
                                </div>
                                <div className="flex items-center justify-between gap-1.5 text-[11px]">
                                  {snap ? renderAvailabilityIndicator(snap) : <span className="text-slate-400">待命</span>}
                                  <span className="text-slate-400 font-mono truncate">
                                    {formatShortModel(boundAgent.defaultModel)}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs text-slate-400 py-1">未绑定专家节点</div>
                            )}
                          </div>

                          {boundAgent && (
                            <div className="pt-2 border-t border-slate-200/80 grid grid-cols-2 gap-1.5">
                              <select
                                value={boundAgent.runtimeAgent}
                                onChange={(e) => {
                                  const nextRuntime = e.target.value;
                                  const nextPreset = getRuntimePreset(nextRuntime);
                                  onUpdateAgentRuntimeConfig(
                                    boundAgent.id,
                                    nextRuntime,
                                    nextPreset.defaultModel,
                                  );
                                }}
                                aria-label={`${st.label}本体 Agent`}
                                className="h-7 rounded border border-slate-200 bg-white px-1.5 text-[11px] font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600/30 truncate"
                              >
                                {AGENT_RUNTIME_PRESETS.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.label}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={boundAgent.defaultModel}
                                onChange={(e) =>
                                  onUpdateAgentRuntimeConfig(
                                    boundAgent.id,
                                    boundAgent.runtimeAgent,
                                    e.target.value,
                                  )
                                }
                                aria-label={`${st.label}默认模型`}
                                className="h-7 rounded border border-slate-200 bg-white px-1.5 text-[11px] font-mono text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600/30 truncate"
                              >
                                {modelOptions.map((m) => (
                                  <option key={m} value={m}>
                                    {m}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })()}

            {/* Section 1: Comprehensive Project Agent Fleet Status Table */}
            <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    项目整体 Agent 态势与实时状态 ({filteredFleet.length})
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    统一管理所有在役外部专家 Agent 与自有节点的本体 Agent、默认模型、在线闲忙及费用 / Token 消耗。
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                      <th className="py-2.5 px-5">Agent 专家</th>
                      <th className="py-2.5 px-4">本体 Agent / 默认模型</th>
                      <th className="py-2.5 px-4">在线 / 闲忙状态</th>
                      <th className="py-2.5 px-4">参与项目与负载</th>
                      <th className="py-2.5 px-4">当前聚焦任务</th>
                      <th className="py-2.5 px-4 text-right">费用 / Token 消耗</th>
                      <th className="py-2.5 px-5 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredFleet.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-xs text-slate-500">
                          当前筛选条件下暂无匹配的 Agent 节点
                        </td>
                      </tr>
                    ) : (
                      filteredFleet.map((snap) => {
                        const { agent } = snap;
                        const preset = getRuntimePreset(agent.runtimeAgent);
                        const runtimeOptions = Array.from(
                          new Set([agent.runtimeAgent, ...AGENT_RUNTIME_PRESETS.map((p) => p.id)]),
                        );
                        const modelOptions = Array.from(
                          new Set([agent.defaultModel, ...preset.models]),
                        );
                        return (
                          <tr key={agent.id} className="hover:bg-slate-50/60">
                            <td className="py-3 px-5">
                              <div className="flex items-center gap-2.5">
                                <EntityAvatar
                                  kind="agent"
                                  code={agent.avatarCode}
                                  accent={agent.avatarAccent}
                                  size="sm"
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <AgentIdentityName
                                      name={agent.handle}
                                      runtime={agent.runtimeAgent}
                                      model={agent.defaultModel}
                                      className="font-semibold text-slate-900"
                                    />
                                    <span
                                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                                        agent.ownership === 'private'
                                          ? 'bg-sky-50 text-sky-700'
                                          : 'bg-slate-100 text-slate-600'
                                      }`}
                                    >
                                      {agent.ownership === 'private' ? '自有节点' : '外部雇佣'}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate mt-0.5">
                                    {agent.ownerHumanName ? `归属专家 ${agent.ownerHumanName} · ` : ''}
                                    {SERVICE_MODE_LABELS[agent.serviceMode]}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="flex flex-col gap-1 min-w-[148px]">
                                <select
                                  value={agent.runtimeAgent}
                                  onChange={(e) => {
                                    const nextRuntime = e.target.value;
                                    const nextPreset = getRuntimePreset(nextRuntime);
                                    onUpdateAgentRuntimeConfig(
                                      agent.id,
                                      nextRuntime,
                                      nextPreset.defaultModel,
                                    );
                                  }}
                                  aria-label={`${displayEntityName(agent.handle)} 本体 Agent`}
                                  className="h-6 rounded border border-slate-200 bg-white px-1.5 text-[11px] font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600/30"
                                >
                                  {runtimeOptions.map((rt) => (
                                    <option key={rt} value={rt}>
                                      {rt}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  value={agent.defaultModel}
                                  onChange={(e) =>
                                    onUpdateAgentRuntimeConfig(
                                      agent.id,
                                      agent.runtimeAgent,
                                      e.target.value,
                                    )
                                  }
                                  aria-label={`${displayEntityName(agent.handle)} 默认模型`}
                                  className="h-6 rounded border border-slate-200 bg-slate-50 px-1.5 text-[11px] font-mono text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600/30"
                                >
                                  {modelOptions.map((m) => (
                                    <option key={m} value={m}>
                                      {m}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </td>

                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="space-y-0.5">
                                {renderAvailabilityIndicator(snap)}
                                <div className="text-[11px] text-slate-500">
                                  {snap.availabilityDetail}
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-4">
                              <div className="text-slate-800 font-medium truncate max-w-[200px]">
                                {snap.projects.length > 0
                                  ? snap.projects.map((p) => p.name).join('、')
                                  : '未加入项目（待命）'}
                              </div>
                              <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                                待批 {snap.pendingCount} · 执行 {snap.inProgressCount} · 待验{' '}
                                {snap.reviewCount} · 完成 {snap.doneCount}
                              </div>
                            </td>

                            <td className="py-3 px-4 max-w-[210px]">
                              {snap.activeTask ? (
                                <button
                                  type="button"
                                  onClick={() => onOpenTaskSession(snap.activeTask!.id)}
                                  className="text-left group cursor-pointer"
                                >
                                  <div className="text-xs font-medium text-slate-800 group-hover:text-blue-700 truncate max-w-[200px]">
                                    {snap.activeTask.title}
                                  </div>
                                  <div className="mt-0.5">
                                    <WorkStatusBadge
                                      status={snap.activeTask.status}
                                      executing={executingTaskId === snap.activeTask.id}
                                    />
                                  </div>
                                </button>
                              ) : (
                                <span className="text-[11px] text-slate-400">暂无进行中任务</span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                              {agent.ownership === 'private' ? (
                                <div>
                                  <div className="font-semibold text-sky-700">
                                    {formatTokensK(snap.privateTokensK)} tokens
                                  </div>
                                  <div className="text-[11px] text-slate-400">
                                    ≈ ${snap.privateTokenCostUsd.toFixed(1)} · 自用免租
                                  </div>
                                </div>
                              ) : (() => {
                                const lease = agentLeases[agent.id];
                                const pricing = getAgentLeasePricing({
                                  runtimeAgent: agent.runtimeAgent,
                                  defaultModel: agent.defaultModel,
                                  capabilityTier: agent.performance.capabilityTier,
                                  ownership: agent.ownership,
                                  projectPriceUsd: agent.projectPriceUsd,
                                  monthlyLeaseUsd: agent.monthlyLeaseUsd,
                                });
                                return (
                                  <div className="space-y-1">
                                    <div className="font-semibold text-slate-900">
                                      {lease
                                        ? `$${lease.priceUsd}${LEASE_PERIOD_META[lease.period].unitSuffix}`
                                        : `$${pricing.monthlyUsd}/月`}
                                    </div>
                                    <div className="flex items-center justify-end gap-1.5">
                                      <span className="text-[11px] font-sans text-emerald-700 font-medium">
                                        {lease ? lease.expiresLabel : '未定周期'}
                                      </span>
                                      <select
                                        value={lease?.period || 'month'}
                                        onChange={(e) =>
                                          onLeaseAgent(
                                            agent.id,
                                            e.target.value as LeasePeriod,
                                            snap.projects[0]?.id,
                                          )
                                        }
                                        aria-label={`调整 ${displayEntityName(agent.handle)} 租期`}
                                        className="h-5 rounded border border-slate-200 bg-slate-50 px-1 text-[10px] font-sans text-slate-700 cursor-pointer focus:bg-white focus:outline-none"
                                      >
                                        <option value="week">1周</option>
                                        <option value="month">1个月</option>
                                        <option value="quarter">1季度</option>
                                      </select>
                                    </div>
                                  </div>
                                );
                              })()}
                            </td>

                            <td className="py-3 px-5 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                {snap.activeTask && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenTaskSession(snap.activeTask!.id)}
                                    className="px-2 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer"
                                  >
                                    进入任务
                                  </button>
                                )}
                                {snap.projects[0] && (
                                  <button
                                    type="button"
                                    onClick={() => onReleaseAgent(agent.id, snap.projects[0].id)}
                                    title={`移出「${snap.projects[0].name}」`}
                                    className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                                  >
                                    <UserMinus className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Section 2: External Expert Hiring & Negotiation Pipeline */}
            <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Handshake className="w-4 h-4 text-blue-600" />
                    <span>外部专家雇佣与报价协商 ({negotiations.length})</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    与各专区专家的私聊协商均沉淀于此，确认报价后一键雇佣并加入项目 Agent 编排。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onJumpToMarket}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer whitespace-nowrap self-start sm:self-auto"
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>招募新专家 Agent</span>
                </button>
              </div>

              {negotiations.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  暂无外部雇佣协商，可前往服务市场发掘各社区认证 Agent 与专家。
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {negotiations.map((thread) => {
                    const agent = agentMap.get(thread.agentId);
                    const targetProj = workspaceMap.get(thread.targetProjectId);
                    if (!agent) return null;
                    const st = NEGOTIATION_STATUS_META[thread.status];
                    const alreadyInTarget = Boolean(
                      targetProj?.hiredAgentIds.includes(agent.id),
                    );

                    return (
                      <div
                        key={thread.agentId}
                        className="px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <EntityAvatar
                            kind="agent"
                            code={agent.avatarCode}
                            accent={agent.avatarAccent}
                            size="md"
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                              <AgentIdentityName
                                name={agent.handle}
                                runtime={agent.runtimeAgent}
                                model={agent.defaultModel}
                                showModel
                                className="font-bold text-slate-900"
                              />
                              {agent.ownerHumanName && (
                                <span className="text-xs text-emerald-700 font-medium">
                                  归属专家：{agent.ownerHumanName}
                                </span>
                              )}
                              <span className="text-xs text-slate-500">{agent.title}</span>
                              <span className="text-slate-300" aria-hidden="true">·</span>
                              <span className={`text-xs font-semibold ${st.cls}`}>{st.label}</span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600">
                              <span>目标项目：{targetProj?.name || '未指定'}</span>
                              <span className="text-slate-300" aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums font-semibold text-slate-900">
                                协商项目价 ${Math.round(thread.negotiatedPriceUsd).toLocaleString('en-US')}/项目
                              </span>
                              <span className="text-slate-300" aria-hidden="true">·</span>
                              <span>{SERVICE_MODE_LABELS[agent.serviceMode]}</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1 truncate">
                              拟立项任务：{thread.firstWorkCardTitle}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {alreadyInTarget ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold whitespace-nowrap">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>已雇佣入群</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onConfirmHire(agent.id, true)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>确认雇佣入群</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
