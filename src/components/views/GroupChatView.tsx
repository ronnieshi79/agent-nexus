import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  AtSign,
  CheckCircle2,
  ClipboardPlus,
  FileCode2,
  FolderKanban,
  Lock,
  MessageSquareCode,
  MoreHorizontal,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import type { CreateWorkCardInput } from '../../hooks/useAgentNexusStore';
import type {
  ActiveWorkflowStage,
  AgentLeaseRecord,
  AgentNexusAccount,
  ChatMessage,
  CommunityZone,
  ComputeNode,
  ExpertAgent,
  HumanExpert,
  ProjectAgentAssignment,
  ProjectArtifact,
  ProjectLifecycleStatus,
  ProjectStageSlot,
  ProjectTaskType,
  ProjectWorkspace,
  SpaceSharedNode,
  StorageVolume,
  TaskSessionMessage,
  TaskStatus,
  TaskTypeAccent,
  TeamExpertMembership,
  WorkCardType,
  WorkflowTask,
} from '../../types/agentnexus';
import type { TaskTemplatePackId } from '../../utils/pipelineSync';
import { STAGE_LABEL_MAP, resolveTaskWorkflowTeam } from '../../utils/taskWorkflow';
import { ChatChannelHeader } from '../chat/ChatChannelHeader';
import { GroupTaskCard } from '../chat/GroupTaskCard';
import { ProjectArtifactsRailTab } from '../chat/ProjectArtifactsRailTab';
import { ProjectGroupSettingsDrawer } from '../chat/ProjectGroupSettingsDrawer';
import { ProjectKanbanWidget } from '../chat/ProjectKanbanWidget';
import {
  AgentIdentityName,
  EntityAvatar,
  displayEntityName,
  formatAgentDisplayName,
} from '../shared/EntityIdentity';
import { ModalShell } from '../shared/UiPrimitives';
import { WorkStatusBadge } from '../workcard/WorkCardFlow';

interface GroupChatViewProps {
  workspace: ProjectWorkspace;
  linkedZone?: CommunityZone;
  zones?: CommunityZone[];
  hiredAgents: ExpertAgent[];
  allAgents?: ExpertAgent[];
  humanExperts?: HumanExpert[];
  teamExperts?: TeamExpertMembership[];
  agentLeases?: Record<string, AgentLeaseRecord>;
  assignments?: ProjectAgentAssignment[];
  pipelineSlots?: ProjectStageSlot[];
  taskTypes?: ProjectTaskType[];
  computeNodes?: ComputeNode[];
  spaceSharedNodes?: SpaceSharedNode[];
  storageVolumes?: StorageVolume[];
  projectArtifacts?: ProjectArtifact[];
  projectArtifactCount?: number;
  groupKanbanOpenSignal?: number;
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
  onUpdateTaskStatus?: (taskId: string, status: TaskStatus) => void;
  onOpenTaskSession: (taskId: string) => void;
  onOpenProjectArtifacts?: (projectId: string) => void;
  onAddProjectAgentAssignment?: (
    projectId: string,
    agentId: string,
    initialStages?: ActiveWorkflowStage[],
  ) => void;
  onRemoveProjectAgentAssignment?: (projectId: string, agentId: string) => void;
  onUpdateProjectAgentAssignment?: (
    projectId: string,
    agentId: string,
    patch: Partial<Omit<ProjectAgentAssignment, 'agentId'>>,
  ) => void;
  onAssignExpertToWorkspace?: (expertId: string, workspaceId: string) => void;
  onRemoveExpertFromWorkspace?: (expertId: string, workspaceId: string) => void;
  onAddProjectTaskType?: (
    projectId: string,
    input: {
      name: string;
      description: string;
      templateChecklist?: string;
      accent: TaskTypeAccent;
      creatorAgentIds?: string[];
    },
  ) => void;
  onUpdateProjectTaskType?: (
    projectId: string,
    typeId: string,
    patch: Partial<Omit<ProjectTaskType, 'id'>>,
  ) => void;
  onDeleteProjectTaskType?: (projectId: string, typeId: string) => void;
  onApplyTaskTypePresetPack?: (projectId: string, packId: TaskTemplatePackId) => void;
  onStartTemplateConversation?: (
    projectId: string,
    taskTypeId: string,
    options?: { prompt?: string; creatorAgentId?: string; autoSend?: boolean },
  ) => void;
  onUpdateProjectLifecycle?: (projectId: string, status: ProjectLifecycleStatus) => void;
  onJumpToMarket: () => void;
  onJumpToKanban: () => void;
  onJumpToTeam: () => void;
  onReactivateProject?: (projectId: string) => void;
}

