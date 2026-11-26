import type { TaskStatus } from '../../types/agentnexus';

export interface WorkStatusMeta {
  status: TaskStatus;
  label: string;
  shortLabel: string;
  hint: string;
  textCls: string;
  activeSegmentCls: string;
  badgeCls: string;
  stepIndex: number;
}

export const WORK_CARD_STAGES: WorkStatusMeta[] = [
  {
    status: 'pending',
    label: '任务计划',
    shortLabel: '计划',
    hint: '需求拆解、Bug 分析与任务规划',
    textCls: 'text-slate-700',
    activeSegmentCls: 'bg-slate-500',
    badgeCls: 'bg-slate-100 text-slate-700 border-slate-200',
    stepIndex: 0,
  },
  {
    status: 'in_progress',
    label: '任务执行',
    shortLabel: '执行',
    hint: '专家 Agent 按计划自主执行交付',
    textCls: 'text-blue-700',
    activeSegmentCls: 'bg-blue-600',
    badgeCls: 'bg-blue-50 text-blue-700 border-blue-200',
    stepIndex: 1,
  },
  {
    status: 'review',
    label: '任务验证',
    shortLabel: '验证',
    hint: '测试回归、评审与交付质量验证',
    textCls: 'text-amber-700',
    activeSegmentCls: 'bg-amber-500',
    badgeCls: 'bg-amber-50 text-amber-800 border-amber-200',
    stepIndex: 2,
  },
  {
    status: 'done',
    label: '已完成',
    shortLabel: '完成',
    hint: '验证通过并归档至项目工作区',
    textCls: 'text-emerald-700',
    activeSegmentCls: 'bg-emerald-600',
    badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    stepIndex: 3,
  },
];

export const WORK_STATUS_META: Record<TaskStatus, WorkStatusMeta> = {
  pending: WORK_CARD_STAGES[0],
  in_progress: WORK_CARD_STAGES[1],
  review: WORK_CARD_STAGES[2],
  done: WORK_CARD_STAGES[3],
};

interface WorkStatusBadgeProps {
  status: TaskStatus;
  executing?: boolean;
}

export function WorkStatusBadge({ status, executing = false }: WorkStatusBadgeProps) {
  const effectiveStatus: TaskStatus = executing ? 'in_progress' : status;
  const meta = WORK_STATUS_META[effectiveStatus];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-semibold whitespace-nowrap shrink-0 ${meta.badgeCls}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.activeSegmentCls} ${
          effectiveStatus === 'in_progress' ? 'animate-pulse' : ''
        }`}
      />
      <span>{meta.label}</span>
    </span>
  );
}
