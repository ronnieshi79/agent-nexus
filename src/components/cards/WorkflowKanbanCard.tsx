import {
  CheckCircle2,
  FileCode2,
  GitBranch,
  MessageSquare,
  Play,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import type {
  ExpertAgent,
  ProjectWorkspace,
  TaskStatus,
  WorkflowTask,
} from '../../types/agentnexus';
import { ServiceCardShell } from './ServiceCardShell';

interface WorkflowKanbanCardProps {
  workspace: ProjectWorkspace;
  tasks: WorkflowTask[];
  agents: ExpertAgent[];
  executingTaskId: string | null;
  onRunTask: (taskId: string) => Promise<void>;
  onUpdateStatus: (taskId: string, status: TaskStatus) => void;
  onJumpToChat: () => void;
}

const COLUMNS: {
  status: TaskStatus;
  title: string;
  hint: string;
  accent: string;
}[] = [
  { status: 'pending', title: '待接单', hint: '已同步等待触发', accent: 'text-slate-700' },
  { status: 'in_progress', title: '执行中', hint: '特工沙箱运行中', accent: 'text-blue-700' },
  { status: 'review', title: '待审核', hint: '等待雇主审批合并', accent: 'text-amber-700' },
  { status: 'done', title: '已完成', hint: '产物已归档工作区', accent: 'text-emerald-700' },
];

export function WorkflowKanbanCard({
  workspace,
  tasks,
  agents,
  executingTaskId,
  onRunTask,
  onUpdateStatus,
  onJumpToChat,
}: WorkflowKanbanCardProps) {
  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const reviewCount = tasks.filter((t) => t.status === 'review').length;
  const progressPct = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;
  const budgetPct = Math.min(
    100,
    Math.round((workspace.spentUsd / Math.max(1, workspace.budgetCapUsd)) * 100),
  );

  return (
    <ServiceCardShell
      cardId="kanban"
      kicker="精密工作流调度板 · Harness 预算护栏"
      title="自动化工作流与任务看板"
      subtitle="群聊派单自动落盘至看板；一键触发专家 Agent 自主执行并产出交付物，审批结果实时回流群聊。"
      headerRight={
        <button
          type="button"
          onClick={onJumpToChat}
          className="skeuo-key inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-800 cursor-pointer whitespace-nowrap"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>回到群聊追加任务</span>
        </button>
      }
    >
      {/* Clean 4-Column Tabular Metrics Strip (No Nested Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pb-5 mb-6 border-b border-slate-200/80">
        <div>
          <div className="text-xs text-slate-500">项目交付进度</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono tabular-nums text-slate-900">
              {progressPct}%
            </span>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              {doneCount} / {tasks.length} 卡片
            </span>
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-500">待雇主审批节点</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono tabular-nums text-amber-700">
              {reviewCount}
            </span>
            <span className="text-xs text-slate-500">项交付待验收</span>
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Harness 预算熔断护栏</span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono tabular-nums text-slate-900">
              ${workspace.spentUsd.toFixed(2)}
            </span>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              / ${workspace.budgetCapUsd.toFixed(2)} ({budgetPct}%)
            </span>
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-500">跨节点挂载工作区</div>
          <div className="mt-1.5 text-sm font-semibold text-slate-800 truncate">
            {workspace.workspaceTier}
          </div>
        </div>
      </div>

      {/* 4-Column Automated Workflow Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.status);
          return (
            <div key={col.status} className="skeuo-well rounded-2xl p-3 flex flex-col min-h-[340px]">
              <div className="px-1.5 pb-2.5 mb-2.5 border-b border-slate-300/60 flex items-center justify-between gap-2">
                <div>
                  <h3 className={`text-sm font-bold ${col.accent}`}>{col.title}</h3>
                  <p className="text-[11px] text-slate-500">{col.hint}</p>
                </div>
                <span className="text-xs font-mono tabular-nums font-semibold text-slate-600">
                  {colTasks.length}
                </span>
              </div>

              <div className="space-y-3 flex-1">
                {colTasks.length === 0 ? (
                  <div className="h-28 rounded-xl border border-dashed border-slate-300/90 flex items-center justify-center px-3 text-center text-xs text-slate-400">
                    暂无{col.title}任务
                  </div>
                ) : (
                  colTasks.map((task) => {
                    const agent = agents.find((a) => a.id === task.assigneeId);
                    const isExecuting = executingTaskId === task.id;
                    return (
                      <article
                        key={task.id}
                        className="bg-white rounded-xl p-3.5 border border-slate-200/90 shadow-xs flex flex-col gap-2.5"
                      >
                        {/* Quiet metadata row */}
                        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                          <span className="font-mono tabular-nums">{task.id}</span>
                          <span className="font-medium text-slate-700">
                            优先级 {task.priority} · 限额 ${task.budgetLimitUsd.toFixed(2)}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-sm font-semibold text-slate-900 leading-snug">
                            {task.title}
                          </h4>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                            {task.description}
                          </p>
                        </div>

                        {task.dependsOnTaskId && (
                          <div className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                            <GitBranch className="w-3 h-3 text-slate-400" />
                            <span>DAG 前置依赖 {task.dependsOnTaskId}</span>
                          </div>
                        )}

                        {/* Deliverable Summary Box */}
                        {task.deliverableSummary && (
                          <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-2.5 text-xs text-slate-700 space-y-1.5">
                            <p className="leading-relaxed">{task.deliverableSummary}</p>
                            {task.deliverableArtifact && (
                              <div className="flex items-center gap-1 font-mono text-[11px] text-blue-700 truncate">
                                <FileCode2 className="w-3 h-3 shrink-0" />
                                <span className="truncate">{task.deliverableArtifact}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Assignee & Billing Row */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="w-5 h-5 rounded-md text-[10px] font-bold text-white inline-flex items-center justify-center shrink-0"
                              style={{ backgroundColor: agent?.avatarAccent || '#334155' }}
                            >
                              {agent?.avatarCode || 'AI'}
                            </span>
                            <span className="font-medium text-slate-800 truncate">
                              {task.assigneeHandle}
                            </span>
                          </div>
                          {task.actualCostUsd > 0 && (
                            <span className="font-mono tabular-nums text-[11px] text-slate-500 shrink-0">
                              实耗 ${task.actualCostUsd.toFixed(2)}
                            </span>
                          )}
                        </div>

                        {/* Contextual Workflow Controls */}
                        <div className="flex items-center gap-2">
                          {task.status === 'pending' && (
                            <button
                              type="button"
                              disabled={Boolean(executingTaskId)}
                              onClick={() => onRunTask(task.id)}
                              className="w-full skeuo-primary inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white cursor-pointer disabled:opacity-45"
                            >
                              <Play className="w-3 h-3" />
                              <span>{isExecuting ? '特工执行中...' : '启动 AI 自主执行'}</span>
                            </button>
                          )}

                          {task.status === 'in_progress' && (
                            <div className="w-full text-center py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg">
                              沙箱运行中，产物生成后自动流转...
                            </div>
                          )}

                          {task.status === 'review' && (
                            <>
                              <button
                                type="button"
                                onClick={() => onUpdateStatus(task.id, 'done')}
                                className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>批准合并</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onUpdateStatus(task.id, 'pending')}
                                title="打回待接单重做"
                                className="skeuo-key p-1.5 rounded-lg text-slate-600 hover:text-slate-900 cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          {task.status === 'done' && (
                            <div className="w-full flex items-center justify-between text-[11px] text-emerald-700 font-medium">
                              <span>已验收归档</span>
                              <span className="font-mono tabular-nums text-slate-400">
                                {task.tokensUsed > 0 ? `${task.tokensUsed.toLocaleString()} tok` : task.updatedAt}
                              </span>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </ServiceCardShell>
  );
}
