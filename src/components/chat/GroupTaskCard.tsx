import { ArrowUpRight, Check, FileCode2 } from 'lucide-react';
import type {
  ExpertAgent,
  ProjectAgentAssignment,
  ProjectStageSlot,
  ProjectWorkspace,
  TaskSessionMessage,
  WorkflowTask,
} from '../../types/agentnexus';
import {
  STAGE_LABEL_MAP,
  TASK_WORKFLOW_STAGES,
  getStageIndex,
  resolveTaskWorkflowTeam,
} from '../../utils/taskWorkflow';
import { AgentIdentityName } from '../shared/EntityIdentity';
import { WORK_STATUS_META } from '../workcard/WorkCardFlow';

interface GroupTaskCardProps {
  task: WorkflowTask;
  workspace: ProjectWorkspace;
  agents: ExpertAgent[];
  assignments?: ProjectAgentAssignment[];
  pipelineSlots?: ProjectStageSlot[];
  sessionMessages: TaskSessionMessage[];
  isExecuting?: boolean;
  onOpenTaskSession: (taskId: string) => void;
}

/**
 * Minimalist card-mode representation of a project task inside Group Chat.
 * Hides inner chain-of-thought and verbose debugging details, while surfacing
 * the concise execution result summary, artifact path, 3-stage status, and participating specialists.
 */
export function GroupTaskCard({
  task,
  workspace,
  agents,
  assignments = [],
  pipelineSlots = [],
  sessionMessages,
  isExecuting = false,
  onOpenTaskSession,
}: GroupTaskCardProps) {
  const workflow = resolveTaskWorkflowTeam(task, workspace, agents, assignments, pipelineSlots);
  const effectiveStatus = isExecuting ? 'in_progress' : task.status;
  const stMeta = WORK_STATUS_META[effectiveStatus];
  const currentIdx = task.status === 'done' ? 3 : getStageIndex(workflow.currentStage);
  const lastMsg = sessionMessages[sessionMessages.length - 1];
  const needsConfirm = task.status !== 'done' && Boolean(lastMsg?.awaitingConfirmation);

  const resultLine = task.deliverableSummary?.split('\n')[0]?.trim();

  return (
    <button
      type="button"
      onClick={() => onOpenTaskSession(task.id)}
      className="group w-full text-left rounded-xl border border-slate-200/85 bg-[#FAFAFA] hover:bg-white hover:border-slate-300 px-4 py-3.5 transition-all cursor-pointer space-y-2.5"
    >
      {/* Row 1: Task Title + Compact Status */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2">
          <span className="font-mono text-[11px] text-slate-400 shrink-0">#{task.id}</span>
          <span className="text-[13px] font-semibold text-slate-900 group-hover:text-blue-700 transition-colors truncate">
            {task.title}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-semibold whitespace-nowrap">
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              needsConfirm ? 'bg-amber-500 animate-pulse' : stMeta.activeSegmentCls
            } ${effectiveStatus === 'in_progress' ? 'animate-pulse' : ''}`}
          />
          <span className={needsConfirm ? 'text-amber-700' : stMeta.textCls}>
            {needsConfirm
              ? `${STAGE_LABEL_MAP[workflow.currentStage]} · 待确认`
              : stMeta.label}
          </span>
        </div>
      </div>

      {/* Row 2 (Optional): Concise Execution Result & Deliverable Path — no CoT or inner code logs */}
      {(resultLine || task.deliverableArtifact) && (
        <div className="flex items-center justify-between gap-3 text-[11px] text-slate-600">
          {resultLine ? (
            <span className="truncate">{resultLine}</span>
          ) : (
            <span className="text-slate-400">产物已归档</span>
          )}
          {task.deliverableArtifact && (
            <span className="inline-flex items-center gap-1 font-mono text-blue-700 shrink-0 max-w-[200px]">
              <FileCode2 className="w-3 h-3 shrink-0" />
              <span className="truncate">{task.deliverableArtifact}</span>
            </span>
          )}
        </div>
      )}

      {/* Row 3: 3-Stage Mini Pipeline + Multi-Agent Avatar Stack + Active Owner + Enter Arrow */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-0.5">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 min-w-0">
          <div className="inline-flex items-center gap-1 shrink-0">
            {TASK_WORKFLOW_STAGES.map((stage, idx) => {
              const done = idx < currentIdx;
              const active = task.status !== 'done' && idx === currentIdx;
              return (
                <span key={stage.id} className="inline-flex items-center gap-1">
                  <span
                    className={`inline-flex items-center gap-0.5 ${
                      done
                        ? 'text-emerald-700 font-medium'
                        : active
                          ? 'text-slate-900 font-semibold'
                          : 'text-slate-400'
                    }`}
                  >
                    {done && <Check className="w-2.5 h-2.5 shrink-0" />}
                    <span>{stage.shortLabel}</span>
                  </span>
                  {idx < TASK_WORKFLOW_STAGES.length - 1 && (
                    <span className="text-slate-300" aria-hidden="true">
                      /
                    </span>
                  )}
                </span>
              );
            })}
          </div>

          <span className="text-slate-300" aria-hidden="true">
            ·
          </span>

          <div className="inline-flex items-center gap-1.5 min-w-0">
            <div className="flex -space-x-1 shrink-0">
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
            </div>
            {workflow.activeAgent && (
              <AgentIdentityName
                name={workflow.activeAgent.handle}
                runtime={workflow.activeAgent.runtimeAgent}
                model={workflow.activeAgent.defaultModel}
                showModel
                className="text-[11px] font-medium text-slate-700"
              />
            )}
          </div>
        </div>

        <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-slate-500 group-hover:text-slate-900 shrink-0 whitespace-nowrap">
          <span>
            {sessionMessages.length > 0 ? `查看协作细节 (${sessionMessages.length})` : '进入任务对话'}
          </span>
          <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </div>
    </button>
  );
}
