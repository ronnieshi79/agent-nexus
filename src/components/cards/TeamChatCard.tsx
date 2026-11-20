import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  Play,
  Send,
  UserPlus,
} from 'lucide-react';
import type {
  ChatMessage,
  ExpertAgent,
  ProjectWorkspace,
  TaskStatus,
  WorkflowTask,
} from '../../types/agentnexus';
import { ServiceCardShell } from './ServiceCardShell';

interface TeamChatCardProps {
  workspace: ProjectWorkspace;
  hiredAgents: ExpertAgent[];
  messages: ChatMessage[];
  tasks: WorkflowTask[];
  isBusy: boolean;
  executingTaskId: string | null;
  draftSeed: string;
  onClearDraftSeed: () => void;
  onSendMessage: (text: string) => Promise<void>;
  onRunTask: (taskId: string) => Promise<void>;
  onApproveTask: (taskId: string) => void;
  onJumpToMarket: () => void;
  onJumpToKanban: () => void;
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: '待接单',
  in_progress: '执行中',
  review: '待审核',
  done: '已完成',
};

const STATUS_TEXT_COLORS: Record<TaskStatus, string> = {
  pending: 'text-slate-600',
  in_progress: 'text-blue-700',
  review: 'text-amber-700',
  done: 'text-emerald-700',
};

