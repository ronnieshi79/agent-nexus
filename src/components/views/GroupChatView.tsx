import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  ArrowUpRight,
  AtSign,
  CheckCircle2,
  ClipboardPlus,
  FileCode2,
  FolderKanban,
  MessageSquareCode,
  Play,
  Send,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-react';
import type { CreateWorkCardInput } from '../../hooks/useAgentNexusStore';
import type {
  AgentNexusAccount,
  ChatMessage,
  ExpertAgent,
  ProjectWorkspace,
  TaskSessionMessage,
  WorkCardType,
  WorkflowTask,
} from '../../types/agentnexus';
import { ChatChannelHeader } from '../chat/ChatChannelHeader';
import { AgentMark, EntityAvatar, displayEntityName } from '../shared/EntityIdentity';
import { WORK_STATUS_META, WorkCardStageBar } from '../workcard/WorkCardFlow';

interface GroupChatViewProps {
  workspace: ProjectWorkspace;
  hiredAgents: ExpertAgent[];
  messages: ChatMessage[];
  tasks: WorkflowTask[];
  taskSessions: Record<string, TaskSessionMessage[]>;
  account: AgentNexusAccount | null;
  isBusy: boolean;
  executingTaskId: string | null;
  draftSeed: string;
  onClearDraftSeed: () => void;
  onSendMessage: (text: string) => Promise<void>;
  onCreateWorkCard: (input: CreateWorkCardInput) => void;
  onRunTask: (taskId: string) => Promise<void>;
  onApproveTask: (taskId: string) => void;
  onOpenTaskSession: (taskId: string) => void;
  onJumpToMarket: () => void;
  onJumpToKanban: () => void;
  onJumpToTeam: () => void;
}

const WORK_TYPE_LABELS: Record<WorkCardType, string> = {
  planning: '产品策划',
  development: '功能开发',
  testing: '功能测试',
  review: '架构评审',
};

