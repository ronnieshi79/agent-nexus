import { useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Check,
  Database,
  GitBranch,
  Layers,
  MessageSquarePlus,
  Pencil,
  Plus,
  Server,
  Sparkles,
  Tag,
  Trash2,
  UserMinus,
  Users,
  X,
} from 'lucide-react';
import type {
  ActiveWorkflowStage,
  CommunityZone,
  ComputeNode,
  ExpertAgent,
  PipelineHandoffMode,
  ProjectAgentAssignment,
  ProjectTaskType,
  ProjectWorkspace,
  SpaceSharedNode,
  StorageVolume,
  TaskTypeAccent,
} from '../../types/agentnexus';
import {
  ACTIVE_WORKFLOW_STAGES,
  DEFAULT_PROJECT_TASK_TYPES,
  TASK_TEMPLATE_PRESET_PACKS,
  TASK_TYPE_ACCENT_OPTIONS,
  TASK_TYPE_ACCENT_STYLES,
  type TaskTemplatePackId,
  getTemplateCreatorIds,
} from '../../utils/pipelineSync';
import {
  AgentIdentityName,
  EntityAvatar,
  displayEntityName,
  formatAgentDisplayName,
} from '../shared/EntityIdentity';

type OrchestrationSubTab = 'agents' | 'templates';

interface ProjectOrchestrationPanelProps {
  project: ProjectWorkspace;
  assignments: ProjectAgentAssignment[];
  taskTypes: ProjectTaskType[];
  agents: ExpertAgent[];
  computeNodes: ComputeNode[];
  spaceSharedNodes?: SpaceSharedNode[];
  zones?: CommunityZone[];
  storageVolumes: StorageVolume[];
  onAddAgentAssignment: (
    projectId: string,
    agentId: string,
    initialStages?: ActiveWorkflowStage[],
  ) => void;
  onRemoveAgentAssignment: (projectId: string, agentId: string) => void;
  onUpdateAgentAssignment: (
    projectId: string,
    agentId: string,
    patch: Partial<Omit<ProjectAgentAssignment, 'agentId'>>,
  ) => void;
  onAddTaskType: (
    projectId: string,
    input: {
      name: string;
      description: string;
      templateChecklist?: string;
      accent: TaskTypeAccent;
      creatorAgentIds?: string[];
    },
  ) => void;
  onUpdateTaskType: (
    projectId: string,
    typeId: string,
    patch: Partial<Omit<ProjectTaskType, 'id'>>,
  ) => void;
  onDeleteTaskType: (projectId: string, typeId: string) => void;
  onApplyTaskTypePresetPack: (projectId: string, packId: TaskTemplatePackId) => void;
  onStartTemplateConversation: (
    projectId: string,
    taskTypeId: string,
    options?: { prompt?: string; creatorAgentId?: string; autoSend?: boolean },
  ) => void;
  onJumpToSpaceAgents: () => void;
}

const STAGE_ACTIVE_BUTTON_CLS: Record<ActiveWorkflowStage, string> = {
  planning: 'bg-slate-900 text-white border-slate-900',
  development: 'bg-blue-600 text-white border-blue-600',
  testing: 'bg-amber-600 text-white border-amber-600',
};

