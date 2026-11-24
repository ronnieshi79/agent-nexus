import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Cpu,
  Database,
  GitBranch,
  KanbanSquare,
  RefreshCw,
  Server,
  Sparkles,
} from 'lucide-react';
import type {
  CommunityZone,
  ComputeNode,
  ExpertAgent,
  PipelineHandoffMode,
  ProjectStageSlot,
  ProjectWorkspace,
  SpaceSharedNode,
  StorageVolume,
  WorkCardType,
  WorkflowTask,
} from '../../types/agentnexus';
import {
  AGENT_RUNTIME_PRESETS,
  AgentIdentityName,
  EntityAvatar,
  getRuntimePreset,
} from '../shared/EntityIdentity';

const STAGE_ORDER: {
  stage: WorkCardType;
  step: string;
  label: string;
  accentCls: string;
}[] = [
  { stage: 'planning', step: '01', label: '产品策划', accentCls: 'text-indigo-700' },
  { stage: 'development', step: '02', label: '功能开发', accentCls: 'text-blue-700' },
  { stage: 'testing', step: '03', label: '功能测试', accentCls: 'text-teal-700' },
  { stage: 'review', step: '04', label: '架构评审', accentCls: 'text-amber-700' },
];

interface ProjectOrchestrationPanelProps {
  project: ProjectWorkspace;
  slots: ProjectStageSlot[];
  agents: ExpertAgent[];
  computeNodes: ComputeNode[];
  spaceSharedNodes?: SpaceSharedNode[];
  zones?: CommunityZone[];
  storageVolumes: StorageVolume[];
  projectTasks: WorkflowTask[];
  onUpdateStageSlot: (
    projectId: string,
    stage: WorkCardType,
    patch: Partial<Omit<ProjectStageSlot, 'stage'>>,
  ) => void;
  onSyncPipelineToProject: (projectId: string) => void;
  onUpdateAgentRuntimeConfig: (
    agentId: string,
    runtimeAgent: string,
    defaultModel: string,
  ) => void;
  onOpenStageKanban: (projectId: string, workType: WorkCardType) => void;
  onJumpToSpaceAgents: () => void;
}

