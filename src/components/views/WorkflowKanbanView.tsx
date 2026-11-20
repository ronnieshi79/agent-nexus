import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  FileCode2,
  FolderKanban,
  GitBranch,
  Handshake,
  Layers,
  MessageSquareText,
  Play,
  Plus,
  RotateCcw,
  ShieldCheck,
  Store,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react';
import type {
  ExpertAgent,
  NegotiationStatus,
  NegotiationThread,
  ProjectWorkspace,
  ServiceMode,
  SettlementRecord,
  TaskStatus,
  WorkCardType,
  WorkflowTask,
} from '../../types/agentnexus';
import { WORK_CARD_STAGES, WORK_STATUS_META, WorkCardStageBar } from '../workcard/WorkCardFlow';

type WorkBoardTab = 'overview' | 'flow' | 'hiring';

interface WorkflowKanbanViewProps {
  workspaces: ProjectWorkspace[];
  activeWorkspace: ProjectWorkspace;
  projectSeed: string | null;
  onClearProjectSeed: () => void;
  allTasks: WorkflowTask[];
  agents: ExpertAgent[];
  negotiations: NegotiationThread[];
  settlements: SettlementRecord[];
  executingTaskId: string | null;
  onCreateProject: (name: string, goal: string) => string;
  onRunTask: (taskId: string) => Promise<void>;
  onUpdateStatus: (taskId: string, status: TaskStatus) => void;
  onOpenNegotiation: (agentId: string) => void;
  onConfirmHire: (agentId: string, createFirstCard: boolean) => void;
  onJumpToChat: (projectId?: string) => void;
  onJumpToAssistant: () => void;
  onJumpToMarket: () => void;
  onReleaseAgent: (agentId: string, projectId?: string) => void;
  onMentionInChat: (handle: string, projectId?: string) => void;
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
  quoted: { label: '已报价待确认', cls: 'text-amber-700' },
  hired: { label: '已雇佣入群', cls: 'text-emerald-700' },
};

const SERVICE_MODE_LABELS: Record<ServiceMode, string> = {
  'pure-agent': '纯 Agent 租用',
  'human-agent': '人 + Agent 协同',
};

