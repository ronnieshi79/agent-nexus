import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileCode2,
  Inbox,
  MessageSquareCode,
  Pin,
  Play,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import type {
  ExpertAgent,
  ProjectAgentAssignment,
  ProjectStageSlot,
  ProjectTaskType,
  ProjectWorkspace,
  TaskSessionMessage,
  TaskStatus,
  WorkflowTask,
} from '../../types/agentnexus';
import {
  DEFAULT_PROJECT_TASK_TYPES,
  TASK_TYPE_ACCENT_STYLES,
  resolveTaskType,
} from '../../utils/pipelineSync';
import { STAGE_LABEL_MAP, resolveTaskWorkflowTeam } from '../../utils/taskWorkflow';
import { AgentIdentityName, displayEntityName } from '../shared/EntityIdentity';
import { EmptyStateCard, ModalShell } from '../shared/UiPrimitives';

interface ProjectKanbanWidgetProps {
  workspace: ProjectWorkspace;
  tasks: WorkflowTask[];
  taskSessions: Record<string, TaskSessionMessage[]>;
  agents: ExpertAgent[];
  assignments: ProjectAgentAssignment[];
  pipelineSlots: ProjectStageSlot[];
  taskTypes: ProjectTaskType[];
  executingTaskId: string | null;
  pinned: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
  onCloseExpanded: () => void;
  onOpenTaskSession: (taskId: string) => void;
  onRunTask: (taskId: string) => Promise<void>;
  onApproveTask: (taskId: string) => void;
  onUpdateTaskStatus?: (taskId: string, status: TaskStatus) => void;
}

const ACTIVE_COLUMNS: {
  status: Exclude<TaskStatus, 'done'>;
  label: string;
  accentText: string;
  countBg: string;
}[] = [
  {
    status: 'pending',
    label: '任务计划',
    accentText: 'text-slate-800',
    countBg: 'bg-slate-200/80 text-slate-700',
  },
  {
    status: 'in_progress',
    label: '执行中',
    accentText: 'text-blue-700',
    countBg: 'bg-blue-100/80 text-blue-700',
  },
  {
    status: 'review',
    label: '待验收',
    accentText: 'text-amber-700',
    countBg: 'bg-amber-100/80 text-amber-800',
  },
];

