import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Check,
  ChevronRight,
  Search,
  Sparkles,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react';
import { fetchMarketMatches, type MarketMatchResult } from '../../services/api';
import type { AgentCategory, ExpertAgent, NodeTier } from '../../types/agentnexus';
import { ServiceCardShell } from './ServiceCardShell';

interface AgentMarketCardProps {
  agents: ExpertAgent[];
  hiredIds: string[];
  requirementSeed: string;
  onClearRequirementSeed: () => void;
  onHire: (agentId: string) => void;
  onRelease: (agentId: string) => void;
  onJumpToChat: () => void;
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

export function AgentMarketCard({
  agents,
  hiredIds,
  requirementSeed,
  onClearRequirementSeed,
  onHire,
  onRelease,
  onJumpToChat,
}: AgentMarketCardProps) {
  const [categoryFilter, setCategoryFilter] = useState<'all' | AgentCategory>('all');
  const [tierFilter, setTierFilter] = useState<'all' | NodeTier>('all');
  const [keyword, setKeyword] = useState('');
  const [aiQuery, setAiQuery] = useState('');
  const [aiMatching, setAiMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<MarketMatchResult | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [inspectedAgentId, setInspectedAgentId] = useState<string | null>(null);

  useEffect(() => {
    if (requirementSeed) {
      setAiQuery(requirementSeed);
      onClearRequirementSeed();
    }
  }, [requirementSeed, onClearRequirementSeed]);

  const filteredAgents = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return agents.filter((agent) => {
      if (categoryFilter !== 'all' && agent.category !== categoryFilter) return false;
      if (tierFilter !== 'all' && agent.nodeTier !== tierFilter) return false;
      if (!q) return true;
      const haystack = [
        agent.handle,
        agent.name,
        agent.title,
        agent.region,
        ...agent.skills,
        ...agent.mcpTools,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [agents, categoryFilter, keyword, tierFilter]);

  const matchMap = useMemo(() => {
    const map = new Map<string, string>();
    matchResult?.matches.forEach((m) => map.set(m.agentId, m.reason));
    return map;
  }, [matchResult]);

  const inspectedAgent = useMemo(
    () => agents.find((a) => a.id === inspectedAgentId) ?? null,
    [agents, inspectedAgentId],
  );

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
      });
      setMatchResult(res);
    } catch (err) {
      setMatchError(err instanceof Error ? err.message : 'AI 选人匹配失败');
    } finally {
      setAiMatching(false);
    }
  };

