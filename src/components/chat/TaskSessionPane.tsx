import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  FileCode2,
  FolderKanban,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Plus,
  Send,
  Share2,
  Sparkles,
  Terminal,
  X,
} from 'lucide-react';
import type { CreateWorkCardInput } from '../../hooks/useAgentNexusStore';
import type {
  AgentNexusAccount,
  ExpertAgent,
  ProjectWorkspace,
  TaskSessionMessage,
  WorkCardType,
  WorkflowTask,
} from '../../types/agentnexus';
import {
  AgentIdentityName,
  EntityAvatar,
  displayEntityName,
  formatShortModel,
} from '../shared/EntityIdentity';
import { WORK_STATUS_META, WorkStatusBadge } from '../workcard/WorkCardFlow';

interface TaskSessionPaneProps {
  task: WorkflowTask;
  workspace: ProjectWorkspace;
  workspaces: ProjectWorkspace[];
  agent: ExpertAgent | null;
  agents: ExpertAgent[];
  allTasks: WorkflowTask[];
  siblingTasks: WorkflowTask[];
  messages: TaskSessionMessage[];
  allTaskSessions: Record<string, TaskSessionMessage[]>;
  account: AgentNexusAccount | null;
  isBusy: boolean;
  isExecuting: boolean;
  error: string | null;
  onClearError: () => void;
  onSendTurn: (taskId: string, text: string) => Promise<void>;
  onRunTask: (taskId: string) => Promise<void>;
  onApproveTask: (taskId: string) => void;
  onSyncSummaryToGroup: (taskId: string) => void;
  onBackToGroup: (projectId: string) => void;
  onSelectTaskSession: (taskId: string) => void;
  onCreateAndOpenTaskSession: (input: CreateWorkCardInput) => void;
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
  workspaces,
  agent,
  agents,
  allTasks,
  siblingTasks,
  messages,
  allTaskSessions,
  account,
  isBusy,
  isExecuting,
  error,
  onClearError,
  onSendTurn,
  onRunTask,
  onApproveTask,
  onSyncSummaryToGroup,
  onBackToGroup,
  onSelectTaskSession,
  onCreateAndOpenTaskSession,
}: TaskSessionPaneProps) {
  const [draft, setDraft] = useState('');
  const [panelOpen, setPanelOpen] = useState(true);
  const [railTab, setRailTab] = useState<'agent_tasks' | 'project_tasks'>('agent_tasks');
  const [collapsedSteps, setCollapsedSteps] = useState<Record<string, boolean>>({});
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  // Quick inline spawn new Task Session for this locked Agent
  const [showNewSession, setShowNewSession] = useState(false);
  const [newTaskProjectId, setNewTaskProjectId] = useState(workspace.id);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskType, setNewTaskType] = useState<WorkCardType>('development');

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const st = WORK_STATUS_META[task.status];
  const lastMsg = messages[messages.length - 1];
  const isWaitingReply = Boolean(lastMsg?.awaitingConfirmation && task.status !== 'done');

  const workspaceMap = useMemo(() => new Map(workspaces.map((w) => [w.id, w])), [workspaces]);

  // All task sessions aggregated across different projects for THIS specific Agent
  const agentAggregatedTasks = useMemo(() => {
    const statusWeight: Record<WorkflowTask['status'], number> = {
      in_progress: 0,
      review: 1,
      pending: 2,
      done: 3,
    };
    return allTasks
      .filter((t) => t.assigneeId === task.assigneeId)
      .sort((a, b) => statusWeight[a.status] - statusWeight[b.status]);
  }, [allTasks, task.assigneeId]);

  const distinctAgentProjectCount = useMemo(
    () => new Set(agentAggregatedTasks.map((t) => t.sessionId)).size,
    [agentAggregatedTasks],
  );

  useEffect(() => {
    setNewTaskProjectId(workspace.id);
  }, [workspace.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, isBusy, task.id]);

  const submitTurn = async (textOverride?: string) => {
    const cleaned = (textOverride ?? draft).trim();
    if (!cleaned || isBusy) return;
    if (!textOverride) setDraft('');
    await onSendTurn(task.id, cleaned);
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

  const handleCreateAgentTask = (e: FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    onCreateAndOpenTaskSession({
      sessionId: newTaskProjectId || workspace.id,
      featureModule: '专项任务',
      workType: newTaskType,
      title: newTaskTitle.trim(),
      description: `在 ${agent?.handle || task.assigneeHandle} 任务模式中直接发起的专项任务 Session。`,
      assigneeId: task.assigneeId,
      priority: '高',
    });
    setNewTaskTitle('');
    setShowNewSession(false);
  };

  const quickDirectives =
    task.status === 'done'
      ? ['帮我复盘本次交付的关键边界与潜在风险', '如果要做二期扩展，预留哪些接口最合适？']
      : [
          '输出当前实现的核心边界测试用例',
          '检查并发异常与降级兜底逻辑',
          '当前方案已确认，请收尾定稿并提交验证',
        ];

  return (
    <div className="h-full flex min-h-0 bg-white relative">
      {/* Main Codex / Antigravity-Style Single-Agent Task Session Column */}
      <div className="flex-1 min-w-0 flex flex-col h-full">
        {/* Session Header: Locked Agent + Source Project + Dual Mode Switcher */}
        <div className="h-[60px] px-4 sm:px-6 border-b border-slate-200 bg-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <EntityAvatar
              kind="agent"
              code={agent?.avatarCode || 'AI'}
              accent={agent?.avatarAccent || '#0f172a'}
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
                <AgentIdentityName
                  name={agent?.handle || task.assigneeHandle}
                  runtime={agent?.runtimeAgent}
                  model={agent?.defaultModel}
                  showModel
                  className="font-semibold text-slate-800"
                />
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
              <span className="hidden xl:inline">Session 导航</span>
            </button>
          </div>
        </div>

        {/* Codex / Antigravity Execution Stream */}
        <div className="flex-1 overflow-y-auto clean-scroll px-4 sm:px-8 py-5 bg-slate-50/50">
          <div className="max-w-3xl mx-auto space-y-5">
            {/* Anchored Single-Agent Session Contract Header */}
            <div className="rounded-xl bg-white border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                <div className="flex items-center gap-1.5 text-slate-600 min-w-0">
                  <Terminal className="w-3.5 h-3.5 text-slate-900 shrink-0" />
                  <span className="font-semibold text-slate-900">单 Agent 任务 Session</span>
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
                    {messages.length} 轮对话
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">{task.description}</p>

              <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap text-[11px] text-slate-500">
                <div className="flex items-center gap-2 flex-wrap">
                  <span>
                    锁定专家：
                    <strong className="text-slate-800 font-semibold">
                      {displayEntityName(agent?.handle || task.assigneeHandle)}
                    </strong>
                  </span>
                  {agent?.runtimeAgent && (
                    <>
                      <span className="text-slate-300" aria-hidden="true">
                        ·
                      </span>
                      <span className="font-mono text-slate-700">
                        {agent.runtimeAgent} / {formatShortModel(agent.defaultModel)}
                      </span>
                    </>
                  )}
                  {agent?.mcpTools && agent.mcpTools.length > 0 && (
                    <>
                      <span className="text-slate-300" aria-hidden="true">
                        ·
                      </span>
                      <span className="font-mono text-slate-500">
                        MCP: {agent.mcpTools.slice(0, 3).join(', ')}
                      </span>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onBackToGroup(workspace.id)}
                  className="text-blue-700 hover:text-blue-900 font-medium cursor-pointer whitespace-nowrap"
                >
                  来源项目：{workspace.name} →
                </button>
              </div>
            </div>

            {/* Turn-by-Turn Thread */}
            {messages.map((msg, idx) => {
              const isLast = idx === messages.length - 1;
              if (msg.sender === 'system') {
                return (
                  <div key={msg.id} className="flex justify-center">
                    <div className="text-xs text-slate-500 bg-slate-100 px-3.5 py-1.5 rounded-lg inline-flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{msg.content}</span>
                      <span className="font-mono tabular-nums text-slate-400">
                        · {msg.timestamp}
                      </span>
                    </div>
                  </div>
                );
              }

              const isEmployer = msg.sender === 'employer';
              const hasSteps = Boolean(!isEmployer && msg.executionSteps && msg.executionSteps.length > 0);
              // Expand steps by default for the latest turn, compact toggle for earlier turns
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
                        code={agent?.avatarCode || 'AI'}
                        accent={agent?.avatarAccent || '#334155'}
                        showCornerMark={false}
                      />
                    )}
                  </div>

                  <div
                    className={`min-w-0 max-w-[90%] flex flex-col ${
                      isEmployer ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs mb-1">
                      {isEmployer ? (
                        <span className="font-semibold text-slate-900">
                          {account?.name || '我（指令）'}
                        </span>
                      ) : (
                        <AgentIdentityName
                          name={agent?.handle || task.assigneeHandle}
                          runtime={agent?.runtimeAgent}
                          model={agent?.defaultModel}
                          className="font-semibold text-slate-900"
                        />
                      )}
                      <span className="text-slate-400 font-mono tabular-nums">{msg.timestamp}</span>
                      {msg.milestoneSynced && (
                        <span className="text-[11px] font-medium text-emerald-700">
                          · 已同步任务卡至项目群
                        </span>
                      )}
                    </div>

                    <div
                      className={`rounded-xl px-4 py-3 text-sm leading-relaxed space-y-3 ${
                        isEmployer
                          ? 'bg-slate-900 text-white'
                          : 'bg-white text-slate-800 border border-slate-200 w-full'
                      }`}
                    >
                      {/* Collapsible Codex/Claude Code Execution Steps BEFORE conclusion */}
                      {hasSteps && msg.executionSteps && (
                        <div className="rounded-lg bg-slate-50 border border-slate-200/80 overflow-hidden">
                          <button
                            type="button"
                            onClick={() =>
                              setCollapsedSteps((prev) => ({
                                ...prev,
                                [msg.id]: isStepsExpanded,
                              }))
                            }
                            className="w-full px-3 py-1.5 flex items-center justify-between gap-2 text-[11px] font-medium text-slate-600 hover:bg-slate-100/80 transition-colors cursor-pointer"
                          >
                            <span className="inline-flex items-center gap-1.5">
                              {isStepsExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                              )}
                              <Terminal className="w-3 h-3 text-slate-500" />
                              <span>
                                沙箱执行轨迹 · 已完成 {msg.executionSteps.length} 步操作
                              </span>
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {isStepsExpanded ? '收起' : '展开'}
                            </span>
                          </button>

                          {isStepsExpanded && (
                            <ul className="px-3 py-2 border-t border-slate-200/70 space-y-1.5 bg-white/70">
                              {msg.executionSteps.map((step, stepIdx) => (
                                <li
                                  key={stepIdx}
                                  className="flex items-start gap-2 text-xs text-slate-600"
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
                                ? 'Agent 等待你的决策确认（点击直接发送回复）'
                                : '快捷后续操作'}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {msg.suggestedActions.map((action, aIdx) => (
                                <button
                                  key={aIdx}
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void submitTurn(action)}
                                  className="text-left px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-xs font-medium text-blue-900 transition-colors cursor-pointer disabled:opacity-45"
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
                {displayEntityName(agent?.handle || task.assigneeHandle)} 正在独立沙箱中执行本轮指令...
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

        {/* Bottom Single-Agent Task Composer */}
        <div className="shrink-0 border-t border-slate-200 bg-white px-4 sm:px-8 py-3">
          <div className="max-w-3xl mx-auto space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {quickDirectives.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={isBusy}
                    onClick={() => {
                      setDraft(q);
                      inputRef.current?.focus();
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200/70 text-[11px] font-medium text-slate-700 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45"
                  >
                    <Sparkles className="w-3 h-3 text-slate-400" />
                    <span>{q}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {task.status === 'pending' && (
                  <button
                    type="button"
                    disabled={isExecuting || isBusy}
                    onClick={() => void onRunTask(task.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-[11px] font-semibold text-white cursor-pointer disabled:opacity-45 whitespace-nowrap"
                  >
                    <Play className="w-3 h-3" />
                    <span>{isExecuting ? '执行中...' : '一键自主执行'}</span>
                  </button>
                )}

                {task.status === 'review' && (
                  <button
                    type="button"
                    onClick={() => onApproveTask(task.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-[11px] font-semibold text-white cursor-pointer whitespace-nowrap"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>验证通过并回写群聊</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onSyncSummaryToGroup(task.id)}
                  title="将当前任务 Session 阶段结论以任务卡片形式同步到所属项目群"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-medium text-slate-700 cursor-pointer whitespace-nowrap"
                >
                  <Share2 className="w-3 h-3 text-slate-500" />
                  <span>同步结论到项目群</span>
                </button>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="rounded-xl border border-slate-300 bg-slate-50/60 focus-within:bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-600/15 transition-all flex items-end gap-2 p-2"
            >
              <textarea
                ref={inputRef}
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isBusy}
                placeholder={`向 ${displayEntityName(agent?.handle || task.assigneeHandle)}${agent?.runtimeAgent ? ` (${agent.runtimeAgent})` : ''} 发送本任务指令、确认边界或要求修正...`}
                className="flex-1 min-w-0 bg-transparent px-2 py-1 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none resize-none leading-relaxed"
              />
              <button
                type="submit"
                disabled={isBusy || !draft.trim()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isBusy ? '执行中...' : '发送指令'}</span>
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Right Dual-Dimension Navigation Rail: Aggregated by Agent (Cross-Project) vs. Same Project */}
      {panelOpen && (
        <aside className="fixed inset-y-0 right-0 z-30 lg:static lg:z-auto w-[336px] max-w-[88vw] shrink-0 border-l border-slate-200 bg-slate-50/70 flex flex-col h-full shadow-2xl lg:shadow-none">
          {/* Dual-Dimension Tab Switcher */}
          <div className="p-3 border-b border-slate-200 bg-white shrink-0 space-y-2.5">
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setRailTab('agent_tasks')}
                className={`py-1.5 px-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  railTab === 'agent_tasks'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                该 Agent 任务 ({agentAggregatedTasks.length})
              </button>
              <button
                type="button"
                onClick={() => setRailTab('project_tasks')}
                className={`py-1.5 px-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  railTab === 'project_tasks'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                本项目任务 ({siblingTasks.length})
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto clean-scroll p-3.5 space-y-4">
            {/* Compact Deliverable & Status Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-900">当前任务产物</span>
                <WorkStatusBadge status={task.status} executing={isExecuting} />
              </div>
              {task.deliverableArtifact ? (
                <div className="flex items-center gap-1.5 text-xs font-mono text-blue-700 truncate">
                  <FileCode2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{task.deliverableArtifact}</span>
                </div>
              ) : (
                <div className="text-xs text-slate-400">尚未产出归档文件，执行后自动更新</div>
              )}
              {task.deliverableSummary && (
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {task.deliverableSummary}
                </p>
              )}
              {isWaitingReply && (
                <div className="text-[11px] font-semibold text-blue-700">
                  状态：专家正在等待你的本轮确认回复
                </div>
              )}
            </div>

            {railTab === 'agent_tasks' ? (
              /* Dimension 1: All cross-project sessions aggregated on THIS specific Agent */
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 px-0.5">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {displayEntityName(agent?.handle || task.assigneeHandle)} 跨项目汇聚
                    </div>
                    <div className="text-[11px] text-slate-500">
                      共 {distinctAgentProjectCount} 个项目 · {agentAggregatedTasks.length} 个任务 Session
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowNewSession((v) => !v)}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
                      showNewSession
                        ? 'bg-slate-900 text-white'
                        : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <Plus className="w-3 h-3" />
                    <span>新任务</span>
                  </button>
                </div>

                {/* Inline New Task Session Form for this Agent */}
                {showNewSession && (
                  <form
                    onSubmit={handleCreateAgentTask}
                    className="bg-white rounded-xl border border-slate-300 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-800">
                        向 {displayEntityName(agent?.handle || task.assigneeHandle)} 新派任务 Session
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowNewSession(false)}
                        className="text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <select
                      value={newTaskProjectId}
                      onChange={(e) => setNewTaskProjectId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:bg-white"
                    >
                      {workspaces.map((w) => (
                        <option key={w.id} value={w.id}>
                          来源项目：{w.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={newTaskType}
                      onChange={(e) => setNewTaskType(e.target.value as WorkCardType)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:bg-white"
                    >
                      <option value="development">类型：功能开发</option>
                      <option value="planning">类型：产品策划</option>
                      <option value="testing">类型：功能测试</option>
                      <option value="review">类型：架构评审</option>
                    </select>
                    <input
                      type="text"
                      required
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="输入任务标题，立即开启 Session..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-600/20"
                    />
                    <button
                      type="submit"
                      className="w-full py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
                    >
                      创建并进入任务对话
                    </button>
                  </form>
                )}

                <div className="space-y-1.5">
                  {agentAggregatedTasks.map((t) => {
                    const active = t.id === task.id;
                    const tWs = workspaceMap.get(t.sessionId);
                    const tSt = WORK_STATUS_META[t.status];
                    const tMsgs = allTaskSessions[t.id] || [];
                    const tWait = Boolean(
                      t.status !== 'done' && tMsgs[tMsgs.length - 1]?.awaitingConfirmation,
                    );
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onSelectTaskSession(t.id)}
                        className={`w-full text-left p-2.5 rounded-lg border transition-colors cursor-pointer space-y-1 ${
                          active
                            ? 'bg-slate-900 border-slate-900 text-white'
                            : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span
                            className={`inline-flex items-center gap-1 truncate ${
                              active ? 'text-slate-300' : 'text-slate-500'
                            }`}
                          >
                            <FolderKanban className="w-3 h-3 shrink-0" />
                            <span className="truncate">{tWs?.name || '项目'}</span>
                          </span>
                          <span
                            className={`font-semibold shrink-0 whitespace-nowrap ${
                              active
                                ? 'text-sky-300'
                                : tWait
                                  ? 'text-blue-700'
                                  : tSt.textCls
                            }`}
                          >
                            {tWait ? '待确认' : tSt.label}
                          </span>
                        </div>
                        <div className="text-xs font-semibold truncate">{t.title}</div>
                        <div
                          className={`text-[10px] font-mono tabular-nums flex items-center justify-between ${
                            active ? 'text-slate-400' : 'text-slate-400'
                          }`}
                        >
                          <span>#{t.id} · {WORK_TYPE_LABELS[t.workType]}</span>
                          <span>{tMsgs.length} 轮</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Dimension 2: Sibling Task Cards within the Same Source Project */
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-0.5 text-xs">
                  <span className="font-bold text-slate-900 truncate">{workspace.name}</span>
                  <button
                    type="button"
                    onClick={() => onBackToGroup(workspace.id)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span>回项目群</span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  {siblingTasks.map((t) => {
                    const active = t.id === task.id;
                    const tSt = WORK_STATUS_META[t.status];
                    const tMsgs = allTaskSessions[t.id] || [];
                    const tWait = Boolean(
                      t.status !== 'done' && tMsgs[tMsgs.length - 1]?.awaitingConfirmation,
                    );
                    const siblingAgent = agents.find((a) => a.id === t.assigneeId);

                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onSelectTaskSession(t.id)}
                        className={`w-full text-left p-2.5 rounded-lg border transition-colors cursor-pointer space-y-1 ${
                          active
                            ? 'bg-slate-900 border-slate-900 text-white'
                            : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <AgentIdentityName
                            name={t.assigneeHandle}
                            runtime={siblingAgent?.runtimeAgent}
                            model={siblingAgent?.defaultModel}
                            inverted={active}
                            className={
                              active ? 'text-slate-200 font-medium' : 'text-slate-700 font-medium'
                            }
                          />
                          <span
                            className={`font-semibold shrink-0 whitespace-nowrap ${
                              active
                                ? 'text-sky-300'
                                : tWait
                                  ? 'text-blue-700'
                                  : tSt.textCls
                            }`}
                          >
                            {tWait ? '待确认' : tSt.label}
                          </span>
                        </div>
                        <div className="text-xs font-semibold truncate">{t.title}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
