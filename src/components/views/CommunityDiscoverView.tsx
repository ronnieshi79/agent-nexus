import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  Plus,
  Send,
  Store,
  UserPlus,
  X,
} from 'lucide-react';
import type {
  CommunityZone,
  ExpertAgent,
  ServiceMode,
  ZoneProjectOpportunity,
} from '../../types/agentnexus';

type DiscoverScope = 'joined' | 'public' | 'all';

interface CommunityDiscoverViewProps {
  zones: CommunityZone[];
  joinedZoneIds: string[];
  zoneProjects: ZoneProjectOpportunity[];
  allAgents: ExpertAgent[];
  zoneSeed: string | null;
  onClearZoneSeed: () => void;
  onToggleJoinZone: (zoneId: string) => void;
  onPublishZoneProject: (input: {
    zoneId: string;
    title: string;
    summary: string;
    budgetUsd: number;
    durationDays: number;
    requiredRoles: string[];
  }) => string;
  onClaimZoneProject: (oppId: string) => string;
  onJumpToZoneMarket: (zoneId: string) => void;
  onJumpToKanban: (projectId?: string) => void;
}

const SERVICE_MODE_LABELS: Record<ServiceMode, string> = {
  'pure-agent': '纯 Agent 租用',
  'human-agent': '人 + Agent 协同',
};

