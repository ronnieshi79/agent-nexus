import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeftRight,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Compass,
  FolderKanban,
  FolderPlus,
  ListFilter,
  LogIn,
  MessageSquare,
  MessageSquareCode,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Shapes,
  UserPlus,
  X,
} from 'lucide-react';
import type { CreateWorkCardInput } from '../../hooks/useAgentNexusStore';
import type {
  ActiveChatChannel,
  AgentNexusAccount,
  AssistantMessage,
  ChatMessage,
  CommunityZone,
  ConversationInteractionMode,
  ExpertAgent,
  HumanDirectThread,
  HumanExpert,
  NavViewId,
  NegotiationThread,
  ProjectWorkspace,
  TaskSessionMessage,
  TaskStatus,
  WorkCardType,
  WorkflowTask,
} from '../../types/agentnexus';
import { AccountFooter } from '../account/AccountPanel';
import {
  AgentIdentityName,
  DOMAIN_CATEGORY_LABELS,
  EntityAvatar,
  PRINCIPAL_ROLE_META,
  displayEntityName,
  formatAgentDisplayName,
} from '../shared/EntityIdentity';
import { ModalShell } from '../shared/UiPrimitives';
import { RailBrandBackdrop } from '../shared/ViewToolbar';
import { WORK_STATUS_META } from '../workcard/WorkCardFlow';

interface SidebarProps {
  activeView: NavViewId;
  activeChatChannel: ActiveChatChannel;
  conversationMode: ConversationInteractionMode;
  zones: CommunityZone[];
  workspaces: ProjectWorkspace[];
  agents: ExpertAgent[];
  humanExperts: HumanExpert[];
  allMessages: ChatMessage[];
  allTasks: WorkflowTask[];
  taskSessions: Record<string, TaskSessionMessage[]>;
  negotiations: NegotiationThread[];
  humanDmThreads: HumanDirectThread[];
  assistantMessages: AssistantMessage[];
  assistantPendingCount: number;
  awaitingTaskSessionCount: number;
  artifactCount: number;
  hiredCount: number;
  privateCount: number;
  account: AgentNexusAccount | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onSelectView: (v: NavViewId) => void;
  onSelectProjectChat: (projectId: string) => void;
  onSelectDm: (agentId: string) => void;
  onSelectHumanDm: (expertId: string) => void;
  onSelectAssistant: () => void;
  onSelectTaskSession: (taskId: string) => void;
  onCreateAndOpenTaskSession: (input: CreateWorkCardInput) => void;
  onCreateProject: (name: string, goal: string, sourceZoneId?: string) => void;
  onOpenNewSessionLauncher: () => void;
  onSwitchConversationMode: (mode: ConversationInteractionMode) => void;
  onOpenLogin: () => void;
  onLogout: () => void;
}

type TaskGroupBy = 'agent' | 'project' | 'none';
type TaskSortBy = 'last_updated' | 'attention' | 'status';
type TaskStatusFilter = 'all' | TaskStatus;
type HeaderDropdownMenu = 'none' | 'filter' | 'create';
type PopoverSubMenu = 'none' | 'group' | 'sort' | 'filter';

const DM_STATUS_LABEL: Record<NegotiationThread['status'], { text: string; cls: string }> = {
  negotiating: { text: '协商中', cls: 'text-slate-500' },
  quoted: { text: '待确认报价', cls: 'text-amber-700 font-semibold' },
  hired: { text: '已雇佣', cls: 'text-emerald-700 font-semibold' },
};

const GROUP_BY_LABELS: Record<TaskGroupBy, string> = {
  agent: '按 Agent',
  project: '按项目',
  none: '不分组（时间流）',
};

const SORT_BY_LABELS: Record<TaskSortBy, string> = {
  last_updated: '最近更新',
  attention: '待确认优先',
  status: '按状态',
};

const STATUS_FILTER_LABELS: Record<TaskStatusFilter, string> = {
  all: '全部状态',
  in_progress: '执行中',
  review: '待验证',
  pending: '待批准',
  done: '已完成',
};

/** Parse HH:MM / 刚刚 / 今天 HH:MM into a comparable descending rank */
function parseTimeRank(ts?: string): number {
  if (!ts) return 0;
  const trimmed = ts.trim();
  if (trimmed.includes('刚刚')) return 9999;
  const match = trimmed.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    return Number(match[1]) * 60 + Number(match[2]);
  }
  return 100;
}

type UnifiedChatItem =
  | {
      kind: 'assistant';
      key: string;
      timeRank: number;
      timestamp: string;
    }
  | {
      kind: 'group';
      key: string;
      workspace: ProjectWorkspace;
      lastMsg?: ChatMessage;
      taskCount: number;
      reviewCount: number;
      timeRank: number;
      timestamp: string;
    }
  | {
      kind: 'human_dm';
      key: string;
      thread: HumanDirectThread;
      expert: HumanExpert;
      timeRank: number;
      timestamp: string;
    }
  | {
      kind: 'agent_dm';
      key: string;
      thread: NegotiationThread;
      agent: ExpertAgent;
      timeRank: number;
      timestamp: string;
    };

