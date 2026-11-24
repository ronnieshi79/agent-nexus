import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Compass,
  KanbanSquare,
  Layers,
  LogIn,
  MessageSquare,
  MessageSquareCode,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Store,
  UserPlus,
  X,
} from 'lucide-react';
import type {
  ActiveChatChannel,
  AgentNexusAccount,
  AssistantMessage,
  ChatMessage,
  CommunityZone,
  ExpertAgent,
  NavViewId,
  NegotiationThread,
  ProjectWorkspace,
  TaskSessionMessage,
  WorkflowTask,
} from '../../types/agentnexus';
import { AccountFooter } from '../account/AccountPanel';
import {
  AgentIdentityName,
  EntityAvatar,
  displayEntityName,
  formatShortModel,
} from '../shared/EntityIdentity';
import { WORK_STATUS_META } from '../workcard/WorkCardFlow';

interface SidebarProps {
  activeView: NavViewId;
  activeChatChannel: ActiveChatChannel;
  zones: CommunityZone[];
  workspaces: ProjectWorkspace[];
  agents: ExpertAgent[];
  allMessages: ChatMessage[];
  allTasks: WorkflowTask[];
  taskSessions: Record<string, TaskSessionMessage[]>;
  negotiations: NegotiationThread[];
  assistantMessages: AssistantMessage[];
  assistantPendingCount: number;
  awaitingTaskSessionCount: number;
  reviewTaskCount: number;
  hiredCount: number;
  privateCount: number;
  marketCount: number;
  discoverCount: number;
  account: AgentNexusAccount | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onSelectView: (v: NavViewId) => void;
  onSelectProjectChat: (projectId: string) => void;
  onSelectDm: (agentId: string) => void;
  onSelectAssistant: () => void;
  onSelectTaskSession: (taskId: string) => void;
  onCreateProject: (name: string, goal: string, sourceZoneId?: string) => void;
  onOpenLogin: () => void;
  onLogout: () => void;
}

type ChatModeTab = 'regular' | 'task_session';

const DM_STATUS_LABEL: Record<NegotiationThread['status'], { text: string; cls: string }> = {
  negotiating: { text: '协商中', cls: 'text-slate-500' },
  quoted: { text: '待确认报价', cls: 'text-amber-700 font-semibold' },
  hired: { text: '已雇佣', cls: 'text-emerald-700 font-semibold' },
};

