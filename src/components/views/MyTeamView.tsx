import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowUpRight,
  Briefcase,
  CalendarClock,
  Check,
  Cpu,
  Globe,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Settings2,
  Sparkles,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { optimizeExpertProfile } from '../../services/api';
import {
  AGENT_RUNTIME_PRESETS,
  AgentIdentityName,
  EntityAvatar,
  LEASE_PERIOD_META,
  displayEntityName,
  getAgentLeasePricing,
  getRuntimePreset,
} from '../shared/EntityIdentity';
import {
  RailNavButton,
  RailSectionLabel,
  ToolbarDropdown,
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
  ExpertAgent,
  ExpertRelationType,
  HumanExpert,
  LeasePeriod,
  ProjectWorkspace,
  TeamExpertMembership,
  WorkflowTask,
} from '../../types/agentnexus';

interface MyTeamViewProps {
  zones: CommunityZone[];
  activeZone: CommunityZone;
  workspace: ProjectWorkspace;
  workspaces: ProjectWorkspace[];
  allAgents: ExpertAgent[];
  humanExperts: HumanExpert[];
  agentLeases: Record<string, AgentLeaseRecord>;
  teamExperts: TeamExpertMembership[];
  hiredAgents: ExpertAgent[];
  privateAgents: ExpertAgent[];
  hiredIds: string[];
  tasks: WorkflowTask[];
  openMountDrawerSignal: number;
  onHireAgent: (agentId: string) => void;
  onReleaseAgent: (agentId: string) => void;
  onLeaseAgent: (agentId: string, period: LeasePeriod, targetWorkspaceId?: string) => void;
  onInviteTeamExpert: (input: {
    expertId: string;
    relation: ExpertRelationType;
    targetWorkspaceId?: string;
    sourceZoneId?: string;
    outsourcingScope?: string;
  }) => void;
  onAssignExpertToWorkspace: (expertId: string, workspaceId: string) => void;
  onRemoveExpertFromWorkspace: (expertId: string, workspaceId: string) => void;
  onUpdateTeamExpertRelation: (expertId: string, relation: ExpertRelationType) => void;
  onRemoveTeamExpert: (expertId: string) => void;
  onStartNegotiation: (agentId: string) => void;
  onSavePrivateAgent: (expert: ExpertAgent, isNew: boolean) => void;
  onToggleMarketListing: (agentId: string, targetZoneId?: string) => void;
  onRecruitCategory: (category: 'all' | AgentCategory) => void;
  onJumpToMarket: () => void;
}

type TeamSectionTab = 'agents' | 'collaborators' | 'friends';
type TeamOwnershipTab = 'all' | 'private' | 'external';
type AgentWorkStatusFilter = 'all' | 'working' | 'idle';
type AddDrawerMode = 'private' | 'external';

const AGENT_STATUS_OPTIONS: { id: AgentWorkStatusFilter; label: string }[] = [
  { id: 'all', label: '全部状态' },
  { id: 'working', label: '工作中' },
  { id: 'idle', label: '空闲待命' },
];

const AGENT_CATEGORY_LABELS: Record<AgentCategory, string> = {
  engineering: '研发开发',
  design: '设计体验',
  product: '产品策划',
  architecture: '架构审查',
  qa: '测试质量',
  media: '自媒体运营',
};

const AGENT_CATEGORY_OPTIONS: { id: 'all' | AgentCategory; label: string }[] = [
  { id: 'all', label: '全部类目' },
  { id: 'engineering', label: '研发开发' },
  { id: 'product', label: '产品策划' },
  { id: 'design', label: '设计体验' },
  { id: 'architecture', label: '架构审查' },
  { id: 'qa', label: '测试质量' },
  { id: 'media', label: '自媒体运营' },
];

const ACCENT_PALETTE = ['#0284c7', '#7c3aed', '#0f766e', '#e11d48', '#d97706', '#4338ca'];

