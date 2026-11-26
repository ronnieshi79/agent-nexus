import { useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  Blocks,
  Building2,
  Check,
  CheckCircle2,
  Cloud,
  Copy,
  Cpu,
  FileText,
  KeyRound,
  Laptop,
  Lock,
  Megaphone,
  MessageSquare,
  Minus,
  Monitor,
  PauseCircle,
  Pin,
  PinOff,
  PlayCircle,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Server,
  Shield,
  ShieldCheck,
  Sparkles,
  Store,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  XCircle,
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
  SkillKind,
  SpaceJoinApplication,
  SpaceMemberRole,
  SpaceSharedNode,
} from '../../types/agentnexus';
import { AgentIdentityName, EntityAvatar } from '../shared/EntityIdentity';

type ManageTab = 'members' | 'nodes' | 'agents' | 'skills' | 'content';
type AddNodeSource = 'share_mine' | 'mount_private' | 'rent_cloud';

const OS_META: Record<
  NodeOsType,
  { label: string; short: string; defaultVer: string; icon: typeof Server }
> = {
  linux: { label: 'Linux', short: 'Linux', defaultVer: 'Ubuntu 24.04 LTS', icon: Server },
  macos: { label: 'macOS', short: 'macOS', defaultVer: 'macOS Sequoia 15.2', icon: Laptop },
  win11: { label: 'Windows 11', short: 'Win11', defaultVer: 'Windows 11 Pro 24H2', icon: Monitor },
};

