import { useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FileCode2,
  FolderKanban,
  Layers,
  Users,
} from 'lucide-react';
import type {
  ActiveWorkflowStage,
  ExpertAgent,
  ProjectWorkspace,
  TaskSessionMessage,
  WorkflowTask,
} from '../../types/agentnexus';
import {
  STAGE_LABEL_MAP,
  TASK_WORKFLOW_STAGES,
  getStageIndex,
} from '../../utils/taskWorkflow';
import { AgentIdentityName, EntityAvatar } from '../shared/EntityIdentity';
import { WorkStatusBadge } from '../workcard/WorkCardFlow';

interface TaskSessionInspectorRailProps {
  task: WorkflowTask;
  workspace: ProjectWorkspace;
  stageAgents: Record<ActiveWorkflowStage, ExpertAgent | null>;
  currentStage: ActiveWorkflowStage;
  participants: ExpertAgent[];
  messages: TaskSessionMessage[];
  agentMap: Map<string, ExpertAgent>;
  effectiveTargetAgentId: string | null;
  isExecuting: boolean;
  isReadOnly: boolean;
  onSelectTargetAgent: (agentId: string | null) => void;
  onBackToGroup: (projectId: string) => void;
}

interface CollectedArtifact {
  id: string;
  path: string;
  snippet?: string;
  summary?: string;
  producerAgent: ExpertAgent | null;
  stageLabel?: string;
  timestamp: string;
  isPrimary?: boolean;
}

/**
 * Focused Task Session right rail:
 * 1) Artifacts / Deliverables generated across the multi-agent workflow (with inline preview & copy)
 * 2) Participating Specialist Agents mapped to 计划 / 执行 / 验收 stages (click to target directly in composer)
 */