export function MyTeamView({
  zones,
  activeZone,
  workspace,
  workspaces,
  allAgents,
  humanExperts,
  agentLeases,
  teamExperts,
  hiredAgents,
  privateAgents,
  hiredIds,
  tasks,
  openMountDrawerSignal,
  onHireAgent,
  onReleaseAgent,
  onLeaseAgent,
  onInviteTeamExpert,
  onAssignExpertToWorkspace,
  onRemoveExpertFromWorkspace,
  onUpdateTeamExpertRelation,
  onRemoveTeamExpert,
  onStartNegotiation,
  onSavePrivateAgent,
  onToggleMarketListing,
  onRecruitCategory,
  onJumpToMarket,
}: MyTeamViewProps) {
  const [teamSection, setTeamSection] = useState<TeamSectionTab>('agents');
  const [ownershipTab, setOwnershipTab] = useState<TeamOwnershipTab>('all');
  const [expertZoneFilter, setExpertZoneFilter] = useState<string>('all');
  const [expertAssignFilter, setExpertAssignFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [statusFilter, setStatusFilter] = useState<AgentWorkStatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | AgentCategory>('all');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const actionMenuContainerRef = useRef<HTMLDivElement | null>(null);

  // Space Expert Invite Slide-in Drawer State
  const [inviteDrawerOpen, setInviteDrawerOpen] = useState(false);
  const [inviteZoneFilter, setInviteZoneFilter] = useState<string>('all');
  const [inviteRelation, setInviteRelation] = useState<ExpertRelationType>('mutual_friend');
  const [inviteWorkspaceId, setInviteWorkspaceId] = useState<string>('');

  useEffect(() => {
    if (!openActionMenuId) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (
        actionMenuContainerRef.current &&
        !actionMenuContainerRef.current.contains(event.target as Node)
      ) {
        setOpenActionMenuId(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenActionMenuId(null);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openActionMenuId]);

  // Unified "+ 添加 Agent" Drawer State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<AddDrawerMode>('private');
  const [editingId, setEditingId] = useState<string | 'new'>('new');
  const [externalCatFilter, setExternalCatFilter] = useState<'all' | AgentCategory>('all');

  // Private Agent Form State
  const [handle, setHandle] = useState('@我的私有特工');
  const [name, setName] = useState('Nova · 领域私有交付 Agent');
  const [title, setTitle] = useState('自动化工作流执行与专项产出');
  const [category, setCategory] = useState<AgentCategory>('engineering');
  const [runtimeAgent, setRuntimeAgent] = useState<string>('Claude Code');
  const [defaultModel, setDefaultModel] = useState<string>('Claude 4.5 Sonnet');
  const [region, setRegion] = useState('本地 anx-worker 私有节点');
  const [projectPriceUsd, setProjectPriceUsd] = useState(1800);
  const [bio, setBio] = useState(
    '本地调优的私有 Agent 节点，默认零签约费加入自有项目工作，闲时可勾选上架至指定社区市场接单。',
  );
  const [skills, setSkills] = useState<string[]>(['领域知识库检索', '自动化脚本执行', '产出质量自检']);
  const [mcpTools, setMcpTools] = useState<string[]>(['Git-PR', 'Sandbox-Runner']);
  const [listedZoneIds, setListedZoneIds] = useState<string[]>([]);
  const [newSkillInput, setNewSkillInput] = useState('');

  const [aiOptimizing, setAiOptimizing] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // All externally hired Agents across any project workspace
  const externalHiredAgents = useMemo(() => {
    const hiredAcrossAll = new Set<string>();
    workspaces.forEach((w) => w.hiredAgentIds.forEach((id) => hiredAcrossAll.add(id)));
    return allAgents.filter(
      (a) => a.ownership === 'marketplace' && hiredAcrossAll.has(a.id),
    );
  }, [allAgents, workspaces]);

  // Unified deduplicated AGN team roster (working + private + external hired)
  const teamRoster = useMemo(() => {
    const map = new Map<string, ExpertAgent>();
    hiredAgents.forEach((a) => map.set(a.id, a));
    privateAgents.forEach((a) => map.set(a.id, a));
    externalHiredAgents.forEach((a) => map.set(a.id, a));
    return Array.from(map.values());
  }, [externalHiredAgents, hiredAgents, privateAgents]);

  const humanExpertMap = useMemo(() => {
    const map = new Map<string, HumanExpert>();
    humanExperts.forEach((h) => map.set(h.id, h));
    return map;
  }, [humanExperts]);

  const normalizedQuery = searchKeyword.trim().toLowerCase();

  const activeExpertRelation: ExpertRelationType =
    teamSection === 'friends' ? 'mutual_friend' : 'project_collab';

  const displayedTeamExperts = useMemo(() => {
    const hiredExpertSet = new Set(workspace.hiredExpertIds || []);
    return teamExperts
      .filter((m) => m.relation === activeExpertRelation)
      .filter((m) =>
        expertZoneFilter === 'all'
          ? true
          : (m.sourceZoneId || 'zone_public') === expertZoneFilter,
      )
      .filter((m) => {
        if (expertAssignFilter === 'all') return true;
        const isAssigned = hiredExpertSet.has(m.expertId);
        return expertAssignFilter === 'assigned' ? isAssigned : !isAssigned;
      })
      .map((membership) => {
        const expert = humanExpertMap.get(membership.expertId);
        const ownedAgents = allAgents.filter(
          (a) => a.ownerHumanId === membership.expertId && a.isListedInMarket,
        );
        return expert ? { membership, expert, ownedAgents } : null;
      })
      .filter(
        (
          item,
        ): item is {
          membership: TeamExpertMembership;
          expert: HumanExpert;
          ownedAgents: ExpertAgent[];
        } => {
          if (!item) return false;
          if (categoryFilter !== 'all' && item.expert.category !== categoryFilter) {
            return false;
          }
          if (!normalizedQuery) return true;
          const { expert, membership, ownedAgents } = item;
          return (
            expert.name.toLowerCase().includes(normalizedQuery) ||
            expert.title.toLowerCase().includes(normalizedQuery) ||
            (expert.outsourcingDomain || '').toLowerCase().includes(normalizedQuery) ||
            expert.specialties.some((s) => s.toLowerCase().includes(normalizedQuery)) ||
            (membership.outsourcingScope || '').toLowerCase().includes(normalizedQuery) ||
            ownedAgents.some((a) => a.handle.toLowerCase().includes(normalizedQuery))
          );
        },
      );
  }, [
    activeExpertRelation,
    allAgents,
    categoryFilter,
    expertAssignFilter,
    expertZoneFilter,
    humanExpertMap,
    normalizedQuery,
    teamExperts,
    workspace.hiredExpertIds,
  ]);

  const inviteCandidates = useMemo(() => {
    return humanExperts
      .filter((h) => !h.isCurrentUser)
      .filter((h) => (inviteZoneFilter === 'all' ? true : h.zoneIds.includes(inviteZoneFilter)))
      .map((expert) => ({
        expert,
        ownedAgents: allAgents.filter((a) => a.ownerHumanId === expert.id && a.isListedInMarket),
        membership: teamExperts.find((m) => m.expertId === expert.id) || null,
      }));
  }, [allAgents, humanExperts, inviteZoneFilter, teamExperts]);

  const expertRelationCounts = useMemo(() => {
    const projectCollab = teamExperts.filter((m) => m.relation === 'project_collab').length;
    const mutualFriend = teamExperts.filter((m) => m.relation === 'mutual_friend').length;
    return { projectCollab, mutualFriend };
  }, [teamExperts]);

  const getProjectNamesForAgent = (agentId: string) =>
    workspaces.filter((w) => w.hiredAgentIds.includes(agentId)).map((w) => w.name);

  const getAgentWorkStatus = (agent: ExpertAgent) => {
    const isWorkingInCurrent = hiredIds.includes(agent.id);
    const projectNames = getProjectNamesForAgent(agent.id);
    const activeTaskCount = tasks.filter(
      (t) => t.assigneeId === agent.id && t.status !== 'done',
    ).length;

    if (!agent.isOnlineForOrders) {
      return {
        code: 'offline' as const,
        label: '已离线',
        subLabel: '节点离线',
        isWorkingInCurrent: false,
        projectNames,
      };
    }
    if (isWorkingInCurrent) {
      return {
        code: 'working' as const,
        label: '工作中',
        subLabel: activeTaskCount > 0 ? `当前项目 · ${activeTaskCount} 项进行中` : '当前项目驻场',
        isWorkingInCurrent: true,
        projectNames,
      };
    }
    if (projectNames.length > 0) {
      return {
        code: 'working' as const,
        label: '工作中',
        subLabel: '其他项目驻场',
        isWorkingInCurrent: false,
        projectNames,
      };
    }
    return {
      code: 'idle' as const,
      label: '空闲待命',
      subLabel: '可随时调度',
      isWorkingInCurrent: false,
      projectNames,
    };
  };

  // Candidates available for adding as external hired Agents inside the unified drawer
  const externalCandidates = useMemo(() => {
    return allAgents.filter((a) => {
      if (a.ownership !== 'marketplace') return false;
      if (externalCatFilter !== 'all' && a.category !== externalCatFilter) return false;
      return true;
    });
  }, [allAgents, externalCatFilter]);

  const statusCounts = useMemo(() => {
    let working = 0;
    let idle = 0;
    teamRoster.forEach((agent) => {
      const inAnyProject = workspaces.some((w) => w.hiredAgentIds.includes(agent.id));
      if (inAnyProject) working += 1;
      else idle += 1;
    });
    return { working, idle };
  }, [teamRoster, workspaces]);

  const activeCategoryCounts = useMemo(() => {
    const counts: Record<'all' | AgentCategory, number> = {
      all: 0,
      engineering: 0,
      product: 0,
      design: 0,
      architecture: 0,
      qa: 0,
      media: 0,
    };
    if (teamSection === 'agents') {
      const source =
        ownershipTab === 'private'
          ? privateAgents
          : ownershipTab === 'external'
            ? externalHiredAgents
            : teamRoster;
      counts.all = source.length;
      source.forEach((a) => {
        counts[a.category] = (counts[a.category] || 0) + 1;
      });
      return counts;
    }

    const relation: ExpertRelationType =
      teamSection === 'friends' ? 'mutual_friend' : 'project_collab';
    const matchingExperts = teamExperts
      .filter((m) => m.relation === relation)
      .filter((m) =>
        expertZoneFilter === 'all'
          ? true
          : (m.sourceZoneId || 'zone_public') === expertZoneFilter,
      )
      .map((m) => humanExpertMap.get(m.expertId))
      .filter((exp): exp is HumanExpert => Boolean(exp));

    counts.all = matchingExperts.length;
    matchingExperts.forEach((exp) => {
      counts[exp.category] = (counts[exp.category] || 0) + 1;
    });
    return counts;
  }, [
    expertZoneFilter,
    externalHiredAgents,
    humanExpertMap,
    ownershipTab,
    privateAgents,
    teamExperts,
    teamRoster,
    teamSection,
  ]);

  const currentRelationExperts = useMemo(
    () => teamExperts.filter((m) => m.relation === activeExpertRelation),
    [activeExpertRelation, teamExperts],
  );

  const assignedInCurrentCount = useMemo(() => {
    const hiredSet = new Set(workspace.hiredExpertIds || []);
    return currentRelationExperts.filter((m) => hiredSet.has(m.expertId)).length;
  }, [currentRelationExperts, workspace.hiredExpertIds]);

  const displayedAgents = useMemo(() => {
    const source =
      ownershipTab === 'private'
        ? privateAgents
        : ownershipTab === 'external'
          ? externalHiredAgents
          : teamRoster;

    return source.filter((agent) => {
      if (categoryFilter !== 'all' && agent.category !== categoryFilter) {
        return false;
      }
      if (statusFilter !== 'all') {
        const inAnyProject = workspaces.some((w) => w.hiredAgentIds.includes(agent.id));
        if (statusFilter === 'working' && !inAnyProject) return false;
        if (statusFilter === 'idle' && inAnyProject) return false;
      }
      if (normalizedQuery) {
        const match =
          agent.handle.toLowerCase().includes(normalizedQuery) ||
          agent.name.toLowerCase().includes(normalizedQuery) ||
          agent.title.toLowerCase().includes(normalizedQuery) ||
          agent.runtimeAgent.toLowerCase().includes(normalizedQuery) ||
          agent.defaultModel.toLowerCase().includes(normalizedQuery) ||
          (agent.ownerHumanName || '').toLowerCase().includes(normalizedQuery) ||
          agent.skills.some((s) => s.toLowerCase().includes(normalizedQuery));
        if (!match) return false;
      }
      return true;
    });
  }, [
    categoryFilter,
    externalHiredAgents,
    normalizedQuery,
    ownershipTab,
    privateAgents,
    statusFilter,
    teamRoster,
    workspaces,
  ]);

  const openAddDrawer = (mode: AddDrawerMode = 'private', defaultZones: string[] = []) => {
    setDrawerMode(mode);
    setEditingId('new');
    setHandle('@私有专项特工');
    setName('Kestrel · 领域专项私有 Agent');
    setTitle('自动化任务执行、内容生成与质量校验');
    setCategory('engineering');
    setRuntimeAgent('Claude Code');
    setDefaultModel('Claude 4.5 Sonnet');
    setRegion('本地 anx-worker 私有节点');
    setProjectPriceUsd(1800);
    setBio('本地调优的私有 Agent 节点，支持加密工作区挂载。默认私有自用，按需勾选上架至市场对外承接项目。');
    setSkills(['接口契约联调', '边界单测补全', '自动化产出校验']);
    setMcpTools(['Git-PR', 'Sandbox-Runner', 'TypeCheck-CLI']);
    setListedZoneIds(defaultZones);
    setAiAdvice(null);
    setAiError(null);
    setDrawerOpen(true);
  };

  const openEditDrawer = (agent: ExpertAgent) => {
    setDrawerMode('private');
    setEditingId(agent.id);
    setHandle(agent.handle);
    setName(agent.name);
    setTitle(agent.title);
    setCategory(agent.category);
    setRuntimeAgent(agent.runtimeAgent);
    setDefaultModel(agent.defaultModel);
    setRegion(agent.region);
    setProjectPriceUsd(agent.projectPriceUsd);
    setBio(agent.bio);
    setSkills([...agent.skills]);
    setMcpTools([...agent.mcpTools]);
    setListedZoneIds([...agent.listedZoneIds]);
    setAiAdvice(null);
    setAiError(null);
    setDrawerOpen(true);
  };

  useEffect(() => {
    if (openMountDrawerSignal > 0) {
      openAddDrawer('private', [activeZone.id]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openMountDrawerSignal]);

  const toggleDrawerZone = (zoneId: string) => {
    setListedZoneIds((prev) =>
      prev.includes(zoneId) ? prev.filter((id) => id !== zoneId) : [...prev, zoneId],
    );
  };

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
      const targetZoneNames = listedZoneIds
        .map((id) => zones.find((z) => z.id === id)?.name)
        .filter((v): v is string => Boolean(v));
      const res = await optimizeExpertProfile({
        name,
        title,
        category,
        serviceMode: 'pure-agent',
        skills,
        bio,
        targetZoneNames,
      });
      setBio(res.optimizedBio || bio);
      if (res.recommendedSkills?.length) setSkills(res.recommendedSkills);
      if (res.recommendedMcpTools?.length) setMcpTools(res.recommendedMcpTools);
      if (res.suggestedProjectPriceUsd) {
        setProjectPriceUsd(Math.round(res.suggestedProjectPriceUsd));
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
      name: name.trim() || '私有 Agent 节点',
      title: title.trim() || '专业领域自主交付',
      category,
      region: region.trim() || '本地私有节点',
      nodeTier: 'idle-peer',
      serviceMode: 'pure-agent',
      ownership: 'private',
      ownerHumanId: 'human_me',
      ownerHumanName: '林致远（我）',
      ownerHumanTitle: '自有节点',
      listedZoneIds,
      isListedInMarket: listedZoneIds.length > 0,
      runtimeAgent,
      defaultModel,
      engineModel: '自有私有节点 · anx-worker 直连',
      skills: skills.length > 0 ? skills : ['私有领域交付'],
      mcpTools: mcpTools.length > 0 ? mcpTools : ['Git-PR'],
      projectPriceUsd: Math.round(Number(projectPriceUsd)) || 1800,
      bio: bio.trim(),
      avatarAccent:
        existing?.avatarAccent ||
        ACCENT_PALETTE[privateAgents.length % ACCENT_PALETTE.length],
      avatarCode:
        existing?.avatarCode ||
        (category === 'product'
          ? 'PM'
          : category === 'design'
            ? 'UI'
            : category === 'architecture'
              ? 'AR'
              : category === 'qa'
                ? 'QA'
                : category === 'media'
                  ? 'MD'
                  : 'PV'),
      isOnlineForOrders: true,
      performance: existing?.performance || {
        completedProjects: 12,
        successRate: 98.8,
        reputationScore: 96,
        repeatHireRate: 88,
        avgDeliveryDays: 3,
        rating: 4.93,
        capabilityTier: 'A+ 资深',
        demandStatus: '档期充裕',
        demandNote: '自有节点 · 内部自用免签约费',
        pricingBasis: '基于自有能力配置设定的项目制签约价',
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

  const getZoneName = (zoneId?: string) =>
    zoneId ? zones.find((z) => z.id === zoneId)?.name : undefined;

  return (
    <div className="h-full flex min-h-0 bg-white relative @container/shell">
      {/* FAR-LEFT PRIMARY FILTER RAIL: 2 Unified Sections (Team Members + Same 专业类目) */}
      <WorkspacePrimaryRail ariaLabel="AGN 团队主筛选">
        <div className="space-y-1">
          <RailSectionLabel>团队板块</RailSectionLabel>
          <RailNavButton
            variant="primary"
            active={teamSection === 'agents'}
            onClick={() => {
              setTeamSection('agents');
              setOpenActionMenuId(null);
            }}
            icon={<Cpu className="w-3.5 h-3.5" />}
            label="Agent 成员"
            count={teamRoster.length}
          />
          <RailNavButton
            variant="primary"
            active={teamSection === 'collaborators'}
            onClick={() => {
              setTeamSection('collaborators');
              setOpenActionMenuId(null);
            }}
            icon={<Users className="w-3.5 h-3.5" />}
            label="合作专家"
            count={expertRelationCounts.projectCollab}
          />
          <RailNavButton
            variant="primary"
            active={teamSection === 'friends'}
            onClick={() => {
              setTeamSection('friends');
              setOpenActionMenuId(null);
            }}
            icon={<UserCheck className="w-3.5 h-3.5" />}
            label="我的好友"
            count={expertRelationCounts.mutualFriend}
          />
        </div>

        <div className="pt-3 border-t border-slate-100 space-y-1">
          <RailSectionLabel>专业类目</RailSectionLabel>
          {AGENT_CATEGORY_OPTIONS.map((cat) => (
            <RailNavButton
              key={cat.id}
              active={categoryFilter === cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              label={cat.label}
              count={activeCategoryCounts[cat.id]}
            />
          ))}
        </div>
      </WorkspacePrimaryRail>

      {/* RIGHT WORKSPACE COLUMN: Top Search & Secondary Filters Aligned Flush with Roster Below */}
      <div className="flex-1 min-w-0 flex flex-col h-full min-h-0 @container/view">
        <ViewToolbar
          left={
            <>
              <ToolbarSearch
                value={searchKeyword}
                onChange={setSearchKeyword}
                placeholder={
                  teamSection === 'agents'
                    ? '搜索 Agent 名称、底座、技能或所属专家...'
                    : teamSection === 'collaborators'
                      ? '搜索合作专家姓名、专长方向或内建 Agent...'
                      : '搜索好友姓名、专长方向或内建 Agent...'
                }
                widthClass="flex-1 min-w-[160px] max-w-[300px]"
              />

              {teamSection === 'agents' ? (
                <>
                  <ToolbarDropdown
                    label="来源"
                    value={ownershipTab}
                    defaultValue="all"
                    onChange={setOwnershipTab}
                    options={[
                      { id: 'all', label: '全部 Agent', hint: `${teamRoster.length}` },
                      { id: 'private', label: '自建 Agent', hint: `${privateAgents.length}` },
                      { id: 'external', label: '租赁外雇', hint: `${externalHiredAgents.length}` },
                    ]}
                  />
                  <ToolbarDropdown
                    label="状态"
                    value={statusFilter}
                    defaultValue="all"
                    onChange={setStatusFilter}
                    options={AGENT_STATUS_OPTIONS}
                  />
                </>
              ) : (
                <>
                  <ToolbarDropdown
                    label="空间"
                    value={expertZoneFilter}
                    defaultValue="all"
                    onChange={setExpertZoneFilter}
                    options={[
                      { id: 'all', label: '全部空间', hint: `${currentRelationExperts.length}` },
                      ...zones.map((z) => ({
                        id: z.id,
                        label: z.name,
                        hint: `${currentRelationExperts.filter((m) => (m.sourceZoneId || 'zone_public') === z.id).length}`,
                      })),
                    ]}
                  />
                  <ToolbarDropdown
                    label="派驻"
                    value={expertAssignFilter}
                    defaultValue="all"
                    onChange={setExpertAssignFilter}
                    options={[
                      { id: 'all', label: '全部状态' },
                      { id: 'assigned', label: '已派驻当前项目' },
                      { id: 'unassigned', label: '暂未入当前项目' },
                    ]}
                  />
                </>
              )}
            </>
          }
          right={
            teamSection === 'agents' ? (
              <>
                <span className="hidden @[860px]:inline-flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums mr-1">
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>工作中 {statusCounts.working}</span>
                  </span>
                  <span className="text-slate-300" aria-hidden="true">·</span>
                  <span>空闲 {statusCounts.idle}</span>
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setInviteDrawerOpen(false);
                    openAddDrawer(ownershipTab === 'external' ? 'external' : 'private', []);
                  }}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>添加 Agent</span>
                </button>
              </>
            ) : (
              <>
                <span className="hidden @[860px]:inline-flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums mr-1">
                  <span>
                    {teamSection === 'collaborators' ? '合作专家' : '互关好友'}{' '}
                    {currentRelationExperts.length}
                  </span>
                  <span className="text-slate-300" aria-hidden="true">·</span>
                  <span className="text-emerald-700">当前项目已派驻 {assignedInCurrentCount}</span>
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    setInviteRelation(
                      teamSection === 'friends' ? 'mutual_friend' : 'project_collab',
                    );
                    setInviteDrawerOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap shrink-0"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{teamSection === 'friends' ? '添加好友' : '添加合作专家'}</span>
                </button>
              </>
            )
          }
        />

        {/* Scrollable Roster Canvas */}
        <div className={`flex-1 min-h-0 overflow-y-auto clean-scroll bg-slate-50/70 ${WORKSPACE_GUTTER_CLASS} py-5`}>
          <div className={`${WORKSPACE_MAX_WIDTH_CLASS} space-y-4`}>
            {/* Compact Narrow Strip (visible only when shell < 760px) */}
            <div className="@[760px]/shell:hidden space-y-2">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                {[
                  { id: 'agents' as const, label: 'Agent 成员', count: teamRoster.length, icon: Cpu },
                  {
                    id: 'collaborators' as const,
                    label: '合作专家',
                    count: expertRelationCounts.projectCollab,
                    icon: Users,
                  },
                  {
                    id: 'friends' as const,
                    label: '我的好友',
                    count: expertRelationCounts.mutualFriend,
                    icon: UserCheck,
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  const active = teamSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setTeamSection(item.id);
                        setOpenActionMenuId(null);
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
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                {AGENT_CATEGORY_OPTIONS.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer border transition-colors ${
                      categoryFilter === cat.id
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {cat.label} ({activeCategoryCounts[cat.id]})
                  </button>
                ))}
              </div>
            </div>

            {teamSection === 'agents' ? (
              <>
                {/* Concise Context Line */}
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-500">
                    {ownershipTab === 'private' && (
                      <span>自有挂载的自建 Agent 成员，项目内免租调用，支持按需上架社区服务市场对外租赁</span>
                    )}
                    {ownershipTab === 'external' && (
                      <span>按周 / 按月 / 按季度租赁的专业 Agent 成员，可随时续租或调度至各项目工作区</span>
                    )}
                    {ownershipTab === 'all' && (
                      <span>
                        自建与租赁专业 Agent 成员（当前工作区：<strong className="text-slate-800">{workspace.name}</strong>）
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 shrink-0">
                    <span className="hidden md:inline text-[11px]">
                      评级 S/A+/A · 支持周/月/季租赁
                    </span>
                    <span className="font-mono tabular-nums">共 {displayedAgents.length} 个 Agent</span>
                  </div>
                </div>

                {displayedAgents.length === 0 ? (
                  <div className="py-14 text-center border border-dashed border-slate-300 rounded-xl bg-white space-y-3">
                    <p className="text-sm font-medium text-slate-700">当前筛选下暂无 Agent 节点</p>
                    <div className="flex items-center justify-center gap-2">
                      {(categoryFilter !== 'all' ||
                        statusFilter !== 'all' ||
                        ownershipTab !== 'all' ||
                        searchKeyword.trim() !== '') && (
                        <button
                          type="button"
                          onClick={() => {
                            setOwnershipTab('all');
                            setCategoryFilter('all');
                            setStatusFilter('all');
                            setSearchKeyword('');
                          }}
                          className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer"
                        >
                          重置筛选条件
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openAddDrawer(ownershipTab === 'external' ? 'external' : 'private', [])}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>添加 Agent</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl bg-white mb-16">
                    {/* Desktop Column Header */}
                    <div className="hidden @[860px]:grid @[860px]:grid-cols-[minmax(0,1fr)_140px_84px_164px_140px] @[860px]:items-center @[860px]:gap-4 px-5 py-2.5 bg-slate-50/90 border-b border-slate-200 rounded-t-xl text-[11px] font-semibold text-slate-500">
                      <div>专业 Agent</div>
                      <div>运行状态</div>
                      <div>当前交付</div>
                      <div>评级 / 租期</div>
                      <div className="text-right">操作</div>
                    </div>

                    <div className="divide-y divide-slate-200">
                      {displayedAgents.map((agent, rowIndex) => {
                        const status = getAgentWorkStatus(agent);
                        const isWorkingInCurrent = status.isWorkingInCurrent;
                        const isPrivate = agent.ownership === 'private';
                        const activeLease = agentLeases[agent.id];
                        const pricing = getAgentLeasePricing({
                          runtimeAgent: agent.runtimeAgent,
                          defaultModel: agent.defaultModel,
                          capabilityTier: agent.performance.capabilityTier,
                          ownership: agent.ownership,
                          projectPriceUsd: agent.projectPriceUsd,
                          monthlyLeaseUsd: agent.monthlyLeaseUsd,
                        });
                        const tierRating = pricing.rating;
                        const agentTasks = tasks.filter((t) => t.assigneeId === agent.id);
                        const doneTasks = agentTasks.filter((t) => t.status === 'done').length;
                        const projectNames = status.projectNames;
                        const listedZoneNames = agent.listedZoneIds
                          .map((zid) => getZoneName(zid))
                          .filter((v): v is string => Boolean(v));
                        const isListedInActiveZone = agent.listedZoneIds.includes(activeZone.id);
                        const isMenuOpen = openActionMenuId === agent.id;
                        const openUpwards =
                          displayedAgents.length >= 3 && rowIndex >= displayedAgents.length - 2;

                        return (
                          <div
                            key={agent.id}
                            className="px-4 sm:px-5 py-4 hover:bg-slate-50/60 transition-colors flex flex-col gap-3.5 @[860px]:grid @[860px]:grid-cols-[minmax(0,1fr)_140px_84px_164px_140px] @[860px]:items-center @[860px]:gap-4 last:rounded-b-xl"
                          >
                            {/* Col 1: Agent Identity & Capabilities */}
                            <div className="flex items-start gap-3.5 min-w-0">
                              <EntityAvatar
                                kind="agent"
                                code={agent.avatarCode}
                                accent={agent.avatarAccent}
                                size="lg"
                              />

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                                  <AgentIdentityName
                                    name={agent.handle}
                                    runtime={agent.runtimeAgent}
                                    model={agent.defaultModel}
                                    showModel
                                    className="text-sm font-bold text-slate-900"
                                  />

                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium whitespace-nowrap">
                                    {AGENT_CATEGORY_LABELS[agent.category]}
                                  </span>

                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[11px] font-medium whitespace-nowrap ${
                                      isPrivate
                                        ? 'bg-sky-50 text-sky-700'
                                        : 'bg-indigo-50 text-indigo-700'
                                    }`}
                                  >
                                    {isPrivate
                                      ? '自建 Agent'
                                      : activeLease
                                        ? `租赁 · ${LEASE_PERIOD_META[activeLease.period].shortLabel}`
                                        : '外雇 Agent'}
                                  </span>
                                </div>

                                <p className="text-xs text-slate-600 mt-1 truncate" title={agent.title}>
                                  {agent.title}
                                </p>

                                <div className="mt-1.5 space-y-1 text-[11px] text-slate-500">
                                  <div className="truncate" title={agent.skills.join(' · ')}>
                                    {agent.ownerHumanName && !isPrivate && (
                                      <span className="text-slate-700 font-medium mr-1.5">
                                        所属专家：{agent.ownerHumanName} ·
                                      </span>
                                    )}
                                    {agent.skills.join(' · ')}
                                  </div>

                                  {(projectNames.length > 0 || (isPrivate && listedZoneNames.length > 0)) && (
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                      {isPrivate && listedZoneNames.length > 0 && (
                                        <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                                          <Globe className="w-3 h-3 shrink-0" />
                                          <span>已上架：{listedZoneNames.join(' / ')}</span>
                                        </span>
                                      )}
                                      {projectNames.length > 0 && (
                                        <span className="truncate text-slate-500">
                                          参与项目：{projectNames.join('、')}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Col 2: Runtime Status */}
                            <div className="flex items-center justify-between @[860px]:block text-xs">
                              <span className="text-[11px] text-slate-400 @[860px]:hidden">运行状态</span>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                      status.code === 'working'
                                        ? isWorkingInCurrent
                                          ? 'bg-emerald-500'
                                          : 'bg-sky-500'
                                        : status.code === 'idle'
                                          ? 'bg-slate-400'
                                          : 'bg-slate-300'
                                    }`}
                                  />
                                  <span
                                    className={`font-semibold whitespace-nowrap ${
                                      status.code === 'working'
                                        ? isWorkingInCurrent
                                          ? 'text-emerald-700'
                                          : 'text-sky-700'
                                        : 'text-slate-600'
                                    }`}
                                  >
                                    {status.label}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                                  {status.subLabel}
                                </div>
                              </div>
                            </div>

                            {/* Col 3: Current Project Delivery */}
                            <div className="flex items-center justify-between @[860px]:block text-xs font-mono tabular-nums">
                              <span className="text-[11px] font-sans text-slate-400 @[860px]:hidden">当前交付</span>
                              {isWorkingInCurrent ? (
                                <div>
                                  <div className="font-semibold text-slate-900">
                                    {doneTasks}/{agentTasks.length} 卡
                                  </div>
                                  <div className="text-[11px] font-sans text-slate-400 mt-0.5">
                                    本项任务
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <div className="font-semibold text-slate-300">—</div>
                                  <div className="text-[11px] font-sans text-slate-400 mt-0.5">
                                    {projectNames.length > 0 ? '他项执行' : '未派单'}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Col 4: Rating & Active Lease Period */}
                            <div className="flex items-center justify-between @[860px]:block text-xs">
                              <span className="text-[11px] text-slate-400 @[860px]:hidden">评级 / 租期</span>
                              <div>
                                <div className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[11px] font-bold leading-none ${
                                      tierRating.capability === 'S'
                                        ? 'bg-violet-50 text-violet-700 border border-violet-200/80'
                                        : tierRating.capability === 'A+'
                                          ? 'bg-blue-50 text-blue-700 border border-blue-200/80'
                                          : 'bg-slate-100 text-slate-700 border border-slate-200/80'
                                    }`}
                                  >
                                    {tierRating.capability}级
                                  </span>
                                  <span className="font-semibold text-slate-900">
                                    {isPrivate
                                      ? '自建免租'
                                      : activeLease
                                        ? `$${activeLease.priceUsd}${LEASE_PERIOD_META[activeLease.period].unitSuffix}`
                                        : `$${pricing.monthlyUsd}/月`}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-1 truncate">
                                  {isPrivate
                                    ? `算力成本 ${tierRating.costLabel}`
                                    : activeLease
                                      ? activeLease.expiresLabel
                                      : '待选择租期（周/月/季）'}
                                </div>
                              </div>
                            </div>

                            {/* Col 5: Actions + Dropdown (with Lease Renewal) */}
                            <div
                              ref={isMenuOpen ? actionMenuContainerRef : undefined}
                              className="relative flex items-center justify-end gap-1.5 shrink-0"
                            >
                              {isWorkingInCurrent ? (
                                <button
                                  type="button"
                                  onClick={() => onReleaseAgent(agent.id)}
                                  title={`移出「${workspace.name}」工作区`}
                                  className="w-[96px] inline-flex items-center justify-center gap-1 h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  <UserMinus className="w-3.5 h-3.5 shrink-0" />
                                  <span>移出项目</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onHireAgent(agent.id)}
                                  className="w-[96px] inline-flex items-center justify-center gap-1 h-8 px-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-900 hover:text-white hover:border-slate-900 text-xs font-semibold text-slate-800 transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  <UserPlus className="w-3.5 h-3.5 shrink-0" />
                                  <span>加入工作区</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() =>
                                  setOpenActionMenuId((prev) => (prev === agent.id ? null : agent.id))
                                }
                                aria-label="更多操作"
                                aria-expanded={isMenuOpen}
                                title="更多操作"
                                className={`w-8 h-8 inline-flex items-center justify-center rounded-lg border transition-colors cursor-pointer shrink-0 ${
                                  isMenuOpen
                                    ? 'border-slate-400 bg-slate-100 text-slate-900'
                                    : 'border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                                }`}
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </button>

                              {isMenuOpen && (
                                <div
                                  className={`absolute right-0 z-30 w-52 rounded-xl border border-slate-200 bg-white shadow-lg py-1.5 text-xs ${
                                    openUpwards ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                                  }`}
                                >
                                  <div className="px-3 py-1 text-[10px] font-semibold text-slate-400">
                                    {isPrivate ? '自建 Agent 管理' : '租赁周期与外雇操作'}
                                  </div>

                                  {isPrivate ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenActionMenuId(null);
                                          onToggleMarketListing(agent.id, activeZone.id);
                                        }}
                                        className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-50 transition-colors cursor-pointer text-slate-700"
                                      >
                                        <Globe
                                          className={`w-3.5 h-3.5 shrink-0 ${
                                            isListedInActiveZone ? 'text-emerald-600' : 'text-slate-500'
                                          }`}
                                        />
                                        <span className="truncate">
                                          {isListedInActiveZone
                                            ? `下架「${activeZone.name}」`
                                            : `上架「${activeZone.name}」出租`}
                                        </span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenActionMenuId(null);
                                          openEditDrawer(agent);
                                        }}
                                        className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-50 transition-colors cursor-pointer text-slate-700"
                                      >
                                        <Settings2 className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                                        <span>配置引擎、模型与专区</span>
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      {(['week', 'month', 'quarter'] as LeasePeriod[]).map((period) => {
                                        const meta = LEASE_PERIOD_META[period];
                                        const isCurrentPeriod = activeLease?.period === period;
                                        return (
                                          <button
                                            key={period}
                                            type="button"
                                            onClick={() => {
                                              setOpenActionMenuId(null);
                                              onLeaseAgent(agent.id, period, workspace.id);
                                            }}
                                            className="w-full px-3 py-1.5 text-left flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors cursor-pointer text-slate-700"
                                          >
                                            <span className="inline-flex items-center gap-1.5">
                                              <CalendarClock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                              <span>
                                                续租 {meta.label}
                                                {isCurrentPeriod ? ' (当前)' : ''}
                                              </span>
                                            </span>
                                            <span className="font-mono text-[11px] text-slate-500">
                                              ${pricing.getPriceForPeriod(period)}
                                            </span>
                                          </button>
                                        );
                                      })}
                                      <div className="my-1 border-t border-slate-100" />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenActionMenuId(null);
                                          onJumpToMarket();
                                        }}
                                        className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 transition-colors cursor-pointer text-slate-700"
                                      >
                                        <ArrowUpRight className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                                        <span>前往服务市场查看</span>
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* ================= COLLABORATING EXPERTS & MUTUAL FRIENDS SECTION ================= */
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-500">
                    {teamSection === 'collaborators' ? (
                      <span>
                        管理存在<strong className="text-slate-800">项目合作</strong>关系的专业人类专家，支持按专业类目与来源空间快速调度至「
                        <strong className="text-slate-800">{workspace.name}</strong>」
                      </span>
                    ) : (
                      <span>
                        管理来自各社区空间的<strong className="text-slate-800">相互关注（互加好友）</strong>人脉，支持随时发起咨询或邀请加入项目「
                        <strong className="text-slate-800">{workspace.name}</strong>」
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-mono tabular-nums text-slate-400 shrink-0">
                    共 {displayedTeamExperts.length}{' '}
                    {teamSection === 'friends' ? '位好友' : '位合作专家'}
                  </div>
                </div>

                {displayedTeamExperts.length === 0 ? (
                  <div className="py-14 text-center border border-dashed border-slate-300 rounded-xl bg-white space-y-3">
                    <p className="text-sm font-medium text-slate-700">
                      {teamSection === 'friends'
                        ? '当前筛选下暂无互关好友'
                        : '当前筛选下暂无合作专家'}
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      {(categoryFilter !== 'all' ||
                        expertZoneFilter !== 'all' ||
                        expertAssignFilter !== 'all' ||
                        searchKeyword.trim() !== '') && (
                        <button
                          type="button"
                          onClick={() => {
                            setCategoryFilter('all');
                            setExpertZoneFilter('all');
                            setExpertAssignFilter('all');
                            setSearchKeyword('');
                          }}
                          className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer"
                        >
                          重置筛选条件
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setDrawerOpen(false);
                          setInviteRelation(
                            teamSection === 'friends' ? 'mutual_friend' : 'project_collab',
                          );
                          setInviteDrawerOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>{teamSection === 'friends' ? '添加好友' : '添加合作专家'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl bg-white mb-16">
                    {/* Desktop Column Header */}
                    <div className="hidden @[860px]:grid @[860px]:grid-cols-[minmax(0,1fr)_156px_168px_108px_144px] @[860px]:items-center @[860px]:gap-4 px-5 py-2.5 bg-slate-50/90 border-b border-slate-200 rounded-t-xl text-[11px] font-semibold text-slate-500">
                      <div>{teamSection === 'friends' ? '好友与擅长方向' : '合作专家与擅长方向'}</div>
                      <div>关系 / 来源空间</div>
                      <div>合作项目</div>
                      <div>评级 / 履约</div>
                      <div className="text-right">操作</div>
                    </div>

                    <div className="divide-y divide-slate-200">
                      {displayedTeamExperts.map(({ membership, expert, ownedAgents }, rowIndex) => {
                        const isAssignedToCurrent = (workspace.hiredExpertIds || []).includes(
                          expert.id,
                        );
                        const assignedProjects = workspaces.filter((w) =>
                          (w.hiredExpertIds || []).includes(expert.id),
                        );
                        const sourceZoneName = getZoneName(membership.sourceZoneId) || '开放空间';
                        const isMenuOpen = openActionMenuId === `exp_${expert.id}`;
                        const openUpwards =
                          displayedTeamExperts.length >= 3 &&
                          rowIndex >= displayedTeamExperts.length - 2;
                        const primaryAgent = ownedAgents[0];

                        return (
                          <div
                            key={expert.id}
                            className="px-4 sm:px-5 py-4 hover:bg-slate-50/60 transition-colors flex flex-col gap-3.5 @[860px]:grid @[860px]:grid-cols-[minmax(0,1fr)_156px_168px_108px_144px] @[860px]:items-center @[860px]:gap-4 last:rounded-b-xl"
                          >
                            {/* Col 1: Expert Identity, Specialty & Built-in Agents */}
                            <div className="flex items-start gap-3.5 min-w-0">
                              <EntityAvatar
                                kind="human"
                                code={expert.avatarInitials}
                                accent={expert.avatarAccent}
                                size="lg"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                                  <span className="text-sm font-bold text-slate-900">
                                    {expert.name}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium whitespace-nowrap">
                                    {AGENT_CATEGORY_LABELS[expert.category]}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-violet-50 border border-violet-200/80 text-violet-700 font-mono text-[10px] font-bold">
                                    {expert.ratingTier || 'A+'}级
                                  </span>
                                  <span className="text-slate-500 truncate">{expert.title}</span>
                                </div>

                                <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-700">
                                  <Briefcase className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span className="truncate font-medium">
                                    擅长方向：{membership.outsourcingScope || expert.outsourcingDomain || expert.specialties[0] || ''}
                                  </span>
                                </div>

                                <div className="mt-1.5 text-[11px] text-slate-500 truncate">
                                  内建 {ownedAgents.length} 个专业 Agent：
                                  {ownedAgents.length > 0
                                    ? ownedAgents.map((a) => displayEntityName(a.handle)).join('、')
                                    : '按需配置'}
                                </div>
                              </div>
                            </div>

                            {/* Col 2: Relation & Source Space */}
                            <div className="flex items-center justify-between @[860px]:block text-xs">
                              <span className="text-[11px] text-slate-400 @[860px]:hidden">关系 / 来源空间</span>
                              <div>
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                                    membership.relation === 'mutual_friend'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                                      : 'bg-blue-50 text-blue-700 border border-blue-200/80'
                                  }`}
                                >
                                  {membership.relation === 'mutual_friend' ? '互关好友' : '项目合作'}
                                </span>
                                <div className="text-[11px] text-slate-500 mt-1 truncate">
                                  空间：{sourceZoneName}
                                </div>
                              </div>
                            </div>

                            {/* Col 3: Collaborating Projects */}
                            <div className="flex items-center justify-between @[860px]:block text-xs">
                              <span className="text-[11px] text-slate-400 @[860px]:hidden">合作项目</span>
                              <div className="min-w-0">
                                {assignedProjects.length > 0 ? (
                                  <>
                                    <div className="font-medium text-slate-800 truncate">
                                      {assignedProjects.map((p) => p.name).join('、')}
                                    </div>
                                    <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                                      参与 {assignedProjects.length} 个项目
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-slate-400">互关好友 · 暂未入项</div>
                                )}
                              </div>
                            </div>

                            {/* Col 4: Rating & Track Record */}
                            <div className="flex items-center justify-between @[860px]:block text-xs font-mono tabular-nums">
                              <span className="text-[11px] font-sans text-slate-400 @[860px]:hidden">评级 / 履约</span>
                              <div>
                                <div className="font-semibold text-slate-900">
                                  信誉 {expert.reputationScore}
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  {expert.completedProjects} 交付
                                </div>
                              </div>
                            </div>

                            {/* Col 5: Actions */}
                            <div
                              ref={isMenuOpen ? actionMenuContainerRef : undefined}
                              className="relative flex items-center justify-end gap-1.5 shrink-0"
                            >
                              {isAssignedToCurrent ? (
                                <button
                                  type="button"
                                  onClick={() => onRemoveExpertFromWorkspace(expert.id, workspace.id)}
                                  className="w-[96px] inline-flex items-center justify-center gap-1 h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  <UserMinus className="w-3.5 h-3.5 shrink-0" />
                                  <span>移出项目</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onAssignExpertToWorkspace(expert.id, workspace.id)}
                                  className="w-[96px] inline-flex items-center justify-center gap-1 h-8 px-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-900 hover:text-white hover:border-slate-900 text-xs font-semibold text-slate-800 transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  <UserPlus className="w-3.5 h-3.5 shrink-0" />
                                  <span>派驻项目</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() =>
                                  setOpenActionMenuId((prev) =>
                                    prev === `exp_${expert.id}` ? null : `exp_${expert.id}`,
                                  )
                                }
                                aria-label="专家更多操作"
                                aria-expanded={isMenuOpen}
                                className={`w-8 h-8 inline-flex items-center justify-center rounded-lg border transition-colors cursor-pointer shrink-0 ${
                                  isMenuOpen
                                    ? 'border-slate-400 bg-slate-100 text-slate-900'
                                    : 'border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                                }`}
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </button>

                              {isMenuOpen && (
                                <div
                                  className={`absolute right-0 z-30 w-48 rounded-xl border border-slate-200 bg-white shadow-lg py-1.5 text-xs ${
                                    openUpwards ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                                  }`}
                                >
                                  <div className="px-3 py-1 text-[10px] font-semibold text-slate-400">
                                    专家关系管理
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      onUpdateTeamExpertRelation(
                                        expert.id,
                                        membership.relation === 'mutual_friend'
                                          ? 'project_collab'
                                          : 'mutual_friend',
                                      );
                                    }}
                                    className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-50 transition-colors cursor-pointer text-slate-700"
                                  >
                                    <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                      <span>
                                        {membership.relation === 'mutual_friend'
                                          ? '转为合作专家'
                                          : '转入我的好友'}
                                      </span>
                                    </button>

                                    {primaryAgent && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenActionMenuId(null);
                                          onStartNegotiation(primaryAgent.id);
                                        }}
                                        className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-50 transition-colors cursor-pointer text-slate-700"
                                      >
                                        <MessageCircle className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                        <span>咨询</span>
                                      </button>
                                    )}

                                    <div className="my-1 border-t border-slate-100" />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionMenuId(null);
                                        onRemoveTeamExpert(expert.id);
                                      }}
                                      className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-red-50 transition-colors cursor-pointer text-red-600"
                                    >
                                      <UserMinus className="w-3.5 h-3.5 shrink-0" />
                                      <span>
                                        {membership.relation === 'mutual_friend'
                                          ? '移出我的好友'
                                          : '移出合作专家'}
                                      </span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Unified Right Slide-in Drawer: Single Entry for Adding Private or External Agents */}
        {drawerOpen && (
          <aside className="fixed inset-y-0 right-0 z-40 lg:static lg:z-auto w-full max-w-[440px] lg:w-[430px] shrink-0 border-l border-slate-200 bg-white flex flex-col h-full shadow-2xl lg:shadow-none">
            <div className="px-5 pt-4 pb-3 border-b border-slate-200 bg-slate-50/70 space-y-3 shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    {editingId !== 'new'
                      ? `配置自建 Agent · ${displayEntityName(handle)}`
                      : '添加 Agent 成员'}
                  </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  统一入口：挂载自建 Agent 节点，或直接引入外雇 Agent 专家协同工作。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 cursor-pointer"
                aria-label="关闭添加抽屉"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editingId === 'new' && (
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-200/70 rounded-lg">
                <button
                  type="button"
                  onClick={() => setDrawerMode('private')}
                  className={`py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    drawerMode === 'private'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  挂载自建 Agent
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerMode('external')}
                  className={`py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    drawerMode === 'external'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  引入外雇 Agent
                </button>
              </div>
            )}
          </div>

          {drawerMode === 'external' && editingId === 'new' ? (
            /* Drawer Mode B: Browse & Add External Agents by Category */
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-2 shrink-0">
                <select
                  value={externalCatFilter}
                  onChange={(e) => setExternalCatFilter(e.target.value as 'all' | AgentCategory)}
                  aria-label="筛选外雇 Agent 类目"
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                >
                  {AGENT_CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] font-mono text-slate-400">
                  {externalCandidates.length} 个可选节点
                </span>
              </div>

              <div className="flex-1 overflow-y-auto clean-scroll p-4 space-y-2.5">
                {externalCandidates.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-500">
                    该类目暂无外雇 Agent 节点
                  </div>
                ) : (
                  externalCandidates.map((cand) => {
                    const alreadyWorking = hiredIds.includes(cand.id);
                    const candPricing = getAgentLeasePricing({
                      runtimeAgent: cand.runtimeAgent,
                      defaultModel: cand.defaultModel,
                      capabilityTier: cand.performance.capabilityTier,
                      ownership: cand.ownership,
                      projectPriceUsd: cand.projectPriceUsd,
                      monthlyLeaseUsd: cand.monthlyLeaseUsd,
                    });
                    return (
                      <div
                        key={cand.id}
                        className="rounded-xl border border-slate-200 p-3.5 bg-white hover:border-slate-300 transition-colors space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <EntityAvatar
                              kind="agent"
                              code={cand.avatarCode}
                              accent={cand.avatarAccent}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <AgentIdentityName
                                name={cand.handle}
                                runtime={cand.runtimeAgent}
                                model={cand.defaultModel}
                                showModel
                                className="text-xs font-bold text-slate-900"
                              />
                              <div className="text-[11px] text-slate-500 truncate mt-0.5 font-mono tabular-nums">
                                <span className="font-sans">{AGENT_CATEGORY_LABELS[cand.category]}</span> ·{' '}
                                {candPricing.rating.capability}级 · ${candPricing.monthlyUsd}/月
                              </div>
                            </div>
                          </div>

                          {alreadyWorking ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 shrink-0 whitespace-nowrap">
                              <Check className="w-3.5 h-3.5" />
                              已在项目
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onLeaseAgent(cand.id, 'month', workspace.id)}
                              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-white cursor-pointer shrink-0 whitespace-nowrap"
                            >
                              按月租赁
                            </button>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                          {cand.title}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-4 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2 shrink-0">
                <span className="text-[11px] text-slate-500">想按社区深度筛选或先议价？</span>
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    if (externalCatFilter !== 'all') {
                      onRecruitCategory(externalCatFilter);
                    } else {
                      onJumpToMarket();
                    }
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer whitespace-nowrap"
                >
                  <span>去市场浏览更多</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            /* Drawer Mode A: Mount / Edit Private Agent */
            <form
              onSubmit={handleSaveDrawer}
              className="flex-1 min-h-0 flex flex-col overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto clean-scroll p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-medium text-slate-700">Agent 名称</span>
                    <input
                      type="text"
                      value={handle}
                      onChange={(e) => setHandle(e.target.value)}
                      required
                      className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-medium text-slate-700">Agent 类目</span>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as AgentCategory)}
                      className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    >
                      <option value="engineering">研发开发</option>
                      <option value="product">产品策划</option>
                      <option value="design">设计体验</option>
                      <option value="architecture">架构审查</option>
                      <option value="qa">测试质量</option>
                      <option value="media">自媒体运营</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-xs font-medium text-slate-700">本体 Agent 引擎</span>
                    <select
                      value={runtimeAgent}
                      onChange={(e) => {
                        const nextRuntime = e.target.value;
                        setRuntimeAgent(nextRuntime);
                        setDefaultModel(getRuntimePreset(nextRuntime).defaultModel);
                      }}
                      className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    >
                      {AGENT_RUNTIME_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-xs font-medium text-slate-700">默认底层模型</span>
                    <select
                      value={defaultModel}
                      onChange={(e) => setDefaultModel(e.target.value)}
                      className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    >
                      {Array.from(
                        new Set([defaultModel, ...getRuntimePreset(runtimeAgent).models]),
                      ).map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block col-span-2">
                    <span className="text-xs font-medium text-slate-700">核心能力定位</span>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-medium text-slate-700">对外项目挂牌价 (USD)</span>
                    <input
                      type="number"
                      step="100"
                      min="500"
                      max="20000"
                      value={projectPriceUsd}
                      onChange={(e) => setProjectPriceUsd(Number(e.target.value))}
                      className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-medium text-slate-700">运行节点位置</span>
                    <input
                      type="text"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </label>
                </div>

                {/* Multi-Zone Market Listing Selector */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      可选：对外上架接单专区（不选则仅私有自用）
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {zones.map((z) => {
                      const checked = listedZoneIds.includes(z.id);
                      return (
                        <label
                          key={z.id}
                          className={`flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                            checked
                              ? 'bg-white border-blue-300'
                              : 'bg-white/60 border-slate-200 hover:bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleDrawerZone(z.id)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-600/20"
                            />
                            <span
                              className="w-5 h-5 rounded text-[10px] font-bold text-white inline-flex items-center justify-center shrink-0"
                              style={{ backgroundColor: z.accentColor }}
                            >
                              {z.shortCode}
                            </span>
                            <span className="text-xs font-semibold text-slate-900 truncate">
                              {z.name}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 shrink-0 whitespace-nowrap">
                            {z.typeLabel}
                          </span>
                        </label>
                      );
                    })}
                  </div>
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
                  <span className="text-xs font-medium text-slate-700">节点简介</span>
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
                  {listedZoneIds.length > 0
                    ? `保存并上架 (${listedZoneIds.length} 个专区)`
                    : '保存自建 Agent'}
                </button>
              </div>
            </form>
          )}
        </aside>
      )}

      {/* Community Invite Expert Slide-in Drawer */}
      {inviteDrawerOpen && (
        <aside className="fixed inset-y-0 right-0 z-40 lg:static lg:z-auto w-full max-w-[440px] lg:w-[430px] shrink-0 border-l border-slate-200 bg-white flex flex-col h-full shadow-2xl lg:shadow-none">
          <div className="px-5 pt-4 pb-3 border-b border-slate-200 bg-slate-50/70 space-y-3 shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  {inviteRelation === 'mutual_friend' ? '添加互关好友' : '添加合作专家'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  按来源空间筛选并加入「合作专家」或「我的好友」，支持同步派驻当前项目。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInviteDrawerOpen(false)}
                className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 cursor-pointer"
                aria-label="关闭添加专家抽屉"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                value={inviteZoneFilter}
                onChange={(e) => setInviteZoneFilter(e.target.value)}
                aria-label="筛选来源空间"
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              >
                <option value="all">全部空间</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>

              <select
                value={inviteRelation}
                onChange={(e) => setInviteRelation(e.target.value as ExpertRelationType)}
                aria-label="选择关系类型"
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              >
                <option value="project_collab">加入合作专家</option>
                <option value="mutual_friend">加入我的好友（互关）</option>
              </select>
            </div>

            <select
              value={inviteWorkspaceId}
              onChange={(e) => setInviteWorkspaceId(e.target.value)}
              aria-label="可选同步派驻项目"
              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            >
              <option value="">暂不派驻项目</option>
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  同步派驻项目：{ws.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 overflow-y-auto clean-scroll p-4 space-y-2.5">
            {inviteCandidates.map(({ expert, ownedAgents, membership }) => {
              const zoneNames = expert.zoneIds
                .map((id) => getZoneName(id))
                .filter(Boolean)
                .slice(0, 2)
                .join(' / ');

              return (
                <div
                  key={expert.id}
                  className="rounded-xl border border-slate-200 p-3.5 bg-white hover:border-slate-300 transition-colors space-y-2"
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <EntityAvatar
                        kind="human"
                        code={expert.avatarInitials}
                        accent={expert.avatarAccent}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900">{expert.name}</span>
                          <span className="px-1 py-0.5 rounded bg-violet-50 border border-violet-200 text-[10px] font-mono font-bold text-violet-700 leading-none">
                            {expert.ratingTier || 'A+'}级
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          空间：{zoneNames} · 内建 {ownedAgents.length} 个 Agent
                        </div>
                      </div>
                    </div>

                    {membership ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 shrink-0 whitespace-nowrap">
                        <Check className="w-3.5 h-3.5" />
                        <span>{membership.relation === 'mutual_friend' ? '互关好友' : '项目合作'}</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          onInviteTeamExpert({
                            expertId: expert.id,
                            relation: inviteRelation,
                            targetWorkspaceId: inviteWorkspaceId || undefined,
                            sourceZoneId:
                              inviteZoneFilter !== 'all' ? inviteZoneFilter : expert.zoneIds[0],
                            outsourcingScope: expert.outsourcingDomain || expert.specialties[0] || '',
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-white cursor-pointer shrink-0 whitespace-nowrap"
                      >
                        {inviteRelation === 'mutual_friend' ? '互关加入' : '加入合作'}
                      </button>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-700 font-medium truncate">
                    擅长方向：{expert.outsourcingDomain || expert.specialties[0] || ''}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      )}
    </div>
  );
}