const ROLE_LABELS: Record<SpaceMemberRole, { label: string; cls: string }> = {
  owner: { label: '主理人', cls: 'text-blue-700 bg-blue-50 border-blue-200' },
  admin: { label: '管理员', cls: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  member: { label: '成员', cls: 'text-slate-600 bg-slate-100 border-slate-200' },
};

const POST_TYPE_LABELS: Record<CommunityPostType, { label: string; cls: string }> = {
  announcement: { label: '主理公告', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  project: { label: '项目共创', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  skill_share: { label: 'Skill / MCP', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  agn_recommend: { label: '专家 Agent', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  discussion: { label: '交流讨论', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
};

const CLI_CHOICES = ['Claude Code', 'Antigravity', 'Codex', 'Gemini CLI', 'Qoder'];

interface CollabSpaceManagePanelProps {
  zone: CommunityZone;
  sharedNodes: SpaceSharedNode[];
  myComputeNodes: ComputeNode[];
  allAgents: ExpertAgent[];
  humanExperts: HumanExpert[];
  communityPosts: CommunityPost[];
  spaceApplications: SpaceJoinApplication[];
  onBack?: () => void;
  onEnterCommunity: (zoneId: string) => void;
  onEnterMarket: (zoneId: string) => void;
  onInviteMember: (
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
  onUpdateMemberRole: (zoneId: string, memberId: string, role: SpaceMemberRole) => void;
  onKickMember: (zoneId: string, memberId: string) => void;
  onResolveApplication?: (applicationId: string, decision: 'approved' | 'rejected') => void;
  onUpdateInviteCode?: (zoneId: string, newCode: string) => void;
  onAddSharedNode: (
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
  onToggleSharedNodeStatus: (nodeId: string) => void;
  onUpdateSharedNode: (
    nodeId: string,
    patch: Partial<Pick<SpaceSharedNode, 'sharedSandboxQuota' | 'accessPolicy'>>,
  ) => void;
  onRemoveSharedNode: (nodeId: string) => void;
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

export function CollabSpaceManagePanel({
  zone,
  sharedNodes,
  myComputeNodes,
  allAgents,
  humanExperts,
  communityPosts,
  spaceApplications,
  onBack,
  onEnterCommunity,
  onEnterMarket,
  onInviteMember,
  onUpdateMemberRole,
  onKickMember,
  onResolveApplication,
  onUpdateInviteCode,
  onAddSharedNode,
  onToggleSharedNodeStatus,
  onUpdateSharedNode,
  onRemoveSharedNode,
  onToggleSpaceAgentOnline,
  onPublishAgentToSpace,
  onRemoveAgentFromSpace,
  onTogglePinPost,
  onDeletePost,
  onCreatePost,
  marketSkills = [],
  onToggleZoneSkillDistribution,
  onCreateSpaceSkill,
}: CollabSpaceManagePanelProps) {
  const [activeTab, setActiveTab] = useState<ManageTab>('members');
  const [copiedCode, setCopiedCode] = useState(false);

  // Invite code edit state
  const [editingCode, setEditingCode] = useState(false);
  const [codeDraft, setCodeDraft] = useState(zone.inviteCode || '');

  // Member invite state
  const [showInviteBox, setShowInviteBox] = useState(false);
  const [customMemberName, setCustomMemberName] = useState('');
  const [customMemberTitle, setCustomMemberTitle] = useState('');
  const [customMemberRole, setCustomMemberRole] = useState<SpaceMemberRole>('member');

  // Shared node create state
  const [showAddNodeBox, setShowAddNodeBox] = useState(false);
  const [nodeSource, setNodeSource] = useState<AddNodeSource>('share_mine');
  const [pickedMyNodeId, setPickedMyNodeId] = useState<string>(myComputeNodes[0]?.id || '');
  const [newNodeOs, setNewNodeOs] = useState<NodeOsType>('linux');
  const [newNodeName, setNewNodeName] = useState('');
  const [newNodeRegion, setNewNodeRegion] = useState('华东-上海企业共享区');
  const [newNodeCpu, setNewNodeCpu] = useState(16);
  const [newNodeMem, setNewNodeMem] = useState(64);
  const [newNodeQuota, setNewNodeQuota] = useState(4);
  const [newNodePolicy, setNewNodePolicy] = useState<'all_members' | 'admins_only'>('all_members');
  const [newNodeClis, setNewNodeClis] = useState<string[]>(['Claude Code', 'Codex']);

  // Publish Agent to Community Market state
  const [agentToPublishId, setAgentToPublishId] = useState<string>('');

  // Content Management Announcement composer state
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annPinned, setAnnPinned] = useState(true);

  // Community Skills / MCP custom creation state
  const [showNewSkillForm, setShowNewSkillForm] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillKind, setNewSkillKind] = useState<SkillKind>('skill');
  const [newSkillCategory, setNewSkillCategory] = useState<AgentCategory>('engineering');
  const [newSkillPrice, setNewSkillPrice] = useState(0);
  const [newSkillSummary, setNewSkillSummary] = useState('');

  const members = zone.members || [
    {
      id: `mem_owner_${zone.id}`,
      humanExpertId: 'human_me',
      name: zone.principalName,
      title: '社区主理人',
      role: 'owner' as SpaceMemberRole,
      avatarInitials: zone.shortCode,
      avatarAccent: zone.accentColor,
      joinedAt: '今天',
    },
  ];
  const existingExpertIds = new Set(members.map((m) => m.humanExpertId).filter(Boolean));
  const invitableExperts = humanExperts.filter(
    (h) => !h.isCurrentUser && !existingExpertIds.has(h.id),
  );

  const pendingZoneApps = spaceApplications.filter(
    (a) => a.zoneId === zone.id && a.status === 'pending',
  );

  const spaceNodes = sharedNodes.filter((n) => n.zoneId === zone.id);
  const onlineSpaceNodes = spaceNodes.filter((n) => n.status === 'online').length;
  const totalSharedSandboxes = spaceNodes
    .filter((n) => n.status === 'online')
    .reduce((s, n) => s + n.sharedSandboxQuota, 0);

  const suspendedSet = new Set(zone.suspendedAgentIds || []);
  const publishedAgents = allAgents.filter((a) => a.listedZoneIds.includes(zone.id));
  const onlineAgentCount = publishedAgents.filter((a) => !suspendedSet.has(a.id)).length;
  const offlineAgentCount = publishedAgents.length - onlineAgentCount;
  const publishableAgents = allAgents.filter((a) => !a.listedZoneIds.includes(zone.id));

  const zoneSkills = marketSkills.filter((s) => s.zoneIds.includes(zone.id));
  const zonePlatformSkillsCount = zoneSkills.filter((s) => s.origin === 'platform').length;
  const zoneCustomSkillsCount = zoneSkills.length - zonePlatformSkillsCount;
  const importablePlatformSkills = marketSkills.filter(
    (s) => s.origin === 'platform' && !s.zoneIds.includes(zone.id),
  );

  const zonePosts = communityPosts
    .filter((p) => p.zoneId === zone.id)
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
  const pinnedPostsCount = zonePosts.filter((p) => Boolean(p.pinned)).length;

  const handleCopyInvite = () => {
    if (!zone.inviteCode) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(zone.inviteCode).catch(() => {});
    }
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1600);
  };

  const handleSaveInviteCode = () => {
    const clean = codeDraft.trim().toUpperCase();
    if (!clean || !onUpdateInviteCode) return;
    onUpdateInviteCode(zone.id, clean);
    setEditingCode(false);
  };

  const handleRegenerateInviteCode = () => {
    if (!onUpdateInviteCode) return;
    const prefix = (zone.inviteCode?.split('-')[0] || 'AGN').slice(0, 6);
    const nextCode = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    onUpdateInviteCode(zone.id, nextCode);
    setCodeDraft(nextCode);
  };

  const handleCustomInviteSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!customMemberName.trim()) return;
    onInviteMember(zone.id, {
      name: customMemberName.trim(),
      title: customMemberTitle.trim() || '私有社区成员',
      role: customMemberRole,
    });
    setCustomMemberName('');
    setCustomMemberTitle('');
  };

  const toggleCliChoice = (cliName: string) => {
    setNewNodeClis((prev) =>
      prev.includes(cliName)
        ? prev.length > 1
          ? prev.filter((c) => c !== cliName)
          : prev
        : [...prev, cliName],
    );
  };

  const handleAddNodeSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (nodeSource === 'share_mine') {
      const picked = myComputeNodes.find((n) => n.id === pickedMyNodeId);
      if (!picked) return;
      const clis =
        picked.installedClis.length > 0
          ? picked.installedClis.map((c) => c.runtimeAgent)
          : ['Claude Code'];
      const totalQuota = Math.max(
        2,
        picked.installedClis.reduce((s, c) => s + c.concurrency, 0) || newNodeQuota,
      );
      onAddSharedNode(zone.id, {
        name: newNodeName.trim() || `${picked.name}（社区共享）`,
        os: picked.os,
        osVersion: picked.osVersion,
        origin: picked.origin,
        region: picked.region,
        cpuCores: picked.cpuCores,
        memoryGb: picked.memoryGb,
        gpuSpec: picked.gpuSpec,
        supportedClis: clis,
        sharedSandboxQuota: totalQuota,
        accessPolicy: newNodePolicy,
        monthlyCostUsd: picked.monthlyCostUsd,
      });
    } else {
      const isCloud = nodeSource === 'rent_cloud';
      onAddSharedNode(zone.id, {
        name:
          newNodeName.trim() ||
          `${zone.shortCode} 共享${OS_META[newNodeOs].short}节点`,
        os: newNodeOs,
        osVersion: OS_META[newNodeOs].defaultVer,
        origin: isCloud ? 'cloud' : 'private',
        region: newNodeRegion.trim() || (isCloud ? '华东-上海云区' : '企业内网共享机房'),
        cpuCores: newNodeCpu,
        memoryGb: newNodeMem,
        supportedClis: newNodeClis,
        sharedSandboxQuota: newNodeQuota,
        accessPolicy: newNodePolicy,
        monthlyCostUsd: isCloud ? Math.round(newNodeCpu * 4.5 + newNodeMem * 0.3) : 0,
      });
    }
    setNewNodeName('');
    setShowAddNodeBox(false);
  };

  const handlePublishSelectedAgent = () => {
    const targetId = agentToPublishId || publishableAgents[0]?.id;
    if (!targetId) return;
    onPublishAgentToSpace(zone.id, targetId);
    setAgentToPublishId('');
  };

  const handlePublishAnnouncement = (e: FormEvent) => {
    e.preventDefault();
    if (!onCreatePost || !annContent.trim()) return;
    onCreatePost({
      zoneId: zone.id,
      type: 'announcement',
      title: annTitle.trim() || `【社区公告】${annContent.trim().slice(0, 24)}`,
      content: annContent.trim(),
      tags: ['社区公告', '主理发布'],
      pinned: annPinned,
      pinnedBy: zone.principalName,
    });
    setAnnTitle('');
    setAnnContent('');
    setShowAnnouncementForm(false);
  };

  const handleCreateCommunitySkill = (e: FormEvent) => {
    e.preventDefault();
    if (!onCreateSpaceSkill || !newSkillName.trim() || !newSkillSummary.trim()) return;
    onCreateSpaceSkill({
      name: newSkillName.trim(),
      summary: newSkillSummary.trim(),
      kind: newSkillKind,
      category: newSkillCategory,
      priceUsd: Math.max(0, Math.round(Number(newSkillPrice) || 0)),
      zoneIds: [zone.id],
    });
    setNewSkillName('');
    setNewSkillSummary('');
    setNewSkillPrice(0);
    setShowNewSkillForm(false);
  };

  return (
    <div className="space-y-5">
      {/* Top Principal Console Header */}
      <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="mt-0.5 inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>返回</span>
              </button>
            )}
            <span
              className="w-9 h-9 rounded-lg text-xs font-bold text-white inline-flex items-center justify-center shrink-0"
              style={{ backgroundColor: zone.accentColor }}
            >
              {zone.shortCode}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <h2 className="text-sm font-bold text-slate-900 truncate">{zone.name}</h2>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700">
                  {zone.privateScope === 'enterprise' ? (
                    <Building2 className="w-3.5 h-3.5" />
                  ) : (
                    <Lock className="w-3.5 h-3.5" />
                  )}
                  <span>{zone.typeLabel}</span>
                </span>
                {zone.inviteCode && (
                  <button
                    type="button"
                    onClick={handleCopyInvite}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-[11px] font-mono font-semibold text-indigo-700 hover:bg-indigo-100 cursor-pointer"
                  >
                    <KeyRound className="w-3 h-3" />
                    <span>邀请码 {zone.inviteCode}</span>
                    {copiedCode ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate">{zone.tagline}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onEnterCommunity(zone.id)}
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
            >
              <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
              <span>社区交流</span>
            </button>
            <button
              type="button"
              onClick={() => onEnterMarket(zone.id)}
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
            >
              <Store className="w-3.5 h-3.5" />
              <span>服务市场</span>
            </button>
          </div>
        </div>

        {/* 4 Principal Governance Pillars */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
          {(
            [
              {
                id: 'members',
                label: '成员管理',
                count:
                  pendingZoneApps.length > 0
                    ? `${members.length} 人 · ${pendingZoneApps.length} 待审`
                    : `${members.length} 人`,
                alert: pendingZoneApps.length > 0,
                icon: Users,
              },
              {
                id: 'nodes',
                label: '社区资源',
                count: `${onlineSpaceNodes}/${spaceNodes.length} 节点 · ${totalSharedSandboxes} 沙箱`,
                icon: Server,
              },
              {
                id: 'agents',
                label: '服务市场管理',
                count: `${onlineAgentCount} 在线 / ${offlineAgentCount} 下线`,
                icon: Cpu,
              },
              {
                id: 'skills',
                label: 'Skills / MCP 分销',
                count: `${zonePlatformSkillsCount} 平台分销 · ${zoneCustomSkillsCount} 自建`,
                icon: Blocks,
              },
              {
                id: 'content',
                label: '内容管理',
                count: `${zonePosts.length} 动态 · ${pinnedPostsCount} 置顶`,
                icon: FileText,
              },
            ] as {
              id: ManageTab;
              label: string;
              count: string;
              alert?: boolean;
              icon: typeof Users;
            }[]
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                  active
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
                <span
                  className={`font-mono text-[11px] ${
                    active
                      ? 'text-slate-300'
                      : tab.alert
                        ? 'text-amber-700 font-semibold'
                        : 'text-slate-500'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ================= TAB 1: MEMBERS & JOIN APPLICATIONS ================= */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          {/* Pending Join Applications Queue */}
          {pendingZoneApps.length > 0 && onResolveApplication && (
            <div className="bg-amber-50/70 rounded-xl border border-amber-200 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-950">
                  <UserCheck className="w-4 h-4 text-amber-700" />
                  <span>待审批的社区加入申请（{pendingZoneApps.length}）</span>
                </div>
                <span className="text-[11px] text-amber-800/80">
                  同意后自动加入成员列表并同步通知 Nexa 助理
                </span>
              </div>
              <div className="divide-y divide-amber-200/70 rounded-lg border border-amber-200/80 bg-white">
                {pendingZoneApps.map((app) => (
                  <div
                    key={app.id}
                    className="px-3.5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <EntityAvatar
                        kind="human"
                        code={app.avatarInitials}
                        accent={app.avatarAccent}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">
                            {app.applicantName}
                          </span>
                          <span className="text-[11px] text-slate-500">{app.applicantTitle}</span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {app.createdAt}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{app.note}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onResolveApplication(app.id, 'approved')}
                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-[11px] font-semibold text-white cursor-pointer whitespace-nowrap"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>同意加入</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onResolveApplication(app.id, 'rejected')}
                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-slate-200 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-[11px] font-semibold text-slate-600 cursor-pointer whitespace-nowrap"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>拒绝</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-slate-600">
              主理人统一管理「{zone.name}」的成员准入与权限，支持审批外部加入申请、主动邀请成员、指定管理员与移出社区。
            </div>
            <button
              type="button"
              onClick={() => setShowInviteBox((v) => !v)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{showInviteBox ? '收起邀请面板' : '邀请成员加入'}</span>
            </button>
          </div>

          {showInviteBox && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
              {/* Quick Invite from Platform Experts */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-900">从平台专家 / 协作者快速邀请</div>
                {invitableExperts.length === 0 ? (
                  <div className="text-xs text-slate-400">全部已知专家均已加入该私有社区。</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {invitableExperts.slice(0, 6).map((exp) => (
                      <div
                        key={exp.id}
                        className="flex items-center justify-between gap-2.5 p-2.5 rounded-lg border border-slate-200 bg-slate-50/60"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <EntityAvatar
                            kind="human"
                            code={exp.avatarInitials}
                            accent={exp.avatarAccent}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 truncate">
                              {exp.name}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">{exp.title}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            onInviteMember(zone.id, {
                              humanExpertId: exp.id,
                              name: exp.name,
                              title: exp.title,
                              role: 'member',
                              avatarInitials: exp.avatarInitials,
                              avatarAccent: exp.avatarAccent,
                            })
                          }
                          className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-white cursor-pointer whitespace-nowrap shrink-0"
                        >
                          邀请加入
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Manual Invite Colleague / External Member */}
              <form
                onSubmit={handleCustomInviteSubmit}
                className="pt-3 border-t border-slate-100 space-y-2"
              >
                <div className="text-xs font-bold text-slate-900">
                  邀请新成员（企业同事 / OPC 伙伴）
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="text"
                    required
                    value={customMemberName}
                    onChange={(e) => setCustomMemberName(e.target.value)}
                    placeholder="成员姓名 *"
                    className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none"
                  />
                  <input
                    type="text"
                    value={customMemberTitle}
                    onChange={(e) => setCustomMemberTitle(e.target.value)}
                    placeholder="岗位 / 职责（如：后端工程师）"
                    className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none"
                  />
                  <select
                    value={customMemberRole}
                    onChange={(e) => setCustomMemberRole(e.target.value as SpaceMemberRole)}
                    className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none"
                  >
                    <option value="member">角色：普通成员</option>
                    <option value="admin">角色：社区管理员</option>
                  </select>
                  <button
                    type="submit"
                    className="h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white cursor-pointer"
                  >
                    发送邀请并加入
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Member Roster Table */}
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {members.map((mem) => {
              const roleMeta = ROLE_LABELS[mem.role];
              const isOwner = mem.role === 'owner';
              const memberAgentsCount = mem.humanExpertId
                ? publishedAgents.filter((a) => a.ownerHumanId === mem.humanExpertId).length
                : 0;

              return (
                <div
                  key={mem.id}
                  className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <EntityAvatar
                      kind="human"
                      code={mem.avatarInitials}
                      accent={mem.avatarAccent}
                      size="md"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{mem.name}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${roleMeta.cls}`}
                        >
                          {roleMeta.label}
                        </span>
                        {memberAgentsCount > 0 && (
                          <span className="text-[11px] text-slate-500 font-mono">
                            已上架 {memberAgentsCount} 个专业 Agent
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {mem.title} · 加入于 {mem.joinedAt}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!isOwner ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateMemberRole(
                              zone.id,
                              mem.id,
                              mem.role === 'admin' ? 'member' : 'admin',
                            )
                          }
                          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer"
                        >
                          <Shield className="w-3 h-3 text-indigo-600" />
                          <span>{mem.role === 'admin' ? '降为成员' : '设为管理员'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onKickMember(zone.id, mem.id)}
                          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-red-200/80 bg-white hover:bg-red-50 text-[11px] font-semibold text-red-600 cursor-pointer"
                        >
                          <UserMinus className="w-3 h-3" />
                          <span>移出社区</span>
                        </button>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                        <span>主理人最高权限</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= TAB 2: COMMUNITY RESOURCES & INVITE ACCESS ================= */}
      {activeTab === 'nodes' && (
        <div className="space-y-4">
          {/* Invite Code & Access Control Strip */}
          {onUpdateInviteCode && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                  <span>社区准入邀请码</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  成员输入邀请码可直接加入本私有社区；未持有邀请码的外部用户可提交申请由主理人审批。
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {editingCode ? (
                  <>
                    <input
                      type="text"
                      value={codeDraft}
                      onChange={(e) => setCodeDraft(e.target.value)}
                      placeholder="输入新邀请码"
                      className="w-36 h-8 rounded-lg border border-indigo-300 bg-slate-50 px-2.5 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSaveInviteCode}
                      className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white cursor-pointer"
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCode(false);
                        setCodeDraft(zone.inviteCode || '');
                      }}
                      className="h-8 px-2 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      取消
                    </button>
                  </>
                ) : (
                  <>
                    <span className="h-8 px-3 rounded-lg bg-indigo-50 border border-indigo-200 inline-flex items-center text-xs font-mono font-bold text-indigo-800">
                      {zone.inviteCode || '未设置'}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyInvite}
                      className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                    >
                      {copiedCode ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedCode ? '已复制' : '复制'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRegenerateInviteCode}
                      title="随机重置邀请码"
                      className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>重置</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCodeDraft(zone.inviteCode || '');
                        setEditingCode(true);
                      }}
                      className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                    >
                      自定义
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-slate-600">
              为「{zone.name}」配置社区共享算力与 Agent 运行资源，支持共享个人节点、挂载企业内网设备或租用云端节点，并控制并发沙箱配额与成员访问权限。
            </div>
            <button
              type="button"
              onClick={() => setShowAddNodeBox((v) => !v)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showAddNodeBox ? '收起新建节点' : '接入社区共享节点'}</span>
            </button>
          </div>

          {showAddNodeBox && (
            <form
              onSubmit={handleAddNodeSubmit}
              className="bg-white rounded-xl border border-slate-200 p-4 space-y-3.5"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(
                  [
                    {
                      id: 'share_mine',
                      label: '共享我的 Agent 节点',
                      desc: '从 AGN空间一键共享',
                    },
                    {
                      id: 'mount_private',
                      label: '挂载企业私有节点',
                      desc: '接入团队 Win11/Linux/Mac',
                    },
                    {
                      id: 'rent_cloud',
                      label: '租用社区云端节点',
                      desc: '社区统一按月租用云主机',
                    },
                  ] as { id: AddNodeSource; label: string; desc: string }[]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setNodeSource(opt.id)}
                    className={`p-2.5 rounded-lg border text-left cursor-pointer transition-colors ${
                      nodeSource === opt.id
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50/70 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-xs font-bold">{opt.label}</div>
                    <div
                      className={`text-[10px] mt-0.5 ${
                        nodeSource === opt.id ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {opt.desc}
                    </div>
                  </button>
                ))}
              </div>

              {nodeSource === 'share_mine' ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <select
                    value={pickedMyNodeId}
                    onChange={(e) => setPickedMyNodeId(e.target.value)}
                    className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none"
                  >
                    {myComputeNodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name} ({n.cpuCores}C/{n.memoryGb}G)
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={newNodeName}
                    onChange={(e) => setNewNodeName(e.target.value)}
                    placeholder="社区内显示名称（可选）"
                    className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:bg-white focus:outline-none"
                  />
                  <select
                    value={newNodePolicy}
                    onChange={(e) =>
                      setNewNodePolicy(e.target.value as 'all_members' | 'admins_only')
                    }
                    className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none"
                  >
                    <option value="all_members">权限：全体社区成员可用</option>
                    <option value="admins_only">权限：仅管理员可用</option>
                  </select>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                    <input
                      type="text"
                      value={newNodeName}
                      onChange={(e) => setNewNodeName(e.target.value)}
                      placeholder="共享节点名称（如：研发共享 Linux-02）"
                      className="sm:col-span-2 h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:bg-white focus:outline-none"
                    />
                    <select
                      value={newNodeOs}
                      onChange={(e) => setNewNodeOs(e.target.value as NodeOsType)}
                      className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none"
                    >
                      <option value="linux">系统：Linux</option>
                      <option value="macos">系统：macOS</option>
                      <option value="win11">系统：Windows 11</option>
                    </select>
                    <input
                      type="text"
                      value={newNodeRegion}
                      onChange={(e) => setNewNodeRegion(e.target.value)}
                      placeholder="区域 / 机房位置"
                      className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <label className="text-[11px] text-slate-600 space-y-1">
                      <span>CPU 核数</span>
                      <input
                        type="number"
                        min={4}
                        max={128}
                        value={newNodeCpu}
                        onChange={(e) => setNewNodeCpu(Number(e.target.value))}
                        className="w-full h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-mono text-slate-900"
                      />
                    </label>
                    <label className="text-[11px] text-slate-600 space-y-1">
                      <span>内存 (GB)</span>
                      <input
                        type="number"
                        min={8}
                        max={512}
                        value={newNodeMem}
                        onChange={(e) => setNewNodeMem(Number(e.target.value))}
                        className="w-full h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-mono text-slate-900"
                      />
                    </label>
                    <label className="text-[11px] text-slate-600 space-y-1">
                      <span>共享并发沙箱数</span>
                      <input
                        type="number"
                        min={1}
                        max={32}
                        value={newNodeQuota}
                        onChange={(e) => setNewNodeQuota(Number(e.target.value))}
                        className="w-full h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-mono text-slate-900"
                      />
                    </label>
                    <label className="text-[11px] text-slate-600 space-y-1">
                      <span>成员访问权限</span>
                      <select
                        value={newNodePolicy}
                        onChange={(e) =>
                          setNewNodePolicy(e.target.value as 'all_members' | 'admins_only')
                        }
                        className="w-full h-8 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs text-slate-900"
                      >
                        <option value="all_members">全体成员可用</option>
                        <option value="admins_only">仅管理员可用</option>
                      </select>
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="text-slate-600 font-semibold mr-1">预装 Agent CLI：</span>
                    {CLI_CHOICES.map((cli) => {
                      const active = newNodeClis.includes(cli);
                      return (
                        <button
                          key={cli}
                          type="button"
                          onClick={() => toggleCliChoice(cli)}
                          className={`px-2 py-0.5 rounded-md border font-medium cursor-pointer ${
                            active
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {cli}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddNodeBox(false)}
                  className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="h-8 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white cursor-pointer"
                >
                  确认接入共享节点
                </button>
              </div>
            </form>
          )}

          {spaceNodes.length === 0 ? (
            <div className="py-12 text-center rounded-xl border border-dashed border-slate-300 bg-white space-y-2.5">
              <p className="text-sm font-medium text-slate-700">
                当前私有社区尚未配置共享 Agent 节点
              </p>
              <button
                type="button"
                onClick={() => setShowAddNodeBox(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>接入首个共享节点</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 @[920px]:grid-cols-2 gap-4">
              {spaceNodes.map((node) => {
                const osMeta = OS_META[node.os];
                const OsIcon = osMeta.icon;
                const isOnline = node.status === 'online';
                return (
                  <article
                    key={node.id}
                    className="bg-white rounded-xl border border-slate-200 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                          <OsIcon className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <h3 className="text-sm font-bold text-slate-900 truncate">
                              {node.name}
                            </h3>
                            <span
                              className={`text-[11px] font-semibold ${
                                isOnline ? 'text-emerald-700' : 'text-slate-400'
                              }`}
                            >
                              · {isOnline ? '在线共享' : '已暂停'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {node.osVersion} · {node.region} ·{' '}
                            {node.origin === 'cloud'
                              ? `云端租用 $${node.monthlyCostUsd}/月`
                              : '自有设备共享'}
                          </div>
                        </div>
                      </div>

                      <select
                        value={node.accessPolicy}
                        onChange={(e) =>
                          onUpdateSharedNode(node.id, {
                            accessPolicy: e.target.value as 'all_members' | 'admins_only',
                          })
                        }
                        aria-label="共享节点访问权限"
                        className="h-7 rounded-md border border-slate-200 bg-slate-50 px-2 text-[11px] font-semibold text-slate-700 focus:outline-none"
                      >
                        <option value="all_members">全体成员可用</option>
                        <option value="admins_only">仅管理员可用</option>
                      </select>
                    </div>

                    <div className="rounded-lg bg-slate-50 border border-slate-200/70 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="space-y-0.5">
                        <div className="font-mono font-semibold text-slate-800">
                          {node.cpuCores} vCPU · {node.memoryGb} GB RAM
                          {node.gpuSpec ? ` · ${node.gpuSpec}` : ''}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          支持 CLI：{node.supportedClis.join(' / ')}
                        </div>
                      </div>

                      {/* Shared Sandbox Quota Stepper */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[11px] text-slate-500 mr-0.5">共享沙箱</span>
                        <button
                          type="button"
                          disabled={node.sharedSandboxQuota <= Math.max(1, node.usedSandboxes)}
                          onClick={() =>
                            onUpdateSharedNode(node.id, {
                              sharedSandboxQuota: Math.max(
                                Math.max(1, node.usedSandboxes),
                                node.sharedSandboxQuota - 1,
                              ),
                            })
                          }
                          aria-label="减少共享沙箱配额"
                          className="w-6 h-6 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 flex items-center justify-center cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="min-w-[54px] text-center font-mono tabular-nums font-bold text-slate-900">
                          {node.usedSandboxes}/{node.sharedSandboxQuota}
                        </span>
                        <button
                          type="button"
                          disabled={node.sharedSandboxQuota >= 32}
                          onClick={() =>
                            onUpdateSharedNode(node.id, {
                              sharedSandboxQuota: Math.min(32, node.sharedSandboxQuota + 1),
                            })
                          }
                          aria-label="增加共享沙箱配额"
                          className="w-6 h-6 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onToggleSharedNodeStatus(node.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer"
                      >
                        {isOnline ? (
                          <>
                            <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
                            <span>暂停共享</span>
                          </>
                        ) : (
                          <>
                            <PlayCircle className="w-3.5 h-3.5 text-emerald-600" />
                            <span>恢复上线</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => onRemoveSharedNode(node.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{node.origin === 'cloud' ? '退租释放' : '移除节点'}</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 3: COMMUNITY SERVICE MARKET GOVERNANCE ================= */}
      {activeTab === 'agents' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="text-xs text-slate-600 leading-relaxed">
              <span className="font-semibold text-slate-900">社区服务市场管理：</span>
              管理已上架到「{zone.name}」服务市场的专业 Agent。点击「下线停服」可立即暂停在本社区服务市场的曝光与接单，随时一键恢复上线或移出本社区。
            </div>

            {publishableAgents.length > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={agentToPublishId || publishableAgents[0]?.id || ''}
                  onChange={(e) => setAgentToPublishId(e.target.value)}
                  aria-label="选择要上架到本社区服务市场的专业 Agent"
                  className="h-8 max-w-[220px] rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none"
                >
                  {publishableAgents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.handle} · {a.runtimeAgent} ({a.ownerHumanName || '自建'})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handlePublishSelectedAgent}
                  className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
                >
                  <Cloud className="w-3.5 h-3.5" />
                  <span>上架到本社区</span>
                </button>
              </div>
            )}
          </div>

          {publishedAgents.length === 0 ? (
            <div className="py-12 text-center rounded-xl border border-dashed border-slate-300 bg-white space-y-2">
              <p className="text-sm font-medium text-slate-700">
                当前私有社区服务市场尚未上架任何专业 Agent
              </p>
              <p className="text-xs text-slate-400">
                请在上方选择专业 Agent 上架到本社区，或在「Agent 成员」创建自建 Agent 时勾选上架本社区。
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
              {publishedAgents.map((agent) => {
                const isSuspended = suspendedSet.has(agent.id);
                return (
                  <div
                    key={agent.id}
                    className={`px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                      isSuspended ? 'bg-slate-50/70' : 'hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <EntityAvatar
                        kind="agent"
                        code={agent.avatarCode}
                        accent={agent.avatarAccent}
                        size="md"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <AgentIdentityName
                            name={agent.handle}
                            runtime={agent.runtimeAgent}
                            model={agent.defaultModel}
                            showModel
                            className="text-xs font-bold text-slate-900"
                          />
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              isSuspended
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isSuspended ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                            />
                            <span>{isSuspended ? '已下线（停服）' : '在线服务中'}</span>
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                          归属：{agent.ownerHumanName || '林致远（我）'} · {agent.title}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onToggleSpaceAgentOnline(zone.id, agent.id)}
                        className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-md border text-[11px] font-semibold cursor-pointer transition-colors ${
                          isSuspended
                            ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-white border-amber-300 text-amber-800 hover:bg-amber-50'
                        }`}
                      >
                        {isSuspended ? (
                          <>
                            <Power className="w-3 h-3" />
                            <span>重新上线</span>
                          </>
                        ) : (
                          <>
                            <PowerOff className="w-3 h-3" />
                            <span>下线停服</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => onRemoveAgentFromSpace(zone.id, agent.id)}
                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-medium text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>移出市场</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 4: SKILLS / MCP DISTRIBUTION & CUSTOM SUPPLY ================= */}
      {activeTab === 'skills' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="text-xs text-slate-600 leading-relaxed">
              <span className="font-semibold text-slate-900">社区 Skills / MCP 双轨供给：</span>
              可一键引入 <strong className="text-blue-700">AGN 平台官方维护</strong> 的高阶 Skill / MCP 在「{zone.name}」进行分销（成员购买后本社区自动获得 <span className="font-mono font-semibold text-emerald-700">20%</span> 渠道分润），也可发布社区自建专属能力包供成员装配。
            </div>
            {onCreateSpaceSkill && (
              <button
                type="button"
                onClick={() => setShowNewSkillForm((v) => !v)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showNewSkillForm ? '收起新建表单' : '新建社区自建 Skill / MCP'}</span>
              </button>
            )}
          </div>

          {showNewSkillForm && onCreateSpaceSkill && (
            <form
              onSubmit={handleCreateCommunitySkill}
              className="bg-white rounded-xl border border-slate-200 p-4 space-y-3"
            >
              <div className="text-xs font-bold text-slate-900">
                创建并上架社区专属自建 Skill / MCP 到「{zone.name}」
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <input
                  type="text"
                  required
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                  placeholder="能力包名称（如：社区合规审计 Skill）*"
                  className="sm:col-span-2 h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:bg-white focus:outline-none"
                />
                <select
                  value={newSkillKind}
                  onChange={(e) => setNewSkillKind(e.target.value as SkillKind)}
                  className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none"
                >
                  <option value="skill">类型：SKILL 规范包</option>
                  <option value="mcp">类型：MCP 工具服务</option>
                  <option value="workflow">类型：工作流模板包</option>
                </select>
                <select
                  value={newSkillCategory}
                  onChange={(e) => setNewSkillCategory(e.target.value as AgentCategory)}
                  className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none"
                >
                  <option value="engineering">类目：研发开发</option>
                  <option value="architecture">类目：架构审查</option>
                  <option value="qa">类目：测试质量</option>
                  <option value="product">类目：产品策划</option>
                  <option value="design">类目：设计体验</option>
                  <option value="media">类目：自媒体运营</option>
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <input
                  type="text"
                  required
                  value={newSkillSummary}
                  onChange={(e) => setNewSkillSummary(e.target.value)}
                  placeholder="能力简介与适用场景（供社区成员识别与装配）*"
                  className="sm:col-span-3 h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:bg-white focus:outline-none"
                />
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-500 whitespace-nowrap">买断价 $</span>
                  <input
                    type="number"
                    min={0}
                    max={999}
                    value={newSkillPrice}
                    onChange={(e) => setNewSkillPrice(Number(e.target.value))}
                    className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewSkillForm(false)}
                  className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="h-8 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white cursor-pointer"
                >
                  创建并上架社区市场
                </button>
              </div>
            </form>
          )}

          {/* Currently Listed Skills / MCP in This Community */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-900">
                本社区已上架的 Skills / MCP（{zoneSkills.length}）
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                平台官方分销 {zonePlatformSkillsCount} · 自建/共创 {zoneCustomSkillsCount}
              </span>
            </div>

            {zoneSkills.length === 0 ? (
              <div className="py-10 text-center rounded-xl border border-dashed border-slate-300 bg-white text-xs text-slate-500">
                本社区尚未上架任何 Skill / MCP，可从下方引入 AGN 平台官方能力包进行分销，或新建自建能力包。
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                {zoneSkills.map((skill) => {
                  const isPlatform = skill.origin === 'platform';
                  const sharePct = skill.distributionSharePct ?? 20;
                  return (
                    <div
                      key={skill.id}
                      className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono font-semibold text-slate-700">
                            {skill.kind === 'mcp'
                              ? 'MCP'
                              : skill.kind === 'workflow'
                                ? 'WORKFLOW'
                                : 'SKILL'}
                          </span>
                          {isPlatform ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-[10px] font-semibold text-blue-700">
                              <Sparkles className="w-2.5 h-2.5" />
                              <span>平台官方分销 · 分润 {sharePct}%</span>
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[10px] font-semibold text-emerald-700">
                              {skill.origin === 'custom' ? '团队自建' : '社区共创'}
                            </span>
                          )}
                          <span className="text-xs font-bold text-slate-900">{skill.name}</span>
                          <span className="text-[11px] font-mono text-slate-500">
                            {(skill.priceUsd ?? 0) > 0 ? `$${skill.priceUsd}` : '免费'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-1">{skill.summary}</p>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {skill.slug} · {skill.authorName} · {skill.installs} 安装
                        </div>
                      </div>

                      {onToggleZoneSkillDistribution && (
                        <button
                          type="button"
                          onClick={() => onToggleZoneSkillDistribution(zone.id, skill.id)}
                          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-slate-200 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-[11px] font-semibold text-slate-600 cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>{isPlatform ? '停止分销' : '下架移出'}</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Import AGN Platform Official Skills for Community Distribution */}
          {onToggleZoneSkillDistribution && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-900">
                  从 AGN 平台官方库引入分销（{importablePlatformSkills.length} 可引入）
                </span>
                <span className="text-[11px] text-blue-700 font-medium">
                  官方统一维护更新 · 社区成交享 20% 渠道分润
                </span>
              </div>

              {importablePlatformSkills.length === 0 ? (
                <div className="py-6 text-center rounded-xl border border-slate-200 bg-slate-50/70 text-xs text-slate-500">
                  全部 AGN 平台官方维护的 Skills / MCP 均已引入本社区分销。
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {importablePlatformSkills.map((skill) => {
                    const sharePct = skill.distributionSharePct ?? 20;
                    const price = skill.priceUsd ?? 0;
                    const estCommission = Math.round((price * sharePct) / 100);
                    return (
                      <div
                        key={skill.id}
                        className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-col justify-between gap-2.5"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-[10px] font-semibold text-blue-700 shrink-0">
                                平台官方
                              </span>
                              <span className="text-xs font-bold text-slate-900 truncate">
                                {skill.name}
                              </span>
                            </div>
                            <span className="text-xs font-mono font-bold text-slate-900 shrink-0">
                              {price > 0 ? `$${price}` : '免费'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                            {skill.summary}
                          </p>
                        </div>
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                          <span className="text-[11px] text-emerald-700 font-medium">
                            {price > 0
                              ? `分销每单分润 $${estCommission} (${sharePct}%)`
                              : '官方免费标准包 · 提升社区活跃'}
                          </span>
                          <button
                            type="button"
                            onClick={() => onToggleZoneSkillDistribution(zone.id, skill.id)}
                            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-white cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <Plus className="w-3 h-3" />
                            <span>引入本社区分销</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 5: COMMUNITY CONTENT GOVERNANCE ================= */}
      {activeTab === 'content' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-slate-600">
              主理人可在此统一管理「{zone.name}」的社区动态内容：发布官方置顶公告、置顶优质经验贴或移除违规/过期动态。
            </div>
            {onCreatePost && (
              <button
                type="button"
                onClick={() => setShowAnnouncementForm((v) => !v)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
              >
                <Megaphone className="w-3.5 h-3.5" />
                <span>{showAnnouncementForm ? '收起公告发布' : '发布社区公告'}</span>
              </button>
            )}
          </div>

          {showAnnouncementForm && onCreatePost && (
            <form
              onSubmit={handlePublishAnnouncement}
              className="bg-white rounded-xl border border-slate-200 p-4 space-y-3"
            >
              <div className="text-xs font-bold text-slate-900">
                以主理人身份发布公告到「{zone.name}」
              </div>
              <input
                type="text"
                required
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                placeholder="公告标题（如：【社区公告】本周新增共享算力配额与项目共创规则）"
                className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:bg-white focus:outline-none"
              />
              <textarea
                rows={3}
                required
                value={annContent}
                onChange={(e) => setAnnContent(e.target.value)}
                placeholder="输入公告正文内容，发布后将同步出现在该社区的交流动态流..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-900 leading-relaxed focus:bg-white focus:outline-none"
              />
              <div className="flex items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={annPinned}
                    onChange={(e) => setAnnPinned(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span>发布后自动置顶</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAnnouncementForm(false)}
                    className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="h-8 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white cursor-pointer"
                  >
                    发布公告
                  </button>
                </div>
              </div>
            </form>
          )}

          {zonePosts.length === 0 ? (
            <div className="py-12 text-center rounded-xl border border-dashed border-slate-300 bg-white space-y-2">
              <p className="text-sm font-medium text-slate-700">当前社区暂无动态内容</p>
              <p className="text-xs text-slate-400">
                可点击右上角「发布社区公告」向社区成员同步规则或最新资源动态。
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
              {zonePosts.map((post) => {
                const typeMeta = POST_TYPE_LABELS[post.type] || POST_TYPE_LABELS.discussion;
                return (
                  <div
                    key={post.id}
                    className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3 hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {post.pinned && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-[10px] font-semibold text-blue-700">
                            <Pin className="w-2.5 h-2.5" />
                            <span>已置顶</span>
                          </span>
                        )}
                        <span
                          className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${typeMeta.cls}`}
                        >
                          {typeMeta.label}
                        </span>
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {post.title}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {post.content}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 font-mono">
                        <span className="font-sans text-slate-500">
                          {post.authorName} ({post.authorRole})
                        </span>
                        <span>·</span>
                        <span>{post.createdAt}</span>
                        <span>·</span>
                        <span>{post.likes} 赞</span>
                        <span>·</span>
                        <span>{post.comments.length} 评论</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {onTogglePinPost && (
                        <button
                          type="button"
                          onClick={() => onTogglePinPost(post.id, zone.principalName)}
                          className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-md border text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                            post.pinned
                              ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {post.pinned ? (
                            <>
                              <PinOff className="w-3 h-3" />
                              <span>取消置顶</span>
                            </>
                          ) : (
                            <>
                              <Pin className="w-3 h-3" />
                              <span>主理置顶</span>
                            </>
                          )}
                        </button>
                      )}
                      {onDeletePost && (
                        <button
                          type="button"
                          onClick={() => onDeletePost(post.id)}
                          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-medium text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer whitespace-nowrap"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>移除</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
