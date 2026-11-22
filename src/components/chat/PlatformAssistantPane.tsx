import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Receipt,
  Send,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import type {
  AgentNexusAccount,
  AssistantActionCard,
  AssistantMessage,
  ExpertAgent,
  PlatformAuditLog,
  PlatformServiceCategory,
  SettlementRecord,
} from '../../types/agentnexus';
import { AgentMark, displayEntityName } from '../shared/EntityIdentity';
import { ChatChannelHeader } from './ChatChannelHeader';

interface PlatformAssistantPaneProps {
  messages: AssistantMessage[];
  settlements: SettlementRecord[];
  auditLogs: PlatformAuditLog[];
  privateAgents: ExpertAgent[];
  account: AgentNexusAccount | null;
  isBusy: boolean;
  onSendMessage: (text: string) => Promise<void>;
  onSettleRecord: (settlementId: string) => void;
  onSettleAll: () => void;
  onOpenDm: (agentId: string) => void;
  onOpenKanban: (projectId?: string) => void;
  onOpenTeam: () => void;
}

const CATEGORY_LABELS: Record<PlatformServiceCategory, { label: string; cls: string }> = {
  settlement: { label: '结算服务', cls: 'text-emerald-700' },
  order: { label: '接单与协商', cls: 'text-blue-700' },
  audit: { label: '审计提醒', cls: 'text-amber-700' },
  general: { label: '平台助理', cls: 'text-slate-600' },
};

const QUICK_COMMANDS = [
  '帮我核对当前所有项目的待结算项目款明细',
  '巡检有没有待验收交付物或项目预算超支风险',
  '汇总外部专家项目报价协商与我私有节点的接单状态',
];

