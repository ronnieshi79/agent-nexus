import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Briefcase,
  Check,
  MessageCircle,
  Search,
  Send,
  Sparkles,
  UploadCloud,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react';
import { fetchMarketMatches, type MarketMatchResult } from '../../services/api';
import type {
  AgentCategory,
  CommunityZone,
  DemandStatus,
  DirectMessage,
  ExpertAgent,
  ProjectWorkspace,
  ServiceMode,
} from '../../types/agentnexus';

const DEMAND_COLOR: Record<DemandStatus, string> = {
  供不应求: 'text-amber-700',
  需求旺盛: 'text-blue-700',
  档期充裕: 'text-emerald-700',
};

interface AgentMarketViewProps {
  workspace: ProjectWorkspace;
  zones: CommunityZone[];
  activeZone: CommunityZone;
  onSelectZone: (zoneId: string) => void;
  allAgents: ExpertAgent[];
  agents: ExpertAgent[];
  hiredIds: string[];
  dmHistories: Record<string, DirectMessage[]>;
  dmBusyAgentId: string | null;
  dmError: string | null;
  onClearDmError: () => void;
  onSendDm: (agentId: string, text: string) => Promise<void>;
  categorySeed: 'all' | AgentCategory;
  onClearCategorySeed: () => void;
  onHire: (agentId: string) => void;
  onRelease: (agentId: string) => void;
  onJumpToMountPrivate: () => void;
  onJumpToZoneProjects: (zoneId: string) => void;
}

const CATEGORY_TABS: { id: 'all' | AgentCategory; label: string }[] = [
  { id: 'all', label: '全部角色' },
  { id: 'product', label: '产品策划' },
  { id: 'architecture', label: '架构审查' },
  { id: 'engineering', label: '研发代码' },
  { id: 'qa', label: '测试质量' },
];

const CATEGORY_LABELS: Record<AgentCategory, string> = {
  product: '产品策划',
  architecture: '架构审查',
  engineering: '研发代码',
  qa: '测试质量',
};

const SERVICE_MODE_LABELS: Record<ServiceMode, string> = {
  'pure-agent': '纯 Agent 租用',
  'human-agent': '人 + Agent 协同',
};