export function WorkflowKanbanView({
  workspaces,
  activeWorkspace,
  projectSeed,
  onClearProjectSeed,
  allTasks,
  agents,
  negotiations,
  settlements,
  executingTaskId,
  onCreateProject,
  onRunTask,
  onUpdateStatus,
  onOpenNegotiation,
  onConfirmHire,
  onJumpToChat,
  onJumpToAssistant,
  onJumpToMarket,
  onReleaseAgent,
  onMentionInChat,
}: WorkflowKanbanViewProps) {
  // Overview is FIRST and default!
  const [activeTab, setActiveTab] = useState<WorkBoardTab>('overview');
  const [projectScope, setProjectScope] = useState<string>('all');
  const [workTypeFilter, setWorkTypeFilter] = useState<'all' | WorkCardType>('all');
  const [showCreateProjectForm, setShowCreateProjectForm] = useState(false);

  // Create project inline form state
  const [projName, setProjName] = useState('');
  const [projGoal, setProjGoal] = useState('');

  useEffect(() => {
    if (projectSeed) {
      setProjectScope(projectSeed);
      setActiveTab('overview');
      onClearProjectSeed();
    }
  }, [projectSeed, onClearProjectSeed]);

  const workspaceMap = useMemo(() => {
    const map = new Map<string, ProjectWorkspace>();
    workspaces.forEach((w) => map.set(w.id, w));
    return map;
  }, [workspaces]);

  const focusedProject = useMemo(
    () => (projectScope === 'all' ? null : workspaceMap.get(projectScope) || null),
    [projectScope, workspaceMap],
  );

  const metricWorkspaces = useMemo(
    () => (focusedProject ? [focusedProject] : workspaces),
    [focusedProject, workspaces],
  );

  const metricTasks = useMemo(
    () =>
      focusedProject
        ? allTasks.filter((t) => t.sessionId === focusedProject.id)
        : allTasks,
    [allTasks, focusedProject],
  );

  const scopedFlowTasks = useMemo(() => {
    return metricTasks.filter((t) =>
      workTypeFilter === 'all' ? true : t.workType === workTypeFilter,
    );
  }, [metricTasks, workTypeFilter]);

  const doneCount = metricTasks.filter((t) => t.status === 'done').length;
  const reviewCount = metricTasks.filter((t) => t.status === 'review').length;
  const progressPct =
    metricTasks.length > 0 ? Math.round((doneCount / metricTasks.length) * 100) : 0;

  const totalSpent = metricWorkspaces.reduce((sum, w) => sum + w.spentUsd, 0);
  const totalCap = metricWorkspaces.reduce((sum, w) => sum + w.budgetCapUsd, 0);
  const budgetPct = Math.min(100, Math.round((totalSpent / Math.max(1, totalCap)) * 100));

  const scopedNegotiations = useMemo(
    () =>
      negotiations.filter((n) =>
        focusedProject ? n.targetProjectId === focusedProject.id : true,
      ),
    [focusedProject, negotiations],
  );

  const pendingNegotiationCount = scopedNegotiations.filter((n) => n.status !== 'hired').length;

  const scopedUnsettledUsd = useMemo(
    () =>
      settlements
        .filter(
          (s) =>
            s.status === 'unsettled' &&
            (focusedProject ? s.projectId === focusedProject.id : true),
        )
        .reduce((sum, s) => sum + s.amountUsd, 0),
    [focusedProject, settlements],
  );

  const hiredEngagements = useMemo(() => {
    const rows: {
      agent: ExpertAgent;
      project: ProjectWorkspace;
      totalCards: number;
      activeCards: number;
      doneCards: number;
      contractedPriceUsd: number;
    }[] = [];

    metricWorkspaces.forEach((proj) => {
      proj.hiredAgentIds.forEach((agentId) => {
        const agent = agents.find((a) => a.id === agentId);
        if (!agent) return;
        const projTasks = allTasks.filter(
          (t) => t.sessionId === proj.id && t.assigneeId === agentId,
        );
        rows.push({
          agent,
          project: proj,
          totalCards: projTasks.length,
          activeCards: projTasks.filter((t) => t.status !== 'done').length,
          doneCards: projTasks.filter((t) => t.status === 'done').length,
          contractedPriceUsd: agent.ownership === 'private' ? 0 : agent.projectPriceUsd,
        });
      });
    });

    return rows;
  }, [agents, allTasks, metricWorkspaces]);

  // Focused single-project grouped modules for Single-Project Overview
  const focusedModules = useMemo(() => {
    if (!focusedProject) return [];
    const map = new Map<string, WorkflowTask[]>();
    metricTasks.forEach((t) => {
      const list = map.get(t.featureModule) || [];
      list.push(t);
      map.set(t.featureModule, list);
    });
    return Array.from(map.entries());
  }, [focusedProject, metricTasks]);

  const handleCreateProjectSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!projName.trim()) return;
    const newId = onCreateProject(projName, projGoal);
    setProjName('');
    setProjGoal('');
    setShowCreateProjectForm(false);
    if (newId) {
      setProjectScope(newId);
      setActiveTab('overview');
    }
  };

  return (
    <div className="h-full flex flex-col min-h-0 bg-white">
      {/* Top Multi-Project Switcher + Actions + KPI + Perspective Tabs */}
      <div className="shrink-0 px-5 sm:px-8 pt-5 pb-4 border-b border-slate-200">
        {/* Title Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">工作看板</h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              工作卡片统一由项目群聊对话或输入框直接生成，看板专注多项目概览统筹、任务流状态流转与雇佣协同。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() =>
                onJumpToChat(focusedProject ? focusedProject.id : activeWorkspace.id)
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
            >
              <MessageSquareText className="w-3.5 h-3.5" />
              <span>进入项目群对话生成</span>
            </button>
          </div>
        </div>

        {/* Dedicated Multi-Project Switcher Strip */}
        <div className="mt-4 flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setProjectScope('all')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              projectScope === 'all'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>全部项目 ({workspaces.length})</span>
          </button>

          {workspaces.map((ws) => {
            const active = projectScope === ws.id;
            const wsCount = allTasks.filter((t) => t.sessionId === ws.id).length;
            return (
              <button
                key={ws.id}
                type="button"
                onClick={() => setProjectScope(ws.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-blue-50 text-blue-800 border-blue-300 font-semibold'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <FolderKanban className="w-3.5 h-3.5 shrink-0" />
                <span>{ws.name}</span>
                <span className="font-mono tabular-nums text-[11px] opacity-70">{wsCount}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setShowCreateProjectForm((v) => !v)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 border border-dashed border-slate-300 hover:border-slate-400 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新建项目</span>
          </button>
        </div>

        {/* Inline Create Project Form */}
        {showCreateProjectForm && (
          <form
            onSubmit={handleCreateProjectSubmit}
            className="mt-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
          >
            <input
              type="text"
              required
              value={projName}
              onChange={(e) => setProjName(e.target.value)}
              placeholder="输入新项目名称（如：出海营销内容自动化引擎）..."
              className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
            />
            <input
              type="text"
              value={projGoal}
              onChange={(e) => setProjGoal(e.target.value)}
              placeholder="项目核心目标（可选）"
              className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
            />
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
              >
                创建项目
              </button>
              <button
                type="button"
                onClick={() => setShowCreateProjectForm(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* 4-Column Tabular KPI Strip */}
        <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-5 pt-4 border-t border-slate-100">
          <div>
            <div className="text-xs text-slate-500">
              {focusedProject ? '当前项目专家席次' : '多项目总览'}
            </div>
            <div className="mt-1 flex items-baseline gap-2 font-mono tabular-nums">
              <span className="text-xl font-bold text-slate-900">
                {focusedProject ? focusedProject.hiredAgentIds.length : workspaces.length}
              </span>
              <span className="text-xs font-sans text-slate-500">
                {focusedProject
                  ? '位在役专家'
                  : `个托管项目 · ${hiredEngagements.length} 席次`}
              </span>
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500">工作卡片完成率</div>
            <div className="mt-1 flex items-baseline gap-2 font-mono tabular-nums">
              <span className="text-xl font-bold text-slate-900">{progressPct}%</span>
              <span className="text-xs text-slate-500">
                {doneCount}/{metricTasks.length} 卡 · {reviewCount} 待验收
              </span>
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500">雇佣协商 / 待结项目款</div>
            <div className="mt-1 flex items-baseline gap-2 font-mono tabular-nums">
              <span className="text-xl font-bold text-amber-700">{pendingNegotiationCount}</span>
              <span className="text-xs font-sans text-slate-500">
                洽谈 ·{' '}
                <button
                  type="button"
                  onClick={onJumpToAssistant}
                  className="font-mono text-blue-700 hover:underline cursor-pointer"
                >
                  待结 ${Math.round(scopedUnsettledUsd).toLocaleString('en-US')}
                </button>
              </span>
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>项目签约总额</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2 font-mono tabular-nums">
              <span className="text-xl font-bold text-slate-900">
                ${totalSpent.toLocaleString('en-US')}
              </span>
              <span className="text-xs text-slate-500">
                / ${totalCap.toLocaleString('en-US')} ({budgetPct}%)
              </span>
            </div>
          </div>
        </div>

        {/* 3 Perspectives: Project Overview FIRST -> Project Task Flow -> Hiring & Negotiations */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              项目概览 {focusedProject ? '' : `(${workspaces.length})`}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('flow')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'flow'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              项目任务流 ({scopedFlowTasks.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('hiring')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'hiring'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              雇佣与协商 (
              {pendingNegotiationCount > 0
                ? `${pendingNegotiationCount} 待确认`
                : hiredEngagements.length}
              )
            </button>
          </div>

          {activeTab === 'flow' && (
            <div className="flex items-center gap-1 overflow-x-auto">
              {(
                [
                  { id: 'all', label: '全部卡片类型' },
                  { id: 'planning', label: '产品策划' },
                  { id: 'development', label: '功能开发' },
                  { id: 'testing', label: '功能测试' },
                  { id: 'review', label: '架构评审' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setWorkTypeFilter(opt.id)}
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    workTypeFilter === opt.id
                      ? 'bg-slate-900 text-white font-semibold'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto clean-scroll bg-slate-50/70 px-5 sm:px-8 py-5">
        {/* TAB 1 (FIRST): Project Overview — Supports Multi-Project Portfolio AND Focused Single-Project Cockpit */}
        {activeTab === 'overview' && (
          <div className="max-w-6xl mx-auto space-y-4">
            {!focusedProject ? (
              /* Multi-Project Portfolio Overview */
              workspaces.map((proj) => {
                const projTasks = allTasks.filter((t) => t.sessionId === proj.id);
                const projDone = projTasks.filter((t) => t.status === 'done').length;
                const projReview = projTasks.filter((t) => t.status === 'review').length;
                const projPct =
                  projTasks.length > 0 ? Math.round((projDone / projTasks.length) * 100) : 0;
                const projMembers = agents.filter((a) => proj.hiredAgentIds.includes(a.id));
                const projNegotiations = negotiations.filter(
                  (n) => n.targetProjectId === proj.id && n.status !== 'hired',
                );
                const projUnsettled = settlements
                  .filter((s) => s.projectId === proj.id && s.status === 'unsettled')
                  .reduce((sum, s) => sum + s.amountUsd, 0);

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
                        <div className="flex items-center gap-2">
                          <FolderKanban className="w-4 h-4 text-blue-600 shrink-0" />
                          <h2 className="text-base font-bold text-slate-900 truncate">
                            {proj.name}
                          </h2>
                          <span className="text-[11px] text-slate-500 whitespace-nowrap">
                            · {proj.workspaceTier}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">{proj.goal}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setProjectScope(proj.id)}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer whitespace-nowrap"
                        >
                          聚焦单项目概览
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setProjectScope(proj.id);
                            setActiveTab('flow');
                          }}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer whitespace-nowrap"
                        >
                          项目任务流
                        </button>
                        <button
                          type="button"
                          onClick={() => onJumpToChat(proj.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
                        >
                          <span>进入项目群</span>
                          <ArrowRight className="w-3.5 h-3.5" />
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
                          {projReview > 0 ? `${projReview} 张待验收` : '暂无验收阻塞'} ·{' '}
                          {projNegotiations.length > 0
                            ? `${projNegotiations.length} 位外部专家洽谈中`
                            : '无待确认雇佣'}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-slate-500 mb-1.5">功能模块拆解</div>
                        {modules.length === 0 ? (
                          <div className="text-xs text-slate-400">暂无工作卡片</div>
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
                          <span>在役专家 ({projMembers.length})</span>
                          <span className="font-mono tabular-nums text-slate-700">
                            ${proj.spentUsd.toLocaleString('en-US')} / $
                            {proj.budgetCapUsd.toLocaleString('en-US')}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-700">
                          {projMembers.map((m) => (
                            <span key={m.id} className="inline-flex items-center gap-1">
                              <span
                                className="w-4 h-4 rounded text-[9px] font-bold text-white inline-flex items-center justify-center"
                                style={{ backgroundColor: m.avatarAccent }}
                              >
                                {m.avatarCode}
                              </span>
                              <span>{m.handle}</span>
                            </span>
                          ))}
                        </div>
                        {projUnsettled > 0 && (
                          <div className="mt-1.5 text-[11px] text-amber-700 font-mono tabular-nums">
                            待结项目款 ${Math.round(projUnsettled).toLocaleString('en-US')}
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                );
              })
            ) : (
              /* Single-Project Focused Cockpit Overview */
              <div className="space-y-4">
                <section className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <FolderKanban className="w-4 h-4 text-blue-600" />
                        <h2 className="text-base font-bold text-slate-900">
                          {focusedProject.name}
                        </h2>
                        <span className="text-xs text-slate-500">
                          · {focusedProject.workspaceTier}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                        {focusedProject.goal}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setActiveTab('flow')}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer whitespace-nowrap"
                      >
                        切换四列任务流
                      </button>
                      <button
                        type="button"
                        onClick={() => onJumpToChat(focusedProject.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
                      >
                        <span>进入项目群聊</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </section>

                {/* Feature Modules & Work Cards Breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <section className="lg:col-span-8 bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-900">
                        功能模块与工作卡片概览 ({metricTasks.length})
                      </h3>
                      <button
                        type="button"
                        onClick={() => onJumpToChat(focusedProject.id)}
                        className="text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer whitespace-nowrap"
                      >
                        去项目群对话生成 →
                      </button>
                    </div>

                    {focusedModules.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-500">
                        该项目暂无工作卡片，在项目群对话框中直接描述需求或 @ 专家即可自动生成。
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
                                  已经完成 {modDone}/{modTasks.length}
                                </span>
                              </div>
                              <div className="space-y-2">
                                {modTasks.map((task) => {
                                  const st = WORK_STATUS_META[task.status];
                                  return (
                                    <div
                                      key={task.id}
                                      className="rounded-lg bg-slate-50 border border-slate-200/80 px-3.5 py-2.5 space-y-2"
                                    >
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                        <div className="min-w-0">
                                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                                            <span
                                              className={`font-semibold ${WORK_TYPE_COLORS[task.workType]}`}
                                            >
                                              {WORK_TYPE_LABELS[task.workType]}
                                            </span>
                                            <span className="text-slate-300" aria-hidden="true">·</span>
                                            <span className={`font-semibold ${st.textCls}`}>
                                              {st.label}
                                            </span>
                                            <span className="text-slate-300" aria-hidden="true">·</span>
                                            <span className="text-slate-600">
                                              {task.assigneeHandle}
                                            </span>
                                            <span className="text-slate-300" aria-hidden="true">·</span>
                                            <span className="font-mono tabular-nums text-slate-500">
                                              {task.priority}优
                                            </span>
                                          </div>
                                          <div className="text-xs font-semibold text-slate-900 mt-0.5">
                                            {task.title}
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                          {task.status === 'pending' && (
                                            <button
                                              type="button"
                                              disabled={Boolean(executingTaskId)}
                                              onClick={() => onRunTask(task.id)}
                                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-[11px] font-semibold text-white cursor-pointer disabled:opacity-45 whitespace-nowrap"
                                            >
                                              <Play className="w-3 h-3" />
                                              <span>
                                                {executingTaskId === task.id ? '正在执行中...' : '批准执行'}
                                              </span>
                                            </button>
                                          )}
                                          {task.status === 'in_progress' && (
                                            <span className="text-[11px] font-semibold text-blue-700 whitespace-nowrap">
                                              正在执行中...
                                            </span>
                                          )}
                                          {task.status === 'review' && (
                                            <button
                                              type="button"
                                              onClick={() => onUpdateStatus(task.id, 'done')}
                                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-[11px] font-semibold text-white cursor-pointer whitespace-nowrap"
                                            >
                                              <CheckCircle2 className="w-3 h-3" />
                                              <span>验收通过</span>
                                            </button>
                                          )}
                                          {task.status === 'done' && (
                                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 whitespace-nowrap">
                                              <CheckCircle2 className="w-3 h-3" />
                                              <span>已经完成</span>
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      <WorkCardStageBar status={task.status} compact />
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

                  {/* Right Side: Project Roster + Pending Negotiations */}
                  <div className="lg:col-span-4 space-y-4">
                    <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-slate-900">
                          项目在役专家 ({hiredEngagements.length})
                        </h3>
                        <button
                          type="button"
                          onClick={onJumpToMarket}
                          className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
                        >
                          + 招募专家
                        </button>
                      </div>
                      <div className="space-y-2.5">
                        {hiredEngagements.map((row) => (
                          <div
                            key={row.agent.id}
                            className="flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-6 h-6 rounded text-[10px] font-bold text-white inline-flex items-center justify-center shrink-0"
                                style={{ backgroundColor: row.agent.avatarAccent }}
                              >
                                {row.agent.avatarCode}
                              </span>
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-900 truncate">
                                  {row.agent.handle}
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                                  {row.activeCards} 进行 ·{' '}
                                  {row.contractedPriceUsd > 0
                                    ? `$${row.contractedPriceUsd.toLocaleString('en-US')}/项目`
                                    : '私有自用'}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                onMentionInChat(row.agent.handle, focusedProject.id)
                              }
                              className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 cursor-pointer shrink-0"
                            >
                              @ 派单
                            </button>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                      <h3 className="text-xs font-bold text-slate-900">
                        关联外部协商 ({scopedNegotiations.length})
                      </h3>
                      {scopedNegotiations.length === 0 ? (
                        <p className="text-xs text-slate-500">该项目暂无进行中的外部专家协商。</p>
                      ) : (
                        <div className="space-y-2.5">
                          {scopedNegotiations.map((neg) => {
                            const ag = agents.find((a) => a.id === neg.agentId);
                            if (!ag) return null;
                            const st = NEGOTIATION_STATUS_META[neg.status];
                            return (
                              <div
                                key={neg.agentId}
                                className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1.5"
                              >
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-semibold text-slate-900">{ag.handle}</span>
                                  <span className={`text-[11px] font-semibold font-mono tabular-nums ${st.cls}`}>
                                    {st.label} · ${Math.round(neg.negotiatedPriceUsd).toLocaleString('en-US')}/项目
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-600 line-clamp-1">
                                  {neg.firstWorkCardTitle}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => onOpenNegotiation(neg.agentId)}
                                  className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
                                >
                                  打开私聊协商 →
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Project Task Flow (4-Column Unified Lifecycle Kanban) */}
        {activeTab === 'flow' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 min-h-full">
            {WORK_CARD_STAGES.map((col) => {
              const colTasks = scopedFlowTasks.filter((t) => t.status === col.status);
              return (
                <div
                  key={col.status}
                  className="bg-slate-100/80 border border-slate-200/80 rounded-xl p-3 flex flex-col"
                >
                  <div className="px-1.5 pb-2.5 mb-2.5 border-b border-slate-200 flex items-center justify-between gap-2">
                    <div>
                      <h2 className={`text-sm font-bold ${col.textCls}`}>{col.label}</h2>
                      <p className="text-[11px] text-slate-500">{col.hint}</p>
                    </div>
                    <span className="text-xs font-mono tabular-nums font-semibold text-slate-600">
                      {colTasks.length}
                    </span>
                  </div>

                  <div className="space-y-3 flex-1">
                    {colTasks.length === 0 ? (
                      <div className="h-28 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-400">
                        暂无{col.label}工作卡
                      </div>
                    ) : (
                      colTasks.map((task) => {
                        const agent = agents.find((a) => a.id === task.assigneeId);
                        const proj = workspaceMap.get(task.sessionId);
                        const isExecuting = executingTaskId === task.id;
                        return (
                          <article
                            key={task.id}
                            className="bg-white rounded-lg p-3.5 border border-slate-200 flex flex-col gap-2.5"
                          >
                            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                              <span className="truncate font-medium text-slate-700">
                                {!focusedProject && proj ? `${proj.name} · ` : ''}
                                {task.featureModule}
                              </span>
                              <span
                                className={`font-semibold shrink-0 whitespace-nowrap ${WORK_TYPE_COLORS[task.workType]}`}
                              >
                                {WORK_TYPE_LABELS[task.workType]}
                              </span>
                            </div>

                            <div>
                              <h3 className="text-sm font-semibold text-slate-900 leading-snug">
                                {task.title}
                              </h3>
                              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                                {task.description}
                              </p>
                            </div>

                            <WorkCardStageBar status={task.status} />

                            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 font-mono tabular-nums">
                              <span>
                                {task.id} · {task.priority}优
                              </span>
                              <span>{task.updatedAt}</span>
                            </div>

                            {task.dependsOnTaskId && (
                              <div className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                                <GitBranch className="w-3 h-3 text-slate-400" />
                                <span>前置依赖 {task.dependsOnTaskId}</span>
                              </div>
                            )}

                            {task.deliverableSummary && (
                              <div className="rounded-md bg-slate-50 border border-slate-200/80 p-2.5 text-xs text-slate-700 space-y-1.5">
                                <p className="leading-relaxed">{task.deliverableSummary}</p>
                                {task.deliverableArtifact && (
                                  <div className="flex items-center gap-1 font-mono text-[11px] text-blue-700 truncate">
                                    <FileCode2 className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{task.deliverableArtifact}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span
                                  className="w-5 h-5 rounded text-[10px] font-bold text-white inline-flex items-center justify-center shrink-0"
                                  style={{ backgroundColor: agent?.avatarAccent || '#334155' }}
                                >
                                  {agent?.avatarCode || 'AI'}
                                </span>
                                <span className="font-medium text-slate-800 truncate">
                                  {task.assigneeHandle}
                                </span>
                              </div>
                              {agent && (
                                <span className="text-[11px] text-slate-400 shrink-0 whitespace-nowrap">
                                  {agent.performance.capabilityTier}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {task.status === 'pending' && (
                                <button
                                  type="button"
                                  disabled={Boolean(executingTaskId)}
                                  onClick={() => onRunTask(task.id)}
                                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer disabled:opacity-45"
                                >
                                  <Play className="w-3 h-3" />
                                  <span>{isExecuting ? '正在执行中...' : '批准执行'}</span>
                                </button>
                              )}

                              {task.status === 'in_progress' && (
                                <div className="w-full text-center py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-md">
                                  正在执行中 · 沙箱运行并同步产物...
                                </div>
                              )}

                              {task.status === 'review' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => onUpdateStatus(task.id, 'done')}
                                    className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>验收通过</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onUpdateStatus(task.id, 'pending')}
                                    title="打回重做"
                                    className="p-1.5 rounded-md border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 cursor-pointer"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}

                              {task.status === 'done' && (
                                <div className="w-full flex items-center justify-between text-[11px] text-emerald-700 font-semibold">
                                  <span className="inline-flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>已经完成 · 产物已归档</span>
                                  </span>
                                  <span className="font-mono tabular-nums text-slate-400 font-normal">
                                    {task.updatedAt}
                                  </span>
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

        {/* TAB 3: Hiring & Negotiations Overview */}
        {activeTab === 'hiring' && (
          <div className="max-w-6xl mx-auto space-y-6">
            <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Handshake className="w-4 h-4 text-blue-600" />
                    <span>外部专家雇佣协商 ({scopedNegotiations.length})</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    私聊协商均统一收口在「消息聊天」中，可随时跳转继续洽谈或在此一键雇佣入群。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onJumpToMarket}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer whitespace-nowrap self-start sm:self-auto"
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>去市场发掘更多专家</span>
                </button>
              </div>

              {scopedNegotiations.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  当前项目范围暂无外部雇佣协商，可前往专家市场或消息聊天发起私聊协商。
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {scopedNegotiations.map((thread) => {
                    const agent = agents.find((a) => a.id === thread.agentId);
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
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5"
                            style={{ backgroundColor: agent.avatarAccent }}
                          >
                            {agent.avatarCode}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                              <span className="font-bold text-slate-900">{agent.handle}</span>
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
                              <span>
                                {agent.performance.capabilityTier} · 信誉 {agent.performance.reputationScore}
                              </span>
                              <span className="text-slate-300" aria-hidden="true">·</span>
                              <span>{SERVICE_MODE_LABELS[agent.serviceMode]}</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1 truncate">
                              拟立项工作卡：{thread.firstWorkCardTitle}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => onOpenNegotiation(agent.id)}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer whitespace-nowrap"
                          >
                            打开私聊 ({thread.messages.length})
                          </button>

                          {alreadyInTarget ? (
                            <button
                              type="button"
                              onClick={() =>
                                onMentionInChat(agent.handle, thread.targetProjectId)
                              }
                              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
                            >
                              已入群 · 去 @ 派单
                            </button>
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

            <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200">
                <h2 className="text-sm font-bold text-slate-900">
                  项目在役专家雇佣清单 ({hiredEngagements.length})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  按项目维度查看每位在役专家的工作卡片负载与项目签约价，支持快速 @ 派单或解约移出。
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                      <th className="py-2.5 px-5">专家 Agent</th>
                      <th className="py-2.5 px-4">所属项目</th>
                      <th className="py-2.5 px-4">服务模式</th>
                      <th className="py-2.5 px-4 text-right">工作卡片负载</th>
                      <th className="py-2.5 px-4 text-right">项目签约价</th>
                      <th className="py-2.5 px-5 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {hiredEngagements.map((row) => (
                      <tr
                        key={`${row.project.id}_${row.agent.id}`}
                        className="hover:bg-slate-50/60"
                      >
                        <td className="py-3 px-5">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-7 h-7 rounded-md text-[10px] font-bold text-white inline-flex items-center justify-center shrink-0"
                              style={{ backgroundColor: row.agent.avatarAccent }}
                            >
                              {row.agent.avatarCode}
                            </span>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900">
                                {row.agent.handle}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate">
                                {row.agent.title} · {row.agent.performance.capabilityTier} · 信誉{' '}
                                {row.agent.performance.reputationScore}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800 whitespace-nowrap">
                          {row.project.name}
                        </td>
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                          {SERVICE_MODE_LABELS[row.agent.serviceMode]}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                          进行 {row.activeCards} / 完成 {row.doneCards}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                          {row.contractedPriceUsd > 0
                            ? `$${row.contractedPriceUsd.toLocaleString('en-US')} / 项目`
                            : '私有自用'}
                        </td>
                        <td className="py-3 px-5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                onMentionInChat(row.agent.handle, row.project.id)
                              }
                              className="text-blue-700 hover:text-blue-900 font-semibold cursor-pointer"
                            >
                              @ 派单
                            </button>
                            <button
                              type="button"
                              onClick={() => onReleaseAgent(row.agent.id, row.project.id)}
                              title="移出该项目群"
                              className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