export function GroupChatView({
  workspace,
  hiredAgents,
  messages,
  tasks,
  taskSessions,
  account,
  isBusy,
  executingTaskId,
  draftSeed,
  onClearDraftSeed,
  onSendMessage,
  onCreateWorkCard,
  onRunTask,
  onApproveTask,
  onOpenTaskSession,
  onJumpToMarket,
  onJumpToKanban,
  onJumpToTeam,
}: GroupChatViewProps) {
  const [draft, setDraft] = useState('');
  const [rightOpen, setRightOpen] = useState(true);
  const [rightTab, setRightTab] = useState<'tasks' | 'members'>('tasks');

  // Composer inline tools: none | mention | newCard | presets
  const [composerTool, setComposerTool] = useState<'none' | 'mention' | 'newCard' | 'presets'>(
    'none',
  );

  // New work card form fields inside composer
  const [cardModule, setCardModule] = useState('A功能 · 多币种结算');
  const [cardType, setCardType] = useState<WorkCardType>('development');
  const [cardTitle, setCardTitle] = useState('');
  const [cardDesc, setCardDesc] = useState('');
  const [cardAssignee, setCardAssignee] = useState(hiredAgents[0]?.id || '');
  const [cardPriority, setCardPriority] = useState<'高' | '中' | '低'>('高');

  const endRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (hiredAgents.length > 0 && !hiredAgents.some((a) => a.id === cardAssignee)) {
      setCardAssignee(hiredAgents[0].id);
    }
  }, [cardAssignee, hiredAgents]);

  useEffect(() => {
    if (draftSeed) {
      setDraft(draftSeed);
      onClearDraftSeed();
      textareaRef.current?.focus();
    }
  }, [draftSeed, onClearDraftSeed]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, isBusy]);

  const taskById = useMemo(() => {
    const map = new Map<string, WorkflowTask>();
    tasks.forEach((t) => map.set(t.id, t));
    return map;
  }, [tasks]);

  const groupedCards = useMemo(() => {
    const groups = new Map<string, WorkflowTask[]>();
    tasks.forEach((t) => {
      const key = t.featureModule || '核心功能模块';
      const list = groups.get(key) || [];
      list.push(t);
      groups.set(key, list);
    });
    return Array.from(groups.entries());
  }, [tasks]);

  const submitMessage = async () => {
    const cleaned = draft.trim();
    if (!cleaned || isBusy) return;
    setDraft('');
    setComposerTool('none');
    await onSendMessage(cleaned);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await submitMessage();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submitMessage();
    }
  };

  const handleCreateCardSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!cardTitle.trim()) return;
    onCreateWorkCard({
      sessionId: workspace.id,
      featureModule: cardModule,
      workType: cardType,
      title: cardTitle,
      description: cardDesc,
      assigneeId: cardAssignee,
      priority: cardPriority,
    });
    setCardTitle('');
    setCardDesc('');
    setComposerTool('none');
  };

  const insertMention = (handle: string) => {
    setDraft((prev) => (prev.includes(handle) ? prev : `${handle} ${prev}`.trimStart()));
    setComposerTool('none');
    textareaRef.current?.focus();
  };

  const quickPresets = [
    hiredAgents[1]
      ? `${hiredAgents[1].handle} 把“部分退款风控”拆成【开发】和【测试】两张工作卡片并同步工作看板`
      : '@Nexa 帮我把当前功能拆成开发与测试两张工作卡片',
    hiredAgents[0]
      ? `${hiredAgents[0].handle} 补充多币种退款异常边界并生成规划工作卡`
      : '@Nexa 检查本项目当前各功能模块进展',
    '@Nexa 汇总本项目当前所有工作卡片进度与交付风险',
  ];

  return (
    <div className="h-full flex min-h-0 bg-white relative">
      {/* Main Center Project Group Chat Column */}
      <div className="flex-1 min-w-0 flex flex-col h-full">
        {/* Uniform Top Channel Header with Top-Right Collapse/Expand Side Panel Button */}
        <ChatChannelHeader
          avatar={
            <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
              <FolderKanban className="w-4 h-4" />
            </div>
          }
          title={workspace.name}
          tag={`项目群 · ${hiredAgents.length} 专家 · ${tasks.length} 工作卡`}
          tagClassName="text-blue-700"
          subtitle={workspace.goal}
          panelOpen={rightOpen}
          panelToggleLabel={`工作卡片 (${tasks.length})`}
          onTogglePanel={() => setRightOpen((v) => !v)}
        />

        {/* Chat Message Stream */}
        <div className="flex-1 overflow-y-auto clean-scroll px-4 sm:px-8 py-6 bg-slate-50/40">
          <div className="max-w-3xl mx-auto space-y-5">
            {messages.map((msg) => {
              if (msg.senderType === 'system') {
                return (
                  <div key={msg.id} className="flex justify-center">
                    <div className="text-xs text-slate-500 bg-slate-100 px-3.5 py-1.5 rounded-lg">
                      {msg.content} · <span className="font-mono tabular-nums">{msg.timestamp}</span>
                    </div>
                  </div>
                );
              }

              const isEmployer = msg.senderType === 'employer';
              const isButler = msg.senderType === 'butler';
              const agentObj = hiredAgents.find((a) => a.id === msg.senderId);
              const linkedTasks = (msg.linkedTaskIds || [])
                .map((id) => taskById.get(id))
                .filter((t): t is WorkflowTask => Boolean(t));

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isEmployer ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <EntityAvatar
                    kind={isEmployer ? 'human' : isButler ? 'assistant' : 'agent'}
                    code={
                      isEmployer
                        ? account?.avatarInitials || '我'
                        : isButler
                          ? 'NX'
                          : agentObj?.avatarCode || 'AI'
                    }
                    accent={isEmployer ? '#0f172a' : agentObj?.avatarAccent || '#334155'}
                    size="md"
                    showCornerMark={!isEmployer && !isButler}
                  />

                  <div
                    className={`min-w-0 max-w-[86%] ${
                      isEmployer ? 'items-end' : 'items-start'
                    } flex flex-col`}
                  >
                    <div className="flex items-center gap-1.5 text-xs mb-1 flex-wrap">
                      <span className="font-semibold text-slate-900">
                        {isEmployer
                          ? account?.name || displayEntityName(msg.senderHandle)
                          : displayEntityName(msg.senderHandle)}
                      </span>
                      {!isEmployer && <AgentMark label={isButler ? '助理' : 'AI'} />}
                      {!isEmployer && !isButler && agentObj?.ownerHumanName && (
                        <span className="text-[11px] text-slate-400">
                          · 主理人 {agentObj.ownerHumanName}
                        </span>
                      )}
                      {isButler && (
                        <span className="text-slate-500">· {msg.senderName}</span>
                      )}
                      <span className="text-slate-400 font-mono tabular-nums">{msg.timestamp}</span>
                    </div>

                    <div
                      className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
                        isEmployer
                          ? 'bg-slate-900 text-white'
                          : 'bg-white text-slate-800 border border-slate-200'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>

                      {/* Lightweight inline task card reference with 1-click jump to 1v1 Task Session */}
                      {linkedTasks.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1">
                          {linkedTasks.map((task) => {
                            const isExec = executingTaskId === task.id;
                            const st = WORK_STATUS_META[task.status];
                            const sessionMsgs = taskSessions[task.id] || [];
                            const lastMsg = sessionMsgs[sessionMsgs.length - 1];
                            const needsConfirm =
                              task.status !== 'done' && Boolean(lastMsg?.awaitingConfirmation);
                            return (
                              <div
                                key={task.id}
                                className="flex items-center justify-between gap-3 py-1 text-xs"
                              >
                                <button
                                  type="button"
                                  onClick={() => onOpenTaskSession(task.id)}
                                  title="进入负责 Agent 的任务执行 Session"
                                  className="flex items-center gap-2 min-w-0 text-left text-slate-700 hover:text-blue-700 cursor-pointer"
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${st.activeSegmentCls} ${
                                      task.status === 'in_progress' ? 'animate-pulse' : ''
                                    }`}
                                  />
                                  <span className="truncate font-medium">{task.title}</span>
                                </button>

                                <div className="flex items-center gap-2.5 shrink-0 whitespace-nowrap text-[11px]">
                                  <span className={`font-medium ${st.textCls}`}>
                                    {isExec ? '正在执行' : st.label}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => onOpenTaskSession(task.id)}
                                    className={`inline-flex items-center gap-1 font-semibold cursor-pointer hover:underline underline-offset-2 ${
                                      needsConfirm
                                        ? 'text-amber-700 hover:text-amber-900'
                                        : 'text-indigo-600 hover:text-indigo-800'
                                    }`}
                                  >
                                    <MessageSquareCode className="w-3 h-3" />
                                    <span>
                                      {needsConfirm
                                        ? 'Agent 待确认'
                                        : sessionMsgs.length > 0
                                          ? `Agent 任务 (${sessionMsgs.length})`
                                          : 'Agent 任务'}
                                    </span>
                                  </button>
                                  {task.status === 'pending' && (
                                    <button
                                      type="button"
                                      disabled={Boolean(executingTaskId)}
                                      onClick={() => onRunTask(task.id)}
                                      className="font-semibold text-blue-600 hover:text-blue-800 hover:underline underline-offset-2 cursor-pointer disabled:opacity-45"
                                    >
                                      批准执行
                                    </button>
                                  )}
                                  {task.status === 'review' && (
                                    <button
                                      type="button"
                                      onClick={() => onApproveTask(task.id)}
                                      className="font-semibold text-emerald-600 hover:text-emerald-800 hover:underline underline-offset-2 cursor-pointer"
                                    >
                                      验收通过
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {isBusy && (
              <div className="text-xs text-slate-500 pl-11">
                项目专家团队正在协同拆解并同步工作卡片...
              </div>
            )}
            <div ref={endRef} />
          </div>
        </div>

        {/* Unified Bottom Chat Input Composer (All @Agent Mentions & + New Work Card Tools Live Here!) */}
        <div className="shrink-0 border-t border-slate-200 bg-white px-4 sm:px-8 py-3.5">
          <div className="max-w-3xl mx-auto space-y-2.5">
            {/* Attached Popover Shelf 1: @ Agent Expert Picker */}
            {composerTool === 'mention' && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    选择要 @ 的群内专家 Agent
                  </span>
                  <button
                    type="button"
                    onClick={() => setComposerTool('none')}
                    className="text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => insertMention('@Nexa')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-blue-400 text-xs font-semibold text-slate-800 cursor-pointer"
                  >
                    <span className="w-4 h-4 rounded bg-blue-600 text-white text-[9px] font-bold inline-flex items-center justify-center">
                      NX
                    </span>
                    <span>@Nexa 助理</span>
                  </button>
                  {hiredAgents.map((agent) => (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => insertMention(agent.handle)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-blue-400 text-xs font-semibold text-slate-800 cursor-pointer"
                    >
                      <span
                        className="w-4 h-4 rounded text-white text-[9px] font-bold inline-flex items-center justify-center"
                        style={{ backgroundColor: agent.avatarAccent }}
                      >
                        {agent.avatarCode}
                      </span>
                      <span>{agent.handle}</span>
                      <span className="text-[11px] font-normal text-slate-500">{agent.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Attached Popover Shelf 2: + New Project Work Card Creator */}
            {composerTool === 'newCard' && (
              <form
                onSubmit={handleCreateCardSubmit}
                className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">
                    新建工作卡片 · 所属项目「{workspace.name}」
                  </span>
                  <button
                    type="button"
                    onClick={() => setComposerTool('none')}
                    className="text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="text"
                    value={cardModule}
                    onChange={(e) => setCardModule(e.target.value)}
                    placeholder="功能模块（如 A功能 · 多币种结算）"
                    className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                  <select
                    value={cardType}
                    onChange={(e) => setCardType(e.target.value as WorkCardType)}
                    className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  >
                    <option value="planning">产品策划</option>
                    <option value="development">功能开发</option>
                    <option value="testing">功能测试</option>
                    <option value="review">架构评审</option>
                  </select>
                  <select
                    value={cardAssignee}
                    onChange={(e) => setCardAssignee(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  >
                    {hiredAgents.map((a) => (
                      <option key={a.id} value={a.id}>
                        指派：{displayEntityName(a.handle)}（AI）
                      </option>
                    ))}
                  </select>
                  <select
                    value={cardPriority}
                    onChange={(e) => setCardPriority(e.target.value as '高' | '中' | '低')}
                    className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  >
                    <option value="高">优先级：高</option>
                    <option value="中">优先级：中</option>
                    <option value="低">优先级：低</option>
                  </select>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    required
                    value={cardTitle}
                    onChange={(e) => setCardTitle(e.target.value)}
                    placeholder="卡片标题（如：开发 A 功能 · 汇率波动熔断保护）"
                    className="flex-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                  <input
                    type="text"
                    value={cardDesc}
                    onChange={(e) => setCardDesc(e.target.value)}
                    placeholder="交付要求与验收标准（可选）"
                    className="flex-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white whitespace-nowrap cursor-pointer shrink-0"
                  >
                    创建并同步看板
                  </button>
                </div>
              </form>
            )}

            {/* Attached Popover Shelf 3: Quick Prompt Presets */}
            {composerTool === 'presets' && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-1.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-800">快捷派单指令</span>
                  <button
                    type="button"
                    onClick={() => setComposerTool('none')}
                    className="text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {quickPresets.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setDraft(preset);
                        setComposerTool('none');
                        textareaRef.current?.focus();
                      }}
                      className="text-left text-xs text-slate-700 hover:text-slate-900 bg-white border border-slate-200 hover:border-blue-400 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Main Unified Input Box */}
            <form
              onSubmit={handleSubmit}
              className="rounded-xl border border-slate-300 bg-slate-50/60 focus-within:bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-600/15 transition-all"
            >
              <textarea
                ref={textareaRef}
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isBusy}
                placeholder="输入项目需求、@ 专家派单，或点击下方工具栏新建工作卡片...（Enter 发送，Shift+Enter 换行）"
                className="w-full bg-transparent px-3.5 pt-3 pb-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none resize-none leading-relaxed"
              />

              {/* Composer Bottom Action Bar: @ Expert, + New Work Card, Quick Directives, Send */}
              <div className="px-2.5 pb-2.5 pt-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() =>
                      setComposerTool((t) => (t === 'mention' ? 'none' : 'mention'))
                    }
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      composerTool === 'mention'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                    }`}
                  >
                    <AtSign className="w-3.5 h-3.5" />
                    <span>@ 专家 ({hiredAgents.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setComposerTool((t) => (t === 'newCard' ? 'none' : 'newCard'))
                    }
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      composerTool === 'newCard'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                    }`}
                  >
                    <ClipboardPlus className="w-3.5 h-3.5" />
                    <span>新建工作卡片</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setComposerTool((t) => (t === 'presets' ? 'none' : 'presets'))
                    }
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      composerTool === 'presets'
                        ? 'bg-slate-200 text-slate-900'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/70'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>快捷指令</span>
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isBusy || !draft.trim()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isBusy ? '发送中...' : '发送'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Right Docked Side Panel: Project Work Cards + Active Members */}
      {rightOpen && (
        <aside className="fixed inset-y-0 right-0 z-30 lg:static lg:z-auto w-[336px] max-w-[88vw] shrink-0 border-l border-slate-200 bg-slate-50/70 flex flex-col h-full shadow-2xl lg:shadow-none">
          <div className="p-3 border-b border-slate-200 bg-white flex items-center justify-between gap-2 shrink-0">
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg flex-1">
              <button
                type="button"
                onClick={() => setRightTab('tasks')}
                className={`py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  rightTab === 'tasks'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                项目工作卡 ({tasks.length})
              </button>
              <button
                type="button"
                onClick={() => setRightTab('members')}
                className={`py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  rightTab === 'members'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                在群专家 ({hiredAgents.length})
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto clean-scroll p-3.5 space-y-4">
            {rightTab === 'tasks' ? (
              <>
                {groupedCards.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-500">
                    在下方对话输入框点击「新建工作卡片」或 @ 专家，卡片将按功能模块自动归类至此。
                  </div>
                ) : (
                  groupedCards.map(([moduleName, moduleTasks]) => (
                    <div key={moduleName} className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-bold text-slate-800">{moduleName}</span>
                        <span className="text-[11px] font-mono tabular-nums text-slate-500">
                          {moduleTasks.filter((t) => t.status === 'done').length}/{moduleTasks.length} 完成
                        </span>
                      </div>

                      {moduleTasks.map((task) => {
                        const isExec = executingTaskId === task.id;
                        const st = WORK_STATUS_META[task.status];
                        const sessionMsgs = taskSessions[task.id] || [];
                        const lastMsg = sessionMsgs[sessionMsgs.length - 1];
                        const needsConfirm =
                          task.status !== 'done' && Boolean(lastMsg?.awaitingConfirmation);
                        return (
                          <div
                            key={task.id}
                            className="bg-white rounded-xl p-3.5 border border-slate-200/90 space-y-2.5"
                          >
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-500 font-medium">
                                {WORK_TYPE_LABELS[task.workType]} · <span className="font-mono">{task.id}</span>
                              </span>
                              <span className={`font-semibold ${st.textCls}`}>
                                {st.label}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => onOpenTaskSession(task.id)}
                              className="text-left text-xs font-semibold text-slate-900 hover:text-blue-700 leading-snug cursor-pointer"
                            >
                              {task.title}
                            </button>

                            <WorkCardStageBar status={task.status} />

                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                              <span className="inline-flex items-center gap-1 min-w-0">
                                <span className="font-medium text-slate-700 truncate">
                                  {displayEntityName(task.assigneeHandle)}
                                </span>
                                <AgentMark />
                              </span>
                              <span className="font-mono tabular-nums shrink-0">
                                {task.priority}优 · {task.updatedAt}
                              </span>
                            </div>

                            {task.deliverableArtifact && (
                              <div className="flex items-center gap-1 text-[11px] font-mono text-blue-700 truncate">
                                <FileCode2 className="w-3 h-3 shrink-0" />
                                <span className="truncate">{task.deliverableArtifact}</span>
                              </div>
                            )}

                            <div className="flex items-center gap-2 pt-0.5">
                              <button
                                type="button"
                                onClick={() => onOpenTaskSession(task.id)}
                                className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap cursor-pointer ${
                                  needsConfirm
                                    ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100/70'
                                    : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100 hover:border-slate-300'
                                }`}
                              >
                                <MessageSquareCode className="w-3.5 h-3.5 shrink-0" />
                                <span>
                                  {needsConfirm
                                    ? 'Agent 待确认'
                                    : sessionMsgs.length > 0
                                      ? `进入 Agent 任务 (${sessionMsgs.length})`
                                      : '进入 Agent 任务'}
                                </span>
                              </button>

                              {task.status === 'pending' && (
                                <button
                                  type="button"
                                  disabled={Boolean(executingTaskId)}
                                  onClick={() => onRunTask(task.id)}
                                  className="inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap cursor-pointer disabled:opacity-45"
                                >
                                  <Play className="w-3 h-3" />
                                  <span>{isExec ? '执行中' : '批准执行'}</span>
                                </button>
                              )}

                              {task.status === 'review' && (
                                <button
                                  type="button"
                                  onClick={() => onApproveTask(task.id)}
                                  className="inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>验收通过</span>
                                </button>
                              )}
                            </div>

                            {task.status === 'in_progress' && (
                              <div className="w-full text-center py-1 rounded-lg text-[11px] font-medium text-blue-700 bg-blue-50">
                                正在执行中 · 可进入 Agent Session 多轮调试
                              </div>
                            )}

                            {task.status === 'done' && (
                              <div className="flex items-center justify-between text-[11px] text-emerald-700 font-semibold pt-0.5">
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
                        );
                      })}
                    </div>
                  ))
                )}

                <button
                  type="button"
                  onClick={onJumpToKanban}
                  className="w-full py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 inline-flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>打开全局「工作看板」</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                {hiredAgents.map((agent) => (
                  <div
                    key={agent.id}
                    className="bg-white rounded-xl p-3.5 border border-slate-200/90 space-y-2"
                  >
                    <div className="flex items-center gap-2.5">
                      <EntityAvatar
                        kind="agent"
                        code={agent.avatarCode}
                        accent={agent.avatarAccent}
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {displayEntityName(agent.handle)}
                          </span>
                          <AgentMark />
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {agent.ownerHumanName
                            ? `主理人：${agent.ownerHumanName} · ${agent.title}`
                            : agent.title}
                        </div>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      {agent.skills.slice(0, 4).join(' · ')}
                    </p>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="font-mono tabular-nums text-slate-600">
                        {agent.ownership === 'private'
                          ? '私有自用'
                          : `$${agent.projectPriceUsd.toLocaleString('en-US')}/项目 · 信誉 ${agent.performance.reputationScore}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => insertMention(agent.handle)}
                        className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                      >
                        @ 他派单
                      </button>
                    </div>
                  </div>
                ))}

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onJumpToMarket}
                    className="py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-medium text-white inline-flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>去市场选人</span>
                  </button>
                  <button
                    type="button"
                    onClick={onJumpToTeam}
                    className="py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer"
                  >
                    我的团队
                  </button>
                </div>
              </>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
