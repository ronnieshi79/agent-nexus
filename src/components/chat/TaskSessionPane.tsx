import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  FileCode2,
  FolderKanban,
  Lock,
  PanelRightClose,
  PanelRightOpen,
  Play,
  RotateCcw,
  Send,
  Share2,
  Sparkles,
  Terminal,
  X,
} from 'lucide-react';
import type { CreateWorkCardInput } from '../../hooks/useAgentNexusStore';
import type {
  ActiveWorkflowStage,
  AgentNexusAccount,
  ExpertAgent,
  ProjectAgentAssignment,
  ProjectStageSlot,
  ProjectWorkspace,
  TaskSessionMessage,
  TaskStatus,
  WorkCardType,
  WorkflowTask,
} from '../../types/agentnexus';
import { STAGE_LABEL_MAP, resolveTaskWorkflowTeam } from '../../utils/taskWorkflow';
import {
  AgentIdentityName,
  EntityAvatar,
  formatAgentDisplayName,
} from '../shared/EntityIdentity';
import { WORK_STATUS_META, WorkStatusBadge } from '../workcard/WorkCardFlow';
import { TaskAgentSelector } from './TaskAgentSelector';
import { TaskSessionInspectorRail } from './TaskSessionInspectorRail';
import { TaskWorkflowBar } from './TaskWorkflowBar';

interface TaskSessionPaneProps {
  task: WorkflowTask;
  workspace: ProjectWorkspace;
  workspaces: ProjectWorkspace[];
  agent: ExpertAgent | null;
  agents: ExpertAgent[];
  assignments?: ProjectAgentAssignment[];
  pipelineSlots?: ProjectStageSlot[];
  allTasks: WorkflowTask[];
  siblingTasks: WorkflowTask[];
  messages: TaskSessionMessage[];
  allTaskSessions: Record<string, TaskSessionMessage[]>;
  account: AgentNexusAccount | null;
  isBusy: boolean;
  isExecuting: boolean;
  error: string | null;
  onClearError: () => void;
  onSendTurn: (taskId: string, text: string, targetAgentId?: string) => Promise<void>;
  onRunTask: (taskId: string) => Promise<void>;
  onApproveTask: (taskId: string) => void;
  onUpdateTaskStatus?: (taskId: string, status: TaskStatus) => void;
  onSyncSummaryToGroup: (taskId: string) => void;
  onBackToGroup: (projectId: string) => void;
  onSelectTaskSession: (taskId: string) => void;
  onCreateAndOpenTaskSession: (input: CreateWorkCardInput) => void;
  onReactivateProject?: (projectId: string) => void;
}

const WORK_TYPE_LABELS: Record<WorkCardType, string> = {
  planning: '产品策划',
  development: '功能开发',
  testing: '功能测试',
  review: '架构评审',
};