export function CommunityDiscoverView({
  zones,
  joinedZoneIds,
  zoneProjects,
  allAgents,
  zoneSeed,
  onClearZoneSeed,
  onToggleJoinZone,
  onPublishZoneProject,
  onClaimZoneProject,
  onJumpToZoneMarket,
  onJumpToKanban,
}: CommunityDiscoverViewProps) {
  const [scope, setScope] = useState<DiscoverScope>('public');
  const [selectedZoneId, setSelectedZoneId] = useState<string>('all');

  // Inline publish project to zone form
  const [showPublishForm, setShowPublishForm] = useState(false);
  const [pubZoneId, setPubZoneId] = useState<string>(zones[0]?.id || 'zone_public');
  const [pubTitle, setPubTitle] = useState('');
  const [pubSummary, setPubSummary] = useState('');
  const [pubBudget, setPubBudget] = useState(3200);
  const [pubDays, setPubDays] = useState(7);
  const [pubRoles, setPubRoles] = useState('架构审查, 全栈研发');

  useEffect(() => {
    if (zoneSeed) {
      const target = zones.find((z) => z.id === zoneSeed);
      if (target) {
        if (target.kind === 'public') {
          setScope('public');
          setSelectedZoneId('all');
        } else {
          setScope(joinedZoneIds.includes(target.id) ? 'joined' : 'all');
          setSelectedZoneId(target.id);
        }
        setPubZoneId(target.id);
      }
      onClearZoneSeed();
    }
  }, [joinedZoneIds, onClearZoneSeed, zoneSeed, zones]);

  const zoneMap = useMemo(() => {
    const map = new Map<string, CommunityZone>();
    zones.forEach((z) => map.set(z.id, z));
    return map;
  }, [zones]);

  const joinedProjectsCount = useMemo(
    () => zoneProjects.filter((p) => joinedZoneIds.includes(p.zoneId)).length,
    [joinedZoneIds, zoneProjects],
  );

  const publicProjectsCount = useMemo(
    () =>
      zoneProjects.filter((p) => zoneMap.get(p.zoneId)?.kind === 'public').length,
    [zoneMap, zoneProjects],
  );

  const filteredProjects = useMemo(() => {
    return zoneProjects.filter((p) => {
      const z = zoneMap.get(p.zoneId);
      if (scope === 'joined') {
        if (!joinedZoneIds.includes(p.zoneId)) return false;
        if (selectedZoneId !== 'all' && p.zoneId !== selectedZoneId) return false;
        return true;
      }
      if (scope === 'public') {
        return z?.kind === 'public';
      }
      if (selectedZoneId !== 'all' && p.zoneId !== selectedZoneId) return false;
      return true;
    });
  }, [joinedZoneIds, scope, selectedZoneId, zoneMap, zoneProjects]);

  const handlePublishSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!pubTitle.trim()) return;
    const roles = pubRoles
      .split(/[,，、/]/)
      .map((s) => s.trim())
      .filter(Boolean);
    onPublishZoneProject({
      zoneId: pubZoneId,
      title: pubTitle,
      summary: pubSummary,
      budgetUsd: pubBudget,
      durationDays: pubDays,
      requiredRoles: roles,
    });
    setPubTitle('');
    setPubSummary('');
    setShowPublishForm(false);
    const targetZone = zoneMap.get(pubZoneId);
    if (targetZone?.kind === 'public') {
      setScope('public');
      setSelectedZoneId('all');
    } else if (joinedZoneIds.includes(pubZoneId)) {
      setScope('joined');
      setSelectedZoneId(pubZoneId);
    } else {
      setScope('all');
      setSelectedZoneId(pubZoneId);
    }
  };

  const handleZoneCardClick = (zone: CommunityZone) => {
    if (zone.kind === 'public') {
      setScope('public');
      setSelectedZoneId('all');
    } else {
      if (joinedZoneIds.includes(zone.id)) {
        setScope('joined');
      } else {
        setScope('all');
      }
      setSelectedZoneId((prev) => (prev === zone.id ? 'all' : zone.id));
    }
    setPubZoneId(zone.id);
  };

  return (
    <div className="h-full flex flex-col min-h-0 bg-white">
      {/* Top Communities Overview + Scope Tabs */}
      <div className="shrink-0 px-5 sm:px-8 pt-4 pb-3.5 border-b border-slate-200 space-y-4">
        {/* Community Zones Strip: Joined Private Zones First, Public Space Last */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {zones.map((z) => {
            const isPublic = z.kind === 'public';
            const isJoined = isPublic || joinedZoneIds.includes(z.id);
            const projCnt = zoneProjects.filter((p) => p.zoneId === z.id).length;
            const expertCnt = allAgents.filter((a) => a.listedZoneIds.includes(z.id)).length;
            const isHighlighted =
              (scope === 'public' && isPublic) ||
              (scope !== 'public' && selectedZoneId === z.id);

            return (
              <div
                key={z.id}
                onClick={() => handleZoneCardClick(z)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleZoneCardClick(z);
                  }
                }}
                className={`rounded-xl p-3.5 border transition-colors cursor-pointer flex flex-col justify-between gap-2 ${
                  isHighlighted
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-white border-slate-200 text-slate-900 hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-6 h-6 rounded-md text-[11px] font-bold text-white inline-flex items-center justify-center shrink-0"
                      style={{ backgroundColor: z.accentColor }}
                    >
                      {z.shortCode}
                    </span>
                    <span className="text-sm font-bold truncate">{z.name}</span>
                    <span
                      className={`text-[11px] whitespace-nowrap shrink-0 ${
                        isHighlighted ? 'text-slate-300' : 'text-slate-400'
                      }`}
                    >
                      · {z.typeLabel}
                    </span>
                  </div>

                  {isPublic ? (
                    <span
                      className={`text-[11px] font-medium whitespace-nowrap shrink-0 ${
                        isHighlighted ? 'text-slate-300' : 'text-slate-400'
                      }`}
                    >
                      开放空间
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleJoinZone(z.id);
                      }}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isJoined
                          ? isHighlighted
                            ? 'bg-white/15 text-emerald-300 hover:bg-white/25'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : isHighlighted
                            ? 'bg-blue-500 text-white hover:bg-blue-400'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {isJoined ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>已加入</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3 h-3" />
                          <span>加入专区</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div
                  className={`flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums ${
                    isHighlighted ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  <span>
                    {projCnt} 个项目 · {expertCnt} 位专家
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onJumpToZoneMarket(z.id);
                    }}
                    className={`inline-flex items-center gap-1 font-sans font-medium cursor-pointer whitespace-nowrap ${
                      isHighlighted
                        ? 'text-sky-300 hover:text-white'
                        : 'text-blue-700 hover:text-blue-900'
                    }`}
                  >
                    <Store className="w-3 h-3" />
                    <span>专家市场</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Scope Tabs + Publish Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'public', label: `开放空间项目 (${publicProjectsCount})` },
                  { id: 'joined', label: `我加入的专区项目 (${joinedProjectsCount})` },
                  { id: 'all', label: `全部项目 (${zoneProjects.length})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setScope(tab.id);
                    setSelectedZoneId('all');
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    scope === tab.id
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {selectedZoneId !== 'all' && scope !== 'public' && (
              <button
                type="button"
                onClick={() => setSelectedZoneId('all')}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900 cursor-pointer whitespace-nowrap"
              >
                <span>仅看 {zoneMap.get(selectedZoneId)?.name}</span>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowPublishForm((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap cursor-pointer self-start sm:self-auto"
          >
            <Send className="w-3.5 h-3.5" />
            <span>向专区发项目</span>
          </button>
        </div>
      </div>

      {/* Scrollable Discover Feed */}
      <div className="flex-1 min-h-0 overflow-y-auto clean-scroll bg-slate-50/70 px-5 sm:px-8 py-5">
        <div className="max-w-6xl mx-auto space-y-4">
          {/* Inline Publish Project Form */}
          {showPublishForm && (
            <form
              onSubmit={handlePublishSubmit}
              className="p-4 rounded-xl bg-white border border-blue-200 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900">
                    向开放空间或指定社区专区发布项目需求
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    发布后将同步展示在对应专区项目大厅，并在「工作看板」自动创建我主管的项目与群聊。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPublishForm(false)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    目标发布专区
                  </label>
                  <select
                    value={pubZoneId}
                    onChange={(e) => setPubZoneId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                  >
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name}（{z.typeLabel}）
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    项目预算（USD / 项目）
                  </label>
                  <input
                    type="number"
                    min={500}
                    step={100}
                    value={pubBudget}
                    onChange={(e) => setPubBudget(Number(e.target.value) || 1000)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    期望交付周期（天）
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={pubDays}
                    onChange={(e) => setPubDays(Number(e.target.value) || 7)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  required
                  value={pubTitle}
                  onChange={(e) => setPubTitle(e.target.value)}
                  placeholder="项目标题（如：东南亚支付渠道接入与拒付风控引擎）..."
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                />
                <input
                  type="text"
                  value={pubRoles}
                  onChange={(e) => setPubRoles(e.target.value)}
                  placeholder="招募专家角色（逗号分隔，如：支付架构审查, 全栈研发）"
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                />
              </div>

              <textarea
                rows={2}
                value={pubSummary}
                onChange={(e) => setPubSummary(e.target.value)}
                placeholder="简要说明项目交付范围、技术栈与验收标准..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 resize-none"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPublishForm(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white cursor-pointer"
                >
                  确认发布到专区
                </button>
              </div>
            </form>
          )}

          {/* Project Cards */}
          {filteredProjects.length === 0 ? (
            <div className="py-14 text-center rounded-xl border border-dashed border-slate-300 bg-white space-y-2">
              <p className="text-sm font-medium text-slate-700">
                {scope === 'joined'
                  ? '你当前尚未加入任何社区专区，或所选专区暂无项目'
                  : '当前筛选下暂无社区项目'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setScope('all');
                  setSelectedZoneId('all');
                }}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer"
              >
                查看全部专区项目
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredProjects.map((opp) => {
                const zone = zoneMap.get(opp.zoneId);
                const isMine = opp.direction === 'published_by_me';
                const isClaimed = opp.status === 'claimed';

                return (
                  <article
                    key={opp.id}
                    className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between gap-4 hover:border-slate-300 transition-colors"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                            {zone && (
                              <span
                                className="font-bold"
                                style={{ color: zone.accentColor }}
                              >
                                {zone.name}
                              </span>
                            )}
                            <span className="text-slate-300" aria-hidden="true">·</span>
                            <span
                              className={`font-semibold ${
                                isMine
                                  ? 'text-blue-700'
                                  : isClaimed
                                    ? 'text-emerald-700'
                                    : 'text-teal-700'
                              }`}
                            >
                              {isMine
                                ? '我方发布 · 招募专家中'
                                : isClaimed
                                  ? '我方已承接参与'
                                  : '专区发包 · 可承接参与'}
                            </span>
                            <span className="text-slate-300" aria-hidden="true">·</span>
                            <span className="text-slate-400">{opp.postedAt}</span>
                          </div>
                          <h3 className="text-sm font-bold text-slate-900 mt-1.5 leading-snug">
                            {opp.title}
                          </h3>
                          <div className="text-xs text-slate-500 mt-0.5">{opp.publisher}</div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-base font-bold font-mono tabular-nums text-slate-900">
                            ${opp.budgetUsd.toLocaleString('en-US')}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono tabular-nums inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{opp.durationDays} 天交付</span>
                          </div>
                        </div>
                      </div>

                      <p className="mt-2.5 text-xs text-slate-600 leading-relaxed">
                        {opp.summary}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                        <span className="text-slate-400">需求角色</span>
                        <span className="text-slate-800 font-medium">
                          {opp.requiredRoles.join(' · ')}
                        </span>
                        <span className="text-slate-300" aria-hidden="true">·</span>
                        <span>
                          {opp.serviceModePref === 'any'
                            ? '纯 Agent / 人+Agent 皆可'
                            : SERVICE_MODE_LABELS[opp.serviceModePref]}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onJumpToZoneMarket(opp.zoneId)}
                        className="text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer whitespace-nowrap"
                      >
                        浏览「{zone?.name}」专家团队
                      </button>

                      {isMine ? (
                        <button
                          type="button"
                          onClick={() => onJumpToKanban(opp.linkedWorkspaceId)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
                        >
                          <span>去工作看板管理</span>
                        </button>
                      ) : isClaimed ? (
                        <button
                          type="button"
                          onClick={() => onJumpToKanban(opp.linkedWorkspaceId)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold cursor-pointer whitespace-nowrap"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>已承接 · 进入工作看板</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onClaimZoneProject(opp.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>派出团队承接</span>
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
