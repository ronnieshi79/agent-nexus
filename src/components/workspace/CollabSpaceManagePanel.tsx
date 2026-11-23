import { useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  Building2,
  Check,
  Cloud,
  Compass,
  Copy,
  Cpu,
  KeyRound,
  Laptop,
  MessageSquare,
  Minus,
  Monitor,
  PauseCircle,
  PlayCircle,
  Plus,
  Power,
  PowerOff,
  Server,
  Shield,
  ShieldCheck,
  Store,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import type {
  CommunityZone,
  ComputeNode,
  ExpertAgent,
  HumanExpert,
  NodeOsType,
  SpaceMemberRole,
  SpaceSharedNode,
} from '../../types/agentnexus';
import { AgentIdentityName, EntityAvatar } from '../shared/EntityIdentity';

type ManageTab = 'members' | 'nodes' | 'agents';
type AddNodeSource = 'share_mine' | 'mount_private' | 'rent_cloud';

const OS_META: Record<NodeOsType, { label: string; short: string; defaultVer: string; icon: typeof Server }> = {
  linux: { label: 'Linux', short: 'Linux', defaultVer: 'Ubuntu 24.04 LTS', icon: Server },
  macos: { label: 'macOS', short: 'macOS', defaultVer: 'macOS Sequoia 15.2', icon: Laptop },
  win11: { label: 'Windows 11', short: 'Win11', defaultVer: 'Windows 11 Pro 24H2', icon: Monitor },
};

const ROLE_LABELS: Record<SpaceMemberRole, { label: string; cls: string }> = {
  owner: { label: '创建者', cls: 'text-blue-700 bg-blue-50 border-blue-200' },
  admin: { label: '管理员', cls: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  member: { label: '成员', cls: 'text-slate-600 bg-slate-100 border-slate-200' },
};

const CLI_CHOICES = ['Claude Code', 'Antigravity', 'Codex', 'Gemini CLI', 'Qoder'];

interface CollabSpaceManagePanelProps {
  zone: CommunityZone;
  sharedNodes: SpaceSharedNode[];
  myComputeNodes: ComputeNode[];
  allAgents: ExpertAgent[];
  humanExperts: HumanExpert[];
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
}

export function CollabSpaceManagePanel({
  zone,
  sharedNodes,
  myComputeNodes,
  allAgents,
  humanExperts,
  onBack,
  onEnterCommunity,
  onEnterMarket,
  onInviteMember,
  onUpdateMemberRole,
  onKickMember,
  onAddSharedNode,
  onToggleSharedNodeStatus,
  onUpdateSharedNode,
  onRemoveSharedNode,
  onToggleSpaceAgentOnline,
  onPublishAgentToSpace,
  onRemoveAgentFromSpace,
}: CollabSpaceManagePanelProps) {
  const [activeTab, setActiveTab] = useState<ManageTab>('members');
  const [copiedCode, setCopiedCode] = useState(false);

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

  // Publish Agent to Space state
  const [agentToPublishId, setAgentToPublishId] = useState<string>('');

  const members = zone.members || [
    {
      id: `mem_owner_${zone.id}`,
      humanExpertId: 'human_me',
      name: zone.principalName,
      title: '空间创建者',
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

  const handleCopyInvite = () => {
    if (!zone.inviteCode) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(zone.inviteCode).catch(() => {});
    }
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1600);
  };

  const handleCustomInviteSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!customMemberName.trim()) return;
    onInviteMember(zone.id, {
      name: customMemberName.trim(),
      title: customMemberTitle.trim() || '协作空间成员',
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
        name: newNodeName.trim() || `${picked.name}（空间共享）`,
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

  return (
    <div className="space-y-5">
      {/* Top Space Management Header */}
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
                  {zone.kind === 'enterprise' ? (
                    <Building2 className="w-3.5 h-3.5" />
                  ) : (
                    <Compass className="w-3.5 h-3.5" />
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
              <span>交流社区</span>
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

        {/* 3 Governance Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
          {(
            [
              {
                id: 'members',
                label: '空间成员管理',
                count: `${members.length} 人`,
                icon: Users,
              },
              {
                id: 'nodes',
                label: '共享 Agent 节点',
                count: `${onlineSpaceNodes}/${spaceNodes.length} 在线 · ${totalSharedSandboxes} 沙箱`,
                icon: Server,
              },
              {
                id: 'agents',
                label: '专业 Agent 上下线管理',
                count: `${onlineAgentCount} 在线 / ${offlineAgentCount} 下线`,
                icon: Cpu,
              },
            ] as { id: ManageTab; label: string; count: string; icon: typeof Users }[]
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
                    active ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ================= TAB 1: SPACE MEMBERS GOVERNANCE ================= */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-slate-600">
              管理「{zone.name}」的成员准入与权限，支持邀请平台专家或内部成员、设置管理员与踢出成员。
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
                  <div className="text-xs text-slate-400">全部已知专家均已加入该协作空间。</div>
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
                <div className="text-xs font-bold text-slate-900">邀请新成员（公司同事 / 外部协作者）</div>
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
                    <option value="admin">角色：空间管理员</option>
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
                            已发布 {memberAgentsCount} 个专业 Agent
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
                          <span>踢出空间</span>
                        </button>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                        <span>最高权限</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= TAB 2: SHARED AGENT NODES GOVERNANCE ================= */}
      {activeTab === 'nodes' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-slate-600">
              为「{zone.name}」建立与管理共享 Agent 节点，支持共享个人节点、挂载公司内网设备或统一租用云端节点，并控制并发沙箱配额与成员访问权限。
            </div>
            <button
              type="button"
              onClick={() => setShowAddNodeBox((v) => !v)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showAddNodeBox ? '收起新建节点' : '建立共享 Agent 节点'}</span>
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
                    { id: 'share_mine', label: '共享我的 Agent 节点', desc: '从个人 Agent 空间一键共享' },
                    { id: 'mount_private', label: '挂载公司私有节点', desc: '接入团队 Win11/Linux/Mac' },
                    { id: 'rent_cloud', label: '租用空间云端节点', desc: '空间统一按月租用云主机' },
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
                    placeholder="空间内显示名称（可选）"
                    className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:bg-white focus:outline-none"
                  />
                  <select
                    value={newNodePolicy}
                    onChange={(e) =>
                      setNewNodePolicy(e.target.value as 'all_members' | 'admins_only')
                    }
                    className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none"
                  >
                    <option value="all_members">权限：全体空间成员可用</option>
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
              <p className="text-sm font-medium text-slate-700">当前协作空间尚未配置共享 Agent 节点</p>
              <button
                type="button"
                onClick={() => setShowAddNodeBox(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>建立首个共享节点</span>
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

      {/* ================= TAB 3: PUBLISHED PROFESSIONAL AGENTS GOVERNANCE ================= */}
      {activeTab === 'agents' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="text-xs text-slate-600 leading-relaxed">
              <span className="font-semibold text-slate-900">空间专业 Agent 治理：</span>
              控制已发布到「{zone.name}」的专业 / 专家 Agent 上下线状态。点击「下线」后该 Agent 将立即暂停在本空间服务市场的展示与接单，随时可一键恢复上线或移出空间。
            </div>

            {publishableAgents.length > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={agentToPublishId || publishableAgents[0]?.id || ''}
                  onChange={(e) => setAgentToPublishId(e.target.value)}
                  aria-label="选择要发布到本空间的专业 Agent"
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
                  <span>发布到本空间</span>
                </button>
              </div>
            )}
          </div>

          {publishedAgents.length === 0 ? (
            <div className="py-12 text-center rounded-xl border border-dashed border-slate-300 bg-white space-y-2">
              <p className="text-sm font-medium text-slate-700">
                当前协作空间尚未发布任何专业 Agent
              </p>
              <p className="text-xs text-slate-400">
                请在上方选择专业 Agent 发布到本空间，或在 AGN 团队创建自建 Agent 时勾选上架本空间。
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
                        <span>移出空间</span>
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
  );
}
