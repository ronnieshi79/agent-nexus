import { useState, type FormEvent } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  GraduationCap,
  MapPin,
  Plus,
  Radio,
  Ticket,
  Users,
} from 'lucide-react';
import { EntityAvatar } from '../shared/EntityIdentity';
import { EmptyStateCard, ModalShell } from '../shared/UiPrimitives';
import type { CommunityEvent, CommunityEventFormat } from '../../types/agentnexus';

export const EVENT_FORMAT_META: Record<
  CommunityEventFormat,
  {
    label: string;
    shortLabel: string;
    badgeCls: string;
    icon: typeof MapPin;
  }
> = {
  offline_meetup: {
    label: '线下交流',
    shortLabel: '线下',
    badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    icon: MapPin,
  },
  online_live: {
    label: '线上直播分享',
    shortLabel: '直播',
    badgeCls: 'bg-sky-50 text-sky-700 border-sky-200/80',
    icon: Radio,
  },
  workshop_training: {
    label: '实战培训',
    shortLabel: '培训',
    badgeCls: 'bg-violet-50 text-violet-700 border-violet-200/80',
    icon: GraduationCap,
  },
};

interface CommunityEventsPanelProps {
  communityName: string;
  events: CommunityEvent[];
  onToggleRegisterEvent: (eventId: string, note?: string) => void;
  onOpenPublishEvent: () => void;
}