const WORK_TYPE_LABELS: Record<WorkCardType, string> = {
  planning: '产品策划',
  development: '功能开发',
  testing: '功能测试',
  review: '架构评审',
};

export function GroupChatView({
  workspace,
  linkedZone,
  zones = [],
  hiredAgents,
  allAgents,
  humanExperts = [],
  teamExperts = [],
  agentLeases = {},
  assignments = [],
  pipelineSlots = [],
  taskTypes = [],
  computeNodes = [],
  spaceSharedNodes = [],
  storageVolumes = [],
  projectArtifacts = [],
  projectArtifactCount = 0,
  groupKanbanOpenSignal = 0,
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
  onUpdateTaskStatus,
  onOpenTaskSession,
  onOpenProjectArtifacts,
  onAddProjectAgentAssignment,
  onRemoveProjectAgentAssignment,
  onUpdateProjectAgentAssignment,
  onAssignExpertToWorkspace,
  onRemoveExpertFromWorkspace,
  onAddProjectTaskType,
  onUpdateProjectTaskType,
  onDeleteProjectTaskType,
  onApplyTaskTypePresetPack,
  onStartTemplateConversation,
  onUpdateProjectLifecycle,
  onJumpToMarket,
  onJumpToTeam,
  onReactivateProject,
}: GroupChatViewProps) {
  const resolvedAgents = useMemo(
    () => (allAgents && allAgents.length > 0 ? allAgents : hiredAgents),
    [allAgents, hiredAgents],
  );
  const isReadOnly =
    workspace.lifecycleStatus === 'completed' || workspace.lifecycleStatus === 'archived';
  const [draft, setDraft] = useState('');
  const [rightOpen, setRightOpen] = useState(true);
  const [rightTab, setRightTab] = useState<'tasks' | 'artifacts' | 'members'>('tasks');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [kanbanPinned, setKanbanPinned] = useState(true);
  const [kanbanExpanded, setKanbanExpanded] = useState(false);

  // Composer inline tools: none | mention | newCard | presets
  const [composerTool, setComposerTool] = useState<'none' | 'mention' | 'newCard' | 'presets'>(
    'none',
  );

  // New work card form fields inside composer
  const [cardModule, setCardModule] = useState(workspace.name);
  const [cardType, setCardType] = useState<WorkCardType>('development');
  const [cardTitle, setCardTitle] = useState('');
  const [cardDesc, setCardDesc] = useState('');
  const [cardAssignee, setCardAssignee] = useState(hiredAgents[0]?.id || '');
  const [cardPriority, setCardPriority] = useState<'高' | '中' | '低'>('高');

  const endRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setCardModule(workspace.name);
    setComposerTool('none');
    setSettingsOpen(false);
    setKanbanExpanded(false);
  }, [workspace.id, workspace.name]);

  const lastKanbanSignalRef = useRef(groupKanbanOpenSignal);
  useEffect(() => {
    if (groupKanbanOpenSignal > 0 && groupKanbanOpenSignal !== lastKanbanSignalRef.current) {
      lastKanbanSignalRef.current = groupKanbanOpenSignal;
      setSettingsOpen(false);
      setKanbanPinned(true);
      setKanbanExpanded(true);
    }
  }, [groupKanbanOpenSignal]);

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

  const inProgressTasks = useMemo(
    () => tasks.filter((t) => t.status === 'in_progress' || executingTaskId === t.id),
    [executingTaskId, tasks],
  );

  const groupedInProgressCards = useMemo(() => {
    const groups = new Map<string, WorkflowTask[]>();
    inProgressTasks.forEach((t) => {
      const key = t.featureModule || '核心功能模块';
      const list = groups.get(key) || [];
      list.push(t);
      groups.set(key, list);
    });
    return Array.from(groups.entries());
  }, [inProgressTasks]);

  const liveArtifactCount = useMemo(() => {
    const coveredTaskIds = new Set(projectArtifacts.map((a) => a.sourceTaskId).filter(Boolean));
    const derived = tasks.filter(
      (t) => Boolean(t.deliverableArtifact) && !coveredTaskIds.has(t.id),
    ).length;
    return projectArtifacts.length + derived;
  }, [projectArtifacts, tasks]);

  const submitMessage = async () => {
    const cleaned = draft.trim();
    if (!cleaned || isBusy || isReadOnly) return;
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
    if (!cardTitle.trim() || isReadOnly) return;
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
      ? `${hiredAgents[1].handle} 确认方案边界，请接棒进入执行阶段并推进当前待办任务`
      : '@全栈开发员 确认方案边界，请接棒进入执行阶段',
    '@代码评审员 复核当前待验收任务，无误请直接验收通过并归档',
    hiredAgents[0]
      ? `${hiredAgents[0].handle} 新增“部分退款风控熔断”任务，按计划→执行→验收工作流自动接力`
      : '@产品策划师 新增“部分退款风控熔断”任务并启动工作流',
  ];

  const spaceOwnershipLabel = linkedZone
    ? `${linkedZone.typeLabel}：${linkedZone.name}`
    : '个人私有项目';

  return (
    <div className="h-full flex min-h-0 bg-white relative">
      {/* Main Center Project Group Chat Column */}
      <div className="flex-1 min-w-0 flex flex-col h-full">
        {/* Uniform Top Channel Header with Right Side Panel Toggle & WeChat-style Group Settings '···' */}
        <ChatChannelHeader
          avatar={
            <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
              <FolderKanban className="w-4 h-4" />
            </div>
          }
          title={workspace.name}
          tag={`项目群 · ${spaceOwnershipLabel} · ${hiredAgents.length} 专家 · ${tasks.length} 任务卡`}
          tagClassName={linkedZone?.kind === 'private' ? 'text-indigo-700' : 'text-blue-700'}
          subtitle={workspace.goal}
          panelOpen={rightOpen && !settingsOpen}
          panelToggleLabel={`进行中 (${inProgressTasks.length})`}
          onTogglePanel={() => {
            if (settingsOpen) {
              setSettingsOpen(false);
              setRightOpen(true);
            } else {
              setRightOpen((v) => !v);
            }
          }}
          extraAction={
            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              title="群聊设置（加人 · 项目看板 · 任务编排）"
              aria-label="群聊设置"
              className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors cursor-pointer shrink-0 ${
                settingsOpen
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          }
        />

        {/* Chat Viewport Container (hosts Floating Pinned Top Kanban Widget + Message Stream + Composer) */}
        <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden">
          <ProjectKanbanWidget
            workspace={workspace}
            tasks={tasks}
            taskSessions={taskSessions}
            agents={resolvedAgents}
            assignments={assignments}
            pipelineSlots={pipelineSlots}
            taskTypes={taskTypes}
            executingTaskId={executingTaskId}
            pinned={kanbanPinned}
            expanded={kanbanExpanded}
            onToggleExpanded={() => setKanbanExpanded((v) => !v)}
            onCloseExpanded={() => setKanbanExpanded(false)}
            onOpenTaskSession={onOpenTaskSession}
            onRunTask={onRunTask}
            onApproveTask={onApproveTask}
            onUpdateTaskStatus={onUpdateTaskStatus}
          />

          {/* Chat Message Stream */}
          <div className="flex-1 overflow-y-auto clean-scroll px-4 sm:px-8 py-5 bg-white">
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
              const agentObj = resolvedAgents.find((a) => a.id === msg.senderId);
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
                      {isEmployer ? (
                        <span className="font-semibold text-slate-900">
                          {account?.name || displayEntityName(msg.senderHandle)}
                        </span>
                      ) : (
                        <AgentIdentityName
                          name={isButler ? '平台助理' : msg.senderHandle}
                          runtime={isButler ? 'Nexa' : agentObj?.runtimeAgent}
                          model={agentObj?.defaultModel}
                          className="font-semibold text-slate-900"
                        />
                      )}
                      {!isEmployer && !isButler && agentObj?.ownerHumanName && (
                        <span className="text-[11px] text-slate-400">
                          · 归属专家 {agentObj.ownerHumanName}
                        </span>
                      )}
                      {isButler && (
                        <span className="text-slate-500">· {msg.senderName}</span>
                      )}
                      <span className="text-slate-400 font-mono tabular-nums">{msg.timestamp}</span>
                    </div>

                    <div
                      className={`text-sm leading-relaxed ${
                        isEmployer
                          ? 'rounded-xl px-3.5 py-2.5 bg-slate-100/90 text-slate-900'
                          : 'pt-0.5 text-slate-800 w-full'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>

                      {/* Embedded Project Task Cards: compact card-mode summary, click to enter multi-agent Task Session */}
                      {linkedTasks.length > 0 && (
                        <div className="mt-3 space-y-3">
                          {linkedTasks.map((task) => (
                            <GroupTaskCard
                              key={task.id}
                              task={task}
                              workspace={workspace}
                              agents={resolvedAgents}
                              assignments={assignments}
                              pipelineSlots={pipelineSlots}
                              sessionMessages={taskSessions[task.id] || []}
                              isExecuting={executingTaskId === task.id}
                              onOpenTaskSession={onOpenTaskSession}
                            />
                          ))}
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
            {isReadOnly && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900">
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>
                    该项目已{workspace.lifecycleStatus === 'completed' ? '结项完成' : '归档'}，群聊派单与任务审批已锁定。
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

            {/* Attached Popover Shelf 1: @ Agent Expert Picker */}
            {!isReadOnly && composerTool === 'mention' && (
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

            {/* New Project Work Card Creator Modal */}
            <ModalShell
              open={composerTool === 'newCard'}
              onClose={() => setComposerTool('none')}
              icon={<ClipboardPlus className="w-4 h-4 text-blue-600" />}
              title="新建工作卡片"
              subtitle={`所属项目「${workspace.name}」· 创建后同步进入项目看板与任务对话`}
              maxWidthClass="max-w-lg"
              onSubmit={handleCreateCardSubmit}
              footer={
                <>
                  <span className="text-[11px] text-slate-500">同步派发给指定专家 Agent</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setComposerTool('none')}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white whitespace-nowrap cursor-pointer"
                    >
                      创建并同步看板
                    </button>
                  </div>
                </>
              }
            >
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">卡片标题 *</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={cardTitle}
                    onChange={(e) => setCardTitle(e.target.value)}
                    placeholder="如：开发 A 功能 · 汇率波动熔断保护"
                    className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">功能模块</label>
                    <input
                      type="text"
                      value={cardModule}
                      onChange={(e) => setCardModule(e.target.value)}
                      placeholder="如：A功能 · 多币种结算"
                      className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">任务类型</label>
                    <select
                      value={cardType}
                      onChange={(e) => setCardType(e.target.value as WorkCardType)}
                      className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none"
                    >
                      <option value="planning">产品策划</option>
                      <option value="development">功能开发</option>
                      <option value="testing">功能测试</option>
                      <option value="review">架构评审</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">指派专家 Agent</label>
                    <select
                      value={cardAssignee}
                      onChange={(e) => setCardAssignee(e.target.value)}
                      className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none"
                    >
                      {hiredAgents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {formatAgentDisplayName(a.handle, a.runtimeAgent, a.defaultModel)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">优先级</label>
                    <select
                      value={cardPriority}
                      onChange={(e) => setCardPriority(e.target.value as '高' | '中' | '低')}
                      className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none"
                    >
                      <option value="高">高</option>
                      <option value="中">中</option>
                      <option value="低">低</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    交付要求与验收标准（可选）
                  </label>
                  <textarea
                    rows={3}
                    value={cardDesc}
                    onChange={(e) => setCardDesc(e.target.value)}
                    placeholder="补充业务上下文、约束边界或验收检查项..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 resize-none"
                  />
                </div>
              </div>
            </ModalShell>

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
              className={`rounded-xl border border-slate-300 bg-slate-50/60 transition-all ${
                isReadOnly
                  ? 'opacity-65'
                  : 'focus-within:bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-600/15'
              }`}
            >
              <textarea
                ref={textareaRef}
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isBusy || isReadOnly}
                placeholder={
                  isReadOnly
                    ? '项目已结项/归档，只读查看历史记录。重新激活项目后可继续派单。'
                    : '输入新任务需求让专家按工作流自动接力，或 @ 专家驱动流程往下移 / 继续补充要求...（Enter 发送）'
                }
                className="w-full bg-transparent px-3.5 pt-3 pb-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none resize-none leading-relaxed disabled:cursor-not-allowed"
              />

              {/* Composer Bottom Action Bar: @ Expert, + New Work Card, Quick Directives, Send */}
              <div className="px-2.5 pb-2.5 pt-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 overflow-x-auto">
                  <button
                    type="button"
                    disabled={isReadOnly}
                    onClick={() =>
                      setComposerTool((t) => (t === 'mention' ? 'none' : 'mention'))
                    }
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
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
                    disabled={isReadOnly}
                    onClick={() =>
                      setComposerTool((t) => (t === 'newCard' ? 'none' : 'newCard'))
                    }
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
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
                    disabled={isReadOnly}
                    onClick={() =>
                      setComposerTool((t) => (t === 'presets' ? 'none' : 'presets'))
                    }
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
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
                  disabled={isBusy || isReadOnly || !draft.trim()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isBusy ? '发送中...' : '发送'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
        </div>
      </div>

      {/* Right Docked Side Panel: Either WeChat-style Group Settings OR Project Tasks/Experts */}
      {settingsOpen ? (
        <ProjectGroupSettingsDrawer
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          workspace={workspace}
          linkedZone={linkedZone}
          account={account}
          tasks={tasks}
          projectArtifactCount={projectArtifactCount}
          allAgents={resolvedAgents}
          humanExperts={humanExperts}
          teamExperts={teamExperts}
          agentLeases={agentLeases}
          assignments={assignments}
          taskTypes={taskTypes}
          computeNodes={computeNodes}
          spaceSharedNodes={spaceSharedNodes}
          zones={zones}
          storageVolumes={storageVolumes}
          kanbanPinned={kanbanPinned}
          onToggleKanbanPinned={() => setKanbanPinned((v) => !v)}
          onOpenKanbanOverlay={() => {
            setKanbanPinned(true);
            setKanbanExpanded(true);
          }}
          onOpenProjectArtifacts={(pid) => onOpenProjectArtifacts?.(pid)}
          onAddProjectAgentAssignment={(pid, agentId, stages) =>
            onAddProjectAgentAssignment?.(pid, agentId, stages)
          }
          onRemoveProjectAgentAssignment={(pid, agentId) =>
            onRemoveProjectAgentAssignment?.(pid, agentId)
          }
          onUpdateProjectAgentAssignment={(pid, agentId, patch) =>
            onUpdateProjectAgentAssignment?.(pid, agentId, patch)
          }
          onAssignExpertToWorkspace={(eid, wid) => onAssignExpertToWorkspace?.(eid, wid)}
          onRemoveExpertFromWorkspace={(eid, wid) => onRemoveExpertFromWorkspace?.(eid, wid)}
          onAddProjectTaskType={(pid, input) => onAddProjectTaskType?.(pid, input)}
          onUpdateProjectTaskType={(pid, tid, patch) => onUpdateProjectTaskType?.(pid, tid, patch)}
          onDeleteProjectTaskType={(pid, tid) => onDeleteProjectTaskType?.(pid, tid)}
          onApplyTaskTypePresetPack={(pid, packId) => onApplyTaskTypePresetPack?.(pid, packId)}
          onStartTemplateConversation={(pid, tid, opts) =>
            onStartTemplateConversation?.(pid, tid, opts)
          }
          onUpdateProjectLifecycle={(pid, status) => {
            if (onUpdateProjectLifecycle) {
              onUpdateProjectLifecycle(pid, status);
            } else if (status === 'active') {
              onReactivateProject?.(pid);
            }
          }}
          onJumpToTeam={onJumpToTeam}
          onJumpToMarket={onJumpToMarket}
        />
      ) : (
        rightOpen && (
        <aside className="fixed inset-y-0 right-0 z-30 lg:static lg:z-auto w-[340px] max-w-[88vw] shrink-0 border-l border-slate-200/80 bg-[#FAFAFA] flex flex-col h-full shadow-2xl lg:shadow-none">
          <div className="p-3 border-b border-slate-200 bg-white flex items-center justify-between gap-2 shrink-0">
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg flex-1">
              <button
                type="button"
                onClick={() => setRightTab('tasks')}
                className={`py-1 px-1.5 text-[11.5px] font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap truncate ${
                  rightTab === 'tasks'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                进行中 ({inProgressTasks.length})
              </button>
              <button
                type="button"
                onClick={() => setRightTab('artifacts')}
                className={`py-1 px-1.5 text-[11.5px] font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap truncate ${
                  rightTab === 'artifacts'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Artifacts ({liveArtifactCount})
              </button>
              <button
                type="button"
                onClick={() => setRightTab('members')}
                className={`py-1 px-1.5 text-[11.5px] font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap truncate ${
                  rightTab === 'members'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                专家 ({hiredAgents.length})
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto clean-scroll p-4 space-y-4">
            {rightTab === 'tasks' ? (
              <>
                {groupedInProgressCards.length === 0 ? (
                  <div className="py-10 text-center space-y-2.5">
                    <div className="text-xs font-medium text-slate-600">
                      当前暂无进行中的任务
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed px-2">
                      计划中、待验收与已完成任务已收纳至顶部项目看板，或在聊天框直接 @ 专家发起新任务。
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setKanbanPinned(true);
                        setKanbanExpanded(true);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                    >
                      <span>展开项目看板</span>
                    </button>
                  </div>
                ) : (
                  <>
                    {groupedInProgressCards.map(([moduleName, moduleTasks]) => (
                      <div key={moduleName} className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-xs font-bold text-slate-800">{moduleName}</span>
                          <span className="text-[11px] font-mono tabular-nums text-blue-700">
                            {moduleTasks.length} 执行中
                          </span>
                        </div>

                        {moduleTasks.map((task) => {
                          const isExec = executingTaskId === task.id;
                          const sessionMsgs = taskSessions[task.id] || [];
                          const lastMsg = sessionMsgs[sessionMsgs.length - 1];
                          const needsConfirm = Boolean(lastMsg?.awaitingConfirmation);
                          const workflow = resolveTaskWorkflowTeam(
                            task,
                            workspace,
                            resolvedAgents,
                            assignments,
                            pipelineSlots,
                          );
                          const activeSpecialist = workflow.activeAgent;

                          return (
                            <div
                              key={task.id}
                              className="bg-white rounded-xl p-4 border border-slate-200/85 hover:border-slate-300 transition-colors space-y-3"
                            >
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-500 font-medium">
                                  {WORK_TYPE_LABELS[task.workType]} ·{' '}
                                  <span className="font-mono">{task.id}</span>
                                </span>
                                <WorkStatusBadge status={task.status} executing={isExec} />
                              </div>

                              <button
                                type="button"
                                onClick={() => onOpenTaskSession(task.id)}
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
                                <span className="font-mono tabular-nums shrink-0 text-[10.5px]">
                                  {STAGE_LABEL_MAP[workflow.currentStage]} · {task.updatedAt}
                                </span>
                              </div>

                              {task.deliverableArtifact && (
                                <div className="flex items-center gap-1.5 text-[11px] font-mono text-blue-700 truncate">
                                  <FileCode2 className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate">{task.deliverableArtifact}</span>
                                </div>
                              )}

                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => onOpenTaskSession(task.id)}
                                  className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap cursor-pointer ${
                                    needsConfirm
                                      ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100/70'
                                      : 'bg-[#FAFAFA] border-slate-200 text-slate-800 hover:bg-slate-900 hover:text-white hover:border-slate-900'
                                  }`}
                                >
                                  <MessageSquareCode className="w-3.5 h-3.5 shrink-0" />
                                  <span>
                                    {needsConfirm
                                      ? '待确认 · 进入会话'
                                      : sessionMsgs.length > 0
                                        ? `任务会话 (${sessionMsgs.length})`
                                        : '进入任务会话'}
                                  </span>
                                </button>

                                {onUpdateTaskStatus && (
                                  <button
                                    type="button"
                                    disabled={isReadOnly}
                                    onClick={() => onUpdateTaskStatus(task.id, 'review')}
                                    className="inline-flex items-center justify-center gap-1 py-2 px-3 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white whitespace-nowrap cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                                  >
                                    <span>提交验收</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}

                    {tasks.length > inProgressTasks.length && (
                      <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px] text-slate-500 px-1">
                        <span>
                          另有{' '}
                          <strong className="font-mono tabular-nums text-slate-700">
                            {tasks.length - inProgressTasks.length}
                          </strong>{' '}
                          项非进行中任务
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setKanbanPinned(true);
                            setKanbanExpanded(true);
                          }}
                          className="font-semibold text-blue-700 hover:text-blue-900 cursor-pointer whitespace-nowrap"
                        >
                          在看板查看 →
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : rightTab === 'artifacts' ? (
              <ProjectArtifactsRailTab
                projectId={workspace.id}
                artifacts={projectArtifacts}
                tasks={tasks}
                onOpenTaskSession={onOpenTaskSession}
                onOpenProjectArtifacts={onOpenProjectArtifacts}
              />
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
                          <AgentIdentityName
                            name={agent.handle}
                            runtime={agent.runtimeAgent}
                            model={agent.defaultModel}
                            showModel
                            className="text-xs font-bold text-slate-900"
                          />
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {agent.ownerHumanName
                            ? `归属专家：${agent.ownerHumanName} · ${agent.title}`
                            : agent.title}
                        </div>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      {agent.skills.slice(0, 4).join(' · ')}
                    </p>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                      <span className="font-mono tabular-nums text-slate-600 truncate">
                        {agent.ownership === 'private'
                          ? '私有自用'
                          : `$${agent.projectPriceUsd.toLocaleString('en-US')}/项目`}
                      </span>
                      <div className="flex items-center gap-2.5 shrink-0">
                        {(() => {
                          const agentProjTask = tasks.find((t) => t.assigneeId === agent.id);
                          if (!agentProjTask) return null;
                          return (
                            <button
                              type="button"
                              onClick={() => onOpenTaskSession(agentProjTask.id)}
                              className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 font-semibold cursor-pointer whitespace-nowrap"
                            >
                              <MessageSquareCode className="w-3 h-3" />
                              <span>任务对话</span>
                            </button>
                          );
                        })()}
                        <button
                          type="button"
                          onClick={() => insertMention(agent.handle)}
                          className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer whitespace-nowrap"
                        >
                          @ 他派单
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </aside>
        )
      )}
    </div>
  );
}
