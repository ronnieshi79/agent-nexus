import { useMemo, useState, type FormEvent } from 'react';
import {
  ArrowUpRight,
  Blocks,
  Check,
  Cpu,
  Globe,
  Lock,
  Plus,
  Share2,
  ShoppingBag,
  X,
} from 'lucide-react';
import type {
  AgentCategory,
  CommunityZone,
  ExpertAgent,
  MarketSkill,
  SkillKind,
  SkillOrigin,
} from '../../types/agentnexus';
import {
  formatAgentDisplayName,
  getSkillPurchasePricing,
} from '../shared/EntityIdentity';

const CATEGORY_LABELS: Record<AgentCategory, string> = {
  engineering: '开发工程',
  product: '产品策划',
  design: '交互与视觉',
  architecture: '架构与安全',
  qa: '测试与验收',
  media: '内容与增长',
};

const KIND_LABELS: Record<SkillKind, { label: string; cls: string }> = {
  skill: { label: 'Skill', cls: 'text-blue-700' },
  mcp: { label: 'MCP', cls: 'text-indigo-700' },
  workflow: { label: '工作流', cls: 'text-emerald-700' },
};

const ORIGIN_LABELS: Record<SkillOrigin, { label: string; cls: string }> = {
  platform: { label: '平台官方维护', cls: 'text-sky-700' },
  custom: { label: '团队自建', cls: 'text-violet-700' },
  community: { label: '社区采购', cls: 'text-amber-700' },
};

function resolveSkillOrigin(skill: MarketSkill): SkillOrigin {
  if (skill.origin) return skill.origin;
  if (skill.authorName.includes('AGN 平台')) return 'platform';
  if (skill.authorName.includes('（我）')) return 'custom';
  return 'community';
}

interface SpaceSkillsPanelProps {
  mode: 'list' | 'purchase';
  skills: MarketSkill[];
  purchasedSkillIds: string[];
  privateAgents: ExpertAgent[];
  zones: CommunityZone[];
  searchKeyword: string;
  categoryFilter: 'all' | AgentCategory;
  kindFilter: 'all' | SkillKind;
  originFilter: 'all' | SkillOrigin;
  createDrawerOpen: boolean;
  onChangeCreateDrawerOpen: (open: boolean) => void;
  onOpenPurchasePage: () => void;
  onReturnToList: () => void;
  onAcquireSkill: (skillId: string, skillName?: string, priceUsd?: number) => void;
  onCreateSpaceSkill: (input: {
    name: string;
    summary: string;
    kind: SkillKind;
    category: AgentCategory;
    priceUsd?: number;
    compatibleRuntimes?: string[];
    zoneIds?: string[];
    bindAgentIds?: string[];
  }) => string;
  onToggleZoneSkillDistribution: (zoneId: string, skillId: string) => void;
  onJumpToAgents?: () => void;
  onJumpToCommunityMarket?: () => void;
}

