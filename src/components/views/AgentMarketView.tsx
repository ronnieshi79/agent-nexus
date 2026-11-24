import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Blocks,
  Briefcase,
  CalendarClock,
  Check,
  Copy,
  Cpu,
  ExternalLink,
  MessageCircle,
  Send,
  ShoppingBag,
  Sparkles,
  Terminal,
  UploadCloud,
  User,
  UserCheck,
  UserMinus,
  UserPlus,
  Wrench,
  X,
} from 'lucide-react';
import { INITIAL_MARKET_SKILLS } from '../../data/initialData';
import { fetchMarketMatches, type MarketMatchResult } from '../../services/api';
import { MarketLeaderboardRail } from '../market/MarketLeaderboardRail';
import {
  AGENT_RUNTIME_PRESETS,
  AgentIdentityName,
  EntityAvatar,
  LEASE_PERIOD_META,
  displayEntityName,
  formatShortRuntime,
  getAgentLeasePricing,
  getSkillPurchasePricing,
} from '../shared/EntityIdentity';
import {
  RailNavButton,
  RailSectionLabel,
  ToolbarDropdown,
  ToolbarPopoverWidget,
  ToolbarSearch,
  ViewToolbar,
  WORKSPACE_GUTTER_CLASS,
  WORKSPACE_MAX_WIDTH_CLASS,
  WorkspacePrimaryRail,
} from '../shared/ViewToolbar';
import type {
  AgentCategory,
  AgentLeaseRecord,
  CommunityZone,
  DemandStatus,
  DirectMessage,
  ExpertAgent,
  ExpertRelationType,
  HumanExpert,
  LeasePeriod,
  MarketSkill,
  ProjectWorkspace,
  SkillKind,
  TeamExpertMembership,
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
  marketSkills?: MarketSkill[];
  agentLeases: Record<string, AgentLeaseRecord>;
  purchasedSkillIds: string[];
  teamExperts: TeamExpertMembership[];
  hiredIds: string[];
  dmHistories: Record<string, DirectMessage[]>;
  dmBusyAgentId: string | null;
  dmError: string | null;
  onClearDmError: () => void;
  onSendDm: (agentId: string, text: string) => Promise<void>;
  onStartNegotiation: (agentId: string) => void;
  onLeaseAgent: (agentId: string, period: LeasePeriod, targetWorkspaceId?: string) => void;
  onAcquireSkill: (skillId: string, skillName?: string, priceUsd?: number) => void;
  onInviteTeamExpert: (input: {
    expertId: string;
    relation: ExpertRelationType;
    targetWorkspaceId?: string;
    sourceZoneId?: string;
    outsourcingScope?: string;
  }) => void;
  onSavePrivateAgent: (expert: ExpertAgent, isNew: boolean) => void;
  categorySeed: 'all' | AgentCategory;
  onClearCategorySeed: () => void;
  onHire: (agentId: string) => void;
  onRelease: (agentId: string) => void;
  onJumpToMountPrivate: () => void;
  onJumpToZoneProjects: (zoneId: string) => void;
  embeddedMode?: boolean;
  controlledEntityTab?: MarketEntityTab;
  onChangeEntityTab?: (tab: MarketEntityTab) => void;
}

export type MarketEntityTab = 'agents' | 'humans' | 'skills';
type MarketSortOption = 'popular' | 'top_rated' | 'price_asc';
type SkillPriceFilter = 'all' | 'free' | 'paid';