export function PlatformAssistantPane({
  messages,
  settlements,
  auditLogs,
  privateAgents,
  account,
  isBusy,
  onSendMessage,
  onSettleRecord,
  onSettleAll,
  onOpenDm,
  onOpenKanban,
  onOpenTeam,
}: PlatformAssistantPaneProps) {
  const [draft, setDraft] = useState('');
  const [panelOpen, setPanelOpen] = useState(true);
  const [rightTab, setRightTab] = useState<'settlement' | 'audit'>('settlement');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, isBusy]);

  const unsettledRecords = useMemo(
    () => settlements.filter((s) => s.status === 'unsettled'),
    [settlements],
  );
  const unsettledTotal = useMemo(
    () => unsettledRecords.reduce((sum, s) => sum + s.amountUsd, 0),
    [unsettledRecords],
  );
  const settledTotal = useMemo(
    () =>
      settlements
        .filter((s) => s.status === 'settled')
        .reduce((sum, s) => sum + s.amountUsd, 0),
    [settlements],
  );
  const listedPrivateAgents = useMemo(
    () => privateAgents.filter((a) => a.isListedInMarket),
    [privateAgents],
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || isBusy) return;
    const text = draft.trim();
    setDraft('');
    await onSendMessage(text);
  };

  const handleCardAction = (card: AssistantActionCard) => {
    if (!card.actionTarget || card.resolved) return;
    switch (card.actionTarget.type) {
      case 'settle':
        onSettleRecord(card.actionTarget.settlementId);
        break;
      case 'open_dm':
        onOpenDm(card.actionTarget.agentId);
        break;
      case 'open_kanban':
        onOpenKanban(card.actionTarget.projectId);
        break;
      case 'open_team':
        onOpenTeam();
        break;
    }
  };

  return (
    <div className="h-full flex min-h-0 bg-white relative">
      {/* Center Assistant Chat Stream */}
      <div className="flex-1 min-w-0 flex flex-col h-full">
        {/* Uniform Top Channel Header */}
        <ChatChannelHeader
          avatar={
            <div className="w-9 h-9 rounded-lg bg-slate-900 text-sky-300 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5" />
            </div>
          }
          title="Nexa 平台助理"
          tag="官方助理 Agent"
          tagClassName="text-blue-700"
          subtitle="提供全平台项目签约结算、接单与协商提醒、交付审计与预算风控护栏服务"
          panelOpen={panelOpen}
          panelToggleLabel={`平台服务台 (${unsettledRecords.length})`}
          onTogglePanel={() => setPanelOpen((v) => !v)}
        />

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto clean-scroll px-5 sm:px-8 py-5 space-y-5 bg-slate-50/40">
          <div className="max-w-3xl mx-auto space-y-5">
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              const catMeta = msg.category ? CATEGORY_LABELS[msg.category] : CATEGORY_LABELS.general;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-1">
                    <span className="font-semibold text-slate-700">
                      {isUser ? account?.name || '我' : 'Nexa 平台助理'}
                    </span>
                    {!isUser && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className={`font-semibold ${catMeta.cls}`}>{catMeta.label}</span>
                      </>
                    )}
                    <span className="font-mono tabular-nums text-slate-400">{msg.timestamp}</span>
                  </div>

                  <div
                    className={`rounded-xl px-4 py-3 text-sm leading-relaxed max-w-[92%] sm:max-w-[85%] ${
                      isUser
                        ? 'bg-slate-900 text-white'
                        : 'bg-white border border-slate-200 text-slate-800'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>

                    {msg.cards && msg.cards.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5">
                        {msg.cards.map((card) => {
                          const cardCat = CATEGORY_LABELS[card.category] || CATEGORY_LABELS.general;
                          return (
                            <div
                              key={card.id}
                              className="rounded-lg bg-slate-50 border border-slate-200/90 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                                  <span className={`font-semibold ${cardCat.cls}`}>
                                    {cardCat.label}
                                  </span>
                                  {card.metricLabel && (
                                    <>
                                      <span className="text-slate-300" aria-hidden="true">·</span>
                                      <span className="font-mono tabular-nums font-semibold text-slate-800">
                                        {card.metricLabel}
                                      </span>
                                    </>
                                  )}
                                </div>
                                <div className="text-xs font-bold text-slate-900 mt-1">
                                  {card.title}
                                </div>
                                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                                  {card.detail}
                                </p>
                              </div>

                              {card.actionLabel && (
                                <button
                                  type="button"
                                  disabled={card.resolved}
                                  onClick={() => handleCardAction(card)}
                                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                                    card.resolved
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                                  }`}
                                >
                                  {card.resolved ? (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>已处理</span>
                                    </>
                                  ) : (
                                    <>
                                      <span>{card.actionLabel}</span>
                                      <ArrowUpRight className="w-3.5 h-3.5" />
                                    </>
                                  )}
                                </button>
                              )}
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
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Nexa 平台助理正在核对跨项目账单、接单与审计状态...</span>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Quick Prompts + Composer */}
        <div className="shrink-0 p-4 border-t border-slate-200 bg-white">
          <div className="max-w-3xl mx-auto space-y-2.5">
            <div className="flex flex-wrap gap-1.5">
              {QUICK_COMMANDS.map((cmd) => (
                <button
                  key={cmd}
                  type="button"
                  disabled={isBusy}
                  onClick={() => onSendMessage(cmd)}
                  className="text-[11px] text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70 px-2.5 py-1 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                >
                  {cmd}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={isBusy}
                placeholder="向 Nexa 平台助理下达指令：如“核对各项目结算账单”或“检查高危审批项”..."
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

      {/* Right Docked Platform Concierge Service Desk */}
      {panelOpen && (
        <aside className="fixed inset-y-0 right-0 z-30 lg:static lg:z-auto w-[336px] max-w-[88vw] shrink-0 border-l border-slate-200 bg-slate-50/70 flex flex-col h-full shadow-2xl lg:shadow-none">
          <div className="p-3.5 border-b border-slate-200 bg-white shrink-0">
            <div className="text-xs font-bold text-slate-900">平台服务台</div>
            <div className="mt-2.5 grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setRightTab('settlement')}
                className={`py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  rightTab === 'settlement'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                结算台账 ({unsettledRecords.length})
              </button>
              <button
                type="button"
                onClick={() => setRightTab('audit')}
                className={`py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  rightTab === 'audit'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                审计与接单 ({auditLogs.length})
              </button>
            </div>
          </div>

          {rightTab === 'settlement' ? (
            <div className="flex-1 overflow-y-auto clean-scroll p-4 space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[11px] text-slate-500">待核销项目款</div>
                    <div className="text-lg font-bold font-mono tabular-nums text-amber-700 mt-0.5">
                      ${Math.round(unsettledTotal).toLocaleString('en-US')}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">累计已结算</div>
                    <div className="text-lg font-bold font-mono tabular-nums text-emerald-700 mt-0.5">
                      ${Math.round(settledTotal).toLocaleString('en-US')}
                    </div>
                  </div>
                </div>
                {unsettledRecords.length > 0 && (
                  <button
                    type="button"
                    onClick={onSettleAll}
                    className="w-full py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
                  >
                    一键核销全部 {unsettledRecords.length} 笔待结项目款
                  </button>
                )}
              </div>

              <div className="space-y-2.5">
                {settlements.map((s) => (
                  <div
                    key={s.id}
                    className="bg-white rounded-lg border border-slate-200 p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900 truncate">
                        <span className="truncate">{displayEntityName(s.agentHandle)}</span>
                        <AgentMark />
                      </span>
                      <span className="font-mono tabular-nums font-bold text-slate-900 shrink-0">
                        ${Math.round(s.amountUsd).toLocaleString('en-US')}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">{s.projectName}</div>
                    <div className="text-xs text-slate-700 line-clamp-2">{s.milestoneLabel}</div>
                    <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <span className="font-mono tabular-nums text-slate-400">
                        {s.id} · {s.createdAt}
                      </span>
                      {s.status === 'settled' ? (
                        <span className="text-emerald-700 font-semibold">已结算</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSettleRecord(s.id)}
                          className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 font-semibold cursor-pointer"
                        >
                          <Receipt className="w-3 h-3" />
                          <span>确认结算</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto clean-scroll p-4 space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900">私有节点对外接单状态</span>
                  <button
                    type="button"
                    onClick={onOpenTeam}
                    className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
                  >
                    去我的团队
                  </button>
                </div>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  当前共有 <span className="font-mono font-semibold">{privateAgents.length}</span>{' '}
                  个私有挂载节点，其中{' '}
                  <span className="font-mono font-semibold text-emerald-700">
                    {listedPrivateAgents.length}
                  </span>{' '}
                  个已上架市场自动接单。
                </p>
              </div>

              <div className="space-y-2.5">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="bg-white rounded-lg border border-slate-200 p-3 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span
                        className={`font-semibold inline-flex items-center gap-1 ${
                          log.severity === 'warning'
                            ? 'text-amber-700'
                            : log.severity === 'success'
                              ? 'text-emerald-700'
                              : 'text-blue-700'
                        }`}
                      >
                        <ShieldAlert className="w-3 h-3" />
                        <span>{CATEGORY_LABELS[log.category].label}</span>
                      </span>
                      <span className="font-mono tabular-nums text-slate-400">{log.timestamp}</span>
                    </div>
                    <div className="text-xs font-semibold text-slate-900">{log.title}</div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">{log.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
