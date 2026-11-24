import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Briefcase,
  CalendarClock,
  Check,
  Cloud,
  Compass,
  Cpu,
  Database,
  Globe,
  MessageCircle,
  MessageSquareCode,
  MoreHorizontal,
  Plus,
  Server,
  Settings2,
  Sparkles,
  Terminal,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { CollabSpacesPanel } from '../workspace/CollabSpacesPanel';
import { SpaceNodesPanel, type NodeDrawerMode } from '../workspace/SpaceNodesPanel';
import { SpaceStoragePanel } from '../workspace/SpaceStoragePanel';
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
  CliAuthMode,
  CliToolType,
  CommunityPost,
  CommunityZone,
  ComputeNode,
  ExpertAgent,
  ExpertRelationType,
  HumanExpert,
  LeasePeriod,
  NodeCliEntry,
  NodeOsType,
  ProjectWorkspace,
  SpaceMemberRole,
  SpaceSharedNode,
  StorageBillingMode,
  StorageVolume,
  TeamExpertMembership,
  TeamSectionTab,
  WorkflowTask,
  ZoneProjectOpportunity,
} from '../../types/agentnexus';

interface MyTeamViewProps {
  zones: CommunityZone[];
  allZones: CommunityZone[];
  joinedZoneIds: string[];
  activeZone: CommunityZone;
  communityPosts: CommunityPost[];
  zoneProjects: ZoneProjectOpportunity[];
  pendingSpaceApplicationsCount?: number;
  onOpenAssistant?: () => void;
  workspace: ProjectWorkspace;
  workspaces: ProjectWorkspace[];
  allAgents: ExpertAgent[];
  computeNodes: ComputeNode[];
  spaceSharedNodes: SpaceSharedNode[];
  storageVolumes: StorageVolume[];
  humanExperts: HumanExpert[];
  agentLeases: Record<string, AgentLeaseRecord>;
  teamExperts: TeamExpertMembership[];
  hiredAgents: ExpertAgent[];
  privateAgents: ExpertAgent[];
  hiredIds: string[];
  tasks: WorkflowTask[];
  openMountDrawerSignal: number;
  teamSectionSeed?: TeamSectionTab | null;
  onClearTeamSectionSeed?: () => void;
  onBreadcrumbContextChange?: (ctx: {
    section: TeamSectionTab;
    managedZoneName?: string | null;
  }) => void;
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
  onOpenTaskSession?: (taskId: string) => void;
  onOpenAgentTaskSession?: (agentId: string) => void;
  onSavePrivateAgent: (expert: ExpertAgent, isNew: boolean) => void;
  onToggleMarketListing: (agentId: string, targetZoneId?: string) => void;
  onRecruitCategory: (category: 'all' | AgentCategory) => void;
  onJumpToMarket: () => void;
  onMountPrivateNode: (input: {
    name: string;
    os: NodeOsType;
    osVersion: string;
    region: string;
    cpuCores: number;
    memoryGb: number;
    storageQuotaGb: number;
    description: string;
  }) => string;
  onProvisionCloudNode: (input: {
    name: string;
    os: NodeOsType;
    osVersion: string;
    region: string;
    cpuCores: number;
    memoryGb: number;
    gpuSpec?: string;
    storageQuotaGb: number;
    monthlyCostUsd: number;
    description: string;
  }) => string;
  onToggleNodeStatus: (nodeId: string) => void;
  onRemoveComputeNode: (nodeId: string) => void;
  onAddNodeCli: (
    nodeId: string,
    input: {
      cliTool: CliToolType;
      runtimeAgent: string;
      defaultModel: string;
      authMode: CliAuthMode;
      credentialLabel: string;
      concurrency: number;
    },
  ) => string;
  onUpdateNodeCli: (
    nodeId: string,
    cliId: string,
    patch: Partial<Omit<NodeCliEntry, 'id'>>,
  ) => void;
  onRemoveNodeCli: (nodeId: string, cliId: string) => void;
  onToggleNodeStorageMount: (nodeId: string, volumeId: string) => void;
  onCreateStorageVolume: (input: {
    name: string;
    tierLabel: string;
    region: string;
    quotaGb: number;
    billingMode: StorageBillingMode;
    priceUsd: number;
    encrypted: boolean;
    boundNodeIds: string[];
    boundProjectIds: string[];
  }) => string;
  onExpandStorageVolume: (volumeId: string, addGb: number) => void;
  onToggleJoinZone: (zoneId: string) => void;
  onCreateCollabZone: (input: {
    name: string;
    shortCode: string;
    kind: 'community' | 'enterprise';
    regionCulture: string;
    tagline: string;
    focusDomains: string[];
    accentColor: string;
    inviteCode?: string;
  }) => string;
  onDeleteCollabZone: (zoneId: string) => void;
  onJumpToZoneMarket: (zoneId: string) => void;
  onJumpToZoneDiscover: (zoneId: string) => void;
  onInviteSpaceMember: (
    zoneId: string,
    input: {
      humanExpertId?: string;
      name: string;
      title: string;
      role: SpaceMemberRole;
      avatarInitials?: string;
      avatarAccent?: string;
    },
  ) => void;
  onUpdateSpaceMemberRole: (zoneId: string, memberId: string, role: SpaceMemberRole) => void;
  onKickSpaceMember: (zoneId: string, memberId: string) => void;
  onAddSpaceSharedNode: (
    zoneId: string,
    input: {
      name: string;
      os: NodeOsType;
      osVersion: string;
      origin: 'private' | 'cloud';
      region: string;
      cpuCores: number;
      memoryGb: number;
      gpuSpec?: string;
      supportedClis: string[];
      sharedSandboxQuota: number;
      accessPolicy: 'all_members' | 'admins_only';
      monthlyCostUsd: number;
    },
  ) => void;
  onToggleSpaceSharedNodeStatus: (nodeId: string) => void;
  onUpdateSpaceSharedNode: (
    nodeId: string,
    patch: Partial<Pick<SpaceSharedNode, 'sharedSandboxQuota' | 'accessPolicy'>>,
  ) => void;
  onRemoveSpaceSharedNode: (nodeId: string) => void;
  onToggleSpaceAgentOnline: (zoneId: string, agentId: string) => void;
  onPublishAgentToSpace: (zoneId: string, agentId: string) => void;
  onRemoveAgentFromSpace: (zoneId: string, agentId: string) => void;
}

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
  allZones,
  joinedZoneIds,
  activeZone,
  communityPosts,
  zoneProjects,
  pendingSpaceApplicationsCount = 0,
  onOpenAssistant,
  workspace,
  workspaces,
  allAgents,
  computeNodes,
  spaceSharedNodes,
  storageVolumes,
  humanExperts,
  agentLeases,
  teamExperts,
  hiredAgents,
  privateAgents,
  hiredIds,
  tasks,
  openMountDrawerSignal,
  teamSectionSeed,
  onClearTeamSectionSeed,
  onBreadcrumbContextChange,
  onHireAgent,
  onReleaseAgent,
  onLeaseAgent,
  onInviteTeamExpert,
  onAssignExpertToWorkspace,
  onRemoveExpertFromWorkspace,
  onUpdateTeamExpertRelation,
  onRemoveTeamExpert,
  onStartNegotiation,
  onOpenTaskSession,
  onOpenAgentTaskSession,
  onSavePrivateAgent,
  onToggleMarketListing,
  onRecruitCategory,
  onJumpToMarket,
  onMountPrivateNode,
  onProvisionCloudNode,
  onToggleNodeStatus,
  onRemoveComputeNode,
  onAddNodeCli,
  onUpdateNodeCli,
  onRemoveNodeCli,
  onToggleNodeStorageMount,
  onCreateStorageVolume,
  onExpandStorageVolume,
  onToggleJoinZone,
  onCreateCollabZone,
  onDeleteCollabZone,
  onJumpToZoneMarket,
  onJumpToZoneDiscover,
  onInviteSpaceMember,
  onUpdateSpaceMemberRole,
  onKickSpaceMember,
  onAddSpaceSharedNode,
  onToggleSpaceSharedNodeStatus,
  onUpdateSpaceSharedNode,
  onRemoveSpaceSharedNode,
  onToggleSpaceAgentOnline,
  onPublishAgentToSpace,
  onRemoveAgentFromSpace,
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

  // Infrastructure Settings (Agent Nodes & Agent Storage) state
  const [nodeOsFilter, setNodeOsFilter] = useState<'all' | NodeOsType>('all');
  const [nodeOriginFilter, setNodeOriginFilter] = useState<'all' | 'private' | 'cloud'>('all');
  const [nodeDrawerMode, setNodeDrawerMode] = useState<NodeDrawerMode>(null);
  const [volumeBillingFilter, setVolumeBillingFilter] = useState<'all' | StorageBillingMode>('all');
  const [volumeDrawerOpen, setVolumeDrawerOpen] = useState(false);

  // Collaboration Spaces (协作空间) state
  const [collabKindFilter, setCollabKindFilter] = useState<'all' | 'open' | 'enterprise'>('all');
  const [collabRoleFilter, setCollabRoleFilter] = useState<'all' | 'managed' | 'joined'>('all');
  const [createZoneDrawerOpen, setCreateZoneDrawerOpen] = useState(false);
  const [managedZoneId, setManagedZoneId] = useState<string | null>(
    () => allZones.find((z) => z.createdByMe || z.isCurrentUserPrincipal)?.id || null,
  );

  const onlineNodesCount = computeNodes.filter((n) => n.status === 'online').length;
  const managedZones = useMemo(
    () => allZones.filter((z) => Boolean(z.createdByMe || z.isCurrentUserPrincipal)),
    [allZones],
  );
  const activeManagedZone = useMemo(
    () => managedZones.find((z) => z.id === managedZoneId) || managedZones[0] || null,
    [managedZoneId, managedZones],
  );
  const discoverableUnjoinedCount = Math.max(0, allZones.length - zones.length);

  useEffect(() => {
    if (teamSectionSeed) {
      setTeamSection(teamSectionSeed);
      onClearTeamSectionSeed?.();
    }
  }, [teamSectionSeed, onClearTeamSectionSeed]);

  useEffect(() => {
    onBreadcrumbContextChange?.({
      section: teamSection,
      managedZoneName: teamSection === 'collab_manage' ? activeManagedZone?.name || null : null,
    });
  }, [activeManagedZone?.name, onBreadcrumbContextChange, teamSection]);

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

  // Private Agent Form State (built on mounted/rented Space Nodes & configured Agent CLIs)
  const [hostNodeId, setHostNodeId] = useState<string>('');
  const [hostCliId, setHostCliId] = useState<string>('');
  const [storageVolumeId, setStorageVolumeId] = useState<string>('');
  const [handle, setHandle] = useState('@我的私有特工');
  const [name, setName] = useState('Nova · 领域私有交付 Agent');
  const [title, setTitle] = useState('自动化工作流执行与专项产出');
  const [category, setCategory] = useState<AgentCategory>('engineering');
  const [runtimeAgent, setRuntimeAgent] = useState<string>('Claude Code');
  const [defaultModel, setDefaultModel] = useState<string>('Claude 4.5 Sonnet');
  const [region, setRegion] = useState('本地 anx-worker 私有节点');
  const [projectPriceUsd, setProjectPriceUsd] = useState(1800);
  const [bio, setBio] = useState(
    '基于 AGN 空间已挂载/租用的 Agent 节点与 CLI 构建的自建专业 Agent，内部项目免费调用，闲时可勾选上架社区服务市场对外租赁。',
  );
  const [skills, setSkills] = useState<string[]>(['领域知识库检索', '自动化脚本执行', '产出质量自检']);
  const [mcpTools, setMcpTools] = useState<string[]>(['Git-PR', 'Sandbox-Runner']);
  const [listedZoneIds, setListedZoneIds] = useState<string[]>([]);
  const [newSkillInput, setNewSkillInput] = useState('');

  const [aiOptimizing, setAiOptimizing] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const zoneMap = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);
  const nodeMap = useMemo(() => new Map(computeNodes.map((n) => [n.id, n])), [computeNodes]);
  const accessibleSharedNodes = useMemo(
    () =>
      spaceSharedNodes.filter((n) => {
        const z = zoneMap.get(n.zoneId);
        if (!z) return false;
        if (n.accessPolicy === 'admins_only' && !(z.createdByMe || z.isCurrentUserPrincipal)) {
          return false;
        }
        return true;
      }),
    [spaceSharedNodes, zoneMap],
  );
  const sharedNodeMap = useMemo(
    () => new Map(spaceSharedNodes.map((n) => [n.id, n])),
    [spaceSharedNodes],
  );
  const volumeMap = useMemo(() => new Map(storageVolumes.map((v) => [v.id, v])), [storageVolumes]);
  const getCliUsedSlots = (nodeId: string, cliId: string, excludeAgentId?: string) =>
    privateAgents.filter(
      (a) =>
        a.id !== excludeAgentId &&
        a.hostNodeId === nodeId &&
        a.hostCliId === cliId,
    ).length;

  const excludeEditingId = editingId === 'new' ? undefined : editingId;
  const selectedHostNode = hostNodeId ? nodeMap.get(hostNodeId) || null : null;
  const selectedSharedNode = hostNodeId ? sharedNodeMap.get(hostNodeId) || null : null;
  const selectedSharedZone = selectedSharedNode
    ? zoneMap.get(selectedSharedNode.zoneId) || null
    : null;
  const selectedHostCli =
    selectedHostNode?.installedClis.find((c) => c.id === hostCliId) || null;
  const selectedCliUsed =
    selectedHostNode && selectedHostCli
      ? getCliUsedSlots(selectedHostNode.id, selectedHostCli.id, excludeEditingId)
      : 0;
  const selectedSharedBoundByMe = selectedSharedNode
    ? privateAgents.filter(
        (a) => a.id !== excludeEditingId && a.hostNodeId === selectedSharedNode.id,
      ).length
    : 0;
  const selectedSharedUsed = selectedSharedNode
    ? selectedSharedNode.usedSandboxes + selectedSharedBoundByMe
    : 0;
  const selectedCliFull = Boolean(
    (selectedHostNode &&
      selectedHostCli &&
      selectedCliUsed >= selectedHostCli.concurrency) ||
      (selectedSharedNode && selectedSharedUsed >= selectedSharedNode.sharedSandboxQuota),
  );

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

  const handleSelectHostNode = (nextNodeId: string) => {
    setHostNodeId(nextNodeId);
    const node = computeNodes.find((n) => n.id === nextNodeId);
    if (node) {
      setRegion(node.name);
      const defaultCli =
        node.installedClis.find(
          (c) => c.enabled && getCliUsedSlots(node.id, c.id, excludeEditingId) < c.concurrency,
        ) ||
        node.installedClis.find(
          (c) => getCliUsedSlots(node.id, c.id, excludeEditingId) < c.concurrency,
        ) ||
        node.installedClis.find((c) => c.enabled) ||
        node.installedClis[0] ||
        null;
      if (defaultCli) {
        setHostCliId(defaultCli.id);
        setRuntimeAgent(defaultCli.runtimeAgent);
        setDefaultModel(defaultCli.defaultModel);
      } else {
        setHostCliId('');
      }
      if (node.mountedStorageIds.length > 0) {
        setStorageVolumeId(node.mountedStorageIds[0]);
      }
      return;
    }
    const shared = sharedNodeMap.get(nextNodeId);
    if (shared) {
      const z = zoneMap.get(shared.zoneId);
      setRegion(`${z ? `${z.shortCode}共享 · ` : '空间共享 · '}${shared.name}`);
      setHostCliId('');
      const firstCli = shared.supportedClis[0] || 'Claude Code';
      setRuntimeAgent(firstCli);
      setDefaultModel(getRuntimePreset(firstCli).models[0] || 'Claude 4.5 Sonnet');
      return;
    }
    setHostCliId('');
  };

  const handleSelectHostCli = (nextCliId: string) => {
    setHostCliId(nextCliId);
    const cli = selectedHostNode?.installedClis.find((c) => c.id === nextCliId);
    if (cli) {
      setRuntimeAgent(cli.runtimeAgent);
      setDefaultModel(cli.defaultModel);
    }
  };

  const openAddDrawer = (mode: AddDrawerMode = 'private', defaultZones: string[] = []) => {
    setDrawerMode(mode);
    setEditingId('new');
    const preferredNode =
      computeNodes.find(
        (n) =>
          n.status === 'online' &&
          n.installedClis.some(
            (c) => c.enabled && getCliUsedSlots(n.id, c.id) < c.concurrency,
          ),
      ) ||
      computeNodes.find((n) => n.status === 'online' && n.installedClis.length > 0) ||
      computeNodes[0] ||
      null;
    const preferredCli =
      preferredNode?.installedClis.find(
        (c) => c.enabled && getCliUsedSlots(preferredNode.id, c.id) < c.concurrency,
      ) ||
      preferredNode?.installedClis.find((c) => c.enabled) ||
      preferredNode?.installedClis[0] ||
      null;
    setHostNodeId(preferredNode?.id || '');
    setHostCliId(preferredCli?.id || '');
    setStorageVolumeId(
      preferredNode?.mountedStorageIds[0] || storageVolumes[0]?.id || '',
    );
    setHandle('@私有专项特工');
    setName('Kestrel · 领域专项私有 Agent');
    setTitle('自动化任务执行、内容生成与质量校验');
    setCategory('engineering');
    setRuntimeAgent(preferredCli?.runtimeAgent || 'Claude Code');
    setDefaultModel(preferredCli?.defaultModel || 'Claude 4.5 Sonnet');
    setRegion(preferredNode?.name || '个人 Agent 节点');
    setProjectPriceUsd(1800);
    setBio('基于 AGN 空间已挂载/租用节点与 Agent CLI 构建的自建专业 Agent。内部项目免租调用，按需勾选上架至市场对外租赁。');
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
    const boundNode = agent.hostNodeId ? nodeMap.get(agent.hostNodeId) || null : null;
    const boundSharedNode = agent.hostNodeId ? sharedNodeMap.get(agent.hostNodeId) || null : null;
    const matchedCli =
      boundNode?.installedClis.find((c) => c.id === agent.hostCliId) ||
      boundNode?.installedClis.find((c) => c.runtimeAgent === agent.runtimeAgent) ||
      boundNode?.installedClis[0] ||
      null;
    setHostNodeId(boundNode?.id || boundSharedNode?.id || '');
    setHostCliId(matchedCli?.id || '');
    setStorageVolumeId(
      agent.storageVolumeId ||
        agent.cliConfig?.storageVolumeId ||
        boundNode?.mountedStorageIds[0] ||
        '',
    );
    setHandle(agent.handle);
    setName(agent.name);
    setTitle(agent.title);
    setCategory(agent.category);
    setRuntimeAgent(matchedCli?.runtimeAgent || agent.runtimeAgent);
    setDefaultModel(matchedCli?.defaultModel || agent.defaultModel);
    setRegion(boundNode?.name || boundSharedNode?.name || agent.region);
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
    if (selectedCliFull) return;
    const isNew = editingId === 'new';
    const existing = isNew ? null : privateAgents.find((a) => a.id === editingId) || null;
    const normalizedHandle = handle.startsWith('@') ? handle.trim() : `@${handle.trim()}`;
    const resolvedNode = hostNodeId ? nodeMap.get(hostNodeId) || null : null;
    const resolvedSharedNode = hostNodeId ? sharedNodeMap.get(hostNodeId) || null : null;
    const resolvedSharedZone = resolvedSharedNode
      ? zoneMap.get(resolvedSharedNode.zoneId) || null
      : null;
    const resolvedCli =
      resolvedNode?.installedClis.find((c) => c.id === hostCliId) || null;
    const effectiveRuntime = resolvedCli?.runtimeAgent || runtimeAgent;
    const effectiveModel = resolvedCli?.defaultModel || defaultModel;
    const effectiveStorageId = storageVolumeId || undefined;
    const resolvedRegionLabel = resolvedNode
      ? resolvedNode.name
      : resolvedSharedNode
        ? `${resolvedSharedZone ? `${resolvedSharedZone.shortCode}共享 · ` : '空间共享 · '}${resolvedSharedNode.name}`
        : region.trim() || '个人 Agent 节点';

    const nextAgent: ExpertAgent = {
      id: isNew ? `agent_priv_${Date.now().toString().slice(-4)}` : editingId,
      handle: normalizedHandle,
      name: name.trim() || '自建专业 Agent',
      title: title.trim() || '专业领域自主交付',
      category,
      region: resolvedRegionLabel,
      nodeTier:
        resolvedNode?.origin === 'cloud' || resolvedSharedNode?.origin === 'cloud'
          ? 'official-cloud'
          : 'idle-peer',
      serviceMode: 'pure-agent',
      ownership: 'private',
      ownerHumanId: 'human_me',
      ownerHumanName: '林致远（我）',
      ownerHumanTitle: resolvedSharedNode ? '空间共享节点' : '自有节点',
      listedZoneIds,
      isListedInMarket: listedZoneIds.length > 0,
      runtimeAgent: effectiveRuntime,
      defaultModel: effectiveModel,
      engineModel: `${resolvedRegionLabel} · ${effectiveRuntime} CLI`,
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
      hostNodeId: resolvedNode?.id || resolvedSharedNode?.id,
      hostCliId: resolvedCli?.id,
      storageVolumeId: effectiveStorageId,
      cliConfig: resolvedCli
        ? {
            cliTool: resolvedCli.cliTool,
            cliVersion: resolvedCli.cliVersion,
            authMode: resolvedCli.authMode,
            credentialLabel: resolvedCli.credentialLabel,
            authStatus: resolvedCli.authStatus,
            concurrency: resolvedCli.concurrency,
            activeSlots: existing?.cliConfig?.activeSlots || 0,
            storageVolumeId: effectiveStorageId,
          }
        : existing?.cliConfig,
      isOnlineForOrders: resolvedNode
        ? resolvedNode.status === 'online'
        : resolvedSharedNode
          ? resolvedSharedNode.status === 'online'
          : true,
      performance: existing?.performance || {
        completedProjects: 12,
        successRate: 98.8,
        reputationScore: 96,
        repeatHireRate: 88,
        avgDeliveryDays: 3,
        rating: 4.93,
        capabilityTier: 'A+ 资深',
        demandStatus: '档期充裕',
        demandNote: resolvedNode ? `运行于 ${resolvedNode.name}` : '自有节点 · 内部自用免签约费',
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
      {/* FAR-LEFT PRIMARY NAVIGATION RAIL: Two Symmetric Core Groups (Agent 协作 + Agent 基础设施) */}
      <WorkspacePrimaryRail ariaLabel="AGN 空间导航">
        <div className="space-y-1">
          <RailSectionLabel>Agent 协作</RailSectionLabel>
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
          <RailNavButton
            variant="primary"
            active={
              teamSection === 'collab_my' ||
              teamSection === 'collab_manage' ||
              teamSection === 'collab_discover'
            }
            onClick={() => {
              setTeamSection('collab_my');
              setOpenActionMenuId(null);
            }}
            icon={<Globe className="w-3.5 h-3.5" />}
            label="协作空间"
            count={zones.length}
          />
        </div>

        <div className="pt-3 border-t border-slate-100 space-y-1">
          <RailSectionLabel>Agent 基础设施</RailSectionLabel>
          <RailNavButton
            variant="primary"
            active={teamSection === 'nodes'}
            onClick={() => {
              setTeamSection('nodes');
              setOpenActionMenuId(null);
            }}
            icon={<Server className="w-3.5 h-3.5" />}
            label="Agent 节点"
            count={`${onlineNodesCount}/${computeNodes.length}`}
          />
          <RailNavButton
            variant="primary"
            active={teamSection === 'storage'}
            onClick={() => {
              setTeamSection('storage');
              setOpenActionMenuId(null);
            }}
            icon={<Database className="w-3.5 h-3.5" />}
            label="Agent 存储"
            count={storageVolumes.length}
          />
        </div>
      </WorkspacePrimaryRail>

      {/* RIGHT WORKSPACE COLUMN: Top Search & Secondary Filters Aligned Flush with Roster Below */}
      <div className="flex-1 min-w-0 flex flex-col h-full min-h-0 @container/view">
        <ViewToolbar
          left={
            <>
              {(teamSection === 'collab_discover' || teamSection === 'collab_manage') && (
                <button
                  type="button"
                  onClick={() => setTeamSection('collab_my')}
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 whitespace-nowrap cursor-pointer shrink-0"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>返回协作空间</span>
                </button>
              )}

              {teamSection === 'collab_manage' ? (
                activeManagedZone ? (
                  <ToolbarDropdown
                    label="当前管理空间"
                    value={activeManagedZone.id}
                    defaultValue=""
                    onChange={setManagedZoneId}
                    options={managedZones.map((z) => ({
                      id: z.id,
                      label: z.name,
                      hint: z.typeLabel,
                    }))}
                  />
                ) : (
                  <span className="text-xs font-medium text-slate-500">
                    暂无可管理的协作空间，点击右侧创建
                  </span>
                )
              ) : (
                <ToolbarSearch
                  value={searchKeyword}
                  onChange={setSearchKeyword}
                  placeholder={
                    teamSection === 'agents'
                      ? '搜索 Agent 名称、底座、技能或所属专家...'
                      : teamSection === 'nodes'
                        ? '搜索 Win11 / Linux / macOS 节点、CLI 或账号凭证...'
                        : teamSection === 'storage'
                          ? '搜索共享云存储名称、套餐或可用区...'
                          : teamSection === 'collab_my' || teamSection === 'collab_discover'
                            ? '搜索协作空间名称、地域/文化标签、领域或主理人...'
                            : teamSection === 'collaborators'
                              ? '搜索合作专家姓名、专长方向或内建 Agent...'
                              : '搜索好友姓名、专长方向或内建 Agent...'
                  }
                  widthClass="flex-1 min-w-[160px] max-w-[300px]"
                />
              )}

              {teamSection === 'agents' ? (
                <>
                  <ToolbarDropdown
                    label="类目"
                    value={categoryFilter}
                    defaultValue="all"
                    onChange={setCategoryFilter}
                    options={AGENT_CATEGORY_OPTIONS.map((cat) => ({
                      id: cat.id,
                      label: cat.label,
                      hint: `${activeCategoryCounts[cat.id]}`,
                    }))}
                  />
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
              ) : teamSection === 'nodes' ? (
                <>
                  <ToolbarDropdown
                    label="系统"
                    value={nodeOsFilter}
                    defaultValue="all"
                    onChange={setNodeOsFilter}
                    options={[
                      { id: 'all', label: '全部系统' },
                      { id: 'linux', label: 'Linux' },
                      { id: 'macos', label: 'macOS' },
                      { id: 'win11', label: 'Windows 11' },
                    ]}
                  />
                  <ToolbarDropdown
                    label="方式"
                    value={nodeOriginFilter}
                    defaultValue="all"
                    onChange={setNodeOriginFilter}
                    options={[
                      { id: 'all', label: '全部节点' },
                      { id: 'private', label: '自有设备挂载' },
                      { id: 'cloud', label: '云端直接租用' },
                    ]}
                  />
                </>
              ) : teamSection === 'storage' ? (
                <ToolbarDropdown
                  label="计费方式"
                  value={volumeBillingFilter}
                  defaultValue="all"
                  onChange={setVolumeBillingFilter}
                  options={[
                    { id: 'all', label: '全部云存储' },
                    { id: 'permanent', label: '永久存储买断包' },
                    { id: 'monthly', label: '按月租用云盘' },
                  ]}
                />
              ) : teamSection === 'collab_my' ? (
                <>
                  <ToolbarDropdown
                    label="归属"
                    value={collabRoleFilter}
                    defaultValue="all"
                    onChange={setCollabRoleFilter}
                    options={[
                      { id: 'all', label: '全部空间', hint: `${zones.length}` },
                      { id: 'managed', label: '我管理的', hint: `${managedZones.length}` },
                      {
                        id: 'joined',
                        label: '我加入的',
                        hint: `${Math.max(0, zones.length - managedZones.length)}`,
                      },
                    ]}
                  />
                  <ToolbarDropdown
                    label="空间分类"
                    value={collabKindFilter}
                    defaultValue="all"
                    onChange={setCollabKindFilter}
                    options={[
                      { id: 'all', label: '全部类型' },
                      { id: 'open', label: '开放性空间（社区）' },
                      { id: 'enterprise', label: '企业封闭空间' },
                    ]}
                  />
                </>
              ) : teamSection === 'collab_discover' ? (
                <ToolbarDropdown
                  label="空间分类"
                  value={collabKindFilter}
                  defaultValue="all"
                  onChange={setCollabKindFilter}
                  options={[
                    { id: 'all', label: '全部类型' },
                    { id: 'open', label: '开放性空间（社区）' },
                    { id: 'enterprise', label: '企业封闭空间' },
                  ]}
                />
              ) : teamSection === 'collab_manage' ? null : (
                <>
                  <ToolbarDropdown
                    label="类目"
                    value={categoryFilter}
                    defaultValue="all"
                    onChange={setCategoryFilter}
                    options={AGENT_CATEGORY_OPTIONS.map((cat) => ({
                      id: cat.id,
                      label: cat.label,
                      hint: `${activeCategoryCounts[cat.id]}`,
                    }))}
                  />
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
            ) : teamSection === 'nodes' ? (
              <>
                <button
                  type="button"
                  onClick={() => setNodeDrawerMode('private')}
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 whitespace-nowrap cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>挂载自有设备</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNodeDrawerMode('cloud')}
                  className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white whitespace-nowrap cursor-pointer"
                >
                  <Cloud className="w-3.5 h-3.5" />
                  <span>租用云端节点</span>
                </button>
              </>
            ) : teamSection === 'storage' ? (
              <button
                type="button"
                onClick={() => setVolumeDrawerOpen(true)}
                className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>购买 / 租用云存储</span>
              </button>
            ) : teamSection === 'collab_my' ||
              teamSection === 'collab_manage' ||
              teamSection === 'collab_discover' ? (
              <>
                {teamSection !== 'collab_discover' && (
                  <button
                    type="button"
                    onClick={() => setTeamSection('collab_discover')}
                    className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 whitespace-nowrap cursor-pointer"
                  >
                    <Compass className="w-3.5 h-3.5 text-blue-600" />
                    <span>发现空间</span>
                    {discoverableUnjoinedCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-mono tabular-nums leading-none">
                        {discoverableUnjoinedCount}
                      </span>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCreateZoneDrawerOpen(true)}
                  className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white whitespace-nowrap cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>创建协作空间</span>
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
                  { id: 'agents' as const, label: 'Agent 成员', count: `${teamRoster.length}`, icon: Cpu },
                  {
                    id: 'collaborators' as const,
                    label: '合作专家',
                    count: `${expertRelationCounts.projectCollab}`,
                    icon: Users,
                  },
                  {
                    id: 'friends' as const,
                    label: '我的好友',
                    count: `${expertRelationCounts.mutualFriend}`,
                    icon: UserCheck,
                  },
                  {
                    id: 'collab_my' as const,
                    label: '协作空间',
                    count: `${zones.length}`,
                    icon: Globe,
                  },
                  {
                    id: 'nodes' as const,
                    label: 'Agent 节点',
                    count: `${onlineNodesCount}/${computeNodes.length}`,
                    icon: Server,
                  },
                  {
                    id: 'storage' as const,
                    label: 'Agent 存储',
                    count: `${storageVolumes.length}`,
                    icon: Database,
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  const active =
                    item.id === 'collab_my'
                      ? teamSection === 'collab_my' ||
                        teamSection === 'collab_manage' ||
                        teamSection === 'collab_discover'
                      : teamSection === item.id;
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
            </div>

            {teamSection === 'nodes' ? (
              <SpaceNodesPanel
                nodes={computeNodes}
                agents={allAgents}
                storageVolumes={storageVolumes}
                searchKeyword={searchKeyword}
                osFilter={nodeOsFilter}
                originFilter={nodeOriginFilter}
                drawerMode={nodeDrawerMode}
                onChangeDrawerMode={setNodeDrawerMode}
                onMountPrivateNode={onMountPrivateNode}
                onProvisionCloudNode={onProvisionCloudNode}
                onToggleNodeStatus={onToggleNodeStatus}
                onRemoveNode={onRemoveComputeNode}
                onAddNodeCli={onAddNodeCli}
                onUpdateNodeCli={onUpdateNodeCli}
                onRemoveNodeCli={onRemoveNodeCli}
                onToggleNodeStorageMount={onToggleNodeStorageMount}
                onJumpToStorage={() => setTeamSection('storage')}
                onJumpToAgents={() => setTeamSection('agents')}
              />
            ) : teamSection === 'storage' ? (
              <SpaceStoragePanel
                volumes={storageVolumes}
                nodes={computeNodes}
                agents={allAgents}
                workspaces={workspaces}
                searchKeyword={searchKeyword}
                billingFilter={volumeBillingFilter}
                drawerOpen={volumeDrawerOpen}
                onChangeDrawerOpen={setVolumeDrawerOpen}
                onCreateVolume={onCreateStorageVolume}
                onExpandVolume={onExpandStorageVolume}
              />
            ) : teamSection === 'collab_my' ||
              teamSection === 'collab_manage' ||
              teamSection === 'collab_discover' ? (
              <CollabSpacesPanel
                mode={
                  teamSection === 'collab_manage'
                    ? 'manage'
                    : teamSection === 'collab_my'
                      ? 'my'
                      : 'discover'
                }
                zones={allZones}
                joinedZoneIds={joinedZoneIds}
                activeZoneId={activeZone.id}
                managedZoneId={activeManagedZone?.id || null}
                agents={allAgents}
                communityPosts={communityPosts}
                zoneProjects={zoneProjects}
                sharedNodes={spaceSharedNodes}
                myComputeNodes={computeNodes}
                humanExperts={humanExperts}
                searchKeyword={searchKeyword}
                kindFilter={collabKindFilter}
                roleFilter={collabRoleFilter}
                pendingApplicationsCount={pendingSpaceApplicationsCount}
                onOpenAssistant={onOpenAssistant}
                createDrawerOpen={createZoneDrawerOpen}
                onChangeCreateDrawerOpen={setCreateZoneDrawerOpen}
                onCreateZone={onCreateCollabZone}
                onToggleJoinZone={onToggleJoinZone}
                onDeleteZone={onDeleteCollabZone}
                onEnterZoneCommunity={onJumpToZoneDiscover}
                onEnterZoneMarket={onJumpToZoneMarket}
                onSwitchToDiscover={() => setTeamSection('collab_discover')}
                onOpenSpaceManage={(zoneId) => {
                  setManagedZoneId(zoneId);
                  setTeamSection('collab_manage');
                }}
                onInviteSpaceMember={onInviteSpaceMember}
                onUpdateSpaceMemberRole={onUpdateSpaceMemberRole}
                onKickSpaceMember={onKickSpaceMember}
                onAddSpaceSharedNode={onAddSpaceSharedNode}
                onToggleSpaceSharedNodeStatus={onToggleSpaceSharedNodeStatus}
                onUpdateSpaceSharedNode={onUpdateSpaceSharedNode}
                onRemoveSpaceSharedNode={onRemoveSpaceSharedNode}
                onToggleSpaceAgentOnline={onToggleSpaceAgentOnline}
                onPublishAgentToSpace={onPublishAgentToSpace}
                onRemoveAgentFromSpace={onRemoveAgentFromSpace}
              />
            ) : teamSection === 'agents' ? (
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
                    <div className="hidden @[860px]:grid @[860px]:grid-cols-[minmax(0,1fr)_140px_112px_164px_140px] @[860px]:items-center @[860px]:gap-4 px-5 py-2.5 bg-slate-50/90 border-b border-slate-200 rounded-t-xl text-[11px] font-semibold text-slate-500">
                      <div>专业 Agent</div>
                      <div>运行状态</div>
                      <div>任务 Session</div>
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
                        const agentProjectCount = new Set(agentTasks.map((t) => t.sessionId)).size;
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
                            className="px-4 sm:px-5 py-4 hover:bg-slate-50/60 transition-colors flex flex-col gap-3.5 @[860px]:grid @[860px]:grid-cols-[minmax(0,1fr)_140px_112px_164px_140px] @[860px]:items-center @[860px]:gap-4 last:rounded-b-xl"
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

                                  {isPrivate && (() => {
                                    const boundNode = agent.hostNodeId
                                      ? nodeMap.get(agent.hostNodeId)
                                      : undefined;
                                    const boundShared = agent.hostNodeId
                                      ? sharedNodeMap.get(agent.hostNodeId)
                                      : undefined;
                                    const boundSharedZone = boundShared
                                      ? zoneMap.get(boundShared.zoneId)
                                      : undefined;
                                    const boundCli = boundNode?.installedClis.find(
                                      (c) => c.id === agent.hostCliId,
                                    );
                                    const boundVol = (agent.storageVolumeId ||
                                      agent.cliConfig?.storageVolumeId)
                                      ? volumeMap.get(
                                          agent.storageVolumeId ||
                                            agent.cliConfig?.storageVolumeId ||
                                            '',
                                        )
                                      : undefined;
                                    return (
                                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                                        {boundNode ? (
                                          <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                                            <Server className="w-3 h-3 text-blue-600 shrink-0" />
                                            <span>
                                              个人节点：{boundNode.name}
                                              {boundCli
                                                ? ` · ${boundCli.runtimeAgent} (${boundCli.concurrency} 沙箱)`
                                                : ''}
                                            </span>
                                          </span>
                                        ) : boundShared ? (
                                          <span className="inline-flex items-center gap-1 font-medium text-indigo-700">
                                            <Server className="w-3 h-3 text-indigo-600 shrink-0" />
                                            <span>
                                              空间共享节点：
                                              {boundSharedZone ? `${boundSharedZone.shortCode} · ` : ''}
                                              {boundShared.name}（{boundShared.sharedSandboxQuota} 共享沙箱）
                                            </span>
                                          </span>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => openEditDrawer(agent)}
                                            className="inline-flex items-center gap-1 font-semibold text-amber-700 hover:underline cursor-pointer"
                                          >
                                            <Server className="w-3 h-3 shrink-0" />
                                            <span>未绑定运行节点 · 点击绑定</span>
                                          </button>
                                        )}
                                        {boundVol && (
                                          <span className="inline-flex items-center gap-1 text-slate-500">
                                            <Database className="w-3 h-3 text-indigo-500 shrink-0" />
                                            <span>共享存储：{boundVol.name}</span>
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })()}

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

                                  {agentTasks.length > 0 && onOpenTaskSession && (
                                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-0.5">
                                      <span className="text-slate-400">跨项目任务：</span>
                                      {agentTasks.slice(0, 2).map((t) => {
                                        const tProj = workspaces.find((w) => w.id === t.sessionId);
                                        return (
                                          <button
                                            key={t.id}
                                            type="button"
                                            onClick={() => onOpenTaskSession(t.id)}
                                            className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 hover:underline underline-offset-2 font-medium cursor-pointer max-w-[240px] truncate"
                                            title={`进入 ${tProj?.name || '项目'} · ${t.title}`}
                                          >
                                            <MessageSquareCode className="w-3 h-3 shrink-0" />
                                            <span className="truncate">
                                              {tProj ? `${tProj.name} · ` : ''}#{t.id}
                                            </span>
                                          </button>
                                        );
                                      })}
                                      {agentTasks.length > 2 && (
                                        <span className="text-slate-400 font-mono tabular-nums">
                                          +{agentTasks.length - 2}
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

                            {/* Col 3: Aggregated Cross-Project Task Sessions */}
                            <div className="flex items-center justify-between @[860px]:block text-xs">
                              <span className="text-[11px] font-sans text-slate-400 @[860px]:hidden">
                                任务 Session
                              </span>
                              {agentTasks.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => onOpenAgentTaskSession?.(agent.id)}
                                  className="text-left group cursor-pointer"
                                  title={`查看并进入 ${agent.handle} 跨项目汇聚的任务对话`}
                                >
                                  <div className="font-mono tabular-nums font-semibold text-blue-700 group-hover:underline underline-offset-2 inline-flex items-center gap-1">
                                    <MessageSquareCode className="w-3.5 h-3.5 shrink-0" />
                                    <span>{agentTasks.length} 个任务</span>
                                  </div>
                                  <div className="text-[11px] font-sans text-slate-400 mt-0.5">
                                    汇聚 {agentProjectCount} 个项目
                                  </div>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onOpenAgentTaskSession?.(agent.id)}
                                  className="text-left group cursor-pointer"
                                  title={`为 ${agent.handle} 新建任务 Session`}
                                >
                                  <div className="font-medium text-slate-500 group-hover:text-slate-900">
                                    开启任务
                                  </div>
                                  <div className="text-[11px] font-sans text-slate-400 mt-0.5">
                                    暂无活跃 Session
                                  </div>
                                </button>
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
                                        <span>配置节点、模型与上架空间</span>
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
                        const sourceZoneName = getZoneName(membership.sourceZoneId) || '中文 AI 社区';
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
                  基于已挂载/租用的 Agent 节点与 CLI 配置自建专业 Agent，或引入市场租赁 Agent。
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
                  配置自建专业 Agent
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
                  租赁外部 Agent
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
                {/* Node & Installed Agent CLI Binding (from Agent Space) */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900">
                      <Server className="w-3.5 h-3.5 text-blue-600" />
                      <span>依托个人 Agent 节点或协作空间共享节点</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setDrawerOpen(false);
                        setTeamSection('nodes');
                      }}
                      className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 cursor-pointer whitespace-nowrap"
                    >
                      管理 Agent 节点 →
                    </button>
                  </div>

                  <label className="block">
                    <span className="text-[11px] font-semibold text-slate-600">
                      承载节点（个人 Agent 节点 / 协作空间共享节点）
                    </span>
                    <select
                      value={hostNodeId}
                      onChange={(e) => handleSelectHostNode(e.target.value)}
                      className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    >
                      <option value="">暂不绑定运行节点</option>
                      <optgroup label="个人 Agent 节点">
                        {computeNodes.map((n) => {
                          const nodeCap = n.installedClis
                            .filter((c) => c.enabled)
                            .reduce((s, c) => s + c.concurrency, 0);
                          const nodeUsed = privateAgents.filter(
                            (a) => a.id !== excludeEditingId && a.hostNodeId === n.id,
                          ).length;
                          return (
                            <option key={n.id} value={n.id}>
                              {n.name}（{n.origin === 'cloud' ? '云端租用' : '自有挂载'} · 沙箱{' '}
                              {nodeUsed}/{nodeCap}）
                            </option>
                          );
                        })}
                      </optgroup>
                      {accessibleSharedNodes.length > 0 && (
                        <optgroup label="协作空间 · 共享节点">
                          {accessibleSharedNodes.map((sn) => {
                            const z = zoneMap.get(sn.zoneId);
                            const myBound = privateAgents.filter(
                              (a) => a.id !== excludeEditingId && a.hostNodeId === sn.id,
                            ).length;
                            return (
                              <option key={sn.id} value={sn.id}>
                                [{z?.shortCode || '共享'}·{z?.name || '协作空间'}] {sn.name}（共享沙箱{' '}
                                {sn.usedSandboxes + myBound}/{sn.sharedSandboxQuota}）
                              </option>
                            );
                          })}
                        </optgroup>
                      )}
                    </select>
                  </label>

                  {selectedSharedNode && (
                    <div className="space-y-2.5 pt-1">
                      <div className="rounded-lg bg-indigo-50/70 border border-indigo-200 px-3 py-2 text-[11px] text-indigo-900 flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">
                          来自协作空间「{selectedSharedZone?.name || '企业空间'}」共享算力 ·{' '}
                          {selectedSharedNode.osVersion} ({selectedSharedNode.cpuCores}C/
                          {selectedSharedNode.memoryGb}G)
                        </span>
                        <span className="font-mono font-bold">
                          共享沙箱 {selectedSharedUsed}/{selectedSharedNode.sharedSandboxQuota}
                        </span>
                      </div>

                      {selectedSharedUsed >= selectedSharedNode.sharedSandboxQuota && (
                        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-900 flex flex-wrap items-center justify-between gap-2">
                          <span>
                            该空间共享节点的并发沙箱配额已满，请在「AGN 空间 → 协作空间 → 空间管理」调大配额。
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setDrawerOpen(false);
                              if (selectedSharedZone) setManagedZoneId(selectedSharedZone.id);
                              setTeamSection('collab_manage');
                            }}
                            className="font-semibold text-amber-950 underline hover:text-blue-700 cursor-pointer shrink-0"
                          >
                            前往空间管理
                          </button>
                        </div>
                      )}

                      <label className="block">
                        <span className="text-[11px] font-semibold text-slate-600">
                          选择该共享节点支持的 Agent CLI
                        </span>
                        <select
                          value={runtimeAgent}
                          onChange={(e) => {
                            const nextRt = e.target.value;
                            setRuntimeAgent(nextRt);
                            setDefaultModel(getRuntimePreset(nextRt).models[0] || defaultModel);
                          }}
                          className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                        >
                          {selectedSharedNode.supportedClis.map((cliName) => (
                            <option key={cliName} value={cliName}>
                              {cliName} CLI（空间共享配额）
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}

                  {selectedHostNode && (
                    <>
                      {selectedHostNode.installedClis.length === 0 ? (
                        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-800 flex items-center justify-between gap-2">
                          <span>该节点尚未配置 Agent CLI，请先安装 Claude Code / Antigravity / Codex。</span>
                          <button
                            type="button"
                            onClick={() => {
                              setDrawerOpen(false);
                              setTeamSection('nodes');
                            }}
                            className="font-semibold underline whitespace-nowrap cursor-pointer"
                          >
                            去配置
                          </button>
                        </div>
                      ) : (
                        <label className="block">
                          <span className="text-[11px] font-semibold text-slate-600">
                            选择该节点已配置的 Agent CLI（按并发沙箱上限分配）
                          </span>
                          <select
                            value={hostCliId}
                            onChange={(e) => handleSelectHostCli(e.target.value)}
                            className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                          >
                            {selectedHostNode.installedClis.map((cli) => {
                              const used = getCliUsedSlots(
                                selectedHostNode.id,
                                cli.id,
                                excludeEditingId,
                              );
                              const remaining = Math.max(0, cli.concurrency - used);
                              const disabledOption = remaining <= 0 && cli.id !== hostCliId;
                              return (
                                <option key={cli.id} value={cli.id} disabled={disabledOption}>
                                  {cli.runtimeAgent} CLI · {cli.defaultModel} · 沙箱 {used}/
                                  {cli.concurrency}（{remaining > 0 ? `余 ${remaining} 席位` : '已满'}）
                                </option>
                              );
                            })}
                          </select>
                        </label>
                      )}

                      {selectedHostCli && selectedCliFull && (
                        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-900 flex items-center justify-between gap-2">
                          <span>
                            该 CLI 并发沙箱已满（{selectedCliUsed}/{selectedHostCli.concurrency}），无法再绑定新的专业 Agent。
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setDrawerOpen(false);
                              setTeamSection('nodes');
                            }}
                            className="font-semibold underline whitespace-nowrap cursor-pointer shrink-0"
                          >
                            调大沙箱数 →
                          </button>
                        </div>
                      )}

                      <label className="block">
                        <span className="text-[11px] font-semibold text-slate-600">
                          挂载的 Agent 共享存储（云存储）
                        </span>
                        <select
                          value={storageVolumeId}
                          onChange={(e) => setStorageVolumeId(e.target.value)}
                          className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                        >
                          <option value="">仅使用节点本地盘</option>
                          {storageVolumes.map((v) => {
                            const isMountedOnNode = selectedHostNode.mountedStorageIds.includes(v.id);
                            return (
                              <option key={v.id} value={v.id}>
                                {v.name} ({v.quotaGb}GB)
                                {isMountedOnNode ? ' · 节点已挂载' : ''}
                              </option>
                            );
                          })}
                        </select>
                      </label>

                      {selectedHostCli && !selectedCliFull && (
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-slate-600 pt-0.5">
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                            <Terminal className="w-3 h-3 text-blue-600" />
                            <span>{selectedHostCli.runtimeAgent}</span>
                          </span>
                          <span className="font-mono">{selectedHostCli.defaultModel}</span>
                          <span className="text-slate-300" aria-hidden="true">·</span>
                          <span className="font-mono text-emerald-700 font-semibold">
                            并发沙箱 {selectedCliUsed}/{selectedHostCli.concurrency}（余{' '}
                            {Math.max(0, selectedHostCli.concurrency - selectedCliUsed)} 席位）
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-medium text-slate-700">专业 Agent 名称</span>
                    <input
                      type="text"
                      value={handle}
                      onChange={(e) => setHandle(e.target.value)}
                      required
                      className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-medium text-slate-700">专业类目</span>
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

                  {!selectedHostCli && (
                    <>
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
                    </>
                  )}

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

                  <label className="block col-span-2">
                    <span className="text-xs font-medium text-slate-700">
                      对外项目挂牌价 (USD · 仅上架市场时生效，内部自用免租)
                    </span>
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
                </div>

                {/* Multi-Zone Market Listing Selector */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      可选：对外上架协作空间服务市场（不选则仅私有自用）
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
                  disabled={selectedCliFull}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-45 disabled:cursor-not-allowed text-white cursor-pointer"
                >
                  {selectedCliFull
                    ? '沙箱已满 · 请调大配额'
                    : listedZoneIds.length > 0
                      ? `保存并上架 (${listedZoneIds.length} 个协作空间)`
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