export function TaskSessionInspectorRail({
  task,
  workspace,
  stageAgents,
  currentStage,
  participants,
  messages,
  agentMap,
  effectiveTargetAgentId,
  isExecuting,
  isReadOnly,
  onSelectTargetAgent,
  onBackToGroup,
}: TaskSessionInspectorRailProps) {
  const [expandedArtifactId, setExpandedArtifactId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const currentStageIdx = task.status === 'done' ? 3 : getStageIndex(currentStage);

  const artifacts = useMemo<CollectedArtifact[]>(() => {
    const byPath = new Map<string, CollectedArtifact>();

    // Collect turn-level artifacts in reverse chronological order so the latest revision wins
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (m.sender !== 'agent' || (!m.artifactPath && !m.artifactSnippet)) continue;
      const path = m.artifactPath?.trim() || `artifacts/${task.id}_turn_${i + 1}.txt`;
      if (byPath.has(path)) continue;
      const producer = (m.agentId ? agentMap.get(m.agentId) || null : null) || null;
      byPath.set(path, {
        id: m.id,
        path,
        snippet: m.artifactSnippet,
        summary: m.content.split('\n')[0]?.slice(0, 96),
        producerAgent: producer,
        stageLabel: m.workflowStage ? STAGE_LABEL_MAP[m.workflowStage] : undefined,
        timestamp: m.timestamp,
        isPrimary: Boolean(task.deliverableArtifact && task.deliverableArtifact === path),
      });
    }

    // Ensure task-level deliverableArtifact is always surfaced at top
    if (task.deliverableArtifact) {
      const existing = byPath.get(task.deliverableArtifact);
      if (existing) {
        existing.isPrimary = true;
        if (task.deliverableSummary) {
          existing.summary = task.deliverableSummary;
        }
      } else {
        const ownerAgent = agentMap.get(task.assigneeId) || null;
        byPath.set(task.deliverableArtifact, {
          id: `primary_${task.id}`,
          path: task.deliverableArtifact,
          summary: task.deliverableSummary,
          producerAgent: ownerAgent,
          stageLabel: STAGE_LABEL_MAP[currentStage],
          timestamp: task.updatedAt,
          isPrimary: true,
        });
      }
    }

    return Array.from(byPath.values()).sort((a, b) => Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary)));
  }, [agentMap, currentStage, messages, task.assigneeId, task.deliverableArtifact, task.deliverableSummary, task.id, task.updatedAt]);

  const handleCopy = (id: string, text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1500);
    }
  };

  return (
    <aside className="fixed inset-y-0 right-0 z-30 lg:static lg:z-auto w-[340px] max-w-[88vw] shrink-0 border-l border-slate-200/80 bg-[#FAFAFA] flex flex-col h-full shadow-2xl lg:shadow-none">
      {/* Rail Header: Current Task Status */}
      <div className="h-[60px] px-4 border-b border-slate-200/80 bg-white flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="w-4 h-4 text-slate-700 shrink-0" />
          <span className="text-xs font-bold text-slate-900 truncate">交付物与协作专家</span>
        </div>
        <WorkStatusBadge status={task.status} executing={isExecuting} />
      </div>

      <div className="flex-1 overflow-y-auto clean-scroll divide-y divide-slate-200/80">
        {/* Section 1: Artifacts / Deliverables (Compact flat list, no card chrome) */}
        <section className="p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <FileCode2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Artifacts / 交付物</span>
            </h3>
            <span className="text-[11px] font-mono tabular-nums text-slate-400">
              {artifacts.length} 项
            </span>
          </div>

          {artifacts.length === 0 ? (
            <div className="py-4 text-center text-xs text-slate-400">
              当前任务尚未产出归档文件，专家执行后将自动沉淀至此。
            </div>
          ) : (
            <ul className="divide-y divide-slate-200/70">
              {artifacts.map((art) => {
                const isExpanded = expandedArtifactId === art.id;
                return (
                  <li key={art.id} className="py-2 first:pt-1 last:pb-0">
                    <div className="group/art flex items-start justify-between gap-2 px-1 py-0.5 rounded hover:bg-slate-200/45 transition-colors">
                      <button
                        type="button"
                        onClick={() =>
                          art.snippet && setExpandedArtifactId(isExpanded ? null : art.id)
                        }
                        className={`min-w-0 flex-1 text-left ${
                          art.snippet ? 'cursor-pointer' : 'cursor-default'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          {art.snippet ? (
                            isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            )
                          ) : (
                            <FileCode2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          )}
                          <span className="text-xs font-mono font-semibold text-blue-700 truncate">
                            {art.path}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-[10.5px] text-slate-400 mt-0.5 pl-5 truncate">
                          {art.isPrimary && (
                            <span className="text-emerald-700 font-semibold shrink-0">主交付</span>
                          )}
                          {art.stageLabel && (
                            <>
                              {art.isPrimary && <span aria-hidden="true">·</span>}
                              <span className="shrink-0">{art.stageLabel}</span>
                            </>
                          )}
                          {art.producerAgent && (
                            <>
                              <span aria-hidden="true">·</span>
                              <AgentIdentityName
                                name={art.producerAgent.handle}
                                runtime={art.producerAgent.runtimeAgent}
                                model={art.producerAgent.defaultModel}
                                className="text-slate-600 font-medium"
                              />
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums shrink-0">{art.timestamp}</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopy(art.id, art.snippet || art.path)}
                        title={art.snippet ? '复制产物片段' : '复制产物路径'}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 inline-flex items-center gap-0.5 shrink-0 cursor-pointer"
                      >
                        {copiedId === art.id ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>

                    {isExpanded && art.snippet && (
                      <pre className="mt-1.5 rounded-lg px-3 py-2 bg-slate-950 text-slate-200 text-[11px] font-mono leading-relaxed overflow-x-auto max-h-52">
                        <code>{art.snippet}</code>
                      </pre>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Section 2: Participating Specialist Agents (Compact flat list, no card chrome) */}
        <section className="p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-700" />
              <span>参与的 Agent 专家</span>
            </h3>
            <span className="text-[11px] font-mono tabular-nums text-slate-400">
              {participants.length} 位 · {Math.min(currentStageIdx, 3)}/3 阶段
            </span>
          </div>

          <ul className="divide-y divide-slate-200/70">
            {TASK_WORKFLOW_STAGES.map((stage, idx) => {
              const sAgent = stageAgents[stage.id];
              const isDone = idx < currentStageIdx;
              const isCur = task.status !== 'done' && idx === currentStageIdx;
              const isSelectedTarget = Boolean(sAgent && effectiveTargetAgentId === sAgent.id);

              return (
                <li key={stage.id} className="py-1 first:pt-0 last:pb-0">
                  <button
                    type="button"
                    disabled={!sAgent || isReadOnly}
                    onClick={() => sAgent && onSelectTargetAgent(isCur ? null : sAgent.id)}
                    className={`w-full text-left rounded-md px-2 py-2 transition-colors cursor-pointer disabled:cursor-default space-y-1.5 ${
                      isSelectedTarget
                        ? 'bg-slate-200/80'
                        : isCur
                          ? 'bg-slate-200/45 hover:bg-slate-200/65'
                          : 'hover:bg-slate-200/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[10.5px]">
                      <span
                        className={`font-semibold ${
                          isDone
                            ? 'text-emerald-700'
                            : isCur
                              ? 'text-slate-950'
                              : 'text-slate-500'
                        }`}
                      >
                        0{idx + 1} · {stage.label}
                      </span>
                      <span
                        className={`font-medium ${
                          isDone
                            ? 'text-emerald-600'
                            : isSelectedTarget
                              ? 'text-blue-700'
                              : isCur
                                ? 'text-slate-900'
                                : 'text-slate-400'
                        }`}
                      >
                        {isDone
                          ? '已完成'
                          : isSelectedTarget
                            ? '当前指定'
                            : isCur
                              ? '当前负责'
                              : '待接力'}
                      </span>
                    </div>

                    {sAgent ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <EntityAvatar
                          kind="agent"
                          code={sAgent.avatarCode}
                          accent={sAgent.avatarAccent}
                          size="sm"
                          showCornerMark={false}
                        />
                        <div className="min-w-0 flex-1">
                          <AgentIdentityName
                            name={sAgent.handle}
                            runtime={sAgent.runtimeAgent}
                            model={sAgent.defaultModel}
                            showModel
                            className="text-xs font-semibold text-slate-900"
                          />
                          <div className="text-[11px] text-slate-500 truncate">
                            {sAgent.title}
                            {sAgent.mcpTools && sAgent.mcpTools.length > 0
                              ? ` · MCP: ${sAgent.mcpTools.slice(0, 2).join(', ')}`
                              : ''}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400">未指派专家</div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {/* Compact Footer Link Back to Source Project Group */}
      <div className="p-3 border-t border-slate-200/80 bg-white shrink-0">
        <button
          type="button"
          onClick={() => onBackToGroup(workspace.id)}
          className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer transition-colors"
        >
          <FolderKanban className="w-3.5 h-3.5 text-slate-500" />
          <span className="truncate">返回项目群：{workspace.name}</span>
        </button>
      </div>
    </aside>
  );
}
