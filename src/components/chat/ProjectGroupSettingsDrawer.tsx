import { useMemo, useState, type FormEvent } from 'react';
import {
  Archive,
  CheckCircle2,
  ChevronRight,
  Database,
  GitBranch,
  KanbanSquare,
  Minus,
  Pin,
  Plus,
  RotateCcw,
  Server,
  Shapes,
  UserPlus,
  X,
} from 'lucide-react';
import type {
  ActiveWorkflowStage,
  AgentLeaseRecord,
  AgentNexusAccount,
  CommunityZone,
  ComputeNode,
  ExpertAgent,
  HumanExpert,
  ProjectAgentAssignment,
  ProjectLifecycleStatus,
  ProjectTaskType,
  ProjectWorkspace,
  SpaceSharedNode,
  StorageVolume,
  TaskTypeAccent,
  TeamExpertMembership,
  WorkflowTask,
} from '../../types/agentnexus';
import {
  DEFAULT_PROJECT_TASK_TYPES,
  type TaskTemplatePackId,
} from '../../utils/pipelineSync';
import {
  AgentIdentityName,
  DOMAIN_CATEGORY_LABELS,
  EntityAvatar,
  PRINCIPAL_ROLE_META,
  displayEntityName,
} from '../shared/EntityIdentity';
import { ModalShell } from '../shared/UiPrimitives';
import { ProjectOrchestrationPanel } from '../workspace/ProjectOrchestrationPanel';

interface ProjectGroupSettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  workspace: ProjectWorkspace;
  linkedZone?: CommunityZone;
  account: AgentNexusAccount | null;
  tasks: WorkflowTask[];
  projectArtifactCount: number;
  allAgents: ExpertAgent[];
  humanExperts: HumanExpert[];
  teamExperts: TeamExpertMembership[];
  agentLeases: Record<string, AgentLeaseRecord>;
  assignments: ProjectAgentAssignment[];
  taskTypes: ProjectTaskType[];
  computeNodes: ComputeNode[];
  spaceSharedNodes: SpaceSharedNode[];
  zones: CommunityZone[];
  storageVolumes: StorageVolume[];
  kanbanPinned: boolean;
  onToggleKanbanPinned: () => void;
  onOpenKanbanOverlay: () => void;
  onOpenProjectArtifacts: (projectId: string) => void;
  onAddProjectAgentAssignment: (
    projectId: string,
    agentId: string,
    initialStages?: ActiveWorkflowStage[],
  ) => void;
  onRemoveProjectAgentAssignment: (projectId: string, agentId: string) => void;
  onUpdateProjectAgentAssignment: (
    projectId: string,
    agentId: string,
    patch: Partial<Omit<ProjectAgentAssignment, 'agentId'>>,
  ) => void;
  onAssignExpertToWorkspace: (expertId: string, workspaceId: string) => void;
  onRemoveExpertFromWorkspace: (expertId: string, workspaceId: string) => void;
  onAddProjectTaskType: (
    projectId: string,
    input: {
      name: string;
      description: string;
      templateChecklist?: string;
      accent: TaskTypeAccent;
      creatorAgentIds?: string[];
    },
  ) => void;
  onUpdateProjectTaskType: (
    projectId: string,
    typeId: string,
    patch: Partial<Omit<ProjectTaskType, 'id'>>,
  ) => void;
  onDeleteProjectTaskType: (projectId: string, typeId: string) => void;
  onApplyTaskTypePresetPack: (projectId: string, packId: TaskTemplatePackId) => void;
  onStartTemplateConversation: (
    projectId: string,
    taskTypeId: string,
    options?: { prompt?: string; creatorAgentId?: string; autoSend?: boolean },
  ) => void;
  onUpdateProjectLifecycle: (projectId: string, status: ProjectLifecycleStatus) => void;
  onJumpToTeam: () => void;
  onJumpToMarket: () => void;
}

const STAGE_OPTIONS: { id: ActiveWorkflowStage; label: string }[] = [
  { id: 'planning', label: '计划' },
  { id: 'development', label: '执行' },
  { id: 'testing', label: '验收' },
];