export function ProjectKanbanWidget({
  workspace,
  tasks,
  taskSessions,
  agents,
  assignments,
  pipelineSlots,
  taskTypes,
  executingTaskId,
  pinned,
  expanded,
  onToggleExpanded,
  onCloseExpanded,
  onOpenTaskSession,
  onRunTask,
  onApproveTask,
  onUpdateTaskStatus,
}: ProjectKanbanWidgetProps) {
  const isReadOnly =
    workspace.lifecycleStatus === 'completed' || workspace.lifecycleStatus === 'archived';
  const effectiveTaskTypes = taskTypes.length > 0 ? taskTypes : DEFAULT_PROJECT_TASK_TYPES;

  const [searchKeyword, setSearchKeyword] = useState('');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showCompletedInbox, setShowCompletedInbox] = useState(false);

  useEffect(() => {
    setSearchKeyword('');
    setAgentFilter('all');
    setTypeFilter('all');
    setShowCompletedInbox(false);
  }, [workspace.id]);

  useEffect(() => {
    if (!expanded) return;
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && !showCompletedInbox) {
        onCloseExpanded();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [expanded, onCloseExpanded, showCompletedInbox]);

  const agentMap = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);

  const participatingAgents = useMemo(() => {
    const idSet = new Set<string>();
    assignments.forEach((a) => idSet.add(a.agentId));
    tasks.forEach((t) => idSet.add(t.assigneeId));
    return Array.from(idSet)
      .map((id) => agentMap.get(id))
      .filter((a): a is ExpertAgent => Boolean(a));
  }, [agentMap, assignments, tasks]);

  // Global counts for the compact pinned bar & 1-row overview summary table
  const counts = useMemo(() => {
    let pending = 0;
    let inProgress = 0;
    let review = 0;
    let done = 0;
    tasks.forEach((t) => {
      if (executingTaskId === t.id) {
        inProgress += 1;
      } else if (t.status === 'pending') {
        pending += 1;
      } else if (t.status === 'in_progress') {
        inProgress += 1;
      } else if (t.status === 'review') {
        review += 1;
      } else {
        done += 1;
      }
    });
    const completionPct = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
    return { pending, inProgress, review, done, completionPct };
  }, [executingTaskId, tasks]);

  // Filtered tasks inside expanded Kanban
  const filteredTasks = useMemo(() => {
    const q = searchKeyword.trim().toLowerCase();
    return tasks.filter((t) => {
      if (agentFilter !== 'all') {
        const workflow = resolveTaskWorkflowTeam(
          t,
          workspace,
          agents,
          assignments,
          pipelineSlots,
        );
        const involvesAgent =
          t.assigneeId === agentFilter ||
          workflow.participants.some((p) => p.id === agentFilter);
        if (!involvesAgent) return false;
      }
      if (typeFilter !== 'all') {
        const resolved = resolveTaskType(t, effectiveTaskTypes);
        if (resolved.id !== typeFilter) return false;
      }
      if (q) {
        const hay =
          `${t.title} ${t.id} ${t.featureModule || ''} ${t.assigneeHandle} ${t.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    agentFilter,
    agents,
    assignments,
    effectiveTaskTypes,
    pipelineSlots,
    searchKeyword,
    tasks,
    typeFilter,
    workspace,
  ]);

  const completedTasks = useMemo(
    () => tasks.filter((t) => t.status === 'done' && executingTaskId !== t.id),
    [executingTaskId, tasks],
  );

  const hasActiveFilter =
    agentFilter !== 'all' || typeFilter !== 'all' || searchKeyword.trim() !== '';

  return (
    <>
      {/* 1. Pinned Floating Top Bar Widget (Compact single-row bar floating cleanly above chat) */}
      {pinned && !expanded && (
        <div className="shrink-0 z-20 px-4 sm:px-8 pt-2.5 pb-1 bg-white/90 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto">
            <div className="rounded-xl border border-slate-200/90 bg-[#FAFAFA]/95 hover:bg-white shadow-[0_4px_14px_-6px_rgba(15,23,42,0.08)] transition-colors px-3 py-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onToggleExpanded}
                className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer group"
                title="点击展开悬浮项目看板"
              >
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 whitespace-nowrap shrink-0">
                  <Pin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>项目看板</span>
                </span>

                <span className="text-slate-300 text-xs shrink-0" aria-hidden="true">
                  |
                </span>

                <div className="flex items-center gap-2 text-xs text-slate-600 min-w-0 truncate">
                  <span className="whitespace-nowrap">
                    计划{' '}
                    <strong className="font-mono tabular-nums text-slate-900">
                      {counts.pending}
                    </strong>
                  </span>
                  <span className="text-slate-300" aria-hidden="true">
                    ·
                  </span>
                  <span className="whitespace-nowrap">
                    执行{' '}
                    <strong className="font-mono tabular-nums text-blue-700">
                      {counts.inProgress}
                    </strong>
                  </span>
                  <span className="text-slate-300" aria-hidden="true">
                    ·
                  </span>
                  <span className="whitespace-nowrap">
                    验收{' '}
                    <strong className="font-mono tabular-nums text-amber-700">
                      {counts.review}
                    </strong>
                  </span>
                </div>
              </button>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCompletedInbox(true)}
                  title="查看已完成归档的任务卡片"
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/70 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Inbox className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="hidden sm:inline">已完成</span>
                  <span className="font-mono tabular-nums font-semibold text-emerald-700">
                    {counts.done}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onToggleExpanded}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-700 hover:text-slate-950 hover:bg-slate-200/70 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span>展开</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Expanded Floating Kanban Overlay (Streamlined: Top Filter Bar + Compact 1-Row Overview Table + 3-Column Board) */}
      {expanded && (
        <div className="absolute inset-0 z-30 flex flex-col">
          {/* Click-outside translucent backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/15 backdrop-blur-[1px]"
            onClick={onCloseExpanded}
            aria-hidden="true"
          />

          <div
            role="dialog"
            aria-label={`${workspace.name} 悬浮项目看板`}
            className="relative z-10 mx-3 sm:mx-5 mt-2.5 mb-4 max-h-[calc(100%-24px)] rounded-2xl border border-slate-200/95 bg-white shadow-[0_20px_50px_-14px_rgba(15,23,42,0.2)] flex flex-col overflow-hidden"
          >
            {/* Top Bar: Title + Expert Filter + Type Filter + Search + Completed Inbox + Collapse (NO traditional SaaS dispatch button) */}
            <div className="px-4 py-2.5 border-b border-slate-200/80 bg-white flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900 whitespace-nowrap">
                  <Pin className="w-3.5 h-3.5 text-blue-600" />
                  <span>项目看板</span>
                </span>
                <span className="text-slate-300 text-xs" aria-hidden="true">
                  ·
                </span>
                <span className="text-xs font-medium text-slate-600 truncate max-w-[180px]">
                  {workspace.name}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    placeholder="搜索任务..."
                    className="h-8 w-36 sm:w-44 pl-8 pr-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
                  />
                </div>

                {/* Expert Agent Filter */}
                <select
                  value={agentFilter}
                  onChange={(e) => setAgentFilter(e.target.value)}
                  aria-label="按专家 Agent 筛选"
                  className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600/15 cursor-pointer max-w-[160px]"
                >
                  <option value="all">全部专家 ({participatingAgents.length})</option>
                  {participatingAgents.map((ag) => (
                    <option key={ag.id} value={ag.id}>
                      {displayEntityName(ag.name)}
                    </option>
                  ))}
                </select>

                {/* Task Type Filter */}
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  aria-label="按任务类型筛选"
                  className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600/15 cursor-pointer"
                >
                  <option value="all">全部类型</option>
                  {effectiveTaskTypes.map((tt) => (
                    <option key={tt.id} value={tt.id}>
                      {tt.name}
                    </option>
                  ))}
                </select>

                {hasActiveFilter && (
                  <button
                    type="button"
                    onClick={() => {
                      setAgentFilter('all');
                      setTypeFilter('all');
                      setSearchKeyword('');
                    }}
                    className="inline-flex items-center gap-1 h-8 px-2 rounded-lg text-[11px] font-semibold text-blue-700 hover:bg-blue-50 cursor-pointer whitespace-nowrap"
                  >
                    <X className="w-3 h-3" />
                    <span>重置</span>
                  </button>
                )}

                {/* Completed Inbox Button */}
                <button
                  type="button"
                  onClick={() => setShowCompletedInbox(true)}
                  title="查看已验收归档的任务卡片"
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 whitespace-nowrap cursor-pointer transition-colors"
                >
                  <Inbox className="w-3.5 h-3.5 text-emerald-600" />
                  <span>已完成</span>
                  <span className="font-mono tabular-nums text-[11px] font-bold text-emerald-700">
                    {counts.done}
                  </span>
                </button>

                {/* Collapse Floating Kanban */}
                <button
                  type="button"
                  onClick={onCloseExpanded}
                  title="收起看板返回群聊"
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 whitespace-nowrap cursor-pointer transition-colors"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>收起</span>
                </button>
              </div>
            </div>

            {/* Compact Single-Row Summary Table (Replaces bulky multi-row Agent list) */}
            <div className="shrink-0 border-b border-slate-200/80 bg-[#FAFAFA] overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <tbody>
                  <tr className="divide-x divide-slate-200/70">
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className="text-[11px] text-slate-500 mr-2">总任务</span>
                      <span className="font-mono tabular-nums font-bold text-slate-900">
                        {tasks.length}
                      </span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className="text-[11px] text-slate-500 mr-2">任务计划</span>
                      <span className="font-mono tabular-nums font-bold text-slate-800">
                        {counts.pending}
                      </span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className="text-[11px] text-slate-500 mr-2">执行中</span>
                      <span className="font-mono tabular-nums font-bold text-blue-700">
                        {counts.inProgress}
                      </span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className="text-[11px] text-slate-500 mr-2">待验收</span>
                      <span className="font-mono tabular-nums font-bold text-amber-700">
                        {counts.review}
                      </span>
                    </td>
                    <td
                      onClick={() => setShowCompletedInbox(true)}
                      className="px-4 py-2 whitespace-nowrap hover:bg-white cursor-pointer transition-colors"
                      title="点击查看已完成任务箱"
                    >
                      <span className="text-[11px] text-slate-500 mr-2">已完成</span>
                      <span className="font-mono tabular-nums font-bold text-emerald-700">
                        {counts.done}
                      </span>
                      <span className="font-mono tabular-nums text-[10.5px] text-slate-400 ml-1.5">
                        ({counts.completionPct}%)
                      </span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className="text-[11px] text-slate-500 mr-2">参与专家</span>
                      <span className="font-mono tabular-nums font-semibold text-slate-800">
                        {participatingAgents.length}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Main 3-Column Active Kanban Board */}
            <div className="flex-1 min-h-0 overflow-y-auto clean-scroll bg-[#FAFAFA] p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-start">
                {ACTIVE_COLUMNS.map((col) => {
                  const colTasks = filteredTasks.filter((t) => {
                    if (col.status === 'in_progress') {
                      return t.status === 'in_progress' || executingTaskId === t.id;
                    }
                    return t.status === col.status && executingTaskId !== t.id;
                  });

                  return (
                    <div
                      key={col.status}
                      className="rounded-xl border border-slate-200/80 bg-white flex flex-col overflow-hidden"
                    >
                      <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between">
                        <span className={`text-xs font-bold ${col.accentText}`}>{col.label}</span>
                        <span
                          className={`text-[11px] font-mono tabular-nums font-bold px-1.5 py-0.5 rounded ${col.countBg}`}
                        >
                          {colTasks.length}
                        </span>
                      </div>

                      <div className="p-2.5 space-y-2.5 min-h-[160px]">
                        {colTasks.length === 0 ? (
                          <div className="py-10 text-center text-[11px] text-slate-400">
                            暂无{col.label}任务
                          </div>
                        ) : (
                          colTasks.map((task) => {
                            const isExec = executingTaskId === task.id;
                            const taskType = resolveTaskType(task, effectiveTaskTypes);
                            const typeAccent = TASK_TYPE_ACCENT_STYLES[taskType.accent];
                            const workflow = resolveTaskWorkflowTeam(
                              task,
                              workspace,
                              agents,
                              assignments,
                              pipelineSlots,
                            );
                            const activeSpecialist = workflow.activeAgent;
                            const sessionMsgs = taskSessions[task.id] || [];
                            const lastMsg = sessionMsgs[sessionMsgs.length - 1];
                            const needsConfirm = Boolean(lastMsg?.awaitingConfirmation);

                            return (
                              <div
                                key={task.id}
                                className="rounded-xl border border-slate-200/85 bg-[#FAFAFA] hover:bg-white hover:border-slate-300 transition-colors p-3 space-y-2.5"
                              >
                                <div className="flex items-center justify-between gap-2 text-[11px]">
                                  <span className={`font-semibold truncate ${typeAccent.textCls}`}>
                                    {taskType.name}
                                    <span className="text-slate-400 font-mono font-normal ml-1.5">
                                      {task.id}
                                    </span>
                                  </span>
                                  <span className="text-[10.5px] font-mono tabular-nums text-slate-400 shrink-0">
                                    {task.updatedAt}
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    onCloseExpanded();
                                    onOpenTaskSession(task.id);
                                  }}
                                  className="block w-full text-left text-[13px] font-semibold text-slate-900 hover:text-blue-700 leading-snug cursor-pointer"
                                >
                                  {task.title}
                                </button>

                                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                                  <span className="inline-flex items-center gap-1.5 min-w-0">
                                    <span className="flex -space-x-1 shrink-0">
                                      {workflow.participants.map((p) => (
                                        <span
                                          key={p.id}
                                          title={p.handle}
                                          className="w-4 h-4 rounded-full ring-1 ring-white text-[8px] font-bold text-white inline-flex items-center justify-center"
                                          style={{ backgroundColor: p.avatarAccent }}
                                        >
                                          {p.avatarCode.slice(0, 1)}
                                        </span>
                                      ))}
                                    </span>
                                    <AgentIdentityName
                                      name={activeSpecialist?.handle || task.assigneeHandle}
                                      runtime={activeSpecialist?.runtimeAgent}
                                      model={activeSpecialist?.defaultModel}
                                      className="font-medium text-slate-700"
                                    />
                                  </span>
                                  <span className="text-[10.5px] text-slate-400 shrink-0">
                                    {STAGE_LABEL_MAP[workflow.currentStage]}
                                  </span>
                                </div>

                                {task.deliverableArtifact && (
                                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-blue-700 truncate">
                                    <FileCode2 className="w-3.5 h-3.5 shrink-0" />
                                    <span className="truncate">{task.deliverableArtifact}</span>
                                  </div>
                                )}

                                <div className="flex items-center gap-1.5 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onCloseExpanded();
                                      onOpenTaskSession(task.id);
                                    }}
                                    className={`flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap cursor-pointer ${
                                      needsConfirm
                                        ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100/70'
                                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-900 hover:text-white hover:border-slate-900'
                                    }`}
                                  >
                                    <MessageSquareCode className="w-3 h-3 shrink-0" />
                                    <span>{needsConfirm ? '待确认' : '任务会话'}</span>
                                  </button>

                                  {col.status === 'pending' && (
                                    <button
                                      type="button"
                                      disabled={isReadOnly || Boolean(executingTaskId)}
                                      onClick={() => onRunTask(task.id)}
                                      className="inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-[11px] font-semibold bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                                    >
                                      <Play className="w-3 h-3" />
                                      <span>{isExec ? '执行中' : '接力'}</span>
                                    </button>
                                  )}

                                  {col.status === 'in_progress' && onUpdateTaskStatus && (
                                    <button
                                      type="button"
                                      disabled={isReadOnly}
                                      onClick={() => onUpdateTaskStatus(task.id, 'review')}
                                      className="inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-[11px] font-semibold bg-slate-900 hover:bg-slate-800 text-white whitespace-nowrap cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                                    >
                                      <span>交验收</span>
                                    </button>
                                  )}

                                  {col.status === 'review' && (
                                    <button
                                      type="button"
                                      disabled={isReadOnly}
                                      onClick={() => onApproveTask(task.id)}
                                      className="inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                                    >
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>通过</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Completed Tasks Inbox Modal */}
      <ModalShell
        open={showCompletedInbox}
        onClose={() => setShowCompletedInbox(false)}
        icon={<Inbox className="w-4 h-4 text-emerald-600" />}
        title={`已完成卡片 (${completedTasks.length})`}
        subtitle={`${workspace.name} · 已验收归档的任务记录，可随时复盘交付物或退回重验`}
        maxWidthClass="max-w-2xl"
      >
        {completedTasks.length === 0 ? (
          <EmptyStateCard
            title="暂无已完成卡片"
            description="在「待验收」列点击验证通过后，任务卡片会自动收纳至此。"
          />
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl bg-white overflow-hidden">
            {completedTasks.map((task) => (
              <div
                key={task.id}
                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span className="font-mono text-slate-400">{task.id}</span>
                    <span>·</span>
                    <span className="text-emerald-700 font-semibold">已验收</span>
                    <span>·</span>
                    <span className="font-mono tabular-nums">{task.updatedAt}</span>
                  </div>
                  <div className="text-sm font-semibold text-slate-900 truncate">{task.title}</div>
                  {task.deliverableArtifact && (
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-mono text-blue-700 truncate max-w-full">
                      <FileCode2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{task.deliverableArtifact}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCompletedInbox(false);
                      onCloseExpanded();
                      onOpenTaskSession(task.id);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
                  >
                    <MessageSquareCode className="w-3.5 h-3.5" />
                    <span>查看会话</span>
                  </button>
                  {onUpdateTaskStatus && !isReadOnly && (
                    <button
                      type="button"
                      onClick={() => onUpdateTaskStatus(task.id, 'review')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-amber-50 hover:text-amber-800 hover:border-amber-200 text-xs font-medium text-slate-600 cursor-pointer whitespace-nowrap"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>退回验收</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ModalShell>
    </>
  );
}
