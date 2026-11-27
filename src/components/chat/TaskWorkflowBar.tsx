import { ArrowRight, Check } from 'lucide-react';
import type { ActiveWorkflowStage, ExpertAgent, TaskStatus } from '../../types/agentnexus';
import {
  TASK_WORKFLOW_STAGES,
  getStageIndex,
  getTaskCurrentStage,
} from '../../utils/taskWorkflow';
import { AgentIdentityName } from '../shared/EntityIdentity';

interface TaskWorkflowBarProps {
  status: TaskStatus;
  stageAgents: Record<ActiveWorkflowStage, ExpertAgent | null>;
  selectedTargetAgentId: string | null;
  isExecuting?: boolean;
  isReadOnly?: boolean;
  onSelectTargetAgent: (agentId: string) => void;
  onAdvanceStage?: (nextStatus: TaskStatus) => void;
}

/**
 * Flush Codex/Antigravity-style 3-stage workflow pipeline bar anchored at the top of a Task Session:
 * 计划 -> 执行 -> 验收, showing each stage's specialist Agent (`名称.宿主.模型`) and active relay owner.
 */
export function TaskWorkflowBar({
  status,
  stageAgents,
  selectedTargetAgentId,
  isExecuting = false,
  isReadOnly = false,
  onSelectTargetAgent,
  onAdvanceStage,
}: TaskWorkflowBarProps) {
  const currentStage = getTaskCurrentStage(status);
  const currentIdx = status === 'done' ? 3 : getStageIndex(currentStage);

  const nextAction: { label: string; nextStatus: TaskStatus } | null =
    status === 'pending'
      ? { label: '交棒执行', nextStatus: 'in_progress' }
      : status === 'in_progress'
        ? { label: '提交验收', nextStatus: 'review' }
        : status === 'review'
          ? { label: '验收通过', nextStatus: 'done' }
          : null;

  return (
    <div className="border-b border-slate-200/80 bg-[#FAFAFA] px-4 sm:px-6 py-2 shrink-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto min-w-0">
          {TASK_WORKFLOW_STAGES.map((stage, idx) => {
            const stageAgent = stageAgents[stage.id];
            const isCompleted = idx < currentIdx;
            const isCurrent = status !== 'done' && idx === currentIdx;
            const isTargeted = Boolean(stageAgent && selectedTargetAgentId === stageAgent.id);

            return (
              <div key={stage.id} className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button
                  type="button"
                  disabled={!stageAgent}
                  onClick={() => stageAgent && onSelectTargetAgent(stageAgent.id)}
                  title={
                    stageAgent
                      ? `点击切换到与 ${stage.label}阶段专家对话`
                      : `${stage.label}阶段`
                  }
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors cursor-pointer disabled:cursor-default ${
                    isCurrent
                      ? 'bg-white border border-slate-300/90 text-slate-950 shadow-2xs'
                      : isTargeted
                        ? 'bg-blue-50/80 border border-blue-200 text-blue-900'
                        : 'border border-transparent hover:bg-slate-200/50 text-slate-600'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full text-[10px] font-mono font-bold inline-flex items-center justify-center shrink-0 ${
                      isCompleted
                        ? 'bg-emerald-600 text-white'
                        : isCurrent
                          ? isExecuting
                            ? 'bg-blue-600 text-white animate-pulse'
                            : 'bg-slate-900 text-white'
                          : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {isCompleted ? <Check className="w-2.5 h-2.5" /> : idx + 1}
                  </span>

                  <span
                    className={`font-semibold whitespace-nowrap ${
                      isCurrent
                        ? 'text-slate-950'
                        : isCompleted
                          ? 'text-emerald-700'
                          : 'text-slate-500'
                    }`}
                  >
                    {stage.label}
                  </span>

                  {stageAgent && (
                    <>
                      <span className="text-slate-300" aria-hidden="true">
                        ·
                      </span>
                      <span
                        className="w-3.5 h-3.5 rounded text-[8px] font-bold text-white inline-flex items-center justify-center shrink-0"
                        style={{ backgroundColor: stageAgent.avatarAccent }}
                      >
                        {stageAgent.avatarCode.slice(0, 1)}
                      </span>
                      <AgentIdentityName
                        name={stageAgent.handle}
                        runtime={stageAgent.runtimeAgent}
                        model={stageAgent.defaultModel}
                        showModel={isCurrent}
                        className={`text-[11px] max-w-[168px] ${
                          isCurrent ? 'font-semibold text-slate-800' : 'text-slate-500'
                        }`}
                      />
                    </>
                  )}
                </button>

                {idx < TASK_WORKFLOW_STAGES.length - 1 && (
                  <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        {nextAction && onAdvanceStage && !isReadOnly && (
          <button
            type="button"
            disabled={isExecuting}
            onClick={() => onAdvanceStage(nextAction.nextStatus)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-45 ${
              nextAction.nextStatus === 'done'
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
          >
            <span>{nextAction.label}</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
