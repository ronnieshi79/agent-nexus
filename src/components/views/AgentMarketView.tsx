import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Check,
  Cpu,
  MessageCircle,
  Send,
  Sparkles,
  UploadCloud,
  User,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react';
import { AgentMark, EntityAvatar, HumanMark, displayEntityName } from '../shared/EntityIdentity';
import {
  ToolbarDivider,
  ToolbarDropdown,
  ToolbarPopoverWidget,
  ToolbarSearch,
  ToolbarSegment,
  ViewToolbar,
} from '../shared/ViewToolbar';
import { ZoneSelectorDropdown } from '../shared/ZoneSelectorDropdown';
import { fetchMarketMatches, type MarketMatchResult } from '../../services/api';
import type {
  AgentCategory,
  CommunityZone,
  DemandStatus,
  DirectMessage,
  ExpertAgent,
  HumanExpert,
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
  humanExperts: HumanExpert[];
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
  { id: 'all', label: '全部类别' },
  { id: 'engineering', label: '研发开发' },
  { id: 'design', label: '设计体验' },
  { id: 'product', label: '产品策划' },
  { id: 'architecture', label: '架构审查' },
  { id: 'qa', label: '测试质量' },
];

const CATEGORY_LABELS: Record<AgentCategory, string> = {
  engineering: '研发开发',
  design: '设计体验',
  product: '产品策划',
  architecture: '架构审查',
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
  humanExperts,
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
  const [entityTab, setEntityTab] = useState<'agents' | 'humans'>('agents');
  const [ownerFilterId, setOwnerFilterId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'all' | AgentCategory>('all');
  const [modeFilter, setModeFilter] = useState<'all' | ServiceMode>('all');
  const [keyword, setKeyword] = useState('');
  const [aiQuery, setAiQuery] = useState('');
  const [aiPopoverOpen, setAiPopoverOpen] = useState(false);
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
    setOwnerFilterId(null);
  }, [activeZone.id]);

  useEffect(() => {
    if (drawerAgentId && !allAgents.some((a) => a.id === drawerAgentId)) {
      setDrawerAgentId(null);
    }
  }, [allAgents, drawerAgentId]);

  const ownerAgentCountMap = useMemo(() => {
    const map = new Map<string, number>();
    allAgents.forEach((a) => {
      if (a.ownerHumanId && a.isListedInMarket) {
        map.set(a.ownerHumanId, (map.get(a.ownerHumanId) || 0) + 1);
      }
    });
    return map;
  }, [allAgents]);

  const zoneHumansAllCount = useMemo(
    () =>
      humanExperts.filter(
        (human) =>
          human.zoneIds.includes(activeZone.id) ||
          agents.some((a) => a.ownerHumanId === human.id),
      ).length,
    [activeZone.id, agents, humanExperts],
  );

  const zoneHumans = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return humanExperts
      .map((human) => {
        const ownedInZone = agents.filter((a) => a.ownerHumanId === human.id);
        const ownedAllListed = allAgents.filter(
          (a) => a.ownerHumanId === human.id && a.isListedInMarket,
        );
        return { human, ownedInZone, ownedAllListed };
      })
      .filter(({ human, ownedInZone }) => {
        const inZone =
          human.zoneIds.includes(activeZone.id) || ownedInZone.length > 0;
        if (!inZone) return false;
        if (categoryFilter !== 'all' && human.category !== categoryFilter) return false;
        if (!q) return true;
        const haystack = [
          human.name,
          human.title,
          CATEGORY_LABELS[human.category],
          human.bio,
          ...human.specialties,
          ...ownedInZone.map((a) => `${displayEntityName(a.handle)} ${a.name} ${a.title}`),
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      });
  }, [activeZone.id, agents, allAgents, categoryFilter, humanExperts, keyword]);

  const activeOwnerFilter = useMemo(
    () => (ownerFilterId ? humanExperts.find((h) => h.id === ownerFilterId) || null : null),
    [humanExperts, ownerFilterId],
  );

  const filteredAgents = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return agents.filter((agent) => {
      if (ownerFilterId && agent.ownerHumanId !== ownerFilterId) return false;
      if (categoryFilter !== 'all' && agent.category !== categoryFilter) return false;
      if (modeFilter !== 'all' && agent.serviceMode !== modeFilter) return false;
      if (!q) return true;
      const haystack = [
        displayEntityName(agent.handle),
        agent.name,
        agent.title,
        agent.runtimeAgent,
        agent.defaultModel,
        agent.ownerHumanName || '',
        agent.region,
        SERVICE_MODE_LABELS[agent.serviceMode],
        ...agent.skills,
        ...agent.mcpTools,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [agents, categoryFilter, keyword, modeFilter, ownerFilterId]);

  const drawerAgent = useMemo(
    () => allAgents.find((a) => a.id === drawerAgentId) ?? null,
    [allAgents, drawerAgentId],
  );

  const matchMap = useMemo(() => {
    const map = new Map<string, string>();
    matchResult?.matches.forEach((m) => map.set(m.agentId, m.reason));
    return map;
  }, [matchResult]);

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
      setEntityTab('agents');
      setAiPopoverOpen(false);
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

  const hasActiveSubStrip = Boolean(activeOwnerFilter || matchResult || matchError);

  return (
    <div className="h-full flex min-h-0 bg-white relative">
      {/* Main Market Directory */}
      <div className="flex-1 min-w-0 flex flex-col h-full min-h-0">
        {/* Unified Single-Row Composable Widget Toolbar */}
        <ViewToolbar
          left={
            <>
              <ZoneSelectorDropdown
                zones={zones}
                activeZoneId={activeZone.id}
                onSelectZone={onSelectZone}
                getZoneStat={(z) => {
                  const count = allAgents.filter((a) => a.listedZoneIds.includes(z.id)).length;
                  return `${count} 位专家 · ${z.focusDomains.slice(0, 2).join(' / ')}`;
                }}
              />

              <ToolbarDivider />

              <ToolbarSegment
                value={entityTab}
                onChange={(next) => {
                  setEntityTab(next);
                  if (next === 'humans') setOwnerFilterId(null);
                }}
                options={[
                  {
                    id: 'agents',
                    label: 'Agent',
                    count: agents.length,
                    icon: <Cpu className="w-3.5 h-3.5 text-indigo-600 shrink-0" />,
                  },
                  {
                    id: 'humans',
                    label: '专家',
                    count: zoneHumansAllCount,
                    icon: <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />,
                  },
                ]}
              />

              <ToolbarDropdown
                label="分类"
                value={categoryFilter}
                defaultValue="all"
                onChange={setCategoryFilter}
                options={CATEGORY_TABS.map((t) => ({ id: t.id, label: t.label }))}
              />

              {entityTab === 'agents' && (
                <ToolbarDropdown
                  label="模式"
                  value={modeFilter}
                  defaultValue="all"
                  onChange={setModeFilter}
                  options={[
                    { id: 'all', label: '全部模式' },
                    { id: 'pure-agent', label: '纯 Agent 租用' },
                    { id: 'human-agent', label: '人 + Agent 协同' },
                  ]}
                />
              )}
            </>
          }
          right={
            <>
              <ToolbarSearch
                value={keyword}
                onChange={setKeyword}
                placeholder={
                  entityTab === 'humans'
                    ? '搜索专家、类别、专长...'
                    : '搜索 Agent、本体、模型、技能...'
                }
              />

              <ToolbarPopoverWidget
                open={aiPopoverOpen}
                onOpenChange={setAiPopoverOpen}
                triggerLabel="AI 选人"
                triggerIcon={<Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                activeHighlight={Boolean(matchResult)}
              >
                <form onSubmit={handleAiMatch} className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 inline-flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      <span>AI 选人顾问 · {activeZone.name}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setAiPopoverOpen(false)}
                      className="text-slate-400 hover:text-slate-700 cursor-pointer"
                      aria-label="关闭 AI 选人弹窗"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    描述项目难点或目标交付周期，自动匹配最适合的 Agent 组合与预算预估。
                  </p>
                  <textarea
                    rows={3}
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                    placeholder="例：需要搭建高并发支付清算模块，7天内完成接口研发与端到端回归测试..."
                    className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/15 resize-none"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onJumpToZoneProjects(activeZone.id)}
                      className="text-[11px] font-medium text-slate-500 hover:text-blue-700 cursor-pointer"
                    >
                      逛「{activeZone.name}」社区动态 →
                    </button>
                    <button
                      type="submit"
                      disabled={aiMatching || !aiQuery.trim()}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white cursor-pointer disabled:opacity-45 whitespace-nowrap"
                    >
                      {aiMatching ? '匹配中...' : '智能匹配组合'}
                    </button>
                  </div>
                </form>
              </ToolbarPopoverWidget>

              <button
                type="button"
                onClick={onJumpToMountPrivate}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>挂载上架</span>
              </button>
            </>
          }
          subStrip={
            hasActiveSubStrip ? (
              <div className="space-y-2">
                {activeOwnerFilter && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium">
                      <span>专家：{activeOwnerFilter.name}</span>
                      <button
                        type="button"
                        onClick={() => setOwnerFilterId(null)}
                        className="text-emerald-600 hover:text-emerald-900 cursor-pointer"
                        aria-label="清除专家筛选"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  </div>
                )}

                {matchError && (
                  <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between gap-2">
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
                  <div className="px-3.5 py-2.5 rounded-lg bg-blue-50/70 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs font-semibold text-blue-900">
                        <span>AI 组队推荐</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          预估签约 $
                          {Math.round(Number(matchResult.estimatedBudgetUsd || 0)).toLocaleString(
                            'en-US',
                          )}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 mt-0.5">{matchResult.summary}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMatchResult(null)}
                      className="text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-center"
                    >
                      清除推荐
                    </button>
                  </div>
                )}
              </div>
            ) : undefined
          }
        />

        {/* Scrollable Market Catalog Canvas */}
        <div className="flex-1 min-h-0 overflow-y-auto clean-scroll bg-slate-50/70">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 py-5">

          {/* Catalog Area: Agent Nodes OR Human Experts (1 Human -> Multiple External Agents) */}
          {entityTab === 'humans' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {zoneHumans.length === 0 ? (
                <div className="col-span-full py-12 text-center border border-dashed border-slate-300 rounded-xl bg-white">
                  <p className="text-sm font-medium text-slate-700">当前筛选条件下暂无匹配专家</p>
                  {(categoryFilter !== 'all' || keyword.trim()) && (
                    <button
                      type="button"
                      onClick={() => {
                        setCategoryFilter('all');
                        setKeyword('');
                      }}
                      className="mt-3 px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-800 cursor-pointer"
                    >
                      重置筛选
                    </button>
                  )}
                </div>
              ) : (
                zoneHumans.map(({ human, ownedInZone, ownedAllListed }) => {
                  const displayAgents = ownedInZone.length > 0 ? ownedInZone : ownedAllListed;
                  return (
                    <article
                      key={human.id}
                      className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between space-y-4"
                    >
                      <div>
                        {/* Human Expert Header (Circular Avatar + HumanMark + Category) */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <EntityAvatar
                              kind="human"
                              code={human.avatarInitials}
                              accent={human.avatarAccent}
                              size="lg"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h3 className="text-sm font-bold text-slate-900">
                                  {human.name}
                                </h3>
                                <HumanMark label={human.isCurrentUser ? '本人' : '真人专家'} />
                                <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                                  · {CATEGORY_LABELS[human.category]}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 mt-0.5 truncate">
                                {human.title}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0 font-mono tabular-nums">
                            <div className="text-xs font-bold text-slate-900">
                              信誉 {human.reputationScore}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {human.completedProjects} 交付
                            </div>
                          </div>
                        </div>

                        <p className="mt-2.5 text-xs text-slate-600 leading-relaxed">
                          {human.bio}
                        </p>

                        <div className="mt-2 text-[11px] text-slate-500">
                          <span className="text-slate-400 mr-1.5">专长</span>
                          {human.specialties.join(' · ')}
                        </div>

                        {/* Owned External Working Agents List */}
                        <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-800 inline-flex items-center gap-1.5">
                              <Cpu className="w-3.5 h-3.5 text-indigo-600" />
                              <span>旗下对外工作 Agent（{displayAgents.length} 个）</span>
                            </span>
                            {ownedInZone.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOwnerFilterId(human.id);
                                  setEntityTab('agents');
                                }}
                                className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
                              >
                                在节点视图查看 →
                              </button>
                            )}
                          </div>

                          {displayAgents.length === 0 ? (
                            <p className="text-xs text-slate-400 py-2">
                              暂未将名下私有 Agent 上架至当前社区市场
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {displayAgents.map((ag) => {
                                const agHired = hiredIds.includes(ag.id);
                                return (
                                  <div
                                    key={ag.id}
                                    className="rounded-lg bg-slate-50 border border-slate-200/80 px-3 py-2.5 flex items-center justify-between gap-2.5"
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <EntityAvatar
                                        kind="agent"
                                        code={ag.avatarCode}
                                        accent={ag.avatarAccent}
                                        size="sm"
                                      />
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <span className="text-xs font-bold text-slate-900 truncate">
                                            {displayEntityName(ag.handle)}
                                          </span>
                                          <AgentMark
                                            runtime={ag.runtimeAgent}
                                            model={ag.defaultModel}
                                            showModel
                                          />
                                        </div>
                                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                                          {SERVICE_MODE_LABELS[ag.serviceMode]} ·{' '}
                                          <span className="font-mono tabular-nums font-semibold text-slate-700">
                                            ${ag.projectPriceUsd.toLocaleString('en-US')}/项目
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => openDrawer(ag.id, 'dm')}
                                        className="px-2 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
                                      >
                                        私聊
                                      </button>
                                      {agHired ? (
                                        <span className="inline-flex items-center gap-0.5 px-2 py-1 text-[11px] font-semibold text-emerald-700 whitespace-nowrap">
                                          <Check className="w-3 h-3" />
                                          已在群
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => onHire(ag.id)}
                                          className="px-2 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-white cursor-pointer whitespace-nowrap"
                                        >
                                          拉入群
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          ) : (
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
                      setOwnerFilterId(null);
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
                  const ownerTotalCount = agent.ownerHumanId
                    ? ownerAgentCountMap.get(agent.ownerHumanId) || 1
                    : 0;

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
                            <EntityAvatar
                              kind="agent"
                              code={agent.avatarCode}
                              accent={agent.avatarAccent}
                              size="lg"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <h3 className="text-sm font-bold text-slate-900 truncate">
                                  {displayEntityName(agent.handle)}
                                </h3>
                                <AgentMark
                                  runtime={agent.runtimeAgent}
                                  model={agent.defaultModel}
                                  showModel
                                />
                                {agent.ownership === 'private' ? (
                                  <span className="text-[11px] font-medium text-indigo-600 whitespace-nowrap shrink-0">
                                    · 我上架
                                  </span>
                                ) : (
                                  agent.primaryZoneId &&
                                  agent.primaryZoneId !== 'zone_public' && (
                                    <span
                                      className="text-[11px] font-semibold whitespace-nowrap shrink-0"
                                      style={{
                                        color:
                                          zoneMap.get(agent.primaryZoneId)?.accentColor || '#0f766e',
                                      }}
                                    >
                                      · {zoneMap.get(agent.primaryZoneId)?.name}
                                    </span>
                                  )
                                )}
                              </div>
                              <p className="text-xs text-slate-600 truncate mt-0.5">{agent.title}</p>
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

                        {/* Human Owner Attribution Bar */}
                        {agent.ownerHumanName && (
                          <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5">
                            <span className="inline-flex items-center gap-1.5 text-slate-600 truncate">
                              <User className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>
                                归属专家：
                                <strong className="font-semibold text-slate-900">
                                  {agent.ownerHumanName}
                                </strong>
                              </span>
                            </span>
                            {agent.ownerHumanId && (
                              <button
                                type="button"
                                onClick={() => setOwnerFilterId(agent.ownerHumanId || null)}
                                className="text-blue-700 hover:text-blue-900 font-medium whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                旗下 {ownerTotalCount} 个 Agent
                              </button>
                            )}
                          </div>
                        )}

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
                <EntityAvatar
                  kind="agent"
                  code={drawerAgent.avatarCode}
                  accent={drawerAgent.avatarAccent}
                  size="md"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <h2 className="text-sm font-bold text-slate-900 truncate">
                      {displayEntityName(drawerAgent.handle)} · {drawerAgent.name}
                    </h2>
                    <AgentMark
                      runtime={drawerAgent.runtimeAgent}
                      model={drawerAgent.defaultModel}
                      showModel
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {drawerAgent.ownerHumanName
                      ? `归属专家：${drawerAgent.ownerHumanName} · `
                      : ''}
                    {SERVICE_MODE_LABELS[drawerAgent.serviceMode]}
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
                  <span className="text-[11px] text-slate-500 mb-1 inline-flex items-center gap-1.5">
                    <span className="font-semibold text-slate-700">
                      {displayEntityName(drawerAgent.handle)}
                    </span>
                    <AgentMark
                      runtime={drawerAgent.runtimeAgent}
                      model={drawerAgent.defaultModel}
                    />
                    <span>· 雇前私聊沟通</span>
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
                        {isEmployer ? '我' : displayEntityName(drawerAgent.handle)} · {m.timestamp}
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
                    {displayEntityName(drawerAgent.handle)} 正在结合你的项目背景组织回复...
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
                    placeholder={`私聊提问 ${displayEntityName(drawerAgent.handle)}，确认能力与报价...`}
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