type ActiveDrawer =
  | { type: 'agent'; agentId: string; tab: 'lease' | 'consult' | 'profile' }
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
  allAgents,
  agents,
  privateAgents,
  humanExperts,
  marketSkills = INITIAL_MARKET_SKILLS,
  agentLeases,
  purchasedSkillIds,
  teamExperts,
  hiredIds,
  dmHistories,
  dmBusyAgentId,
  dmError,
  onClearDmError,
  onSendDm,
  onStartNegotiation,
  onLeaseAgent,
  onAcquireSkill,
  onInviteTeamExpert,
  onSavePrivateAgent,
  categorySeed,
  onClearCategorySeed,
  onHire,
  onRelease,
  onJumpToMountPrivate,
  onJumpToZoneProjects,
  embeddedMode = false,
  controlledEntityTab,
  onChangeEntityTab,
}: AgentMarketViewProps) {
  const [internalEntityTab, setInternalEntityTab] = useState<MarketEntityTab>(
    controlledEntityTab || 'agents',
  );
  const entityTab = controlledEntityTab ?? internalEntityTab;
  const setEntityTab = (next: MarketEntityTab) => {
    setInternalEntityTab(next);
    onChangeEntityTab?.(next);
  };
  const [ownerFilterId, setOwnerFilterId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'all' | AgentCategory>('all');
  const [runtimeFilter, setRuntimeFilter] = useState<string>('all');
  const [skillKindFilter, setSkillKindFilter] = useState<'all' | SkillKind>('all');
  const [skillPriceFilter, setSkillPriceFilter] = useState<SkillPriceFilter>('all');
  const [sortBy, setSortBy] = useState<MarketSortOption>('popular');
  const [keyword, setKeyword] = useState('');

  // AI Match Popover
  const [aiQuery, setAiQuery] = useState('');
  const [aiPopoverOpen, setAiPopoverOpen] = useState(false);
  const [aiMatching, setAiMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<MarketMatchResult | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);

  // Unified Slide-in Drawer (Agent Lease / Consultation / Human Outsourcing / Skill Detail)
  const [activeDrawer, setActiveDrawer] = useState<ActiveDrawer>(null);
  const [selectedLeasePeriod, setSelectedLeasePeriod] = useState<LeasePeriod>('month');
  const [selectedLeaseWorkspaceId, setSelectedLeaseWorkspaceId] = useState<string>(workspace.id);
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
    setSelectedLeaseWorkspaceId(workspace.id);
  }, [workspace.id]);

  const teamExpertMap = useMemo(() => {
    const map = new Map<string, TeamExpertMembership>();
    teamExperts.forEach((m) => map.set(m.expertId, m));
    return map;
  }, [teamExperts]);

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

  const zoneHumansAll = useMemo(
    () =>
      humanExperts.filter(
        (human) =>
          human.zoneIds.includes(activeZone.id) ||
          agents.some((a) => a.ownerHumanId === human.id),
      ),
    [activeZone.id, agents, humanExperts],
  );

  const zoneHumansAllCount = zoneHumansAll.length;

  const zoneSkillsAll = useMemo(
    () => marketSkills.filter((sk) => sk.zoneIds.includes(activeZone.id)),
    [activeZone.id, marketSkills],
  );

  // Per-category counts for the active entity tab in the left rail
  const categoryCounts = useMemo(() => {
    const counts: Record<'all' | AgentCategory, number> = {
      all: 0,
      engineering: 0,
      design: 0,
      product: 0,
      architecture: 0,
      qa: 0,
      media: 0,
    };
    if (entityTab === 'agents') {
      counts.all = agents.length;
      agents.forEach((a) => {
        counts[a.category] += 1;
      });
    } else if (entityTab === 'humans') {
      counts.all = zoneHumansAll.length;
      zoneHumansAll.forEach((h) => {
        counts[h.category] += 1;
      });
    } else {
      counts.all = zoneSkillsAll.length;
      zoneSkillsAll.forEach((s) => {
        counts[s.category] += 1;
      });
    }
    return counts;
  }, [agents, entityTab, zoneHumansAll, zoneSkillsAll]);

  const zoneHumans = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    const list = humanExperts
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

    return [...list].sort((a, b) => {
      if (sortBy === 'popular') {
        return b.human.completedProjects - a.human.completedProjects;
      }
      if (sortBy === 'top_rated') {
        return b.human.reputationScore - a.human.reputationScore;
      }
      return 0;
    });
  }, [activeZone.id, agents, allAgents, categoryFilter, humanExperts, keyword, sortBy]);

  const activeOwnerFilter = useMemo(
    () => (ownerFilterId ? humanExperts.find((h) => h.id === ownerFilterId) || null : null),
    [humanExperts, ownerFilterId],
  );

  const filteredAgents = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    const list = agents.filter((agent) => {
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

    return [...list].sort((a, b) => {
      if (sortBy === 'popular') {
        return b.performance.completedProjects - a.performance.completedProjects;
      }
      if (sortBy === 'top_rated') {
        return b.performance.rating - a.performance.rating;
      }
      if (sortBy === 'price_asc') {
        const pA = getAgentLeasePricing({
          runtimeAgent: a.runtimeAgent,
          defaultModel: a.defaultModel,
          capabilityTier: a.performance.capabilityTier,
          ownership: a.ownership,
          projectPriceUsd: a.projectPriceUsd,
          monthlyLeaseUsd: a.monthlyLeaseUsd,
        }).monthlyUsd;
        const pB = getAgentLeasePricing({
          runtimeAgent: b.runtimeAgent,
          defaultModel: b.defaultModel,
          capabilityTier: b.performance.capabilityTier,
          ownership: b.ownership,
          projectPriceUsd: b.projectPriceUsd,
          monthlyLeaseUsd: b.monthlyLeaseUsd,
        }).monthlyUsd;
        return pA - pB;
      }
      return 0;
    });
  }, [agents, categoryFilter, keyword, ownerFilterId, runtimeFilter, sortBy]);

  const filteredSkills = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    const list = zoneSkillsAll.filter((sk) => {
      if (categoryFilter !== 'all' && sk.category !== categoryFilter) return false;
      if (skillKindFilter !== 'all' && sk.kind !== skillKindFilter) return false;
      if (skillPriceFilter !== 'all') {
        const pricing = getSkillPurchasePricing(sk);
        if (skillPriceFilter === 'free' && !pricing.isFree) return false;
        if (skillPriceFilter === 'paid' && pricing.isFree) return false;
      }
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

    return [...list].sort((a, b) => {
      if (sortBy === 'popular') return b.installs - a.installs;
      if (sortBy === 'top_rated') return b.rating - a.rating;
      if (sortBy === 'price_asc') {
        return getSkillPurchasePricing(a).priceUsd - getSkillPurchasePricing(b).priceUsd;
      }
      return 0;
    });
  }, [categoryFilter, keyword, skillKindFilter, skillPriceFilter, sortBy, zoneSkillsAll]);

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
    return marketSkills.find((s) => s.id === activeDrawer.skillId) ?? null;
  }, [activeDrawer, marketSkills]);

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

  const openAgentDrawer = (agentId: string, tab: 'lease' | 'consult' | 'profile') => {
    const existingLease = agentLeases[agentId];
    setSelectedLeasePeriod(existingLease?.period || 'month');
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
    <div
      className={`${
        embeddedMode ? 'flex-1 min-w-0' : ''
      } h-full flex min-h-0 bg-white relative @container/shell`}
    >
      {/* FAR-LEFT FULL-HEIGHT PRIMARY NAVIGATION RAIL: Core Service Types Only */}
      {!embeddedMode && (
        <WorkspacePrimaryRail ariaLabel="服务市场导航">
          <div className="space-y-0.5">
            <RailSectionLabel>服务类型</RailSectionLabel>
            {[
              { id: 'agents' as const, label: '专业 Agent', count: agents.length, icon: Cpu, tint: 'text-indigo-500' },
              { id: 'humans' as const, label: '人类专家', count: zoneHumansAllCount, icon: Briefcase, tint: 'text-emerald-600' },
              { id: 'skills' as const, label: 'Skills / MCP', count: zoneSkillsAll.length, icon: Blocks, tint: 'text-amber-600' },
            ].map((item) => {
              const Icon = item.icon;
              const active = entityTab === item.id;
              return (
                <RailNavButton
                  key={item.id}
                  active={active}
                  variant="primary"
                  label={item.label}
                  count={item.count}
                  icon={
                    <Icon
                      className={`w-3.5 h-3.5 shrink-0 ${
                        active ? 'text-sky-300' : item.tint
                      }`}
                    />
                  }
                  onClick={() => {
                    setEntityTab(item.id);
                    if (item.id !== 'agents') setOwnerFilterId(null);
                  }}
                />
              );
            })}
          </div>
        </WorkspacePrimaryRail>
      )}

      {/* RIGHT MAIN WORKSPACE COLUMN: Top Search & Secondary Filters Aligned Flush with Content */}
      <div className="flex-1 min-w-0 flex flex-col h-full min-h-0 @container/view">
        {/* Top Toolbar (Right-Shifted & Flush-Aligned with Content Area Below) */}
        <ViewToolbar
          left={
            <>
              <ToolbarSearch
                value={keyword}
                onChange={setKeyword}
                widthClass="w-full sm:w-56 lg:w-64"
                placeholder={
                  entityTab === 'humans'
                    ? '搜索人类专家、擅长方向...'
                    : entityTab === 'skills'
                      ? '搜索 Skill、MCP、适配底座...'
                      : '搜索 Agent、底座(CC/Codex/Qoder)...'
                }
              />

              <ToolbarDropdown
                label="分类"
                value={categoryFilter}
                defaultValue="all"
                onChange={setCategoryFilter}
                options={CATEGORY_TABS.map((cat) => ({
                  id: cat.id,
                  label: cat.label,
                  hint: `${categoryCounts[cat.id]}`,
                }))}
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
                <>
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
                  <ToolbarDropdown
                    label="价格"
                    value={skillPriceFilter}
                    defaultValue="all"
                    onChange={setSkillPriceFilter}
                    options={[
                      { id: 'all', label: '全部价格' },
                      { id: 'free', label: '免费开源' },
                      { id: 'paid', label: '付费买断' },
                    ]}
                  />
                </>
              )}

              <ToolbarDropdown
                label="排序"
                value={sortBy}
                defaultValue="popular"
                onChange={setSortBy}
                options={
                  entityTab === 'humans'
                    ? [
                        { id: 'popular', label: '最受欢迎' },
                        { id: 'top_rated', label: '好评优先' },
                      ]
                    : [
                        { id: 'popular', label: '最受欢迎' },
                        { id: 'top_rated', label: '好评优先' },
                        { id: 'price_asc', label: '价格从低到高' },
                      ]
                }
              />
            </>
          }
          right={
            <>

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

        {/* Scrollable Content Canvas (Aligned Flush with ViewToolbar Above: 2-Col Catalog + Right Leaderboard) */}
        <div className={`flex-1 min-h-0 overflow-y-auto clean-scroll bg-slate-50/70 ${WORKSPACE_GUTTER_CLASS} py-5`}>
          <div className={`${WORKSPACE_MAX_WIDTH_CLASS} space-y-4`}>
            {/* Compact Narrow Strip (visible only when shell < 760px and standalone) */}
            {!embeddedMode && (
              <div className="@[760px]/shell:hidden space-y-2">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                  {[
                    { id: 'agents' as const, label: '专业 Agent', count: agents.length, icon: Cpu },
                    { id: 'humans' as const, label: '人类专家', count: zoneHumansAllCount, icon: Briefcase },
                    { id: 'skills' as const, label: 'Skills / MCP', count: zoneSkillsAll.length, icon: Blocks },
                  ].map((item) => {
                    const Icon = item.icon;
                    const active = entityTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setEntityTab(item.id);
                          if (item.id !== 'agents') setOwnerFilterId(null);
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer border transition-colors ${
                          active
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span>{item.label}</span>
                        <span className="text-[11px] font-mono opacity-75">{item.count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CENTER 2-COL CATALOG + RIGHT LEADERBOARD */}
            <div className="flex flex-col @[820px]:flex-row gap-4 @[1100px]:gap-5 items-start">
              {/* CENTER COLUMN: 2-Column Service Catalog */}
              <div className="flex-1 min-w-0 w-full space-y-3.5 @container/center">
                  {/* Context Hint Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    {entityTab === 'agents' && (
                      <>
                        <span>
                          专业 Agent 支持按周 / 按月 / 按季度租赁，依据能力评级明码定价
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          共 {filteredAgents.length} 个 · 支持周租/月租/季租(85折)
                        </span>
                      </>
                    )}
                    {entityTab === 'humans' && (
                      <>
                        <span>
                          空间认证人类专家，内建多个专业 Agent，支持方案讨论与项目合作咨询
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          共 {zoneHumans.length} 位人类专家
                        </span>
                      </>
                    )}
                    {entityTab === 'skills' && (
                      <>
                        <span>
                          可复用 Skills、MCP 与工作流套件，支持免费开源或一次性买断永久使用
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          共 {filteredSkills.length} 个 · 已拥有 {purchasedSkillIds.length}
                        </span>
                      </>
                    )}
                  </div>

                  {/* TAB 1: AGENT SERVICE CATALOG (2-Column Grid) */}
                  {entityTab === 'agents' && (
                    <div className="grid grid-cols-1 @[540px]/center:grid-cols-2 gap-4">
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
                    const activeLease = agentLeases[agent.id];
                    const aiReason = matchMap.get(agent.id);
                    const isSelected =
                      activeDrawer?.type === 'agent' && activeDrawer.agentId === agent.id;
                    const dmCount = (dmHistories[agent.id] || []).length;
                    const ownerTotalCount = agent.ownerHumanId
                      ? ownerAgentCountMap.get(agent.ownerHumanId) || 1
                      : 0;
                    const pricing = getAgentLeasePricing({
                      runtimeAgent: agent.runtimeAgent,
                      defaultModel: agent.defaultModel,
                      capabilityTier: agent.performance.capabilityTier,
                      ownership: agent.ownership,
                      projectPriceUsd: agent.projectPriceUsd,
                      monthlyLeaseUsd: agent.monthlyLeaseUsd,
                    });
                    const { rating } = pricing;

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
                          {/* Top Row: Identity + Rating Tier & Transparent Lease Price */}
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
                                    {agent.runtimeAgent}
                                  </span>
                                  <span className="text-slate-300">·</span>
                                  <span
                                    className={`font-mono font-bold ${
                                      rating.capability === 'S'
                                        ? 'text-violet-700'
                                        : rating.capability === 'A+'
                                          ? 'text-blue-700'
                                          : 'text-slate-600'
                                    }`}
                                  >
                                    {rating.capability}级
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Transparent Monthly Lease Pricing */}
                            <div
                              className="text-right shrink-0 font-mono tabular-nums"
                              title={`能力评级 ${rating.capability} · 周租 $${pricing.weeklyUsd} · 月租 $${pricing.monthlyUsd} · 季租 $${pricing.quarterlyUsd}`}
                            >
                              <div className="text-sm font-bold text-slate-900 leading-none">
                                ${pricing.monthlyUsd}
                                <span className="text-[10px] font-sans font-normal text-slate-500">
                                  /月
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 mt-1 whitespace-nowrap">
                                周 ${pricing.weeklyUsd} · 季 ${pricing.quarterlyUsd}
                              </div>
                            </div>
                          </div>

                          <p className="text-xs text-slate-600 mt-2.5 line-clamp-2 leading-relaxed">
                            {agent.title}
                          </p>

                          {/* Active Lease Banner if Leased */}
                          {activeLease && (
                            <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] bg-emerald-50/80 border border-emerald-200/80 text-emerald-800 rounded-lg px-2.5 py-1.5">
                              <span className="inline-flex items-center gap-1.5 font-semibold">
                                <CalendarClock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>已租用 · {activeLease.expiresLabel}</span>
                              </span>
                              <span className="font-mono tabular-nums text-emerald-700">
                                ${activeLease.priceUsd}
                                {LEASE_PERIOD_META[activeLease.period].unitSuffix}
                              </span>
                            </div>
                          )}

                          {/* Principal (所属专家) Attribution Bar */}
                          {agent.ownerHumanName && (
                            <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5">
                              <span className="inline-flex items-center gap-1.5 text-slate-600 truncate">
                                <User className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span>
                                  所属专家：
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
                                  内建 {ownerTotalCount} 个
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
                              <span className={`font-sans font-semibold mr-1.5 ${DEMAND_COLOR[agent.performance.demandStatus]}`}>
                                {agent.performance.demandStatus}
                              </span>
                              ★ {agent.performance.rating.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* Footer Actions: Periodic Leasing + Consult */}
                        <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => openAgentDrawer(agent.id, 'profile')}
                              className="text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer whitespace-nowrap"
                            >
                              详情
                            </button>
                            <button
                              type="button"
                              onClick={() => openAgentDrawer(agent.id, 'consult')}
                              className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-blue-700 cursor-pointer whitespace-nowrap"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>{dmCount > 0 ? `咨询 (${dmCount})` : '咨询'}</span>
                            </button>
                          </div>

                          {activeLease || isInMyTeam ? (
                            <div className="flex items-center gap-1.5">
                              {isHiredInCurrent ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openAgentDrawer(agent.id, 'lease')}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-xs font-semibold text-emerald-800 whitespace-nowrap cursor-pointer"
                                  >
                                    <CalendarClock className="w-3.5 h-3.5" />
                                    <span>{activeLease ? '续租 / 调期' : '已入当前群'}</span>
                                  </button>
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
                                  title="该 Agent 已在你的团队中，可直接派驻当前项目"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap cursor-pointer"
                                >
                                  <UserPlus className="w-3.5 h-3.5" />
                                  <span>派驻当前项目</span>
                                </button>
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openAgentDrawer(agent.id, 'lease')}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white whitespace-nowrap cursor-pointer"
                            >
                              <CalendarClock className="w-3.5 h-3.5" />
                              <span>立即租赁</span>
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            )}

            {/* TAB 2: HUMAN EXPERTS (2-Column Grid) */}
            {entityTab === 'humans' && (
              <div className="grid grid-cols-1 @[540px]/center:grid-cols-2 gap-4">
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
                    const displayAgents = ownedAllListed.length > 0 ? ownedAllListed : ownedInZone;
                    const humanMsgCount = (humanChatMap[human.id] || []).length;
                    const isSelected =
                      activeDrawer?.type === 'human' && activeDrawer.humanId === human.id;
                    const teamMember = teamExpertMap.get(human.id);
                    const expertTier = human.ratingTier || 'A+';

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
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold leading-none ${
                                      expertTier === 'S'
                                        ? 'bg-violet-50 text-violet-700 border border-violet-200/80'
                                        : 'bg-blue-50 text-blue-700 border border-blue-200/80'
                                    }`}
                                  >
                                    {expertTier}级专家
                                  </span>
                                  {human.isCurrentUser && (
                                    <span className="text-[11px] font-semibold text-emerald-700">
                                      · 本人
                                    </span>
                                  )}
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

                          {/* Explicit Specialty Direction & Modes */}
                          <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200/80 px-3 py-2 space-y-1">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900 truncate">
                                <Briefcase className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span className="truncate">
                                  擅长方向：{human.outsourcingDomain || human.specialties[0]}
                                </span>
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span>
                                {(human.outsourcingModes && human.outsourcingModes.length > 0
                                  ? human.outsourcingModes
                                  : ['项目整包交付', '里程碑验收']
                                ).join(' · ')}
                              </span>
                              <span className="text-slate-300">·</span>
                              <span>支持项目外包与协作咨询</span>
                            </div>
                          </div>

                          <p className="mt-2.5 text-xs text-slate-600 leading-relaxed">
                            {human.bio}
                          </p>

                          {/* Owned Built-in Agents List */}
                          <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-800 inline-flex items-center gap-1.5">
                                <Cpu className="w-3.5 h-3.5 text-indigo-600" />
                                <span>内建专业 Agent（{displayAgents.length} 个）</span>
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
                                  筛选全部 →
                                </button>
                              )}
                            </div>

                            {displayAgents.length === 0 ? (
                              <p className="text-xs text-slate-400 py-2">
                                暂未将内建 Agent 上架至服务市场
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {displayAgents.map((ag) => {
                                  const agLease = agentLeases[ag.id];
                                  const agPricing = getAgentLeasePricing({
                                    runtimeAgent: ag.runtimeAgent,
                                    defaultModel: ag.defaultModel,
                                    capabilityTier: ag.performance.capabilityTier,
                                    ownership: ag.ownership,
                                    projectPriceUsd: ag.projectPriceUsd,
                                    monthlyLeaseUsd: ag.monthlyLeaseUsd,
                                  });

                                  return (
                                    <div
                                      key={ag.id}
                                      className="rounded-lg bg-slate-50 border border-slate-200/80 px-3 py-2 flex items-center justify-between gap-2.5"
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
                                          <div className="text-[11px] text-slate-500 truncate mt-0.5 flex items-center gap-1.5 font-mono tabular-nums">
                                            <span className="font-semibold text-slate-700">
                                              {agPricing.rating.capability}级
                                            </span>
                                            <span className="text-slate-300">·</span>
                                            <span className="text-slate-800 font-semibold">
                                              ${agPricing.monthlyUsd}/月
                                            </span>
                                            {agLease && (
                                              <>
                                                <span className="text-slate-300">·</span>
                                                <span className="font-sans text-emerald-700 font-semibold">
                                                  已租({LEASE_PERIOD_META[agLease.period].shortLabel})
                                                </span>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => openAgentDrawer(ag.id, 'profile')}
                                          className="px-2 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-medium text-slate-600 cursor-pointer whitespace-nowrap"
                                        >
                                          详情
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => openAgentDrawer(ag.id, 'lease')}
                                          className={`px-2 py-1 rounded-md text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                                            agLease
                                              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                                              : 'bg-slate-900 hover:bg-slate-800 text-white'
                                          }`}
                                        >
                                          {agLease ? '续租' : '租赁'}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Human Expert Card Footer: Team Invite + Outsourcing Consultation */}
                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                          {human.isCurrentUser ? (
                            <>
                              <span className="text-[11px] text-slate-400">你的公开专家名片</span>
                              <button
                                type="button"
                                onClick={onJumpToMountPrivate}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer whitespace-nowrap"
                              >
                                <UploadCloud className="w-3.5 h-3.5" />
                                <span>管理内建 Agent</span>
                              </button>
                            </>
                          ) : (
                            <>
                              {teamMember ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 whitespace-nowrap">
                                  <UserCheck className="w-3.5 h-3.5" />
                                  <span>
                                    专家团队 ·{' '}
                                    {teamMember.relation === 'mutual_friend' ? '互关好友' : '项目合作'}
                                  </span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onInviteTeamExpert({
                                      expertId: human.id,
                                      relation: 'mutual_friend',
                                      sourceZoneId: activeZone.id,
                                      outsourcingScope: human.outsourcingDomain || human.specialties[0] || '',
                                    })
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer whitespace-nowrap"
                                >
                                  <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>互关好友</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => openHumanDrawer(human.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>
                                  {humanMsgCount > 0 ? `咨询 (${humanMsgCount})` : '咨询'}
                                </span>
                              </button>
                            </>
                          )}
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            )}

            {/* TAB 3: SKILLS & MCP MARKETPLACE (2-Column Grid · Free or One-Time Purchase) */}
            {entityTab === 'skills' && (
              <div className="grid grid-cols-1 @[540px]/center:grid-cols-2 gap-4">
                {filteredSkills.length === 0 ? (
                  <div className="col-span-full py-12 text-center border border-dashed border-slate-300 rounded-xl bg-white">
                    <p className="text-sm font-medium text-slate-700">没有符合筛选条件的 Skills / MCP</p>
                    <button
                      type="button"
                      onClick={() => {
                        setCategoryFilter('all');
                        setSkillKindFilter('all');
                        setSkillPriceFilter('all');
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
                    const isOwned = purchasedSkillIds.includes(skill.id);
                    const skillPricing = getSkillPurchasePricing(skill);

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
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold leading-none ${
                                    skillPricing.ratingTier === 'S'
                                      ? 'bg-violet-50 text-violet-700 border border-violet-200/80'
                                      : skillPricing.ratingTier === 'A+'
                                        ? 'bg-blue-50 text-blue-700 border border-blue-200/80'
                                        : 'bg-slate-100 text-slate-600 border border-slate-200/80'
                                  }`}
                                >
                                  {skillPricing.ratingTier}级
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

                            <div className="text-right shrink-0 font-mono tabular-nums">
                              <div
                                className={`text-sm font-bold leading-none ${
                                  skillPricing.isFree ? 'text-emerald-700' : 'text-slate-900'
                                }`}
                              >
                                {skillPricing.priceLabel}
                              </div>
                              <div className="text-[10px] font-sans text-slate-400 mt-1 whitespace-nowrap">
                                {skillPricing.isFree ? '免费开源' : '一次买断'}
                              </div>
                            </div>
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
                            文档 / 装配{mountedCount > 0 ? ` (${mountedCount})` : ''}
                          </button>

                          {isOwned ? (
                            <button
                              type="button"
                              onClick={() => openSkillDrawer(skill.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold cursor-pointer whitespace-nowrap"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{skillPricing.isFree ? '已免费获取' : '已买断 · 装配'}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                onAcquireSkill(skill.id, skill.name, skillPricing.priceUsd)
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                            >
                              {skillPricing.isFree ? (
                                <Blocks className="w-3.5 h-3.5" />
                              ) : (
                                <ShoppingBag className="w-3.5 h-3.5" />
                              )}
                              <span>
                                {skillPricing.isFree ? '免费获取' : `购买 ${skillPricing.priceLabel}`}
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
                </div>

                {/* COLUMN 3 (RIGHT): Automatic Objective Leaderboard Rail */}
                <MarketLeaderboardRail
                  entityTab={entityTab}
                  activeCategory={categoryFilter}
                  agents={agents}
                  allAgents={allAgents}
                  humanExperts={zoneHumansAll}
                  skills={zoneSkillsAll}
                  agentLeases={agentLeases}
                  purchasedSkillIds={purchasedSkillIds}
                  onSelectAgent={(agentId) => openAgentDrawer(agentId, 'lease')}
                  onSelectHuman={(humanId) => openHumanDrawer(humanId)}
                  onSelectSkill={(skillId) => openSkillDrawer(skillId)}
                />
              </div>
            </div>
          </div>
        </div>

      {/* RIGHT SLIDE-IN DRAWER A: AGENT LEASE CONFIGURATOR, CONSULTATION & PROFILE */}
      {drawerAgent && activeDrawer?.type === 'agent' && (() => {
        const activeLease = agentLeases[drawerAgent.id];
        const pricing = getAgentLeasePricing({
          runtimeAgent: drawerAgent.runtimeAgent,
          defaultModel: drawerAgent.defaultModel,
          capabilityTier: drawerAgent.performance.capabilityTier,
          ownership: drawerAgent.ownership,
          projectPriceUsd: drawerAgent.projectPriceUsd,
          monthlyLeaseUsd: drawerAgent.monthlyLeaseUsd,
        });
        const { rating } = pricing;
        const selectedPrice = pricing.getPriceForPeriod(selectedLeasePeriod);
        const selectedMeta = LEASE_PERIOD_META[selectedLeasePeriod];

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
                        ? `所属专家：${drawerAgent.ownerHumanName} · `
                        : ''}
                      评级 {rating.capability}级 · ${pricing.monthlyUsd}/月
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
              <div className="mt-3 grid grid-cols-3 gap-1 p-1 bg-slate-200/70 rounded-lg">
                <button
                  type="button"
                  onClick={() =>
                    setActiveDrawer({ type: 'agent', agentId: drawerAgent.id, tab: 'lease' })
                  }
                  className={`py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    activeDrawer.tab === 'lease'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  按期租赁
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
                  评级与能力
                </button>
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
                  咨询
                </button>
              </div>
            </div>

            {activeDrawer.tab === 'lease' ? (
              <div className="flex-1 overflow-y-auto clean-scroll p-5 space-y-4 bg-slate-50/40">
                {activeLease && (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs text-emerald-900 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 font-semibold">
                      <CalendarClock className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>当前租期生效：{activeLease.expiresLabel}</span>
                    </span>
                    <span className="font-mono font-bold">
                      ${activeLease.priceUsd}
                      {LEASE_PERIOD_META[activeLease.period].unitSuffix}
                    </span>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">选择租赁周期</span>
                    <span className="text-[11px] font-mono text-slate-500">
                      评级 {rating.capability}级 · ★ {drawerAgent.performance.rating.toFixed(2)}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {(['week', 'month', 'quarter'] as LeasePeriod[]).map((period) => {
                      const meta = LEASE_PERIOD_META[period];
                      const price = pricing.getPriceForPeriod(period);
                      const checked = selectedLeasePeriod === period;
                      return (
                        <button
                          key={period}
                          type="button"
                          onClick={() => setSelectedLeasePeriod(period)}
                          className={`w-full text-left rounded-xl border p-3.5 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                            checked
                              ? 'bg-white border-blue-600 ring-2 ring-blue-600/15'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">
                                {meta.label}（{meta.shortLabel}）
                              </span>
                              {period === 'quarter' && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-[10px] font-semibold text-amber-800">
                                  85折
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {meta.hint} · 租期 {meta.days} 天
                            </div>
                          </div>
                          <div className="text-right font-mono tabular-nums shrink-0">
                            <div className="text-base font-bold text-slate-900">
                              ${price}
                              <span className="text-[11px] font-sans font-normal text-slate-500">
                                {meta.unitSuffix}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-900">
                    派驻目标项目工作区
                  </label>
                  <select
                    value={selectedLeaseWorkspaceId}
                    onChange={(e) => setSelectedLeaseWorkspaceId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  >
                    {workspaces.map((ws) => (
                      <option key={ws.id} value={ws.id}>
                        {ws.name}（当前 {ws.hiredAgentIds.length} 个 Agent）
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    租赁生效后，该专业 Agent 将立即派驻至所选项目群与任务看板，并同步纳入「Agents → Agent 团队」管理，支持随时续租或调整租期。
                  </p>
                </div>

                <div className="rounded-xl bg-white border border-slate-200 p-3.5 space-y-2 text-xs">
                  <div className="font-semibold text-slate-800">租赁包含权益</div>
                  <ul className="space-y-1 text-[11px] text-slate-600 list-disc pl-4">
                    <li>
                      完整挂载底座 {drawerAgent.runtimeAgent}（{drawerAgent.defaultModel}）与{' '}
                      {drawerAgent.mcpTools.length} 个 MCP 工具链
                    </li>
                    <li>租期内项目群无限轮次任务协作、代码/文档产物交付与自动权限隔离</li>
                    <li>如需定制化需求、方案探讨或项目交付，可随时向所属专家 {drawerAgent.ownerHumanName || '主理人'} 发起咨询</li>
                  </ul>
                </div>
              </div>
            ) : activeDrawer.tab === 'consult' ? (
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="px-4 py-2 bg-blue-50/70 border-b border-blue-100 text-[11px] text-blue-900 flex items-center justify-between gap-2">
                  <span>
                    当前对接所属专家 <strong>{drawerAgent.ownerHumanName || '官方服务主理人'}</strong>，支持租赁答疑、方案讨论与合作评估
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto clean-scroll p-4 space-y-3.5 bg-slate-50/40">
                  <div className="flex flex-col items-start">
                    <span className="text-[11px] text-slate-500 mb-1 inline-flex items-center gap-1.5">
                      <span className="font-semibold text-slate-700">
                        {drawerAgent.ownerHumanName || displayEntityName(drawerAgent.handle)}
                      </span>
                      <span>· 咨询</span>
                    </span>
                    <div className="rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 leading-relaxed max-w-[92%]">
                      你好！我是 {formatShortRuntime(drawerAgent.runtimeAgent)}-
                      {displayEntityName(drawerAgent.handle)} 的所属专家
                      {drawerAgent.ownerHumanName ? ` ${drawerAgent.ownerHumanName}` : ''}。该
                      Agent 评级为 {rating.capability} 级（月租 ${pricing.monthlyUsd}/月，支持周租与季租），可以直接在「按期租赁」一键启用；如果需要方案探讨或由我带队合作，欢迎直接说明场景与目标。
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
                      专家正在结合项目范围组织回复...
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
                      placeholder={`向 ${drawerAgent.ownerHumanName || '专家'} 咨询适配度、方案或合作...`}
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
                    <div className="text-[11px] text-slate-500">能力评级 / 综合成本</div>
                    <div className="text-sm font-bold text-slate-900 mt-0.5 font-mono tabular-nums">
                      {rating.capability}级 · {rating.code}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">透明租赁定价</div>
                    <div className="text-xs font-semibold font-mono tabular-nums text-slate-900 mt-1">
                      ${pricing.monthlyUsd}/月 · 周 ${pricing.weeklyUsd} · 季 ${pricing.quarterlyUsd}
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

            {/* Sticky Bottom Bar */}
            <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0 font-mono tabular-nums">
                <div className="text-xs font-bold text-slate-900">
                  ${selectedPrice}
                  <span className="font-sans font-normal text-slate-500">
                    {selectedMeta.unitSuffix}（{selectedMeta.label}）
                  </span>
                </div>
                <div className="text-[11px] font-sans text-slate-500 truncate">
                  {rating.capability}级专业 Agent · {activeLease ? '可续租或切换周期' : '租后即刻派驻项目'}
                </div>
              </div>

              {activeDrawer.tab === 'consult' ? (
                <button
                  type="button"
                  onClick={() => onStartNegotiation(drawerAgent.id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer whitespace-nowrap shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>进入协作会话</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onLeaseAgent(drawerAgent.id, selectedLeasePeriod, selectedLeaseWorkspaceId);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white cursor-pointer whitespace-nowrap shrink-0"
                >
                  <CalendarClock className="w-3.5 h-3.5" />
                  <span>{activeLease ? '更新租期 / 派驻' : '确认租赁'}</span>
                </button>
              )}
            </div>
          </aside>
        );
      })()}

      {/* RIGHT SLIDE-IN DRAWER B: HUMAN EXPERT OUTSOURCING CONSULTATION */}
      {drawerHuman && activeDrawer?.type === 'human' && (() => {
        const drawerTeamMember = teamExpertMap.get(drawerHuman.id);
        return (
          <aside className="fixed inset-y-0 right-0 z-40 lg:static lg:z-auto w-full max-w-[430px] lg:w-[420px] shrink-0 border-l border-slate-200 bg-white flex flex-col h-full shadow-2xl lg:shadow-none">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 space-y-2.5">
              <div className="flex items-start justify-between gap-3">
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
                      <span className="px-1.5 py-0.5 rounded bg-violet-50 border border-violet-200 text-[10px] font-mono font-bold text-violet-700">
                        {drawerHuman.ratingTier || 'A+'}级专家
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {drawerHuman.outsourcingDomain || drawerHuman.title}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveDrawer(null)}
                  className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 cursor-pointer shrink-0"
                  aria-label="关闭专家咨询"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {!drawerHuman.isCurrentUser && (
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] text-slate-500 truncate">
                    可互加好友或直接邀请进入当前项目合作
                  </span>
                  {drawerTeamMember ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 shrink-0">
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>
                        专家团队({drawerTeamMember.relation === 'mutual_friend' ? '互关好友' : '项目合作'})
                      </span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        onInviteTeamExpert({
                          expertId: drawerHuman.id,
                          relation: 'project_collab',
                          targetWorkspaceId: workspace.id,
                          sourceZoneId: activeZone.id,
                          outsourcingScope: drawerHuman.outsourcingDomain || drawerHuman.specialties[0] || '',
                        })
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-[11px] font-semibold text-white cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <UserPlus className="w-3 h-3" />
                      <span>邀请进入当前项目</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto clean-scroll p-4 space-y-3.5 bg-slate-50/40">
              <div className="flex flex-col items-start">
                <span className="text-[11px] text-slate-500 mb-1">
                  {drawerHuman.name} · 人类专家咨询
                </span>
                <div className="rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 leading-relaxed max-w-[92%]">
                  你好！我是 {drawerHuman.name}，擅长「{drawerHuman.outsourcingDomain || drawerHuman.title}」（信誉 {drawerHuman.reputationScore}），并内建了专属专业 Agent 集群。无论是方案讨论、技术交流还是项目合作交付，欢迎直接说明你的想法或目标。
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
                  placeholder={`向 ${drawerHuman.name} 咨询方案、合作或排期...`}
                  className="flex-1 min-w-0 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-600/20"
                />
                <button
                  type="submit"
                  disabled={!humanDraft.trim()}
                  className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer disabled:opacity-45 shrink-0"
                  aria-label="发送咨询"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </aside>
        );
      })()}

      {/* RIGHT SLIDE-IN DRAWER C: SKILL / MCP DETAIL, PURCHASE & MOUNT TO PRIVATE AGENT */}
      {drawerSkill && activeDrawer?.type === 'skill' && (() => {
        const mountedTargets = mountedSkillMap[drawerSkill.id] || [];
        const targetAgent = privateAgents.find((a) => a.id === selectedMountAgentId);
        const alreadyMountedOnTarget = targetAgent
          ? mountedTargets.includes(targetAgent.id) ||
            targetAgent.skills.includes(drawerSkill.name)
          : false;
        const skillPricing = getSkillPurchasePricing(drawerSkill);
        const isOwned = purchasedSkillIds.includes(drawerSkill.id);

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
                  <span className="px-1.5 py-0.5 rounded bg-violet-50 border border-violet-200 text-[10px] font-mono font-bold text-violet-700 leading-none">
                    {skillPricing.ratingTier}级
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    {drawerSkill.version}
                  </span>
                  <span
                    className={`text-[11px] font-mono font-bold ${
                      skillPricing.isFree ? 'text-emerald-700' : 'text-slate-900'
                    }`}
                  >
                    · {skillPricing.priceLabel}
                  </span>
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
              <div className="rounded-xl bg-white border border-slate-200 p-3.5 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-slate-900 font-mono tabular-nums">
                    {skillPricing.ratingTier}级能力包 · {skillPricing.priceLabel}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {skillPricing.isFree
                      ? '开源免费授权，可永久免费装配至任意自建 Agent'
                      : '一次购买永久授权，支持团队内无限次装配与后续更新'}
                  </div>
                </div>
                {isOwned ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold whitespace-nowrap shrink-0">
                    <Check className="w-3.5 h-3.5" />
                    <span>{skillPricing.isFree ? '已获取' : '已购买'}</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      onAcquireSkill(drawerSkill.id, drawerSkill.name, skillPricing.priceUsd)
                    }
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {skillPricing.isFree ? (
                      <span>免费获取</span>
                    ) : (
                      <span>立即购买 {skillPricing.priceLabel}</span>
                    )}
                  </button>
                )}
              </div>

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
              {!isOwned && !skillPricing.isFree ? (
                <button
                  type="button"
                  onClick={() =>
                    onAcquireSkill(drawerSkill.id, drawerSkill.name, skillPricing.priceUsd)
                  }
                  className="w-full py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>一次性购买 {skillPricing.priceLabel} · 立即解锁装配</span>
                </button>
              ) : privateAgents.length === 0 ? (
                <button
                  type="button"
                  onClick={onJumpToMountPrivate}
                  className="w-full py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  先前往 Agents 创建自建 Agent
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
                    onClick={() => {
                      if (!targetAgent) return;
                      if (!isOwned) {
                        onAcquireSkill(drawerSkill.id, drawerSkill.name, skillPricing.priceUsd);
                      }
                      handleMountSkillToPrivateAgent(drawerSkill, targetAgent.id);
                    }}
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