export function Sidebar({
  activeView,
  activeChatChannel,
  conversationMode,
  zones,
  workspaces,
  agents,
  humanExperts,
  allMessages,
  allTasks,
  taskSessions,
  negotiations,
  humanDmThreads,
  assistantMessages,
  assistantPendingCount,
  awaitingTaskSessionCount,
  artifactCount,
  hiredCount,
  privateCount,
  account,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  onSelectView,
  onSelectProjectChat,
  onSelectDm,
  onSelectHumanDm,
  onSelectAssistant,
  onSelectTaskSession,
  onCreateAndOpenTaskSession,
  onCreateProject,
  onOpenNewSessionLauncher,
  onSwitchConversationMode,
  onOpenLogin,
  onLogout,
}: SidebarProps) {
  // Unified inline drawers triggered from the conversation header create menu
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showDmPicker, setShowDmPicker] = useState(false);
  const [dmPickerTab, setDmPickerTab] = useState<'human' | 'agent'>('human');
  const [newName, setNewName] = useState('');
  const [newGoal, setNewGoal] = useState('');
  const [newSourceZoneId, setNewSourceZoneId] = useState<string>('');

  // Task mode (Codex / Antigravity style) filter, group, sort & new task state
  const [taskGroupBy, setTaskGroupBy] = useState<TaskGroupBy>('project');
  const [taskSortBy, setTaskSortBy] = useState<TaskSortBy>('last_updated');
  const [taskStatusFilter, setTaskStatusFilter] = useState<TaskStatusFilter>('all');
  const [onlyWaitingConfirm, setOnlyWaitingConfirm] = useState(false);
  const [hideDoneTasks, setHideDoneTasks] = useState(false);

  // Unified header dropdown menu state (mode switch | filter/group | create actions)
  const [openHeaderMenu, setOpenHeaderMenu] = useState<HeaderDropdownMenu>('none');
  const [activeSubMenu, setActiveSubMenu] = useState<PopoverSubMenu>('none');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const headerMenuRef = useRef<HTMLDivElement | null>(null);

  // New Task Session inline drawer (global or scoped to a specific Agent/Project)
  const [showNewTaskDrawer, setShowNewTaskDrawer] = useState(false);
  const [quickTaskProjectId, setQuickTaskProjectId] = useState<string>(workspaces[0]?.id || '');
  const [quickTaskAgentId, setQuickTaskAgentId] = useState<string>(agents[0]?.id || '');
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [quickTaskType, setQuickTaskType] = useState<WorkCardType>('development');

  // Close header dropdown popover on outside click
  useEffect(() => {
    if (openHeaderMenu === 'none') return;
    const handleOutside = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setOpenHeaderMenu('none');
        setActiveSubMenu('none');
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [openHeaderMenu]);

  const zoneMap = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);
  const workspaceMap = useMemo(() => new Map(workspaces.map((w) => [w.id, w])), [workspaces]);
  const agentMap = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);
  const humanMap = useMemo(() => new Map(humanExperts.map((h) => [h.id, h])), [humanExperts]);

  const availableDmAgents = useMemo(() => {
    const existingIds = new Set(negotiations.map((n) => n.agentId));
    return agents.filter((a) => !existingIds.has(a.id));
  }, [agents, negotiations]);

  const availableDmHumans = useMemo(() => {
    const existingIds = new Set(humanDmThreads.map((t) => t.expertId));
    return humanExperts.filter((h) => !h.isCurrentUser && !existingIds.has(h.id));
  }, [humanDmThreads, humanExperts]);

  const lastAssistantMsg = assistantMessages[assistantMessages.length - 1];

  // Mode 1 (对话模式): WeChat-style unified chronological event stream — NO category headers!
  const unifiedChatStream = useMemo<UnifiedChatItem[]>(() => {
    const items: UnifiedChatItem[] = [];

    // 1. Nexa Assistant
    const assistTs = lastAssistantMsg?.timestamp || '09:00';
    items.push({
      kind: 'assistant',
      key: 'assistant',
      timestamp: assistTs,
      timeRank: parseTimeRank(assistTs),
    });

    // 2. Project Groups
    workspaces.forEach((ws, idx) => {
      const wsMsgs = allMessages.filter((m) => m.sessionId === ws.id);
      const lastMsg = wsMsgs[wsMsgs.length - 1];
      const wsTasks = allTasks.filter((t) => t.sessionId === ws.id);
      const reviewCount = wsTasks.filter((t) => t.status === 'review').length;
      const ts = lastMsg?.timestamp || '';
      items.push({
        kind: 'group',
        key: `group:${ws.id}`,
        workspace: ws,
        lastMsg,
        taskCount: wsTasks.length,
        reviewCount,
        timestamp: ts,
        timeRank: ts ? parseTimeRank(ts) : Math.max(1, 50 - idx),
      });
    });

    // 3. Human Expert 1v1 Chats
    humanDmThreads.forEach((thread) => {
      const expert = humanMap.get(thread.expertId);
      if (!expert) return;
      const lastMsg = thread.messages[thread.messages.length - 1];
      const ts = lastMsg?.timestamp || thread.updatedAt;
      items.push({
        kind: 'human_dm',
        key: `human_dm:${thread.expertId}`,
        thread,
        expert,
        timestamp: ts,
        timeRank: parseTimeRank(ts),
      });
    });

    // 4. Agent 1v1 Chats
    negotiations.forEach((thread) => {
      const dmAgent = agentMap.get(thread.agentId);
      if (!dmAgent) return;
      const lastDm = thread.messages[thread.messages.length - 1];
      const ts = lastDm?.timestamp || thread.updatedAt;
      items.push({
        kind: 'agent_dm',
        key: `agent_dm:${thread.agentId}`,
        thread,
        agent: dmAgent,
        timestamp: ts,
        timeRank: parseTimeRank(ts),
      });
    });

    return items.sort((a, b) => b.timeRank - a.timeRank);
  }, [
    agentMap,
    allMessages,
    allTasks,
    humanDmThreads,
    humanMap,
    lastAssistantMsg?.timestamp,
    negotiations,
    workspaces,
  ]);

  // Mode 2 (任务模式): Codex / Antigravity filtered & sorted task list
  const filteredAndSortedTasks = useMemo(() => {
    const statusWeight: Record<TaskStatus, number> = {
      in_progress: 0,
      review: 1,
      pending: 2,
      done: 3,
    };

    const list = allTasks.filter((t) => {
      if (hideDoneTasks && t.status === 'done') return false;
      if (taskStatusFilter !== 'all' && t.status !== taskStatusFilter) return false;
      if (onlyWaitingConfirm) {
        const turns = taskSessions[t.id] || [];
        const isWait = t.status !== 'done' && Boolean(turns[turns.length - 1]?.awaitingConfirmation);
        if (!isWait) return false;
      }
      return true;
    });

    const getTaskTimeRank = (t: WorkflowTask) => {
      const turns = taskSessions[t.id] || [];
      const lastTs = turns[turns.length - 1]?.timestamp || t.updatedAt;
      return parseTimeRank(lastTs);
    };

    return [...list].sort((a, b) => {
      if (taskSortBy === 'last_updated') {
        const diff = getTaskTimeRank(b) - getTaskTimeRank(a);
        if (diff !== 0) return diff;
        return statusWeight[a.status] - statusWeight[b.status];
      }
      if (taskSortBy === 'attention') {
        const aTurns = taskSessions[a.id] || [];
        const bTurns = taskSessions[b.id] || [];
        const aWait = a.status !== 'done' && aTurns[aTurns.length - 1]?.awaitingConfirmation ? 0 : 1;
        const bWait = b.status !== 'done' && bTurns[bTurns.length - 1]?.awaitingConfirmation ? 0 : 1;
        if (aWait !== bWait) return aWait - bWait;
        if (statusWeight[a.status] !== statusWeight[b.status]) {
          return statusWeight[a.status] - statusWeight[b.status];
        }
        return getTaskTimeRank(b) - getTaskTimeRank(a);
      }
      // status
      if (statusWeight[a.status] !== statusWeight[b.status]) {
        return statusWeight[a.status] - statusWeight[b.status];
      }
      return getTaskTimeRank(b) - getTaskTimeRank(a);
    });
  }, [allTasks, hideDoneTasks, onlyWaitingConfirm, taskSessions, taskSortBy, taskStatusFilter]);

  const tasksGroupedByAgent = useMemo(() => {
    const map = new Map<string, WorkflowTask[]>();
    filteredAndSortedTasks.forEach((task) => {
      const list = map.get(task.assigneeId) || [];
      list.push(task);
      map.set(task.assigneeId, list);
    });
    return Array.from(map.entries()).map(([agentId, tasks]) => {
      const agent = agentMap.get(agentId);
      const distinctProjects = new Set(tasks.map((t) => t.sessionId)).size;
      return {
        agentId,
        agent,
        handle: agent?.handle || tasks[0]?.assigneeHandle || '@Agent',
        tasks,
        distinctProjects,
      };
    });
  }, [agentMap, filteredAndSortedTasks]);

  const tasksGroupedByProject = useMemo(() => {
    const map = new Map<string, WorkflowTask[]>();
    filteredAndSortedTasks.forEach((task) => {
      const list = map.get(task.sessionId) || [];
      list.push(task);
      map.set(task.sessionId, list);
    });
    return Array.from(map.entries()).map(([projectId, tasks]) => ({
      projectId,
      workspace: workspaceMap.get(projectId),
      tasks,
    }));
  }, [filteredAndSortedTasks, workspaceMap]);

  const hasActiveTaskFilter =
    taskStatusFilter !== 'all' || onlyWaitingConfirm || hideDoneTasks;

  const handleResetTaskView = () => {
    setTaskGroupBy('project');
    setTaskSortBy('last_updated');
    setTaskStatusFilter('all');
    setOnlyWaitingConfirm(false);
    setHideDoneTasks(false);
    setOpenHeaderMenu('none');
    setActiveSubMenu('none');
  };

  const handleSelectMode = (nextMode: ConversationInteractionMode) => {
    setOpenHeaderMenu('none');
    setActiveSubMenu('none');
    setShowCreateProject(false);
    setShowDmPicker(false);
    setShowNewTaskDrawer(false);
    onSwitchConversationMode(nextMode);
  };

  const handleCreateProject = (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onCreateProject(newName, newGoal, newSourceZoneId || undefined);
    setNewName('');
    setNewGoal('');
    setNewSourceZoneId('');
    setShowCreateProject(false);
    onCloseMobile();
  };

  const handleOpenNewTaskDrawer = (preset?: { projectId?: string; agentId?: string }) => {
    setQuickTaskProjectId(preset?.projectId || workspaces[0]?.id || '');
    setQuickTaskAgentId(preset?.agentId || agents[0]?.id || '');
    setShowNewTaskDrawer(true);
    setShowCreateProject(false);
    setShowDmPicker(false);
    setOpenHeaderMenu('none');
    setActiveSubMenu('none');
  };

  const handleQuickCreateTask = (e: FormEvent) => {
    e.preventDefault();
    if (!quickTaskTitle.trim()) return;
    onCreateAndOpenTaskSession({
      sessionId: quickTaskProjectId || workspaces[0]?.id || '',
      featureModule: '专项任务',
      workType: quickTaskType,
      title: quickTaskTitle.trim(),
      description: '在任务模式中直接发起的单 Agent 专项任务 Session。',
      assigneeId: quickTaskAgentId || agents[0]?.id || '',
      priority: '高',
    });
    setQuickTaskTitle('');
    setShowNewTaskDrawer(false);
    onCloseMobile();
  };

  const toggleGroupCollapse = (key: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const navItems: {
    id: Exclude<NavViewId, 'chat'>;
    label: string;
    icon: typeof Shapes;
    badge?: string;
    tooltip: string;
    highlight?: boolean;
    isInfra?: boolean;
  }[] = [
    {
      id: 'artifacts',
      label: 'Artifacts',
      icon: Shapes,
      badge: artifactCount > 0 ? `${artifactCount}` : undefined,
      tooltip: `Artifacts · 跨项目沉淀的文档、演示稿、设计与代码产出库（共 ${artifactCount} 份）`,
    },
    {
      id: 'team',
      label: 'AGN空间',
      icon: Bot,
      tooltip: `AGN空间 · Agent 团队与空间资源（${hiredCount} 外雇 · ${privateCount} 自建）`,
      isInfra: true,
    },
    {
      id: 'community',
      label: 'AGN社区',
      icon: Compass,
      tooltip: 'AGN社区 · FDE / OPC 专属的网络专业 Agent 团队',
    },
  ];

  const isChatView = activeView === 'chat';

  const renderTaskRow = (task: WorkflowTask, context: 'flat' | 'agent' | 'project') => {
    const isSelected =
      isChatView &&
      activeChatChannel.type === 'task_session' &&
      activeChatChannel.taskId === task.id;
    const agent = agentMap.get(task.assigneeId);
    const proj = workspaceMap.get(task.sessionId);
    const turns = taskSessions[task.id] || [];
    const lastTurn = turns[turns.length - 1];
    const displayTs = lastTurn?.timestamp || task.updatedAt;
    const isWaiting = Boolean(task.status !== 'done' && lastTurn?.awaitingConfirmation);
    const st = WORK_STATUS_META[task.status];

    return (
      <button
        key={task.id}
        type="button"
        onClick={() => {
          onSelectTaskSession(task.id);
          onCloseMobile();
        }}
        className={`w-full text-left px-3 py-3 rounded-lg transition-colors cursor-pointer space-y-2 ${
          isSelected
            ? 'bg-slate-200/80 text-slate-950'
            : 'bg-transparent hover:bg-slate-200/45 text-slate-700'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <span
            className={`text-[13px] leading-snug line-clamp-2 ${
              isSelected ? 'font-semibold text-slate-950' : 'font-medium text-slate-800'
            }`}
          >
            {task.title}
          </span>
          <span className="text-[10.5px] font-mono tabular-nums text-slate-400 shrink-0 mt-0.5">
            {displayTs}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 pt-0.5">
          <div className="flex items-center gap-1.5 min-w-0 truncate">
            {context !== 'agent' && (
              <span className="inline-flex items-center gap-1.5 min-w-0 truncate text-slate-600 font-medium">
                <span
                  className="w-4 h-4 rounded text-[9px] font-bold text-white inline-flex items-center justify-center shrink-0"
                  style={{ backgroundColor: agent?.avatarAccent || '#334155' }}
                >
                  {agent?.avatarCode?.slice(0, 1) || 'A'}
                </span>
                <AgentIdentityName
                  name={task.assigneeHandle}
                  runtime={agent?.runtimeAgent}
                  model={agent?.defaultModel}
                  className="font-medium text-slate-600"
                />
              </span>
            )}
            {context === 'flat' && proj && (
              <span className="text-slate-300 shrink-0" aria-hidden="true">
                ·
              </span>
            )}
            {context !== 'project' && proj && (
              <span className="truncate text-slate-500">{proj.name}</span>
            )}
          </div>
          <span
            className={`text-[11px] font-semibold shrink-0 whitespace-nowrap ${
              isWaiting ? 'text-blue-700' : st.textCls
            }`}
          >
            {isWaiting ? '待确认' : st.label}
          </span>
        </div>
      </button>
    );
  };

  const sidebarContent = (
    <div className="h-full flex flex-col bg-[#FAFAFA] border-r border-slate-200/80 select-none">
      {/* Platform Brand Header */}
      <div className="h-12 px-4 border-b border-slate-200/80 shrink-0 bg-[#FAFAFA] flex items-center justify-between gap-2">
        <div className="min-w-0 flex items-baseline gap-2">
          <div className="font-display text-[15px] font-extrabold tracking-tight text-slate-950 whitespace-nowrap leading-none">
            AgentNexus
          </div>
          <div className="text-[11px] font-medium text-slate-400 truncate">
            Agents 协作网络
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onToggleCollapse}
            title="收起左侧栏"
            aria-label="收起左侧栏"
            className="hidden lg:inline-flex items-center justify-center p-1.5 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1 rounded-md text-slate-500 hover:bg-slate-200/60 cursor-pointer"
            aria-label="关闭侧边栏"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Top Vertical Primary Navigation (starts with prominent '新会话') */}
      <div className="px-2 py-2 border-b border-slate-200/80 bg-[#FAFAFA] shrink-0">
        <nav aria-label="主导航" className="space-y-0.5">
          <button
            type="button"
            title="新会话 · 快速选择项目与专家 Agent 启动协作"
            onClick={() => {
              onOpenNewSessionLauncher();
              onCloseMobile();
            }}
            className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-[13px] transition-colors cursor-pointer ${
              isChatView && activeChatChannel.type === 'new_session'
                ? 'bg-slate-200/75 text-slate-950 font-semibold'
                : 'text-slate-700 font-medium hover:bg-slate-200/45 hover:text-slate-950'
            }`}
          >
            <span className="inline-flex items-center gap-2.5 min-w-0 truncate">
              <MessageSquarePlus
                className={`w-4 h-4 shrink-0 ${
                  isChatView && activeChatChannel.type === 'new_session'
                    ? 'text-blue-600'
                    : 'text-blue-600/85'
                }`}
              />
              <span className="truncate">新会话</span>
            </span>
          </button>

          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                title={item.tooltip}
                onClick={() => {
                  onSelectView(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-[13px] transition-colors cursor-pointer ${
                  active
                    ? 'bg-slate-200/75 text-slate-950 font-semibold'
                    : 'text-slate-600 font-medium hover:bg-slate-200/45 hover:text-slate-950'
                }`}
              >
                <span className="inline-flex items-center gap-2.5 min-w-0 truncate">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${active ? 'text-slate-900' : 'text-slate-400'}`}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.badge && (
                  <span
                    className={`text-[10px] shrink-0 ${
                      item.isInfra ? 'font-medium' : 'font-mono tabular-nums text-[11px]'
                    } ${
                      active
                        ? 'text-blue-700 font-semibold'
                        : item.highlight
                          ? 'text-blue-700 font-semibold'
                          : 'text-slate-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Lower Core Section: Single Active Interaction Mode (对话模式 OR 任务模式) with Figure-2 Icon Header */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Unified Conversation Header Row: Full Plain Label + Top-Right Icon Toolbar */}
        <div className="px-3 pt-3 pb-2 space-y-2 shrink-0 relative" ref={headerMenuRef}>
          <div className="flex items-center justify-between gap-1.5 px-0.5">
            {/* Full Non-Truncated Mode Title (No dropdown chevron) */}
            <div className="inline-flex items-center gap-1.5 min-w-0 whitespace-nowrap">
              <span className="text-xs font-semibold text-slate-600">
                {conversationMode === 'chat' ? '聊天对话' : '任务会话'}
              </span>
              <span className="font-mono tabular-nums text-[11px] font-normal text-slate-400">
                {conversationMode === 'chat'
                  ? unifiedChatStream.length
                  : filteredAndSortedTasks.length}
              </span>
            </div>

            {/* Right Minimal Icon Toolbar */}
            <div className="flex items-center gap-0.5 shrink-0">
              {/* 1. Direct One-Click Mode Switch Icon (No Dropdown) */}
              <div className="relative group/tip">
                <button
                  type="button"
                  onClick={() =>
                    handleSelectMode(conversationMode === 'chat' ? 'task' : 'chat')
                  }
                  aria-label={
                    conversationMode === 'chat' ? '切换至任务会话' : '切换至聊天对话'
                  }
                  className="relative p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-200/50 transition-colors cursor-pointer"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  {conversationMode === 'chat' && awaitingTaskSessionCount > 0 && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-blue-600" />
                  )}
                </button>
                <div className="pointer-events-none opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 absolute bottom-full mb-1.5 right-0 z-50 px-2 py-1 rounded-md bg-slate-900 text-white text-[11px] font-medium whitespace-nowrap shadow-md">
                  {conversationMode === 'chat' ? '切换至任务会话' : '切换至聊天对话'}
                </div>
              </div>

              {/* 2. Task Mode Filter / Group / Sort Icon */}
              {conversationMode === 'task' && (
                <div className="relative group/tip">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenHeaderMenu((cur) => (cur === 'filter' ? 'none' : 'filter'));
                      setActiveSubMenu('none');
                    }}
                    aria-label="分组、排序与筛选"
                    aria-expanded={openHeaderMenu === 'filter'}
                    className={`relative p-1.5 rounded-md transition-colors cursor-pointer ${
                      openHeaderMenu === 'filter' || hasActiveTaskFilter
                        ? 'bg-slate-200/80 text-slate-900'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                  >
                    <ListFilter className="w-3.5 h-3.5" />
                    {hasActiveTaskFilter && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-blue-600" />
                    )}
                  </button>
                  {openHeaderMenu !== 'filter' && (
                    <div className="pointer-events-none opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 absolute bottom-full mb-1.5 right-0 z-50 px-2 py-1 rounded-md bg-slate-900 text-white text-[11px] font-medium whitespace-nowrap shadow-md">
                      分组、排序与筛选
                    </div>
                  )}
                </div>
              )}

              {/* 3. Create / New Project / Start Chat / New Task Icon */}
              <div className="relative group/tip">
                <button
                  type="button"
                  onClick={() => {
                    setOpenHeaderMenu((cur) => (cur === 'create' ? 'none' : 'create'));
                    setActiveSubMenu('none');
                  }}
                  aria-label="新建项目、单聊或任务"
                  aria-expanded={openHeaderMenu === 'create'}
                  className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                    openHeaderMenu === 'create' ||
                    showCreateProject ||
                    showDmPicker ||
                    showNewTaskDrawer
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                </button>
                {openHeaderMenu !== 'create' && (
                  <div className="pointer-events-none opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 absolute bottom-full mb-1.5 right-0 z-50 px-2 py-1 rounded-md bg-slate-900 text-white text-[11px] font-medium whitespace-nowrap shadow-md">
                    新建项目 / 发起单聊与任务
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Dropdown 2: Task Mode Antigravity / Codex-Style Filter, Group & Sort Popover */}
          {openHeaderMenu === 'filter' && conversationMode === 'task' && (
            <div className="absolute left-2.5 right-2.5 top-10 z-40 rounded-xl bg-white border border-slate-200 shadow-xl py-1.5 text-xs text-slate-700">
              {/* Group By */}
              <button
                type="button"
                onClick={() =>
                  setActiveSubMenu((cur) => (cur === 'group' ? 'none' : 'group'))
                }
                className="w-full px-3 py-1.5 hover:bg-slate-100/80 flex items-center justify-between gap-2 cursor-pointer"
              >
                <span className="font-medium text-slate-800">分组方式</span>
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                  <span>{GROUP_BY_LABELS[taskGroupBy]}</span>
                  <ChevronRight
                    className={`w-3.5 h-3.5 transition-transform ${
                      activeSubMenu === 'group' ? 'rotate-90 text-slate-800' : ''
                    }`}
                  />
                </span>
              </button>
              {activeSubMenu === 'group' && (
                <div className="mx-2 my-1 py-1 rounded-lg bg-slate-50 border border-slate-200/70 space-y-0.5">
                  {(['project', 'agent', 'none'] as TaskGroupBy[]).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setTaskGroupBy(opt);
                        setActiveSubMenu('none');
                      }}
                      className="w-full px-2.5 py-1 hover:bg-white flex items-center justify-between text-[11.5px] cursor-pointer"
                    >
                      <span
                        className={
                          taskGroupBy === opt ? 'font-semibold text-slate-900' : 'text-slate-600'
                        }
                      >
                        {GROUP_BY_LABELS[opt]}
                      </span>
                      {taskGroupBy === opt && <Check className="w-3.5 h-3.5 text-blue-600" />}
                    </button>
                  ))}
                </div>
              )}

              {/* Sort Tasks */}
              <button
                type="button"
                onClick={() => setActiveSubMenu((cur) => (cur === 'sort' ? 'none' : 'sort'))}
                className="w-full px-3 py-1.5 hover:bg-slate-100/80 flex items-center justify-between gap-2 cursor-pointer"
              >
                <span className="font-medium text-slate-800">任务排序</span>
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                  <span>{SORT_BY_LABELS[taskSortBy]}</span>
                  <ChevronRight
                    className={`w-3.5 h-3.5 transition-transform ${
                      activeSubMenu === 'sort' ? 'rotate-90 text-slate-800' : ''
                    }`}
                  />
                </span>
              </button>
              {activeSubMenu === 'sort' && (
                <div className="mx-2 my-1 py-1 rounded-lg bg-slate-50 border border-slate-200/70 space-y-0.5">
                  {(['last_updated', 'attention', 'status'] as TaskSortBy[]).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setTaskSortBy(opt);
                        setActiveSubMenu('none');
                      }}
                      className="w-full px-2.5 py-1 hover:bg-white flex items-center justify-between text-[11.5px] cursor-pointer"
                    >
                      <span
                        className={
                          taskSortBy === opt ? 'font-semibold text-slate-900' : 'text-slate-600'
                        }
                      >
                        {SORT_BY_LABELS[opt]}
                      </span>
                      {taskSortBy === opt && <Check className="w-3.5 h-3.5 text-blue-600" />}
                    </button>
                  ))}
                </div>
              )}

              <div className="my-1.5 border-t border-slate-100" />

              {/* Filter by Status */}
              <button
                type="button"
                onClick={() =>
                  setActiveSubMenu((cur) => (cur === 'filter' ? 'none' : 'filter'))
                }
                className="w-full px-3 py-1.5 hover:bg-slate-100/80 flex items-center justify-between gap-2 cursor-pointer"
              >
                <span className="font-medium text-slate-800">状态筛选</span>
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                  <span>{STATUS_FILTER_LABELS[taskStatusFilter]}</span>
                  <ChevronRight
                    className={`w-3.5 h-3.5 transition-transform ${
                      activeSubMenu === 'filter' ? 'rotate-90 text-slate-800' : ''
                    }`}
                  />
                </span>
              </button>
              {activeSubMenu === 'filter' && (
                <div className="mx-2 my-1 py-1 rounded-lg bg-slate-50 border border-slate-200/70 space-y-0.5">
                  {(
                    ['all', 'in_progress', 'review', 'pending', 'done'] as TaskStatusFilter[]
                  ).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setTaskStatusFilter(opt);
                        setActiveSubMenu('none');
                      }}
                      className="w-full px-2.5 py-1 hover:bg-white flex items-center justify-between text-[11.5px] cursor-pointer"
                    >
                      <span
                        className={
                          taskStatusFilter === opt
                            ? 'font-semibold text-slate-900'
                            : 'text-slate-600'
                        }
                      >
                        {STATUS_FILTER_LABELS[opt]}
                      </span>
                      {taskStatusFilter === opt && (
                        <Check className="w-3.5 h-3.5 text-blue-600" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Quick Boolean Toggles */}
              <button
                type="button"
                onClick={() => setOnlyWaitingConfirm((v) => !v)}
                className="w-full px-3 py-1.5 hover:bg-slate-100/80 flex items-center justify-between gap-2 cursor-pointer"
              >
                <span className="font-medium text-slate-800">仅看待确认</span>
                {onlyWaitingConfirm && <Check className="w-3.5 h-3.5 text-blue-600" />}
              </button>

              <button
                type="button"
                onClick={() => setHideDoneTasks((v) => !v)}
                className="w-full px-3 py-1.5 hover:bg-slate-100/80 flex items-center justify-between gap-2 cursor-pointer"
              >
                <span className="font-medium text-slate-800">隐藏已完成</span>
                {hideDoneTasks && <Check className="w-3.5 h-3.5 text-blue-600" />}
              </button>

              <div className="my-1.5 border-t border-slate-100" />

              <button
                type="button"
                onClick={handleResetTaskView}
                className="w-full px-3 py-1.5 text-left text-[11.5px] text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 cursor-pointer"
              >
                恢复默认视图
              </button>
            </div>
          )}

          {/* Dropdown 3: Create Action Menu (新建项目群 / 发起单聊 / 新建任务 Session) */}
          {openHeaderMenu === 'create' && (
            <div className="absolute left-2.5 right-2.5 top-10 z-40 rounded-xl bg-white border border-slate-200 shadow-xl py-1.5 text-xs text-slate-700">
              <div className="px-3 py-1 text-[10.5px] font-semibold text-slate-400">
                新建与发起
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowCreateProject(true);
                  setShowDmPicker(false);
                  setShowNewTaskDrawer(false);
                  setOpenHeaderMenu('none');
                }}
                className="w-full px-3 py-1.5 hover:bg-slate-100/80 flex items-center gap-2 text-left cursor-pointer"
              >
                <FolderKanban className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium text-slate-800">新建项目群</div>
                  <div className="text-[10.5px] text-slate-400 truncate">
                    创建工作项目并自动建群
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDmPickerTab('human');
                  setShowDmPicker(true);
                  setShowCreateProject(false);
                  setShowNewTaskDrawer(false);
                  setOpenHeaderMenu('none');
                }}
                className="w-full px-3 py-1.5 hover:bg-slate-100/80 flex items-center gap-2 text-left cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium text-slate-800">发起 Agent 主理单聊</div>
                  <div className="text-[10.5px] text-slate-400 truncate">
                    1v1 对接项目目标与多 Agent 协作
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDmPickerTab('agent');
                  setShowDmPicker(true);
                  setShowCreateProject(false);
                  setShowNewTaskDrawer(false);
                  setOpenHeaderMenu('none');
                }}
                className="w-full px-3 py-1.5 hover:bg-slate-100/80 flex items-center gap-2 text-left cursor-pointer"
              >
                <Bot className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium text-slate-800">发起 Agent 单聊</div>
                  <div className="text-[10.5px] text-slate-400 truncate">
                    1v1 洽谈报价与雇佣条件
                  </div>
                </div>
              </button>

              <div className="my-1.5 border-t border-slate-100" />

              <button
                type="button"
                onClick={() => handleOpenNewTaskDrawer()}
                className="w-full px-3 py-1.5 hover:bg-slate-100/80 flex items-center gap-2 text-left cursor-pointer"
              >
                <MessageSquareCode className="w-3.5 h-3.5 text-slate-900 shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium text-slate-800">新建任务 Session</div>
                  <div className="text-[10.5px] text-slate-400 truncate">
                    向指定 Agent 指派专项任务
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* Subtle Active View/Filter Status Line (Task Mode) */}
          {conversationMode === 'task' &&
            (hasActiveTaskFilter ||
              taskGroupBy !== 'project' ||
              taskSortBy !== 'last_updated') && (
              <div className="flex items-center justify-between gap-2 px-1 text-[10.5px] text-slate-500">
                <span className="truncate">
                  {GROUP_BY_LABELS[taskGroupBy]} · {SORT_BY_LABELS[taskSortBy]}
                  {taskStatusFilter !== 'all' ? ` · ${STATUS_FILTER_LABELS[taskStatusFilter]}` : ''}
                  {onlyWaitingConfirm ? ' · 仅待确认' : ''}
                  {hideDoneTasks ? ' · 隐藏已完成' : ''}
                </span>
                {hasActiveTaskFilter && (
                  <button
                    type="button"
                    onClick={handleResetTaskView}
                    className="text-blue-700 hover:underline font-medium shrink-0 cursor-pointer"
                  >
                    重置
                  </button>
                )}
              </div>
            )}

          {/* Create Project Modal */}
          <ModalShell
            open={showCreateProject}
            onClose={() => setShowCreateProject(false)}
            icon={<FolderPlus className="w-4 h-4 text-blue-600" />}
            title="新建项目并创建项目群"
            subtitle="自动初始化多 Agent 项目协作群与任务看板"
            maxWidthClass="max-w-md"
            onSubmit={handleCreateProject}
            footer={
              <>
                <span className="text-[11px] text-slate-500">创建后自动切入该项目群</span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowCreateProject(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
                  >
                    创建项目并建群
                  </button>
                </div>
              </>
            }
          >
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">项目名称 *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="输入工作项目名称..."
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-600/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">项目目标（可选）</label>
                <input
                  type="text"
                  value={newGoal}
                  onChange={(e) => setNewGoal(e.target.value)}
                  placeholder="一句话说明阶段目标与交付范围"
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-600/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">归属社区</label>
                <select
                  value={newSourceZoneId}
                  onChange={(e) => setNewSourceZoneId(e.target.value)}
                  aria-label="项目所属 Agent 社区"
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-2.5 text-xs text-slate-700 focus:outline-none focus:bg-white"
                >
                  <option value="">归属：个人私有项目</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      归属：{z.name}（{z.typeLabel}）
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </ModalShell>

          {/* Start 1v1 DM Modal */}
          <ModalShell
            open={showDmPicker}
            onClose={() => setShowDmPicker(false)}
            icon={<MessageSquare className="w-4 h-4 text-blue-600" />}
            title="发起 1v1 单聊"
            subtitle="选择在线 Agent 主理（FDE / OPC / AI Builder）或专家 Agent 建立直连对话"
            maxWidthClass="max-w-md"
          >
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setDmPickerTab('human')}
                  className={`py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    dmPickerTab === 'human'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600'
                  }`}
                >
                  Agent 主理 ({availableDmHumans.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDmPickerTab('agent')}
                  className={`py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    dmPickerTab === 'agent'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600'
                  }`}
                >
                  专家 Agent ({availableDmAgents.length})
                </button>
              </div>

              {dmPickerTab === 'human' ? (
                availableDmHumans.length === 0 ? (
                  <div className="text-xs text-slate-500 py-6 text-center">
                    所有在线 Agent 主理均已建立单聊。
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto clean-scroll divide-y divide-slate-100 border border-slate-200 rounded-xl">
                    {availableDmHumans.map((h) => {
                      const roleMeta = PRINCIPAL_ROLE_META[h.principalType];
                      return (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => {
                            onSelectHumanDm(h.id);
                            setShowDmPicker(false);
                            onCloseMobile();
                          }}
                          className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center justify-between gap-2 text-xs cursor-pointer"
                        >
                          <span className="inline-flex items-center gap-1.5 min-w-0">
                            <span className="font-semibold text-slate-800 truncate">{h.name}</span>
                            <span className={`text-[11px] font-semibold shrink-0 ${roleMeta.textCls}`}>
                              {roleMeta.shortLabel}
                            </span>
                          </span>
                          <span className="text-[11px] text-slate-500 truncate">
                            {DOMAIN_CATEGORY_LABELS[h.category]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )
              ) : availableDmAgents.length === 0 ? (
                <div className="text-xs text-slate-500 py-6 text-center">
                  所有在线 Agent 均已建立单聊通道。
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto clean-scroll divide-y divide-slate-100 border border-slate-200 rounded-xl">
                  {availableDmAgents.map((cand) => (
                    <button
                      key={cand.id}
                      type="button"
                      onClick={() => {
                        onSelectDm(cand.id);
                        setShowDmPicker(false);
                        onCloseMobile();
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center justify-between gap-2 text-xs cursor-pointer"
                    >
                      <AgentIdentityName
                        name={cand.handle}
                        runtime={cand.runtimeAgent}
                        model={cand.defaultModel}
                        showModel
                        className="font-semibold text-slate-800"
                      />
                      <span className="text-[11px] text-slate-500 truncate">
                        {cand.ownerHumanName ? `归属 ${cand.ownerHumanName}` : cand.title}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </ModalShell>

          {/* New Task Session Modal */}
          <ModalShell
            open={showNewTaskDrawer}
            onClose={() => setShowNewTaskDrawer(false)}
            icon={<MessageSquareCode className="w-4 h-4 text-blue-600" />}
            title="新建任务 Session"
            subtitle="指定所属项目与执行专家 Agent，立即开启任务对话"
            maxWidthClass="max-w-md"
            onSubmit={handleQuickCreateTask}
            footer={
              <>
                <span className="text-[11px] text-slate-500">同步生成项目看板卡片</span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowNewTaskDrawer(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
                  >
                    创建并进入任务对话
                  </button>
                </div>
              </>
            }
          >
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">所属项目</label>
                <select
                  value={quickTaskProjectId}
                  onChange={(e) => setQuickTaskProjectId(e.target.value)}
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-2.5 text-xs text-slate-800 focus:outline-none focus:bg-white"
                >
                  {workspaces.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">执行专家 Agent</label>
                  <select
                    value={quickTaskAgentId}
                    onChange={(e) => setQuickTaskAgentId(e.target.value)}
                    className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-2.5 text-xs text-slate-800 focus:outline-none focus:bg-white"
                  >
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {formatAgentDisplayName(a.handle, a.runtimeAgent, a.defaultModel)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">任务类型</label>
                  <select
                    value={quickTaskType}
                    onChange={(e) => setQuickTaskType(e.target.value as WorkCardType)}
                    className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-2.5 text-xs text-slate-800 focus:outline-none focus:bg-white"
                  >
                    <option value="development">功能开发</option>
                    <option value="planning">产品策划</option>
                    <option value="testing">功能测试</option>
                    <option value="review">架构评审</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">任务标题 *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={quickTaskTitle}
                  onChange={(e) => setQuickTaskTitle(e.target.value)}
                  placeholder="输入任务标题..."
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-600/20"
                />
              </div>
            </div>
          </ModalShell>
        </div>

        {conversationMode === 'chat' ? (
          /* ================= MODE 1: 对话模式（类微信，按事件流自然排序，不分类别） ================= */
          <div className="flex-1 overflow-y-auto clean-scroll px-2.5 pb-3 space-y-1">
            {unifiedChatStream.map((item) => {
              if (item.kind === 'assistant') {
                const isSelected = isChatView && activeChatChannel.type === 'assistant';
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      onSelectAssistant();
                      onCloseMobile();
                    }}
                    className={`w-full text-left p-2.5 rounded-lg transition-colors cursor-pointer ${
                      isSelected ? 'bg-slate-200/80' : 'hover:bg-slate-200/45'
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
                            {item.timestamp}
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
                );
              }

              if (item.kind === 'group') {
                const ws = item.workspace;
                const isSelected =
                  isChatView &&
                  activeChatChannel.type === 'group' &&
                  activeChatChannel.projectId === ws.id;
                const wsZone = ws.sourceZoneId ? zoneMap.get(ws.sourceZoneId) : undefined;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      onSelectProjectChat(ws.id);
                      onCloseMobile();
                    }}
                    className={`w-full text-left p-2.5 rounded-lg transition-colors cursor-pointer ${
                      isSelected ? 'bg-slate-200/80' : 'hover:bg-slate-200/45'
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
                            {item.timestamp}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-1.5 text-[11px]">
                          <span className="text-slate-600 font-medium truncate">
                            {wsZone ? `${wsZone.shortCode}·${wsZone.name}` : '个人项目'} ·{' '}
                            {item.taskCount} 卡
                          </span>
                          {item.reviewCount > 0 && (
                            <span className="font-mono tabular-nums font-semibold text-amber-700 shrink-0">
                              {item.reviewCount} 待验证
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500 truncate">
                          {item.lastMsg
                            ? `${displayEntityName(item.lastMsg.senderHandle)}: ${item.lastMsg.content}`
                            : ws.goal}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              }

              if (item.kind === 'human_dm') {
                const { expert, thread } = item;
                const roleMeta = PRINCIPAL_ROLE_META[expert.principalType];
                const isSelected =
                  isChatView &&
                  activeChatChannel.type === 'human_dm' &&
                  activeChatChannel.expertId === thread.expertId;
                const lastMsg = thread.messages[thread.messages.length - 1];
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      onSelectHumanDm(thread.expertId);
                      onCloseMobile();
                    }}
                    className={`w-full text-left p-2.5 rounded-lg transition-colors cursor-pointer ${
                      isSelected ? 'bg-slate-200/80' : 'hover:bg-slate-200/45'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5">
                        <EntityAvatar
                          kind="human"
                          code={expert.avatarInitials}
                          accent={expert.avatarAccent}
                          title={`${roleMeta.label} · ${expert.name}`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {expert.name}
                          </span>
                          <span className="text-[10px] font-mono tabular-nums text-slate-400 shrink-0">
                            {item.timestamp}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-1.5 text-[11px]">
                          <span className="text-slate-500 truncate">
                            {DOMAIN_CATEGORY_LABELS[expert.category]} · {expert.title}
                          </span>
                          <span className={`font-semibold shrink-0 ${roleMeta.textCls}`}>
                            {roleMeta.shortLabel}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500 truncate">
                          {lastMsg?.content || '点击开始 1v1 沟通协作'}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              }

              // agent_dm
              const { agent: dmAgent, thread } = item;
              const isSelected =
                isChatView &&
                activeChatChannel.type === 'dm' &&
                activeChatChannel.agentId === thread.agentId;
              const lastDm = thread.messages[thread.messages.length - 1];
              const st = DM_STATUS_LABEL[thread.status];
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    onSelectDm(thread.agentId);
                    onCloseMobile();
                  }}
                  className={`w-full text-left p-2.5 rounded-lg transition-colors cursor-pointer ${
                    isSelected ? 'bg-slate-200/80' : 'hover:bg-slate-200/45'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5">
                      <EntityAvatar
                        kind="agent"
                        code={dmAgent.avatarCode}
                        accent={dmAgent.avatarAccent}
                        title={`Agent 专家 · ${dmAgent.ownerHumanName || '社区认证'}`}
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
                          {item.timestamp}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-1.5 text-[11px]">
                        <span className="text-slate-500 truncate">
                          {dmAgent.ownerHumanName
                            ? `归属：${dmAgent.ownerHumanName}`
                            : dmAgent.name}
                        </span>
                        <span className={`shrink-0 whitespace-nowrap ${st.cls}`}>{st.text}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500 truncate">
                        {lastDm?.content || thread.scopeNote}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
            <RailBrandBackdrop compact />
          </div>
        ) : (
          /* ================= MODE 2: 任务模式（类 Codex / Antigravity，可筛选/分组/不分组事件流） ================= */
          <div className="flex-1 overflow-y-auto clean-scroll px-2 pb-3">
              {filteredAndSortedTasks.length === 0 ? (
                <div className="px-3 py-8 text-center space-y-2">
                  <div className="text-xs text-slate-500">当前筛选条件下暂无任务 Session</div>
                  {hasActiveTaskFilter && (
                    <button
                      type="button"
                      onClick={handleResetTaskView}
                      className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
                    >
                      重置筛选条件
                    </button>
                  )}
                </div>
              ) : taskGroupBy === 'none' ? (
                /* Ungrouped: Pure Task Event Stream sorted chronologically */
                <div className="space-y-1.5 pt-1">
                  {filteredAndSortedTasks.map((task) => renderTaskRow(task, 'flat'))}
                </div>
              ) : taskGroupBy === 'agent' ? (
                /* Grouped by Agent (Cross-Project Aggregation) */
                <div className="space-y-3.5 pt-1">
                  {tasksGroupedByAgent.map((group) => {
                    const groupKey = `ag:${group.agentId}`;
                    const isCollapsed = Boolean(collapsedGroups[groupKey]);
                    return (
                      <div key={group.agentId} className="space-y-1.5">
                        <div className="group flex items-center justify-between gap-1 px-2 py-1.5 rounded-md hover:bg-slate-200/50 transition-colors">
                          <button
                            type="button"
                            onClick={() => toggleGroupCollapse(groupKey)}
                            className="flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer"
                          >
                            {isCollapsed ? (
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            )}
                            <span
                              className="w-4 h-4 rounded text-white text-[8px] font-bold inline-flex items-center justify-center shrink-0"
                              style={{ backgroundColor: group.agent?.avatarAccent || '#334155' }}
                            >
                              {group.agent?.avatarCode?.slice(0, 1) || 'A'}
                            </span>
                            <AgentIdentityName
                              name={group.handle}
                              runtime={group.agent?.runtimeAgent}
                              model={group.agent?.defaultModel}
                              className="text-xs font-semibold text-slate-700"
                            />
                            <span className="text-[10px] font-mono tabular-nums text-slate-400 shrink-0">
                              {group.distinctProjects}项·{group.tasks.length}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenNewTaskDrawer({
                                agentId: group.agentId,
                                projectId: group.tasks[0]?.sessionId,
                              })
                            }
                            title={`为 ${formatAgentDisplayName(group.handle, group.agent?.runtimeAgent, group.agent?.defaultModel)} 新建任务`}
                            className="p-0.5 rounded text-slate-400 hover:text-slate-900 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer shrink-0"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {!isCollapsed && (
                          <div className="pl-1.5 space-y-1.5">
                            {group.tasks.map((task) => renderTaskRow(task, 'agent'))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Grouped by Project (Antigravity Projects Tree Style) */
                <div className="space-y-3.5 pt-1">
                  {tasksGroupedByProject.map((group) => {
                    const groupKey = `pj:${group.projectId}`;
                    const isCollapsed = Boolean(collapsedGroups[groupKey]);
                    return (
                      <div key={group.projectId} className="space-y-1.5">
                        <div className="group flex items-center justify-between gap-1 px-2 py-1.5 rounded-md hover:bg-slate-200/50 transition-colors">
                          <button
                            type="button"
                            onClick={() => toggleGroupCollapse(groupKey)}
                            className="flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer"
                          >
                            {isCollapsed ? (
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            )}
                            <FolderKanban className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span className="text-xs font-semibold text-slate-700 truncate">
                              {group.workspace?.name || '项目'}
                            </span>
                            <span className="text-[10px] font-mono tabular-nums text-slate-400 shrink-0">
                              {group.tasks.length}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenNewTaskDrawer({
                                projectId: group.projectId,
                                agentId: group.tasks[0]?.assigneeId,
                              })
                            }
                            title={`在「${group.workspace?.name || '项目'}」新建任务`}
                            className="p-0.5 rounded text-slate-400 hover:text-slate-900 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer shrink-0"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {!isCollapsed && (
                          <div className="pl-1.5 space-y-1.5">
                            {group.tasks.map((task) => renderTaskRow(task, 'project'))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <RailBrandBackdrop compact />
          </div>
        )}
      </div>

      {/* Bottom-Left Pinned AgentNexus Account Login Footer */}
      <AccountFooter account={account} onOpenLogin={onOpenLogin} onLogout={onLogout} />
    </div>
  );

  const handleRailEnterCurrentMode = () => {
    onSelectView('chat');
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
        <button
          type="button"
          onClick={onOpenNewSessionLauncher}
          title="新会话"
          aria-label="新会话"
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
            isChatView && activeChatChannel.type === 'new_session'
              ? 'bg-slate-900 text-sky-300 shadow-2xs'
              : 'text-blue-600 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-200/80'
          }`}
        >
          <MessageSquarePlus className="w-4 h-4" />
        </button>

        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectView(item.id)}
              title={item.tooltip}
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

        {/* Single Active Mode Shortcut */}
        <button
          type="button"
          onClick={handleRailEnterCurrentMode}
          title={
            conversationMode === 'task'
              ? `任务会话（${allTasks.length} 个任务）`
              : `聊天对话（${unifiedChatStream.length} 条会话）`
          }
          aria-label={conversationMode === 'task' ? '任务会话' : '聊天对话'}
          className={`relative w-10 h-10 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
            isChatView
              ? 'bg-slate-900 text-sky-300 shadow-2xs'
              : 'text-slate-600 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-200/80'
          }`}
        >
          {conversationMode === 'task' ? (
            <MessageSquareCode className="w-4 h-4" />
          ) : (
            <MessageSquare className="w-4 h-4" />
          )}
          {!isChatView &&
            (conversationMode === 'task' ? awaitingTaskSessionCount > 0 : assistantPendingCount > 0) && (
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
          collapsed ? 'w-[60px]' : 'w-[280px]'
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
