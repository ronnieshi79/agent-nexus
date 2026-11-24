import { useState, type FormEvent } from 'react';
import {
  ArrowUpRight,
  Building2,
  Check,
  Compass,
  Copy,
  Globe,
  KeyRound,
  LogOut,
  MessageSquare,
  Plus,
  Settings2,
  ShieldCheck,
  Store,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type {
  CommunityPost,
  CommunityZone,
  ComputeNode,
  ExpertAgent,
  HumanExpert,
  NodeOsType,
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
  searchKeyword: string;
  kindFilter: 'all' | 'open' | 'enterprise';
  roleFilter?: 'all' | 'managed' | 'joined';
  pendingApplicationsCount?: number;
  onOpenAssistant?: () => void;
  createDrawerOpen: boolean;
  onChangeCreateDrawerOpen: (open: boolean) => void;
  onCreateZone: (input: {
    name: string;
    shortCode: string;
    kind: 'community' | 'enterprise';
    regionCulture: string;
    tagline: string;
    focusDomains: string[];
    accentColor: string;
    inviteCode?: string;
  }) => string;
  onToggleJoinZone: (zoneId: string) => void;
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
  searchKeyword,
  kindFilter,
  roleFilter = 'all',
  pendingApplicationsCount = 0,
  onOpenAssistant,
  createDrawerOpen,
  onChangeCreateDrawerOpen,
  onCreateZone,
  onToggleJoinZone,
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
}: CollabSpacesPanelProps) {
  // Enterprise space invite verification inline state
  const [verifyingZoneId, setVerifyingZoneId] = useState<string | null>(null);
  const [inviteInput, setInviteInput] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copiedCodeZoneId, setCopiedCodeZoneId] = useState<string | null>(null);

  // Create Space Drawer Form State
  const [newKind, setNewKind] = useState<'community' | 'enterprise'>('community');
  const [newName, setNewName] = useState('');
  const [newShortCode, setNewShortCode] = useState('');
  const [newRegionCulture, setNewRegionCulture] = useState('中文 · 华语圈');
  const [newTagline, setNewTagline] = useState('');
  const [newDomainsText, setNewDomainsText] = useState('多 Agent 协同, 全栈交付, Skills 共创');
  const [newAccent, setNewAccent] = useState('#0f766e');
  const [newInviteCode, setNewInviteCode] = useState('SPACE-2026');

  const isZoneJoined = (z: CommunityZone) =>
    Boolean(z.isPlatformDefault || joinedZoneIds.includes(z.id));

  const joinedList = zones.filter((z) => isZoneJoined(z));
  const discoverableUnjoined = zones.filter((z) => !isZoneJoined(z));
  const joinedOpenCount = joinedList.filter((z) => z.kind !== 'enterprise').length;
  const joinedEnterpriseCount = joinedList.filter((z) => z.kind === 'enterprise').length;

  const q = searchKeyword.trim().toLowerCase();

  const matchesFilters = (z: CommunityZone) => {
    if (kindFilter === 'open' && z.kind === 'enterprise') return false;
    if (kindFilter === 'enterprise' && z.kind !== 'enterprise') return false;
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
    Boolean(z.createdByMe || z.isCurrentUserPrincipal);

  // In 'my' mode: filter by roleFilter and sort managed spaces first so admins can immediately jump into governance;
  // in 'discover' mode: show unjoined first, then joined third-party/platform spaces for searchability.
  const displayedZones =
    mode === 'my'
      ? joinedList
          .filter((z) => {
            if (roleFilter === 'managed' && !isManagedZone(z)) return false;
            if (roleFilter === 'joined' && isManagedZone(z)) return false;
            return matchesFilters(z);
          })
          .sort((a, b) => Number(isManagedZone(b)) - Number(isManagedZone(a)))
      : [
          ...discoverableUnjoined.filter(matchesFilters),
          ...joinedList.filter((z) => !z.createdByMe && matchesFilters(z)),
        ];

  const handleCopyInviteCode = (zone: CommunityZone) => {
    if (!zone.inviteCode) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(zone.inviteCode).catch(() => {});
    }
    setCopiedCodeZoneId(zone.id);
    setTimeout(() => setCopiedCodeZoneId(null), 1600);
  };

  const handleOpenEnterpriseJoin = (zone: CommunityZone) => {
    setVerifyingZoneId(zone.id);
    setInviteInput(zone.inviteCode || '');
    setInviteError(null);
  };

  const handleConfirmEnterpriseJoin = (zone: CommunityZone) => {
    const expected = (zone.inviteCode || '').trim().toUpperCase();
    const entered = inviteInput.trim().toUpperCase();
    if (expected && entered !== expected) {
      setInviteError(`邀请码不匹配，请输入 ${expected} 或联系空间管理员 ${zone.principalName}`);
      return;
    }
    onToggleJoinZone(zone.id);
    setVerifyingZoneId(null);
    setInviteInput('');
    setInviteError(null);
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

    const newId = onCreateZone({
      name: cleanedName,
      shortCode: derivedShort,
      kind: newKind,
      regionCulture:
        newRegionCulture.trim() ||
        (newKind === 'enterprise' ? '企业内部 · 私有隔离' : '中文 · 开放协作'),
      tagline:
        newTagline.trim() ||
        (newKind === 'enterprise'
          ? '企业内部封闭协作空间，隔离核心研发项目、私有 Agent 与内部知识资产'
          : '面向同领域开发者的开放性协作社区，交流实战经验与撮合项目'),
      focusDomains: parsedDomains.length > 0 ? parsedDomains : ['多 Agent 协同', '项目交付'],
      accentColor: newAccent,
      inviteCode: newKind === 'enterprise' ? newInviteCode.trim() || 'SPACE-2026' : undefined,
    });

    setNewName('');
    setNewShortCode('');
    setNewTagline('');
    onChangeCreateDrawerOpen(false);
    if (newId) {
      onOpenSpaceManage(newId);
    }
  };

  const renderSpaceKindIcon = (kind: CommunityZone['kind']) => {
    if (kind === 'public') return <Globe className="w-3.5 h-3.5 text-sky-600 shrink-0" />;
    if (kind === 'enterprise') return <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />;
    return <Compass className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
  };

  const managedZones = zones.filter((z) => Boolean(z.createdByMe || z.isCurrentUserPrincipal));
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
                    有 {pendingApplicationsCount} 条人员入驻申请待审批
                  </span>
                  <span className="text-indigo-800/80 ml-1.5">
                    动态成员申请已收口至「Nexa 助理」消息卡片处理，同意后自动写入空间成员列表。
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onOpenAssistant}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-[11px] font-semibold text-white cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>去 Nexa 助理审批</span>
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
              onEnterCommunity={onEnterZoneCommunity}
              onEnterMarket={onEnterZoneMarket}
              onInviteMember={onInviteSpaceMember}
              onUpdateMemberRole={onUpdateSpaceMemberRole}
              onKickMember={onKickSpaceMember}
              onAddSharedNode={onAddSpaceSharedNode}
              onToggleSharedNodeStatus={onToggleSpaceSharedNodeStatus}
              onUpdateSharedNode={onUpdateSpaceSharedNode}
              onRemoveSharedNode={onRemoveSpaceSharedNode}
              onToggleSpaceAgentOnline={onToggleSpaceAgentOnline}
              onPublishAgentToSpace={onPublishAgentToSpace}
              onRemoveAgentFromSpace={onRemoveAgentFromSpace}
            />
          </div>
        ) : (
          <div className="py-16 text-center rounded-xl border border-dashed border-slate-300 bg-white space-y-3">
            <p className="text-sm font-semibold text-slate-800">
              当前暂无可管理的自建或主理协作空间
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              创建企业封闭空间或开放性社区后，即可在此统一管理空间成员、共享 Agent 节点配额与已发布专业 Agent 的上下线状态。
            </p>
            <button
              type="button"
              onClick={() => onChangeCreateDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>创建协作空间</span>
            </button>
          </div>
        )
      ) : (
        <div className="space-y-4">
          {/* Concise Context Line — matching Agent 成员 / 合作专家 / 我的好友 */}
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-slate-500 truncate">
              {mode === 'my' ? (
                <span>
                  已加入空间自动同步为「服务市场」与「交流社区」范围，我创建/主理的空间置顶展示
                </span>
              ) : (
                <span>
                  按地域/文化检索平台开放社区，或输入邀请码加入第三方企业封闭空间
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400 shrink-0">
              {mode === 'my' && (
                <span className="hidden md:inline text-[11px] font-mono tabular-nums">
                  开放 {joinedOpenCount} · 企业 {joinedEnterpriseCount} · 我管理 {managedZones.length}
                </span>
              )}
              <span className="font-mono tabular-nums">共 {displayedZones.length} 个空间</span>
            </div>
          </div>

          {/* Unified Bordered Roster List */}
          {displayedZones.length === 0 ? (
            <div className="py-14 text-center rounded-xl border border-dashed border-slate-300 bg-white space-y-3">
              <p className="text-sm font-medium text-slate-700">当前筛选下暂无匹配的协作空间</p>
              <div className="flex items-center justify-center gap-2">
                {mode === 'my' && (
                  <button
                    type="button"
                    onClick={onSwitchToDiscover}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer"
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>发现更多空间</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onChangeCreateDrawerOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>创建协作空间</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl bg-white mb-16">
              {/* Desktop Column Header */}
              <div className="hidden @[880px]:grid @[880px]:grid-cols-[minmax(0,1fr)_148px_176px_96px_228px] @[880px]:items-center @[880px]:gap-4 px-5 py-2.5 bg-slate-50/90 border-b border-slate-200 rounded-t-xl text-[11px] font-semibold text-slate-500">
                <div>协作空间</div>
                <div>类型 / 归属</div>
                <div>成员与资源</div>
                <div>状态</div>
                <div className="text-right">操作</div>
              </div>

              <div className="divide-y divide-slate-200">
                {displayedZones.map((zone) => {
                  const joined = isZoneJoined(zone);
                  const isActive = zone.id === activeZoneId;
                  const suspendedSet = new Set(zone.suspendedAgentIds || []);
                  const listedAgents = agents.filter((a) => a.listedZoneIds.includes(zone.id));
                  const activeAgentCnt = listedAgents.filter((a) => !suspendedSet.has(a.id)).length;
                  const offlineAgentCnt = listedAgents.length - activeAgentCnt;
                  const sharedNodeCnt = sharedNodes.filter((n) => n.zoneId === zone.id).length;
                  const postCnt = communityPosts.filter((p) => p.zoneId === zone.id).length;
                  const openProjCnt = zoneProjects.filter(
                    (p) => p.zoneId === zone.id && p.status === 'open',
                  ).length;
                  const canManageSpace = Boolean(zone.createdByMe || zone.isCurrentUserPrincipal);
                  const isVerifying = verifyingZoneId === zone.id;

                  return (
                    <div
                      key={zone.id}
                      className={`px-5 py-3.5 transition-colors ${
                        isActive ? 'bg-blue-50/25 hover:bg-blue-50/40' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <div className="grid grid-cols-1 @[880px]:grid-cols-[minmax(0,1fr)_148px_176px_96px_228px] @[880px]:items-center gap-3 @[880px]:gap-4">
                        {/* Col 1: Space Identity & Tagline */}
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
                              {zone.createdByMe && (
                                <span className="text-[11px] font-semibold text-emerald-700 whitespace-nowrap">
                                  我创建
                                </span>
                              )}
                              {zone.isPlatformDefault && (
                                <span className="text-[11px] font-semibold text-blue-700 whitespace-nowrap">
                                  平台默认
                                </span>
                              )}
                              {zone.createdByMe && zone.kind === 'enterprise' && zone.inviteCode && (
                                <button
                                  type="button"
                                  onClick={() => handleCopyInviteCode(zone)}
                                  title="复制空间邀请码"
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

                        {/* Col 2: Type & Principal / Region */}
                        <div className="min-w-0 space-y-0.5">
                          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                            {renderSpaceKindIcon(zone.kind)}
                            <span className="truncate">{zone.typeLabel}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {zone.regionCulture || `主理：${zone.principalName}`}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            主理：{zone.principalName}
                          </div>
                        </div>

                        {/* Col 3: Scale & Resources */}
                        <div className="min-w-0 space-y-0.5 text-[11px] font-mono tabular-nums">
                          <div className="flex items-center gap-1.5 text-slate-800 font-semibold">
                            <Users className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{zone.memberCount} 成员</span>
                            {sharedNodeCnt > 0 && (
                              <>
                                <span className="text-slate-300" aria-hidden="true">·</span>
                                <span className="text-indigo-700">{sharedNodeCnt} 共享节点</span>
                              </>
                            )}
                          </div>
                          <div className="text-slate-500 truncate">
                            {activeAgentCnt} 在线 Agent
                            {offlineAgentCnt > 0 ? ` (${offlineAgentCnt} 下线)` : ''}
                          </div>
                          <div className="text-slate-400 truncate">
                            {postCnt} 帖子 · {openProjCnt} 开放项目
                          </div>
                        </div>

                        {/* Col 4: Membership Status */}
                        <div className="flex items-center">
                          {joined ? (
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
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                              <span>未加入</span>
                            </span>
                          )}
                        </div>

                        {/* Col 5: Actions */}
                        <div className="flex flex-wrap items-center @[880px]:justify-end gap-1.5">
                          {joined ? (
                            <>
                              {canManageSpace && (
                                <button
                                  type="button"
                                  onClick={() => onOpenSpaceManage(zone.id)}
                                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-white transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  <Settings2 className="w-3 h-3" />
                                  <span>管理</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => onEnterZoneCommunity(zone.id)}
                                title="进入该空间交流社区"
                                className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-slate-200 bg-white hover:bg-slate-900 hover:text-white hover:border-slate-900 text-[11px] font-semibold text-slate-700 transition-colors cursor-pointer whitespace-nowrap"
                              >
                                <MessageSquare className="w-3 h-3" />
                                <span>社区</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onEnterZoneMarket(zone.id)}
                                title="进入该空间服务市场"
                                className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-slate-200 bg-white hover:bg-blue-600 hover:text-white hover:border-blue-600 text-[11px] font-semibold text-slate-700 transition-colors cursor-pointer whitespace-nowrap"
                              >
                                <Store className="w-3 h-3" />
                                <span>市场</span>
                              </button>
                              {!zone.isPlatformDefault &&
                                (zone.createdByMe ? (
                                  <button
                                    type="button"
                                    onClick={() => onDeleteZone(zone.id)}
                                    title="解散空间"
                                    aria-label="解散空间"
                                    className="inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => onToggleJoinZone(zone.id)}
                                    title="退出空间"
                                    aria-label="退出空间"
                                    className="inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                                  >
                                    <LogOut className="w-3.5 h-3.5" />
                                  </button>
                                ))}
                            </>
                          ) : zone.kind === 'enterprise' ? (
                            <button
                              type="button"
                              onClick={() => handleOpenEnterpriseJoin(zone)}
                              className="inline-flex items-center gap-1 h-7 px-3 rounded-md bg-indigo-600 hover:bg-indigo-700 text-[11px] font-semibold text-white cursor-pointer whitespace-nowrap"
                            >
                              <KeyRound className="w-3 h-3" />
                              <span>验证加入</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onToggleJoinZone(zone.id)}
                              className="inline-flex items-center gap-1 h-7 px-3 rounded-md bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-white cursor-pointer whitespace-nowrap"
                            >
                              <Plus className="w-3 h-3" />
                              <span>加入空间</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Inline Enterprise Invite Code Verification Strip */}
                      {!joined && isVerifying && zone.kind === 'enterprise' && (
                        <div className="mt-3 rounded-lg bg-indigo-50/70 border border-indigo-200 px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px]">
                            <span className="inline-flex items-center gap-1 font-semibold text-indigo-900">
                              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                              <span>企业封闭空间准入验证</span>
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
                              placeholder="输入邀请码..."
                              className="w-40 h-7 rounded-md border border-indigo-200 bg-white px-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                            <button
                              type="button"
                              onClick={() => handleConfirmEnterpriseJoin(zone)}
                              className="h-7 px-3 rounded-md bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
                            >
                              确认加入
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setVerifyingZoneId(null);
                                setInviteError(null);
                              }}
                              className="h-7 px-2 rounded-md text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                            >
                              取消
                            </button>
                          </div>
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

      {/* Slide-in Drawer: Create Collaboration Space */}
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
                <h2 className="text-sm font-bold text-slate-900">创建协作空间</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  可创建企业封闭空间（私有隔离）或开放性社区空间，创建后自动同步至服务市场与交流社区。
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
              {/* Space Category Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">协作空间类型 *</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setNewKind('community');
                      if (newRegionCulture === '企业内部 · 私有隔离') {
                        setNewRegionCulture('中文 · 华语圈');
                      }
                    }}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-colors space-y-1 ${
                      newKind === 'community'
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold">
                      <Compass className="w-3.5 h-3.5" />
                      <span>开放性空间（社区）</span>
                    </div>
                    <p
                      className={`text-[11px] leading-snug ${
                        newKind === 'community' ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      公开可检索加入，适合地域/行业社区交流、共享 Skills 与项目撮合
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewKind('enterprise');
                      if (newRegionCulture === '中文 · 华语圈') {
                        setNewRegionCulture('企业内部 · 私有隔离');
                      }
                    }}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-colors space-y-1 ${
                      newKind === 'enterprise'
                        ? 'border-indigo-700 bg-indigo-700 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>企业封闭空间</span>
                    </div>
                    <p
                      className={`text-[11px] leading-snug ${
                        newKind === 'enterprise' ? 'text-indigo-100' : 'text-slate-500'
                      }`}
                    >
                      凭邀请码准入，隔离企业私有 Agent、内部代码规范与保密项目
                    </p>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-slate-700">空间名称 *</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={
                      newKind === 'enterprise'
                        ? '如：星火研发内部封闭空间'
                        : '如：粤港澳 AI 独立开发社区'
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
                    地域 / 文化或组织标识
                  </label>
                  <input
                    type="text"
                    value={newRegionCulture}
                    onChange={(e) => setNewRegionCulture(e.target.value)}
                    placeholder="如：中文 · 华语圈 / 企业内部"
                    className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:bg-white focus:outline-none"
                  />
                </div>

                {newKind === 'enterprise' && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">
                      准入邀请码（企业封闭）
                    </label>
                    <input
                      type="text"
                      value={newInviteCode}
                      onChange={(e) => setNewInviteCode(e.target.value)}
                      placeholder="SPACE-2026"
                      className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">空间定位简介 *</label>
                <textarea
                  rows={3}
                  required
                  value={newTagline}
                  onChange={(e) => setNewTagline(e.target.value)}
                  placeholder="描述该协作空间的核心议题、服务市场方向或项目协作规范..."
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
                <label className="text-xs font-semibold text-slate-700">空间标识色</label>
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
                  创建并加入协作空间
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
