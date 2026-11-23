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
  const createdByMeCount = zones.filter((z) => z.createdByMe).length;
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

  // In 'my' mode: show joined/created spaces; in 'discover' mode: show unjoined first, then joined third-party/platform spaces for searchability
  const displayedZones =
    mode === 'my'
      ? joinedList.filter(matchesFilters)
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
        <>
      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 @[760px]:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium">已加入协作空间</span>
            <Globe className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {joinedList.length}
            </span>
            <span className="text-xs font-semibold text-emerald-700">实时同步市场/社区</span>
          </div>
          <div className="text-[11px] text-slate-500">
            含平台默认公共空间（中文 AI 社区）
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium">开放性空间</span>
            <Compass className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {joinedOpenCount}
            </span>
            <span className="text-xs text-slate-500">已加入</span>
          </div>
          <div className="text-[11px] text-slate-500">地域/文化开放社区与行业共创空间</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium">企业封闭空间</span>
            <Building2 className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {joinedEnterpriseCount}
            </span>
            <span className="text-xs text-slate-500">已加入</span>
          </div>
          <div className="text-[11px] text-slate-500">企业/组织内私有隔离 · 凭证准入</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium">
              {mode === 'my' ? '我创建的空间' : '待探索第三方空间'}
            </span>
            <Users className="w-4 h-4 text-slate-600" />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {mode === 'my' ? createdByMeCount : discoverableUnjoined.length}
            </span>
            <span className="text-xs text-slate-500">
              {mode === 'my' ? '自建主理' : '可检索加入'}
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            {mode === 'my'
              ? `另有 ${discoverableUnjoined.length} 个第三方空间可探索`
              : '支持开放社区直入与封闭空间验证接入'}
          </div>
        </div>
      </div>

      {/* Contextual Guidance Bar */}
      <section className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="text-xs text-slate-600 leading-relaxed">
          {mode === 'my' ? (
            <>
              <span className="font-semibold text-slate-900">协作空间统一管理：</span>
              当前已加入的所有空间会自动同步为「服务市场」与「交流社区」的可切换范围；平台默认开放「中文 AI 社区」，确保随时可进入公共生态协作与交易。
            </>
          ) : (
            <>
              <span className="font-semibold text-slate-900">发现平台与第三方协作空间：</span>
              支持按地域/文化检索平台开放社区（如东南亚英文、西班牙语 AI 社区）或输入邀请码加入第三方企业封闭空间，随时可自由加入或退出。
            </>
          )}
        </div>
        {mode === 'my' && discoverableUnjoined.length > 0 && (
          <button
            type="button"
            onClick={onSwitchToDiscover}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-900 hover:text-white hover:border-slate-900 text-xs font-semibold text-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>发现更多空间 ({discoverableUnjoined.length})</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        )}
      </section>

      {/* Spaces Grid */}
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
                <span>去发现空间</span>
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
        <div className="grid grid-cols-1 @[920px]:grid-cols-2 gap-4">
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
              <article
                key={zone.id}
                className={`bg-white rounded-xl border p-4 flex flex-col justify-between gap-3.5 transition-colors ${
                  isActive
                    ? 'border-blue-300 ring-1 ring-blue-100'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="space-y-3">
                  {/* Top Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span
                        className="w-9 h-9 rounded-lg text-xs font-bold text-white inline-flex items-center justify-center shrink-0"
                        style={{ backgroundColor: zone.accentColor }}
                      >
                        {zone.shortCode}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <h3 className="text-sm font-bold text-slate-900 truncate">{zone.name}</h3>
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                            {renderSpaceKindIcon(zone.kind)}
                            <span>{zone.typeLabel}</span>
                          </span>
                          {zone.isPlatformDefault && (
                            <span className="text-[11px] font-semibold text-blue-700">· 平台默认</span>
                          )}
                          {zone.createdByMe && (
                            <span className="text-[11px] font-semibold text-emerald-700">· 我创建</span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
                          {zone.regionCulture && <span>{zone.regionCulture}</span>}
                          {zone.regionCulture && (
                            <span className="text-slate-300" aria-hidden="true">·</span>
                          )}
                          <span>主理：{zone.principalName}</span>
                          <span className="text-slate-300" aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{zone.memberCount} 成员</span>
                        </div>
                      </div>
                    </div>

                    {joined ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 whitespace-nowrap shrink-0">
                        <Check className="w-3.5 h-3.5" />
                        <span>{isActive ? '当前所在' : '已加入'}</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap shrink-0">
                        未加入
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">{zone.tagline}</p>

                  {/* Metrics & Focus Domains */}
                  <div className="rounded-lg bg-slate-50/90 border border-slate-200/70 px-3 py-2.5 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <span className="font-mono tabular-nums text-slate-700 font-semibold">
                        {sharedNodeCnt > 0 ? `${sharedNodeCnt} 共享节点 · ` : ''}
                        {activeAgentCnt} 在线 Agent
                        {offlineAgentCnt > 0 ? ` (${offlineAgentCnt} 下线)` : ''} · {postCnt} 社区帖 ·{' '}
                        {openProjCnt} 开放项目
                      </span>
                      {zone.createdByMe && zone.kind === 'enterprise' && zone.inviteCode && (
                        <button
                          type="button"
                          onClick={() => handleCopyInviteCode(zone)}
                          className="inline-flex items-center gap-1 font-mono text-indigo-700 hover:text-indigo-900 cursor-pointer"
                        >
                          <KeyRound className="w-3 h-3" />
                          <span>邀请码 {zone.inviteCode}</span>
                          {copiedCodeZoneId === zone.id ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      聚焦领域：{zone.focusDomains.join(' · ')}
                    </div>
                  </div>

                  {/* Enterprise Join Verification Box (Inline) */}
                  {!joined && isVerifying && zone.kind === 'enterprise' && (
                    <div className="rounded-lg bg-indigo-50/60 border border-indigo-200 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="inline-flex items-center gap-1 font-semibold text-indigo-900">
                          <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                          <span>企业封闭空间准入验证</span>
                        </span>
                        {zone.inviteCode && (
                          <span className="font-mono text-indigo-700">
                            演示码：{zone.inviteCode}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={inviteInput}
                          onChange={(e) => {
                            setInviteInput(e.target.value);
                            setInviteError(null);
                          }}
                          placeholder="输入企业空间邀请码..."
                          className="flex-1 min-w-0 h-8 rounded-md border border-indigo-200 bg-white px-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <button
                          type="button"
                          onClick={() => handleConfirmEnterpriseJoin(zone)}
                          className="h-8 px-3 rounded-md bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
                        >
                          验证加入
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setVerifyingZoneId(null);
                            setInviteError(null);
                          }}
                          className="h-8 px-2 rounded-md text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                        >
                          取消
                        </button>
                      </div>
                      {inviteError && <div className="text-[11px] text-red-600">{inviteError}</div>}
                    </div>
                  )}
                </div>

                {/* Bottom Action Row */}
                <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  {joined ? (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        {canManageSpace && (
                          <button
                            type="button"
                            onClick={() => onOpenSpaceManage(zone.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-white transition-colors cursor-pointer"
                          >
                            <Settings2 className="w-3 h-3" />
                            <span>空间管理</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onEnterZoneCommunity(zone.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-900 hover:text-white hover:border-slate-900 text-[11px] font-semibold text-slate-700 transition-colors cursor-pointer"
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>交流社区</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onEnterZoneMarket(zone.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-blue-600 hover:text-white hover:border-blue-600 text-[11px] font-semibold text-slate-700 transition-colors cursor-pointer"
                        >
                          <Store className="w-3 h-3" />
                          <span>服务市场</span>
                        </button>
                      </div>

                      {zone.isPlatformDefault ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                          <Globe className="w-3 h-3" />
                          <span>平台默认常驻</span>
                        </span>
                      ) : zone.createdByMe ? (
                        <button
                          type="button"
                          onClick={() => onDeleteZone(zone.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>解散空间</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onToggleJoinZone(zone.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>退出空间</span>
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="text-[11px] text-slate-500">
                        {zone.kind === 'enterprise'
                          ? '封闭空间需验证邀请码后访问市场与社区'
                          : '开放空间可直接加入，立即解锁市场与交流社区'}
                      </span>
                      {zone.kind === 'enterprise' ? (
                        <button
                          type="button"
                          onClick={() => handleOpenEnterpriseJoin(zone)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>验证加入</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onToggleJoinZone(zone.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>加入空间</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
        </>
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