export function ProjectOrchestrationPanel({
  project,
  slots,
  agents,
  computeNodes,
  spaceSharedNodes = [],
  zones = [],
  storageVolumes,
  projectTasks,
  onUpdateStageSlot,
  onSyncPipelineToProject,
  onUpdateAgentRuntimeConfig,
  onOpenStageKanban,
  onJumpToSpaceAgents,
}: ProjectOrchestrationPanelProps) {
  const [justSynced, setJustSynced] = useState(false);

  const agentMap = new Map(agents.map((a) => [a.id, a]));
  const nodeMap = new Map(computeNodes.map((n) => [n.id, n]));
  const sharedNodeMap = new Map(spaceSharedNodes.map((n) => [n.id, n]));
  const zoneMap = new Map(zones.map((z) => [z.id, z]));
  const privateAgents = agents.filter((a) => a.ownership === 'private');
  const marketAgents = agents.filter((a) => a.ownership === 'marketplace');

  const resolveHostNode = (nodeId?: string) => {
    if (!nodeId) return undefined;
    const personal = nodeMap.get(nodeId);
    if (personal) return { name: personal.name, osVersion: personal.osVersion, isShared: false };
    const shared = sharedNodeMap.get(nodeId);
    if (shared) {
      const z = zoneMap.get(shared.zoneId);
      return {
        name: `${z ? `${z.shortCode}共享 · ` : '空间共享 · '}${shared.name}`,
        osVersion: shared.osVersion,
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

  const slotMap = new Map(slots.map((s) => [s.stage, s]));

  // Unique Agents currently assigned across the 4 stages
  const pipelineAgents = Array.from(
    new Set(
      STAGE_ORDER.map((st) => slotMap.get(st.stage)?.agentId).filter(
        (id): id is string => Boolean(id),
      ),
    ),
  )
    .map((id) => agentMap.get(id))
    .filter((a): a is ExpertAgent => Boolean(a));

  const handleSync = () => {
    onSyncPipelineToProject(project.id);
    setJustSynced(true);
    setTimeout(() => setJustSynced(false), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Project Pipeline Context Header */}
      <section className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <GitBranch className="w-4 h-4 text-blue-600 shrink-0" />
            <h2 className="text-sm font-bold text-slate-900">
              {project.name} · 阶段工位流水线
            </h2>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span className="text-xs text-slate-500">
              为每个交付阶段指定项目内身份、专业 Agent、宿主机载体与下游交接方式
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Server className="w-3.5 h-3.5 text-slate-400" />
              <span>
                项目算力节点：
                {boundNodeLabels.length > 0
                  ? boundNodeLabels.join('、')
                  : '未显式绑定（随工位 Agent 节点运行）'}
              </span>
            </span>
            {boundVolume && (
              <span className="inline-flex items-center gap-1 font-mono">
                <Database className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {boundVolume.name} ({boundVolume.usedGb}/{boundVolume.quotaGb}GB)
                </span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleSync}
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
              justSynced
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
          >
            {justSynced ? <Check className="w-3.5 h-3.5" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span>{justSynced ? '已同步至项目阵容' : '同步工位 Agent 到项目群'}</span>
          </button>
        </div>
      </section>

      {/* 4-Stage Pipeline Cards */}
      <div className="grid grid-cols-1 @[720px]:grid-cols-2 @[1160px]:grid-cols-4 gap-4">
        {STAGE_ORDER.map((meta, idx) => {
          const slot: ProjectStageSlot = slotMap.get(meta.stage) || {
            stage: meta.stage,
            roleTitle: `${meta.label}负责人`,
            agentId: agents[0]?.id || '',
            handoffMode: 'manual',
            deliverableContract: '阶段交付物与验收清单',
          };
          const assignedAgent = agentMap.get(slot.agentId);
          const hostNode = resolveHostNode(assignedAgent?.hostNodeId);
          const stageTasks = projectTasks.filter((t) => t.workType === meta.stage);
          const stageDone = stageTasks.filter((t) => t.status === 'done').length;

          return (
            <article
              key={meta.stage}
              className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between gap-3.5 relative"
            >
              <div className="space-y-3">
                {/* Stage Header */}
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-400">
                      {meta.step}
                    </span>
                    <h3 className={`text-sm font-bold ${meta.accentCls}`}>{meta.label}</h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-mono tabular-nums text-slate-500">
                      {stageDone}/{stageTasks.length} 卡
                    </span>
                    {idx < STAGE_ORDER.length - 1 && (
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300 hidden @[1160px]:inline" />
                    )}
                  </div>
                </div>

                {/* Project Role Title Input */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500">
                    项目内指定身份
                  </label>
                  <input
                    type="text"
                    value={slot.roleTitle}
                    onChange={(e) =>
                      onUpdateStageSlot(project.id, meta.stage, { roleTitle: e.target.value })
                    }
                    className="w-full h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>

                {/* Bound Professional Agent Selector */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-500">
                    绑定专业 Agent
                  </label>
                  <select
                    value={slot.agentId}
                    onChange={(e) =>
                      onUpdateStageSlot(project.id, meta.stage, { agentId: e.target.value })
                    }
                    className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  >
                    {privateAgents.length > 0 && (
                      <optgroup label="自建专业 Agent（Agent 团队）">
                        {privateAgents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.handle} · {a.runtimeAgent}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {marketAgents.length > 0 && (
                      <optgroup label="市场签约 / 租赁专家 Agent">
                        {marketAgents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.handle} · {a.runtimeAgent}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>

                  {assignedAgent && (
                    <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-2.5 space-y-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <EntityAvatar
                          kind="agent"
                          code={assignedAgent.avatarCode}
                          accent={assignedAgent.avatarAccent}
                          size="xs"
                          showCornerMark={false}
                        />
                        <AgentIdentityName
                          name={assignedAgent.handle}
                          runtime={assignedAgent.runtimeAgent}
                          model={assignedAgent.defaultModel}
                          showModel
                          className="text-xs font-bold text-slate-900"
                        />
                      </div>

                      {/* Resolved Physical / Cloud Host Node */}
                      {hostNode ? (
                        <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-medium truncate">
                          <Server className="w-3 h-3 shrink-0" />
                          <span className="truncate">
                            节点：{hostNode.name}
                            {assignedAgent.cliConfig
                              ? ` · ${assignedAgent.cliConfig.concurrency} 路并发`
                              : ''}
                          </span>
                        </div>
                      ) : assignedAgent.ownership === 'marketplace' ? (
                        <div className="flex items-center gap-1 text-[11px] text-indigo-700 font-medium truncate">
                          <Sparkles className="w-3 h-3 shrink-0" />
                          <span className="truncate">
                            远程托管：{assignedAgent.region}（云端专家节点）
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-1 text-[11px] text-amber-700">
                          <span className="inline-flex items-center gap-1 truncate">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span>未绑定物理载体</span>
                          </span>
                          <button
                            type="button"
                            onClick={onJumpToSpaceAgents}
                            className="font-semibold underline cursor-pointer shrink-0"
                          >
                            去绑定
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Handoff Mode Toggle */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500">
                    下游交接流转方式
                  </label>
                  <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-100 rounded-lg">
                    {(
                      [
                        { id: 'manual', label: '人工确认' },
                        { id: 'auto', label: '自动流转' },
                      ] as { id: PipelineHandoffMode; label: string }[]
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() =>
                          onUpdateStageSlot(project.id, meta.stage, { handoffMode: m.id })
                        }
                        className={`py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                          slot.handoffMode === m.id
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Deliverable Contract */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500">
                    阶段交付物契约
                  </label>
                  <textarea
                    rows={2}
                    value={slot.deliverableContract}
                    onChange={(e) =>
                      onUpdateStageSlot(project.id, meta.stage, {
                        deliverableContract: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-700 leading-relaxed focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 resize-none"
                  />
                </div>
              </div>

              {/* Footer Jump to Stage Kanban */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400 font-mono">
                  {slot.handoffMode === 'auto' ? '通过自动触发下阶段' : '需雇主验收后交接'}
                </span>
                <button
                  type="button"
                  onClick={() => onOpenStageKanban(project.id, meta.stage)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 cursor-pointer whitespace-nowrap"
                >
                  <KanbanSquare className="w-3 h-3" />
                  <span>阶段任务</span>
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* Bottom Compact Table: Bound Pipeline Agents Runtime & Model Tuning */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold text-slate-900 inline-flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-indigo-600" />
              <span>当前流水线工位 Agent 底座与默认模型微调（{pipelineAgents.length}）</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              微调执行底座与默认推理模型后，项目群对话与看板任务将同步生效。
            </p>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {pipelineAgents.map((ag) => {
            const preset = getRuntimePreset(ag.runtimeAgent);
            const assignedStages = STAGE_ORDER.filter(
              (st) => slotMap.get(st.stage)?.agentId === ag.id,
            ).map((st) => slotMap.get(st.stage)?.roleTitle || st.label);
            const hostNode = resolveHostNode(ag.hostNodeId);

            return (
              <div
                key={ag.id}
                className="px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-slate-50/60"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <EntityAvatar
                    kind="agent"
                    code={ag.avatarCode}
                    accent={ag.avatarAccent}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <AgentIdentityName
                        name={ag.handle}
                        runtime={ag.runtimeAgent}
                        model={ag.defaultModel}
                        showModel
                        className="text-xs font-bold text-slate-900"
                      />
                      <span className="text-[11px] font-semibold text-blue-700">
                        工位：{assignedStages.join(' / ')}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      {hostNode
                        ? `运行节点：${hostNode.name} (${hostNode.osVersion}${
                            ag.cliConfig ? ` · ${ag.cliConfig.concurrency} 路并发` : ''
                          })`
                        : ag.ownership === 'marketplace'
                          ? `远程专家节点 · ${ag.region}`
                          : '未绑定运行节点'}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <select
                    value={ag.runtimeAgent}
                    onChange={(e) => {
                      const nextRt = e.target.value;
                      const nextPreset = getRuntimePreset(nextRt);
                      onUpdateAgentRuntimeConfig(
                        ag.id,
                        nextRt,
                        nextPreset.models[0] || ag.defaultModel,
                      );
                    }}
                    aria-label={`${ag.handle} 执行底座`}
                    className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none"
                  >
                    {AGENT_RUNTIME_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        底座：{p.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={ag.defaultModel}
                    onChange={(e) =>
                      onUpdateAgentRuntimeConfig(ag.id, ag.runtimeAgent, e.target.value)
                    }
                    aria-label={`${ag.handle} 默认模型`}
                    className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-mono text-slate-800 focus:bg-white focus:outline-none"
                  >
                    {Array.from(new Set([...preset.models, ag.defaultModel])).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