export function SpaceSkillsPanel({
  mode,
  skills,
  purchasedSkillIds,
  privateAgents,
  zones,
  searchKeyword,
  categoryFilter,
  kindFilter,
  originFilter,
  createDrawerOpen,
  onChangeCreateDrawerOpen,
  onOpenPurchasePage,
  onReturnToList,
  onAcquireSkill,
  onCreateSpaceSkill,
  onToggleZoneSkillDistribution,
  onJumpToAgents,
  onJumpToCommunityMarket,
}: SpaceSkillsPanelProps) {
  const [distributingSkillId, setDistributingSkillId] = useState<string | null>(null);

  // Create custom Space Skill/MCP Drawer State
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<SkillKind>('skill');
  const [newCategory, setNewCategory] = useState<AgentCategory>('engineering');
  const [newPriceUsd, setNewPriceUsd] = useState(0);
  const [newSummary, setNewSummary] = useState('');
  const [newZoneIds, setNewZoneIds] = useState<string[]>([]);

  const ownedSet = useMemo(() => new Set(purchasedSkillIds), [purchasedSkillIds]);
  const zoneMap = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);

  const ownedSkills = useMemo(
    () => skills.filter((s) => ownedSet.has(s.id) || resolveSkillOrigin(s) === 'custom'),
    [ownedSet, skills],
  );

  const platformCatalog = useMemo(
    () => skills.filter((s) => resolveSkillOrigin(s) === 'platform'),
    [skills],
  );

  const originStats = useMemo(() => {
    let platform = 0;
    let custom = 0;
    let community = 0;
    ownedSkills.forEach((s) => {
      const o = resolveSkillOrigin(s);
      if (o === 'platform') platform += 1;
      else if (o === 'custom') custom += 1;
      else community += 1;
    });
    return { platform, custom, community };
  }, [ownedSkills]);

  const equippedAgentCount = useMemo(
    () => privateAgents.filter((a) => (a.installedSkillIds || []).length > 0).length,
    [privateAgents],
  );

  const unownedPlatformCount = useMemo(
    () => platformCatalog.filter((s) => !ownedSet.has(s.id)).length,
    [ownedSet, platformCatalog],
  );

  const q = searchKeyword.trim().toLowerCase();

  const matchesFilters = (s: MarketSkill, ignoreOriginFilter = false) => {
    if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
    if (kindFilter !== 'all' && s.kind !== kindFilter) return false;
    if (!ignoreOriginFilter && originFilter !== 'all' && resolveSkillOrigin(s) !== originFilter) {
      return false;
    }
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      s.slug.toLowerCase().includes(q) ||
      s.summary.toLowerCase().includes(q) ||
      s.authorName.toLowerCase().includes(q) ||
      CATEGORY_LABELS[s.category].toLowerCase().includes(q)
    );
  };

  const filteredOwnedSkills = useMemo(
    () => ownedSkills.filter((s) => matchesFilters(s, false)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ownedSkills, categoryFilter, kindFilter, originFilter, q],
  );

  const filteredPlatformCatalog = useMemo(
    () => platformCatalog.filter((s) => matchesFilters(s, true)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [platformCatalog, categoryFilter, kindFilter, q],
  );

  const handleCreateSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onCreateSpaceSkill({
      name: newName.trim(),
      summary: newSummary.trim(),
      kind: newKind,
      category: newCategory,
      priceUsd: newZoneIds.length > 0 ? newPriceUsd : 0,
      zoneIds: newZoneIds,
    });
    setNewName('');
    setNewSummary('');
    setNewPriceUsd(0);
    setNewZoneIds([]);
    onChangeCreateDrawerOpen(false);
  };

  const toggleId = (list: string[], id: string, setter: (v: string[]) => void) => {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  /* ================= SECONDARY PAGE: PLATFORM OFFICIAL SKILLS / MCP PROCUREMENT ================= */
  if (mode === 'purchase') {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1">
            <strong className="text-slate-900">AGN 平台官方维护 Skills / MCP 采购</strong>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span>
              共 <strong className="font-mono tabular-nums text-slate-900">{platformCatalog.length}</strong> 项（可购{' '}
              <strong className="font-mono tabular-nums text-blue-700">{unownedPlatformCount}</strong> 项）
            </span>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span>一次买断永久供本空间全部 Agent 装配，同步支持社区分销</span>
          </div>
          {onJumpToCommunityMarket && (
            <button
              type="button"
              onClick={onJumpToCommunityMarket}
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer whitespace-nowrap"
            >
              逛社区服务市场 →
            </button>
          )}
        </div>

        {filteredPlatformCatalog.length === 0 ? (
          <div className="py-12 text-center rounded-xl border border-dashed border-slate-300 bg-white text-xs text-slate-500">
            当前筛选下暂无匹配的平台官方 Skills / MCP
          </div>
        ) : (
          <div className="border border-slate-200 rounded-xl bg-white overflow-hidden mb-16">
            <div className="hidden @[900px]:grid @[900px]:grid-cols-[minmax(300px,380px)_minmax(0,1fr)_180px] @[900px]:items-center @[900px]:gap-6 px-5 py-2.5 bg-slate-50/90 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
              <div>官方 Skill / MCP 概要</div>
              <div>核心能力与适配底座</div>
              <div className="text-right">费用与采购</div>
            </div>

            <div className="divide-y divide-slate-200">
              {filteredPlatformCatalog.map((skill) => {
                const kindMeta = KIND_LABELS[skill.kind];
                const pricing = getSkillPurchasePricing(skill);
                const isOwned = ownedSet.has(skill.id);

                return (
                  <div
                    key={skill.id}
                    className="px-5 py-4 grid grid-cols-1 @[900px]:grid-cols-[minmax(300px,380px)_minmax(0,1fr)_180px] @[900px]:items-center gap-4 @[900px]:gap-6 hover:bg-slate-50/60 transition-colors"
                  >
                    {/* Left: Skill Summary */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                        <Blocks className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <h3 className="text-sm font-bold text-slate-900">{skill.name}</h3>
                          <span className={`text-xs font-semibold ${kindMeta.cls}`}>
                            {kindMeta.label}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-1.5">
                          <span>{CATEGORY_LABELS[skill.category]}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">{skill.version}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono truncate">{skill.slug}</span>
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-2 pt-0.5 leading-relaxed">
                          {skill.summary}
                        </p>
                      </div>
                    </div>

                    {/* Middle: Official Highlights & Compatible Runtimes */}
                    <div className="min-w-0 space-y-1.5 text-xs">
                      <ul className="space-y-1 text-slate-600 list-disc pl-4">
                        {skill.highlights.slice(0, 2).map((h, idx) => (
                          <li key={idx} className="leading-snug">
                            {h}
                          </li>
                        ))}
                      </ul>
                      <div className="text-[11px] text-slate-400 font-mono">
                        适配底座：{skill.compatibleRuntimes.join(' / ')}
                        {skill.distributionSharePct
                          ? ` · 开放社区分销 (${skill.distributionSharePct}% 分润)`
                          : ''}
                      </div>
                    </div>

                    {/* Right: Price & Purchase CTA */}
                    <div className="flex @[900px]:flex-col @[900px]:items-end items-center justify-between gap-2 shrink-0">
                      <div className="font-mono tabular-nums text-right">
                        <span
                          className={`text-base font-bold ${
                            pricing.isFree ? 'text-emerald-700' : 'text-slate-900'
                          }`}
                        >
                          {pricing.priceLabel}
                        </span>
                        <span className="text-[11px] font-sans text-slate-400 ml-1">
                          {pricing.isFree ? '官方免费' : '一次买断'}
                        </span>
                      </div>

                      {isOwned ? (
                        <button
                          type="button"
                          onClick={onReturnToList}
                          className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-xs font-semibold text-emerald-700 cursor-pointer whitespace-nowrap"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>已入库 · 返回资源列表</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onAcquireSkill(skill.id, skill.name, pricing.priceUsd)}
                          className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>{pricing.isFree ? '免费入库' : `购买 ${pricing.priceLabel}`}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ================= PRIMARY PAGE: MY SPACE SKILLS / MCP UNIFIED LIST ================= */
  return (
    <div className="space-y-4">
      {/* Concise Single-Line Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>
            空间已拥有 <strong className="font-mono tabular-nums text-slate-900">{ownedSkills.length}</strong> 项
          </span>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">
            平台官方 {originStats.platform} · 自建 {originStats.custom} · 社区 {originStats.community}
          </span>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <span>
            已有 <strong className="font-mono tabular-nums text-slate-900">{equippedAgentCount}/{privateAgents.length}</strong> 位自建 Agent 加载
          </span>
          {onJumpToAgents && (
            <>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <button
                type="button"
                onClick={onJumpToAgents}
                className="font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
              >
                前往 Agent 成员管理加载 / 卸载 →
              </button>
            </>
          )}
        </div>
        <span className="text-xs font-mono tabular-nums text-slate-400 shrink-0">
          共 {filteredOwnedSkills.length} 项能力包
        </span>
      </div>

      {/* Unified Bordered List: Left = Skill Summary, Right = Runtime Spec, Loaded Agents Overview & Community Distribution */}
      {filteredOwnedSkills.length === 0 ? (
        <div className="py-14 text-center rounded-xl border border-dashed border-slate-300 bg-white space-y-3">
          <p className="text-sm font-medium text-slate-700">当前筛选下暂无空间 Skills / MCP</p>
          <p className="text-xs text-slate-500">
            可新建团队自建能力包，或前往平台采购官方维护的高阶 Skills / MCP，入库后即可在「Agent 成员」管理中按需加载。
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => onChangeCreateDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>自建 Skill / MCP</span>
            </button>
            <button
              type="button"
              onClick={onOpenPurchasePage}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>平台采购 Skills</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl bg-white overflow-hidden mb-16">
          {/* Desktop Column Header */}
          <div className="hidden @[900px]:grid @[900px]:grid-cols-[minmax(290px,360px)_minmax(0,1fr)] @[900px]:items-center @[900px]:gap-6 px-5 py-2.5 bg-slate-50/90 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
            <div>Skill / MCP 概要</div>
            <div>适配规格、加载概览与社区分发</div>
          </div>

          <div className="divide-y divide-slate-200">
            {filteredOwnedSkills.map((skill) => {
              const origin = resolveSkillOrigin(skill);
              const originMeta = ORIGIN_LABELS[origin];
              const kindMeta = KIND_LABELS[skill.kind];
              const boundAgents = privateAgents.filter((a) =>
                (a.installedSkillIds || []).includes(skill.id),
              );
              const isCustom = origin === 'custom';
              const isDistOpen = distributingSkillId === skill.id;

              return (
                <div
                  key={skill.id}
                  className="px-5 py-4 grid grid-cols-1 @[900px]:grid-cols-[minmax(290px,360px)_minmax(0,1fr)] gap-4 @[900px]:gap-6 hover:bg-slate-50/40 transition-colors"
                >
                  {/* LEFT COLUMN: Skill / MCP Summary */}
                  <div className="min-w-0 flex items-start gap-3 @[900px]:pr-4 @[900px]:border-r @[900px]:border-slate-100">
                    <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                      <Blocks className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <h3 className="text-sm font-bold text-slate-900 truncate">{skill.name}</h3>
                        <span className={`text-xs font-semibold ${kindMeta.cls}`}>
                          {kindMeta.label}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        <span className={`font-semibold ${originMeta.cls}`}>{originMeta.label}</span>
                        <span aria-hidden="true">·</span>
                        <span>{CATEGORY_LABELS[skill.category]}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{skill.version}</span>
                      </div>

                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {skill.summary}
                      </p>

                      <div className="text-[11px] text-slate-400 font-mono truncate">
                        {skill.slug}
                        {isCustom && skill.zoneIds.length === 0 ? ' · 仅本空间私有' : ''}
                      </div>
                    </div>
                  </div>

                  {/* RIGHT COLUMN: Spec, Read-only Loaded Agents Summary & Community Distribution */}
                  <div className="min-w-0 flex flex-col justify-between gap-2.5">
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                        <div className="inline-flex items-center gap-1.5 text-xs min-w-0">
                          <Cpu className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="font-semibold text-slate-800 whitespace-nowrap">
                            已加载 Agent（<span className="font-mono tabular-nums">{boundAgents.length}</span>）
                          </span>
                          <span className="text-slate-300" aria-hidden="true">·</span>
                          <span className="text-xs text-slate-600 truncate">
                            {boundAgents.length > 0
                              ? boundAgents
                                  .map((ag) =>
                                    formatAgentDisplayName(
                                      ag.handle,
                                      ag.runtimeAgent,
                                      ag.defaultModel,
                                    ),
                                  )
                                  .join('、')
                              : '暂未加载到任何自建 Agent'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {onJumpToAgents && (
                            <button
                              type="button"
                              onClick={onJumpToAgents}
                              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
                            >
                              <span>去成员管理配置</span>
                              <ArrowUpRight className="w-3 h-3" />
                            </button>
                          )}

                          {isCustom && (
                            <button
                              type="button"
                              onClick={() =>
                                setDistributingSkillId((cur) => (cur === skill.id ? null : skill.id))
                              }
                              className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-md border text-[11px] font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                                isDistOpen
                                  ? 'bg-violet-600 text-white border-violet-600'
                                  : 'bg-white text-violet-700 border-violet-200 hover:bg-violet-50'
                              }`}
                            >
                              <Share2 className="w-3 h-3" />
                              <span>
                                {skill.zoneIds.length > 0
                                  ? `已分发 ${skill.zoneIds.length} 社区`
                                  : '上架到 Agent 社区'}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Highlights & Compatible Runtimes (Clean Unboxed Metadata) */}
                      <div className="space-y-1 text-xs text-slate-600">
                        {skill.highlights[0] && (
                          <p className="truncate text-slate-600">{skill.highlights[0]}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                          <span className="font-mono">
                            适配底座：{skill.compatibleRuntimes.join(' / ')}
                          </span>
                          <span className="text-slate-300" aria-hidden="true">·</span>
                          <span className="font-mono truncate">{skill.installCommand}</span>
                        </div>
                      </div>

                      {/* Expandable Community Distribution Bar for Custom Skills */}
                      {isCustom && isDistOpen && (
                        <div className="pt-2 border-t border-slate-100 space-y-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-violet-900">
                              选择上架分发的 Agent 社区（留空保持空间私有）：
                            </span>
                            <button
                              type="button"
                              onClick={() => setDistributingSkillId(null)}
                              className="text-slate-400 hover:text-slate-700 cursor-pointer"
                            >
                              收起
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {zones.map((z) => {
                              const listed = skill.zoneIds.includes(z.id);
                              return (
                                <button
                                  key={z.id}
                                  type="button"
                                  onClick={() => onToggleZoneSkillDistribution(z.id, skill.id)}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-[11px] font-semibold cursor-pointer transition-colors ${
                                    listed
                                      ? 'bg-violet-600 text-white border-violet-600'
                                      : 'bg-white text-slate-700 border-slate-200 hover:border-violet-300'
                                  }`}
                                >
                                  <Globe className="w-3 h-3" />
                                  <span>{z.name}</span>
                                  {listed && <Check className="w-3 h-3" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Clean Unboxed Footer Line */}
                    <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                      <span className="truncate">
                        {isCustom ? (
                          skill.zoneIds.length > 0 ? (
                            <span>
                              已分发 Agent 社区：
                              <span className="text-slate-600 font-medium">
                                {skill.zoneIds
                                  .map((zid) => zoneMap.get(zid)?.name || zid)
                                  .join('、')}
                              </span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              <span>仅当前 AGN空间私有使用</span>
                            </span>
                          )
                        ) : origin === 'platform' ? (
                          <span>AGN 平台官方持续维护更新</span>
                        ) : (
                          <span>来源作者：{skill.authorName}</span>
                        )}
                      </span>
                      <span className="shrink-0">
                        在「Agent 成员」管理中可按成员随时加载或卸载
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Slide-in Drawer: Create Team Self-Built Skill / MCP */}
      {createDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-slate-900/35"
            onClick={() => onChangeCreateDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-full max-w-[460px] bg-white border-l border-slate-200 h-full flex flex-col shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex items-start justify-between gap-3 shrink-0">
              <div>
                <h2 className="text-sm font-bold text-slate-900">新建自建 Skill / MCP</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  封装团队沉淀的规范、工作流或 MCP 工具，入库后可在「Agent 成员」管理中按需加载，并按需上架 Agent 社区。
                </p>
              </div>
              <button
                type="button"
                onClick={() => onChangeCreateDrawerOpen(false)}
                className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 cursor-pointer"
                aria-label="关闭新建抽屉"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto clean-scroll p-5 space-y-4">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">能力名称 *</span>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="如：React 组件性能巡检 Skill / 内部工单 MCP"
                    className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-700">资源形态</span>
                    <select
                      value={newKind}
                      onChange={(e) => setNewKind(e.target.value as SkillKind)}
                      className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-900 focus:outline-none"
                    >
                      <option value="skill">Skill（指令/规范）</option>
                      <option value="mcp">MCP（工具协议）</option>
                      <option value="workflow">工作流套件</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-slate-700">适配专业类目</span>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as AgentCategory)}
                      className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-900 focus:outline-none"
                    >
                      {(Object.keys(CATEGORY_LABELS) as AgentCategory[]).map((cat) => (
                        <option key={cat} value={cat}>
                          {CATEGORY_LABELS[cat]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">功能说明与交付规范</span>
                  <textarea
                    rows={3}
                    value={newSummary}
                    onChange={(e) => setNewSummary(e.target.value)}
                    placeholder="描述该 Skill / MCP 解决什么问题、包含哪些工具或约束规则..."
                    className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </label>

                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="text-xs font-semibold text-slate-700">
                    同时分发至 Agent 社区服务市场（留空则仅本空间私有）
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {zones.map((z) => {
                      const checked = newZoneIds.includes(z.id);
                      return (
                        <button
                          key={z.id}
                          type="button"
                          onClick={() => toggleId(newZoneIds, z.id, setNewZoneIds)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                            checked
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <Globe className="w-3 h-3" />
                          <span>{z.name}</span>
                          {checked && <Check className="w-3 h-3" />}
                        </button>
                      );
                    })}
                  </div>

                  {newZoneIds.length > 0 && (
                    <label className="block pt-1">
                      <span className="text-xs font-medium text-slate-600">
                        社区买断定价（USD，填 0 为免费开源共享）
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={999}
                        value={newPriceUsd}
                        onChange={(e) => setNewPriceUsd(Number(e.target.value) || 0)}
                        className="mt-1 w-36 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:outline-none"
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    onChangeCreateDrawerOpen(false);
                    onOpenPurchasePage();
                  }}
                  className="text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
                >
                  采购官方 Skills →
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onChangeCreateDrawerOpen(false)}
                    className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                  >
                    {newZoneIds.length > 0
                      ? `保存并分发 (${newZoneIds.length} 个社区)`
                      : '保存为空间私有资产'}
                  </button>
                </div>
              </div>
            </form>
          </aside>
        </div>
      )}
    </div>
  );
}