export function TaskSessionPane({
  task,
  workspace,
  agent,
  agents,
  assignments = [],
  pipelineSlots = [],
  messages,
  account,
  isBusy,
  isExecuting,
  error,
  onClearError,
  onSendTurn,
  onRunTask,
  onApproveTask,
  onUpdateTaskStatus,
  onSyncSummaryToGroup,
  onBackToGroup,
  onReactivateProject,
}: TaskSessionPaneProps) {
  const isReadOnly =
    workspace.lifecycleStatus === 'completed' || workspace.lifecycleStatus === 'archived';
  const [draft, setDraft] = useState('');
  const [panelOpen, setPanelOpen] = useState(true);
  const [collapsedSteps, setCollapsedSteps] = useState<Record<string, boolean>>({});
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [selectedTargetAgentId, setSelectedTargetAgentId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const agentMap = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);

  // Multi-agent workflow resolution: 计划 -> 执行 -> 验收
  const workflow = useMemo(
    () => resolveTaskWorkflowTeam(task, workspace, agents, assignments, pipelineSlots),
    [task, workspace, agents, assignments, pipelineSlots],
  );

  // Reset explicit specialist override when switching tasks or advancing workflow stages
  useEffect(() => {
    setSelectedTargetAgentId(null);
  }, [task.id, task.status]);

  const activeStageAgent = workflow.activeAgent || agent;
  const effectiveTargetAgent =
    (selectedTargetAgentId ? agentMap.get(selectedTargetAgentId) || null : null) ||
    activeStageAgent;

  const extraWorkspaceAgents = useMemo(() => {
    const participantIds = new Set(workflow.participants.map((p) => p.id));
    return workspace.hiredAgentIds
      .filter((id) => !participantIds.has(id))
      .map((id) => agentMap.get(id))
      .filter((a): a is ExpertAgent => Boolean(a));
  }, [agentMap, workflow.participants, workspace.hiredAgentIds]);

  const st = WORK_STATUS_META[task.status];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, isBusy, task.id]);

  const handleSelectTargetAgent = (targetId: string | null) => {
    if (!targetId || targetId === activeStageAgent?.id) {
      setSelectedTargetAgentId(null);
    } else {
      setSelectedTargetAgentId(targetId);
    }
    inputRef.current?.focus();
  };

  const handleAdvanceStage = (nextStatus: TaskStatus) => {
    if (isReadOnly) return;
    if (nextStatus === 'done') {
      onApproveTask(task.id);
      return;
    }
    if (onUpdateTaskStatus) {
      onUpdateTaskStatus(task.id, nextStatus);
    }
  };

  const submitTurn = async (textOverride?: string) => {
    const cleaned = (textOverride ?? draft).trim();
    if (!cleaned || isBusy || isReadOnly) return;
    if (!textOverride) setDraft('');
    await onSendTurn(task.id, cleaned, selectedTargetAgentId || undefined);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await submitTurn();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submitTurn();
    }
  };

  const handleCopySnippet = (msgId: string, snippet: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(snippet);
      setCopiedMsgId(msgId);
      setTimeout(() => setCopiedMsgId((prev) => (prev === msgId ? null : prev)), 1500);
    }
  };

  const quickDirectives = useMemo(() => {
    if (task.status === 'done') {
      return ['复盘本次多阶段交付的关键边界与潜在风险', '二期扩展建议预留哪些核心接口？'];
    }
    const stagePrompts: Record<ActiveWorkflowStage, string[]> = {
      planning: [
        '补充关键异常场景与验收边界',
        '当前方案已确认，请收尾并交棒研发执行',
      ],
      development: [
        '输出当前实现的核心边界测试用例',
        '检查并发异常与降级兜底逻辑',
        '核心实现已确认，请收尾定稿并提交验收',
      ],
      testing: [
        '列出高风险边界用例与压测回归项',
        '复核安全审计与幂等边界是否达标',
        '验收通过，请归档交付产物并同步项目群',
      ],
    };
    return stagePrompts[workflow.currentStage];
  }, [task.status, workflow.currentStage]);

  return (
    <div className="h-full flex min-h-0 bg-white relative">
      {/* Main Codex / Claude Code-Style Multi-Agent Workflow Task Session Column */}
      <div className="flex-1 min-w-0 flex flex-col h-full">
        {/* Session Header: Anchored Task + Participating Specialists Stack + Source Project */}
        <div className="h-[60px] px-4 sm:px-6 border-b border-slate-200/80 bg-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <EntityAvatar
              kind="agent"
              code={activeStageAgent?.avatarCode || 'AI'}
              accent={activeStageAgent?.avatarAccent || '#0f172a'}
              sessionCorner
            />

            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-sm font-bold text-slate-900 truncate">{task.title}</h2>
                <span className={`text-xs font-semibold whitespace-nowrap shrink-0 ${st.textCls}`}>
                  · {isExecuting ? '执行中' : st.label}
                </span>
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5 truncate">
                <span className="inline-flex items-center gap-1 shrink-0">
                  <span className="flex -space-x-1">
                    {workflow.participants.map((p) => (
                      <span
                        key={p.id}
                        title={p.handle}
                        className="w-3.5 h-3.5 rounded-full ring-1 ring-white text-[8px] font-bold text-white inline-flex items-center justify-center"
                        style={{ backgroundColor: p.avatarAccent }}
                      >
                        {p.avatarCode.slice(0, 1)}
                      </span>
                    ))}
                  </span>
                  <span className="font-medium text-slate-700">
                    {workflow.participants.length} 位专家接力
                  </span>
                </span>
                <span aria-hidden="true" className="text-slate-300 shrink-0">
                  ·
                </span>
                <span className="font-mono text-slate-500 shrink-0">#{task.id}</span>
                <span aria-hidden="true" className="text-slate-300 shrink-0">
                  ·
                </span>
                <button
                  type="button"
                  onClick={() => onBackToGroup(workspace.id)}
                  title={`切回「${workspace.name}」项目群消息模式`}
                  className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 hover:underline underline-offset-2 truncate cursor-pointer"
                >
                  <FolderKanban className="w-3 h-3 shrink-0" />
                  <span className="truncate">{workspace.name}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setPanelOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {panelOpen ? (
                <PanelRightClose className="w-3.5 h-3.5 text-slate-500" />
              ) : (
                <PanelRightOpen className="w-3.5 h-3.5 text-blue-600" />
              )}
              <span className="hidden xl:inline">交付物与专家</span>
            </button>
          </div>
        </div>

        {/* Anchored 3-Stage Multi-Agent Workflow Bar: 计划 -> 执行 -> 验收 */}
        <TaskWorkflowBar
          status={task.status}
          stageAgents={workflow.stageAgents}
          selectedTargetAgentId={selectedTargetAgentId}
          isExecuting={isExecuting}
          isReadOnly={isReadOnly}
          onSelectTargetAgent={(id) => handleSelectTargetAgent(id)}
          onAdvanceStage={handleAdvanceStage}
        />

        {/* Multi-Agent Workflow Execution Stream */}
        <div className="flex-1 overflow-y-auto clean-scroll px-4 sm:px-8 py-6 bg-white">
          <div className="max-w-3xl mx-auto space-y-5">
            {/* Anchored Task Scope Contract (Flush Hairline Style) */}
            <div className="pb-4 border-b border-slate-200/80 space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                <div className="flex items-center gap-1.5 text-slate-600 min-w-0">
                  <Terminal className="w-3.5 h-3.5 text-slate-900 shrink-0" />
                  <span className="font-semibold text-slate-900">多 Agent 协同任务 Session</span>
                  <span className="text-slate-300" aria-hidden="true">
                    ·
                  </span>
                  <span className="truncate">{task.featureModule}</span>
                  <span className="text-slate-300" aria-hidden="true">
                    ·
                  </span>
                  <span>{WORK_TYPE_LABELS[task.workType]}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <WorkStatusBadge status={task.status} executing={isExecuting} />
                  <span className="font-mono tabular-nums text-[11px] text-slate-400">
                    {messages.length} 条记录
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">{task.description}</p>
            </div>

            {/* Multi-Agent Turn-by-Turn Thread with Stage Handoff Dividers */}
            {messages.map((msg, idx) => {
              const isLast = idx === messages.length - 1;

              if (msg.sender === 'system') {
                if (msg.handoff) {
                  return (
                    <div key={msg.id} className="flex items-center gap-3 py-1">
                      <div className="h-px flex-1 bg-slate-200/80" />
                      <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 whitespace-nowrap">
                        <span className="font-semibold text-slate-700">
                          {STAGE_LABEL_MAP[msg.handoff.fromStage]}
                        </span>
                        <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="font-semibold text-blue-700">
                          {STAGE_LABEL_MAP[msg.handoff.toStage]}
                        </span>
                        <span className="text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        <span>{msg.content}</span>
                        <span className="font-mono tabular-nums text-slate-400">
                          {msg.timestamp}
                        </span>
                      </div>
                      <div className="h-px flex-1 bg-slate-200/80" />
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className="flex items-center gap-3 py-1">
                    <div className="h-px flex-1 bg-slate-100" />
                    <div className="text-[11px] text-slate-500 inline-flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{msg.content}</span>
                      <span className="font-mono tabular-nums text-slate-400">
                        · {msg.timestamp}
                      </span>
                    </div>
                    <div className="h-px flex-1 bg-slate-100" />
                  </div>
                );
              }

              const isEmployer = msg.sender === 'employer';
              const turnAgent = !isEmployer
                ? (msg.agentId ? agentMap.get(msg.agentId) || null : null) ||
                  activeStageAgent ||
                  agent
                : null;
              const turnStageLabel = msg.workflowStage
                ? STAGE_LABEL_MAP[msg.workflowStage]
                : null;
              const hasSteps = Boolean(
                !isEmployer && msg.executionSteps && msg.executionSteps.length > 0,
              );
              const isStepsExpanded =
                collapsedSteps[msg.id] !== undefined ? !collapsedSteps[msg.id] : isLast;

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isEmployer ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div className="mt-0.5">
                    {isEmployer ? (
                      <EntityAvatar
                        kind="human"
                        code={account?.avatarInitials || '我'}
                        accent="#0f172a"
                      />
                    ) : (
                      <EntityAvatar
                        kind="agent"
                        code={turnAgent?.avatarCode || 'AI'}
                        accent={turnAgent?.avatarAccent || '#334155'}
                        showCornerMark={false}
                      />
                    )}
                  </div>

                  <div
                    className={`min-w-0 max-w-[90%] flex flex-col ${
                      isEmployer ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs mb-1 flex-wrap">
                      {isEmployer ? (
                        <span className="font-semibold text-slate-900">
                          {account?.name || '我（指令）'}
                        </span>
                      ) : (
                        <>
                          <AgentIdentityName
                            name={turnAgent?.handle || msg.agentHandle || task.assigneeHandle}
                            runtime={turnAgent?.runtimeAgent}
                            model={turnAgent?.defaultModel}
                            showModel
                            className="font-semibold text-slate-900"
                          />
                          {turnStageLabel && (
                            <span className="text-[11px] font-medium text-slate-500">
                              · {turnStageLabel}阶段
                            </span>
                          )}
                        </>
                      )}
                      <span className="text-slate-400 font-mono tabular-nums">{msg.timestamp}</span>
                      {msg.milestoneSynced && (
                        <span className="text-[11px] font-medium text-emerald-700">
                          · 结果已同步项目群
                        </span>
                      )}
                    </div>

                    <div
                      className={`text-sm leading-relaxed space-y-3 ${
                        isEmployer
                          ? 'rounded-xl px-3.5 py-2.5 bg-slate-100/90 text-slate-900'
                          : 'w-full pt-0.5 text-slate-800'
                      }`}
                    >
                      {/* Collapsible Codex/Antigravity Execution Trace */}
                      {hasSteps && msg.executionSteps && (
                        <div className="space-y-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setCollapsedSteps((prev) => ({
                                ...prev,
                                [msg.id]: isStepsExpanded,
                              }))
                            }
                            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                          >
                            {isStepsExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                            )}
                            <Terminal className="w-3 h-3 text-slate-400" />
                            <span>
                              沙箱执行轨迹 · 已完成 {msg.executionSteps.length} 步操作
                            </span>
                            <span className="text-[10px] text-slate-400 ml-1">
                              {isStepsExpanded ? '收起' : '展开'}
                            </span>
                          </button>

                          {isStepsExpanded && (
                            <ul className="pl-3 ml-1.5 border-l border-slate-200/90 space-y-1 py-0.5">
                              {msg.executionSteps.map((step, stepIdx) => (
                                <li
                                  key={stepIdx}
                                  className="flex items-start gap-2 text-xs text-slate-500"
                                >
                                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                  <span>{step}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}

                      <p className="whitespace-pre-wrap">{msg.content}</p>

                      {/* Artifact Code / Spec Diff Block */}
                      {!isEmployer && (msg.artifactPath || msg.artifactSnippet) && (
                        <div className="rounded-lg bg-slate-950 text-slate-100 overflow-hidden">
                          <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2 text-[11px] font-mono text-sky-300">
                            <span className="inline-flex items-center gap-1.5 truncate">
                              <FileCode2 className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{msg.artifactPath || '产物变更片段'}</span>
                            </span>
                            {msg.artifactSnippet && (
                              <button
                                type="button"
                                onClick={() => handleCopySnippet(msg.id, msg.artifactSnippet!)}
                                className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-white cursor-pointer shrink-0"
                              >
                                {copiedMsgId === msg.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span>已复制</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>复制</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                          {msg.artifactSnippet && (
                            <pre className="p-3 text-xs font-mono leading-relaxed overflow-x-auto text-slate-200">
                              <code>{msg.artifactSnippet}</code>
                            </pre>
                          )}
                        </div>
                      )}

                      {/* Interactive Confirmation Choices on Latest Agent Turn */}
                      {!isEmployer &&
                        isLast &&
                        msg.suggestedActions &&
                        msg.suggestedActions.length > 0 &&
                        task.status !== 'done' && (
                          <div className="pt-2.5 border-t border-slate-100 space-y-1.5">
                            <div className="text-[11px] font-semibold text-blue-700">
                              {msg.awaitingConfirmation
                                ? '当前阶段专家等待确认（点击直接回复）'
                                : '快捷后续操作'}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {msg.suggestedActions.map((action, aIdx) => (
                                <button
                                  key={aIdx}
                                  type="button"
                                  disabled={isBusy || isReadOnly}
                                  onClick={() => void submitTurn(action)}
                                  className="text-left px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-xs font-medium text-blue-900 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                                >
                                  {action}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              );
            })}

            {isBusy && (
              <div className="text-xs text-slate-500 pl-11">
                {formatAgentDisplayName(
                  effectiveTargetAgent?.handle || task.assigneeHandle,
                  effectiveTargetAgent?.runtimeAgent,
                  effectiveTargetAgent?.defaultModel,
                )}{' '}
                正在独立沙箱中执行本轮指令...
              </div>
            )}

            {error && (
              <div className="px-3.5 py-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between gap-2">
                <span>{error}</span>
                <button
                  type="button"
                  onClick={onClearError}
                  className="text-red-500 hover:text-red-800 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Bottom Claude Code / Codex-Style Composer: Inline Specialist Selector (No @ Mentions) */}
        <div className="shrink-0 border-t border-slate-200/80 bg-white px-4 sm:px-8 py-3">
          <div className="max-w-3xl mx-auto space-y-2">
            {isReadOnly && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900">
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>
                    所属项目已{workspace.lifecycleStatus === 'completed' ? '结项完成' : '归档'}，任务会话进入只读归档状态。
                  </span>
                </span>
                {onReactivateProject && (
                  <button
                    type="button"
                    onClick={() => onReactivateProject(workspace.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-semibold cursor-pointer whitespace-nowrap"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>重新激活项目</span>
                  </button>
                )}
              </div>
            )}

            {/* Stage-Aware Quick Directives */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {quickDirectives.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={isBusy || isReadOnly}
                  onClick={() => {
                    setDraft(q);
                    inputRef.current?.focus();
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100/80 hover:bg-slate-200/70 text-[11px] font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-3 h-3 text-slate-400" />
                  <span>{q}</span>
                </button>
              ))}
            </div>

            {/* Unified Codex / Claude Code Composer Box */}
            <form
              onSubmit={handleSubmit}
              className={`rounded-xl border border-slate-300 bg-slate-50/50 transition-all ${
                isReadOnly
                  ? 'opacity-65'
                  : 'focus-within:bg-white focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/10'
              }`}
            >
              <textarea
                ref={inputRef}
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isBusy || isReadOnly}
                placeholder={
                  isReadOnly
                    ? '所属项目已结项/归档，当前仅支持只读查阅。重新激活项目后可继续指令协作。'
                    : `向 ${formatAgentDisplayName(
                        effectiveTargetAgent?.handle || task.assigneeHandle,
                        effectiveTargetAgent?.runtimeAgent,
                        effectiveTargetAgent?.defaultModel,
                      )} 下达本任务指令、确认边界或要求修正...（Enter 发送）`
                }
                className="w-full bg-transparent px-3.5 pt-3 pb-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none resize-none leading-relaxed disabled:cursor-not-allowed"
              />

              {/* Composer Footer Bar: Left = Inline Agent Specialist Selector; Right = Utility + Send */}
              <div className="px-2.5 pb-2.5 pt-1 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 min-w-0">
                  <TaskAgentSelector
                    stageAgents={workflow.stageAgents}
                    currentStage={workflow.currentStage}
                    extraWorkspaceAgents={extraWorkspaceAgents}
                    activeStageAgent={activeStageAgent}
                    selectedTargetAgentId={selectedTargetAgentId}
                    disabled={isReadOnly}
                    onSelectAgent={handleSelectTargetAgent}
                  />
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {task.status === 'pending' && (
                    <button
                      type="button"
                      disabled={isExecuting || isBusy || isReadOnly}
                      onClick={() => void onRunTask(task.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      <Play className="w-3 h-3" />
                      <span>{isExecuting ? '执行中...' : '自主执行'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isReadOnly}
                    onClick={() => onSyncSummaryToGroup(task.id)}
                    title={
                      isReadOnly
                        ? '项目已只读锁定'
                        : '将本阶段执行结果同步至所属项目群'
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs font-medium cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    <Share2 className="w-3.5 h-3.5 text-slate-400" />
                    <span className="hidden sm:inline">同步结果到群</span>
                  </button>

                  <button
                    type="submit"
                    disabled={isBusy || isReadOnly || !draft.trim()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isBusy ? '执行中...' : '发送指令'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Right Rail: Artifacts / Deliverables + Participating Specialist Agents */}
      {panelOpen && (
        <TaskSessionInspectorRail
          task={task}
          workspace={workspace}
          stageAgents={workflow.stageAgents}
          currentStage={workflow.currentStage}
          participants={workflow.participants}
          messages={messages}
          agentMap={agentMap}
          effectiveTargetAgentId={effectiveTargetAgent?.id || null}
          isExecuting={isExecuting}
          isReadOnly={isReadOnly}
          onSelectTargetAgent={handleSelectTargetAgent}
          onBackToGroup={onBackToGroup}
        />
      )}
    </div>
  );
}
