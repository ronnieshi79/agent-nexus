import { useMemo, useState, type FormEvent } from 'react';
import {
  Bot,
  Compass,
  FolderKanban,
  Handshake,
  KanbanSquare,
  Plus,
  Store,
  Users,
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
  NegotiationStatus,
  NegotiationThread,
  ProjectWorkspace,
  WorkflowTask,
} from '../../types/agentnexus';
import { AccountFooter } from '../account/AccountPanel';

interface SidebarProps {
  zones: CommunityZone[];
  activeView: NavViewId;
  activeChatChannel: ActiveChatChannel;
  workspaces: ProjectWorkspace[];
  agents: ExpertAgent[];
  allMessages: ChatMessage[];
  allTasks: WorkflowTask[];
  negotiations: NegotiationThread[];
  assistantMessages: AssistantMessage[];
  assistantPendingCount: number;
  reviewTaskCount: number;
  hiredCount: number;
  privateCount: number;
  marketCount: number;
  discoverCount: number;
  account: AgentNexusAccount | null;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onSelectView: (v: NavViewId) => void;
  onOpenAssistant: () => void;
  onSelectProjectChat: (projectId: string) => void;
  onSelectDmChat: (agentId: string) => void;
  onCreateProject: (name: string, goal: string) => void;
  onStartNegotiation: (agentId: string) => void;
  onOpenLogin: () => void;
  onLogout: () => void;
}

type ChannelFilter = 'all' | 'group' | 'dm' | 'assistant';

const NEG_STATUS_SHORT: Record<NegotiationStatus, { label: string; cls: string }> = {
  negotiating: { label: '洽谈中', cls: 'text-slate-500' },
  quoted: { label: '已报价', cls: 'text-amber-700' },
  hired: { label: '已雇佣', cls: 'text-emerald-700' },
};