export function Sidebar({
  activeView,
  activeChatChannel,
  zones,
  workspaces,
  agents,
  allMessages,
  allTasks,
  taskSessions,
  negotiations,
  assistantMessages,
  assistantPendingCount,
  awaitingTaskSessionCount,
  reviewTaskCount,
  hiredCount,
  privateCount,
  marketCount,
  discoverCount,
  account,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  onSelectView,
  onSelectProjectChat,
  onSelectDm,
  onSelectAssistant,
  onSelectTaskSession,
  onCreateProject,
  onOpenLogin,
  onLogout,
}: SidebarProps) {
  const [modeTab, setModeTab] = useState<ChatModeTab>('regular');
  const [taskProjectFilter, setTaskProjectFilter] = useState<string>('all');
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showDmPicker, setShowDmPicker] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGoal, setNewGoal] = useState('');
  const [newSourceZoneId, setNewSourceZoneId] = useState<string>('');

  // Keep mode switcher synced with active channel
  useEffect(() => {
    if (activeView === 'chat') {
      if (activeChatChannel.type === 'task_session') {
        setModeTab('task_session');
      } else {
        setModeTab('regular');
      }
    }
  }, [activeChatChannel.type, activeView]);

  const zoneMap = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);

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

  const availableDmAgents = useMemo(() => {
    const existingIds = new Set(negotiations.map((n) => n.agentId));
    return agents.filter((a) => !existingIds.has(a.id));
  }, [agents, negotiations]);

  // Sort 1v1 Task Card Sessions: awaiting confirmation -> in_progress -> review -> pending -> done
  const sortedTaskSessions = useMemo(() => {
    const statusWeight: Record<WorkflowTask['status'], number> = {
      in_progress: 0,
      review: 1,
      pending: 2,
      done: 3,
    };
    const filtered =
      taskProjectFilter === 'all'
        ? allTasks
        : allTasks.filter((t) => t.sessionId === taskProjectFilter);
    return [...filtered].sort((a, b) => {
      const aMsgs = taskSessions[a.id] || [];
      const bMsgs = taskSessions[b.id] || [];
      const aWait = a.status !== 'done' && aMsgs[aMsgs.length - 1]?.awaitingConfirmation ? 0 : 1;
      const bWait = b.status !== 'done' && bMsgs[bMsgs.length - 1]?.awaitingConfirmation ? 0 : 1;
      if (aWait !== bWait) return aWait - bWait;
      return statusWeight[a.status] - statusWeight[b.status];
    });
  }, [allTasks, taskProjectFilter, taskSessions]);

  const lastAssistantMsg = assistantMessages[assistantMessages.length - 1];
  const regularTotalCount = 1 + workspaces.length + negotiations.length;

  const handleCreateProject = (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onCreateProject(newName, newGoal, newSourceZoneId || undefined);
    setNewName('');
    setNewGoal('');
    setNewSourceZoneId('');
    setShowCreateProject(false);
    setModeTab('regular');
    onCloseMobile();
  };

  const navItems: {
    id: Exclude<NavViewId, 'chat'>;
    label: string;
    icon: typeof KanbanSquare;
    count?: string;
    highlight?: boolean;
  }[] = [
    {
      id: 'team',
      label: 'AGN 空间',
      icon: Layers,
      count: `${hiredCount}+${privateCount}`,
    },
    {
      id: 'kanban',
      label: '工作台',
      icon: KanbanSquare,
      count: reviewTaskCount > 0 ? `${reviewTaskCount} 待验证` : `${workspaces.length} 项目`,
      highlight: reviewTaskCount > 0,
    },
    {
      id: 'market',
      label: '服务市场',
      icon: Store,
      count: `${marketCount}`,
    },
    {
      id: 'discover',
      label: '交流社区',
      icon: Compass,
      count: `${discoverCount} 项目`,
    },
  ];

  const isChatView = activeView === 'chat';

  const sidebarContent = (
    <div className="h-full flex flex-col bg-slate-50 border-r border-slate-200 select-none">
      {/* Platform Brand Header */}
      <div className="h-14 px-4 border-b border-slate-200/80 shrink-0 bg-white flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-display text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap leading-none">
            AgentNexus
          </div>
          <div className="text-[11px] font-medium text-slate-500 mt-1 truncate">
            Agents 协作网络
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onToggleCollapse}
            title="收起左侧栏"
            aria-label="收起左侧栏"
            className="hidden lg:inline-flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1 rounded-lg text-slate-500 hover:bg-slate-200/60 cursor-pointer"
            aria-label="关闭侧边栏"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Top Workspace Navigation */}
      <div className="px-3 py-3 border-b border-slate-200/80 bg-white shrink-0">
        <nav aria-label="主导航" className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectView(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="inline-flex items-center gap-2.5 min-w-0 truncate">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${active ? 'text-sky-300' : 'text-slate-500'}`}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.count && (
                  <span
                    className={`text-xs font-mono tabular-nums shrink-0 ${
                      active
                        ? 'text-slate-300'
                        : item.highlight
                          ? 'text-blue-700 font-semibold'
                          : 'text-slate-500'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Lower Core Section: Regular IM Sessions (Project Groups + DMs + Nexa Assistant) vs. Task Card 1v1 Sessions */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="px-3 pt-3 pb-2 space-y-2 shrink-0">
          <div className="flex items-center justify-between gap-1.5 px-0.5">
            <span className="text-xs font-bold text-slate-700">协作对话</span>
            {modeTab === 'regular' ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateProject((v) => !v);
                    setShowDmPicker(false);
                  }}
                  title="新建项目群"
                  className={`inline-flex items-center gap-0.5 px-1.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                    showCreateProject
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <Plus className="w-3 h-3" />
                  <span>建项目群</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDmPicker((v) => !v);
                    setShowCreateProject(false);
                  }}
                  title="发起专家/Agent单聊"
                  className={`inline-flex items-center gap-0.5 px-1.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                    showDmPicker
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <UserPlus className="w-3 h-3" />
                  <span>单聊</span>
                </button>
              </div>
            ) : (
              <span className="text-[11px] font-mono tabular-nums text-slate-500">
                {awaitingTaskSessionCount > 0
                  ? `${awaitingTaskSessionCount} 项待确认`
                  : `${allTasks.length} 个 Session`}
              </span>
            )}
          </div>

          {/* Dual Mode Switcher: 消息会话 vs Agent 任务 (Agent Execution Sessions) */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-200/75 rounded-lg">
            <button
              type="button"
              onClick={() => setModeTab('regular')}
              className={`py-1.5 px-2 text-xs font-semibold rounded-md transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${
                modeTab === 'regular'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              <span>消息会话</span>
              <span className="text-[10px] font-mono tabular-nums opacity-70">
                {regularTotalCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setModeTab('task_session')}
              className={`py-1.5 px-2 text-xs font-semibold rounded-md transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${
                modeTab === 'task_session'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MessageSquareCode className="w-3.5 h-3.5 shrink-0" />
              <span>Agent 任务</span>
              <span
                className={`text-[10px] font-mono tabular-nums ${
                  awaitingTaskSessionCount > 0 && modeTab !== 'task_session'
                    ? 'text-blue-700 font-bold'
                    : 'opacity-70'
                }`}
              >
                {allTasks.length}
              </span>
            </button>
          </div>

          {/* Inline Create Project Group Form */}
          {modeTab === 'regular' && showCreateProject && (
            <form
              onSubmit={handleCreateProject}
              className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-700">
                  新建工作项目（同步创建项目群）
                </span>
                <button
                  type="button"
                  onClick={() => setShowCreateProject(false)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="输入工作项目名称..."
                className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-600/20"
              />
              <input
                type="text"
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                placeholder="项目目标（可选）"
                className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-600/20"
              />
              <select
                value={newSourceZoneId}
                onChange={(e) => setNewSourceZoneId(e.target.value)}
                aria-label="项目所属协作空间"
                className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:bg-white"
              >
                <option value="">归属：个人私有项目</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    归属：{z.name}（{z.typeLabel}）
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="w-full py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
              >
                创建项目并建群
              </button>
            </form>
          )}

          {/* Task Session Mode: Project Filter & 1:1 Kanban Mapping Hint */}
          {modeTab === 'task_session' && (
            <div className="space-y-1">
              <select
                value={taskProjectFilter}
                onChange={(e) => setTaskProjectFilter(e.target.value)}
                aria-label="按工作项目筛选 Agent 任务"
                className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-[11px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              >
                <option value="all">全部工作项目 ({allTasks.length} 张任务卡)</option>
                {workspaces.map((w) => {
                  const cnt = allTasks.filter((t) => t.sessionId === w.id).length;
                  return (
                    <option key={w.id} value={w.id}>
                      {w.name} ({cnt})
                    </option>
                  );
                })}
              </select>
              <div className="px-0.5 text-[10px] text-slate-400">
                与「工作台 → 项目看板」任务卡片 1:1 对应
              </div>
            </div>
          )}

          {/* Inline Start 1v1 Expert / Agent DM Picker */}
          {modeTab === 'regular' && showDmPicker && (
            <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-700">
                  选择专家 / Agent 发起单聊
                </span>
                <button
                  type="button"
                  onClick={() => setShowDmPicker(false)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {availableDmAgents.length === 0 ? (
                <div className="text-[11px] text-slate-500 py-1">
                  所有在线专家均已建立单聊通道。
                </div>
              ) : (
                <div className="max-h-40 overflow-y-auto clean-scroll space-y-1">
                  {availableDmAgents.map((cand) => (
                    <button
                      key={cand.id}
                      type="button"
                      onClick={() => {
                        onSelectDm(cand.id);
                        setShowDmPicker(false);
                        onCloseMobile();
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-md hover:bg-slate-100 flex items-center justify-between gap-2 text-xs cursor-pointer"
                    >
                      <AgentIdentityName
                        name={cand.handle}
                        runtime={cand.runtimeAgent}
                        model={cand.defaultModel}
                        className="font-medium text-slate-800"
                      />
                      <span className="text-[11px] text-slate-500 truncate">
                        {cand.ownerHumanName ? `归属专家 ${cand.ownerHumanName}` : cand.title}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Thread List */}
        <div className="flex-1 overflow-y-auto clean-scroll px-2.5 pb-3 space-y-1">
          {modeTab === 'regular' ? (
            <>
              {/* 1. Nexa Assistant */}
              <button
                type="button"
                onClick={() => {
                  onSelectAssistant();
                  onCloseMobile();
                }}
                className={`w-full text-left p-2.5 rounded-xl border transition-colors cursor-pointer ${
                  isChatView && activeChatChannel.type === 'assistant'
                    ? 'bg-white border-slate-300 shadow-2xs'
                    : 'border-transparent hover:bg-white/80'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5">
                    <EntityAvatar kind="assistant" title="平台助理" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <AgentIdentityName
                        name="平台助理"
                        runtime="Nexa"
                        className="text-xs font-bold text-slate-900"
                      />
                      <span className="text-[10px] font-mono tabular-nums text-slate-400 shrink-0">
                        {lastAssistantMsg?.timestamp || '在线'}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-1.5 text-[11px]">
                      <span className="text-blue-700 font-medium truncate">
                        结算 · 审核 · 评价 · 接单
                      </span>
                      {assistantPendingCount > 0 && (
                        <span className="font-mono tabular-nums font-semibold text-amber-700 shrink-0">
                          {assistantPendingCount} 待办
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500 truncate">
                      {lastAssistantMsg?.content || '处理日常项目结算核销、审核与接单提醒'}
                    </p>
                  </div>
                </div>
              </button>

              {/* 2. Project Groups */}
              {workspaces.map((ws) => {
                const isSelected =
                  isChatView &&
                  activeChatChannel.type === 'group' &&
                  activeChatChannel.projectId === ws.id;
                const wsMsgs = allMessages.filter((m) => m.sessionId === ws.id);
                const lastMsg = wsMsgs[wsMsgs.length - 1];
                const wsTasks = allTasks.filter((t) => t.sessionId === ws.id);
                const reviewCount = wsTasks.filter((t) => t.status === 'review').length;
                const wsZone = ws.sourceZoneId ? zoneMap.get(ws.sourceZoneId) : undefined;

                return (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => {
                      onSelectProjectChat(ws.id);
                      onCloseMobile();
                    }}
                    className={`w-full text-left p-2.5 rounded-xl border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-white border-slate-300 shadow-2xs'
                        : 'border-transparent hover:bg-white/80'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5">
                        <EntityAvatar kind="group" title="项目群" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {ws.name}
                          </span>
                          <span className="text-[10px] font-mono tabular-nums text-slate-400 shrink-0">
                            {lastMsg?.timestamp || ''}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-1.5 text-[11px]">
                          <span className="text-slate-600 font-medium truncate">
                            {wsZone ? `${wsZone.shortCode}·${wsZone.name}` : '个人项目'} ·{' '}
                            {wsTasks.length} 卡
                          </span>
                          {reviewCount > 0 && (
                            <span className="font-mono tabular-nums font-semibold text-amber-700 shrink-0">
                              {reviewCount} 待验证
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500 truncate">
                          {lastMsg
                            ? `${displayEntityName(lastMsg.senderHandle)}: ${lastMsg.content}`
                            : ws.goal}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}

              {/* 3. Direct 1v1 Chats with Agents (and their Human Owners) */}
              {negotiations.map((thread) => {
                const dmAgent = agentMap.get(thread.agentId);
                if (!dmAgent) return null;
                const isSelected =
                  isChatView &&
                  activeChatChannel.type === 'dm' &&
                  activeChatChannel.agentId === thread.agentId;
                const lastDm = thread.messages[thread.messages.length - 1];
                const st = DM_STATUS_LABEL[thread.status];

                return (
                  <button
                    key={thread.agentId}
                    type="button"
                    onClick={() => {
                      onSelectDm(thread.agentId);
                      onCloseMobile();
                    }}
                    className={`w-full text-left p-2.5 rounded-xl border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-white border-slate-300 shadow-2xs'
                        : 'border-transparent hover:bg-white/80'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5">
                        <EntityAvatar
                          kind="agent"
                          code={dmAgent.avatarCode}
                          accent={dmAgent.avatarAccent}
                          title={`Agent 节点 · 归属专家 ${dmAgent.ownerHumanName || '社区认证'}`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <AgentIdentityName
                            name={dmAgent.handle}
                            runtime={dmAgent.runtimeAgent}
                            model={dmAgent.defaultModel}
                            className="text-xs font-bold text-slate-900"
                          />
                          <span className="text-[10px] font-mono tabular-nums text-slate-400 shrink-0">
                            {lastDm?.timestamp || thread.updatedAt}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-1.5 text-[11px]">
                          <span className="text-slate-500 truncate">
                            {dmAgent.ownerHumanName
                              ? `归属专家：${dmAgent.ownerHumanName}`
                              : dmAgent.name}
                          </span>
                          <span className={`shrink-0 whitespace-nowrap ${st.cls}`}>
                            {st.text}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500 truncate">
                          {lastDm?.content || thread.scopeNote}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </>
          ) : (
            /* Agent Task Execution Sessions: each item corresponds to one Agent's task session */
            sortedTaskSessions.map((task) => {
              const isSelected =
                isChatView &&
                activeChatChannel.type === 'task_session' &&
                activeChatChannel.taskId === task.id;
              const agent = agentMap.get(task.assigneeId);
              const proj = workspaceMap.get(task.sessionId);
              const turns = taskSessions[task.id] || [];
              const lastTurn = turns[turns.length - 1];
              const isWaiting = Boolean(
                task.status !== 'done' && lastTurn?.awaitingConfirmation,
              );
              const st = WORK_STATUS_META[task.status];

              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => {
                    onSelectTaskSession(task.id);
                    onCloseMobile();
                  }}
                  className={`w-full text-left p-2.5 rounded-xl border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-white border-slate-300 shadow-2xs'
                      : 'border-transparent hover:bg-white/80'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5">
                      <EntityAvatar
                        kind="agent"
                        code={agent?.avatarCode || 'AI'}
                        accent={agent?.avatarAccent || '#334155'}
                        sessionCorner
                        title={`${displayEntityName(task.assigneeHandle)} 执行 Session`}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <AgentIdentityName
                          name={task.assigneeHandle}
                          runtime={agent?.runtimeAgent}
                          model={agent?.defaultModel}
                          className="text-xs font-bold text-slate-900"
                        />
                        <span className="text-[10px] font-mono tabular-nums text-slate-400 shrink-0">
                          {lastTurn?.timestamp || task.updatedAt}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-1.5 text-[11px]">
                        <span className="text-slate-700 font-medium truncate">
                          {task.title}
                        </span>
                        <span
                          className={`font-semibold shrink-0 whitespace-nowrap ${
                            isWaiting ? 'text-blue-700' : st.textCls
                          }`}
                        >
                          {isWaiting ? '待确认' : st.label}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-500 min-w-0">
                        <span className="font-mono text-slate-400 shrink-0">#{task.id}</span>
                        {agent?.defaultModel && (
                          <>
                            <span className="text-slate-300 shrink-0" aria-hidden="true">·</span>
                            <span className="font-mono text-slate-500 shrink-0">
                              {formatShortModel(agent.defaultModel)}
                            </span>
                          </>
                        )}
                        {proj && (
                          <>
                            <span className="text-slate-300 shrink-0" aria-hidden="true">·</span>
                            <span className="truncate">{proj.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Bottom-Left Pinned AgentNexus Account Login Footer */}
      <AccountFooter account={account} onOpenLogin={onOpenLogin} onLogout={onLogout} />
    </div>
  );

  const handleRailRegularChat = () => {
    setModeTab('regular');
    if (activeChatChannel.type === 'group') {
      onSelectProjectChat(activeChatChannel.projectId);
    } else if (activeChatChannel.type === 'dm') {
      onSelectDm(activeChatChannel.agentId);
    } else if (activeChatChannel.type === 'assistant') {
      onSelectAssistant();
    } else if (workspaces[0]) {
      onSelectProjectChat(workspaces[0].id);
    } else {
      onSelectAssistant();
    }
  };

  const handleRailTaskSessions = () => {
    setModeTab('task_session');
    if (activeChatChannel.type === 'task_session') {
      onSelectView('chat');
      return;
    }
    const firstTask = sortedTaskSessions[0];
    if (firstTask) {
      onSelectTaskSession(firstTask.id);
    } else {
      onSelectView('chat');
    }
  };

  const collapsedRail = (
    <div className="h-full flex flex-col items-center bg-slate-50 border-r border-slate-200 select-none">
      {/* Top Expand Toggle matching TopHeader height */}
      <div className="h-14 w-full border-b border-slate-200/80 bg-white flex items-center justify-center shrink-0">
        <button
          type="button"
          onClick={onToggleCollapse}
          title="展开左侧栏"
          aria-label="展开左侧栏"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>
      </div>

      {/* Primary Workspace Nav Icons */}
      <nav aria-label="快捷导航" className="py-3 flex flex-col items-center gap-1.5 w-full px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectView(item.id)}
              title={item.count ? `${item.label}（${item.count}）` : item.label}
              aria-label={item.label}
              className={`relative w-10 h-10 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                active
                  ? 'bg-slate-900 text-sky-300 shadow-2xs'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-200/80'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.highlight && !active && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-slate-50" />
              )}
            </button>
          );
        })}

        <div className="w-6 h-px bg-slate-200 my-1.5" aria-hidden="true" />

        {/* Chat Mode Shortcuts */}
        <button
          type="button"
          onClick={handleRailRegularChat}
          title={`消息会话（${regularTotalCount}）`}
          aria-label="消息会话"
          className={`relative w-10 h-10 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
            isChatView && activeChatChannel.type !== 'task_session'
              ? 'bg-slate-900 text-sky-300 shadow-2xs'
              : 'text-slate-600 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-200/80'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          {assistantPendingCount > 0 && !(isChatView && activeChatChannel.type !== 'task_session') && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-slate-50" />
          )}
        </button>

        <button
          type="button"
          onClick={handleRailTaskSessions}
          title={`Agent 任务（${allTasks.length} 个 Session）`}
          aria-label="Agent 任务"
          className={`relative w-10 h-10 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
            isChatView && activeChatChannel.type === 'task_session'
              ? 'bg-slate-900 text-sky-300 shadow-2xs'
              : 'text-slate-600 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-200/80'
          }`}
        >
          <MessageSquareCode className="w-4 h-4" />
          {awaitingTaskSessionCount > 0 &&
            !(isChatView && activeChatChannel.type === 'task_session') && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-slate-50" />
            )}
        </button>
      </nav>

      {/* Bottom Compact Account Button */}
      <div className="mt-auto w-full py-3 border-t border-slate-200 bg-white flex items-center justify-center shrink-0">
        {account ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            title={`${account.name} · 点击展开左侧栏查看账号`}
            aria-label="展开查看账号信息"
            className="w-9 h-9 rounded-lg bg-slate-900 text-sky-300 flex items-center justify-center text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {account.avatarInitials}
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenLogin}
            title="登录 AgentNexus 账号"
            aria-label="登录账号"
            className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={`hidden lg:block shrink-0 h-full transition-[width] duration-200 ease-out overflow-hidden ${
          collapsed ? 'w-[60px]' : 'w-[276px]'
        }`}
      >
        {collapsed ? collapsedRail : sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/35"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-[288px] max-w-[85vw] h-full shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
