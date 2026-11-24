import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight, FolderKanban, MessageSquareCode, Send } from 'lucide-react';
import type {
  AgentNexusAccount,
  ExpertAgent,
  HumanDirectThread,
  HumanExpert,
  ProjectWorkspace,
  TaskSessionMessage,
  WorkflowTask,
} from '../../types/agentnexus';
import { AgentIdentityName, EntityAvatar } from '../shared/EntityIdentity';
import { WORK_STATUS_META, WorkStatusBadge } from '../workcard/WorkCardFlow';
import { ChatChannelHeader } from './ChatChannelHeader';

interface HumanDirectChatPaneProps {
  expert: HumanExpert;
  thread: HumanDirectThread;
  agents: ExpertAgent[];
  workspaces: ProjectWorkspace[];
  allTasks: WorkflowTask[];
  taskSessions: Record<string, TaskSessionMessage[]>;
  account: AgentNexusAccount | null;
  onSendMessage: (expertId: string, text: string, linkedTaskId?: string) => void;
  onOpenTaskSession: (taskId: string) => void;
  onOpenAgentTaskSession: (agentId: string) => void;
  onSelectProjectChat: (projectId: string) => void;
}

export function HumanDirectChatPane({
  expert,
  thread,
  agents,
  workspaces,
  allTasks,
  taskSessions,
  account,
  onSendMessage,
  onOpenTaskSession,
  onOpenAgentTaskSession,
  onSelectProjectChat,
}: HumanDirectChatPaneProps) {
  const [draft, setDraft] = useState('');
  const [panelOpen, setPanelOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const ownedAgents = useMemo(
    () => agents.filter((a) => a.ownerHumanId === expert.id),
    [agents, expert.id],
  );
  const ownedAgentIds = useMemo(() => new Set(ownedAgents.map((a) => a.id)), [ownedAgents]);

  const sharedWorkspaces = useMemo(
    () =>
      workspaces.filter(
        (w) =>
          (w.hiredExpertIds || []).includes(expert.id) ||
          w.hiredAgentIds.some((aid) => ownedAgentIds.has(aid)),
      ),
    [expert.id, ownedAgentIds, workspaces],
  );

  const relatedTasks = useMemo(
    () => allTasks.filter((t) => ownedAgentIds.has(t.assigneeId)),
    [allTasks, ownedAgentIds],
  );

  const taskMap = useMemo(() => new Map(allTasks.map((t) => [t.id, t])), [allTasks]);
  const workspaceMap = useMemo(() => new Map(workspaces.map((w) => [w.id, w])), [workspaces]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [thread.messages.length, expert.id]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    onSendMessage(expert.id, draft.trim());
    setDraft('');
  };

  const quickPrompts = [
    relatedTasks[0]
      ? `同步一下 #${relatedTasks[0].id}「${relatedTasks[0].title}」的验收口径`
      : '帮我评估一下当前项目的交付风险与关键节点',
    ownedAgents[0]
      ? `请安排你名下的 ${ownedAgents[0].handle} 开启一个专项任务 Session`
      : '这周我们可以把里程碑拆成几张任务卡并行推进？',
  ];

  return (
    <div className="h-full flex min-h-0 bg-white relative">
      {/* Center Human 1v1 IM Column */}
      <div className="flex-1 min-w-0 flex flex-col h-full">
        <ChatChannelHeader
          avatar={
            <EntityAvatar
              kind="human"
              code={expert.avatarInitials}
              accent={expert.avatarAccent}
            />
          }
          title={expert.name}
          tag={`人类专家单聊 · ${ownedAgents.length} 个关联 Agent`}
          tagClassName="text-emerald-700"
          subtitle={`${expert.title} · 已完成 ${expert.completedProjects} 个项目 · 信誉 ${expert.reputationScore}`}
          panelOpen={panelOpen}
          panelToggleLabel="关联协作"
          onTogglePanel={() => setPanelOpen((v) => !v)}
        />

        {/* Messages */}
        <div className="flex-1 overflow-y-auto clean-scroll px-5 sm:px-8 py-5 bg-slate-50/40">
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="rounded-xl bg-white border border-slate-200 px-4 py-3 text-xs text-slate-600 leading-relaxed">
              <span className="font-semibold text-slate-900">{expert.name}</span> · {expert.bio}
            </div>

            {thread.messages.length === 0 && (
              <div className="py-10 text-center text-xs text-slate-500">
                可直接与 {expert.name} 沟通项目需求、外包排期或共同把关其名下 Agent 的交付结果。
              </div>
            )}

            {thread.messages.map((m) => {
              const isEmployer = m.sender === 'employer';
              const linkedTask = m.linkedTaskId ? taskMap.get(m.linkedTaskId) : undefined;
              const linkedWs = linkedTask ? workspaceMap.get(linkedTask.sessionId) : undefined;
              const linkedAgent = linkedTask
                ? agents.find((a) => a.id === linkedTask.assigneeId)
                : undefined;
              const linkedTurns = linkedTask ? taskSessions[linkedTask.id] || [] : [];

              return (
                <div
                  key={m.id}
                  className={`flex gap-3 ${isEmployer ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <EntityAvatar
                    kind="human"
                    code={isEmployer ? account?.avatarInitials || '我' : expert.avatarInitials}
                    accent={isEmployer ? '#0f172a' : expert.avatarAccent}
                  />

                  <div
                    className={`min-w-0 max-w-[84%] flex flex-col ${
                      isEmployer ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
                      <span className="font-semibold text-slate-700">
                        {isEmployer ? account?.name || '我' : expert.name}
                      </span>
                      <span className="font-mono tabular-nums">{m.timestamp}</span>
                    </div>

                    <div
                      className={`rounded-xl px-4 py-3 text-sm leading-relaxed space-y-2.5 ${
                        isEmployer
                          ? 'bg-slate-900 text-white'
                          : 'bg-white border border-slate-200 text-slate-800'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.content}</p>

                      {linkedTask && (
                        <button
                          type="button"
                          onClick={() => onOpenTaskSession(linkedTask.id)}
                          className="w-full text-left rounded-lg border border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/40 p-3 transition-colors cursor-pointer space-y-1.5 text-slate-800"
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="font-mono text-slate-500 truncate">
                              任务卡 #{linkedTask.id}
                              {linkedWs ? ` · ${linkedWs.name}` : ''}
                            </span>
                            <WorkStatusBadge status={linkedTask.status} />
                          </div>
                          <div className="text-xs font-semibold text-slate-900 leading-snug">
                            {linkedTask.title}
                          </div>
                          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 pt-0.5">
                            <AgentIdentityName
                              name={linkedTask.assigneeHandle}
                              runtime={linkedAgent?.runtimeAgent}
                              model={linkedAgent?.defaultModel}
                              className="font-medium text-slate-700"
                            />
                            <span className="inline-flex items-center gap-1 font-semibold text-blue-700 shrink-0">
                              <MessageSquareCode className="w-3 h-3" />
                              <span>
                                进入任务 Session
                                {linkedTurns.length > 0 ? ` (${linkedTurns.length})` : ''}
                              </span>
                            </span>
                          </div>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Composer */}
        <div className="shrink-0 p-4 border-t border-slate-200 bg-white">
          <div className="max-w-3xl mx-auto space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {quickPrompts.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSendMessage(expert.id, q, idx === 0 ? relatedTasks[0]?.id : undefined)}
                  className="text-left text-[11px] text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`给人类专家 ${expert.name} 发送消息...`}
                className="flex-1 min-w-0 bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-600/20"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer disabled:opacity-45 shrink-0 whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5" />
                <span>发送</span>
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Right Context Panel: Owned Agents, Aggregated Task Sessions & Shared Projects */}
      {panelOpen && (
        <aside className="fixed inset-y-0 right-0 z-30 lg:static lg:z-auto w-[320px] max-w-[88vw] shrink-0 border-l border-slate-200 bg-slate-50/70 flex flex-col h-full shadow-2xl lg:shadow-none">
          <div className="px-4 py-3 border-b border-slate-200 bg-white shrink-0">
            <div className="text-xs font-bold text-slate-900">专家协作档案</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              可直达其名下 Agent 的任务 Session 或共同项目群
            </div>
          </div>

          <div className="flex-1 overflow-y-auto clean-scroll p-4 space-y-4">
            {/* Owned Agents */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-800">
                名下 Agent 节点 ({ownedAgents.length})
              </div>
              {ownedAgents.length === 0 ? (
                <div className="text-xs text-slate-400">暂无关联公开 Agent</div>
              ) : (
                <div className="space-y-1.5">
                  {ownedAgents.map((ag) => {
                    const agTasks = allTasks.filter((t) => t.assigneeId === ag.id);
                    return (
                      <div
                        key={ag.id}
                        className="bg-white rounded-xl border border-slate-200 p-3 space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <EntityAvatar kind="agent" code={ag.avatarCode} accent={ag.avatarAccent} />
                          <div className="min-w-0 flex-1">
                            <AgentIdentityName
                              name={ag.handle}
                              runtime={ag.runtimeAgent}
                              model={ag.defaultModel}
                              showModel
                              className="text-xs font-bold text-slate-900"
                            />
                            <div className="text-[11px] text-slate-500 truncate">{ag.title}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onOpenAgentTaskSession(ag.id)}
                          className="w-full py-1.5 px-2.5 rounded-lg bg-slate-50 hover:bg-slate-900 hover:text-white border border-slate-200 text-xs font-semibold text-slate-700 inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <MessageSquareCode className="w-3.5 h-3.5" />
                          <span>
                            {agTasks.length > 0
                              ? `进入任务对话 (${agTasks.length} 个任务)`
                              : '开启新任务对话'}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Active Related Tasks */}
            {relatedTasks.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-800">
                  关联任务卡片 ({relatedTasks.length})
                </div>
                <div className="space-y-1.5">
                  {relatedTasks.map((t) => {
                    const ws = workspaceMap.get(t.sessionId);
                    const st = WORK_STATUS_META[t.status];
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onOpenTaskSession(t.id)}
                        className="w-full text-left bg-white hover:border-blue-300 rounded-lg border border-slate-200 p-2.5 transition-colors cursor-pointer space-y-1"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 truncate">{ws?.name || '项目'}</span>
                          <span className={`font-semibold shrink-0 ${st.textCls}`}>{st.label}</span>
                        </div>
                        <div className="text-xs font-semibold text-slate-900 truncate">{t.title}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Shared Project Groups */}
            {sharedWorkspaces.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-800">
                  共同参与项目群 ({sharedWorkspaces.length})
                </div>
                <div className="space-y-1.5">
                  {sharedWorkspaces.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => onSelectProjectChat(w.id)}
                      className="w-full text-left bg-white hover:border-slate-300 rounded-lg border border-slate-200 px-3 py-2 flex items-center justify-between gap-2 text-xs font-medium text-slate-800 transition-colors cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-1.5 truncate">
                        <FolderKanban className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="truncate">{w.name}</span>
                      </span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
