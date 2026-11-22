import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CheckCircle2, Send, UserPlus, X } from 'lucide-react';
import type {
  AgentNexusAccount,
  ExpertAgent,
  NegotiationStatus,
  NegotiationThread,
  ProjectWorkspace,
  ServiceMode,
} from '../../types/agentnexus';
import { AgentMark, EntityAvatar, displayEntityName } from '../shared/EntityIdentity';
import { ChatChannelHeader } from './ChatChannelHeader';

interface DirectNegotiationPaneProps {
  agent: ExpertAgent;
  thread: NegotiationThread;
  workspaces: ProjectWorkspace[];
  account: AgentNexusAccount | null;
  isBusy: boolean;
  error: string | null;
  onClearError: () => void;
  onSendMessage: (agentId: string, text: string) => Promise<void>;
  onUpdateTerms: (
    agentId: string,
    patch: Partial<
      Pick<
        NegotiationThread,
        'targetProjectId' | 'negotiatedPriceUsd' | 'scopeNote' | 'firstWorkCardTitle'
      >
    >,
  ) => void;
  onConfirmHire: (agentId: string, createFirstCard: boolean) => void;
}

const STATUS_META: Record<NegotiationStatus, { label: string; cls: string }> = {
  negotiating: { label: '洽谈中', cls: 'text-slate-600' },
  quoted: { label: '已报价待确认', cls: 'text-amber-700' },
  hired: { label: '已雇佣入群', cls: 'text-emerald-700' },
};

const SERVICE_MODE_LABELS: Record<ServiceMode, string> = {
  'pure-agent': '纯 Agent 租用',
  'human-agent': '人 + Agent 协同',
};

