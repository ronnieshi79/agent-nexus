import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  FileCode2,
  FolderKanban,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Send,
  Share2,
  Sparkles,
  Terminal,
  X,
} from 'lucide-react';
import type {
  AgentNexusAccount,
  ExpertAgent,
  ProjectWorkspace,
  TaskSessionMessage,
  WorkCardType,
  WorkflowTask,
} from '../../types/agentnexus';
import { AgentMark, EntityAvatar, displayEntityName } from '../shared/EntityIdentity';
import { WORK_STATUS_META, WorkStatusBadge } from '../workcard/WorkCardFlow';

interface TaskSessionPaneProps {
  task: WorkflowTask;
  workspace: ProjectWorkspace;
  agent: ExpertAgent | null;
  agents: ExpertAgent[];
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
}: TaskSessionPaneProps) {
  const [draft, setDraft] = useState('');
  const [panelOpen, setPanelOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const st = WORK_STATUS_META[task.status];
  const lastMsg = messages[messages.length - 1];
  const isWaitingReply = Boolean(lastMsg?.awaitingConfirmation && task.status !== 'done');

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

  const quickDirectives =
    task.status === 'done'
      ? ['帮我复盘一下本次交付的关键风险点', '如果要做二期扩展，预留哪些接口最合适？']
      : [
          '请输出当前实现的核心边界测试用例',
          '检查并发异常与降级兜底逻辑',
          '当前方案已确认，请收尾定稿并提交待验证',
        ];

  return (
    <div className="h-full flex min-h-0 bg-white relative">
      {/* Main 1v1 Task Card Dedicated Session Column */}
      <div className="flex-1 min-w-0 flex flex-col h-full">
        {/* Session Header with Back-to-Group Breadcrumb & Context Toggle */}
        <div className="px-4 sm:px-6 py-3 border-b border-slate-200 bg-white flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => onBackToGroup(workspace.id)}
              title={`返回「${workspace.name}」项目群聊`}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">返回群聊</span>
            </button>

            <EntityAvatar
              kind="agent"
              code={agent?.avatarCode || 'AI'}
              accent={agent?.avatarAccent || '#334155'}
              sessionCorner
            />

            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-sm font-bold text-slate-900 truncate">{task.title}</h2>
                <span className={`text-xs font-semibold whitespace-nowrap shrink-0 ${st.textCls}`}>
                  · {isExecuting ? '正在执行中' : st.label}
                </span>
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5 truncate">
                <span className="font-semibold text-slate-700 shrink-0">
                  {displayEntityName(agent?.handle || task.assigneeHandle)}
                </span>
                <AgentMark
                  runtime={agent?.runtimeAgent}
                  model={agent?.defaultModel}
                  showModel
                />
                <span aria-hidden="true">·</span>
                <span className="font-mono text-slate-600 shrink-0">Session #{task.id}</span>
                <span aria-hidden="true">·</span>
                <span className="truncate text-slate-400">{workspace.name}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {panelOpen ? (
              <PanelRightClose className="w-3.5 h-3.5 text-slate-500" />
            ) : (
              <PanelRightOpen className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span className="hidden sm:inline">任务上下文</span>
          </button>
        </div>

        {/* Multi-Turn Conversation Stream */}
        <div className="flex-1 overflow-y-auto clean-scroll px-4 sm:px-8 py-5 bg-slate-50/40">
          <div className="max-w-3xl mx-auto space-y-5">
            {/* Anchored Task Specification Header */}
            <div className="rounded-xl bg-white border border-slate-200 p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                <span className="truncate">
                  <span className="font-semibold text-slate-800">{task.featureModule}</span>
                  <span className="mx-1.5 text-slate-300" aria-hidden="true">·</span>
                  <span>{WORK_TYPE_LABELS[task.workType]}</span>
                  <span className="mx-1.5 text-slate-300" aria-hidden="true">·</span>
                  <span className="font-mono">{task.id}</span>
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <WorkStatusBadge status={task.status} />
                  <span className="font-mono tabular-nums text-[11px] text-slate-400">
                    {messages.length} 轮 Session
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">{task.description}</p>
            </div>

            {/* Multi-Turn Message Thread */}
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
                    className={`min-w-0 max-w-[88%] flex flex-col ${
                      isEmployer ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs mb-1">
                      <span className="font-semibold text-slate-900">
                        {isEmployer
                          ? account?.name || '我（雇主）'
                          : displayEntityName(agent?.handle || task.assigneeHandle)}
                      </span>
                      {!isEmployer && (
                        <AgentMark
                          runtime={agent?.runtimeAgent}
                          model={agent?.defaultModel}
                        />
                      )}
                      <span className="text-slate-400 font-mono tabular-nums">{msg.timestamp}</span>
                      {msg.milestoneSynced && (
                        <span className="text-[11px] font-medium text-emerald-700">
                          · 已自动回写群聊里程碑
                        </span>
                      )}
                    </div>

                    <div
                      className={`rounded-xl px-4 py-3 text-sm leading-relaxed space-y-3 ${
                        isEmployer
                          ? 'bg-slate-900 text-white'
                          : 'bg-white text-slate-800 border border-slate-200'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>

                      {/* Remote Agent Execution Steps */}
                      {!isEmployer && msg.executionSteps && msg.executionSteps.length > 0 && (
                        <div className="pt-2.5 border-t border-slate-100 space-y-1.5">
                          <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                            <Terminal className="w-3 h-3 text-slate-400" />
                            <span>本轮远程执行轨迹</span>
                          </div>
                          <ul className="space-y-1">
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
                        </div>
                      )}

                      {/* Artifact Code / Diff Preview */}
                      {!isEmployer && (msg.artifactPath || msg.artifactSnippet) && (
                        <div className="rounded-lg bg-slate-950 text-slate-100 overflow-hidden">
                          {msg.artifactPath && (
                            <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 flex items-center gap-1.5 text-[11px] font-mono text-sky-300">
                              <FileCode2 className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{msg.artifactPath}</span>
                            </div>
                          )}
                          {msg.artifactSnippet && (
                            <pre className="p-3 text-xs font-mono leading-relaxed overflow-x-auto text-slate-200">
                              <code>{msg.artifactSnippet}</code>
                            </pre>
                          )}
                        </div>
                      )}

                      {/* Interactive Confirmation Options on the Latest Agent Turn */}
                      {!isEmployer &&
                        isLast &&
                        msg.suggestedActions &&
                        msg.suggestedActions.length > 0 &&
                        task.status !== 'done' && (
                          <div className="pt-2.5 border-t border-slate-100 space-y-1.5">
                            <div className="text-[11px] font-semibold text-blue-700">
                              {msg.awaitingConfirmation
                                ? '需要你确认或继续指示（点击直接回复）'
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
                {displayEntityName(agent?.handle || task.assigneeHandle)} 正在沙箱中执行本轮修改并组织反馈...
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

        {/* Bottom 1v1 Task Composer + Stage Action Bar */}
        <div className="shrink-0 border-t border-slate-200 bg-white px-4 sm:px-8 py-3">
          <div className="max-w-3xl mx-auto space-y-2">
            {/* Quick Workflow Actions & Suggestions */}
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
                  title="将当前 Agent Session 阶段结论同步一条摘要到所属项目群"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-medium text-slate-700 cursor-pointer whitespace-nowrap"
                >
                  <Share2 className="w-3 h-3 text-slate-500" />
                  <span>同步结论到群聊</span>
                </button>
              </div>
            </div>

            {/* Input Form */}
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
                placeholder={`直接向 ${displayEntityName(agent?.handle || task.assigneeHandle)} 回复确认细节、补充代码约束或要求修正...（Enter 发送，Shift+Enter 换行）`}
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

      {/* Right Docked Task Context & Project Sibling Sessions Panel */}
      {panelOpen && (
        <aside className="fixed inset-y-0 right-0 z-30 lg:static lg:z-auto w-[328px] max-w-[88vw] shrink-0 border-l border-slate-200 bg-slate-50/70 flex flex-col h-full shadow-2xl lg:shadow-none">
          <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
            <span className="text-xs font-bold text-slate-900">Agent Session 上下文</span>
            <button
              type="button"
              onClick={() => onBackToGroup(workspace.id)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
            >
              <FolderKanban className="w-3 h-3" />
              <span>回到项目群</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto clean-scroll p-4 space-y-4">
            {/* Sync Mechanism Notice */}
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-900">当前状态与同步机制</span>
                <WorkStatusBadge status={task.status} />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                当前 Agent Session 内的多轮执行调试与方案确认仅保留于此；进入启动、提审或验证里程碑时，系统自动回写精炼摘要至「{workspace.name}」项目群。
              </p>
              {isWaitingReply && (
                <div className="text-[11px] font-semibold text-blue-700">
                  状态提醒：专家正在等待你的本轮确认回复
                </div>
              )}
            </div>

            {/* Latest Deliverable Snapshot */}
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2">
              <div className="text-xs font-bold text-slate-900">最新交付产物</div>
              {task.deliverableArtifact ? (
                <div className="flex items-center gap-1.5 text-xs font-mono text-blue-700 truncate">
                  <FileCode2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{task.deliverableArtifact}</span>
                </div>
              ) : (
                <div className="text-xs text-slate-400">尚未产出归档文件，发送指令后自动更新</div>
              )}
              {task.deliverableSummary && (
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {task.deliverableSummary}
                </p>
              )}
            </div>

            {/* Responsible Agent & Human Owner Info */}
            {agent && (
              <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2">
                <div className="flex items-center gap-2.5">
                  <EntityAvatar
                    kind="agent"
                    code={agent.avatarCode}
                    accent={agent.avatarAccent}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                      <span className="truncate">{displayEntityName(agent.handle)}</span>
                      <AgentMark
                        runtime={agent.runtimeAgent}
                        model={agent.defaultModel}
                        showModel
                      />
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {agent.ownerHumanName
                        ? `归属专家：${agent.ownerHumanName}`
                        : agent.title}
                    </div>
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 font-mono truncate">
                  MCP 工具：{agent.mcpTools.join(' / ')}
                </div>
              </div>
            )}

            {/* Sibling Task Card Sessions in the Same Project */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-0.5 text-xs">
                <span className="font-bold text-slate-800">
                  本项目其他 Agent Session ({siblingTasks.length})
                </span>
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
                      className={`w-full text-left p-2.5 rounded-lg border transition-colors cursor-pointer ${
                        active
                          ? 'bg-slate-900 border-slate-900 text-white'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="inline-flex items-center gap-1.5 min-w-0">
                          <span className={`truncate ${active ? 'text-slate-200' : 'text-slate-600'}`}>
                            {displayEntityName(t.assigneeHandle)}
                          </span>
                          <AgentMark
                            runtime={siblingAgent?.runtimeAgent}
                            model={siblingAgent?.defaultModel}
                            inverted={active}
                          />
                        </span>
                        <span
                          className={`font-semibold shrink-0 ${
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
                      <div className="text-xs font-semibold truncate mt-1">{t.title}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