export function TeamChatCard({
  workspace,
  hiredAgents,
  messages,
  tasks,
  isBusy,
  executingTaskId,
  draftSeed,
  onClearDraftSeed,
  onSendMessage,
  onRunTask,
  onApproveTask,
  onJumpToMarket,
  onJumpToKanban,
}: TeamChatCardProps) {
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (draftSeed) {
      setDraft(draftSeed);
      onClearDraftSeed();
    }
  }, [draftSeed, onClearDraftSeed]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length, isBusy]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleaned = draft.trim();
    if (!cleaned || isBusy) return;
    setDraft('');
    await onSendMessage(cleaned);
  };

  const insertMention = (handle: string) => {
    setDraft((prev) => (prev.includes(handle) ? prev : `${handle} ${prev}`.trimStart()));
  };

  const quickPresets = [
    hiredAgents[0]
      ? `${hiredAgents[0].handle} 帮我拆解多币种部分退款的异常边界，并生成 1 张任务卡同步看板`
      : '@Butler 帮我规划接下来的核心里程碑任务',
    hiredAgents[1]
      ? `${hiredAgents[1].handle} 针对支付回调高并发场景设计重试与死信队列任务卡`
      : '@Butler 检查目前团队缺少哪些关键专家角色',
    '@Butler 汇总当前项目进展、预算剩余以及需要我审批的交付物',
  ];

  return (
    <ServiceCardShell
      cardId="chat"
      kicker={`项目群聊 Session · ${workspace.workspaceTier}`}
      title={workspace.name}
      subtitle="在群聊中用 @ 语法直接派遣已雇佣专家，AI 自动拆解任务卡片并实时双向同步至工作流看板。"
      headerRight={
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onJumpToMarket}
            className="skeuo-key inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-800 cursor-pointer whitespace-nowrap"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>扩编专家</span>
          </button>
          <button
            type="button"
            onClick={onJumpToKanban}
            className="skeuo-key inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-800 cursor-pointer whitespace-nowrap"
          >
            <span>查看看板 ({tasks.length})</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      }
    >
      {/* Active Team Roster Strip — Click any member to @ mention */}
      <div className="pb-4 mb-4 border-b border-slate-200/80 flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500 mr-1">点击 @ 派单：</span>
        <button
          type="button"
          onClick={() => insertMention('@Butler')}
          className="skeuo-key px-2.5 py-1 rounded-lg text-xs font-medium text-slate-800 cursor-pointer whitespace-nowrap"
        >
          @Butler · 内置管家
        </button>
        {hiredAgents.map((agent) => (
          <button
            key={agent.id}
            type="button"
            onClick={() => insertMention(agent.handle)}
            className="skeuo-key inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-800 cursor-pointer whitespace-nowrap"
          >
            <span
              className="w-4 h-4 rounded text-[10px] font-bold text-white inline-flex items-center justify-center"
              style={{ backgroundColor: agent.avatarAccent }}
            >
              {agent.avatarCode}
            </span>
            <span>{agent.handle}</span>
          </button>
        ))}
      </div>

      {/* Scrollable Group Chat Message Stream */}
      <div className="skeuo-well rounded-2xl p-4 h-[360px] sm:h-[390px] overflow-y-auto clean-scroll space-y-4">
        {messages.map((msg) => {
          if (msg.senderType === 'system') {
            return (
              <div key={msg.id} className="text-center py-1">
                <span className="text-xs text-slate-500">
                  {msg.timestamp} · {msg.content}
                </span>
              </div>
            );
          }

          const isEmployer = msg.senderType === 'employer';
          const linkedTasks = (msg.linkedTaskIds || [])
            .map((tid) => tasks.find((t) => t.id === tid))
            .filter((t): t is WorkflowTask => Boolean(t));

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isEmployer ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-1 px-1">
                <span className="font-semibold text-slate-700">{msg.senderHandle}</span>
                {!isEmployer && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{msg.senderName}</span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{msg.timestamp}</span>
                {typeof msg.costUsd === 'number' && msg.costUsd > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-slate-600">
                      ${msg.costUsd.toFixed(2)}
                    </span>
                  </>
                )}
              </div>

              <div
                className={`max-w-[88%] sm:max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  isEmployer
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-800 border border-slate-200/90 shadow-xs'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>

                {/* Embedded Dynamic Task Cards Synchronized with Kanban */}
                {linkedTasks.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-2.5">
                    {linkedTasks.map((task) => {
                      const isExecuting = executingTaskId === task.id;
                      return (
                        <div
                          key={task.id}
                          className="rounded-xl bg-slate-50 border border-slate-200/90 px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-mono text-slate-400">{task.id}</span>
                              <span aria-hidden="true">·</span>
                              <span className={`font-semibold ${STATUS_TEXT_COLORS[task.status]}`}>
                                {STATUS_LABELS[task.status]}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="text-slate-600">{task.assigneeHandle}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums text-slate-500">
                                预算 ${task.budgetLimitUsd.toFixed(2)}
                              </span>
                            </div>
                            <div className="text-xs font-semibold text-slate-900 mt-1">
                              {task.title}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {task.status === 'pending' && (
                              <button
                                type="button"
                                disabled={isExecuting}
                                onClick={() => onRunTask(task.id)}
                                className="skeuo-primary inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white cursor-pointer whitespace-nowrap disabled:opacity-50"
                              >
                                <Play className="w-3 h-3" />
                                <span>{isExecuting ? '执行中...' : 'AI 自主执行'}</span>
                              </button>
                            )}
                            {task.status === 'review' && (
                              <button
                                type="button"
                                onClick={() => onApproveTask(task.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer whitespace-nowrap"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>批准交付</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={onJumpToKanban}
                              className="text-xs text-slate-600 hover:text-slate-900 underline underline-offset-2 cursor-pointer whitespace-nowrap"
                            >
                              看板详情
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isBusy && (
          <div className="flex items-center gap-2 text-xs text-slate-500 pl-1">
            <span>团队智能体正在协同推演并同步任务卡片...</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Quick Scenario Dispatch Suggestions */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">快捷指令：</span>
        {quickPresets.map((preset, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setDraft(preset)}
            className="text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70 px-2.5 py-1 rounded-lg transition-colors cursor-pointer truncate max-w-full sm:max-w-[310px]"
            title={preset}
          >
            {preset}
          </button>
        ))}
      </div>

      {/* Chat Composer */}
      <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-2.5">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={isBusy}
          placeholder="输入需求或使用 @专家 派发新任务卡片（例如：@全栈开发员 实现汇率缓存并生成任务卡）..."
          className="flex-1 min-w-0 bg-white border border-slate-300/90 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/25 focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={isBusy || !draft.trim()}
          className="skeuo-primary inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45"
        >
          <Send className="w-3.5 h-3.5" />
          <span>{isBusy ? '派遣中...' : '发送派单'}</span>
        </button>
      </form>
    </ServiceCardShell>
  );
}