export function ProjectOrchestrationPanel({
  project,
  assignments,
  taskTypes,
  agents,
  computeNodes,
  spaceSharedNodes = [],
  zones = [],
  storageVolumes,
  onAddAgentAssignment,
  onRemoveAgentAssignment,
  onUpdateAgentAssignment,
  onAddTaskType,
  onUpdateTaskType,
  onDeleteTaskType,
  onApplyTaskTypePresetPack,
  onStartTemplateConversation,
  onJumpToSpaceAgents,
}: ProjectOrchestrationPanelProps) {
  const effectiveTaskTypes = taskTypes.length > 0 ? taskTypes : DEFAULT_PROJECT_TASK_TYPES;

  const [subTab, setSubTab] = useState<OrchestrationSubTab>('agents');
  const [selectedAddAgentId, setSelectedAddAgentId] = useState<string>('');
  const [appliedPackId, setAppliedPackId] = useState<TaskTemplatePackId | null>(null);

  // Task Card Template creation & inline editing state
  const [showAddTypeForm, setShowAddTypeForm] = useState(false);
  const [typeName, setTypeName] = useState('');
  const [typeDesc, setTypeDesc] = useState('');
  const [typeChecklist, setTypeChecklist] = useState('');
  const [typeAccent, setTypeAccent] = useState<TaskTypeAccent>('blue');
  const [typeCreatorIds, setTypeCreatorIds] = useState<string[]>([]);

  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editTypeName, setEditTypeName] = useState('');
  const [editTypeDesc, setEditTypeDesc] = useState('');
  const [editTypeChecklist, setEditTypeChecklist] = useState('');
  const [editTypeAccent, setEditTypeAccent] = useState<TaskTypeAccent>('blue');
  const [editTypeCreatorIds, setEditTypeCreatorIds] = useState<string[]>([]);

  const agentMap = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);
  const nodeMap = useMemo(() => new Map(computeNodes.map((n) => [n.id, n])), [computeNodes]);
  const sharedNodeMap = useMemo(
    () => new Map(spaceSharedNodes.map((n) => [n.id, n])),
    [spaceSharedNodes],
  );
  const zoneMap = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);

  const assignedAgentIds = useMemo(
    () => new Set(assignments.map((a) => a.agentId)),
    [assignments],
  );

  const projectAgents = useMemo(
    () =>
      assignments
        .map((a) => agentMap.get(a.agentId))
        .filter((a): a is ExpertAgent => Boolean(a)),
    [agentMap, assignments],
  );

  const availableAgentsToAdd = useMemo(
    () => agents.filter((a) => !assignedAgentIds.has(a.id)),
    [agents, assignedAgentIds],
  );
  const availablePrivateAgents = useMemo(
    () => availableAgentsToAdd.filter((a) => a.ownership === 'private'),
    [availableAgentsToAdd],
  );
  const availableMarketAgents = useMemo(
    () => availableAgentsToAdd.filter((a) => a.ownership === 'marketplace'),
    [availableAgentsToAdd],
  );

  const effectiveAddAgentId =
    selectedAddAgentId && availableAgentsToAdd.some((a) => a.id === selectedAddAgentId)
      ? selectedAddAgentId
      : availableAgentsToAdd[0]?.id || '';

  const agentsByActiveStage = useMemo(() => {
    const map: Record<ActiveWorkflowStage, ExpertAgent[]> = {
      planning: [],
      development: [],
      testing: [],
    };
    for (const item of assignments) {
      const ag = agentMap.get(item.agentId);
      if (!ag) continue;
      for (const stage of item.stages) {
        map[stage].push(ag);
      }
    }
    return map;
  }, [agentMap, assignments]);

  const resolveHostNode = (nodeId?: string) => {
    if (!nodeId) return undefined;
    const personal = nodeMap.get(nodeId);
    if (personal) return { name: personal.name, isShared: false };
    const shared = sharedNodeMap.get(nodeId);
    if (shared) {
      const z = zoneMap.get(shared.zoneId);
      return {
        name: `${z ? `${z.shortCode}共享·` : '空间共享·'}${shared.name}`,
        isShared: true,
      };
    }
    return undefined;
  };

  const boundNodeLabels = (project.boundNodeIds || [])
    .map((id) => resolveHostNode(id)?.name)
    .filter((v): v is string => Boolean(v));
  const boundVolume = project.storageVolumeId
    ? storageVolumes.find((v) => v.id === project.storageVolumeId)
    : undefined;

  const handleAddExpert = () => {
    if (!effectiveAddAgentId) return;
    onAddAgentAssignment(project.id, effectiveAddAgentId);
    setSelectedAddAgentId('');
  };

  const handleToggleAgentStage = (
    item: ProjectAgentAssignment,
    stage: ActiveWorkflowStage,
  ) => {
    const hasStage = item.stages.includes(stage);
    const nextStages = hasStage
      ? item.stages.filter((s) => s !== stage)
      : [...item.stages, stage];
    if (nextStages.length === 0) return;
    onUpdateAgentAssignment(project.id, item.agentId, { stages: nextStages });
  };

  const toggleCreatorId = (list: string[], id: string): string[] =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const handleAddTypeSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!typeName.trim()) return;
    onAddTaskType(project.id, {
      name: typeName.trim(),
      description: typeDesc.trim(),
      templateChecklist: typeChecklist.trim() || undefined,
      accent: typeAccent,
      creatorAgentIds: typeCreatorIds,
    });
    setTypeName('');
    setTypeDesc('');
    setTypeChecklist('');
    setTypeAccent('blue');
    setTypeCreatorIds([]);
    setShowAddTypeForm(false);
  };

  const startEditType = (item: ProjectTaskType) => {
    setEditingTypeId(item.id);
    setEditTypeName(item.name);
    setEditTypeDesc(item.description);
    setEditTypeChecklist(item.templateChecklist || '');
    setEditTypeAccent(item.accent);
    setEditTypeCreatorIds(getTemplateCreatorIds(item));
  };

  const saveEditType = (typeId: string) => {
    if (!editTypeName.trim()) return;
    onUpdateTaskType(project.id, typeId, {
      name: editTypeName.trim(),
      description: editTypeDesc.trim() || '自定义任务卡片模板',
      templateChecklist: editTypeChecklist.trim() || undefined,
      accent: editTypeAccent,
      creatorAgentIds: editTypeCreatorIds,
    });
    setEditingTypeId(null);
  };

  const handleApplyPack = (packId: TaskTemplatePackId) => {
    onApplyTaskTypePresetPack(project.id, packId);
    setAppliedPackId(packId);
    setEditingTypeId(null);
    setTimeout(() => setAppliedPackId((cur) => (cur === packId ? null : cur)), 1800);
  };

  return (
    <div className="space-y-4">
      {/* Compact Orchestration Summary: Project Info + Embedded Concurrent Stage-Expert List */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
            <GitBranch className="w-4 h-4 text-blue-600 shrink-0" />
            <h2 className="text-sm font-bold text-slate-900">
              {project.name} · 任务编排
            </h2>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span className="text-xs text-slate-500">
              同阶段支持多位专家并发执行，增删配置自动同步项目阵容
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Server className="w-3.5 h-3.5 text-slate-400" />
              <span>
                算力节点：
                {boundNodeLabels.length > 0
                  ? boundNodeLabels.join('、')
                  : '按专家 Agent 宿主机自动调度'}
              </span>
            </span>
            {boundVolume && (
              <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                <Database className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {boundVolume.name} ({boundVolume.usedGb}/{boundVolume.quotaGb}GB)
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Embedded Plain Stage → Concurrent Experts List (With Host Runtime Prefix) */}
        <ul className="border-t border-slate-100 bg-slate-50/40 px-4 py-2.5 space-y-1.5 text-xs">
          {ACTIVE_WORKFLOW_STAGES.map((stageMeta) => {
            const stationedAgents = agentsByActiveStage[stageMeta.stage];
            return (
              <li key={stageMeta.stage} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="inline-flex items-center gap-1.5 shrink-0 font-semibold text-slate-600">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${stageMeta.dotCls}`} />
                  <span>{stageMeta.label}：</span>
                </span>
                {stationedAgents.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                    {stationedAgents.map((a, idx) => (
                      <span key={a.id} className="inline-flex items-center gap-1 text-slate-800">
                        <AgentIdentityName
                          name={a.handle}
                          runtime={a.runtimeAgent}
                          className="text-xs font-medium text-slate-800"
                        />
                        {idx < stationedAgents.length - 1 && (
                          <span className="text-slate-300" aria-hidden="true">、</span>
                        )}
                      </span>
                    ))}
                    {stationedAgents.length > 1 && (
                      <span className="font-mono text-[10.5px] font-semibold text-slate-400">
                        ({stationedAgents.length} 位并发)
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-amber-700">未配置驻守专家</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Parallel Tabbed Orchestration Surface (Unrestricted Vertical Space for Active Tab) */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Top Tab Bar + Contextual Actions */}
        <div className="px-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1" role="tablist" aria-label="任务编排视图切换">
            <button
              type="button"
              role="tab"
              aria-selected={subTab === 'agents'}
              onClick={() => setSubTab('agents')}
              className={`inline-flex items-center gap-1.5 px-3 py-3 text-xs font-bold border-b-2 -mb-px cursor-pointer whitespace-nowrap transition-colors ${
                subTab === 'agents'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>专家 Agent 编排</span>
              <span className="font-mono text-[11px] font-semibold text-slate-400">
                {assignments.length}
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={subTab === 'templates'}
              onClick={() => setSubTab('templates')}
              className={`inline-flex items-center gap-1.5 px-3 py-3 text-xs font-bold border-b-2 -mb-px cursor-pointer whitespace-nowrap transition-colors ${
                subTab === 'templates'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>任务卡片模板</span>
              <span className="font-mono text-[11px] font-semibold text-slate-400">
                {effectiveTaskTypes.length}
              </span>
            </button>
          </div>

          {/* Contextual Right Controls */}
          <div className="py-2 flex flex-wrap items-center gap-2 shrink-0">
            {subTab === 'agents' ? (
              availableAgentsToAdd.length > 0 ? (
                <>
                  <select
                    value={effectiveAddAgentId}
                    onChange={(e) => setSelectedAddAgentId(e.target.value)}
                    aria-label="选择要加入项目的专家 Agent"
                    className="h-8 max-w-[220px] rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  >
                    {availablePrivateAgents.length > 0 && (
                      <optgroup label="自建专业 Agent（Agent 团队）">
                        {availablePrivateAgents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {formatAgentDisplayName(a.handle, a.runtimeAgent)}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {availableMarketAgents.length > 0 && (
                      <optgroup label="市场专家 Agent">
                        {availableMarketAgents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {formatAgentDisplayName(a.handle, a.runtimeAgent)}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddExpert}
                    className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>添加专家</span>
                  </button>
                </>
              ) : (
                <span className="text-[11px] text-slate-400">全部可用专家均已加入该项目</span>
              )
            ) : (
              <>
                <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 border border-slate-200/80">
                  <span className="inline-flex items-center gap-1 px-2 text-[10.5px] font-semibold text-slate-500 whitespace-nowrap">
                    <Layers className="w-3 h-3 text-slate-400" />
                    <span>模板套件</span>
                  </span>
                  {TASK_TEMPLATE_PRESET_PACKS.map((pack) => {
                    const isApplied = appliedPackId === pack.id;
                    return (
                      <button
                        key={pack.id}
                        type="button"
                        title={`${pack.summary}（点击一键切换本项目卡片模板）`}
                        onClick={() => handleApplyPack(pack.id)}
                        className={`h-7 px-2.5 rounded-md text-[11px] font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                          isApplied
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        {isApplied ? `已切换·${pack.label.slice(0, 4)}` : pack.label}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddTypeForm((v) => !v)}
                  className={`inline-flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                    showAddTypeForm
                      ? 'bg-slate-200 text-slate-800'
                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                  }`}
                >
                  {showAddTypeForm ? (
                    <X className="w-3.5 h-3.5" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>{showAddTypeForm ? '取消创作' : '创作卡片模板'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* TAB 1: Expert Agent Roster & Workflow Position Assignment */}
        {subTab === 'agents' && (
          <div>
            {assignments.length === 0 ? (
              <div className="px-4 py-12 text-center text-xs text-slate-400">
                当前项目暂未编排专家 Agent，请在右上角选择专家并点击「添加专家」。
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                      <th className="py-2.5 pl-4 pr-3 whitespace-nowrap">专家 Agent</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">工作流位置（计划 / 执行 / 验证）</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">项目职责</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">交接方式</th>
                      <th className="py-2.5 pl-3 pr-4 text-right whitespace-nowrap">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {assignments.map((item) => {
                      const agent = agentMap.get(item.agentId);
                      if (!agent) return null;
                      const hostNode = resolveHostNode(agent.hostNodeId);

                      return (
                        <tr key={item.agentId} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 pl-4 pr-3 align-middle">
                            <div className="flex items-center gap-2.5 min-w-[200px]">
                              <EntityAvatar
                                kind="agent"
                                code={agent.avatarCode}
                                accent={agent.avatarAccent}
                                size="sm"
                              />
                              <div className="min-w-0">
                                <AgentIdentityName
                                  name={agent.handle}
                                  runtime={agent.runtimeAgent}
                                  model={agent.defaultModel}
                                  showModel
                                  className="text-xs font-bold text-slate-900"
                                />
                                <div className="mt-0.5 text-[10.5px] truncate">
                                  {hostNode ? (
                                    <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                                      <Server className="w-3 h-3 shrink-0" />
                                      <span className="truncate">{hostNode.name}</span>
                                    </span>
                                  ) : agent.ownership === 'marketplace' ? (
                                    <span className="inline-flex items-center gap-1 text-indigo-700 font-medium">
                                      <Sparkles className="w-3 h-3 shrink-0" />
                                      <span>云端专家 · {agent.region}</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-amber-700">
                                      <AlertTriangle className="w-3 h-3 shrink-0" />
                                      <span>未绑定节点</span>
                                      <button
                                        type="button"
                                        onClick={onJumpToSpaceAgents}
                                        className="underline font-semibold ml-0.5 cursor-pointer"
                                      >
                                        去绑定
                                      </button>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-2.5 px-2.5 align-middle whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              {ACTIVE_WORKFLOW_STAGES.map((st) => {
                                const active = item.stages.includes(st.stage);
                                const isOnlyOne = active && item.stages.length === 1;
                                return (
                                  <button
                                    key={st.stage}
                                    type="button"
                                    disabled={isOnlyOne}
                                    onClick={() => handleToggleAgentStage(item, st.stage)}
                                    title={
                                      isOnlyOne
                                        ? '每位专家至少保留 1 个工作流位置'
                                        : active
                                          ? `点击取消「${st.label}」位置`
                                          : `点击加入「${st.label}」位置`
                                    }
                                    className={`h-7 px-2 rounded-md border text-[11px] font-semibold transition-colors whitespace-nowrap ${
                                      active
                                        ? `${STAGE_ACTIVE_BUTTON_CLS[st.stage]} ${
                                            isOnlyOne ? 'cursor-default' : 'cursor-pointer'
                                          }`
                                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-800 cursor-pointer'
                                    }`}
                                  >
                                    {st.shortLabel}
                                  </button>
                                );
                              })}
                            </div>
                          </td>

                          <td className="py-2.5 px-3 align-middle min-w-[180px]">
                            <input
                              type="text"
                              value={item.roleNote}
                              onChange={(e) =>
                                onUpdateAgentAssignment(project.id, item.agentId, {
                                  roleNote: e.target.value,
                                })
                              }
                              aria-label={`${agent.handle} 在本项目的职责`}
                              placeholder="如：需求拆解与方案评审"
                              className="w-full h-7 rounded-md border border-slate-200 bg-slate-50/70 px-2.5 text-[11.5px] text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                            />
                          </td>

                          <td className="py-2.5 px-3 align-middle whitespace-nowrap">
                            <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-md">
                              {(
                                [
                                  { id: 'manual', label: '人工确认' },
                                  { id: 'auto', label: '自动流转' },
                                ] as { id: PipelineHandoffMode; label: string }[]
                              ).map((mode) => (
                                <button
                                  key={mode.id}
                                  type="button"
                                  onClick={() =>
                                    onUpdateAgentAssignment(project.id, item.agentId, {
                                      handoffMode: mode.id,
                                    })
                                  }
                                  className={`px-2 py-1 rounded text-[10.5px] font-semibold cursor-pointer transition-colors ${
                                    item.handoffMode === mode.id
                                      ? 'bg-white text-slate-900 shadow-2xs'
                                      : 'text-slate-500 hover:text-slate-800'
                                  }`}
                                >
                                  {mode.label}
                                </button>
                              ))}
                            </div>
                          </td>

                          <td className="py-2.5 pl-2 pr-4 align-middle text-right whitespace-nowrap">
                            <button
                              type="button"
                              disabled={assignments.length <= 1}
                              onClick={() => onRemoveAgentAssignment(project.id, item.agentId)}
                              title={
                                assignments.length <= 1
                                  ? '项目至少保留 1 位专家 Agent'
                                  : `将 ${agent.handle} 移出本项目`
                              }
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                              <span>移出</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Task Card Templates + Designated Conversation-Creator Agent(s) */}
        {subTab === 'templates' && (
          <div>
            {showAddTypeForm && (
              <form
                onSubmit={handleAddTypeSubmit}
                className="px-4 py-3.5 bg-slate-50 border-b border-slate-200 space-y-3"
              >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
                  <div className="md:col-span-3 space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">模板名称</label>
                    <input
                      type="text"
                      required
                      value={typeName}
                      onChange={(e) => setTypeName(e.target.value)}
                      placeholder="如：选题策划 / 安全审计"
                      className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </div>

                  <div className="md:col-span-6 space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">场景说明</label>
                    <input
                      type="text"
                      value={typeDesc}
                      onChange={(e) => setTypeDesc(e.target.value)}
                      placeholder="简述该卡片适用的业务场景与目标"
                      className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </div>

                  <div className="md:col-span-3 space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">标识色</label>
                    <div className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 bg-white">
                      {TASK_TYPE_ACCENT_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          title={opt.label}
                          onClick={() => setTypeAccent(opt.id)}
                          className={`w-4 h-4 rounded-full cursor-pointer transition-transform ${opt.dotCls} ${
                            typeAccent === opt.id
                              ? 'ring-2 ring-offset-1 ring-slate-900 scale-110'
                              : 'opacity-70 hover:opacity-100'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">
                    默认交付骨架 / 检查清单（对话创作时自动带给专家 Agent）
                  </label>
                  <input
                    type="text"
                    value={typeChecklist}
                    onChange={(e) => setTypeChecklist(e.target.value)}
                    placeholder="例如：1. 核心目标与受众；2. 执行要点与关键产出；3. 验收检查项"
                    className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-600 mr-1">
                      指定可对话创作 Agent：
                    </span>
                    {projectAgents.length === 0 ? (
                      <span className="text-[11px] text-slate-400">
                        请先在「专家 Agent 编排」中添加项目专家
                      </span>
                    ) : (
                      projectAgents.map((ag) => {
                        const selected = typeCreatorIds.includes(ag.id);
                        return (
                          <button
                            key={ag.id}
                            type="button"
                            onClick={() =>
                              setTypeCreatorIds((cur) => toggleCreatorId(cur, ag.id))
                            }
                            className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-md border text-[11px] font-semibold cursor-pointer transition-colors ${
                              selected
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                            }`}
                          >
                            {selected && <Check className="w-3 h-3" />}
                            <span>{formatAgentDisplayName(ag.handle, ag.runtimeAgent)}</span>
                          </button>
                        );
                      })
                    )}
                    {typeCreatorIds.length === 0 && projectAgents.length > 0 && (
                      <span className="text-[11px] text-slate-400 ml-1">
                        （未指定时默认任意项目专家均可创作）
                      </span>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="h-8 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
                  >
                    保存模板
                  </button>
                </div>
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                    <th className="py-2.5 pl-4 pr-3 whitespace-nowrap">卡片模板</th>
                    <th className="py-2.5 px-3">场景说明与交付骨架</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">指定对话创作 Agent</th>
                    <th className="py-2.5 pl-3 pr-4 text-right whitespace-nowrap">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {effectiveTaskTypes.map((item) => {
                    const style = TASK_TYPE_ACCENT_STYLES[item.accent];
                    const isEditing = editingTypeId === item.id;
                    const creatorIds = getTemplateCreatorIds(item);
                    const creators = creatorIds
                      .map((id) => agentMap.get(id))
                      .filter((a): a is ExpertAgent => Boolean(a));

                    if (isEditing) {
                      return (
                        <tr key={item.id} className="bg-blue-50/40">
                          <td className="py-3 pl-4 pr-3 align-top">
                            <div className="flex items-center gap-1.5">
                              <select
                                value={editTypeAccent}
                                onChange={(e) =>
                                  setEditTypeAccent(e.target.value as TaskTypeAccent)
                                }
                                aria-label="模板标识色"
                                className="h-7 rounded border border-slate-200 bg-white px-1.5 text-[11px]"
                              >
                                {TASK_TYPE_ACCENT_OPTIONS.map((opt) => (
                                  <option key={opt.id} value={opt.id}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="text"
                                value={editTypeName}
                                onChange={(e) => setEditTypeName(e.target.value)}
                                className="w-28 h-7 rounded border border-blue-300 bg-white px-2 text-xs font-semibold text-slate-900 focus:outline-none"
                              />
                            </div>
                          </td>
                          <td className="py-3 px-3 align-top space-y-1.5 min-w-[260px]">
                            <input
                              type="text"
                              value={editTypeDesc}
                              onChange={(e) => setEditTypeDesc(e.target.value)}
                              placeholder="场景说明"
                              className="w-full h-7 rounded border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none"
                            />
                            <input
                              type="text"
                              value={editTypeChecklist}
                              onChange={(e) => setEditTypeChecklist(e.target.value)}
                              placeholder="默认交付骨架 / 检查清单（可选）"
                              className="w-full h-7 rounded border border-slate-200 bg-white px-2 text-[11px] text-slate-600 focus:outline-none"
                            />
                          </td>
                          <td className="py-3 px-3 align-top">
                            <div className="flex flex-wrap gap-1 max-w-[280px]">
                              {projectAgents.map((ag) => {
                                const selected = editTypeCreatorIds.includes(ag.id);
                                return (
                                  <button
                                    key={ag.id}
                                    type="button"
                                    onClick={() =>
                                      setEditTypeCreatorIds((cur) =>
                                        toggleCreatorId(cur, ag.id),
                                      )
                                    }
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10.5px] font-semibold cursor-pointer ${
                                      selected
                                        ? 'bg-blue-600 border-blue-600 text-white'
                                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                                    }`}
                                  >
                                    {selected && <Check className="w-2.5 h-2.5" />}
                                    <span>{displayEntityName(ag.handle)}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                          <td className="py-3 pl-3 pr-4 align-top text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => saveEditType(item.id)}
                                className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-[11px] font-semibold text-white cursor-pointer"
                              >
                                保存
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingTypeId(null)}
                                className="px-2 py-1 rounded border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 cursor-pointer"
                              >
                                取消
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 pl-4 pr-3 align-top whitespace-nowrap">
                          <div className="inline-flex items-center gap-2 pt-0.5">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${style.dotCls}`} />
                            <span className={`font-bold ${style.textCls}`}>{item.name}</span>
                          </div>
                        </td>

                        <td className="py-3 px-3 align-top max-w-[460px]">
                          <div className="text-slate-800 leading-snug">{item.description}</div>
                          {item.templateChecklist && (
                            <div className="mt-0.5 text-[11px] text-slate-400 leading-relaxed line-clamp-1">
                              骨架：{item.templateChecklist}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-3 align-top">
                          {creators.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-2">
                              {creators.map((ag) => (
                                <span
                                  key={ag.id}
                                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-800"
                                >
                                  <EntityAvatar
                                    kind="agent"
                                    code={ag.avatarCode}
                                    accent={ag.avatarAccent}
                                    size="xs"
                                    showCornerMark={false}
                                  />
                                  <AgentIdentityName
                                    name={ag.handle}
                                    runtime={ag.runtimeAgent}
                                    className="text-[11px] font-semibold text-slate-800"
                                  />
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">任意项目专家</span>
                          )}
                        </td>

                        <td className="py-3 pl-3 pr-4 align-top text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onStartTemplateConversation(project.id, item.id)}
                              title={
                                creators.length > 0
                                  ? `与 ${creators
                                      .map((c) => formatAgentDisplayName(c.handle, c.runtimeAgent))
                                      .join(' / ')} 对话创作「${item.name}」任务卡`
                                  : `进入项目群对话创作「${item.name}」任务卡`
                              }
                              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-[11px] font-semibold text-blue-700 cursor-pointer whitespace-nowrap"
                            >
                              <MessageSquarePlus className="w-3.5 h-3.5" />
                              <span>对话创作</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => startEditType(item)}
                              title="编辑卡片模板与指定 Agent"
                              className="p-1.5 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={effectiveTaskTypes.length <= 1}
                              onClick={() => onDeleteTaskType(project.id, item.id)}
                              title={
                                effectiveTaskTypes.length <= 1
                                  ? '至少保留 1 个任务卡片模板'
                                  : `删除「${item.name}」模板`
                              }
                              className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
