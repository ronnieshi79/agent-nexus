import type { TaskStatus } from '../../types/agentnexus';

export interface WorkStatusMeta {
  status: TaskStatus;
  label: string;
  shortLabel: string;
  hint: string;
  textCls: string;
  activeSegmentCls: string;
  stepIndex: number;
}

export const WORK_CARD_STAGES: WorkStatusMeta[] = [
  {
    status: 'pending',
    label: '待批准执行',
    shortLabel: '待批准',
    hint: '群聊生成待雇主批准',
    textCls: 'text-slate-700',
    activeSegmentCls: 'bg-slate-500',
    stepIndex: 0,
  },
  {
    status: 'in_progress',
    label: '正在执行',
    shortLabel: '正在执行',
    hint: '多 Agent 沙箱协同运行',
    textCls: 'text-blue-700',
    activeSegmentCls: 'bg-blue-600',
    stepIndex: 1,
  },
  {
    status: 'review',
    label: '待验收完成',
    shortLabel: '待验收',
    hint: '产物已提交待雇主验收',
    textCls: 'text-amber-700',
    activeSegmentCls: 'bg-amber-500',
    stepIndex: 2,
  },
  {
    status: 'done',
    label: '已经完成',
    shortLabel: '已经完成',
    hint: '已验收归档工作区',
    textCls: 'text-emerald-700',
    activeSegmentCls: 'bg-emerald-600',
    stepIndex: 3,
  },
];

export const WORK_STATUS_META: Record<TaskStatus, WorkStatusMeta> = {
  pending: WORK_CARD_STAGES[0],
  in_progress: WORK_CARD_STAGES[1],
  review: WORK_CARD_STAGES[2],
  done: WORK_CARD_STAGES[3],
};

interface WorkCardStageBarProps {
  status: TaskStatus;
  compact?: boolean;
}

export function WorkCardStageBar({ status, compact = false }: WorkCardStageBarProps) {
  const current = WORK_STATUS_META[status];

  return (
    <div className="space-y-1" aria-label={`当前阶段：${current.label}`}>
      <div className="grid grid-cols-4 gap-1">
        {WORK_CARD_STAGES.map((stage) => {
          const reached = stage.stepIndex <= current.stepIndex;
          const isCurrent = stage.status === status;
          return (
            <div
              key={stage.status}
              className={`h-1 rounded-full transition-colors ${
                reached ? current.activeSegmentCls : 'bg-slate-200'
              } ${isCurrent && status === 'in_progress' ? 'animate-pulse' : ''}`}
            />
          );
        })}
      </div>
      {!compact && (
        <div className="grid grid-cols-4 gap-1 text-[10px] leading-none pt-0.5">
          {WORK_CARD_STAGES.map((stage) => {
            const isCurrent = stage.status === status;
            const passed = stage.stepIndex < current.stepIndex;
            return (
              <span
                key={stage.status}
                className={`truncate ${
                  isCurrent
                    ? `font-semibold ${current.textCls}`
                    : passed
                      ? 'text-slate-500'
                      : 'text-slate-400'
                }`}
              >
                {stage.shortLabel}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