export function AgentMarketView({
  workspace,
  zones,
  activeZone,
  onSelectZone,
  allAgents,
  agents,
  hiredIds,
  dmHistories,
  dmBusyAgentId,
  dmError,
  onClearDmError,
  onSendDm,
  categorySeed,
  onClearCategorySeed,
  onHire,
  onRelease,
  onJumpToMountPrivate,
  onJumpToZoneProjects,
}: AgentMarketViewProps) {
  const [categoryFilter, setCategoryFilter] = useState<'all' | AgentCategory>('all');
  const [modeFilter, setModeFilter] = useState<'all' | ServiceMode>('all');
  const [keyword, setKeyword] = useState('');
  const [aiQuery, setAiQuery] = useState('');
  const [aiMatching, setAiMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<MarketMatchResult | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);

  const [drawerAgentId, setDrawerAgentId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<'dm' | 'profile'>('dm');
  const [dmDraft, setDmDraft] = useState('');
  const dmEndRef = useRef<HTMLDivElement | null>(null);

  const zoneMap = useMemo(() => {
    const map = new Map<string, CommunityZone>();
    zones.forEach((z) => map.set(z.id, z));
    return map;
  }, [zones]);

  useEffect(() => {
    if (categorySeed !== 'all') {
      setCategoryFilter(categorySeed);
      onClearCategorySeed();
    }
  }, [categorySeed, onClearCategorySeed]);

  useEffect(() => {
    setMatchResult(null);
    setMatchError(null);
  }, [activeZone.id]);

  useEffect(() => {
    if (drawerAgentId && !agents.some((a) => a.id === drawerAgentId)) {
      setDrawerAgentId(null);
    }
  }, [agents, drawerAgentId]);

  const filteredAgents = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return agents.filter((agent) => {
      if (categoryFilter !== 'all' && agent.category !== categoryFilter) return false;
      if (modeFilter !== 'all' && agent.serviceMode !== modeFilter) return false;
      if (!q) return true;
      const haystack = [
        agent.handle,
        agent.name,
        agent.title,
        agent.region,
        SERVICE_MODE_LABELS[agent.serviceMode],
        ...agent.skills,
        ...agent.mcpTools,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [agents, categoryFilter, keyword, modeFilter]);

  const matchMap = useMemo(() => {
    const map = new Map<string, string>();
    matchResult?.matches.forEach((m) => map.set(m.agentId, m.reason));
    return map;
  }, [matchResult]);

  const drawerAgent = useMemo(
    () => agents.find((a) => a.id === drawerAgentId) ?? null,
    [agents, drawerAgentId],
  );

  const activeDmList = drawerAgent ? dmHistories[drawerAgent.id] || [] : [];
  const isDmBusy = Boolean(drawerAgent && dmBusyAgentId === drawerAgent.id);

  useEffect(() => {
    dmEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeDmList.length, isDmBusy, drawerAgentId, drawerTab]);

  const openDrawer = (agentId: string, tab: 'dm' | 'profile') => {
    setDrawerAgentId(agentId);
    setDrawerTab(tab);
    onClearDmError();
  };

  const handleAiMatch = async (e: FormEvent) => {
    e.preventDefault();
    const cleaned = aiQuery.trim();
    if (!cleaned || aiMatching) return;
    setAiMatching(true);
    setMatchError(null);
    try {
      const res = await fetchMarketMatches({
        requirement: cleaned,
        agents,
        hiredIds,
        zoneName: activeZone.name,
        zoneTagline: activeZone.tagline,
      });
      setMatchResult(res);
    } catch (err) {
      setMatchError(err instanceof Error ? err.message : 'AI 选人匹配失败');
    } finally {
      setAiMatching(false);
    }
  };

  const handleSendDmSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!drawerAgent || !dmDraft.trim() || isDmBusy) return;
    const text = dmDraft.trim();
    setDmDraft('');
    await onSendDm(drawerAgent.id, text);
  };

  const quickInterviewQuestions = drawerAgent
    ? [
        `针对「${workspace.name}」，如果你承接本项目第一步会重点把控什么？`,
        `我们项目范围比较聚焦，你挂牌价 $${drawerAgent.projectPriceUsd.toLocaleString('en-US')}/项目，具体包含哪些里程碑交付？`,
        drawerAgent.serviceMode === 'human-agent'
          ? '人+Agent 协同模式下，人类专家会在什么关键节点把关签发？'
          : '纯 Agent 租用模式下，全周期交付质量如何保障？',
      ]
    : [];

  return (
    <div className="h-full flex min-h-0 bg-white relative">
      {/* Main Market Directory */}
      <div className="flex-1 min-w-0 overflow-y-auto clean-scroll">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-5">
          {/* Open Space & Community Zones Directory (Open Space First) */}
          <div className="mb-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {zones.map((z) => {
                const isSelectedZone = z.id === activeZone.id;
                const count = allAgents.filter((a) => a.listedZoneIds.includes(z.id)).length;
                return (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => onSelectZone(z.id)}
                    className={`text-left rounded-xl p-3.5 border transition-colors cursor-pointer ${
                      isSelectedZone
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
                            isSelectedZone ? 'text-slate-300' : 'text-slate-400'
                          }`}
                        >
                          · {z.typeLabel}
                        </span>
                      </div>
                      <span
                        className={`text-xs font-mono tabular-nums font-semibold shrink-0 ${
                          isSelectedZone ? 'text-sky-300' : 'text-slate-600'
                        }`}
                      >
                        {count} 位专家
                      </span>
                    </div>
                    <div
                      className={`mt-1.5 text-[11px] truncate ${
                        isSelectedZone ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {z.focusDomains.join(' · ')}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 text-xs text-slate-500">
              <p className="truncate">
                <span className="font-semibold text-slate-800">{activeZone.name}</span>
                <span className="mx-1.5 text-slate-300">·</span>
                <span>{activeZone.tagline}</span>
              </p>
              <button
                type="button"
                onClick={() => onJumpToZoneProjects(activeZone.id)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-auto"
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>查看「{activeZone.name}」专区项目 / 发项目</span>
              </button>
            </div>
          </div>

          {/* AI Talent Advisor Bar + Mount Entry */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
            <form
              onSubmit={handleAiMatch}
              className="flex-1 min-w-0 p-1.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
            >
              <div className="flex items-center gap-1.5 px-2.5 text-xs font-semibold text-slate-800 whitespace-nowrap shrink-0">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>AI 选人顾问</span>
              </div>
              <input
                type="text"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                placeholder={`在「${activeZone.name}」描述项目难点，自动推荐最优专家组合...`}
                className="flex-1 min-w-0 bg-white rounded-lg px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
              <button
                type="submit"
                disabled={aiMatching || !aiQuery.trim()}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45"
              >
                {aiMatching ? '筛选中...' : '智能匹配组合'}
              </button>
            </form>

            <button
              type="button"
              onClick={onJumpToMountPrivate}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5 text-blue-600" />
              <span>挂载我的 Agent 上架</span>
            </button>
          </div>

          {matchError && (
            <div className="mt-3 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between gap-2">
              <span>{matchError}</span>
              <button
                type="button"
                onClick={() => setMatchError(null)}
                className="text-red-500 hover:text-red-800 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {matchResult && (
            <div className="mt-4 px-4 py-3 rounded-xl bg-blue-50/70 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-900">
                  <span>AI 组队推荐</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    预估项目组合签约 ${Math.round(Number(matchResult.estimatedBudgetUsd || 0)).toLocaleString('en-US')}
                  </span>
                </div>
                <p className="text-sm text-slate-800 mt-1">{matchResult.summary}</p>
              </div>
              <button
                type="button"
                onClick={() => setMatchResult(null)}
                className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-center"
              >
                清除推荐
              </button>
            </div>
          )}

          {/* Filter Toolbar */}
          <div className="mt-5 pb-5 mb-5 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
              {CATEGORY_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCategoryFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    categoryFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(
                  [
                    { id: 'all', label: '全部模式' },
                    { id: 'pure-agent', label: '纯 Agent 租用' },
                    { id: 'human-agent', label: '人 + Agent 协同' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setModeFilter(opt.id)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      modeFilter === opt.id
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="搜索能力标签、MCP 或角色..."
                  className="w-full sm:w-52 bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>
            </div>
          </div>

          {/* Expert Catalog Grid */}
          <div
            className={`grid gap-4 ${
              drawerAgent
                ? 'grid-cols-1 md:grid-cols-2'
                : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
            }`}
          >
            {filteredAgents.length === 0 ? (
              <div className="col-span-full py-12 text-center border border-dashed border-slate-300 rounded-xl bg-slate-50">
                <p className="text-sm font-medium text-slate-700">没有符合筛选条件的专家 Agent</p>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryFilter('all');
                    setModeFilter('all');
                    setKeyword('');
                  }}
                  className="mt-3 px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 cursor-pointer"
                >
                  重置筛选
                </button>
              </div>
            ) : (
              filteredAgents.map((agent) => {
                const isHired = hiredIds.includes(agent.id);
                const aiReason = matchMap.get(agent.id);
                const isSelected = drawerAgentId === agent.id;
                const dmCount = (dmHistories[agent.id] || []).length;

                return (
                  <article
                    key={agent.id}
                    className={`rounded-xl p-4 flex flex-col justify-between transition-colors border ${
                      aiReason
                        ? 'bg-blue-50/40 border-blue-300'
                        : isSelected
                          ? 'bg-slate-50 border-slate-400'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                            style={{ backgroundColor: agent.avatarAccent }}
                          >
                            {agent.avatarCode}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <h3 className="text-sm font-bold text-slate-900 truncate">
                                {agent.handle}
                              </h3>
                              {agent.ownership === 'private' ? (
                                <span className="text-[11px] font-medium text-indigo-600 whitespace-nowrap shrink-0">
                                  · 我上架的
                                </span>
                              ) : (
                                agent.primaryZoneId &&
                                agent.primaryZoneId !== 'zone_public' && (
                                  <span
                                    className="text-[11px] font-semibold whitespace-nowrap shrink-0"
                                    style={{
                                      color: zoneMap.get(agent.primaryZoneId)?.accentColor || '#0f766e',
                                    }}
                                  >
                                    · {zoneMap.get(agent.primaryZoneId)?.name}认证
                                  </span>
                                )
                              )}
                            </div>
                            <p className="text-xs text-slate-600 truncate">{agent.title}</p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-base font-bold font-mono tabular-nums text-slate-900">
                            ${agent.projectPriceUsd.toLocaleString('en-US')}
                          </div>
                          <div className="text-[11px] whitespace-nowrap">
                            <span className="text-slate-500">每项目 · </span>
                            <span className={`font-semibold ${DEMAND_COLOR[agent.performance.demandStatus]}`}>
                              {agent.performance.demandStatus}
                            </span>
                          </div>
                        </div>
                      </div>

                      {aiReason && (
                        <p className="mt-2.5 text-xs text-blue-900 bg-blue-100/70 rounded-lg px-2.5 py-1.5 leading-relaxed">
                          AI 推荐：{aiReason}
                        </p>
                      )}

                      {/* Unboxed Capability Tier, Reputation & Supply-Demand Data */}
                      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 font-mono tabular-nums">
                        <span
                          className={`font-sans font-semibold ${
                            agent.serviceMode === 'human-agent' ? 'text-indigo-700' : 'text-slate-800'
                          }`}
                        >
                          {SERVICE_MODE_LABELS[agent.serviceMode]}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-sans font-semibold text-slate-800">
                          {agent.performance.capabilityTier}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>信誉 {agent.performance.reputationScore}</span>
                        <span aria-hidden="true">·</span>
                        <span>复购 {agent.performance.repeatHireRate}%</span>
                      </div>

                      <p className="mt-2.5 text-xs text-slate-700 leading-relaxed">
                        <span className="text-slate-400 mr-1.5">能力</span>
                        {agent.skills.join(' · ')}
                      </p>

                      <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between gap-2">
                        <span className="truncate">{agent.performance.demandNote}</span>
                        <span className="font-mono tabular-nums shrink-0">
                          {agent.performance.completedProjects} 项目 · 评分 {agent.performance.rating.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => openDrawer(agent.id, 'dm')}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer whitespace-nowrap"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>{dmCount > 0 ? `私聊协商 (${dmCount})` : '私聊协商'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openDrawer(agent.id, 'profile')}
                          className="text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer whitespace-nowrap"
                        >
                          绩效履历
                        </button>
                      </div>

                      {isHired ? (
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 whitespace-nowrap">
                            <Check className="w-3.5 h-3.5" />
                            已在群
                          </span>
                          <button
                            type="button"
                            onClick={() => onRelease(agent.id)}
                            title="移出当前项目群"
                            className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onHire(agent.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white whitespace-nowrap cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>一键拉入群</span>
                        </button>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Right Slide-in Drawer: 1-on-1 Private Interview DM + Performance Profile */}
      {drawerAgent && (
        <aside className="fixed inset-y-0 right-0 z-40 lg:static lg:z-auto w-full max-w-[420px] lg:w-[410px] shrink-0 border-l border-slate-200 bg-white flex flex-col h-full shadow-2xl lg:shadow-none">
          {/* Drawer Header */}
          <div className="px-5 pt-4 pb-3 border-b border-slate-200 bg-slate-50/70">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: drawerAgent.avatarAccent }}
                >
                  {drawerAgent.avatarCode}
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-slate-900 truncate">
                    {drawerAgent.handle} · {drawerAgent.name}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {SERVICE_MODE_LABELS[drawerAgent.serviceMode]} · {drawerAgent.region}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerAgentId(null)}
                className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 cursor-pointer shrink-0"
                aria-label="关闭抽屉"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Segmented Drawer Tabs */}
            <div className="mt-3 grid grid-cols-2 gap-1 p-1 bg-slate-200/70 rounded-lg">
              <button
                type="button"
                onClick={() => setDrawerTab('dm')}
                className={`py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  drawerTab === 'dm'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                1v1 私聊协商
              </button>
              <button
                type="button"
                onClick={() => setDrawerTab('profile')}
                className={`py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  drawerTab === 'profile'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                能力与绩效
              </button>
            </div>
          </div>

          {/* Drawer Body */}
          {drawerTab === 'dm' ? (
            <div className="flex-1 min-h-0 flex flex-col">
              {/* DM Conversation Stream */}
              <div className="flex-1 overflow-y-auto clean-scroll p-4 space-y-3.5 bg-slate-50/40">
                {/* Auto Opening Greeting from Candidate Expert */}
                <div className="flex flex-col items-start">
                  <span className="text-[11px] text-slate-500 mb-1">
                    {drawerAgent.handle} · 雇前私聊沟通
                  </span>
                  <div className="rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 leading-relaxed max-w-[92%]">
                    你好！我是 {drawerAgent.name}（{drawerAgent.performance.capabilityTier} · 信誉 {drawerAgent.performance.reputationScore}），提供「{SERVICE_MODE_LABELS[drawerAgent.serviceMode]}」服务，项目挂牌价 ${drawerAgent.projectPriceUsd.toLocaleString('en-US')}/项目（{drawerAgent.performance.demandStatus}）。关于「{workspace.name}」的交付范围与项目报价，都可以先在这里私聊敲定。
                  </div>
                </div>

                {activeDmList.map((m) => {
                  const isEmployer = m.sender === 'employer';
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isEmployer ? 'items-end' : 'items-start'}`}
                    >
                      <span className="text-[11px] text-slate-400 mb-1 font-mono tabular-nums">
                        {isEmployer ? '我' : drawerAgent.handle} · {m.timestamp}
                      </span>
                      <div
                        className={`rounded-xl px-3.5 py-2.5 text-xs leading-relaxed max-w-[90%] whitespace-pre-wrap ${
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

                {isDmBusy && (
                  <div className="text-xs text-slate-500">
                    {drawerAgent.handle} 正在结合你的项目背景组织回复...
                  </div>
                )}

                {dmError && (
                  <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between gap-2">
                    <span>{dmError}</span>
                    <button
                      type="button"
                      onClick={onClearDmError}
                      className="text-red-500 hover:text-red-800 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <div ref={dmEndRef} />
              </div>

              {/* Quick Interview Questions + DM Composer */}
              <div className="p-3.5 border-t border-slate-200 bg-white space-y-2.5">
                <div className="flex flex-wrap gap-1.5">
                  {quickInterviewQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={isDmBusy}
                      onClick={() => onSendDm(drawerAgent.id, q)}
                      className="text-left text-[11px] text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70 px-2.5 py-1 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSendDmSubmit} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={dmDraft}
                    onChange={(e) => setDmDraft(e.target.value)}
                    disabled={isDmBusy}
                    placeholder={`私聊提问 ${drawerAgent.handle}，确认能力与报价...`}
                    className="flex-1 min-w-0 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-600/20"
                  />
                  <button
                    type="submit"
                    disabled={isDmBusy || !dmDraft.trim()}
                    className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer disabled:opacity-45 shrink-0"
                    aria-label="发送私聊"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto clean-scroll p-5 space-y-5 bg-slate-50/40">
              <p className="text-xs text-slate-700 leading-relaxed">{drawerAgent.bio}</p>

              <div className="grid grid-cols-2 gap-3.5 py-4 border-y border-slate-200">
                <div>
                  <div className="text-[11px] text-slate-500">能力等级 · 综合信誉</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5 font-mono tabular-nums">
                    {drawerAgent.performance.capabilityTier} · {drawerAgent.performance.reputationScore}/100
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">历史交付项目 / 复购率</div>
                  <div className="text-sm font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                    {drawerAgent.performance.completedProjects} 个 · {drawerAgent.performance.repeatHireRate}%
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">一次验收通过率</div>
                  <div className="text-sm font-bold font-mono tabular-nums text-emerald-700 mt-0.5">
                    {drawerAgent.performance.successRate}%（均期 {drawerAgent.performance.avgDeliveryDays} 天）
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">当前供需与档期</div>
                  <div className={`text-xs font-semibold mt-1 ${DEMAND_COLOR[drawerAgent.performance.demandStatus]}`}>
                    {drawerAgent.performance.demandStatus} · {drawerAgent.performance.demandNote}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-800 mb-1">项目定价依据（能力 × 稀缺性 × 供需）</div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {drawerAgent.performance.pricingBasis}
                </p>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-800 mb-1">履约架构与服务模式</div>
                <div className="text-xs text-slate-600">
                  {SERVICE_MODE_LABELS[drawerAgent.serviceMode]} · {drawerAgent.engineModel}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-800 mb-1">已装配 MCP 工具链</div>
                <div className="text-xs font-mono text-slate-600">
                  {drawerAgent.mcpTools.join(' / ')}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-800 mb-2">雇主履约评价</div>
                <div className="space-y-2.5">
                  {drawerAgent.performance.recentReviews.map((rev, idx) => (
                    <div key={idx} className="bg-white rounded-lg p-3 border border-slate-200">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-800">{rev.employer}</span>
                        <span className="font-mono tabular-nums text-amber-700 font-semibold">
                          {rev.score.toFixed(1)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{rev.project}</div>
                      <p className="text-xs text-slate-700 mt-1.5 leading-relaxed">“{rev.comment}”</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Sticky Bottom Hire Confirmation Bar */}
          <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between gap-3 shrink-0">
            <div className="min-w-0">
              <div className="text-sm font-bold font-mono tabular-nums text-slate-900">
                ${drawerAgent.projectPriceUsd.toLocaleString('en-US')} / 项目
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {drawerAgent.performance.capabilityTier} · {drawerAgent.performance.demandStatus}
              </div>
            </div>

            {hiredIds.includes(drawerAgent.id) ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800 whitespace-nowrap shrink-0">
                <Check className="w-3.5 h-3.5" />
                <span>已在当前项目群</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onHire(drawerAgent.id)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer whitespace-nowrap shrink-0"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>确认雇佣 · 拉入项目群</span>
              </button>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