export function Sidebar({
  zones,
  activeView,
  activeChatChannel,
  workspaces,
  agents,
  allMessages,
  allTasks,
  negotiations,
  assistantMessages,
  assistantPendingCount,
  reviewTaskCount,
  hiredCount,
  privateCount,
  marketCount,
  discoverCount,
  account,
  mobileOpen,
  onCloseMobile,
  onSelectView,
  onOpenAssistant,
  onSelectProjectChat,
  onSelectDmChat,
  onCreateProject,
  onStartNegotiation,
  onOpenLogin,
  onLogout,
}: SidebarProps) {
  const [filter, setFilter] = useState<ChannelFilter>('all');
  const [createMode, setCreateMode] = useState<'none' | 'project' | 'dm'>('none');
  const [newName, setNewName] = useState('');
  const [newGoal, setNewGoal] = useState('');

  const zoneMap = useMemo(() => {
    const map = new Map<string, CommunityZone>();
    zones.forEach((z) => map.set(z.id, z));
    return map;
  }, [zones]);

  const availableExternalAgents = useMemo(() => {
    const existingIds = new Set(negotiations.map((n) => n.agentId));
    return agents.filter((a) => a.isListedInMarket && !existingIds.has(a.id));
  }, [agents, negotiations]);

  const lastAssistantMsg = assistantMessages[assistantMessages.length - 1];

  const handleCreateProject = (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onCreateProject(newName, newGoal);
    setNewName('');
    setNewGoal('');
    setCreateMode('none');
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
      id: 'kanban',
      label: '工作看板',
      icon: KanbanSquare,
      count: reviewTaskCount > 0 ? `${reviewTaskCount} 待验收` : `${workspaces.length} 项目`,
      highlight: reviewTaskCount > 0,
    },
    {
      id: 'team',
      label: '我的团队',
      icon: Users,
      count: `${hiredCount}+${privateCount}`,
    },
    {
      id: 'market',
      label: '专家市场',
      icon: Store,
      count: `${marketCount}`,
    },
    {
      id: 'discover',
      label: '社区发现',
      icon: Compass,
      count: `${discoverCount} 项目`,
    },
  ];

  const isChatView = activeView === 'chat';

  const sidebarContent = (
    <div className="h-full flex flex-col bg-slate-50 border-r border-slate-200 select-none">
      {/* Platform Brand Header */}
      <div className="px-4 py-3.5 border-b border-slate-200/80 shrink-0 bg-white flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-display text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap leading-none">
            AgentNexus
          </div>
          <div className="text-[11px] font-medium text-slate-500 mt-1 truncate">
            Agents 协作网络
          </div>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-1 rounded-lg text-slate-500 hover:bg-slate-200/60 cursor-pointer"
          aria-label="关闭侧边栏"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Top Workspace Navigation: 3 Clean 4-Char Menus (Work Board / My Team / Expert Market) */}
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

      {/* Lower Primary Section: Unified Chat Conversations (Platform Assistant / Project Groups / Direct Negotiations) */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="px-3 pt-3 pb-2 space-y-2 shrink-0">
          <div className="flex items-center justify-between gap-2 px-0.5">
            <span className="text-xs font-bold text-slate-700">聊天会话</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  setCreateMode((m) => (m === 'project' ? 'none' : 'project'))
                }
                title="新建项目群聊"
                className={`inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                  createMode === 'project'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <Plus className="w-3 h-3" />
                <span>项目群</span>
              </button>
              <button
                type="button"
                onClick={() => setCreateMode((m) => (m === 'dm' ? 'none' : 'dm'))}
                title="发起外部专家私聊协商"
                className={`inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                  createMode === 'dm'
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-50 hover:bg-blue-100 text-blue-700'
                }`}
              >
                <Plus className="w-3 h-3" />
                <span>私聊</span>
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="grid grid-cols-4 gap-0.5 p-0.5 bg-slate-200/70 rounded-lg">
            {(
              [
                { id: 'all', label: '全部' },
                { id: 'group', label: '项目群' },
                { id: 'dm', label: '私聊' },
                { id: 'assistant', label: '助理' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                  filter === tab.id
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Inline Create Project Group Form */}
          {createMode === 'project' && (
            <form
              onSubmit={handleCreateProject}
              className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-700">新建项目群聊</span>
                <button
                  type="button"
                  onClick={() => setCreateMode('none')}
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
                placeholder="输入项目名称..."
                className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-600/20"
              />
              <input
                type="text"
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                placeholder="项目目标（可选）"
                className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-600/20"
              />
              <button
                type="submit"
                className="w-full py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
              >
                创建项目群
              </button>
            </form>
          )}

          {/* Inline Start External Expert DM Picker */}
          {createMode === 'dm' && (
            <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-700 truncate">
                  选择各专区外部专家私聊
                </span>
                <button
                  type="button"
                  onClick={() => setCreateMode('none')}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {availableExternalAgents.length === 0 ? (
                <div className="text-[11px] text-slate-500 py-1">
                  所有市场专家均已在私聊列表中。
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto clean-scroll space-y-1">
                  {availableExternalAgents.map((a) => {
                    const zName = a.primaryZoneId
                      ? zoneMap.get(a.primaryZoneId)?.name
                      : undefined;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => {
                          onStartNegotiation(a.id);
                          setCreateMode('none');
                          onCloseMobile();
                        }}
                        className="w-full text-left px-2 py-1.5 rounded-md bg-slate-50 hover:bg-blue-50/70 border border-slate-200/70 flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-slate-800 truncate">
                            {a.handle}
                          </div>
                          {zName && (
                            <div className="text-[10px] text-slate-400 truncate">{zName}</div>
                          )}
                        </div>
                        <span className="text-[11px] font-mono tabular-nums text-slate-500 shrink-0">
                          ${a.projectPriceUsd.toLocaleString('en-US')}/项目
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Scrollable Unified Chat Threads List (Project Groups First -> Direct Negotiations -> Platform Assistant) */}
        <div className="flex-1 overflow-y-auto clean-scroll px-2.5 pb-3 space-y-1">
          {/* 1. Project Group Chat Threads (Core Multi-Agent Collaboration) */}
          {(filter === 'all' || filter === 'group') &&
            workspaces.map((ws) => {
              const isSelected =
                isChatView &&
                activeChatChannel.type === 'group' &&
                activeChatChannel.projectId === ws.id;
              const wsMsgs = allMessages.filter((m) => m.sessionId === ws.id);
              const lastMsg = wsMsgs[wsMsgs.length - 1];
              const wsTasks = allTasks.filter((t) => t.sessionId === ws.id);
              const reviewCount = wsTasks.filter((t) => t.status === 'review').length;

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
                    <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                      <FolderKanban className="w-4 h-4" />
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
                          {ws.role === 'participating' ? '参与' : '主管'} · {wsTasks.length} 卡
                        </span>
                        {reviewCount > 0 && (
                          <span className="font-mono tabular-nums font-semibold text-amber-700 shrink-0">
                            {reviewCount} 待验收
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500 truncate">
                        {lastMsg ? `${lastMsg.senderHandle}: ${lastMsg.content}` : ws.goal}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}

          {/* 2. External Expert Private Negotiation Threads */}
          {(filter === 'all' || filter === 'dm') &&
            negotiations.map((thread) => {
              const agent = agents.find((a) => a.id === thread.agentId);
              if (!agent) return null;
              const isSelected =
                isChatView &&
                activeChatChannel.type === 'dm' &&
                activeChatChannel.agentId === thread.agentId;
              const lastMsg = thread.messages[thread.messages.length - 1];
              const st = NEG_STATUS_SHORT[thread.status];

              return (
                <button
                  key={thread.agentId}
                  type="button"
                  onClick={() => {
                    onSelectDmChat(thread.agentId);
                    onCloseMobile();
                  }}
                  className={`w-full text-left p-2.5 rounded-xl border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-white border-slate-300 shadow-2xs'
                      : 'border-transparent hover:bg-white/80'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0 mt-0.5"
                      style={{ backgroundColor: agent.avatarAccent }}
                    >
                      {agent.avatarCode}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {agent.handle}
                        </span>
                        <span className="text-[10px] font-mono tabular-nums text-slate-400 shrink-0">
                          {thread.updatedAt}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-1.5 text-[11px]">
                        <span className="inline-flex items-center gap-1 text-indigo-700 font-medium shrink-0">
                          <Handshake className="w-3 h-3" />
                          <span>私聊</span>
                        </span>
                        <span className={`font-semibold font-mono tabular-nums truncate ${st.cls}`}>
                          {st.label} · ${Math.round(thread.negotiatedPriceUsd).toLocaleString('en-US')}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500 truncate">
                        {lastMsg ? lastMsg.content : thread.scopeNote}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}

          {/* 3. Platform Assistant Thread (Nexa) placed below core project & DM chats */}
          {(filter === 'all' || filter === 'assistant') && (
            <button
              type="button"
              onClick={() => {
                onOpenAssistant();
                onCloseMobile();
              }}
              className={`w-full text-left p-2.5 rounded-xl border transition-colors cursor-pointer ${
                isChatView && activeChatChannel.type === 'assistant'
                  ? 'bg-white border-slate-300 shadow-2xs'
                  : 'border-transparent hover:bg-white/80'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-900 text-sky-300 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-bold text-slate-900 truncate">
                      Nexa 平台助理
                    </span>
                    <span className="text-[10px] font-mono tabular-nums text-slate-400 shrink-0">
                      {lastAssistantMsg?.timestamp || '刚刚'}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-1.5 text-[11px]">
                    <span className="font-semibold text-blue-700 truncate">
                      平台助理 · 结算/审计
                    </span>
                    {assistantPendingCount > 0 && (
                      <span className="font-mono tabular-nums font-semibold text-amber-700 shrink-0">
                        {assistantPendingCount} 提醒
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 truncate">
                    {lastAssistantMsg?.content || '结算对账、接单与审计提醒'}
                  </p>
                </div>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Bottom-Left Pinned AgentNexus Account Login Footer */}
      <AccountFooter account={account} onOpenLogin={onOpenLogin} onLogout={onLogout} />
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-[276px] shrink-0 h-full">
        {sidebarContent}
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
