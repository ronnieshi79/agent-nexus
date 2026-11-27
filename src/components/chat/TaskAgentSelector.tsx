import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { ActiveWorkflowStage, ExpertAgent } from '../../types/agentnexus';
import { TASK_WORKFLOW_STAGES } from '../../utils/taskWorkflow';
import { AgentIdentityName } from '../shared/EntityIdentity';

interface TaskAgentSelectorProps {
  stageAgents: Record<ActiveWorkflowStage, ExpertAgent | null>;
  currentStage: ActiveWorkflowStage;
  extraWorkspaceAgents: ExpertAgent[];
  activeStageAgent: ExpertAgent | null;
  selectedTargetAgentId: string | null;
  disabled?: boolean;
  onSelectAgent: (agentId: string | null) => void;
}

/**
 * Claude Code / Codex-style inline specialist selector embedded in the bottom-left of the Task Session composer.
 * Lets users explicitly target any workflow or project specialist without typing `@` mentions.
 */
export function TaskAgentSelector({
  stageAgents,
  currentStage,
  extraWorkspaceAgents,
  activeStageAgent,
  selectedTargetAgentId,
  disabled = false,
  onSelectAgent,
}: TaskAgentSelectorProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  // Build unique workflow participants with their stage tags
  const workflowOptions: Array<{
    agent: ExpertAgent;
    stageLabels: string[];
    isCurrentStageOwner: boolean;
  }> = [];

  const seenIds = new Set<string>();
  TASK_WORKFLOW_STAGES.forEach((stage) => {
    const a = stageAgents[stage.id];
    if (!a) return;
    const existing = workflowOptions.find((o) => o.agent.id === a.id);
    if (existing) {
      existing.stageLabels.push(stage.label);
      if (stage.id === currentStage) existing.isCurrentStageOwner = true;
    } else {
      seenIds.add(a.id);
      workflowOptions.push({
        agent: a,
        stageLabels: [stage.label],
        isCurrentStageOwner: stage.id === currentStage,
      });
    }
  });

  const extraOptions = extraWorkspaceAgents.filter((a) => !seenIds.has(a.id));

  const effectiveAgent =
    (selectedTargetAgentId
      ? workflowOptions.find((o) => o.agent.id === selectedTargetAgentId)?.agent ||
        extraOptions.find((a) => a.id === selectedTargetAgentId) ||
        null
      : null) || activeStageAgent;

  const isManualOverride = Boolean(
    selectedTargetAgentId && activeStageAgent && selectedTargetAgentId !== activeStageAgent.id,
  );
  const effectiveStageLabels =
    workflowOptions.find((o) => o.agent.id === effectiveAgent?.id)?.stageLabels || [];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed max-w-[300px] ${
          open
            ? 'bg-slate-200/80 text-slate-950'
            : 'bg-slate-100/90 hover:bg-slate-200/70 text-slate-800'
        }`}
        title="切换本次指令接收的 Agent 专家"
      >
        {effectiveAgent && (
          <span
            className="w-4 h-4 rounded text-[9px] font-bold text-white inline-flex items-center justify-center shrink-0"
            style={{ backgroundColor: effectiveAgent.avatarAccent }}
          >
            {effectiveAgent.avatarCode.slice(0, 1)}
          </span>
        )}
        <AgentIdentityName
          name={effectiveAgent?.handle || '未指定专家'}
          runtime={effectiveAgent?.runtimeAgent}
          model={effectiveAgent?.defaultModel}
          showModel
          className="font-semibold text-slate-900"
        />
        <span className="text-[10px] text-slate-500 shrink-0 whitespace-nowrap">
          {isManualOverride
            ? effectiveStageLabels.length > 0
              ? `指定·${effectiveStageLabels[0]}`
              : '指定协援'
            : effectiveStageLabels.length > 0
              ? `${effectiveStageLabels.join('/')}`
              : '默认'}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && !disabled && (
        <div className="absolute left-0 bottom-full mb-2 w-80 max-w-[85vw] rounded-xl border border-slate-200 bg-white shadow-xl py-1.5 z-40">
          <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="font-semibold text-slate-800">指定响应 Agent 专家</span>
            {isManualOverride && (
              <button
                type="button"
                onClick={() => {
                  onSelectAgent(null);
                  setOpen(false);
                }}
                className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
              >
                恢复默认阶段专家
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto clean-scroll py-1">
            <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              本任务工作流专家
            </div>
            {workflowOptions.map(({ agent, stageLabels, isCurrentStageOwner }) => {
              const isSelected = effectiveAgent?.id === agent.id;
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => {
                    onSelectAgent(isCurrentStageOwner ? null : agent.id);
                    setOpen(false);
                  }}
                  className={`w-full px-3 py-2 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
                    isSelected ? 'bg-slate-50' : 'hover:bg-slate-50/80'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-5 h-5 rounded text-[10px] font-bold text-white inline-flex items-center justify-center shrink-0"
                      style={{ backgroundColor: agent.avatarAccent }}
                    >
                      {agent.avatarCode.slice(0, 1)}
                    </span>
                    <div className="min-w-0">
                      <AgentIdentityName
                        name={agent.handle}
                        runtime={agent.runtimeAgent}
                        model={agent.defaultModel}
                        showModel
                        className="text-xs font-semibold text-slate-900"
                      />
                      <div className="text-[10px] text-slate-500 truncate">
                        负责阶段：{stageLabels.join(' / ')}
                        {isCurrentStageOwner ? ' · 当前阶段默认' : ''}
                      </div>
                    </div>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-slate-900 shrink-0" />}
                </button>
              );
            })}

            {extraOptions.length > 0 && (
              <>
                <div className="mt-1 pt-1.5 border-t border-slate-100 px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  项目内其他专家（临时协援）
                </div>
                {extraOptions.map((agent) => {
                  const isSelected = effectiveAgent?.id === agent.id;
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => {
                        onSelectAgent(agent.id);
                        setOpen(false);
                      }}
                      className={`w-full px-3 py-2 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
                        isSelected ? 'bg-slate-50' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-5 h-5 rounded text-[10px] font-bold text-white inline-flex items-center justify-center shrink-0"
                          style={{ backgroundColor: agent.avatarAccent }}
                        >
                          {agent.avatarCode.slice(0, 1)}
                        </span>
                        <div className="min-w-0">
                          <AgentIdentityName
                            name={agent.handle}
                            runtime={agent.runtimeAgent}
                            model={agent.defaultModel}
                            showModel
                            className="text-xs font-semibold text-slate-900"
                          />
                          <div className="text-[10px] text-slate-500 truncate">{agent.title}</div>
                        </div>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-slate-900 shrink-0" />}
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
