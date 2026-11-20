import { useState, type FormEvent } from 'react';
import {
  Check,
  Plus,
  Sparkles,
  Store,
  X,
} from 'lucide-react';
import { optimizeExpertProfile } from '../../services/api';
import type { AgentCategory, ExpertAgent, NodeTier } from '../../types/agentnexus';
import { ServiceCardShell } from './ServiceCardShell';

interface ExpertStudioCardProps {
  agents: ExpertAgent[];
  onSaveExpert: (expert: ExpertAgent, isNew: boolean) => void;
  onJumpToMarket: () => void;
}

const ACCENT_PALETTE = ['#1d4ed8', '#0f766e', '#d97706', '#4338ca', '#be123c', '#0369a1'];

export function ExpertStudioCard({
  agents,
  onSaveExpert,
  onJumpToMarket,
}: ExpertStudioCardProps) {
  const [selectedId, setSelectedId] = useState<string>(agents[1]?.id || agents[0]?.id || 'new');

  const initialSource = agents.find((a) => a.id === selectedId) || agents[0];

  const [handle, setHandle] = useState(initialSource?.handle || '@新专家特工');
  const [name, setName] = useState(initialSource?.name || 'Nova · 专项交付特工');
  const [title, setTitle] = useState(initialSource?.title || '系统设计与自动化交付专家');
  const [category, setCategory] = useState<AgentCategory>(initialSource?.category || 'engineering');
  const [nodeTier, setNodeTier] = useState<NodeTier>(initialSource?.nodeTier || 'idle-peer');
  const [region, setRegion] = useState(initialSource?.region || '深圳极客原生闲时节点');
  const [pricePerTaskUsd, setPricePerTaskUsd] = useState(initialSource?.pricePerTaskUsd || 1.8);
  const [pricePerHourUsd, setPricePerHourUsd] = useState(initialSource?.pricePerHourUsd || 6.0);
  const [bio, setBio] = useState(initialSource?.bio || '');
  const [skills, setSkills] = useState<string[]>(initialSource?.skills || []);
  const [mcpTools, setMcpTools] = useState<string[]>(initialSource?.mcpTools || ['Git-PR', 'Sandbox-Runner']);
  const [isOnlineForOrders, setIsOnlineForOrders] = useState(initialSource?.isOnlineForOrders ?? true);

  const [newSkillInput, setNewSkillInput] = useState('');
  const [aiOptimizing, setAiOptimizing] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const loadProfile = (id: string) => {
    setSelectedId(id);
    setAiAdvice(null);
    setAiError(null);
    setSavedNotice(null);

    if (id === 'new') {
      setHandle('@风控数据专家');
      setName('Kestrel · 支付风控与反欺诈特工');
      setTitle('交易异常检测、限流规则与风控模型搭建');
      setCategory('architecture');
      setNodeTier('idle-peer');
      setRegion('上海极客原生闲时节点');
      setPricePerTaskUsd(1.9);
      setPricePerHourUsd(6.8);
      setBio('由支付风控资深工程师调优的私家专家 Agent，擅长高并发交易异常规则引擎设计与实时反欺诈拦截测试。');
      setSkills(['交易风控规则', '异常流量拦截', '限流熔断设计', '账本对账审计']);
      setMcpTools(['SQL-Explain', 'Rule-Validator', 'Trace-Analyzer']);
      setIsOnlineForOrders(true);
      return;
    }

    const found = agents.find((a) => a.id === id);
    if (!found) return;
    setHandle(found.handle);
    setName(found.name);
    setTitle(found.title);
    setCategory(found.category);
    setNodeTier(found.nodeTier);
    setRegion(found.region);
    setPricePerTaskUsd(found.pricePerTaskUsd);
    setPricePerHourUsd(found.pricePerHourUsd);
    setBio(found.bio);
    setSkills([...found.skills]);
    setMcpTools([...found.mcpTools]);
    setIsOnlineForOrders(found.isOnlineForOrders);
  };

  const activeExisting = selectedId === 'new' ? null : agents.find((a) => a.id === selectedId) || null;

  const handleAddSkill = () => {
    const cleaned = newSkillInput.trim();
    if (!cleaned || skills.includes(cleaned)) return;
    setSkills((prev) => [...prev, cleaned]);
    setNewSkillInput('');
  };

  const handleRemoveSkill = (tag: string) => {
    setSkills((prev) => prev.filter((s) => s !== tag));
  };

  const handleAiOptimize = async () => {
    setAiOptimizing(true);
    setAiError(null);
    try {
      const res = await optimizeExpertProfile({
        name,
        title,
        category,
        skills,
        bio,
      });
      setBio(res.optimizedBio || bio);
      if (res.recommendedSkills?.length) {
        setSkills(res.recommendedSkills);
      }
      if (res.recommendedMcpTools?.length) {
        setMcpTools(res.recommendedMcpTools);
      }
      if (res.suggestedPricePerTaskUsd) {
        setPricePerTaskUsd(Number(res.suggestedPricePerTaskUsd.toFixed(2)));
      }
      setAiAdvice(res.marketAdvice);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI 档案优化失败');
    } finally {
      setAiOptimizing(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const normalizedHandle = handle.startsWith('@') ? handle.trim() : `@${handle.trim()}`;
    const isNew = selectedId === 'new';
    const nextId = isNew ? `agent_custom_${Date.now().toString().slice(-4)}` : selectedId;

    const expert: ExpertAgent = {
      id: nextId,
      handle: normalizedHandle,
      name: name.trim() || '自定义专家特工',
      title: title.trim() || '专业领域交付',
      category,
      region: region.trim() || '原生闲时节点',
      nodeTier,
      engineModel:
        nodeTier === 'idle-peer'
          ? '私家闲时节点 · 原生 IP 串行接单'
          : '官方企业通道 · 预设技能包',
      skills: skills.length > 0 ? skills : ['专业领域交付'],
      mcpTools: mcpTools.length > 0 ? mcpTools : ['Git-PR'],
      pricePerTaskUsd: Number(pricePerTaskUsd) || 1.5,
      pricePerHourUsd: Number(pricePerHourUsd) || 5.5,
      bio: bio.trim(),
      avatarAccent:
        activeExisting?.avatarAccent ||
        ACCENT_PALETTE[agents.length % ACCENT_PALETTE.length],
      avatarCode:
        activeExisting?.avatarCode ||
        (category === 'product'
          ? 'PM'
          : category === 'architecture'
            ? 'AR'
            : category === 'qa'
              ? 'QA'
              : 'EX'),
      isOnlineForOrders,
      isCustomPublished: isNew || activeExisting?.isCustomPublished,
      performance: activeExisting?.performance || {
        completedTasks: 28,
        successRate: 98.5,
        avgDurationMin: 11,
        rating: 4.92,
        costEfficiency: '闲时节点按任务一口价',
        recentReviews: [
          {
            employer: '内测种子雇主',
            project: '沙箱准入基准验收',
            comment: '技能包响应准确，交付文档与代码边界清晰，零超预算消耗。',
            score: 4.9,
          },
        ],
      },
    };

    onSaveExpert(expert, isNew);
    setSelectedId(nextId);
    setSavedNotice(
      isNew
        ? `已将 ${expert.handle} 实时发布至雇主专家市场！`
        : `已更新 ${expert.handle} 的能力标签与接单配置。`,
    );
  };

  const estimatedMonthlyEarnings = activeExisting
    ? (activeExisting.performance.completedTasks * activeExisting.pricePerTaskUsd * 0.18).toFixed(0)
    : '148';

  return (
    <ServiceCardShell
      cardId="expert"
      kicker="专家供给端 · 能力标签与绩效背书"
      title="专家 Agent 能力档案与接单台"
      subtitle="配置自身能力标签（Skills + MCP）、展示历史绩效与雇主口碑，并开启闲时挂网接单实时同步至市场。"
      headerRight={
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => loadProfile('new')}
            className="skeuo-key inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-800 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>上架新专家</span>
          </button>
          <button
            type="button"
            onClick={onJumpToMarket}
            className="skeuo-key inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-800 cursor-pointer whitespace-nowrap"
          >
            <Store className="w-3.5 h-3.5" />
            <span>查看市场展示</span>
          </button>
        </div>
      }
    >
      {/* Profile Selector Strip */}
      <div className="flex items-center gap-1.5 pb-4 mb-5 border-b border-slate-200/80 overflow-x-auto">
        <span className="text-xs text-slate-500 mr-1 whitespace-nowrap shrink-0">切换节点：</span>
        {agents.slice(0, 5).map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => loadProfile(a.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              selectedId === a.id
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
            }`}
          >
            {a.handle}
          </button>
        ))}
        <button
          type="button"
          onClick={() => loadProfile('new')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            selectedId === 'new'
              ? 'bg-indigo-600 text-white'
              : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
          }`}
        >
          + 发布新专家节点
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Capability & Node Configuration Form */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 rounded-xl px-4 py-3 border border-slate-200/80">
            <div>
              <div className="text-sm font-semibold text-slate-900">闲时挂网接单开关</div>
              <div className="text-xs text-slate-500">
                开启后，雇主可在市场筛选并按任务委派，平台自动完成沙箱隔离与清结算
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOnlineForOrders((v) => !v)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                isOnlineForOrders
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {isOnlineForOrders ? '接单中 · 已上线' : '已暂停接单'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <label className="block">
              <span className="text-xs font-medium text-slate-700">群聊 @ 句柄</span>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                required
                className="mt-1 w-full bg-white border border-slate-300/90 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-slate-700">专家名称</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-1 w-full bg-white border border-slate-300/90 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-slate-700">一句话专业定位</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="mt-1 w-full bg-white border border-slate-300/90 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-slate-700">专业职能分类</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as AgentCategory)}
                className="mt-1 w-full bg-white border border-slate-300/90 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
              >
                <option value="product">产品策划</option>
                <option value="architecture">架构审查</option>
                <option value="engineering">工程研发</option>
                <option value="qa">测试质量</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-slate-700">节点接入形态</span>
              <select
                value={nodeTier}
                onChange={(e) => setNodeTier(e.target.value as NodeTier)}
                className="mt-1 w-full bg-white border border-slate-300/90 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
              >
                <option value="idle-peer">极客私家闲时节点（原生 IP 串行）</option>
                <option value="official-cloud">官方商业高速节点</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-slate-700">单任务定价 (USD)</span>
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="50"
                value={pricePerTaskUsd}
                onChange={(e) => setPricePerTaskUsd(Number(e.target.value))}
                className="mt-1 w-full bg-white border border-slate-300/90 rounded-xl px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-slate-700">部署地域 / 节点标识</span>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="mt-1 w-full bg-white border border-slate-300/90 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
              />
            </label>
          </div>

          {/* Capability Tags Editor */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-700">
                能力标签（供雇主在市场精准检索）
              </span>
              <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                {skills.length} 项标签
              </span>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {skills.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-xs text-slate-800 border border-slate-200/90"
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSkill(tag)}
                    className="text-slate-400 hover:text-red-600 cursor-pointer"
                    aria-label={`移除标签 ${tag}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newSkillInput}
                onChange={(e) => setNewSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSkill();
                  }
                }}
                placeholder="新增技能标签，例如：Stripe 账本对账..."
                className="flex-1 bg-white border border-slate-300/90 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
              />
              <button
                type="button"
                onClick={handleAddSkill}
                className="skeuo-key px-3 py-1.5 rounded-xl text-xs font-medium text-slate-800 cursor-pointer whitespace-nowrap"
              >
                添加标签
              </button>
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-slate-700">专家履约简介</span>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="mt-1 w-full bg-white border border-slate-300/90 rounded-xl px-3 py-2 text-sm text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
            />
          </label>

          {aiAdvice && (
            <div className="px-3.5 py-2.5 rounded-xl bg-indigo-50/80 border border-indigo-200 text-xs text-indigo-900">
              AI 包装建议：{aiAdvice}
            </div>
          )}

          {aiError && (
            <div className="px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
              {aiError}
            </div>
          )}

          {savedNotice && (
            <div className="px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-1.5">
              <Check className="w-4 h-4 shrink-0" />
              <span>{savedNotice}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleAiOptimize}
              disabled={aiOptimizing}
              className="skeuo-key inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-indigo-700 cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{aiOptimizing ? 'AI 正在优化...' : 'AI 优化能力简介与定价'}</span>
            </button>

            <button
              type="submit"
              className="skeuo-primary px-5 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
            >
              {selectedId === 'new' ? '发布上架至雇主市场' : '保存档案并同步市场'}
            </button>
          </div>
        </form>

        {/* Right: Verifiable Historical Performance Ledger */}
        <aside className="lg:col-span-5 rounded-2xl bg-slate-50/90 border border-slate-200 p-5 flex flex-col justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-1">
              雇主可见 · 链上核验历史绩效
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              {handle} 绩效背书面板
            </h3>

            <div className="mt-4 grid grid-cols-2 gap-4 py-4 border-y border-slate-200/80">
              <div>
                <div className="text-xs text-slate-500">累计交付任务</div>
                <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                  {activeExisting ? activeExisting.performance.completedTasks : 28}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">一次验收成功率</div>
                <div className="text-xl font-bold font-mono tabular-nums text-emerald-700 mt-0.5">
                  {activeExisting ? activeExisting.performance.successRate : 98.5}%
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">雇主综合评分</div>
                <div className="text-xl font-bold font-mono tabular-nums text-amber-700 mt-0.5">
                  {activeExisting ? activeExisting.performance.rating.toFixed(2) : '4.92'}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">近 30 日估算收益</div>
                <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                  ${estimatedMonthlyEarnings}
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <span>平均单次交付耗时</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  {activeExisting ? activeExisting.performance.avgDurationMin : 11} 分钟
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>已装配 MCP 工具</span>
                <span className="font-mono text-slate-800">{mcpTools.join(' / ')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Token 成本表现</span>
                <span className="font-medium text-slate-800">
                  {activeExisting?.performance.costEfficiency || '按任务一口价无隐形超支'}
                </span>
              </div>
            </div>

            <div className="mt-5">
              <div className="text-xs font-semibold text-slate-800 mb-2">
                历史雇主真实评价（用于市场排序加权）
              </div>
              <div className="space-y-2.5">
                {(
                  activeExisting?.performance.recentReviews || [
                    {
                      employer: '平台准入沙箱基准',
                      project: '首次上架能力核验',
                      comment: '技能包与工作流契约校验通过，满足按任务委派标准。',
                      score: 4.9,
                    },
                  ]
                ).map((rev, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-xl p-3 border border-slate-200/80"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800">{rev.employer}</span>
                      <span className="font-mono tabular-nums font-semibold text-amber-700">
                        {rev.score.toFixed(1)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      “{rev.comment}”
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-200 text-[11px] text-slate-500">
            黑盒保护机制：外部雇主仅可见能力标签、绩效与交付产物，无法窃取你的私有 System Prompt 与调优参数。
          </div>
        </aside>
      </div>
    </ServiceCardShell>
  );
}
