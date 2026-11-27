import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Flame, Star, Trophy } from 'lucide-react';
import {
  EntityAvatar,
  displayEntityName,
  getAgentLeasePricing,
  getSkillPurchasePricing,
} from '../shared/EntityIdentity';
import type {
  AgentCategory,
  AgentLeaseRecord,
  ExpertAgent,
  HumanExpert,
  MarketSkill,
  SkillKind,
} from '../../types/agentnexus';

export type MarketEntityTab = 'agents' | 'humans' | 'skills';
export type RankingDimension = 'popular' | 'top_rated';

const CATEGORY_OPTIONS: { id: 'all' | AgentCategory; label: string }[] = [
  { id: 'all', label: '全部分类' },
  { id: 'engineering', label: '研发开发' },
  { id: 'design', label: '设计体验' },
  { id: 'product', label: '产品策划' },
  { id: 'architecture', label: '架构审查' },
  { id: 'qa', label: '测试质量' },
  { id: 'media', label: '自媒体运营' },
];

const SKILL_KIND_LABELS: Record<SkillKind, string> = {
  skill: 'Skill',
  mcp: 'MCP',
  workflow: '工作流',
};

function formatInstalls(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

function rankBadgeStyle(index: number): string {
  if (index === 0) return 'bg-amber-500 text-white';
  if (index === 1) return 'bg-slate-600 text-white';
  if (index === 2) return 'bg-amber-700/85 text-white';
  return 'bg-slate-100 text-slate-500';
}

interface MarketLeaderboardRailProps {
  entityTab: MarketEntityTab;
  activeCategory: 'all' | AgentCategory;
  agents: ExpertAgent[];
  allAgents: ExpertAgent[];
  humanExperts: HumanExpert[];
  skills: MarketSkill[];
  agentLeases: Record<string, AgentLeaseRecord>;
  purchasedSkillIds: string[];
  onSelectAgent: (agentId: string) => void;
  onSelectHuman: (humanId: string) => void;
  onSelectSkill: (skillId: string) => void;
}

export function MarketLeaderboardRail({
  entityTab,
  activeCategory,
  agents,
  allAgents,
  humanExperts,
  skills,
  agentLeases,
  purchasedSkillIds,
  onSelectAgent,
  onSelectHuman,
  onSelectSkill,
}: MarketLeaderboardRailProps) {
  const [dimension, setDimension] = useState<RankingDimension>('popular');
  const [boardCategory, setBoardCategory] = useState<'all' | AgentCategory>(activeCategory);

  // Sync ranking category when the user switches the main category filter
  useEffect(() => {
    setBoardCategory(activeCategory);
  }, [activeCategory]);

  const rankedAgents = useMemo(() => {
    const pool =
      boardCategory === 'all' ? agents : agents.filter((a) => a.category === boardCategory);

    return [...pool]
      .sort((a, b) => {
        if (dimension === 'popular') {
          const popA = a.performance.completedProjects * 1.4 + a.performance.repeatHireRate;
          const popB = b.performance.completedProjects * 1.4 + b.performance.repeatHireRate;
          return popB - popA;
        }
        if (b.performance.rating !== a.performance.rating) {
          return b.performance.rating - a.performance.rating;
        }
        return b.performance.successRate - a.performance.successRate;
      })
      .slice(0, 6);
  }, [agents, boardCategory, dimension]);

  const rankedHumans = useMemo(() => {
    const pool =
      boardCategory === 'all'
        ? humanExperts
        : humanExperts.filter((h) => h.category === boardCategory);

    return [...pool]
      .map((human) => {
        const owned = allAgents.filter(
          (a) => a.ownerHumanId === human.id && a.isListedInMarket,
        );
        const avgAgentRating =
          owned.length > 0
            ? owned.reduce((acc, a) => acc + a.performance.rating, 0) / owned.length
            : 4.9;
        return { human, ownedCount: owned.length, avgAgentRating };
      })
      .sort((a, b) => {
        if (dimension === 'popular') {
          return (
            b.human.completedProjects +
            b.ownedCount * 8 -
            (a.human.completedProjects + a.ownedCount * 8)
          );
        }
        if (b.human.reputationScore !== a.human.reputationScore) {
          return b.human.reputationScore - a.human.reputationScore;
        }
        return b.avgAgentRating - a.avgAgentRating;
      })
      .slice(0, 6);
  }, [allAgents, boardCategory, dimension, humanExperts]);

  const rankedSkills = useMemo(() => {
    const pool =
      boardCategory === 'all' ? skills : skills.filter((s) => s.category === boardCategory);

    return [...pool]
      .sort((a, b) => {
        if (dimension === 'popular') {
          return b.installs - a.installs;
        }
        if (b.rating !== a.rating) return b.rating - a.rating;
        return b.installs - a.installs;
      })
      .slice(0, 6);
  }, [boardCategory, dimension, skills]);

  const boardTitle =
    entityTab === 'agents'
      ? '专家 Agent 排行'
      : entityTab === 'humans'
        ? 'Agent 主理排行'
        : 'Skills / MCP 排行';

  return (
    <aside
      aria-label="服务市场自动排行榜"
      className="w-full @[820px]:w-[260px] @[1020px]:w-[280px] shrink-0 @[820px]:sticky @[820px]:top-4 @[820px]:border-l @[820px]:border-slate-200/80 @[820px]:pl-5"
    >
      {/* PURE AUTOMATIC DATA-DRIVEN LEADERBOARD (Flush Split Rail) */}
      <section>
        <div className="pb-2.5 border-b border-slate-200/75 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <h2 className="text-xs font-semibold text-slate-900 truncate">{boardTitle}</h2>
            </div>

            <select
              value={boardCategory}
              onChange={(e) => setBoardCategory(e.target.value as 'all' | AgentCategory)}
              aria-label="排行榜分类筛选"
              className="h-6 rounded-md border border-slate-200 bg-slate-50 px-1.5 text-[11px] font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600/30 cursor-pointer"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 2-Way Objective Auto-Ranking Switcher: Popular vs Top Rated */}
          <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-slate-100">
            {[
              { id: 'popular' as const, label: '最受欢迎', icon: Flame },
              { id: 'top_rated' as const, label: '好评排行', icon: Star },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = dimension === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setDimension(tab.id)}
                  className={`inline-flex items-center justify-center gap-1 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Icon
                    className={`w-3 h-3 shrink-0 ${
                      active
                        ? tab.id === 'popular'
                          ? 'text-orange-500'
                          : 'text-amber-500'
                        : 'text-slate-400'
                    }`}
                  />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Ranked List Body */}
        <div className="divide-y divide-slate-100">
          {entityTab === 'agents' &&
            (rankedAgents.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-slate-400">
                该分类暂无上榜 Agent
              </div>
            ) : (
              rankedAgents.map((agent, idx) => {
                const pricing = getAgentLeasePricing({
                  runtimeAgent: agent.runtimeAgent,
                  defaultModel: agent.defaultModel,
                  capabilityTier: agent.performance.capabilityTier,
                  ownership: agent.ownership,
                  projectPriceUsd: agent.projectPriceUsd,
                  monthlyLeaseUsd: agent.monthlyLeaseUsd,
                });
                const isLeased = Boolean(agentLeases[agent.id]);
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => onSelectAgent(agent.id)}
                    className="w-full px-3.5 py-2.5 flex items-center gap-2.5 hover:bg-slate-50 transition-colors text-left cursor-pointer group"
                  >
                    <span
                      className={`w-5 h-5 rounded-md text-[11px] font-mono font-bold inline-flex items-center justify-center shrink-0 ${rankBadgeStyle(idx)}`}
                    >
                      {idx + 1}
                    </span>
                    <EntityAvatar
                      kind="agent"
                      code={agent.avatarCode}
                      accent={agent.avatarAccent}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-bold text-slate-900 truncate group-hover:text-blue-700 transition-colors">
                          {displayEntityName(agent.handle)}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-violet-700 shrink-0">
                          {pricing.rating.capability}级
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono tabular-nums truncate mt-0.5">
                        {dimension === 'top_rated'
                          ? `★ ${agent.performance.rating.toFixed(2)} · 胜率 ${agent.performance.successRate}%`
                          : `${agent.performance.completedProjects} 交付 · 复购 ${agent.performance.repeatHireRate}%`}
                      </div>
                    </div>
                    <div className="text-right shrink-0 font-mono tabular-nums">
                      <div className="text-xs font-bold text-slate-900">
                        ${pricing.monthlyUsd}
                        <span className="text-[10px] font-sans font-normal text-slate-400">
                          /月
                        </span>
                      </div>
                      {isLeased && (
                        <div className="text-[10px] font-sans font-semibold text-emerald-700">
                          已租用
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            ))}

          {entityTab === 'humans' &&
            (rankedHumans.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-slate-400">
                该分类暂无上榜专家
              </div>
            ) : (
              rankedHumans.map(({ human, ownedCount, avgAgentRating }, idx) => (
                <button
                  key={human.id}
                  type="button"
                  onClick={() => onSelectHuman(human.id)}
                  className="w-full px-3.5 py-2.5 flex items-center gap-2.5 hover:bg-slate-50 transition-colors text-left cursor-pointer group"
                >
                  <span
                    className={`w-5 h-5 rounded-md text-[11px] font-mono font-bold inline-flex items-center justify-center shrink-0 ${rankBadgeStyle(idx)}`}
                  >
                    {idx + 1}
                  </span>
                  <EntityAvatar
                    kind="human"
                    code={human.avatarInitials}
                    accent={human.avatarAccent}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-bold text-slate-900 truncate group-hover:text-blue-700 transition-colors">
                        {human.name}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-violet-700 shrink-0">
                        {human.ratingTier || 'A+'}级
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono tabular-nums truncate mt-0.5">
                      {dimension === 'top_rated'
                        ? `信誉 ${human.reputationScore} · ★ ${avgAgentRating.toFixed(2)}`
                        : `${human.completedProjects} 交付 · ${ownedCount} 内建 Agent`}
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-600 shrink-0" />
                </button>
              ))
            ))}

          {entityTab === 'skills' &&
            (rankedSkills.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-slate-400">
                该分类暂无上榜 Skills
              </div>
            ) : (
              rankedSkills.map((skill, idx) => {
                const pricing = getSkillPurchasePricing(skill);
                const owned = purchasedSkillIds.includes(skill.id);
                return (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => onSelectSkill(skill.id)}
                    className="w-full px-3.5 py-2.5 flex items-center gap-2.5 hover:bg-slate-50 transition-colors text-left cursor-pointer group"
                  >
                    <span
                      className={`w-5 h-5 rounded-md text-[11px] font-mono font-bold inline-flex items-center justify-center shrink-0 ${rankBadgeStyle(idx)}`}
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-bold text-slate-900 truncate group-hover:text-blue-700 transition-colors">
                          {skill.name}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono tabular-nums truncate mt-0.5">
                        {dimension === 'top_rated'
                          ? `★ ${skill.rating.toFixed(2)} · ${pricing.ratingTier}级 · ${SKILL_KIND_LABELS[skill.kind]}`
                          : `${formatInstalls(skill.installs)} 安装 · ★ ${skill.rating.toFixed(2)}`}
                      </div>
                    </div>
                    <div className="text-right shrink-0 font-mono tabular-nums">
                      <div
                        className={`text-xs font-bold ${
                          pricing.isFree ? 'text-emerald-700' : 'text-slate-900'
                        }`}
                      >
                        {pricing.priceLabel}
                      </div>
                      {owned && (
                        <div className="text-[10px] font-sans font-semibold text-emerald-700">
                          已拥有
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            ))}
        </div>
      </section>
    </aside>
  );
}
