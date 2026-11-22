import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Blocks,
  Check,
  Copy,
  Cpu,
  ExternalLink,
  MessageCircle,
  Send,
  Sparkles,
  Terminal,
  UploadCloud,
  User,
  UserMinus,
  UserPlus,
  Wrench,
  X,
} from 'lucide-react';
import { INITIAL_MARKET_SKILLS } from '../../data/initialData';
import { fetchMarketMatches, type MarketMatchResult } from '../../services/api';
import {
  AGENT_RUNTIME_PRESETS,
  AgentIdentityName,
  EntityAvatar,
  HumanMark,
  displayEntityName,
  evaluateAgentTierRating,
  formatShortRuntime,
} from '../shared/EntityIdentity';
import {
  ToolbarDivider,
  ToolbarDropdown,
  ToolbarPopoverWidget,
  ToolbarSearch,
  ToolbarSegment,
  ViewToolbar,
} from '../shared/ViewToolbar';
import { ZoneSelectorDropdown } from '../shared/ZoneSelectorDropdown';
import type {
  AgentCategory,
  CommunityZone,
  DemandStatus,
  DirectMessage,
  ExpertAgent,
  HumanExpert,
  MarketSkill,
  ProjectWorkspace,
  SkillKind,
} from '../../types/agentnexus';

const DEMAND_COLOR: Record<DemandStatus, string> = {
  供不应求: 'text-amber-700',
  需求旺盛: 'text-blue-700',
  档期充裕: 'text-emerald-700',
};

const CATEGORY_TABS: { id: 'all' | AgentCategory; label: string }[] = [
  { id: 'all', label: '全部类别' },
  { id: 'engineering', label: '研发开发' },
  { id: 'design', label: '设计体验' },
  { id: 'product', label: '产品策划' },
  { id: 'architecture', label: '架构审查' },
  { id: 'qa', label: '测试质量' },
  { id: 'media', label: '自媒体运营' },
];

const CATEGORY_LABELS: Record<AgentCategory, string> = {
  engineering: '研发开发',
  design: '设计体验',
  product: '产品策划',
  architecture: '架构审查',
  qa: '测试质量',
  media: '自媒体运营',
};

const SKILL_KIND_LABELS: Record<SkillKind, string> = {
  skill: 'Skill',
  mcp: 'MCP',
  workflow: '工作流',
};

const SKILL_KIND_STYLES: Record<SkillKind, string> = {
  skill: 'bg-sky-50 text-sky-700 border-sky-200/80',
  mcp: 'bg-violet-50 text-violet-700 border-violet-200/80',
  workflow: 'bg-amber-50 text-amber-800 border-amber-200/80',
};

interface HumanConsultMessage {
  id: string;
  sender: 'me' | 'human';
  content: string;
  timestamp: string;
}

interface AgentMarketViewProps {
  workspace: ProjectWorkspace;
  workspaces: ProjectWorkspace[];
  zones: CommunityZone[];
  activeZone: CommunityZone;
  onSelectZone: (zoneId: string) => void;
  allAgents: ExpertAgent[];
  agents: ExpertAgent[];
  privateAgents: ExpertAgent[];
  humanExperts: HumanExpert[];
  hiredIds: string[];
  dmHistories: Record<string, DirectMessage[]>;
  dmBusyAgentId: string | null;
  dmError: string | null;
  onClearDmError: () => void;
  onSendDm: (agentId: string, text: string) => Promise<void>;
  onStartNegotiation: (agentId: string) => void;
  onSavePrivateAgent: (expert: ExpertAgent, isNew: boolean) => void;
  categorySeed: 'all' | AgentCategory;
  onClearCategorySeed: () => void;
  onHire: (agentId: string) => void;
  onRelease: (agentId: string) => void;
  onJumpToMountPrivate: () => void;
  onJumpToZoneProjects: (zoneId: string) => void;
}

type MarketEntityTab = 'agents' | 'humans' | 'skills';

type ActiveDrawer =
  | { type: 'agent'; agentId: string; tab: 'consult' | 'profile' }
  | { type: 'human'; humanId: string }
  | { type: 'skill'; skillId: string }
  | null;

