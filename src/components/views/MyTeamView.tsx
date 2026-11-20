import { useEffect, useState, type FormEvent } from 'react';
import {
  Check,
  Globe,
  Lock,
  MessageSquareText,
  Plus,
  Settings2,
  Sparkles,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react';
import { optimizeExpertProfile } from '../../services/api';
import type {
  AgentCategory,
  ExpertAgent,
  ProjectWorkspace,
  ServiceMode,
  WorkflowTask,
} from '../../types/agentnexus';

interface MyTeamViewProps {
  workspace: ProjectWorkspace;
  hiredAgents: ExpertAgent[];
  privateAgents: ExpertAgent[];
  hiredIds: string[];
  tasks: WorkflowTask[];
  openMountDrawerSignal: number;
  onMentionInChat: (handle: string) => void;
  onHireAgent: (agentId: string) => void;
  onReleaseAgent: (agentId: string) => void;
  onSavePrivateAgent: (expert: ExpertAgent, isNew: boolean) => void;
  onToggleMarketListing: (agentId: string) => void;
  onRecruitCategory: (category: 'all' | AgentCategory) => void;
  onJumpToMarket: () => void;
}

const ROLE_SUGGESTIONS: {
  category: AgentCategory;
  label: string;
  desc: string;
}[] = [
  { category: 'product', label: '产品策划专家', desc: '拆解 PRD、业务边界与验收标准' },
  { category: 'architecture', label: '架构审查专家', desc: '高并发评估、幂等设计与安全护栏' },
  { category: 'engineering', label: '研发与评审专家', desc: '前后端实现、单测与 PR 审查' },
  { category: 'qa', label: 'QA 自动化测试', desc: '边界压测、回归矩阵与缺陷定位' },
];

const SERVICE_MODE_LABELS: Record<ServiceMode, string> = {
  'pure-agent': '纯 Agent 租用',
  'human-agent': '人 + Agent 协同',
};

const ACCENT_PALETTE = ['#0284c7', '#7c3aed', '#0f766e', '#d97706', '#4338ca', '#be123c'];

export function MyTeamView({
  workspace,
  hiredAgents,
  privateAgents,
  hiredIds,
  tasks,
  openMountDrawerSignal,
  onMentionInChat,
  onHireAgent,
  onReleaseAgent,
  onSavePrivateAgent,
  onToggleMarketListing,
  onRecruitCategory,
  onJumpToMarket,
}: MyTeamViewProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | 'new'>('new');

  // Private Agent Mount / Market Listing Drawer Form State
  const [handle, setHandle] = useState('@我的私有专家');
  const [name, setName] = useState('Nova · 领域私有交付节点');
  const [title, setTitle] = useState('私有工作流自动化执行与专项审计');
  const [category, setCategory] = useState<AgentCategory>('engineering');
  const [serviceMode, setServiceMode] = useState<ServiceMode>('pure-agent');
  const [region, setRegion] = useState('本地 anx-worker 私有节点');
  const [pricePerTaskUsd, setPricePerTaskUsd] = useState(1.8);
  const [pricePerHourUsd, setPricePerHourUsd] = useState(6.0);
  const [bio, setBio] = useState(
    '我本地调优的私有领域 Agent，可优先拉入自有项目群零外包费使用，闲时可勾选对外上架市场接单变现。',
  );
  const [skills, setSkills] = useState<string[]>(['领域知识库检索', '代码规范检查', '自动化回归脚本']);
  const [mcpTools, setMcpTools] = useState<string[]>(['Git-PR', 'Sandbox-Runner']);
  const [isListedInMarket, setIsListedInMarket] = useState(false);
  const [newSkillInput, setNewSkillInput] = useState('');

  const [aiOptimizing, setAiOptimizing] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const openCreateDrawer = (defaultListToMarket = false) => {
    setEditingId('new');
    setHandle('@私有专项特工');
    setName('Kestrel · 领域专项私有节点');
    setTitle('自动化接口联调、安全基线校验与文档生成');
    setCategory('engineering');
    setServiceMode('pure-agent');
    setRegion('本地 anx-worker 私有节点');
    setPricePerTaskUsd(1.8);
    setPricePerHourUsd(6.2);
    setBio('我本地调优的私有 Agent，支持加密云工作空间挂载。默认私有自用，勾选上架即可进入专家市场接受外部雇主私聊与租用。');
    setSkills(['接口契约联调', '边界单测补全', '安全基线审计', '自动化文档']);
    setMcpTools(['Git-PR', 'Sandbox-Runner', 'TypeCheck-CLI']);
    setIsListedInMarket(defaultListToMarket);
    setAiAdvice(null);
    setAiError(null);
    setDrawerOpen(true);
  };

  const openEditDrawer = (agent: ExpertAgent) => {
    setEditingId(agent.id);
    setHandle(agent.handle);
    setName(agent.name);
    setTitle(agent.title);
    setCategory(agent.category);
    setServiceMode(agent.serviceMode);
    setRegion(agent.region);
    setPricePerTaskUsd(agent.pricePerTaskUsd);
    setPricePerHourUsd(agent.pricePerHourUsd);
    setBio(agent.bio);
    setSkills([...agent.skills]);
    setMcpTools([...agent.mcpTools]);
    setIsListedInMarket(agent.isListedInMarket);
    setAiAdvice(null);
    setAiError(null);
    setDrawerOpen(true);
  };

  useEffect(() => {
    if (openMountDrawerSignal > 0) {
      openCreateDrawer(true);
    }
  }, [openMountDrawerSignal]);

  const handleAddSkill = () => {
    const cleaned = newSkillInput.trim();
    if (!cleaned || skills.includes(cleaned)) return;
    setSkills((prev) => [...prev, cleaned]);
    setNewSkillInput('');
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
      if (res.recommendedSkills?.length) setSkills(res.recommendedSkills);
      if (res.recommendedMcpTools?.length) setMcpTools(res.recommendedMcpTools);
      if (res.suggestedPricePerTaskUsd) {
        setPricePerTaskUsd(Number(res.suggestedPricePerTaskUsd.toFixed(2)));
      }
      setAiAdvice(res.marketAdvice);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI 优化失败');
    } finally {
      setAiOptimizing(false);
    }
  };

  const handleSaveDrawer = (e: FormEvent) => {
    e.preventDefault();
    const isNew = editingId === 'new';
    const existing = isNew ? null : privateAgents.find((a) => a.id === editingId) || null;
    const normalizedHandle = handle.startsWith('@') ? handle.trim() : `@${handle.trim()}`;

    const nextAgent: ExpertAgent = {
      id: isNew ? `agent_priv_${Date.now().toString().slice(-4)}` : editingId,
      handle: normalizedHandle,
      name: name.trim() || '私有节点特工',
      title: title.trim() || '专业领域交付',
      category,
      region: region.trim() || '本地私有节点',
      nodeTier: 'idle-peer',
      serviceMode,
      ownership: 'private',
      isListedInMarket,
      engineModel:
        serviceMode === 'human-agent'
          ? '私有领域知识库 + 人工关键审批协同'
          : '自有私有节点 · anx-worker 直连',
      skills: skills.length > 0 ? skills : ['私有领域交付'],
      mcpTools: mcpTools.length > 0 ? mcpTools : ['Git-PR'],
      pricePerTaskUsd: Number(pricePerTaskUsd) || 1.6,
      pricePerHourUsd: Number(pricePerHourUsd) || 5.8,
      bio: bio.trim(),
      avatarAccent:
        existing?.avatarAccent ||
        ACCENT_PALETTE[privateAgents.length % ACCENT_PALETTE.length],
      avatarCode:
        existing?.avatarCode ||
        (category === 'product'
          ? 'PM'
          : category === 'architecture'
            ? 'AR'
            : category === 'qa'
              ? 'QA'
              : 'PV'),
      isOnlineForOrders: true,
      performance: existing?.performance || {
        completedTasks: 12,
        successRate: 98.8,
        avgDurationMin: 10,
        rating: 4.93,
        costEfficiency: '自有私有配额 · 闲时高毛利',
        recentReviews: [
          {
            employer: '内部沙箱验收',
            project: '私有节点准入基准',
            comment: '能力标签与工作流契约校验通过，满足自用与对外接单标准。',
            score: 4.9,
          },
        ],
      },
    };

    onSavePrivateAgent(nextAgent, isNew);
    setDrawerOpen(false);
  };

  const activeTaskCount = tasks.filter((t) => t.status !== 'done').length;
  const listedPrivateCount = privateAgents.filter((a) => a.isListedInMarket).length;
  const missingRoles = ROLE_SUGGESTIONS.filter(
    (r) => !hiredAgents.some((a) => a.category === r.category),
  );

  return (
    <div className="h-full flex min-h-0 bg-white relative">
      {/* Main Team & Private Nodes Area */}
      <div className="flex-1 min-w-0 overflow-y-auto clean-scroll">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-6 space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-slate-200">
            <div>
              <h1 className="text-xl font-bold text-slate-900">我的团队</h1>
              <p className="text-sm text-slate-600 mt-1">
                统一管理当前项目的在群专家，以及你自己的私有 Agent 节点；私有节点默认自用，需要对外接单时一键上架至市场。
              </p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => openCreateDrawer(false)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>挂载私有 Agent</span>
              </button>
              <button
                type="button"
                onClick={() => onRecruitCategory('all')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer whitespace-nowrap"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>去市场选人</span>
              </button>
            </div>
          </div>

          {/* 4-Column Tabular Summary Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 pb-6 border-b border-slate-200">
            <div>
              <div className="text-xs text-slate-500">当前项目在群专家</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {hiredAgents.length}{' '}
                <span className="text-xs font-sans font-normal text-slate-500">位</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">我的私有挂载节点</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {privateAgents.length}{' '}
                <span className="text-xs font-sans font-normal text-slate-500">
                  个（{listedPrivateCount} 已上架市场）
                </span>
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">进行中 / 待办任务</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {activeTaskCount}{' '}
                <span className="text-xs font-sans font-normal text-slate-500">项</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">当前项目预算花费</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                ${workspace.spentUsd.toFixed(2)}
                <span className="text-xs text-slate-400 font-normal">
                  {' '}
                  / ${workspace.budgetCapUsd.toFixed(0)}
                </span>
              </div>
            </div>
          </div>

          {/* Section 1: Active Project Group Members */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-900">
                当前项目在群专家 · {workspace.name} ({hiredAgents.length})
              </h2>
            </div>

            {hiredAgents.length === 0 ? (
              <div className="py-10 text-center border border-dashed border-slate-300 rounded-xl bg-slate-50">
                <p className="text-sm font-medium text-slate-700">当前项目尚未拉入专家 Agent</p>
                <button
                  type="button"
                  onClick={() => onRecruitCategory('all')}
                  className="mt-3 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                >
                  去市场私聊选人
                </button>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-200 overflow-hidden">
                {hiredAgents.map((agent) => {
                  const agentTasks = tasks.filter((t) => t.assigneeId === agent.id);
                  const doneTasks = agentTasks.filter((t) => t.status === 'done').length;
                  const spent = agentTasks.reduce((sum, t) => sum + t.actualCostUsd, 0);

                  return (
                    <div
                      key={agent.id}
                      className="p-4 sm:p-5 bg-white hover:bg-slate-50/70 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3.5 min-w-0 flex-1">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                          style={{ backgroundColor: agent.avatarAccent }}
                        >
                          {agent.avatarCode}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                            <span className="text-sm font-bold text-slate-900">{agent.handle}</span>
                            <span className="text-slate-500">· {agent.name}</span>
                            <span aria-hidden="true" className="text-slate-300">·</span>
                            <span className="font-medium text-slate-700">
                              {agent.ownership === 'private' ? '我的私有节点' : '市场租用'}
                            </span>
                            <span aria-hidden="true" className="text-slate-300">·</span>
                            <span
                              className={
                                agent.serviceMode === 'human-agent'
                                  ? 'text-indigo-700 font-medium'
                                  : 'text-slate-600'
                              }
                            >
                              {SERVICE_MODE_LABELS[agent.serviceMode]}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1">{agent.title}</p>
                          <div className="mt-1.5 text-xs text-slate-500">
                            {agent.skills.join(' · ')}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap sm:flex-nowrap items-center justify-between lg:justify-end gap-5 shrink-0">
                        <div className="flex items-center gap-5 text-xs font-mono tabular-nums">
                          <div>
                            <div className="text-[11px] font-sans text-slate-500">任务完成</div>
                            <div className="font-semibold text-slate-900 mt-0.5">
                              {doneTasks} / {agentTasks.length}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] font-sans text-slate-500">项目花费</div>
                            <div className="font-semibold text-slate-900 mt-0.5">
                              {agent.ownership === 'private' ? '私有自用' : `$${spent.toFixed(2)}`}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onMentionInChat(agent.handle)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white cursor-pointer whitespace-nowrap"
                          >
                            <MessageSquareText className="w-3.5 h-3.5" />
                            <span>群里 @ 派单</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onReleaseAgent(agent.id)}
                            title="移出当前项目群"
                            className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Section 2: My Private Mounted Agents (Self-Use + Optional Public Market Listing) */}
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  我的私有挂载 Agent ({privateAgents.length})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  私有挂载默认仅供自己项目使用；需要闲时对外接单变现时，可直接切换“上架到市场”同步曝光。
                </p>
              </div>
              {listedPrivateCount > 0 && (
                <button
                  type="button"
                  onClick={onJumpToMarket}
                  className="text-xs font-medium text-blue-700 hover:text-blue-900 cursor-pointer whitespace-nowrap self-start sm:self-auto"
                >
                  去市场查看已上架节点 →
                </button>
              )}
            </div>

            <div className="border border-slate-200 rounded-xl divide-y divide-slate-200 overflow-hidden">
              {privateAgents.map((agent) => {
                const inCurrentProject = hiredIds.includes(agent.id);
                return (
                  <div
                    key={agent.id}
                    className="p-4 sm:p-5 bg-slate-50/40 hover:bg-slate-50 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ backgroundColor: agent.avatarAccent }}
                      >
                        {agent.avatarCode}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                          <span className="text-sm font-bold text-slate-900">{agent.handle}</span>
                          <span className="text-slate-500">· {agent.name}</span>
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span className="text-slate-700 font-medium">
                            {SERVICE_MODE_LABELS[agent.serviceMode]}
                          </span>
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span
                            className={`inline-flex items-center gap-1 font-semibold ${
                              agent.isListedInMarket ? 'text-emerald-700' : 'text-slate-500'
                            }`}
                          >
                            {agent.isListedInMarket ? (
                              <>
                                <Globe className="w-3 h-3" />
                                已上架市场 (${agent.pricePerTaskUsd.toFixed(2)}/任务)
                              </>
                            ) : (
                              <>
                                <Lock className="w-3 h-3" />
                                仅私有自用
                              </>
                            )}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 mt-1">{agent.title}</p>
                        <div className="mt-1.5 text-xs text-slate-500">
                          {agent.skills.join(' · ')}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {inCurrentProject ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
                          <Check className="w-3.5 h-3.5" />
                          已在当前项目群
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onHireAgent(agent.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-medium text-slate-800 cursor-pointer whitespace-nowrap"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>拉入当前项目自用</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onToggleMarketListing(agent.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                          agent.isListedInMarket
                            ? 'border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>{agent.isListedInMarket ? '已上架 · 点击下架' : '上架到市场'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditDrawer(agent)}
                        title="编辑能力标签与定价"
                        className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 cursor-pointer"
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Missing Role Recruitment Suggestions */}
          {missingRoles.length > 0 && (
            <section className="pt-1">
              <h2 className="text-sm font-bold text-slate-900 mb-3">当前项目角色缺口建议</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {missingRoles.map((role) => (
                  <div
                    key={role.category}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{role.label}</div>
                      <p className="text-xs text-slate-600 mt-0.5">{role.desc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRecruitCategory(role.category)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-medium text-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      去市场私聊筛选
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Right Slide-in Drawer: Mount Private Agent & Optional Market Listing */}
      {drawerOpen && (
        <aside className="fixed inset-y-0 right-0 z-40 lg:static lg:z-auto w-full max-w-[440px] lg:w-[430px] shrink-0 border-l border-slate-200 bg-white flex flex-col h-full shadow-2xl lg:shadow-none">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {editingId === 'new' ? '挂载我的私有 Agent 节点' : `配置私有节点 · ${handle}`}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                私有挂载可随时自用；开启对外上架即可同步曝光至专家市场。
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 cursor-pointer"
              aria-label="关闭配置抽屉"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form
            onSubmit={handleSaveDrawer}
            className="flex-1 min-h-0 flex flex-col overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto clean-scroll p-5 space-y-4">
              {/* Public Market Listing Switch */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-slate-900">是否对外上架到专家市场</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    关闭则仅自己私有使用；开启后外部雇主可私聊并按任务租用
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsListedInMarket((v) => !v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    isListedInMarket
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {isListedInMarket ? '上架市场' : '仅私有'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-700">群聊 @ 句柄</span>
                  <input
                    type="text"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    required
                    className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-slate-700">节点名称</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </label>

                <label className="block col-span-2">
                  <span className="text-xs font-medium text-slate-700">一句话专业定位</span>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-slate-700">职能分类</span>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as AgentCategory)}
                    className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  >
                    <option value="product">产品策划</option>
                    <option value="architecture">架构审查</option>
                    <option value="engineering">研发代码</option>
                    <option value="qa">测试质量</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-slate-700">对外服务模式</span>
                  <select
                    value={serviceMode}
                    onChange={(e) => setServiceMode(e.target.value as ServiceMode)}
                    className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  >
                    <option value="pure-agent">纯 Agent 租用</option>
                    <option value="human-agent">人 + Agent 协同</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-slate-700">对外单任务价 (USD)</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="50"
                    value={pricePerTaskUsd}
                    onChange={(e) => setPricePerTaskUsd(Number(e.target.value))}
                    className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-slate-700">节点来源标识</span>
                  <input
                    type="text"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </label>
              </div>

              {/* Capability Tags */}
              <div>
                <span className="text-xs font-medium text-slate-700">能力标签</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5 mb-2">
                  {skills.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-xs text-slate-800 border border-slate-200"
                    >
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => setSkills((prev) => prev.filter((s) => s !== tag))}
                        className="text-slate-400 hover:text-red-600 cursor-pointer"
                        aria-label={`移除 ${tag}`}
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
                    placeholder="添加技能标签..."
                    className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                  <button
                    type="button"
                    onClick={handleAddSkill}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-800 cursor-pointer whitespace-nowrap"
                  >
                    添加
                  </button>
                </div>
              </div>

              <label className="block">
                <span className="text-xs font-medium text-slate-700">节点能力与履约简介</span>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </label>

              {aiAdvice && (
                <div className="px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900">
                  AI 优化建议：{aiAdvice}
                </div>
              )}
              {aiError && (
                <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {aiError}
                </div>
              )}

              <button
                type="button"
                onClick={handleAiOptimize}
                disabled={aiOptimizing}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-blue-700 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{aiOptimizing ? 'AI 正在优化...' : 'AI 优化能力简介、标签与定价'}</span>
              </button>
            </div>

            <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
              >
                {isListedInMarket ? '保存并上架到市场' : '保存为私有节点'}
              </button>
            </div>
          </form>
        </aside>
      )}
    </div>
  );
}