export function ProjectGroupSettingsDrawer({
  open,
  onClose,
  workspace,
  linkedZone,
  account,
  tasks,
  projectArtifactCount,
  allAgents,
  humanExperts,
  teamExperts,
  agentLeases,
  assignments,
  taskTypes,
  computeNodes,
  spaceSharedNodes,
  zones,
  storageVolumes,
  kanbanPinned,
  onToggleKanbanPinned,
  onOpenKanbanOverlay,
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
  onJumpToTeam,
  onJumpToMarket,
}: ProjectGroupSettingsDrawerProps) {
  const [removeMode, setRemoveMode] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addTab, setAddTab] = useState<'agent' | 'human'>('agent');
  const [selectedAddAgentId, setSelectedAddAgentId] = useState('');
  const [selectedStages, setSelectedStages] = useState<ActiveWorkflowStage[]>(['development']);
  const [orchestrationOpen, setOrchestrationOpen] = useState(false);

  const isReadOnly =
    workspace.lifecycleStatus === 'completed' || workspace.lifecycleStatus === 'archived';
  const effectiveTaskTypes = taskTypes.length > 0 ? taskTypes : DEFAULT_PROJECT_TASK_TYPES;

  const agentMap = useMemo(() => new Map(allAgents.map((a) => [a.id, a])), [allAgents]);
  const humanMap = useMemo(() => new Map(humanExperts.map((h) => [h.id, h])), [humanExperts]);

  const assignedAgents = useMemo(() => {
    return assignments
      .map((item) => ({
        assignment: item,
        agent: agentMap.get(item.agentId),
      }))
      .filter((x): x is { assignment: ProjectAgentAssignment; agent: ExpertAgent } =>
        Boolean(x.agent),
      );
  }, [agentMap, assignments]);

  const assignedAgentIdSet = useMemo(
    () => new Set(assignments.map((a) => a.agentId)),
    [assignments],
  );

  const availableAgentsToAdd = useMemo(
    () => allAgents.filter((a) => !assignedAgentIdSet.has(a.id)),
    [allAgents, assignedAgentIdSet],
  );

  const assignedHumans = useMemo(() => {
    return teamExperts
      .filter((m) => m.assignedWorkspaceIds.includes(workspace.id))
      .map((m) => humanMap.get(m.expertId))
      .filter((h): h is HumanExpert => Boolean(h));
  }, [humanMap, teamExperts, workspace.id]);

  const availableHumansToAdd = useMemo(() => {
    const assignedIds = new Set(assignedHumans.map((h) => h.id));
    return teamExperts
      .filter((m) => !assignedIds.has(m.expertId))
      .map((m) => humanMap.get(m.expertId))
      .filter((h): h is HumanExpert => Boolean(h));
  }, [assignedHumans, humanMap, teamExperts]);

  const boundNodeLabels = useMemo(() => {
    const nodeMap = new Map(computeNodes.map((n) => [n.id, n.name]));
    const sharedMap = new Map(spaceSharedNodes.map((n) => [n.id, n.name]));
    return (workspace.boundNodeIds || [])
      .map((id) => nodeMap.get(id) || sharedMap.get(id))
      .filter((v): v is string => Boolean(v));
  }, [computeNodes, spaceSharedNodes, workspace.boundNodeIds]);

  const boundVolume = useMemo(
    () =>
      workspace.storageVolumeId
        ? storageVolumes.find((v) => v.id === workspace.storageVolumeId)
        : undefined,
    [storageVolumes, workspace.storageVolumeId],
  );

  const pendingCount = tasks.filter((t) => t.status === 'pending').length;
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length;
  const reviewCount = tasks.filter((t) => t.status === 'review').length;

  const handleOpenAddMember = () => {
    setSelectedAddAgentId(availableAgentsToAdd[0]?.id || '');
    setSelectedStages(['development']);
    setAddTab(availableAgentsToAdd.length > 0 ? 'agent' : 'human');
    setAddMemberOpen(true);
  };

  const handleToggleStage = (stage: ActiveWorkflowStage) => {
    setSelectedStages((prev) =>
      prev.includes(stage)
        ? prev.length > 1
          ? prev.filter((s) => s !== stage)
          : prev
        : [...prev, stage],
    );
  };

  const handleConfirmAddAgent = (e: FormEvent) => {
    e.preventDefault();
    const targetId = selectedAddAgentId || availableAgentsToAdd[0]?.id;
    if (!targetId) return;
    onAddProjectAgentAssignment(workspace.id, targetId, selectedStages);
    setAddMemberOpen(false);
  };

  if (!open) return null;

  return (
    <>
      <aside
        aria-label="项目群设置"
        className="fixed inset-y-0 right-0 z-30 lg:static lg:z-auto w-[348px] max-w-[92vw] shrink-0 border-l border-slate-200/80 bg-[#FAFAFA] flex flex-col h-full shadow-2xl lg:shadow-none"
      >
        {/* Drawer Header */}
        <div className="h-[60px] px-4 border-b border-slate-200 bg-white flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900">群聊设置</h3>
            <p className="text-[11px] text-slate-500 truncate">
              {assignedAgents.length + assignedHumans.length + 1} 位群成员 · {workspace.name}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setRemoveMode(false);
              onClose();
            }}
            aria-label="关闭群设置"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable WeChat-style Settings Content */}
        <div className="flex-1 overflow-y-auto clean-scroll p-4 space-y-4">
          {/* 1. WeChat-style Member Grid (Owner + Agents + Human Experts + '+' / '-') */}
          <section className="rounded-xl border border-slate-200/80 bg-white p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">
                群成员与 Agent 专家 ({assignedAgents.length + assignedHumans.length + 1})
              </span>
              {removeMode && (
                <button
                  type="button"
                  onClick={() => setRemoveMode(false)}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  完成
                </button>
              )}
            </div>

            <div className="grid grid-cols-4 gap-x-2 gap-y-3">
              {/* Current Owner */}
              <div className="flex flex-col items-center gap-1 min-w-0">
                <EntityAvatar
                  kind="human"
                  code={account?.avatarInitials || '我'}
                  accent="#0f172a"
                  size="md"
                />
                <span className="text-[11px] font-medium text-slate-700 truncate w-full text-center">
                  {account?.name || '我'}
                </span>
                <span className="text-[9.5px] text-slate-400 leading-none">群主</span>
              </div>

              {/* Project Expert Agents */}
              {assignedAgents.map(({ agent }) => (
                <div
                  key={agent.id}
                  className="relative flex flex-col items-center gap-1 min-w-0 group"
                >
                  <div className="relative">
                    <EntityAvatar
                      kind="agent"
                      code={agent.avatarCode}
                      accent={agent.avatarAccent}
                      size="md"
                      showCornerMark
                    />
                    {removeMode && !isReadOnly && (
                      <button
                        type="button"
                        onClick={() => onRemoveProjectAgentAssignment(workspace.id, agent.id)}
                        title={`将 ${displayEntityName(agent.name)} 移出本项目群`}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xs hover:bg-red-700 cursor-pointer"
                      >
                        <Minus className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                  <span
                    className="text-[11px] font-medium text-slate-700 truncate w-full text-center"
                    title={displayEntityName(agent.name)}
                  >
                    {displayEntityName(agent.name)}
                  </span>
                  <span className="text-[9.5px] text-slate-400 truncate w-full text-center leading-none">
                    {agent.runtimeAgent || 'Agent'}
                  </span>
                </div>
              ))}

              {/* Project Agent Principals */}
              {assignedHumans.map((expert) => {
                const roleMeta = PRINCIPAL_ROLE_META[expert.principalType];
                return (
                  <div
                    key={expert.id}
                    className="relative flex flex-col items-center gap-1 min-w-0"
                  >
                    <div className="relative">
                      <EntityAvatar
                        kind="human"
                        code={expert.avatarInitials}
                        accent={expert.avatarAccent}
                        size="md"
                      />
                      {removeMode && !isReadOnly && (
                        <button
                          type="button"
                          onClick={() => onRemoveExpertFromWorkspace(expert.id, workspace.id)}
                          title={`将 ${expert.name} 移出本项目群`}
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xs hover:bg-red-700 cursor-pointer"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                    <span
                      className="text-[11px] font-medium text-slate-700 truncate w-full text-center"
                      title={`${expert.name} · ${roleMeta.label}`}
                    >
                      {expert.name}
                    </span>
                    <span className={`text-[9.5px] font-medium leading-none truncate ${roleMeta.textCls}`}>
                      {roleMeta.shortLabel}
                    </span>
                  </div>
                );
              })}

              {/* WeChat-style '+' Add Member Tile */}
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={handleOpenAddMember}
                  className="flex flex-col items-center gap-1 cursor-pointer group"
                  title="拉入 Agent 专家或人类协作者"
                >
                  <span className="w-9 h-9 rounded-lg border border-dashed border-slate-300 group-hover:border-blue-500 group-hover:bg-blue-50/60 text-slate-400 group-hover:text-blue-600 flex items-center justify-center transition-colors">
                    <Plus className="w-4 h-4" />
                  </span>
                  <span className="text-[11px] font-medium text-slate-500 group-hover:text-blue-700">
                    加人
                  </span>
                </button>
              )}

              {/* WeChat-style '-' Remove Mode Tile */}
              {!isReadOnly && assignedAgents.length + assignedHumans.length > 0 && (
                <button
                  type="button"
                  onClick={() => setRemoveMode((v) => !v)}
                  className="flex flex-col items-center gap-1 cursor-pointer group"
                  title={removeMode ? '退出移除模式' : '移除群成员'}
                >
                  <span
                    className={`w-9 h-9 rounded-lg border border-dashed flex items-center justify-center transition-colors ${
                      removeMode
                        ? 'border-red-400 bg-red-50 text-red-600'
                        : 'border-slate-300 group-hover:border-slate-400 text-slate-400 group-hover:text-slate-700'
                    }`}
                  >
                    <Minus className="w-4 h-4" />
                  </span>
                  <span
                    className={`text-[11px] font-medium ${
                      removeMode ? 'text-red-600' : 'text-slate-500'
                    }`}
                  >
                    {removeMode ? '退出' : '移除'}
                  </span>
                </button>
              )}
            </div>
          </section>

          {/* 2. Project Tools: Kanban Floating Widget Toggle + Open Kanban + Orchestration + Artifacts */}
          <section className="rounded-xl border border-slate-200/80 bg-white divide-y divide-slate-100 overflow-hidden">
            {/* Toggle Pinned Top Kanban Widget */}
            <div className="px-3.5 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Pin className="w-4 h-4 text-blue-600 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-800">置顶项目看板小组件</div>
                  <div className="text-[11px] text-slate-500 truncate">
                    在聊天顶部悬浮显示，随时一键展开
                  </div>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={kanbanPinned}
                onClick={onToggleKanbanPinned}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                  kanbanPinned ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform ${
                    kanbanPinned ? 'translate-x-4.5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Open Floating Kanban Overlay Immediately */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenKanbanOverlay();
              }}
              className="w-full px-3.5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <KanbanSquare className="w-4 h-4 text-slate-600 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-800">打开项目看板</div>
                  <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                    计划 {pendingCount} · 执行 {inProgressCount} · 验收 {reviewCount}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>

            {/* Open Task Orchestration Modal */}
            <button
              type="button"
              onClick={() => setOrchestrationOpen(true)}
              className="w-full px-3.5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <GitBranch className="w-4 h-4 text-slate-600 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-800">任务编排与工作流模板</div>
                  <div className="text-[11px] text-slate-500">
                    {assignedAgents.length} 位编排专家 · {effectiveTaskTypes.length} 类任务模板
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>

            {/* Jump to Project Artifacts */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenProjectArtifacts(workspace.id);
              }}
              className="w-full px-3.5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Shapes className="w-4 h-4 text-slate-600 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-800">项目产出物 Artifacts</div>
                  <div className="text-[11px] text-slate-500">
                    已沉淀 <span className="font-mono tabular-nums">{projectArtifactCount}</span> 份交付产物
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
          </section>

          {/* 3. Project Information & Bound Infrastructure */}
          <section className="rounded-xl border border-slate-200/80 bg-white divide-y divide-slate-100 text-xs">
            <div className="px-3.5 py-3 space-y-1">
              <div className="text-[11px] text-slate-400">群聊名称与目标</div>
              <div className="font-semibold text-slate-900">{workspace.name}</div>
              <p className="text-[11.5px] text-slate-600 leading-relaxed">{workspace.goal}</p>
            </div>

            <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
              <span className="text-slate-500 shrink-0">归属空间</span>
              <span className="font-medium text-slate-800 truncate">
                {linkedZone ? linkedZone.name : '个人私有项目'}
              </span>
            </div>

            <div className="px-3.5 py-2.5 flex items-start justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-slate-500 shrink-0">
                <Server className="w-3.5 h-3.5 text-slate-400" />
                <span>算力节点</span>
              </span>
              <span className="font-medium text-slate-800 text-right truncate">
                {boundNodeLabels.length > 0 ? boundNodeLabels.join('、') : '按 Agent 节点自动调度'}
              </span>
            </div>

            <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-slate-500 shrink-0">
                <Database className="w-3.5 h-3.5 text-slate-400" />
                <span>共享存储卷</span>
              </span>
              <span className="font-medium text-slate-800 truncate">
                {boundVolume ? boundVolume.name : '默认工作区存储'}
              </span>
            </div>
          </section>

          {/* 4. Project Lifecycle Actions */}
          <section className="rounded-xl border border-slate-200/80 bg-white divide-y divide-slate-100 overflow-hidden">
            {isReadOnly ? (
              <button
                type="button"
                onClick={() => onUpdateProjectLifecycle(workspace.id, 'active')}
                className="w-full px-3.5 py-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50/70 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>重新激活项目群</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onUpdateProjectLifecycle(workspace.id, 'completed')}
                  className="w-full px-3.5 py-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50/60 transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>标记项目已完成</span>
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateProjectLifecycle(workspace.id, 'archived')}
                  className="w-full px-3.5 py-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>归档项目（转为只读）</span>
                </button>
              </>
            )}
          </section>
        </div>
      </aside>

      {/* Modal 1: Add Agent / Human Expert into Project Group */}
      <ModalShell
        open={addMemberOpen}
        onClose={() => setAddMemberOpen(false)}
        icon={<UserPlus className="w-4 h-4 text-blue-600" />}
        title="添加 Agent 专家 / Agent 主理"
        subtitle={`将专家 Agent 或主理（FDE / OPC / AI Builder）拉入「${workspace.name}」项目群协同交付`}
        maxWidthClass="max-w-lg"
        onSubmit={addTab === 'agent' ? handleConfirmAddAgent : undefined}
        footer={
          addTab === 'agent' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setAddMemberOpen(false);
                  onClose();
                  onJumpToMarket();
                }}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
              >
                去 AGN社区 雇佣更多 Agent →
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setAddMemberOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={availableAgentsToAdd.length === 0}
                  className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  拉入项目群
                </button>
              </div>
            </>
          ) : (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={() => setAddMemberOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                完成
              </button>
            </div>
          )
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setAddTab('agent')}
              className={`py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                addTab === 'agent'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Agent 专家 ({availableAgentsToAdd.length})
            </button>
            <button
              type="button"
              onClick={() => setAddTab('human')}
              className={`py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                addTab === 'human'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Agent 主理 ({availableHumansToAdd.length})
            </button>
          </div>

          {addTab === 'agent' ? (
            availableAgentsToAdd.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                当前所有可用 Agent 专家均已在本项目群中，可前往 AGN社区 雇佣新专家。
              </div>
            ) : (
              <div className="space-y-3.5">
                <div className="max-h-56 overflow-y-auto clean-scroll space-y-1.5 pr-1">
                  {availableAgentsToAdd.map((ag) => {
                    const active = (selectedAddAgentId || availableAgentsToAdd[0]?.id) === ag.id;
                    return (
                      <button
                        key={ag.id}
                        type="button"
                        onClick={() => setSelectedAddAgentId(ag.id)}
                        className={`w-full text-left p-2.5 rounded-xl border transition-colors flex items-center gap-3 cursor-pointer ${
                          active
                            ? 'border-blue-600 bg-blue-50/50'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <EntityAvatar
                          kind="agent"
                          code={ag.avatarCode}
                          accent={ag.avatarAccent}
                          size="sm"
                          showCornerMark
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-slate-900 truncate">
                            <AgentIdentityName
                              name={displayEntityName(ag.name)}
                              runtime={ag.runtimeAgent}
                              model={ag.defaultModel}
                            />
                          </div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5">
                            {ag.title}
                            {ag.skills.length > 0 ? ` · ${ag.skills.slice(0, 2).join(' / ')}` : ''}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-700 mb-1.5">
                    分配承接的工作流阶段
                  </div>
                  <div className="flex items-center gap-2">
                    {STAGE_OPTIONS.map((st) => {
                      const checked = selectedStages.includes(st.id);
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => handleToggleStage(st.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                            checked
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {st.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )
          ) : availableHumansToAdd.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              合作主理均已加入本项目群，可在 AGN空间 添加更多 FDE / OPC / AI Builder 主理。
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto clean-scroll divide-y divide-slate-200/75 border-t border-slate-200/75">
              {availableHumansToAdd.map((expert) => {
                const roleMeta = PRINCIPAL_ROLE_META[expert.principalType];
                return (
                  <div
                    key={expert.id}
                    className="py-2.5 px-1 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <EntityAvatar
                        kind="human"
                        code={expert.avatarInitials}
                        accent={expert.avatarAccent}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="font-semibold text-slate-900 truncate">
                            {expert.name}
                          </span>
                          <span className={`text-[11px] font-semibold shrink-0 ${roleMeta.textCls}`}>
                            {roleMeta.shortLabel}
                          </span>
                          <span className="text-slate-300" aria-hidden="true">·</span>
                          <span className="text-[11px] text-slate-500 shrink-0">
                            {DOMAIN_CATEGORY_LABELS[expert.category]}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          {expert.outsourcingDomain || expert.title}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onAssignExpertToWorkspace(expert.id, workspace.id)}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white whitespace-nowrap cursor-pointer shrink-0"
                    >
                      拉入群聊
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ModalShell>

      {/* Modal 2: Full Project Task Orchestration & Workflow Templates */}
      <ModalShell
        open={orchestrationOpen}
        onClose={() => setOrchestrationOpen(false)}
        icon={<GitBranch className="w-4 h-4 text-blue-600" />}
        title={`任务编排与模板 · ${workspace.name}`}
        subtitle="配置多 Agent 在计划、执行、验收三阶段的接力分工与标准任务模板"
        maxWidthClass="max-w-5xl"
      >
        <ProjectOrchestrationPanel
          project={workspace}
          assignments={assignments}
          taskTypes={effectiveTaskTypes}
          agents={allAgents}
          agentLeases={agentLeases}
          computeNodes={computeNodes}
          spaceSharedNodes={spaceSharedNodes}
          zones={zones}
          storageVolumes={storageVolumes}
          onAddAgentAssignment={onAddProjectAgentAssignment}
          onRemoveAgentAssignment={onRemoveProjectAgentAssignment}
          onUpdateAgentAssignment={onUpdateProjectAgentAssignment}
          onAddTaskType={onAddProjectTaskType}
          onUpdateTaskType={onUpdateProjectTaskType}
          onDeleteTaskType={onDeleteProjectTaskType}
          onApplyTaskTypePresetPack={onApplyTaskTypePresetPack}
          onStartTemplateConversation={(pid, typeId, opts) => {
            setOrchestrationOpen(false);
            onClose();
            onStartTemplateConversation(pid, typeId, opts);
          }}
          onJumpToSpaceAgents={() => {
            setOrchestrationOpen(false);
            onClose();
            onJumpToTeam();
          }}
          onJumpToMarket={() => {
            setOrchestrationOpen(false);
            onClose();
            onJumpToMarket();
          }}
          onReactivateProject={() => onUpdateProjectLifecycle(workspace.id, 'active')}
        />
      </ModalShell>
    </>
  );
}