  return (
    <ServiceCardShell
      cardId="market"
      kicker="专家人才匣 · 按需租赁与组队"
      title="专家 Agent 市场"
      subtitle="按产品与研发角色、能力标签、历史绩效及节点类型快速筛选，一键雇佣加入当前任务团队。"
      headerRight={
        <div className="flex items-center gap-4 text-xs text-slate-600">
          <span className="font-mono tabular-nums">
            已雇佣 <strong className="text-slate-900">{hiredIds.length}</strong> / {agents.length}
          </span>
          <button
            type="button"
            onClick={onJumpToChat}
            className="skeuo-key inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-800 cursor-pointer whitespace-nowrap"
          >
            <span>回到团队群聊</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      }
    >
      {/* Embedded AI Talent Matching Advisor */}
      <form
        onSubmit={handleAiMatch}
        className="skeuo-well rounded-2xl p-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-5"
      >
        <div className="flex items-center gap-2 px-2.5 text-xs font-semibold text-amber-800 whitespace-nowrap shrink-0">
          <Sparkles className="w-4 h-4 text-amber-600" />
          <span>AI 选人顾问</span>
        </div>
        <input
          type="text"
          value={aiQuery}
          onChange={(e) => setAiQuery(e.target.value)}
          placeholder="描述你的项目难点，例如：需要高并发支付架构审查，再配一位做边界压测的专家..."
          className="flex-1 min-w-0 bg-white rounded-xl px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-200/80 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
        />
        <button
          type="submit"
          disabled={aiMatching || !aiQuery.trim()}
          className="skeuo-primary px-4 py-2 rounded-xl text-xs font-medium text-white whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45"
        >
          {aiMatching ? '正在筛选...' : '智能推荐组合'}
        </button>
      </form>

      {matchError && (
        <div className="mb-4 px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between gap-2">
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
        <div className="mb-5 px-4 py-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-amber-800 font-semibold">
              <span>AI 选人建议</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                预估单轮预算 ${Number(matchResult.estimatedBudgetUsd || 0).toFixed(2)}
              </span>
            </div>
            <p className="text-sm text-slate-800 mt-1">{matchResult.summary}</p>
          </div>
          <button
            type="button"
            onClick={() => setMatchResult(null)}
            className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-center"
          >
            清除高亮
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-5 mb-5 border-b border-slate-200/80">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCategoryFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                categoryFilter === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
            {(
              [
                { id: 'all', label: '全部节点' },
                { id: 'official-cloud', label: '官方合规云' },
                { id: 'idle-peer', label: '闲时私家节点' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTierFilter(opt.id)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  tierFilter === opt.id
                    ? 'bg-white text-slate-900 shadow-sm'
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
              placeholder="搜索技能、工具或角色..."
              className="w-full sm:w-52 bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/25"
            />
          </div>
        </div>
      </div>

      {/* Main Content Split: Agent Grid + Optional Dossier Inspector */}
      <div className={`grid gap-5 ${inspectedAgent ? 'lg:grid-cols-12' : 'grid-cols-1'}`}>
        <div
          className={
            inspectedAgent
              ? 'lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-4 content-start'
              : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'
          }
        >
          {filteredAgents.length === 0 ? (
            <div className="col-span-full py-12 text-center border border-dashed border-slate-300 rounded-2xl bg-slate-50/70">
              <p className="text-sm font-medium text-slate-700">没有符合当前筛选条件的专家 Agent</p>
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter('all');
                  setTierFilter('all');
                  setKeyword('');
                }}
                className="mt-3 skeuo-key px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-800 cursor-pointer"
              >
                重置全部筛选
              </button>
            </div>
          ) : (
            filteredAgents.map((agent) => {
              const isHired = hiredIds.includes(agent.id);
              const aiReason = matchMap.get(agent.id);
              const isSelected = inspectedAgentId === agent.id;

              return (
                <article
                  key={agent.id}
                  className={`rounded-2xl p-4 flex flex-col justify-between transition-all border ${
                    aiReason
                      ? 'bg-amber-50/50 border-amber-300 shadow-sm'
                      : isSelected
                        ? 'bg-slate-50 border-blue-400'
                        : 'bg-white border-slate-200/90 hover:border-slate-300'
                  }`}
                >
                  <div>
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm"
                          style={{ backgroundColor: agent.avatarAccent }}
                        >
                          {agent.avatarCode}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-sm font-bold text-slate-900 truncate">
                              {agent.handle}
                            </h3>
                            {agent.isCustomPublished && (
                              <span className="text-[11px] font-medium text-indigo-600 whitespace-nowrap">
                                · 自建上架
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 truncate">{agent.title}</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold font-mono tabular-nums text-slate-900">
                          ${agent.pricePerTaskUsd.toFixed(2)}
                        </div>
                        <div className="text-[11px] text-slate-500">每次任务</div>
                      </div>
                    </div>

                    {/* AI Match Highlight */}
                    {aiReason && (
                      <p className="mt-2.5 text-xs text-amber-900 bg-amber-100/70 rounded-lg px-2.5 py-1.5 leading-relaxed">
                        AI 推荐：{aiReason}
                      </p>
                    )}

                    {/* Quiet Unboxed Performance Metadata */}
                    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 font-mono tabular-nums">
                      <span className="font-sans text-slate-700 font-medium">
                        {CATEGORY_LABELS[agent.category]}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>评分 {agent.performance.rating.toFixed(2)}</span>
                      <span aria-hidden="true">·</span>
                      <span>成功率 {agent.performance.successRate}%</span>
                      <span aria-hidden="true">·</span>
                      <span>{agent.performance.completedTasks} 单</span>
                    </div>

                    {/* Clean Unboxed Capability Tags */}
                    <p className="mt-2.5 text-xs text-slate-700 leading-relaxed">
                      <span className="text-slate-400 mr-1.5">能力</span>
                      {agent.skills.join(' · ')}
                    </p>

                    <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between gap-2">
                      <span className="truncate">{agent.region}</span>
                      <span className="font-mono tabular-nums shrink-0">
                        均耗 {agent.performance.avgDurationMin}m
                      </span>
                    </div>
                  </div>

                  {/* Action Footer */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setInspectedAgentId(isSelected ? null : agent.id)
                      }
                      className="text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {isSelected ? '收起绩效档案' : '查看绩效履历'}
                    </button>

                    {isHired ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 whitespace-nowrap">
                          <Check className="w-3.5 h-3.5" />
                          已在团队
                        </span>
                        <button
                          type="button"
                          onClick={() => onRelease(agent.id)}
                          title="移出当前团队"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onHire(agent.id)}
                        disabled={!agent.isOnlineForOrders}
                        className="skeuo-primary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white whitespace-nowrap cursor-pointer disabled:opacity-45"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>{agent.isOnlineForOrders ? '雇佣入队' : '暂未接单'}</span>
                      </button>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>

        {/* Inline Expert Performance & Capability Dossier Inspector */}
        {inspectedAgent && (
          <aside className="lg:col-span-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-200">
                <div>
                  <div className="text-xs text-slate-500">{inspectedAgent.engineModel}</div>
                  <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                    {inspectedAgent.name}
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">{inspectedAgent.handle} · {inspectedAgent.region}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectedAgentId(null)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white cursor-pointer"
                  aria-label="关闭专家详情"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="mt-4 text-sm text-slate-700 leading-relaxed">
                {inspectedAgent.bio}
              </p>

              {/* Tabular Historical Performance Grid */}
              <div className="mt-4 grid grid-cols-2 gap-3 py-3 border-y border-slate-200/80">
                <div>
                  <div className="text-[11px] text-slate-500">历史完成任务</div>
                  <div className="text-base font-bold font-mono tabular-nums text-slate-900">
                    {inspectedAgent.performance.completedTasks} 次
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">一次验收通过率</div>
                  <div className="text-base font-bold font-mono tabular-nums text-emerald-700">
                    {inspectedAgent.performance.successRate}%
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">平均交付耗时</div>
                  <div className="text-base font-bold font-mono tabular-nums text-slate-900">
                    {inspectedAgent.performance.avgDurationMin} 分钟
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">成本控制表现</div>
                  <div className="text-xs font-semibold text-slate-800 mt-1">
                    {inspectedAgent.performance.costEfficiency}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className="text-xs font-semibold text-slate-800 mb-1.5">
                  已装配 MCP 工具链（即插即用）
                </div>
                <div className="text-xs font-mono text-slate-600">
                  {inspectedAgent.mcpTools.join(' / ')}
                </div>
              </div>

              {/* Employer Reviews */}
              <div className="mt-4">
                <div className="text-xs font-semibold text-slate-800 mb-2">
                  近期雇主履约评价
                </div>
                <div className="space-y-2.5">
                  {inspectedAgent.performance.recentReviews.map((rev, idx) => (
                    <div
                      key={idx}
                      className="bg-white rounded-xl p-3 border border-slate-200/80"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium text-slate-800">{rev.employer}</span>
                        <span className="font-mono tabular-nums text-amber-700 font-semibold">
                          {rev.score.toFixed(1)} / 5.0
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{rev.project}</div>
                      <p className="text-xs text-slate-700 mt-1.5 leading-relaxed">
                        “{rev.comment}”
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-600 font-mono tabular-nums">
                按任务 ${inspectedAgent.pricePerTaskUsd.toFixed(2)} · 按时 ${inspectedAgent.pricePerHourUsd.toFixed(2)}
              </div>
              {hiredIds.includes(inspectedAgent.id) ? (
                <button
                  type="button"
                  onClick={onJumpToChat}
                  className="skeuo-key px-4 py-2 rounded-xl text-xs font-semibold text-slate-900 cursor-pointer whitespace-nowrap"
                >
                  去群里 @ 派活
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onHire(inspectedAgent.id)}
                  className="skeuo-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>立即雇佣入队</span>
                </button>
              )}
            </div>
          </aside>
        )}
      </div>
    </ServiceCardShell>
  );
}