export function CommunityEventsPanel({
  communityName,
  events,
  onToggleRegisterEvent,
  onOpenPublishEvent,
}: CommunityEventsPanelProps) {
  const [expandedAgendaIds, setExpandedAgendaIds] = useState<Record<string, boolean>>({});
  const [modalEventId, setModalEventId] = useState<string | null>(null);
  const [contactNote, setContactNote] = useState('');

  const modalEvent = modalEventId ? events.find((e) => e.id === modalEventId) || null : null;

  const handleOpenRegistrationModal = (ev: CommunityEvent) => {
    setContactNote(ev.registrationNote || '');
    setModalEventId(ev.id);
  };

  const handleConfirmRegistration = (e: FormEvent) => {
    e.preventDefault();
    if (!modalEvent) return;
    onToggleRegisterEvent(modalEvent.id, contactNote.trim() || undefined);
    if (modalEvent.registeredByMe) {
      setModalEventId(null);
    }
  };

  if (events.length === 0) {
    return (
      <EmptyStateCard
        icon={<CalendarDays className="w-6 h-6" />}
        description={`「${communityName}」当前筛选下暂无主题活动，主理人可发起线下交流、线上直播分享或收费实战培训。`}
        action={
          <button
            type="button"
            onClick={onOpenPublishEvent}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>发布主题活动</span>
          </button>
        }
      />
    );
  }

  return (
    <>
      <div className="space-y-3.5">
        {events.map((ev) => {
          const fmt = EVENT_FORMAT_META[ev.format];
          const FormatIcon = fmt.icon;
          const isFull = ev.registeredCount >= ev.capacity;
          const seatsLeft = Math.max(0, ev.capacity - ev.registeredCount);
          const fillPct = Math.min(100, Math.round((ev.registeredCount / Math.max(1, ev.capacity)) * 100));
          const agendaOpen = Boolean(expandedAgendaIds[ev.id]);

          return (
            <article
              key={ev.id}
              className="bg-white rounded-xl border border-slate-200 p-5 space-y-3.5 hover:border-slate-300 transition-colors"
            >
              {/* Top Row: Format, Host & Pricing */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-semibold ${fmt.badgeCls}`}
                    >
                      <FormatIcon className="w-3 h-3" />
                      <span>{fmt.label}</span>
                    </span>
                    {ev.registeredByMe ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>已报名</span>
                      </span>
                    ) : isFull ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200 font-semibold">
                        名额已满
                      </span>
                    ) : (
                      <span className="text-slate-500 font-medium">报名中 · 余 {seatsLeft} 席</span>
                    )}
                    <span className="text-slate-300" aria-hidden="true">·</span>
                    <span className="text-slate-400">{ev.createdAt}</span>
                  </div>

                  <h3 className="text-[15px] font-bold text-slate-900 leading-snug">
                    {ev.title}
                  </h3>
                </div>

                {/* Pricing Display */}
                <div className="shrink-0 sm:text-right flex sm:flex-col items-baseline sm:items-end gap-2 sm:gap-0.5">
                  {ev.isFree || ev.priceCny <= 0 ? (
                    <span className="text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-lg">
                      免费参加
                    </span>
                  ) : (
                    <>
                      <div className="text-base font-bold font-mono tabular-nums text-slate-900">
                        ¥{ev.priceCny}
                        <span className="text-[11px] font-normal text-slate-500 ml-0.5">/人</span>
                      </div>
                      <span className="text-[10px] text-amber-700 font-medium">
                        主理人商业活动 · 含回放/资料
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Event Summary */}
              <p className="text-xs text-slate-600 leading-relaxed">{ev.summary}</p>

              {/* Key Logistics Strip: Time, Location/Link, Host */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg bg-slate-50/90 border border-slate-200/70 px-3.5 py-2.5 text-xs">
                <div className="flex items-center gap-2 text-slate-700 min-w-0">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate font-medium">{ev.startTimeLabel}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 min-w-0">
                  {ev.format === 'online_live' ? (
                    <Radio className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                  ) : (
                    <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  )}
                  <span className="truncate">{ev.location}</span>
                </div>
              </div>

              {/* Optional Expandable Agenda */}
              {ev.agenda.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedAgendaIds((prev) => ({ ...prev, [ev.id]: !prev[ev.id] }))
                    }
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    <span>活动议程与收获（{ev.agenda.length} 项）</span>
                    {agendaOpen ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                  {agendaOpen && (
                    <ul className="mt-2 space-y-1.5 pl-1">
                      {ev.agenda.map((item, idx) => (
                        <li
                          key={`${ev.id}_ag_${idx}`}
                          className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed"
                        >
                          <span className="w-4 h-4 rounded bg-slate-100 text-slate-600 font-mono text-[10px] font-semibold inline-flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Footer: Host Info, Capacity Progress & Register CTA */}
              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <EntityAvatar
                      kind="human"
                      code={ev.hostCode}
                      accent={ev.hostAccent}
                      size="xs"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-800 truncate">
                        {ev.hostName}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">{ev.hostRole}</div>
                    </div>
                  </div>

                  <span className="text-slate-200 hidden sm:inline" aria-hidden="true">|</span>

                  {/* Capacity indicator */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isFull
                            ? 'bg-slate-400'
                            : fillPct >= 80
                              ? 'bg-amber-500'
                              : 'bg-blue-600'
                        }`}
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-mono tabular-nums text-slate-600">
                      {ev.registeredCount}/{ev.capacity}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  {ev.registeredByMe ? (
                    <button
                      type="button"
                      onClick={() => handleOpenRegistrationModal(ev)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-xs font-semibold text-emerald-800 cursor-pointer transition-colors"
                    >
                      <Ticket className="w-3.5 h-3.5" />
                      <span>查看入场凭证</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isFull}
                      onClick={() => handleOpenRegistrationModal(ev)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-500 text-xs font-semibold text-white cursor-pointer disabled:cursor-not-allowed transition-colors"
                    >
                      <Ticket className="w-3.5 h-3.5" />
                      <span>
                        {isFull
                          ? '名额已满'
                          : ev.isFree || ev.priceCny <= 0
                            ? '免费报名'
                            : `报名参加 · ¥${ev.priceCny}`}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Registration & Ticket Pass Modal */}
      <ModalShell
        open={Boolean(modalEvent)}
        onClose={() => setModalEventId(null)}
        title={modalEvent?.registeredByMe ? '活动入场凭证' : '确认活动报名'}
        icon={<Ticket className="w-4 h-4 text-violet-600" />}
        maxWidthClass="max-w-md"
        onSubmit={handleConfirmRegistration}
        footer={
          modalEvent?.registeredByMe ? (
            <>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-xs font-semibold text-rose-700 cursor-pointer"
              >
                取消报名
              </button>
              <button
                type="button"
                onClick={() => setModalEventId(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
              >
                完成
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setModalEventId(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                取消
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
              >
                <Ticket className="w-3.5 h-3.5" />
                <span>
                  {modalEvent && (modalEvent.isFree || modalEvent.priceCny <= 0)
                    ? '确认免费报名'
                    : `确认报名并支付 ¥${modalEvent?.priceCny ?? 0}`}
                </span>
              </button>
            </>
          )
        }
      >
        {modalEvent && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-[11px]">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-semibold ${EVENT_FORMAT_META[modalEvent.format].badgeCls}`}
                >
                  {EVENT_FORMAT_META[modalEvent.format].label}
                </span>
                <span className="text-slate-500">主理：{modalEvent.hostName}</span>
              </div>
              <h4 className="text-sm font-bold text-slate-900 leading-snug">
                {modalEvent.title}
              </h4>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-2 text-xs text-slate-700">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">活动时间</span>
                <span className="font-medium text-right">{modalEvent.startTimeLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">
                  {modalEvent.format === 'online_live' ? '直播入口' : '活动地点'}
                </span>
                <span className="font-medium text-right">{modalEvent.location}</span>
              </div>
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/80">
                <span className="text-slate-500">报名费用</span>
                <span className="font-bold font-mono tabular-nums text-slate-900">
                  {modalEvent.isFree || modalEvent.priceCny <= 0
                    ? '免费（¥0）'
                    : `¥${modalEvent.priceCny}`}
                </span>
              </div>
            </div>

            {modalEvent.registeredByMe ? (
              <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-4 space-y-2 text-center">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>报名成功 · 席位已锁定</span>
                </div>
                <div className="text-lg font-bold font-mono tracking-wider text-slate-900 bg-white border border-emerald-200 rounded-lg py-2 px-3">
                  {modalEvent.registrationCode || 'AGN-EV-8820'}
                </div>
                <p className="text-[11px] text-emerald-800/80">
                  {modalEvent.format === 'online_live'
                    ? '开播前 15 分钟将通过 AGN 站内消息发送直播间直达链接'
                    : '线下签到或入群交流时出示此入场凭证码即可核验'}
                </p>
                {modalEvent.registrationNote && (
                  <div className="text-[11px] text-slate-600 pt-1">
                    备注：{modalEvent.registrationNote}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-slate-600">
                  报名备注 / 关注议题（选填）
                </label>
                <input
                  type="text"
                  value={contactNote}
                  onChange={(e) => setContactNote(e.target.value)}
                  placeholder="例：希望交流多 Agent 商业化定价与客户交付案例"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
                {!modalEvent.isFree && modalEvent.priceCny > 0 && (
                  <p className="text-[11px] text-slate-500">
                    付费活动报名将计入主理人社区结算台账，活动开始前 24 小时支持原路取消。
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </ModalShell>
    </>
  );
}

interface CommunityEventInlineCardProps {
  event: CommunityEvent;
  onToggleRegisterEvent: (eventId: string) => void;
  onJumpToEventsTab: () => void;
}

export function CommunityEventInlineCard({
  event,
  onToggleRegisterEvent,
  onJumpToEventsTab,
}: CommunityEventInlineCardProps) {
  const fmt = EVENT_FORMAT_META[event.format];
  const FormatIcon = fmt.icon;
  const isFull = event.registeredCount >= event.capacity;

  return (
    <div className="rounded-lg border border-violet-200/80 bg-violet-50/40 px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-semibold ${fmt.badgeCls}`}
          >
            <FormatIcon className="w-3 h-3" />
            <span>{fmt.label}</span>
          </span>
          <span className="font-semibold text-slate-900 truncate">{event.title}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-600">
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>{event.startTimeLabel}</span>
          </span>
          <span className="inline-flex items-center gap-1 truncate">
            <MapPin className="w-3 h-3 text-slate-400" />
            <span className="truncate">{event.location}</span>
          </span>
          <span className="font-mono tabular-nums text-slate-500">
            {event.registeredCount}/{event.capacity} 人
          </span>
          <span className="font-semibold text-slate-800">
            {event.isFree || event.priceCny <= 0 ? '免费' : `¥${event.priceCny}`}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onJumpToEventsTab}
          className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
        >
          详情
        </button>
        <button
          type="button"
          disabled={!event.registeredByMe && isFull}
          onClick={() => onToggleRegisterEvent(event.id)}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer whitespace-nowrap transition-colors ${
            event.registeredByMe
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              : isFull
                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                : 'bg-slate-900 text-white hover:bg-slate-800'
          }`}
        >
          {event.registeredByMe ? (
            <>
              <CheckCircle2 className="w-3 h-3" />
              <span>已报名</span>
            </>
          ) : (
            <>
              <Ticket className="w-3 h-3" />
              <span>
                {isFull
                  ? '已满员'
                  : event.isFree || event.priceCny <= 0
                    ? '免费报名'
                    : `报名 ¥${event.priceCny}`}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