function formatInstalls(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

function nowTimeLabel(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function AgentMarketView({
  workspace,
  workspaces,
  zones,
  activeZone,
  onSelectZone,
  allAgents,
  agents,
  privateAgents,
  humanExperts,
  hiredIds,
  dmHistories,
  dmBusyAgentId,
  dmError,
  onClearDmError,
  onSendDm,
  onStartNegotiation,
  onSavePrivateAgent,
  categorySeed,
  onClearCategorySeed,
  onHire,
  onRelease,
  onJumpToMountPrivate,
  onJumpToZoneProjects,
}: AgentMarketViewProps) {
  const [entityTab, setEntityTab] = useState<MarketEntityTab>('agents');
  const [ownerFilterId, setOwnerFilterId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'all' | AgentCategory>('all');
  const [runtimeFilter, setRuntimeFilter] = useState<string>('all');
  const [skillKindFilter, setSkillKindFilter] = useState<'all' | SkillKind>('all');
  const [keyword, setKeyword] = useState('');

  // AI Match Popover
  const [aiQuery, setAiQuery] = useState('');
  const [aiPopoverOpen, setAiPopoverOpen] = useState(false);
  const [aiMatching, setAiMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<MarketMatchResult | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);

  // Unified Slide-in Drawer (Agent Consultation / Human Negotiation / Skill Detail)
  const [activeDrawer, setActiveDrawer] = useState<ActiveDrawer>(null);
  const [dmDraft, setDmDraft] = useState('');
  const [humanDraft, setHumanDraft] = useState('');
  const [humanChatMap, setHumanChatMap] = useState<Record<string, HumanConsultMessage[]>>({});
  const [copiedSkillId, setCopiedSkillId] = useState<string | null>(null);
  const [mountedSkillMap, setMountedSkillMap] = useState<Record<string, string[]>>({});
  const [selectedMountAgentId, setSelectedMountAgentId] = useState<string>(
    privateAgents[0]?.id || '',
  );
  const dmEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!selectedMountAgentId && privateAgents[0]?.id) {
      setSelectedMountAgentId(privateAgents[0].id);
    }
  }, [privateAgents, selectedMountAgentId]);

  // IDs of all Agents already in the user's AGN team (private OR hired in any project)
  const myTeamAgentIds = useMemo(() => {
    const ids = new Set<string>();
    allAgents.forEach((a) => {
      if (a.ownership === 'private') ids.add(a.id);
    });
    workspaces.forEach((w) => {
      w.hiredAgentIds.forEach((id) => ids.add(id));
    });
    return ids;
  }, [allAgents, workspaces]);

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

  const ownerAgentCountMap = useMemo(() => {
    const map = new Map<string, number>();
    allAgents.forEach((a) => {
      if (a.ownerHumanId && a.isListedInMarket) {
        map.set(a.ownerHumanId, (map.get(a.ownerHumanId) || 0) + 1);
      }
    });
    return map;
  }, [allAgents]);

  const availableRuntimes = useMemo(() => {
    const present = new Set<string>(agents.map((a) => a.runtimeAgent));
    const ordered = AGENT_RUNTIME_PRESETS.filter((p) => present.has(p.id)).map((p) => ({
      id: p.id,
      label: `${p.shortCode} (${p.label})`,
    }));
    return [{ id: 'all', label: '全部底座' }, ...ordered];
  }, [agents]);

  const zoneHumansAllCount = useMemo(
    () =>
      humanExperts.filter(
        (human) =>
          human.zoneIds.includes(activeZone.id) ||
          agents.some((a) => a.ownerHumanId === human.id),
      ).length,
    [activeZone.id, agents, humanExperts],
  );

  const zoneSkillsAll = useMemo(
    () => INITIAL_MARKET_SKILLS.filter((sk) => sk.zoneIds.includes(activeZone.id)),
    [activeZone.id],
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
        const inZone = human.zoneIds.includes(activeZone.id) || ownedInZone.length > 0;
        if (!inZone) return false;
        if (categoryFilter !== 'all' && human.category !== categoryFilter) return false;
        if (!q) return true;
        const haystack = [
          human.name,
          human.title,
          CATEGORY_LABELS[human.category],
          human.bio,
          ...human.specialties,
          ...ownedInZone.map((a) => `${displayEntityName(a.handle)} ${a.name} ${a.runtimeAgent}`),
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
      if (runtimeFilter !== 'all' && agent.runtimeAgent !== runtimeFilter) return false;
      if (!q) return true;
      const haystack = [
        displayEntityName(agent.handle),
        agent.name,
        agent.title,
        agent.runtimeAgent,
        formatShortRuntime(agent.runtimeAgent),
        agent.defaultModel,
        agent.ownerHumanName || '',
        ...agent.skills,
        ...agent.mcpTools,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [agents, categoryFilter, keyword, ownerFilterId, runtimeFilter]);

  const filteredSkills = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return zoneSkillsAll.filter((sk) => {
      if (categoryFilter !== 'all' && sk.category !== categoryFilter) return false;
      if (skillKindFilter !== 'all' && sk.kind !== skillKindFilter) return false;
      if (!q) return true;
      const haystack = [
        sk.name,
        sk.slug,
        sk.summary,
        sk.authorName,
        SKILL_KIND_LABELS[sk.kind],
        CATEGORY_LABELS[sk.category],
        ...sk.compatibleRuntimes,
        ...sk.highlights,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [categoryFilter, keyword, skillKindFilter, zoneSkillsAll]);

  const drawerAgent = useMemo(() => {
    if (activeDrawer?.type !== 'agent') return null;
    return allAgents.find((a) => a.id === activeDrawer.agentId) ?? null;
  }, [activeDrawer, allAgents]);

  const drawerHuman = useMemo(() => {
    if (activeDrawer?.type !== 'human') return null;
    return humanExperts.find((h) => h.id === activeDrawer.humanId) ?? null;
  }, [activeDrawer, humanExperts]);

  const drawerSkill = useMemo(() => {
    if (activeDrawer?.type !== 'skill') return null;
    return INITIAL_MARKET_SKILLS.find((s) => s.id === activeDrawer.skillId) ?? null;
  }, [activeDrawer]);

  const matchMap = useMemo(() => {
    const map = new Map<string, string>();
    matchResult?.matches.forEach((m) => map.set(m.agentId, m.reason));
    return map;
  }, [matchResult]);

  const activeDmList = drawerAgent ? dmHistories[drawerAgent.id] || [] : [];
  const isDmBusy = Boolean(drawerAgent && dmBusyAgentId === drawerAgent.id);

  useEffect(() => {
    dmEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeDmList.length, isDmBusy, activeDrawer, humanChatMap]);

  const openAgentDrawer = (agentId: string, tab: 'consult' | 'profile') => {
    setActiveDrawer({ type: 'agent', agentId, tab });
    onClearDmError();
  };

  const openHumanDrawer = (humanId: string) => {
    setActiveDrawer({ type: 'human', humanId });
  };

  const openSkillDrawer = (skillId: string) => {
    setActiveDrawer({ type: 'skill', skillId });
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

  const handleSendHumanMessage = (human: HumanExpert, textInput?: string) => {
    const cleaned = (textInput ?? humanDraft).trim();
    if (!cleaned) return;
    if (!textInput) setHumanDraft('');

    const ownedAgents = allAgents.filter(
      (a) => a.ownerHumanId === human.id && a.isListedInMarket,
    );
    const ownedListText =
      ownedAgents.length > 0
        ? ownedAgents
            .slice(0, 2)
            .map((a) => `${formatShortRuntime(a.runtimeAgent)}-${displayEntityName(a.handle)}`)
            .join('、')
        : '定制化 Agent 节点';

    const userMsg: HumanConsultMessage = {
      id: `hm_${Date.now()}_u`,
      sender: 'me',
      content: cleaned,
      timestamp: nowTimeLabel(),
    };
    const replyMsg: HumanConsultMessage = {
      id: `hm_${Date.now() + 1}_h`,
      sender: 'human',
      content: `收到你的需求！针对「${workspace.name}」，我通常需要先了解你的目标交付边界与周期，再评估由我本人把关还是搭配旗下 ${ownedListText} 协同执行。方便发一下核心功能清单或期望上线时间吗？评估完我会给你一份清晰的里程碑方案与项目报价。`,
      timestamp: nowTimeLabel(),
    };

    setHumanChatMap((prev) => ({
      ...prev,
      [human.id]: [...(prev[human.id] || []), userMsg, replyMsg],
    }));
  };

  const handleCopyInstallCmd = (skill: MarketSkill) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(skill.installCommand).catch(() => {});
    }
    setCopiedSkillId(skill.id);
    window.setTimeout(() => {
      setCopiedSkillId((prev) => (prev === skill.id ? null : prev));
    }, 1800);
  };

  const handleMountSkillToPrivateAgent = (skill: MarketSkill, targetAgentId: string) => {
    const target = privateAgents.find((a) => a.id === targetAgentId);
    if (!target) return;

    const updatedSkills = target.skills.includes(skill.name)
      ? target.skills
      : [...target.skills, skill.name];
    const mcpLabel = skill.slug.split('/')[1] || skill.slug;
    const updatedMcp =
      skill.kind === 'mcp' && !target.mcpTools.includes(mcpLabel)
        ? [...target.mcpTools, mcpLabel]
        : target.mcpTools;

    onSavePrivateAgent(
      {
        ...target,
        skills: updatedSkills,
        mcpTools: updatedMcp,
      },
      false,
    );

    setMountedSkillMap((prev) => {
      const existing = prev[skill.id] || [];
      if (existing.includes(target.id)) return prev;
      return { ...prev, [skill.id]: [...existing, target.id] };
    });
  };

  const quickAgentConsultQuestions = drawerAgent
    ? [
        `你好${drawerAgent.ownerHumanName ? ` ${drawerAgent.ownerHumanName}` : ''}，我想咨询 ${formatShortRuntime(drawerAgent.runtimeAgent)}-${displayEntityName(drawerAgent.handle)} 在「${workspace.name}」场景下的适配度与排期。`,
        `我们项目范围比较明确，请问针对当前需求如何做项目评估与报价？`,
        `想了解一下该 Agent 挂载的 MCP 工具链与交付验收方式。`,
      ]
    : [];

  const quickHumanConsultQuestions = drawerHuman
    ? [
        `你好 ${drawerHuman.name}，我们正在推进「${workspace.name}」，想咨询你的档期与协作方式。`,
        `麻烦结合你的经验，评估一下是否需要搭配你旗下的 Agent 一起交付？`,
        `如果按里程碑验收，一般前期需求评估和报价流程是怎样的？`,
      ]
    : [];

  const hasActiveSubStrip = Boolean(activeOwnerFilter || matchResult || matchError);

  return (
    <div className="h-full flex min-h-0 bg-white relative">
      {/* Main Service Market Directory */}
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
                  const agentCount = allAgents.filter((a) => a.listedZoneIds.includes(z.id)).length;
                  const skillCount = INITIAL_MARKET_SKILLS.filter((s) =>
                    s.zoneIds.includes(z.id),
                  ).length;
                  return `${agentCount} Agent · ${skillCount} Skills`;
                }}
              />

              <ToolbarDivider />

              <ToolbarSegment
                value={entityTab}
                onChange={(next) => {
                  setEntityTab(next);
                  if (next !== 'agents') setOwnerFilterId(null);
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
                  {
                    id: 'skills',
                    label: 'Skills',
                    count: zoneSkillsAll.length,
                    icon: <Blocks className="w-3.5 h-3.5 text-amber-600 shrink-0" />,
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
                  label="底座"
                  value={runtimeFilter}
                  defaultValue="all"
                  onChange={setRuntimeFilter}
                  options={availableRuntimes}
                />
              )}

              {entityTab === 'skills' && (
                <ToolbarDropdown
                  label="类型"
                  value={skillKindFilter}
                  defaultValue="all"
                  onChange={setSkillKindFilter}
                  options={[
                    { id: 'all', label: '全部类型' },
                    { id: 'skill', label: 'Prompt Skill' },
                    { id: 'mcp', label: 'MCP Server' },
                    { id: 'workflow', label: '工作流套件' },
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
                    ? '搜索专家、专长、领域...'
                    : entityTab === 'skills'
                      ? '搜索 Skill、MCP、适配底座...'
                      : '搜索 Agent、底座(CC/Codex/Qoder)、MCP...'
                }
              />

              <ToolbarPopoverWidget
                open={aiPopoverOpen}
                onOpenChange={setAiPopoverOpen}
                triggerLabel="AI 选型"
                triggerIcon={<Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                activeHighlight={Boolean(matchResult)}
              >
                <form onSubmit={handleAiMatch} className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 inline-flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      <span>AI 服务选型顾问 · {activeZone.name}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setAiPopoverOpen(false)}
                      className="text-slate-400 hover:text-slate-700 cursor-pointer"
                      aria-label="关闭 AI 选型弹窗"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    描述你的项目场景与技术难点，自动推荐最匹配的 Agent 底座组合并生成询价参考。
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
                      {aiMatching ? '匹配中...' : '智能推荐服务'}
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
                <span>发布上架</span>
              </button>
            </>
          }
          subStrip={
            hasActiveSubStrip ? (
              <div className="space-y-2">
                {activeOwnerFilter && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium">
                      <span>主理人：{activeOwnerFilter.name}</span>
                      <button
                        type="button"
                        onClick={() => setOwnerFilterId(null)}
                        className="text-emerald-600 hover:text-emerald-900 cursor-pointer"
                        aria-label="清除主理人筛选"
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
                        <span>AI 服务组合推荐</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-blue-700 font-normal">
                          具体费用需结合项目范围向主理人询价评估
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

        {/* Scrollable Service Market Canvas */}
        <div className="flex-1 min-h-0 overflow-y-auto clean-scroll bg-slate-50/70">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 py-5 space-y-4">
            {/* Context Hint Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              {entityTab === 'agents' && (
                <>
                  <span>
                    带技能与 MCP 工具链的专项 Agent（按底座、能力等级与成本指数评估，项目报价请向主理人询价）
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    能力 S/A+/A · 成本指数 H/M/L（非 Token）
                  </span>
                </>
              )}
              {entityTab === 'humans' && (
                <>
                  <span>
                    社区认证真人专家与 Agent 主理人，支持 1v1 私聊与项目需求协商
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    共 {zoneHumans.length} 位专家
                  </span>
                </>
              )}
              {entityTab === 'skills' && (
                <>
                  <span>
                    面向 Claude Code / Codex / Qoder / Gemini 等底座的可复用 Skills、MCP Server 与工作流套件
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    共 {filteredSkills.length} 个能力包
                  </span>
                </>
              )}
            </div>

            {/* TAB 1: AGENT SERVICE CATALOG */}
            {entityTab === 'agents' && (
              <div
                className={`grid gap-4 ${
                  activeDrawer
                    ? 'grid-cols-1 md:grid-cols-2'
                    : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
                }`}
              >
                {filteredAgents.length === 0 ? (
                  <div className="col-span-full py-12 text-center border border-dashed border-slate-300 rounded-xl bg-white">
                    <p className="text-sm font-medium text-slate-700">没有符合筛选条件的 Agent 服务</p>
                    <button
                      type="button"
                      onClick={() => {
                        setCategoryFilter('all');
                        setRuntimeFilter('all');
                        setOwnerFilterId(null);
                        setKeyword('');
                      }}
                      className="mt-3 px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-800 cursor-pointer"
                    >
                      重置筛选
                    </button>
                  </div>
                ) : (
                  filteredAgents.map((agent) => {
                    const isInMyTeam = myTeamAgentIds.has(agent.id);
                    const isHiredInCurrent = hiredIds.includes(agent.id);
                    const aiReason = matchMap.get(agent.id);
                    const isSelected =
                      activeDrawer?.type === 'agent' && activeDrawer.agentId === agent.id;
                    const dmCount = (dmHistories[agent.id] || []).length;
                    const ownerTotalCount = agent.ownerHumanId
                      ? ownerAgentCountMap.get(agent.ownerHumanId) || 1
                      : 0;
                    const rating = evaluateAgentTierRating({
                      runtimeAgent: agent.runtimeAgent,
                      defaultModel: agent.defaultModel,
                      capabilityTier: agent.performance.capabilityTier,
                      ownership: agent.ownership,
                      projectPriceUsd: agent.projectPriceUsd,
                    });

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
                          {/* Top Row: Identity + Capability/Cost Index (NO raw price) */}
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="flex items-center gap-3 min-w-0">
                              <EntityAvatar
                                kind="agent"
                                code={agent.avatarCode}
                                accent={agent.avatarAccent}
                                size="lg"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <h3 className="text-sm font-bold text-slate-900 min-w-0 flex">
                                    <AgentIdentityName
                                      name={agent.handle}
                                      runtime={agent.runtimeAgent}
                                      model={agent.defaultModel}
                                      showModel
                                    />
                                  </h3>
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500">
                                  <span>{CATEGORY_LABELS[agent.category]}</span>
                                  <span className="text-slate-300">·</span>
                                  <span className="font-mono text-slate-600">
                                    底座 {agent.runtimeAgent}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Capability Grade / Non-Token Cost Index */}
                            <div
                              className="text-right shrink-0"
                              title={`能力等级 ${rating.capability}（${rating.capabilityLabel}）· ${rating.costIndexLabel}（非 Token 计费，具体项目报价请向主理人询价）`}
                            >
                              <div className="inline-flex items-center gap-1 font-mono tabular-nums">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[11px] font-bold leading-none ${
                                    rating.capability === 'S'
                                      ? 'bg-violet-50 text-violet-700 border border-violet-200/80'
                                      : rating.capability === 'A+'
                                        ? 'bg-blue-50 text-blue-700 border border-blue-200/80'
                                        : 'bg-slate-100 text-slate-700 border border-slate-200/80'
                                  }`}
                                >
                                  {rating.capability}
                                </span>
                                <span className="text-slate-300 text-xs">/</span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[11px] font-bold leading-none ${
                                    rating.cost === 'H'
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200/80'
                                      : rating.cost === 'M'
                                        ? 'bg-sky-50 text-sky-700 border border-sky-200/80'
                                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                                  }`}
                                >
                                  {rating.cost}
                                </span>
                              </div>
                              <div className="text-[10px] mt-1 whitespace-nowrap">
                                <span className={`font-semibold ${DEMAND_COLOR[agent.performance.demandStatus]}`}>
                                  {agent.performance.demandStatus}
                                </span>
                              </div>
                            </div>
                          </div>

                          <p className="text-xs text-slate-600 mt-2.5 line-clamp-2 leading-relaxed">
                            {agent.title}
                          </p>

                          {/* Principal (主理人) Attribution Bar */}
                          {agent.ownerHumanName && (
                            <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5">
                              <span className="inline-flex items-center gap-1.5 text-slate-600 truncate">
                                <User className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span>
                                  主理人：
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
                                  旗下 {ownerTotalCount} 个
                                </button>
                              )}
                            </div>
                          )}

                          {aiReason && (
                            <p className="mt-2.5 text-xs text-blue-900 bg-blue-100/70 rounded-lg px-2.5 py-1.5 leading-relaxed">
                              AI 推荐：{aiReason}
                            </p>
                          )}

                          {/* Skills & MCP Toolchain */}
                          <div className="mt-3 space-y-1.5 text-[11px]">
                            <div className="text-slate-700 truncate" title={agent.skills.join(' · ')}>
                              <span className="text-slate-400 mr-1.5">技能</span>
                              {agent.skills.slice(0, 3).join(' · ')}
                            </div>
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="text-slate-400 mr-0.5 inline-flex items-center gap-0.5">
                                <Wrench className="w-3 h-3" />
                                <span>MCP</span>
                              </span>
                              {agent.mcpTools.map((tool) => (
                                <span
                                  key={tool}
                                  className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]"
                                >
                                  {tool}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Reputation & Track Record */}
                          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] text-slate-500 font-mono tabular-nums">
                            <span>
                              信誉 {agent.performance.reputationScore} · 复购{' '}
                              {agent.performance.repeatHireRate}%
                            </span>
                            <span>
                              {agent.performance.completedProjects} 交付 · 评分{' '}
                              {agent.performance.rating.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* Footer Actions: Strictly NO direct "拉入群" unless already in my AGN team */}
                        <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => openAgentDrawer(agent.id, 'profile')}
                            className="text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer whitespace-nowrap"
                          >
                            查看详情
                          </button>

                          {isInMyTeam ? (
                            <div className="flex items-center gap-1.5">
                              {isHiredInCurrent ? (
                                <>
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 whitespace-nowrap">
                                    <Check className="w-3.5 h-3.5" />
                                    已在当前群
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => onRelease(agent.id)}
                                    title="移出当前项目群"
                                    className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                                  >
                                    <UserMinus className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onHire(agent.id)}
                                  title="该 Agent 已在你的团队中，可直接拉入当前项目群"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap cursor-pointer"
                                >
                                  <UserPlus className="w-3.5 h-3.5" />
                                  <span>拉入当前群</span>
                                </button>
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openAgentDrawer(agent.id, 'consult')}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white whitespace-nowrap cursor-pointer"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>{dmCount > 0 ? `咨询/询价 (${dmCount})` : '咨询 / 询价'}</span>
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            )}

            {/* TAB 2: HUMAN EXPERTS (PRINCIPALS) */}
            {entityTab === 'humans' && (
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
                    const humanMsgCount = (humanChatMap[human.id] || []).length;
                    const isSelected =
                      activeDrawer?.type === 'human' && activeDrawer.humanId === human.id;

                    return (
                      <article
                        key={human.id}
                        className={`rounded-xl border p-5 flex flex-col justify-between space-y-4 transition-colors ${
                          isSelected
                            ? 'bg-slate-50 border-slate-400'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div>
                          {/* Human Expert Header */}
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
                                <span>主理旗下 Agent（{displayAgents.length} 个）</span>
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
                                  在 Agent 市场查看 →
                                </button>
                              )}
                            </div>

                            {displayAgents.length === 0 ? (
                              <p className="text-xs text-slate-400 py-2">
                                暂未将名下 Agent 上架至当前社区服务市场
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {displayAgents.map((ag) => {
                                  const agInTeam = myTeamAgentIds.has(ag.id);
                                  const agHiredInCurrent = hiredIds.includes(ag.id);
                                  const agRating = evaluateAgentTierRating({
                                    runtimeAgent: ag.runtimeAgent,
                                    defaultModel: ag.defaultModel,
                                    capabilityTier: ag.performance.capabilityTier,
                                    ownership: ag.ownership,
                                    projectPriceUsd: ag.projectPriceUsd,
                                  });

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
                                            <AgentIdentityName
                                              name={ag.handle}
                                              runtime={ag.runtimeAgent}
                                              model={ag.defaultModel}
                                              showModel
                                              className="text-xs font-bold text-slate-900"
                                            />
                                          </div>
                                          <div className="text-[11px] text-slate-500 truncate mt-0.5 flex items-center gap-1.5">
                                            <span className="font-mono font-semibold text-slate-700">
                                              评级 {agRating.code}
                                            </span>
                                            <span className="text-slate-300">·</span>
                                            <span>{ag.mcpTools.length} MCP</span>
                                            <span className="text-slate-300">·</span>
                                            <span>{ag.performance.demandStatus}</span>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => openAgentDrawer(ag.id, 'profile')}
                                          className="px-2 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-medium text-slate-600 cursor-pointer whitespace-nowrap"
                                        >
                                          查看
                                        </button>
                                        {agInTeam ? (
                                          agHiredInCurrent ? (
                                            <span className="inline-flex items-center gap-0.5 px-2 py-1 text-[11px] font-semibold text-emerald-700 whitespace-nowrap">
                                              <Check className="w-3 h-3" />
                                              已在群
                                            </span>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => onHire(ag.id)}
                                              className="px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-[11px] font-semibold text-white cursor-pointer whitespace-nowrap"
                                            >
                                              拉入群
                                            </button>
                                          )
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => openAgentDrawer(ag.id, 'consult')}
                                            className="px-2 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-white cursor-pointer whitespace-nowrap"
                                          >
                                            询价
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

                        {/* Human Expert Card Footer: Strictly Private Chat / Negotiation */}
                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-400">
                            {human.isCurrentUser
                              ? '你的公开主理人名片'
                              : '支持项目方案评估与 1v1 档期协商'}
                          </span>
                          {human.isCurrentUser ? (
                            <button
                              type="button"
                              onClick={onJumpToMountPrivate}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer whitespace-nowrap"
                            >
                              <UploadCloud className="w-3.5 h-3.5" />
                              <span>管理上架 Agent</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openHumanDrawer(human.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>
                                {humanMsgCount > 0 ? `私聊 / 协商 (${humanMsgCount})` : '私聊 / 协商'}
                              </span>
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            )}

            {/* TAB 3: SKILLS & MCP MARKETPLACE */}
            {entityTab === 'skills' && (
              <div
                className={`grid gap-4 ${
                  activeDrawer
                    ? 'grid-cols-1 md:grid-cols-2'
                    : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
                }`}
              >
                {filteredSkills.length === 0 ? (
                  <div className="col-span-full py-12 text-center border border-dashed border-slate-300 rounded-xl bg-white">
                    <p className="text-sm font-medium text-slate-700">没有符合筛选条件的 Skills / MCP</p>
                    <button
                      type="button"
                      onClick={() => {
                        setCategoryFilter('all');
                        setSkillKindFilter('all');
                        setKeyword('');
                      }}
                      className="mt-3 px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-800 cursor-pointer"
                    >
                      重置筛选
                    </button>
                  </div>
                ) : (
                  filteredSkills.map((skill) => {
                    const isSelected =
                      activeDrawer?.type === 'skill' && activeDrawer.skillId === skill.id;
                    const mountedCount = (mountedSkillMap[skill.id] || []).length;

                    return (
                      <article
                        key={skill.id}
                        className={`rounded-xl p-4 flex flex-col justify-between transition-colors border ${
                          isSelected
                            ? 'bg-slate-50 border-slate-400'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`px-1.5 py-0.5 rounded border text-[10px] font-mono font-semibold leading-none ${SKILL_KIND_STYLES[skill.kind]}`}
                                >
                                  {SKILL_KIND_LABELS[skill.kind]}
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  {CATEGORY_LABELS[skill.category]}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400">
                                  {skill.version}
                                </span>
                              </div>
                              <h3 className="text-sm font-bold text-slate-900 mt-1.5 leading-snug">
                                {skill.name}
                              </h3>
                              <div className="text-[11px] font-mono text-slate-500 mt-0.5 truncate">
                                {skill.slug}
                              </div>
                            </div>

                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-medium whitespace-nowrap shrink-0">
                              {skill.license}
                            </span>
                          </div>

                          <p className="text-xs text-slate-600 mt-2.5 line-clamp-2 leading-relaxed">
                            {skill.summary}
                          </p>

                          {/* Compatible Agent Bases */}
                          <div className="mt-3 flex items-center gap-1 flex-wrap">
                            <span className="text-[11px] text-slate-400 mr-0.5">适配底座</span>
                            {skill.compatibleRuntimes.map((rt) => (
                              <span
                                key={rt}
                                className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-medium"
                              >
                                {formatShortRuntime(rt)}
                              </span>
                            ))}
                          </div>

                          {/* Author & Usage Metrics */}
                          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                            <span className="truncate">作者：{skill.authorName}</span>
                            <span className="font-mono tabular-nums shrink-0">
                              {formatInstalls(skill.installs)} 安装 · ★ {skill.rating.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => openSkillDrawer(skill.id)}
                            className="text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer whitespace-nowrap"
                          >
                            查看文档 / 命令行
                          </button>

                          {mountedCount > 0 ? (
                            <button
                              type="button"
                              onClick={() => openSkillDrawer(skill.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold cursor-pointer whitespace-nowrap"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>已装配 ({mountedCount})</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openSkillDrawer(skill.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                            >
                              <Blocks className="w-3.5 h-3.5" />
                              <span>装配到 Agent</span>
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

      {/* RIGHT SLIDE-IN DRAWER A: AGENT CONSULTATION (TO PRINCIPAL) & PROFILE */}
      {drawerAgent && activeDrawer?.type === 'agent' && (() => {
        const isInMyTeam = myTeamAgentIds.has(drawerAgent.id);
        const isHiredInCurrent = hiredIds.includes(drawerAgent.id);
        const rating = evaluateAgentTierRating({
          runtimeAgent: drawerAgent.runtimeAgent,
          defaultModel: drawerAgent.defaultModel,
          capabilityTier: drawerAgent.performance.capabilityTier,
          ownership: drawerAgent.ownership,
          projectPriceUsd: drawerAgent.projectPriceUsd,
        });

        return (
          <aside className="fixed inset-y-0 right-0 z-40 lg:static lg:z-auto w-full max-w-[430px] lg:w-[420px] shrink-0 border-l border-slate-200 bg-white flex flex-col h-full shadow-2xl lg:shadow-none">
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
                    <h2 className="text-sm font-bold text-slate-900 min-w-0 flex">
                      <AgentIdentityName
                        name={drawerAgent.handle}
                        runtime={drawerAgent.runtimeAgent}
                        model={drawerAgent.defaultModel}
                        showModel
                      />
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {drawerAgent.ownerHumanName
                        ? `主理人：${drawerAgent.ownerHumanName} · `
                        : ''}
                      底座 {drawerAgent.runtimeAgent} · 评级 {rating.code}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveDrawer(null)}
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
                  onClick={() =>
                    setActiveDrawer({ type: 'agent', agentId: drawerAgent.id, tab: 'consult' })
                  }
                  className={`py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    activeDrawer.tab === 'consult'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  咨询主理人 / 询价
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActiveDrawer({ type: 'agent', agentId: drawerAgent.id, tab: 'profile' })
                  }
                  className={`py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    activeDrawer.tab === 'profile'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  底座能力与履历
                </button>
              </div>
            </div>

            {activeDrawer.tab === 'consult' ? (
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="px-4 py-2 bg-blue-50/70 border-b border-blue-100 text-[11px] text-blue-900 flex items-center justify-between gap-2">
                  <span>
                    当前对接主理人 <strong>{drawerAgent.ownerHumanName || '官方服务主理人'}</strong>，按项目范围评估报价
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto clean-scroll p-4 space-y-3.5 bg-slate-50/40">
                  <div className="flex flex-col items-start">
                    <span className="text-[11px] text-slate-500 mb-1 inline-flex items-center gap-1.5">
                      <span className="font-semibold text-slate-700">
                        {drawerAgent.ownerHumanName || displayEntityName(drawerAgent.handle)}
                      </span>
                      <span>· 主理人接待</span>
                    </span>
                    <div className="rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 leading-relaxed max-w-[92%]">
                      你好！我是 {formatShortRuntime(drawerAgent.runtimeAgent)}-
                      {displayEntityName(drawerAgent.handle)} 的主理人
                      {drawerAgent.ownerHumanName ? ` ${drawerAgent.ownerHumanName}` : ''}。该
                      Agent 运行在 {drawerAgent.runtimeAgent}（{drawerAgent.defaultModel}）底座上，
                      综合评级 {rating.code}（{rating.description}）。具体费用需结合「{workspace.name}」的交付范围与周期做市场评估，欢迎直接说明需求询价。
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
                          {isEmployer
                            ? '我'
                            : drawerAgent.ownerHumanName || displayEntityName(drawerAgent.handle)}{' '}
                          · {m.timestamp}
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
                      主理人正在结合项目范围组织回复与评估...
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

                {/* Quick Consult Prompts + Composer */}
                <div className="p-3.5 border-t border-slate-200 bg-white space-y-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {quickAgentConsultQuestions.map((q, idx) => (
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
                      placeholder={`向主理人 ${drawerAgent.ownerHumanName || ''} 咨询能力或发起项目询价...`}
                      className="flex-1 min-w-0 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-600/20"
                    />
                    <button
                      type="submit"
                      disabled={isDmBusy || !dmDraft.trim()}
                      className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer disabled:opacity-45 shrink-0"
                      aria-label="发送咨询"
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
                    <div className="text-[11px] text-slate-500">能力等级 / 成本指数</div>
                    <div className="text-sm font-bold text-slate-900 mt-0.5 font-mono tabular-nums">
                      {rating.code}（{rating.capabilityLabel.slice(0, 2)} · {rating.costLabel}）
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">底座与默认模型</div>
                    <div className="text-xs font-semibold font-mono text-slate-900 mt-1">
                      {drawerAgent.runtimeAgent} · {drawerAgent.defaultModel}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">历史交付 / 复购率</div>
                    <div className="text-sm font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                      {drawerAgent.performance.completedProjects} 个 ·{' '}
                      {drawerAgent.performance.repeatHireRate}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">当前档期与信誉</div>
                    <div
                      className={`text-xs font-semibold mt-1 ${DEMAND_COLOR[drawerAgent.performance.demandStatus]}`}
                    >
                      {drawerAgent.performance.demandStatus} · 信誉{' '}
                      {drawerAgent.performance.reputationScore}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-800 mb-1">报价评估机制</div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    服务市场不设一口价：费用由具体项目需求复杂度、交付周期及市场供需综合评估。点击下方「进入对话协商」与主理人{' '}
                    <strong className="text-slate-900">
                      {drawerAgent.ownerHumanName || '服务主理人'}
                    </strong>{' '}
                    沟通获取正式报价。
                  </p>
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-800 mb-1.5">内置核心技能</div>
                  <div className="flex flex-wrap gap-1.5">
                    {drawerAgent.skills.map((sk) => (
                      <span
                        key={sk}
                        className="px-2 py-1 rounded-md bg-white border border-slate-200 text-[11px] text-slate-700"
                      >
                        {sk}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-800 mb-1.5">已装配 MCP 工具链</div>
                  <div className="flex flex-wrap gap-1.5">
                    {drawerAgent.mcpTools.map((tool) => (
                      <span
                        key={tool}
                        className="px-2 py-1 rounded-md bg-slate-100 border border-slate-200/80 text-[11px] font-mono text-slate-800"
                      >
                        {tool}
                      </span>
                    ))}
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
                        <p className="text-xs text-slate-700 mt-1.5 leading-relaxed">
                          “{rev.comment}”
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Sticky Bottom Bar: NO direct 拉入群 for external non-team Agents */}
            <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900">
                  {isInMyTeam ? '已在我的 AGN 团队' : '按项目评估报价'}
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {rating.code} · {rating.costIndexLabel}
                </div>
              </div>

              {isInMyTeam ? (
                isHiredInCurrent ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800 whitespace-nowrap shrink-0">
                    <Check className="w-3.5 h-3.5" />
                    <span>已在当前项目群</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onHire(drawerAgent.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>拉入当前项目群</span>
                  </button>
                )
              ) : (
                <button
                  type="button"
                  onClick={() => onStartNegotiation(drawerAgent.id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer whitespace-nowrap shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>进入正式询价协商</span>
                </button>
              )}
            </div>
          </aside>
        );
      })()}

      {/* RIGHT SLIDE-IN DRAWER B: HUMAN EXPERT PRIVATE CHAT / NEGOTIATION */}
      {drawerHuman && activeDrawer?.type === 'human' && (
        <aside className="fixed inset-y-0 right-0 z-40 lg:static lg:z-auto w-full max-w-[430px] lg:w-[420px] shrink-0 border-l border-slate-200 bg-white flex flex-col h-full shadow-2xl lg:shadow-none">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <EntityAvatar
                kind="human"
                code={drawerHuman.avatarInitials}
                accent={drawerHuman.avatarAccent}
                size="md"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-sm font-bold text-slate-900">{drawerHuman.name}</h2>
                  <HumanMark label="真人专家" />
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate">{drawerHuman.title}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveDrawer(null)}
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 cursor-pointer shrink-0"
              aria-label="关闭专家私聊"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto clean-scroll p-4 space-y-3.5 bg-slate-50/40">
            <div className="flex flex-col items-start">
              <span className="text-[11px] text-slate-500 mb-1">
                {drawerHuman.name} · 1v1 专家私聊协商
              </span>
              <div className="rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 leading-relaxed max-w-[92%]">
                你好！我是 {drawerHuman.name}（{drawerHuman.title}，信誉 {drawerHuman.reputationScore}）。我们可以先私聊对齐你的项目目标、技术边界与期望周期，确认方案后再商定合作方式与旗下 Agent 协同配置。
              </div>
            </div>

            {(humanChatMap[drawerHuman.id] || []).map((msg) => {
              const isMe = msg.sender === 'me';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <span className="text-[11px] text-slate-400 mb-1 font-mono tabular-nums">
                    {isMe ? '我' : drawerHuman.name} · {msg.timestamp}
                  </span>
                  <div
                    className={`rounded-xl px-3.5 py-2.5 text-xs leading-relaxed max-w-[90%] whitespace-pre-wrap ${
                      isMe
                        ? 'bg-slate-900 text-white'
                        : 'bg-white border border-slate-200 text-slate-800'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              );
            })}
            <div ref={dmEndRef} />
          </div>

          <div className="p-3.5 border-t border-slate-200 bg-white space-y-2.5">
            <div className="flex flex-wrap gap-1.5">
              {quickHumanConsultQuestions.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendHumanMessage(drawerHuman, q)}
                  className="text-left text-[11px] text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendHumanMessage(drawerHuman);
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={humanDraft}
                onChange={(e) => setHumanDraft(e.target.value)}
                placeholder={`私聊专家 ${drawerHuman.name}，沟通需求与方案评估...`}
                className="flex-1 min-w-0 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-600/20"
              />
              <button
                type="submit"
                disabled={!humanDraft.trim()}
                className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer disabled:opacity-45 shrink-0"
                aria-label="发送专家私聊"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </aside>
      )}

      {/* RIGHT SLIDE-IN DRAWER C: SKILL / MCP DETAIL & MOUNT TO PRIVATE AGENT */}
      {drawerSkill && activeDrawer?.type === 'skill' && (() => {
        const mountedTargets = mountedSkillMap[drawerSkill.id] || [];
        const targetAgent = privateAgents.find((a) => a.id === selectedMountAgentId);
        const alreadyMountedOnTarget = targetAgent
          ? mountedTargets.includes(targetAgent.id) ||
            targetAgent.skills.includes(drawerSkill.name)
          : false;

        return (
          <aside className="fixed inset-y-0 right-0 z-40 lg:static lg:z-auto w-full max-w-[430px] lg:w-[420px] shrink-0 border-l border-slate-200 bg-white flex flex-col h-full shadow-2xl lg:shadow-none">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`px-1.5 py-0.5 rounded border text-[10px] font-mono font-semibold leading-none ${SKILL_KIND_STYLES[drawerSkill.kind]}`}
                  >
                    {SKILL_KIND_LABELS[drawerSkill.kind]}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    {drawerSkill.version}
                  </span>
                  <span className="text-[11px] text-slate-400">· {drawerSkill.license}</span>
                </div>
                <h2 className="text-sm font-bold text-slate-900 mt-1">{drawerSkill.name}</h2>
                <div className="text-xs font-mono text-slate-500 mt-0.5">{drawerSkill.slug}</div>
              </div>
              <button
                type="button"
                onClick={() => setActiveDrawer(null)}
                className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 cursor-pointer shrink-0"
                aria-label="关闭 Skill 详情"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto clean-scroll p-5 space-y-5 bg-slate-50/40">
              <p className="text-xs text-slate-700 leading-relaxed">{drawerSkill.summary}</p>

              {/* CLI Install Command */}
              <div>
                <div className="text-xs font-semibold text-slate-800 mb-1.5 inline-flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-slate-600" />
                  <span>CLI 安装命令</span>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-900 text-slate-100 px-3 py-2 font-mono text-[11px]">
                  <code className="truncate">{drawerSkill.installCommand}</code>
                  <button
                    type="button"
                    onClick={() => handleCopyInstallCmd(drawerSkill)}
                    className="inline-flex items-center gap-1 text-[11px] text-sky-300 hover:text-white cursor-pointer shrink-0"
                  >
                    {copiedSkillId === drawerSkill.id ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>已复制</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>复制</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Compatible Runtimes & Stats */}
              <div className="grid grid-cols-2 gap-3 py-3.5 border-y border-slate-200 text-xs">
                <div>
                  <div className="text-[11px] text-slate-400">作者 / 维护者</div>
                  <div className="font-semibold text-slate-900 mt-0.5">{drawerSkill.authorName}</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">安装量 / 评分</div>
                  <div className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                    {formatInstalls(drawerSkill.installs)} · ★ {drawerSkill.rating.toFixed(2)}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-[11px] text-slate-400 mb-1.5">适配 Agent 底座</div>
                  <div className="flex flex-wrap gap-1.5">
                    {drawerSkill.compatibleRuntimes.map((rt) => (
                      <span
                        key={rt}
                        className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[11px] font-mono text-slate-700"
                      >
                        {rt}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Capability Highlights */}
              <div>
                <div className="text-xs font-semibold text-slate-800 mb-1.5">核心能力亮点</div>
                <ul className="space-y-1.5 text-xs text-slate-600 list-disc pl-4">
                  {drawerSkill.highlights.map((item, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* SKILL.md / MCP Manifest Preview */}
              <div>
                <div className="text-xs font-semibold text-slate-800 mb-1.5">
                  {drawerSkill.kind === 'mcp' ? 'MCP Manifest 预览' : 'SKILL.md 定义预览'}
                </div>
                <pre className="rounded-lg bg-slate-900 text-slate-200 p-3 text-[11px] font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap">
                  {drawerSkill.readmeSnippet}
                </pre>
              </div>
            </div>

            {/* Sticky Bottom Mount-to-Private-Agent Bar */}
            <div className="p-4 border-t border-slate-200 bg-white space-y-2.5 shrink-0">
              <div className="text-[11px] font-semibold text-slate-700">
                一键装配到我的自建 Agent
              </div>
              {privateAgents.length === 0 ? (
                <button
                  type="button"
                  onClick={onJumpToMountPrivate}
                  className="w-full py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  先前往 AGN 团队创建自建 Agent
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedMountAgentId}
                    onChange={(e) => setSelectedMountAgentId(e.target.value)}
                    aria-label="选择目标自建 Agent"
                    className="flex-1 min-w-0 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  >
                    {privateAgents.map((pa) => (
                      <option key={pa.id} value={pa.id}>
                        {formatShortRuntime(pa.runtimeAgent)}-{displayEntityName(pa.handle)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!targetAgent || alreadyMountedOnTarget}
                    onClick={() =>
                      targetAgent && handleMountSkillToPrivateAgent(drawerSkill, targetAgent.id)
                    }
                    className={`inline-flex items-center gap-1 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-default ${
                      alreadyMountedOnTarget
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                    }`}
                  >
                    {alreadyMountedOnTarget ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>已装配</span>
                      </>
                    ) : (
                      <>
                        <Blocks className="w-3.5 h-3.5" />
                        <span>装配</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </aside>
        );
      })()}
    </div>
  );
}
