import { useState, type FormEvent } from 'react';
import {
  ArrowUpRight,
  Building2,
  Check,
  Clock,
  Compass,
  Copy,
  Globe,
  KeyRound,
  Lock,
  LogOut,
  MessageSquare,
  Plus,
  Send,
  Settings2,
  ShieldCheck,
  Store,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type {
  AgentCategory,
  CommunityPost,
  CommunityPostType,
  CommunityZone,
  ComputeNode,
  ExpertAgent,
  HumanExpert,
  MarketSkill,
  NodeOsType,
  PrivateCommunityScope,
  SkillKind,
  SpaceJoinApplication,
  SpaceMemberRole,
  SpaceSharedNode,
  ZoneProjectOpportunity,
} from '../../types/agentnexus';
import { CollabSpaceManagePanel } from './CollabSpaceManagePanel';

const ZONE_ACCENT_PALETTE = [
  '#0f172a',
  '#0f766e',
  '#1d4ed8',
  '#7c3aed',
  '#0284c7',
  '#059669',
  '#d97706',
  '#4338ca',
];

interface CollabSpacesPanelProps {
  mode: 'my' | 'manage' | 'discover';
  zones: CommunityZone[];
  joinedZoneIds: string[];
  activeZoneId: string;
  managedZoneId: string | null;
  agents: ExpertAgent[];
  communityPosts: CommunityPost[];
  zoneProjects: ZoneProjectOpportunity[];
  sharedNodes: SpaceSharedNode[];
  myComputeNodes: ComputeNode[];
  humanExperts: HumanExpert[];
  spaceApplications: SpaceJoinApplication[];
  searchKeyword: string;
  kindFilter: 'all' | 'official' | 'private';
  roleFilter?: 'all' | 'managed' | 'joined';
  pendingApplicationsCount?: number;
  onOpenAssistant?: () => void;
  createDrawerOpen: boolean;
  onChangeCreateDrawerOpen: (open: boolean) => void;
  onCreateZone: (input: {
    name: string;
    shortCode: string;
    privateScope: PrivateCommunityScope;
    regionCulture: string;
    tagline: string;
    focusDomains: string[];
    accentColor: string;
    inviteCode?: string;
  }) => string;
  onToggleJoinZone: (zoneId: string) => void;
  onApplyToJoinZone?: (zoneId: string, note: string) => void;
  onResolveSpaceApplication?: (applicationId: string, decision: 'approved' | 'rejected') => void;
  onUpdateZoneInviteCode?: (zoneId: string, newCode: string) => void;
  onDeleteZone: (zoneId: string) => void;
  onEnterZoneCommunity: (zoneId: string) => void;
  onEnterZoneMarket: (zoneId: string) => void;
  onSwitchToDiscover: () => void;
  onOpenSpaceManage: (zoneId: string) => void;
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
  onTogglePinPost?: (postId: string, principalName?: string) => void;
  onDeletePost?: (postId: string) => void;
  onCreatePost?: (input: {
    zoneId: string;
    type: Exclude<CommunityPostType, 'project'>;
    title: string;
    content: string;
    tags?: string[];
    pinned?: boolean;
    pinnedBy?: string;
  }) => void;
  marketSkills?: MarketSkill[];
  onToggleZoneSkillDistribution?: (zoneId: string, skillId: string) => void;
  onCreateSpaceSkill?: (input: {
    name: string;
    summary: string;
    kind: SkillKind;
    category: AgentCategory;
    priceUsd?: number;
    compatibleRuntimes?: string[];
    zoneIds?: string[];
    bindAgentIds?: string[];
  }) => string;
}

export function CollabSpacesPanel({
  mode,
  zones,
  joinedZoneIds,
  activeZoneId,
  managedZoneId,
  agents,
  communityPosts,
  zoneProjects,
  sharedNodes,
  myComputeNodes,
  humanExperts,
  spaceApplications,
  searchKeyword,
  kindFilter,
  roleFilter = 'all',
  pendingApplicationsCount = 0,
  onOpenAssistant,
  createDrawerOpen,
  onChangeCreateDrawerOpen,
  onCreateZone,
  onToggleJoinZone,
  onApplyToJoinZone,
  onResolveSpaceApplication,
  onUpdateZoneInviteCode,
  onDeleteZone,
  onEnterZoneCommunity,
  onEnterZoneMarket,
  onSwitchToDiscover,
  onOpenSpaceManage,
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
  onTogglePinPost,
  onDeletePost,
  onCreatePost,
  marketSkills,
  onToggleZoneSkillDistribution,
  onCreateSpaceSkill,
}: CollabSpacesPanelProps) {
  // Private community join inline state (invite code OR join application)
  const [joiningZoneId, setJoiningZoneId] = useState<string | null>(null);
  const [joinTab, setJoinTab] = useState<'invite' | 'apply'>('invite');
  const [inviteInput, setInviteInput] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [applyNote, setApplyNote] = useState('');
  const [copiedCodeZoneId, setCopiedCodeZoneId] = useState<string | null>(null);

  // Create Private Community Drawer Form State (Official communities cannot be self-created)
  const [newScope, setNewScope] = useState<PrivateCommunityScope>('opc');
  const [newName, setNewName] = useState('');
  const [newShortCode, setNewShortCode] = useState('');
  const [newRegionCulture, setNewRegionCulture] = useState('中文 · OPC 共创');
  const [newTagline, setNewTagline] = useState('');
  const [newDomainsText, setNewDomainsText] = useState('多 Agent 协同, 全栈交付, Skills 共创');
  const [newAccent, setNewAccent] = useState('#0f766e');
  const [newInviteCode, setNewInviteCode] = useState('AGN-2026');

  const isZoneJoined = (z: CommunityZone) =>
    !z.comingSoon && Boolean(z.isPlatformDefault || joinedZoneIds.includes(z.id));

  const joinedList = zones.filter((z) => isZoneJoined(z));
  const discoverableUnjoined = zones.filter((z) => !z.comingSoon && !isZoneJoined(z));
  const comingSoonOfficialZones = zones.filter((z) => Boolean(z.comingSoon));

  const joinedOfficialCount = joinedList.filter((z) => z.kind === 'official').length;
  const joinedPrivateCount = joinedList.filter((z) => z.kind === 'private').length;

  const q = searchKeyword.trim().toLowerCase();

  const matchesFilters = (z: CommunityZone) => {
    if (kindFilter === 'official' && z.kind !== 'official') return false;
    if (kindFilter === 'private' && z.kind !== 'private') return false;
    if (!q) return true;
    return (
      z.name.toLowerCase().includes(q) ||
      z.tagline.toLowerCase().includes(q) ||
      (z.regionCulture || '').toLowerCase().includes(q) ||
      z.principalName.toLowerCase().includes(q) ||
      z.focusDomains.some((d) => d.toLowerCase().includes(q))
    );
  };

  const isManagedZone = (z: CommunityZone) =>
    z.kind === 'private' && Boolean(z.createdByMe || z.isCurrentUserPrincipal);

  const hasMyPendingApplication = (zoneId: string) =>
    spaceApplications.some(
      (a) => a.zoneId === zoneId && a.humanExpertId === 'human_me' && a.status === 'pending',
    );

  // In 'my' mode: official default & managed private communities first;
  // in 'discover' mode: unjoined private communities first, then joined communities, then upcoming official language communities.
  const displayedZones =
    mode === 'my'
      ? joinedList
          .filter((z) => {
            if (roleFilter === 'managed' && !isManagedZone(z)) return false;
            if (roleFilter === 'joined' && isManagedZone(z)) return false;
            return matchesFilters(z);
          })
          .sort((a, b) => {
            const rankA = a.kind === 'official' ? 2 : isManagedZone(a) ? 1 : 0;
            const rankB = b.kind === 'official' ? 2 : isManagedZone(b) ? 1 : 0;
            return rankB - rankA;
          })
      : [
          ...discoverableUnjoined.filter(matchesFilters),
          ...joinedList.filter((z) => !z.createdByMe && matchesFilters(z)),
          ...comingSoonOfficialZones.filter(matchesFilters),
        ];

  const handleCopyInviteCode = (zone: CommunityZone) => {
    if (!zone.inviteCode) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(zone.inviteCode).catch(() => {});
    }
    setCopiedCodeZoneId(zone.id);
    setTimeout(() => setCopiedCodeZoneId(null), 1600);
  };

  const handleOpenPrivateJoin = (zone: CommunityZone, preferredTab: 'invite' | 'apply' = 'invite') => {
    setJoiningZoneId(zone.id);
    setJoinTab(preferredTab);
    setInviteInput(zone.inviteCode || '');
    setApplyNote('');
    setInviteError(null);
  };

  const handleConfirmInviteJoin = (zone: CommunityZone) => {
    const expected = (zone.inviteCode || '').trim().toUpperCase();
    const entered = inviteInput.trim().toUpperCase();
    if (expected && entered !== expected) {
      setInviteError(`邀请码不匹配，请输入 ${expected} 或切换至「申请加入」由主理人 ${zone.principalName} 审批`);
      return;
    }
    onToggleJoinZone(zone.id);
    setJoiningZoneId(null);
    setInviteInput('');
    setInviteError(null);
  };

  const handleConfirmApplyJoin = (zone: CommunityZone) => {
    if (!onApplyToJoinZone) return;
    onApplyToJoinZone(zone.id, applyNote);
    setJoiningZoneId(null);
    setApplyNote('');
  };

  const handleCreateSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleanedName = newName.trim();
    if (!cleanedName) return;
    const derivedShort = newShortCode.trim().slice(0, 2) || cleanedName.slice(0, 1);
    const parsedDomains = newDomainsText
      .split(/[,，、/]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 5);

    const defaultRegionByScope: Record<PrivateCommunityScope, string> = {
      enterprise: '企业内部 · 私有隔离',
      opc: '中文 · OPC 社区运营',
      topic: '垂直领域 · 主题共创',
    };
    const defaultTaglineByScope: Record<PrivateCommunityScope, string> = {
      enterprise: '企业内部私有 Agent 社区，主理人统一治理成员准入、共享节点、专属服务市场与内部公告',
      opc: '由主理人自治运营的 OPC 私有社区，支持邀请码与申请准入，沉淀垂直领域专家与共创项目',
      topic: '面向特定技术或行业方向的私有 Agent 社区，聚焦 Skills 沉淀、Agent 协同与精选内容交流',
    };

    const newId = onCreateZone({
      name: cleanedName,
      shortCode: derivedShort,
      privateScope: newScope,
      regionCulture: newRegionCulture.trim() || defaultRegionByScope[newScope],
      tagline: newTagline.trim() || defaultTaglineByScope[newScope],
      focusDomains: parsedDomains.length > 0 ? parsedDomains : ['多 Agent 协同', '项目交付'],
      accentColor: newAccent,
      inviteCode: newInviteCode.trim().toUpperCase() || 'AGN-2026',
    });

    setNewName('');
    setNewShortCode('');
    setNewTagline('');
    onChangeCreateDrawerOpen(false);
    if (newId) {
      onOpenSpaceManage(newId);
    }
  };

  const renderCommunityKindIcon = (zone: CommunityZone) => {
    if (zone.kind === 'official') return <Globe className="w-3.5 h-3.5 text-sky-600 shrink-0" />;
    if (zone.privateScope === 'enterprise') {
      return <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />;
    }
    return <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
  };

  const managedZones = zones.filter(isManagedZone);
  const activeManagedZone =
    managedZones.find((z) => z.id === managedZoneId) || managedZones[0] || null;

  return (
    <div className="space-y-5">
      {mode === 'manage' ? (
        activeManagedZone ? (
          <div className="space-y-4">
            {pendingApplicationsCount > 0 && onOpenAssistant && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
                <div className="text-xs text-indigo-950">
                  <span className="font-bold">
                    有 {pendingApplicationsCount} 条私有社区入驻申请待审批
                  </span>
                  <span className="text-indigo-800/80 ml-1.5">
                    可在下方「成员管理」直接审批，或在「Nexa 助理」消息卡片一键处理。
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onOpenAssistant}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-[11px] font-semibold text-white cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>去 Nexa 助理查看</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            )}
            <CollabSpaceManagePanel
              zone={activeManagedZone}
              sharedNodes={sharedNodes}
              myComputeNodes={myComputeNodes}
              allAgents={agents}
              humanExperts={humanExperts}
              communityPosts={communityPosts}
              spaceApplications={spaceApplications}
              onEnterCommunity={onEnterZoneCommunity}
              onEnterMarket={onEnterZoneMarket}
              onInviteMember={onInviteSpaceMember}
              onUpdateMemberRole={onUpdateSpaceMemberRole}
              onKickMember={onKickSpaceMember}
              onResolveApplication={onResolveSpaceApplication}
              onUpdateInviteCode={onUpdateZoneInviteCode}
              onAddSharedNode={onAddSpaceSharedNode}
              onToggleSharedNodeStatus={onToggleSpaceSharedNodeStatus}
              onUpdateSharedNode={onUpdateSpaceSharedNode}
              onRemoveSharedNode={onRemoveSpaceSharedNode}
              onToggleSpaceAgentOnline={onToggleSpaceAgentOnline}
              onPublishAgentToSpace={onPublishAgentToSpace}
              onRemoveAgentFromSpace={onRemoveAgentFromSpace}
              onTogglePinPost={onTogglePinPost}
              onDeletePost={onDeletePost}
              onCreatePost={onCreatePost}
              marketSkills={marketSkills}
              onToggleZoneSkillDistribution={onToggleZoneSkillDistribution}
              onCreateSpaceSkill={onCreateSpaceSkill}
            />
          </div>
        ) : (
          <div className="py-16 text-center rounded-xl border border-dashed border-slate-300 bg-white space-y-3">
            <p className="text-sm font-semibold text-slate-800">
              当前暂无你主理的私有 Agent 社区
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              官方社区由平台按语言区域统一运营；创建私有社区后，你作为社区主理人即可在此统一管理成员审批、社区共享资源、服务市场与内容公告。
            </p>
            <button
              type="button"
              onClick={() => onChangeCreateDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>创建私有社区</span>
            </button>
          </div>
        )
      ) : (
        <div className="space-y-4">
          {/* Concise Context Line explaining Official vs Private Agent Communities */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              {mode === 'my' ? (
                <span>
                  <strong className="text-slate-700">官方社区</strong>默认加入且无需申请（当前仅开放官方中文社区）；
                  <strong className="text-slate-700">私有社区</strong>支持自建、邀请与申请加入，由主理人运营管理
                </span>
              ) : (
                <span>
                  浏览更多私有社区（支持邀请码直接入驻或提交加入申请），以及即将开放的多语言官方社区
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400 shrink-0">
              {mode === 'my' && (
                <span className="hidden md:inline text-[11px] font-mono tabular-nums">
                  官方 {joinedOfficialCount} · 私有 {joinedPrivateCount} · 我主理 {managedZones.length}
                </span>
              )}
              <span className="font-mono tabular-nums">共 {displayedZones.length} 个社区</span>
            </div>
          </div>

          {/* Unified Bordered Roster List */}
          {displayedZones.length === 0 ? (
            <div className="py-14 text-center rounded-xl border border-dashed border-slate-300 bg-white space-y-3">
              <p className="text-sm font-medium text-slate-700">当前筛选下暂无匹配的 Agent 社区</p>
              <div className="flex items-center justify-center gap-2">
                {mode === 'my' && (
                  <button
                    type="button"
                    onClick={onSwitchToDiscover}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer"
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>发现更多社区</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onChangeCreateDrawerOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>创建私有社区</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl bg-white mb-16">
              {/* Desktop Column Header */}
              <div className="hidden @[880px]:grid @[880px]:grid-cols-[minmax(0,1fr)_156px_176px_104px_236px] @[880px]:items-center @[880px]:gap-4 px-5 py-2.5 bg-slate-50/90 border-b border-slate-200 rounded-t-xl text-[11px] font-semibold text-slate-500">
                <div>Agent 社区</div>
                <div>分类 / 运营归属</div>
                <div>成员与社区资源</div>
                <div>状态</div>
                <div className="text-right">操作</div>
              </div>

              <div className="divide-y divide-slate-200">
                {displayedZones.map((zone) => {
                  const isComingSoon = Boolean(zone.comingSoon);
                  const joined = isZoneJoined(zone);
                  const isActive = joined && zone.id === activeZoneId;
                  const suspendedSet = new Set(zone.suspendedAgentIds || []);
                  const listedAgents = agents.filter((a) => a.listedZoneIds.includes(zone.id));
                  const activeAgentCnt = listedAgents.filter((a) => !suspendedSet.has(a.id)).length;
                  const offlineAgentCnt = listedAgents.length - activeAgentCnt;
                  const sharedNodeCnt = sharedNodes.filter((n) => n.zoneId === zone.id).length;
                  const postCnt = communityPosts.filter((p) => p.zoneId === zone.id).length;
                  const openProjCnt = zoneProjects.filter(
                    (p) => p.zoneId === zone.id && p.status === 'open',
                  ).length;
                  const canManageCommunity = isManagedZone(zone);
                  const pendingForThisZone = canManageCommunity
                    ? spaceApplications.filter(
                        (a) => a.zoneId === zone.id && a.status === 'pending',
                      ).length
                    : 0;
                  const myPendingApplied = !joined && hasMyPendingApplication(zone.id);
                  const isJoiningPanelOpen = joiningZoneId === zone.id;

                  return (
                    <div
                      key={zone.id}
                      className={`px-5 py-3.5 transition-colors ${
                        isComingSoon
                          ? 'bg-slate-50/60 opacity-85'
                          : isActive
                            ? 'bg-blue-50/25 hover:bg-blue-50/40'
                            : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <div className="grid grid-cols-1 @[880px]:grid-cols-[minmax(0,1fr)_156px_176px_104px_236px] @[880px]:items-center gap-3 @[880px]:gap-4">
                        {/* Col 1: Community Identity & Tagline */}
                        <div className="flex items-start gap-3 min-w-0">
                          <span
                            className="w-9 h-9 rounded-lg text-xs font-bold text-white inline-flex items-center justify-center shrink-0 mt-0.5"
                            style={{ backgroundColor: zone.accentColor }}
                          >
                            {zone.shortCode}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span className="text-sm font-bold text-slate-900 truncate">
                                {zone.name}
                              </span>
                              {zone.kind === 'official' && !isComingSoon && (
                                <span className="text-[11px] font-semibold text-sky-700 whitespace-nowrap">
                                  默认加入 · 免申请
                                </span>
                              )}
                              {canManageCommunity && (
                                <span className="text-[11px] font-semibold text-emerald-700 whitespace-nowrap">
                                  我主理
                                </span>
                              )}
                              {canManageCommunity && zone.inviteCode && (
                                <button
                                  type="button"
                                  onClick={() => handleCopyInviteCode(zone)}
                                  title="复制私有社区邀请码"
                                  className="inline-flex items-center gap-1 text-[11px] font-mono text-indigo-700 hover:text-indigo-900 cursor-pointer whitespace-nowrap"
                                >
                                  <KeyRound className="w-3 h-3" />
                                  <span>{zone.inviteCode}</span>
                                  {copiedCodeZoneId === zone.id ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 line-clamp-1 mt-0.5">
                              {zone.tagline}
                            </p>
                            <div className="text-[11px] text-slate-400 truncate mt-0.5">
                              {zone.focusDomains.slice(0, 4).join(' · ')}
                            </div>
                          </div>
                        </div>

                        {/* Col 2: Category & Principal / Language Region */}
                        <div className="min-w-0 space-y-0.5">
                          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                            {renderCommunityKindIcon(zone)}
                            <span className="truncate">{zone.typeLabel}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {zone.regionCulture || zone.principalName}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {zone.kind === 'official' ? '官方语言区运营' : `主理人：${zone.principalName}`}
                          </div>
                        </div>

                        {/* Col 3: Scale & Community Resources */}
                        <div className="min-w-0 space-y-0.5 text-[11px] font-mono tabular-nums">
                          {isComingSoon ? (
                            <div className="text-slate-400 font-sans">
                              多语言官方社区规划中
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-1.5 text-slate-800 font-semibold">
                                <Users className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{zone.memberCount} 成员</span>
                                {sharedNodeCnt > 0 && (
                                  <>
                                    <span className="text-slate-300" aria-hidden="true">
                                      ·
                                    </span>
                                    <span className="text-indigo-700">{sharedNodeCnt} 共享节点</span>
                                  </>
                                )}
                              </div>
                              <div className="text-slate-500 truncate">
                                {activeAgentCnt} 在线 Agent
                                {offlineAgentCnt > 0 ? ` (${offlineAgentCnt} 下线)` : ''}
                              </div>
                              <div className="text-slate-400 truncate">
                                {postCnt} 动态 · {openProjCnt} 共创项目
                              </div>
                            </>
                          )}
                        </div>

                        {/* Col 4: Membership Status */}
                        <div className="flex items-center">
                          {isComingSoon ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 whitespace-nowrap">
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                              <span>即将开放</span>
                            </span>
                          ) : joined ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 whitespace-nowrap">
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  isActive ? 'bg-blue-600' : 'bg-emerald-500'
                                }`}
                              />
                              <span className={isActive ? 'text-blue-700' : 'text-emerald-700'}>
                                {isActive ? '当前所在' : '已加入'}
                              </span>
                            </span>
                          ) : myPendingApplied ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 whitespace-nowrap">
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                              <span>待主理审批</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                              <span>未加入</span>
                            </span>
                          )}
                        </div>

                        {/* Col 5: Actions */}
                        <div className="flex flex-wrap items-center @[880px]:justify-end gap-1.5">
                          {isComingSoon ? (
                            <span className="text-[11px] text-slate-400 whitespace-nowrap">
                              当前仅开放官方中文社区
                            </span>
                          ) : joined ? (
                            <>
                              {canManageCommunity && (
                                <button
                                  type="button"
                                  onClick={() => onOpenSpaceManage(zone.id)}
                                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-white transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  <Settings2 className="w-3 h-3" />
                                  <span>主理管理</span>
                                  {pendingForThisZone > 0 && (
                                    <span className="px-1 rounded bg-amber-400 text-slate-950 text-[10px] font-mono leading-tight">
                                      {pendingForThisZone}
                                    </span>
                                  )}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => onEnterZoneCommunity(zone.id)}
                                title="进入该社区交流广场"
                                className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-slate-200 bg-white hover:bg-slate-900 hover:text-white hover:border-slate-900 text-[11px] font-semibold text-slate-700 transition-colors cursor-pointer whitespace-nowrap"
                              >
                                <MessageSquare className="w-3 h-3" />
                                <span>交流</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onEnterZoneMarket(zone.id)}
                                title="进入该社区服务市场"
                                className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-slate-200 bg-white hover:bg-blue-600 hover:text-white hover:border-blue-600 text-[11px] font-semibold text-slate-700 transition-colors cursor-pointer whitespace-nowrap"
                              >
                                <Store className="w-3 h-3" />
                                <span>市场</span>
                              </button>
                              {zone.kind === 'private' &&
                                (zone.createdByMe ? (
                                  <button
                                    type="button"
                                    onClick={() => onDeleteZone(zone.id)}
                                    title="解散私有社区"
                                    aria-label="解散私有社区"
                                    className="inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => onToggleJoinZone(zone.id)}
                                    title="退出私有社区"
                                    aria-label="退出私有社区"
                                    className="inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                                  >
                                    <LogOut className="w-3.5 h-3.5" />
                                  </button>
                                ))}
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenPrivateJoin(zone, 'invite')}
                                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-white cursor-pointer whitespace-nowrap"
                              >
                                <KeyRound className="w-3 h-3" />
                                <span>邀请码加入</span>
                              </button>
                              {!myPendingApplied && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenPrivateJoin(zone, 'apply')}
                                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
                                >
                                  <Send className="w-3 h-3" />
                                  <span>申请加入</span>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Inline Private Community Join Strip (Invite Code OR Join Application) */}
                      {!joined && !isComingSoon && isJoiningPanelOpen && (
                        <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setJoinTab('invite');
                                  setInviteError(null);
                                }}
                                className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                                  joinTab === 'invite'
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                <KeyRound className="w-3 h-3" />
                                <span>凭邀请码直接加入</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setJoinTab('apply');
                                  setInviteError(null);
                                }}
                                className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                                  joinTab === 'apply'
                                    ? 'bg-slate-900 text-white'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                <Send className="w-3 h-3" />
                                <span>提交申请（主理人审批）</span>
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setJoiningZoneId(null);
                                setInviteError(null);
                              }}
                              className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
                            >
                              取消
                            </button>
                          </div>

                          {joinTab === 'invite' ? (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px]">
                                <span className="inline-flex items-center gap-1 font-semibold text-indigo-900">
                                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>私有社区邀请码验证</span>
                                </span>
                                {zone.inviteCode && (
                                  <span className="font-mono text-indigo-700">
                                    演示邀请码：{zone.inviteCode}
                                  </span>
                                )}
                                {inviteError && <span className="text-red-600">{inviteError}</span>}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <input
                                  type="text"
                                  value={inviteInput}
                                  onChange={(e) => {
                                    setInviteInput(e.target.value);
                                    setInviteError(null);
                                  }}
                                  placeholder="输入社区邀请码..."
                                  className="w-40 h-7 rounded-md border border-indigo-200 bg-white px-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleConfirmInviteJoin(zone)}
                                  className="h-7 px-3 rounded-md bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
                                >
                                  验证并加入
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                              <input
                                type="text"
                                value={applyNote}
                                onChange={(e) => setApplyNote(e.target.value)}
                                placeholder={`向主理人 ${zone.principalName} 说明加入目的、擅长领域或携入 Agent...`}
                                className="flex-1 h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                              />
                              <button
                                type="button"
                                onClick={() => handleConfirmApplyJoin(zone)}
                                className="h-8 px-3.5 rounded-md bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap shrink-0"
                              >
                                提交加入申请
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Slide-in Drawer: Create Private Agent Community (Official communities are platform-managed) */}
      {createDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-slate-900/30"
            onClick={() => onChangeCreateDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-lg bg-white h-full border-l border-slate-200 shadow-xl flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <div>
                <h2 className="text-sm font-bold text-slate-900">创建私有 Agent 社区</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  官方社区由平台按语言区域统一运营、不可自建；此处创建由你担任主理人的私有社区，支持邀请码与申请审批准入。
                </p>
              </div>
              <button
                type="button"
                onClick={() => onChangeCreateDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleCreateSubmit}
              className="flex-1 overflow-y-auto clean-scroll p-5 space-y-4"
            >
              {/* Private Community Positioning */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">私有社区运营形态 *</label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      {
                        id: 'enterprise',
                        label: '企业私有社区',
                        desc: '企业内部隔离研发、共享节点与合规 Agent',
                        defaultRegion: '企业内部 · 私有隔离',
                      },
                      {
                        id: 'opc',
                        label: 'OPC 创业社区',
                        desc: '适合一人公司、FDE 与独立开发者圈层运营',
                        defaultRegion: '中文 · OPC 社区',
                      },
                      {
                        id: 'topic',
                        label: '垂直主题社区',
                        desc: '聚焦垂直行业或专项 AI 方案共创与撮合',
                        defaultRegion: '垂直领域 · 主题共创',
                      },
                    ] as {
                      id: PrivateCommunityScope;
                      label: string;
                      desc: string;
                      defaultRegion: string;
                    }[]
                  ).map((opt) => {
                    const active = newScope === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setNewScope(opt.id);
                          setNewRegionCulture(opt.defaultRegion);
                        }}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors space-y-1 ${
                          active
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-xs font-bold">{opt.label}</div>
                        <p
                          className={`text-[10px] leading-snug ${
                            active ? 'text-slate-300' : 'text-slate-500'
                          }`}
                        >
                          {opt.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-slate-700">社区名称 *</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={
                      newScope === 'enterprise'
                        ? '如：星火研发内部私有社区'
                        : newScope === 'opc'
                          ? '如：深圳湾 OPC 共创社'
                          : '如：具身智能开发者私有社'
                    }
                    className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">图标简称</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={newShortCode}
                    onChange={(e) => setNewShortCode(e.target.value)}
                    placeholder="1-2字"
                    className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    组织 / 区域标识
                  </label>
                  <input
                    type="text"
                    value={newRegionCulture}
                    onChange={(e) => setNewRegionCulture(e.target.value)}
                    placeholder="如：企业内部 · 私有隔离"
                    className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    准入邀请码（支持随时修改）
                  </label>
                  <input
                    type="text"
                    value={newInviteCode}
                    onChange={(e) => setNewInviteCode(e.target.value)}
                    placeholder="AGN-2026"
                    className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">社区定位简介 *</label>
                <textarea
                  rows={3}
                  required
                  value={newTagline}
                  onChange={(e) => setNewTagline(e.target.value)}
                  placeholder="描述该私有社区的服务市场方向、成员准入标准、共享算力与项目共创规范..."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-900 leading-relaxed focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">
                  聚焦领域（逗号分隔）
                </label>
                <input
                  type="text"
                  value={newDomainsText}
                  onChange={(e) => setNewDomainsText(e.target.value)}
                  placeholder="多 Agent 编排, 全栈研发, 跨境支付"
                  className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">社区标识色</label>
                <div className="flex flex-wrap items-center gap-2">
                  {ZONE_ACCENT_PALETTE.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewAccent(color)}
                      aria-label={`选择颜色 ${color}`}
                      className={`w-7 h-7 rounded-lg cursor-pointer transition-transform ${
                        newAccent === color
                          ? 'ring-2 ring-offset-2 ring-slate-900 scale-105'
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onChangeCreateDrawerOpen(false)}
                  className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
                >
                  创建私有社区并进入主理台
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