export function DirectNegotiationPane({
  agent,
  thread,
  workspaces,
  account,
  isBusy,
  error,
  onClearError,
  onSendMessage,
  onUpdateTerms,
  onConfirmHire,
}: DirectNegotiationPaneProps) {
  const [draft, setDraft] = useState('');
  const [panelOpen, setPanelOpen] = useState(true);
  const [createFirstCard, setCreateFirstCard] = useState(true);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const targetWorkspace =
    workspaces.find((w) => w.id === thread.targetProjectId) || workspaces[0];
  const isAlreadyInTarget = Boolean(targetWorkspace?.hiredAgentIds.includes(agent.id));
  const st = STATUS_META[thread.status];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [thread.messages.length, isBusy, agent.id]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || isBusy) return;
    const text = draft.trim();
    setDraft('');
    await onSendMessage(agent.id, text);
  };

  const targetDiscountPrice = Math.max(
    500,
    Math.round((agent.projectPriceUsd * 0.9) / 100) * 100,
  );

  const quickPrompts = [
    `针对「${targetWorkspace?.name}」，你的整个项目交付里程碑怎么拆分？`,
    `项目预算希望控制在 $${targetDiscountPrice.toLocaleString('en-US')}/项目，能否锁定档期一口价承接？`,
    agent.serviceMode === 'human-agent'
      ? '人+Agent 协同模式下，人类专家具体把关哪几个关键环节？'
      : '项目交付周期内如何保障返工兜底与一次验收通过？',
  ];

  return (
    <div className="h-full flex min-h-0 bg-white relative">
      {/* Center 1v1 Negotiation Stream */}
      <div className="flex-1 min-w-0 flex flex-col h-full">
        {/* Uniform Top Channel Header with Identical Top-Right Side Panel Toggle */}
        <ChatChannelHeader
          avatar={
            <EntityAvatar
              kind="agent"
              code={agent.avatarCode}
              accent={agent.avatarAccent}
            />
          }
          title={`${displayEntityName(agent.handle)} · ${agent.name}`}
          tag={`AI Agent · ${agent.ownerHumanName ? `主理人 ${agent.ownerHumanName} · ` : ''}${st.label}`}
          tagClassName={st.cls}
          subtitle={`${SERVICE_MODE_LABELS[agent.serviceMode]} · ${agent.performance.capabilityTier} · 信誉 ${agent.performance.reputationScore} · 挂牌 $${agent.projectPriceUsd.toLocaleString('en-US')}/项目 · ${agent.performance.demandStatus}`}
          panelOpen={panelOpen}
          panelToggleLabel="雇佣协商单"
          onTogglePanel={() => setPanelOpen((v) => !v)}
        />

        {/* Messages */}
        <div className="flex-1 overflow-y-auto clean-scroll px-5 sm:px-8 py-5 bg-slate-50/40">
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="flex flex-col items-start">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 mb-1">
                <span className="font-semibold text-slate-700">
                  {displayEntityName(agent.handle)}
                </span>
                <AgentMark />
                <span>
                  {agent.ownerHumanName ? `· 主理人 ${agent.ownerHumanName}` : '· 外部专家单聊通道'}
                </span>
              </span>
              <div className="rounded-xl bg-white border border-slate-200 px-4 py-3 text-xs text-slate-800 leading-relaxed max-w-[88%]">
                你好！我是 {agent.name}
                {agent.ownerHumanName ? `（归属主理人：${agent.ownerHumanName}）` : ''}，提供「{SERVICE_MODE_LABELS[agent.serviceMode]}」服务，擅长{' '}
                {agent.skills.slice(0, 3).join('、')}。我们可以先就「{targetWorkspace?.name}」的需求范围、里程碑交付标准和项目报价沟通一致，右侧协商单会实时同步，确认后一键拉我入群即可开工。
              </div>
            </div>

            {thread.messages.map((m) => {
              const isEmployer = m.sender === 'employer';
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isEmployer ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1 font-mono tabular-nums">
                    <span className="font-sans font-medium text-slate-600">
                      {isEmployer ? account?.name || '我（雇主）' : displayEntityName(agent.handle)}
                    </span>
                    {!isEmployer && <AgentMark />}
                    <span>{m.timestamp}</span>
                    {typeof m.quotedPriceUsd === 'number' && !isEmployer && (
                      <span className="text-amber-700 font-semibold">
                        · 项目报价 ${Math.round(m.quotedPriceUsd).toLocaleString('en-US')}
                      </span>
                    )}
                  </div>
                  <div
                    className={`rounded-xl px-4 py-3 text-sm leading-relaxed max-w-[88%] whitespace-pre-wrap ${
                      isEmployer
                        ? 'bg-slate-900 text-white'
                        : 'bg-white border border-slate-200 text-slate-800'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              );
            })}

            {isBusy && (
              <div className="text-xs text-slate-500">
                {displayEntityName(agent.handle)} 正在结合项目复杂度与当前档期评估项目报价...
              </div>
            )}

            {error && (
              <div className="px-3.5 py-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between gap-2">
                <span>{error}</span>
                <button
                  type="button"
                  onClick={onClearError}
                  className="text-red-500 hover:text-red-800 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Quick Prompts + Composer */}
        <div className="shrink-0 p-4 border-t border-slate-200 bg-white">
          <div className="max-w-3xl mx-auto space-y-2.5">
            <div className="flex flex-wrap gap-1.5">
              {quickPrompts.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={isBusy}
                  onClick={() => onSendMessage(agent.id, q)}
                  className="text-left text-[11px] text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70 px-2.5 py-1 rounded-md transition-colors cursor-pointer disabled:opacity-50"
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
                disabled={isBusy}
                placeholder={`私聊沟通 ${displayEntityName(agent.handle)} 的交付范围、排期与报价...`}
                className="flex-1 min-w-0 bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-600/20"
              />
              <button
                type="submit"
                disabled={isBusy || !draft.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white cursor-pointer disabled:opacity-45 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isBusy ? '发送中...' : '发送'}</span>
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Right Docked Hiring Agreement Sheet */}
      {panelOpen && (
        <aside className="fixed inset-y-0 right-0 z-30 lg:static lg:z-auto w-[336px] max-w-[88vw] shrink-0 border-l border-slate-200 bg-slate-50/70 flex flex-col h-full shadow-2xl lg:shadow-none">
          <div className="p-4 border-b border-slate-200 bg-white shrink-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-900">雇佣协商单</span>
              <span className={`text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              对话达成共识后会自动更新条款，确认即可拉入对应项目群。
            </p>
          </div>

          <div className="flex-1 overflow-y-auto clean-scroll p-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                拟加入目标项目
              </label>
              <select
                value={thread.targetProjectId}
                onChange={(e) =>
                  onUpdateTerms(agent.id, { targetProjectId: e.target.value })
                }
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              >
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-lg bg-white border border-slate-200 p-3 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-800">
                  {agent.performance.capabilityTier} · 信誉 {agent.performance.reputationScore}
                </span>
                <span className="text-slate-500 font-mono tabular-nums">
                  复购 {agent.performance.repeatHireRate}%
                </span>
              </div>
              <div className="text-[11px] text-amber-700 font-medium">
                {agent.performance.demandStatus} · {agent.performance.demandNote}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {agent.performance.pricingBasis}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                协商项目签约价 (USD)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="500"
                  step="100"
                  value={thread.negotiatedPriceUsd}
                  onChange={(e) =>
                    onUpdateTerms(agent.id, {
                      negotiatedPriceUsd: Number(e.target.value) || agent.projectPriceUsd,
                    })
                  }
                  className="w-28 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono tabular-nums font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
                <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                  挂牌参考 ${agent.projectPriceUsd.toLocaleString('en-US')}/项目
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                入群首张工作卡片标题
              </label>
              <input
                type="text"
                value={thread.firstWorkCardTitle}
                onChange={(e) =>
                  onUpdateTerms(agent.id, { firstWorkCardTitle: e.target.value })
                }
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                协商交付范围备注
              </label>
              <textarea
                rows={3}
                value={thread.scopeNote}
                onChange={(e) =>
                  onUpdateTerms(agent.id, { scopeNote: e.target.value })
                }
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-600/20 resize-none"
              />
            </div>

            <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={createFirstCard}
                onChange={(e) => setCreateFirstCard(e.target.checked)}
                className="mt-0.5 rounded border-slate-300"
              />
              <span>确认雇佣后自动在项目群与「工作看板」立项该首张工作卡片</span>
            </label>

          </div>

          <div className="shrink-0 p-4 border-t border-slate-200 bg-white">
            {isAlreadyInTarget ? (
              <div className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
                <CheckCircle2 className="w-4 h-4" />
                <span>已加入「{targetWorkspace?.name || '目标项目'}」</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onConfirmHire(agent.id, createFirstCard)}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>确认雇佣 · 拉入项目群</span>
              </button>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
