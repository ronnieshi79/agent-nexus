import { useCallback, useMemo, useState } from 'react';
import {
  INITIAL_AGENT_LEASES,
  INITIAL_ASSISTANT_MESSAGES,
  INITIAL_AUDIT_LOGS,
  INITIAL_COMMUNITY_POSTS,
  INITIAL_COMPUTE_NODES,
  INITIAL_EXPERT_AGENTS,
  INITIAL_HUMAN_EXPERTS,
  INITIAL_MESSAGES,
  INITIAL_NEGOTIATIONS,
  INITIAL_PROJECT_PIPELINES,
  INITIAL_SETTLEMENTS,
  INITIAL_SPACE_APPLICATIONS,
  INITIAL_SPACE_SHARED_NODES,
  INITIAL_STORAGE_VOLUMES,
  INITIAL_TASKS,
  INITIAL_TASK_SESSIONS,
  INITIAL_TEAM_EXPERTS,
  INITIAL_WORKSPACES,
  INITIAL_ZONES,
  INITIAL_ZONE_PROJECTS,
} from '../data/initialData';
import {
  LEASE_PERIOD_META,
  getAgentLeasePricing,
} from '../components/shared/EntityIdentity';
import {
  executeKanbanTask,
  orchestrateGroupChat,
  sendExpertDirectMessage,
  sendPlatformAssistantMessage,
  sendTaskSessionMessage,
} from '../services/api';
import type {
  ActiveChatChannel,
  AgentCategory,
  AgentLeaseRecord,
  AgentNexusAccount,
  AssistantMessage,
  ChatMessage,
  CliAuthMode,
  CliToolType,
  CommunityPost,
  CommunityPostType,
  CommunityZone,
  ComputeNode,
  DirectMessage,
  ExpertAgent,
  ExpertRelationType,
  LeasePeriod,
  NavViewId,
  NegotiationThread,
  NodeCliConfig,
  NodeCliEntry,
  NodeOsType,
  PipelineHandoffMode,
  PlatformAuditLog,
  PlatformServiceCategory,
  ProjectLifecycleStatus,
  ProjectStageSlot,
  ProjectWorkspace,
  SettlementRecord,
  SpaceJoinApplication,
  SpaceMember,
  SpaceMemberRole,
  SpaceSharedNode,
  StorageBillingMode,
  StorageVolume,
  TaskSessionMessage,
  TaskStatus,
  TeamExpertMembership,
  TeamSectionTab,
  WorkCardType,
  WorkflowTask,
  WorkspaceTabId,
  ZoneProjectOpportunity,
} from '../types/agentnexus';

function nowTimeStr(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatUsd(amount: number): string {
  return `$${Math.round(amount).toLocaleString('en-US')}`;
}

export interface CreateWorkCardInput {
  sessionId?: string;
  featureModule: string;
  workType: WorkCardType;
  title: string;
  description: string;
  assigneeId: string;
  priority: '高' | '中' | '低';
}

export function useAgentNexusStore() {
  const [zones, setZones] = useState<CommunityZone[]>(INITIAL_ZONES);
  const [humanExperts] = useState(INITIAL_HUMAN_EXPERTS);
  const [activeZoneId, setActiveZoneId] = useState<string>('zone_public');
  const [joinedZoneIds, setJoinedZoneIds] = useState<string[]>([
    'zone_public',
    'zone_my_company',
    'zone_hz_dnx',
    'zone_zj_opc',
    'zone_ai_robotics',
  ]);
  const [spaceSharedNodes, setSpaceSharedNodes] = useState<SpaceSharedNode[]>(
    INITIAL_SPACE_SHARED_NODES,
  );

  const [activeView, setActiveView] = useState<NavViewId>('chat');
  const [workspaces, setWorkspaces] = useState<ProjectWorkspace[]>(INITIAL_WORKSPACES);
  const [zoneProjects, setZoneProjects] = useState<ZoneProjectOpportunity[]>(INITIAL_ZONE_PROJECTS);
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>(INITIAL_COMMUNITY_POSTS);
  const [followedEntityKeys, setFollowedEntityKeys] = useState<string[]>([
    'human:陈可心',
    'human:沈知行',
    'human:顾承砚',
    'agent:架构审查员',
  ]);
  const [activeSessionId, setActiveSessionId] = useState<string>(INITIAL_WORKSPACES[0].id);

  // Unified Chat Channel: Platform Assistant | Project Group | External Expert DM
  const [activeChatChannel, setActiveChatChannel] = useState<ActiveChatChannel>({
    type: 'group',
    projectId: INITIAL_WORKSPACES[0].id,
  });

  const [agents, setAgents] = useState<ExpertAgent[]>(INITIAL_EXPERT_AGENTS);
  const [allTasks, setAllTasks] = useState<WorkflowTask[]>(INITIAL_TASKS);
  const [allMessages, setAllMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [taskSessions, setTaskSessions] =
    useState<Record<string, TaskSessionMessage[]>>(INITIAL_TASK_SESSIONS);
  const [negotiations, setNegotiations] = useState<NegotiationThread[]>(INITIAL_NEGOTIATIONS);
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>(
    INITIAL_ASSISTANT_MESSAGES,
  );
  const [settlements, setSettlements] = useState<SettlementRecord[]>(INITIAL_SETTLEMENTS);
  const [spaceApplications, setSpaceApplications] = useState<SpaceJoinApplication[]>(
    INITIAL_SPACE_APPLICATIONS,
  );
  const [auditLogs, setAuditLogs] = useState<PlatformAuditLog[]>(INITIAL_AUDIT_LOGS);
  const [agentLeases, setAgentLeases] =
    useState<Record<string, AgentLeaseRecord>>(INITIAL_AGENT_LEASES);
  const [purchasedSkillIds, setPurchasedSkillIds] = useState<string[]>([
    'skill_ts_scaffold',
    'skill_stripe_idempotency',
    'skill_robot_cloud_mcp',
  ]);
  const [teamExperts, setTeamExperts] = useState<TeamExpertMembership[]>(INITIAL_TEAM_EXPERTS);
  const [computeNodes, setComputeNodes] = useState<ComputeNode[]>(INITIAL_COMPUTE_NODES);
  const [storageVolumes, setStorageVolumes] = useState<StorageVolume[]>(INITIAL_STORAGE_VOLUMES);
  const [projectPipelines, setProjectPipelines] =
    useState<Record<string, ProjectStageSlot[]>>(INITIAL_PROJECT_PIPELINES);

  const [dmBusyAgentId, setDmBusyAgentId] = useState<string | null>(null);
  const [dmError, setDmError] = useState<string | null>(null);
  const [taskSessionBusyId, setTaskSessionBusyId] = useState<string | null>(null);
  const [taskSessionError, setTaskSessionError] = useState<string | null>(null);
  const [assistantBusy, setAssistantBusy] = useState(false);

  const [isAiBusy, setIsAiBusy] = useState(false);
  const [executingTaskId, setExecutingTaskId] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const [chatDraftSeed, setChatDraftSeed] = useState<string>('');
  const [marketCategorySeed, setMarketCategorySeed] = useState<'all' | AgentCategory>('all');
  const [openMountDrawerSignal, setOpenMountDrawerSignal] = useState(0);
  const [kanbanProjectSeed, setKanbanProjectSeed] = useState<string | null>(null);
  const [kanbanTabSeed, setKanbanTabSeed] = useState<WorkspaceTabId | null>(null);
  const [teamTabSeed, setTeamTabSeed] = useState<TeamSectionTab | null>(null);
  const [discoverZoneSeed, setDiscoverZoneSeed] = useState<string | null>(null);
  const [account, setAccount] = useState<AgentNexusAccount | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const loginAccount = useCallback((email: string, name?: string) => {
    const cleanEmail = email.trim();
    const derivedName =
      name?.trim() ||
      cleanEmail
        .split('@')[0]
        .replace(/[._-]+/g, ' ')
        .trim() ||
      'AgentNexus 用户';
    const initials = derivedName.slice(0, 2).toUpperCase();
    setAccount({
      id: `usr_${Date.now().toString().slice(-5)}`,
      name: derivedName,
      email: cleanEmail,
      planLabel: 'Pro 节点专家',
      workspaceNodeId: 'anx-node-cn-01',
      avatarInitials: initials,
    });
  }, []);

  const logoutAccount = useCallback(() => {
    setAccount(null);
  }, []);

  const joinedZones = useMemo(
    () => zones.filter((z) => z.isPlatformDefault || joinedZoneIds.includes(z.id)),
    [joinedZoneIds, zones],
  );

  const activeZone = useMemo(
    () => joinedZones.find((z) => z.id === activeZoneId) || joinedZones[0] || zones[0],
    [joinedZones, zones, activeZoneId],
  );

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeSessionId) || workspaces[0],
    [workspaces, activeSessionId],
  );

  const hiredIds = activeWorkspace.hiredAgentIds;

  const hiredAgents = useMemo(
    () => agents.filter((a) => hiredIds.includes(a.id)),
    [agents, hiredIds],
  );

  // Zone-scoped Expert Market: controlled inside Expert Market view (excludes space-suspended Agents)
  const marketplaceAgents = useMemo(() => {
    const suspended = new Set(activeZone.suspendedAgentIds || []);
    return agents.filter(
      (a) => a.listedZoneIds.includes(activeZone.id) && !suspended.has(a.id),
    );
  }, [agents, activeZone.id, activeZone.suspendedAgentIds]);

  const totalMarketExpertsCount = useMemo(
    () => agents.filter((a) => a.isListedInMarket).length,
    [agents],
  );

  const privateAgents = useMemo(
    () => agents.filter((a) => a.ownership === 'private'),
    [agents],
  );

  const sessionTasks = useMemo(
    () => allTasks.filter((t) => t.sessionId === activeWorkspace.id),
    [allTasks, activeWorkspace.id],
  );

  const sessionMessages = useMemo(
    () => allMessages.filter((m) => m.sessionId === activeWorkspace.id),
    [allMessages, activeWorkspace.id],
  );

  const dmHistories = useMemo(() => {
    const map: Record<string, DirectMessage[]> = {};
    negotiations.forEach((n) => {
      map[n.agentId] = n.messages;
    });
    return map;
  }, [negotiations]);

  const activeNegotiationCount = useMemo(
    () => negotiations.filter((n) => n.status !== 'hired').length,
    [negotiations],
  );

  const unsettledCount = useMemo(
    () => settlements.filter((s) => s.status === 'unsettled').length,
    [settlements],
  );

  const reviewTaskCount = useMemo(
    () => allTasks.filter((t) => t.status === 'review').length,
    [allTasks],
  );

  const pendingSpaceApplicationCount = useMemo(
    () => spaceApplications.filter((a) => a.status === 'pending').length,
    [spaceApplications],
  );

  const assistantPendingCount =
    unsettledCount + reviewTaskCount + activeNegotiationCount + pendingSpaceApplicationCount;

  const openAssistantChat = useCallback(() => {
    setActiveChatChannel({ type: 'assistant' });
    setActiveView('chat');
  }, []);

  const selectSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    setActiveChatChannel({ type: 'group', projectId: sessionId });
    setActiveView('chat');
  }, []);

  const openKanbanForProject = useCallback((projectId?: string) => {
    setKanbanProjectSeed(projectId || 'all');
    setKanbanTabSeed('kanban');
    setActiveView('kanban');
  }, []);

  const openWorkspaceTab = useCallback((tab: WorkspaceTabId) => {
    setKanbanTabSeed(tab);
    setActiveView('kanban');
  }, []);

  const openTeamTab = useCallback((tab: TeamSectionTab) => {
    setTeamTabSeed(tab);
    setActiveView('team');
  }, []);

  const openCommunityDiscover = useCallback((zoneId?: string) => {
    if (zoneId) {
      setActiveZoneId(zoneId);
      setDiscoverZoneSeed(zoneId);
    }
    setActiveView('discover');
  }, []);

  const openMarketForZone = useCallback((zoneId: string) => {
    setActiveZoneId(zoneId);
    setActiveView('market');
  }, []);

  const toggleJoinZone = useCallback(
    (zoneId: string) => {
      const target = zones.find((z) => z.id === zoneId);
      if (!target) return;
      if (target.isPlatformDefault) return;

      const currentlyJoined = joinedZoneIds.includes(zoneId);
      setJoinedZoneIds((prev) =>
        currentlyJoined ? prev.filter((id) => id !== zoneId) : [...prev, zoneId],
      );
      setZones((prev) =>
        prev.map((z) =>
          z.id === zoneId
            ? { ...z, memberCount: Math.max(1, z.memberCount + (currentlyJoined ? -1 : 1)) }
            : z,
        ),
      );
      if (currentlyJoined && activeZoneId === zoneId) {
        setActiveZoneId('zone_public');
      }
      setAuditLogs((prev) => [
        {
          id: `aud_zone_${Date.now()}`,
          category: 'general',
          title: currentlyJoined ? `已退出协作空间：${target.name}` : `已加入协作空间：${target.name}`,
          detail: currentlyJoined
            ? '已从服务市场与交流社区的可切换空间列表中移除，可随时在「工作台 → 协作空间」重新加入。'
            : `空间类型：${target.typeLabel}；已同步开放至「服务市场」与「交流社区」空间切换器。`,
          severity: currentlyJoined ? 'info' : 'success',
          timestamp: nowTimeStr(),
        },
        ...prev,
      ]);
    },
    [activeZoneId, joinedZoneIds, zones],
  );

  const createCollabZone = useCallback(
    (input: {
      name: string;
      shortCode: string;
      kind: 'community' | 'enterprise';
      regionCulture: string;
      tagline: string;
      focusDomains: string[];
      accentColor: string;
      inviteCode?: string;
    }) => {
      const newId = `zone_custom_${Date.now().toString().slice(-5)}`;
      const isEnterprise = input.kind === 'enterprise';
      const ownerName = account?.name || '林致远（我）';
      const newZone: CommunityZone = {
        id: newId,
        name: input.name.trim(),
        shortCode: input.shortCode.trim().slice(0, 2) || input.name.trim().slice(0, 1),
        kind: input.kind,
        typeLabel: isEnterprise ? '企业封闭空间' : '开放社区',
        regionCulture: input.regionCulture.trim(),
        tagline: input.tagline.trim(),
        focusDomains: input.focusDomains,
        accentColor: input.accentColor,
        memberCount: 1,
        principalName: ownerName,
        isCurrentUserPrincipal: true,
        createdByMe: true,
        inviteCode: isEnterprise ? input.inviteCode?.trim() || 'SPACE-2026' : undefined,
        members: [
          {
            id: `mem_owner_${newId}`,
            humanExpertId: 'human_me',
            name: ownerName,
            title: isEnterprise ? '空间创建者 · 负责人' : '社区发起人 · 主理人',
            role: 'owner',
            avatarInitials: account?.avatarInitials || '致远',
            avatarAccent: input.accentColor,
            joinedAt: nowTimeStr(),
          },
        ],
        suspendedAgentIds: [],
      };
      setZones((prev) => [newZone, ...prev]);
      setJoinedZoneIds((prev) => (prev.includes(newId) ? prev : [...prev, newId]));
      setCommunityPosts((prev) => [
        {
          id: `post_init_${newId}`,
          zoneId: newId,
          type: 'announcement',
          pinned: true,
          pinnedBy: newZone.principalName,
          authorName: newZone.principalName,
          authorHandle: '@zhiyuan_opc',
          authorRole: `${newZone.name} · 空间创建者`,
          authorAccent: newZone.accentColor,
          authorCode: newZone.shortCode,
          title: `【空间公告】欢迎进入「${newZone.name}」${newZone.typeLabel}`,
          content: `${newZone.tagline}${
            newZone.inviteCode ? `（企业空间邀请码：${newZone.inviteCode}）` : ''
          }`,
          tags: newZone.focusDomains.slice(0, 3),
          createdAt: nowTimeStr(),
          likes: 1,
          comments: [],
        },
        ...prev,
      ]);
      setAuditLogs((prev) => [
        {
          id: `aud_zone_new_${Date.now()}`,
          category: 'general',
          title: `已创建协作空间：${newZone.name}`,
          detail: `${newZone.typeLabel} · ${newZone.regionCulture || '自定义空间'}；已自动加入并同步至服务市场与交流社区。`,
          severity: 'success',
          timestamp: nowTimeStr(),
        },
        ...prev,
      ]);
      return newId;
    },
    [account?.name],
  );

  const deleteCollabZone = useCallback(
    (zoneId: string) => {
      const target = zones.find((z) => z.id === zoneId);
      if (!target || target.isPlatformDefault || !target.createdByMe) return;
      setZones((prev) => prev.filter((z) => z.id !== zoneId));
      setJoinedZoneIds((prev) => prev.filter((id) => id !== zoneId));
      setSpaceSharedNodes((prev) => prev.filter((n) => n.zoneId !== zoneId));
      if (activeZoneId === zoneId) {
        setActiveZoneId('zone_public');
      }
      setAuditLogs((prev) => [
        {
          id: `aud_zone_del_${Date.now()}`,
          category: 'general',
          title: `已解散协作空间：${target.name}`,
          detail: '该自建协作空间及其共享节点已从您的空间列表及市场/社区切换器中移除。',
          severity: 'warning',
          timestamp: nowTimeStr(),
        },
        ...prev,
      ]);
    },
    [activeZoneId, zones],
  );

  // ---------------- Self-Created Collaboration Space Governance ----------------

  const inviteSpaceMember = useCallback(
    (
      zoneId: string,
      input: {
        humanExpertId?: string;
        name: string;
        title: string;
        role: SpaceMemberRole;
        avatarInitials?: string;
        avatarAccent?: string;
      },
    ) => {
      const target = zones.find((z) => z.id === zoneId);
      if (!target) return;
      const cleanName = input.name.trim();
      if (!cleanName) return;
      const newMember: SpaceMember = {
        id: `mem_${Date.now().toString().slice(-5)}`,
        humanExpertId: input.humanExpertId,
        name: cleanName,
        title: input.title.trim() || '协作空间成员',
        role: input.role,
        avatarInitials: input.avatarInitials || cleanName.slice(0, 2).toUpperCase(),
        avatarAccent: input.avatarAccent || '#1d4ed8',
        joinedAt: nowTimeStr(),
      };
      setZones((prev) =>
        prev.map((z) => {
          if (z.id !== zoneId) return z;
          const existing = z.members || [];
          if (
            input.humanExpertId &&
            existing.some((m) => m.humanExpertId === input.humanExpertId)
          ) {
            return z;
          }
          return {
            ...z,
            members: [...existing, newMember],
            memberCount: Math.max(existing.length + 1, z.memberCount + 1),
          };
        }),
      );
      setAuditLogs((prev) => [
        {
          id: `aud_mem_add_${Date.now()}`,
          category: 'general',
          title: `空间成员加入：${cleanName} → ${target.name}`,
          detail: `角色：${input.role === 'admin' ? '空间管理员' : '普通成员'} · ${newMember.title}`,
          severity: 'success',
          timestamp: nowTimeStr(),
        },
        ...prev,
      ]);
    },
    [zones],
  );

  const updateSpaceMemberRole = useCallback(
    (zoneId: string, memberId: string, role: SpaceMemberRole) => {
      setZones((prev) =>
        prev.map((z) => {
          if (z.id !== zoneId) return z;
          return {
            ...z,
            members: (z.members || []).map((m) =>
              m.id === memberId && m.role !== 'owner' ? { ...m, role } : m,
            ),
          };
        }),
      );
    },
    [],
  );

  const kickSpaceMember = useCallback(
    (zoneId: string, memberId: string) => {
      const target = zones.find((z) => z.id === zoneId);
      const member = target?.members?.find((m) => m.id === memberId);
      if (!target || !member || member.role === 'owner') return;
      setZones((prev) =>
        prev.map((z) => {
          if (z.id !== zoneId) return z;
          const nextMembers = (z.members || []).filter((m) => m.id !== memberId);
          return {
            ...z,
            members: nextMembers,
            memberCount: Math.max(nextMembers.length, z.memberCount - 1),
          };
        }),
      );
      setAuditLogs((prev) => [
        {
          id: `aud_mem_kick_${Date.now()}`,
          category: 'general',
          title: `已将 ${member.name} 移出「${target.name}」`,
          detail: '该成员已失去该协作空间的共享节点与内部服务市场访问权限。',
          severity: 'warning',
          timestamp: nowTimeStr(),
        },
        ...prev,
      ]);
    },
    [zones],
  );

  const addSpaceSharedNode = useCallback(
    (
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
    ) => {
      const target = zones.find((z) => z.id === zoneId);
      if (!target) return;
      const newNode: SpaceSharedNode = {
        id: `snode_${Date.now().toString().slice(-5)}`,
        zoneId,
        name: input.name.trim() || `${target.shortCode} 共享节点`,
        os: input.os,
        osVersion: input.osVersion,
        origin: input.origin,
        region: input.region,
        cpuCores: Math.max(2, Math.round(input.cpuCores)),
        memoryGb: Math.max(4, Math.round(input.memoryGb)),
        gpuSpec: input.gpuSpec,
        status: 'online',
        supportedClis: input.supportedClis.length > 0 ? input.supportedClis : ['Claude Code'],
        sharedSandboxQuota: Math.max(1, Math.round(input.sharedSandboxQuota)),
        usedSandboxes: 0,
        accessPolicy: input.accessPolicy,
        monthlyCostUsd: Math.max(0, Math.round(input.monthlyCostUsd)),
        addedAt: nowTimeStr(),
      };
      setSpaceSharedNodes((prev) => [newNode, ...prev]);
      setAuditLogs((prev) => [
        {
          id: `aud_snode_add_${Date.now()}`,
          category: 'general',
          title: `已为「${target.name}」接入共享 Agent 节点：${newNode.name}`,
          detail: `${newNode.osVersion} · ${newNode.cpuCores}C/${newNode.memoryGb}G · 共享 ${newNode.sharedSandboxQuota} 并发沙箱。`,
          severity: 'success',
          timestamp: nowTimeStr(),
        },
        ...prev,
      ]);
    },
    [zones],
  );

  const toggleSpaceSharedNodeStatus = useCallback((nodeId: string) => {
    setSpaceSharedNodes((prev) =>
      prev.map((n) =>
        n.id === nodeId
          ? { ...n, status: n.status === 'online' ? 'standby' : 'online' }
          : n,
      ),
    );
  }, []);

  const updateSpaceSharedNode = useCallback(
    (
      nodeId: string,
      patch: Partial<Pick<SpaceSharedNode, 'sharedSandboxQuota' | 'accessPolicy'>>,
    ) => {
      setSpaceSharedNodes((prev) =>
        prev.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)),
      );
    },
    [],
  );

  const removeSpaceSharedNode = useCallback(
    (nodeId: string) => {
      const node = spaceSharedNodes.find((n) => n.id === nodeId);
      setSpaceSharedNodes((prev) => prev.filter((n) => n.id !== nodeId));
      setAgents((prev) =>
        prev.map((a) =>
          a.hostNodeId === nodeId ? { ...a, hostNodeId: undefined, hostCliId: undefined } : a,
        ),
      );
      setWorkspaces((prev) =>
        prev.map((w) => ({
          ...w,
          boundNodeIds: (w.boundNodeIds || []).filter((id) => id !== nodeId),
        })),
      );
      if (node) {
        setAuditLogs((prev) => [
          {
            id: `aud_snode_del_${Date.now()}`,
            category: 'general',
            title: `已移除空间共享节点：${node.name}`,
            detail: node.origin === 'cloud' ? '云端共享节点已退租释放。' : '自有共享节点已解除空间绑定。',
            severity: 'info',
            timestamp: nowTimeStr(),
          },
          ...prev,
        ]);
      }
    },
    [spaceSharedNodes],
  );

  const toggleSpaceAgentOnline = useCallback(
    (zoneId: string, agentId: string) => {
      const targetZone = zones.find((z) => z.id === zoneId);
      const targetAgent = agents.find((a) => a.id === agentId);
      if (!targetZone || !targetAgent) return;
      const currentlySuspended = (targetZone.suspendedAgentIds || []).includes(agentId);
      setZones((prev) =>
        prev.map((z) => {
          if (z.id !== zoneId) return z;
          const cur = z.suspendedAgentIds || [];
          return {
            ...z,
            suspendedAgentIds: currentlySuspended
              ? cur.filter((id) => id !== agentId)
              : [...cur, agentId],
          };
        }),
      );
      setAuditLogs((prev) => [
        {
          id: `aud_zagent_toggle_${Date.now()}`,
          category: 'general',
          title: currentlySuspended
            ? `已恢复上线：${targetAgent.handle}（${targetZone.name}）`
            : `已下线停服：${targetAgent.handle}（${targetZone.name}）`,
          detail: currentlySuspended
            ? '该专业 Agent 已重新展示在该协作空间的服务市场并恢复接单。'
            : '该专业 Agent 已从该协作空间服务市场暂时下线，不影响其他空间或历史项目。',
          severity: currentlySuspended ? 'success' : 'warning',
          timestamp: nowTimeStr(),
        },
        ...prev,
      ]);
    },
    [agents, zones],
  );

  const publishAgentToSpace = useCallback(
    (zoneId: string, agentId: string) => {
      const targetZone = zones.find((z) => z.id === zoneId);
      const targetAgent = agents.find((a) => a.id === agentId);
      if (!targetZone || !targetAgent) return;
      setAgents((prev) =>
        prev.map((a) =>
          a.id === agentId
            ? {
                ...a,
                isListedInMarket: true,
                listedZoneIds: Array.from(new Set([...a.listedZoneIds, zoneId])),
              }
            : a,
        ),
      );
      setZones((prev) =>
        prev.map((z) =>
          z.id === zoneId
            ? {
                ...z,
                suspendedAgentIds: (z.suspendedAgentIds || []).filter((id) => id !== agentId),
              }
            : z,
        ),
      );
      setAuditLogs((prev) => [
        {
          id: `aud_zagent_pub_${Date.now()}`,
          category: 'general',
          title: `已发布专业 Agent 至「${targetZone.name}」：${targetAgent.handle}`,
          detail: '已在空间服务市场上线，空间成员可直接咨询与雇佣。',
          severity: 'success',
          timestamp: nowTimeStr(),
        },
        ...prev,
      ]);
    },
    [agents, zones],
  );

  const removeAgentFromSpace = useCallback(
    (zoneId: string, agentId: string) => {
      const targetZone = zones.find((z) => z.id === zoneId);
      const targetAgent = agents.find((a) => a.id === agentId);
      if (!targetZone || !targetAgent) return;
      setAgents((prev) =>
        prev.map((a) =>
          a.id === agentId
            ? { ...a, listedZoneIds: a.listedZoneIds.filter((id) => id !== zoneId) }
            : a,
        ),
      );
      setZones((prev) =>
        prev.map((z) =>
          z.id === zoneId
            ? {
                ...z,
                suspendedAgentIds: (z.suspendedAgentIds || []).filter((id) => id !== agentId),
              }
            : z,
        ),
      );
      setAuditLogs((prev) => [
        {
          id: `aud_zagent_rm_${Date.now()}`,
          category: 'general',
          title: `已从「${targetZone.name}」移除专业 Agent：${targetAgent.handle}`,
          detail: '该 Agent 已取消在该协作空间的服务市场发布。',
          severity: 'info',
          timestamp: nowTimeStr(),
        },
        ...prev,
      ]);
    },
    [agents, zones],
  );

  const createSession = useCallback(
    (
      name: string,
      goal: string,
      sourceZoneId?: string,
      boundNodeIds?: string[],
      storageVolumeId?: string,
    ) => {
      const cleanedName = name.trim();
      if (!cleanedName) return '';
      const newId = `ses_${Date.now().toString().slice(-5)}`;
      const resolvedNodes =
        boundNodeIds && boundNodeIds.length > 0
          ? boundNodeIds
          : computeNodes.filter((n) => n.status === 'online').slice(0, 1).map((n) => n.id);
      const resolvedVolumeId = storageVolumeId || storageVolumes[0]?.id;
      const newWorkspace: ProjectWorkspace = {
        id: newId,
        name: cleanedName,
        goal: goal.trim() || '协同产品与研发专家 Agent 按工作卡片推进项目交付',
        role: 'leading',
        lifecycleStatus: 'active',
        boundNodeIds: resolvedNodes,
        storageVolumeId: resolvedVolumeId,
        sourceZoneId,
        workspaceTier: '加密持久化工作区 (50GB)',
        budgetCapUsd: 8000,
        spentUsd: 1200,
        hiredAgentIds: ['agent_pm_lin'],
      };
      const ts = nowTimeStr();
      setWorkspaces((prev) => [newWorkspace, ...prev]);
      setProjectPipelines((prev) => ({
        ...prev,
        [newId]: [
          {
            stage: 'planning',
            roleTitle: '主产品架构师',
            agentId: 'agent_pm_lin',
            handoffMode: 'manual',
            deliverableContract: 'PRD 规格书、功能范围与验收清单',
          },
          {
            stage: 'development',
            roleTitle: '核心研发工程师',
            agentId: 'agent_dev_us',
            handoffMode: 'auto',
            deliverableContract: '核心功能代码、API 实现与构建产物',
          },
          {
            stage: 'testing',
            roleTitle: '质量验收工程师',
            agentId: 'agent_qa_eu',
            handoffMode: 'auto',
            deliverableContract: '端到端自动化用例与回归验证报告',
          },
          {
            stage: 'review',
            roleTitle: '安全与架构审查官',
            agentId: 'agent_review_my',
            handoffMode: 'manual',
            deliverableContract: '性能审计、安全复核与上线签字',
          },
        ],
      }));
      if (resolvedVolumeId) {
        setStorageVolumes((prev) =>
          prev.map((v) =>
            v.id === resolvedVolumeId
              ? { ...v, boundProjectIds: Array.from(new Set([...v.boundProjectIds, newId])) }
              : v,
          ),
        );
      }
      setActiveSessionId(newId);
      setActiveChatChannel({ type: 'group', projectId: newId });
      setAllMessages((prev) => [
        ...prev,
        {
          id: `msg_init_${Date.now()}`,
          sessionId: newId,
          senderType: 'butler',
          senderId: 'butler',
          senderName: 'Nexa 助理',
          senderHandle: '@Nexa',
          content: `已创建项目群「${newWorkspace.name}」，已关联 Agent 节点与持久化存储，默认接入 @产品策划师。你可以在工作编排中指定各阶段专业 Agent 身份。`,
          timestamp: ts,
        },
      ]);
      setAuditLogs((prev) => [
        {
          id: `aud_${Date.now()}`,
          category: 'audit',
          title: `新建主管项目「${newWorkspace.name}」`,
          detail: `已挂载 Agent 算力节点与共享存储卷，项目总预算设定为 ${formatUsd(newWorkspace.budgetCapUsd)}。`,
          severity: 'success',
          timestamp: ts,
        },
        ...prev,
      ]);
      return newId;
    },
    [computeNodes, storageVolumes],
  );

  const publishZoneProject = useCallback(
    (input: {
      zoneId: string;
      title: string;
      summary: string;
      budgetUsd: number;
      durationDays: number;
      requiredRoles: string[];
    }) => {
      const cleanedTitle = input.title.trim();
      if (!cleanedTitle) return '';
      const zoneName = zones.find((z) => z.id === input.zoneId)?.name || '协作空间';
      const ts = nowTimeStr();
      const newWorkspaceId = `ses_${Date.now().toString().slice(-5)}`;
      const newOppId = `zproj_${Date.now().toString().slice(-5)}`;

      const newWorkspace: ProjectWorkspace = {
        id: newWorkspaceId,
        name: cleanedTitle,
        goal: input.summary.trim() || `已发布至「${zoneName}」招募社区专家团队协同交付`,
        role: 'leading',
        sourceZoneId: input.zoneId,
        workspaceTier: '加密持久化工作区 (50GB)',
        budgetCapUsd: Math.max(1000, Math.round(input.budgetUsd)),
        spentUsd: 0,
        hiredAgentIds: ['agent_pm_lin'],
      };

      const newOpp: ZoneProjectOpportunity = {
        id: newOppId,
        zoneId: input.zoneId,
        title: cleanedTitle,
        publisher: account ? `${account.name}（我方发布）` : '我方项目团队',
        summary: input.summary.trim() || '面向该协作空间专家团队开放项目发包，欢迎直接私聊报价签约。',
        budgetUsd: Math.max(1000, Math.round(input.budgetUsd)),
        durationDays: Math.max(1, Math.round(input.durationDays || 7)),
        requiredRoles:
          input.requiredRoles.length > 0 ? input.requiredRoles : ['核心架构', '研发交付'],
        serviceModePref: 'any',
        direction: 'published_by_me',
        status: 'open',
        linkedWorkspaceId: newWorkspaceId,
        postedAt: '刚刚',
      };

      setWorkspaces((prev) => [newWorkspace, ...prev]);
      setZoneProjects((prev) => [newOpp, ...prev]);
      setCommunityPosts((prev) => [
        {
          id: `post_proj_${Date.now().toString().slice(-5)}`,
          zoneId: input.zoneId,
          type: 'project',
          authorName: account ? account.name : '我（项目负责人）',
          authorHandle: account ? `@${account.name}` : '@指挥官',
          authorRole: '项目发起人',
          authorAccent: '#1d4ed8',
          authorCode: account ? account.avatarInitials : '我',
          title: `【项目撮合】${cleanedTitle}`,
          content:
            input.summary.trim() ||
            `已在「${zoneName}」发起项目需求，预算 ${formatUsd(newOpp.budgetUsd)} / 项目，期望 ${newOpp.durationDays} 天交付，欢迎社区专家或团队在评论区交流或直接承接！`,
          tags: ['项目撮合', ...newOpp.requiredRoles.slice(0, 2)],
          createdAt: '刚刚',
          likes: 1,
          likedByMe: true,
          comments: [],
          linkedProjectId: newOppId,
        },
        ...prev,
      ]);
      setAllMessages((prev) => [
        ...prev,
        {
          id: `msg_pub_${Date.now()}`,
          sessionId: newWorkspaceId,
          senderType: 'butler',
          senderId: 'butler',
          senderName: 'Nexa 助理',
          senderHandle: '@Nexa',
          content: `已将项目「${cleanedTitle}」发布至「${zoneName}」项目大厅（预算 ${formatUsd(newOpp.budgetUsd)} · 周期 ${newOpp.durationDays} 天）。你可以前往「服务市场 → ${zoneName}」主动咨询专家与 Agent 报价。`,
          timestamp: ts,
        },
      ]);
      setAuditLogs((prev) => [
        {
          id: `aud_pub_${Date.now()}`,
          category: 'order',
          title: `已向「${zoneName}」发布项目：${cleanedTitle}`,
          detail: `项目预算 ${formatUsd(newOpp.budgetUsd)}，并已同步建立加密项目群聊。`,
          severity: 'success',
          timestamp: ts,
        },
        ...prev,
      ]);

      return newWorkspaceId;
    },
    [account, zones],
  );

  const claimZoneProject = useCallback(
    (oppId: string) => {
      const opp = zoneProjects.find((p) => p.id === oppId);
      if (!opp || opp.status === 'claimed') return '';
      const zoneName = zones.find((z) => z.id === opp.zoneId)?.name || '协作空间';
      const ts = nowTimeStr();
      const newWorkspaceId = `ses_part_${Date.now().toString().slice(-5)}`;
      const myPrivateIds = agents
        .filter((a) => a.ownership === 'private')
        .slice(0, 2)
        .map((a) => a.id);
      const assignedAgent =
        agents.find((a) => a.id === myPrivateIds[0]) || agents[0];

      const newWorkspace: ProjectWorkspace = {
        id: newWorkspaceId,
        name: opp.title,
        goal: `承接「${zoneName}」协作空间项目：${opp.summary}`,
        role: 'participating',
        sourceZoneId: opp.zoneId,
        workspaceTier: '加密持久化工作区 (50GB)',
        budgetCapUsd: opp.budgetUsd,
        spentUsd: 0,
        hiredAgentIds: myPrivateIds.length > 0 ? myPrivateIds : ['agent_pm_lin'],
      };

      const kickoffTask: WorkflowTask = {
        id: `tsk_${Date.now().toString().slice(-4)}`,
        sessionId: newWorkspaceId,
        featureModule: `${zoneName} · 承接交付模块`,
        workType: 'development',
        title: `承接交付：${opp.title}`,
        description: opp.summary,
        assigneeId: assignedAgent?.id || 'butler',
        assigneeHandle: assignedAgent?.handle || '@Nexa',
        status: 'pending',
        priority: '高',
        createdAt: ts,
        updatedAt: ts,
      };

      setWorkspaces((prev) => [newWorkspace, ...prev]);
      setZoneProjects((prev) =>
        prev.map((p) =>
          p.id === oppId ? { ...p, status: 'claimed', linkedWorkspaceId: newWorkspaceId } : p,
        ),
      );
      setAllTasks((prev) => [kickoffTask, ...prev]);
      setAllMessages((prev) => [
        ...prev,
        {
          id: `msg_claim_${Date.now()}`,
          sessionId: newWorkspaceId,
          senderType: 'system',
          senderId: 'system',
          senderName: '系统协同同步',
          senderHandle: '系统通知',
          content: `已承接「${zoneName}」协作空间项目「${opp.title}」（合同预算 ${formatUsd(opp.budgetUsd)}），我方 Agent 团队已进驻项目群并立项首张工作卡片。`,
          timestamp: ts,
          linkedTaskIds: [kickoffTask.id],
        },
      ]);
      setAuditLogs((prev) => [
        {
          id: `aud_claim_${Date.now()}`,
          category: 'order',
          title: `已承接「${zoneName}」项目：${opp.title}`,
          detail: `已归入「工作台 → 我的项目（我参与）」，首张交付卡片已同步项目看板。`,
          severity: 'success',
          timestamp: ts,
        },
        ...prev,
      ]);

      return newWorkspaceId;
    },
    [agents, zoneProjects, zones],
  );

  const createCommunityPost = useCallback(
    (input: {
      zoneId: string;
      type: Exclude<CommunityPostType, 'project'>;
      title: string;
      content: string;
      tags?: string[];
      pinned?: boolean;
      pinnedBy?: string;
    }) => {
      const cleanedContent = input.content.trim();
      const cleanedTitle = input.title.trim() || cleanedContent.slice(0, 32);
      if (!cleanedContent) return;
      const defaultTagMap: Record<Exclude<CommunityPostType, 'project'>, string> = {
        discussion: '分享讨论',
        agn_recommend: 'AGN 推荐',
        announcement: '社区公告',
      };
      const newPost: CommunityPost = {
        id: `post_${Date.now().toString().slice(-6)}`,
        zoneId: input.zoneId,
        type: input.type,
        authorName: account ? account.name : '林致远（我）',
        authorHandle: account ? `@${account.name}` : '@zhiyuan_opc',
        authorRole: input.type === 'announcement' ? '社区主理' : 'OPC 成员',
        authorAccent: '#0f172a',
        authorCode: account ? account.avatarInitials : '致远',
        title: cleanedTitle,
        content: cleanedContent,
        tags:
          input.tags && input.tags.length > 0
            ? input.tags
            : [defaultTagMap[input.type]],
        createdAt: '刚刚',
        likes: 0,
        likedByMe: false,
        pinned: Boolean(input.pinned),
        pinnedBy: input.pinned ? input.pinnedBy || (account ? account.name : '林致远（我）') : undefined,
        comments: [],
      };
      setCommunityPosts((prev) => [newPost, ...prev]);
    },
    [account],
  );

  const togglePinPost = useCallback(
    (postId: string, principalName?: string) => {
      setCommunityPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          const nextPinned = !p.pinned;
          return {
            ...p,
            pinned: nextPinned,
            pinnedBy: nextPinned
              ? principalName || (account ? account.name : '林致远（我）')
              : undefined,
          };
        }),
      );
    },
    [account],
  );

  const toggleLikePost = useCallback((postId: string) => {
    setCommunityPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const nextLiked = !p.likedByMe;
        return {
          ...p,
          likedByMe: nextLiked,
          likes: Math.max(0, p.likes + (nextLiked ? 1 : -1)),
        };
      }),
    );
  }, []);

  const addPostComment = useCallback(
    (postId: string, content: string) => {
      const cleaned = content.trim();
      if (!cleaned) return;
      const newComment = {
        id: `cmt_${Date.now().toString().slice(-6)}`,
        authorName: account ? account.name : '我',
        authorHandle: account ? `@${account.name}` : '@指挥官',
        authorRole: '社区成员',
        content: cleaned,
        timestamp: '刚刚',
      };
      setCommunityPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, comments: [...p.comments, newComment] } : p,
        ),
      );
    },
    [account],
  );

  const createWorkCard = useCallback(
    (input: CreateWorkCardInput) => {
      const targetSessionId = input.sessionId || activeWorkspace.id;
      const assignee = agents.find((a) => a.id === input.assigneeId);
      const ts = nowTimeStr();
      const newTask: WorkflowTask = {
        id: `tsk_${Date.now().toString().slice(-4)}`,
        sessionId: targetSessionId,
        featureModule: input.featureModule.trim() || '核心功能模块',
        workType: input.workType,
        title: input.title.trim(),
        description: input.description.trim() || '按项目目标执行并输出可验收产物。',
        assigneeId: assignee?.id || 'butler',
        assigneeHandle: assignee?.handle || '@Nexa',
        status: 'pending',
        priority: input.priority,
        createdAt: ts,
        updatedAt: ts,
      };

      setAllTasks((prev) => [newTask, ...prev]);
      setAllMessages((prev) => [
        ...prev,
        {
          id: `msg_card_${Date.now()}`,
          sessionId: targetSessionId,
          senderType: 'butler',
          senderId: 'butler',
          senderName: 'Nexa 助理',
          senderHandle: '@Nexa',
          content: `已在项目群创建工作卡片「${newTask.title}」（所属模块：${newTask.featureModule}），指派给 ${newTask.assigneeHandle}，已自动同步至「项目看板」与左侧「Agent 任务」。`,
          timestamp: ts,
          linkedTaskIds: [newTask.id],
        },
      ]);
      return newTask;
    },
    [activeWorkspace.id, agents],
  );

  const hireAgentIntoProject = useCallback(
    (
      agentId: string,
      projectId?: string,
      initialCard?: { title: string; scope: string; contractedPriceUsd?: number },
    ) => {
      const targetProjectId = projectId || activeWorkspace.id;
      const targetProject = workspaces.find((w) => w.id === targetProjectId) || activeWorkspace;
      const target = agents.find((a) => a.id === agentId);
      if (!target) return;

      const contractedFee =
        target.ownership === 'private'
          ? 0
          : Math.round(initialCard?.contractedPriceUsd || target.projectPriceUsd);
      const alreadyInProject = targetProject.hiredAgentIds.includes(agentId);
      const ts = nowTimeStr();

      if (!alreadyInProject) {
        setWorkspaces((prev) =>
          prev.map((w) =>
            w.id === targetProject.id
              ? {
                  ...w,
                  hiredAgentIds: [...w.hiredAgentIds, agentId],
                  spentUsd: w.spentUsd + contractedFee,
                }
              : w,
          ),
        );

        if (contractedFee > 0) {
          const newSettlementId = `stl_${Date.now().toString().slice(-4)}`;
          setSettlements((prev) => [
            {
              id: newSettlementId,
              projectId: targetProject.id,
              projectName: targetProject.name,
              agentHandle: target.handle,
              milestoneLabel: `项目签约托管（${target.performance.capabilityTier} · ${target.serviceMode === 'human-agent' ? '人+Agent 协同' : '纯 Agent 租用'}）`,
              amountUsd: contractedFee,
              status: 'unsettled',
              createdAt: ts,
            },
            ...prev,
          ]);
        }
      }

      let createdTaskId: string | undefined;

      if (initialCard && initialCard.title.trim()) {
        const workType: WorkCardType =
          target.category === 'product'
            ? 'planning'
            : target.category === 'qa'
              ? 'testing'
              : target.category === 'architecture'
                ? 'review'
                : 'development';
        const newTask: WorkflowTask = {
          id: `tsk_${Date.now().toString().slice(-4)}`,
          sessionId: targetProject.id,
          featureModule: '协商立项工作卡',
          workType,
          title: initialCard.title.trim(),
          description: initialCard.scope.trim() || '按项目签约确认的交付范围执行并提交验收。',
          assigneeId: target.id,
          assigneeHandle: target.handle,
          status: 'pending',
          priority: '高',
          createdAt: ts,
          updatedAt: ts,
        };
        createdTaskId = newTask.id;
        setAllTasks((prev) => [newTask, ...prev]);
      }

      setNegotiations((prev) =>
        prev.map((n) =>
          n.agentId === agentId
            ? { ...n, targetProjectId: targetProject.id, status: 'hired', updatedAt: ts }
            : n,
        ),
      );

      const sourceText = target.ownership === 'private' ? '私有节点' : '外部专家';
      const modeText = target.serviceMode === 'human-agent' ? '人+Agent 协同' : '纯 Agent 租用';
      const feeText = contractedFee > 0 ? `，项目签约价 ${formatUsd(contractedFee)}` : '（私有自用）';

      setAllMessages((prev) => [
        ...prev,
        {
          id: `msg_hire_${Date.now()}`,
          sessionId: targetProject.id,
          senderType: 'system',
          senderId: 'system',
          senderName: '系统协同同步',
          senderHandle: '系统通知',
          content: `已签约${sourceText} ${target.handle}（${modeText}${feeText}）加入项目群「${targetProject.name}」。`,
          timestamp: ts,
        },
        {
          id: `msg_greet_${Date.now() + 1}`,
          sessionId: targetProject.id,
          senderType: 'agent',
          senderId: target.id,
          senderName: target.name,
          senderHandle: target.handle,
          content: `已正式入群就位！我是 ${target.name}（${modeText}），加密工作区已同步挂载。${
            createdTaskId
              ? '咱们刚才确认的首项工作已经挂上去了，批准后我立即推进。'
              : `随时可以直接 ${target.handle} 沟通需求。`
          }`,
          timestamp: ts,
          linkedTaskIds: createdTaskId ? [createdTaskId] : undefined,
        },
      ]);

      setAuditLogs((prev) => [
        {
          id: `aud_hire_${Date.now()}`,
          category: 'order',
          title: `已签约 ${target.handle} 加入「${targetProject.name}」`,
          detail: `${modeText}${feeText}；已按最小权限授予加密工作区挂载凭证。`,
          severity: 'success',
          timestamp: ts,
        },
        ...prev,
      ]);

      setActiveSessionId(targetProject.id);
      setActiveChatChannel({ type: 'group', projectId: targetProject.id });
    },
    [activeWorkspace, agents, workspaces],
  );

  const hireAgent = useCallback(
    (agentId: string) => {
      hireAgentIntoProject(agentId, activeWorkspace.id);
    },
    [activeWorkspace.id, hireAgentIntoProject],
  );

  const releaseAgent = useCallback(
    (agentId: string, projectId?: string) => {
      const targetProjectId = projectId || activeWorkspace.id;
      const target = agents.find((a) => a.id === agentId);
      const proj = workspaces.find((w) => w.id === targetProjectId);
      if (!target) return;
      const ts = nowTimeStr();

      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === targetProjectId
            ? { ...w, hiredAgentIds: w.hiredAgentIds.filter((id) => id !== agentId) }
            : w,
        ),
      );

      setAllMessages((prev) => [
        ...prev,
        {
          id: `msg_rel_${Date.now()}`,
          sessionId: targetProjectId,
          senderType: 'system',
          senderId: 'system',
          senderName: '系统协同同步',
          senderHandle: '系统通知',
          content: `已将 ${target.handle} 移出该项目群，技能包与工作区访问权限已自动回收卸载。`,
          timestamp: ts,
        },
      ]);

      setAuditLogs((prev) => [
        {
          id: `aud_rel_${Date.now()}`,
          category: 'audit',
          title: `权限自动回收：${target.handle}`,
          detail: `已从「${proj?.name || '项目'}」卸载技能包并吊销工作区临时访问凭证。`,
          severity: 'info',
          timestamp: ts,
        },
        ...prev,
      ]);
    },
    [activeWorkspace.id, agents, workspaces],
  );

  const startOrOpenNegotiation = useCallback(
    (agentId: string, jumpToChat = true) => {
      const target = agents.find((a) => a.id === agentId);
      if (!target) return;

      setNegotiations((prev) => {
        if (prev.some((n) => n.agentId === agentId)) return prev;
        const ts = nowTimeStr();
        const isAlreadyHired = workspaces.some((w) => w.hiredAgentIds.includes(agentId));
        const newThread: NegotiationThread = {
          agentId,
          targetProjectId: activeWorkspace.id,
          status: isAlreadyHired ? 'hired' : 'negotiating',
          negotiatedPriceUsd: target.projectPriceUsd,
          scopeNote: `负责「${activeWorkspace.name}」项目的 ${target.title}`,
          firstWorkCardTitle: `${
            target.category === 'qa'
              ? '测试'
              : target.category === 'architecture'
                ? '审查'
                : target.category === 'product'
                  ? '规划'
                  : '开发'
          }：${target.skills[0] || '核心专项任务'}`,
          updatedAt: ts,
          messages: [],
        };
        return [newThread, ...prev];
      });

      setDmError(null);
      setActiveChatChannel({ type: 'dm', agentId });
      if (jumpToChat) {
        setActiveView('chat');
      }
    },
    [activeWorkspace.id, activeWorkspace.name, agents, workspaces],
  );

  const updateNegotiationTerms = useCallback(
    (
      agentId: string,
      patch: Partial<
        Pick<
          NegotiationThread,
          'targetProjectId' | 'negotiatedPriceUsd' | 'scopeNote' | 'firstWorkCardTitle'
        >
      >,
    ) => {
      setNegotiations((prev) =>
        prev.map((n) => (n.agentId === agentId ? { ...n, ...patch } : n)),
      );
    },
    [],
  );

  const sendDirectMessage = useCallback(
    async (agentId: string, text: string) => {
      const target = agents.find((a) => a.id === agentId);
      const cleaned = text.trim();
      if (!target || !cleaned) return;

      setDmError(null);
      const ts = nowTimeStr();
      const existingThread = negotiations.find((n) => n.agentId === agentId);
      const targetProjId = existingThread?.targetProjectId || activeWorkspace.id;
      const targetProject = workspaces.find((w) => w.id === targetProjId) || activeWorkspace;

      const userMsg: DirectMessage = {
        id: `dm_u_${Date.now()}`,
        sender: 'employer',
        content: cleaned,
        timestamp: ts,
      };

      const baseThread: NegotiationThread = existingThread || {
        agentId,
        targetProjectId: targetProject.id,
        status: 'negotiating',
        negotiatedPriceUsd: target.projectPriceUsd,
        scopeNote: `负责「${targetProject.name}」项目的 ${target.title}`,
        firstWorkCardTitle: `项目启动：${target.skills[0] || target.title}`,
        updatedAt: ts,
        messages: [],
      };

      const nextMessages = [...baseThread.messages, userMsg];

      setNegotiations((prev) => {
        const exists = prev.some((n) => n.agentId === agentId);
        if (exists) {
          return prev.map((n) =>
            n.agentId === agentId ? { ...n, messages: nextMessages, updatedAt: ts } : n,
          );
        }
        return [{ ...baseThread, messages: nextMessages }, ...prev];
      });

      setDmBusyAgentId(agentId);

      try {
        const res = await sendExpertDirectMessage({
          agent: target,
          workspace: targetProject,
          history: nextMessages,
          message: cleaned,
          currentTerms: {
            negotiatedPriceUsd: baseThread.negotiatedPriceUsd,
            scopeNote: baseThread.scopeNote,
          },
        });

        const replyTs = nowTimeStr();
        const quotedPrice =
          typeof res.quotedPriceUsd === 'number' && res.quotedPriceUsd >= 100
            ? Math.round(res.quotedPriceUsd)
            : baseThread.negotiatedPriceUsd;

        const replyMsg: DirectMessage = {
          id: `dm_a_${Date.now()}`,
          sender: 'agent',
          content: res.reply,
          timestamp: replyTs,
          quotedPriceUsd: quotedPrice,
        };

        setNegotiations((prev) =>
          prev.map((n) =>
            n.agentId === agentId
              ? {
                  ...n,
                  status: n.status === 'hired' ? 'hired' : 'quoted',
                  negotiatedPriceUsd: quotedPrice,
                  scopeNote: res.proposedScope || n.scopeNote,
                  firstWorkCardTitle: res.proposedWorkCardTitle || n.firstWorkCardTitle,
                  updatedAt: replyTs,
                  messages: [...n.messages, replyMsg],
                }
              : n,
          ),
        );
      } catch (err) {
        setDmError(err instanceof Error ? err.message : '外部专家私聊回复失败');
      } finally {
        setDmBusyAgentId(null);
      }
    },
    [activeWorkspace, agents, negotiations, workspaces],
  );

  const confirmHireFromNegotiation = useCallback(
    (agentId: string, createFirstCard = true) => {
      const thread = negotiations.find((n) => n.agentId === agentId);
      if (!thread) {
        hireAgentIntoProject(agentId, activeWorkspace.id);
        setActiveView('chat');
        return;
      }
      hireAgentIntoProject(
        agentId,
        thread.targetProjectId,
        createFirstCard
          ? {
              title: thread.firstWorkCardTitle,
              scope: thread.scopeNote,
              contractedPriceUsd: thread.negotiatedPriceUsd,
            }
          : { title: '', scope: '', contractedPriceUsd: thread.negotiatedPriceUsd },
      );
      setActiveView('chat');
    },
    [activeWorkspace.id, hireAgentIntoProject, negotiations],
  );

  const settleRecord = useCallback(
    (settlementId: string) => {
      const record = settlements.find((s) => s.id === settlementId);
      if (!record || record.status === 'settled') return;
      const ts = nowTimeStr();

      setSettlements((prev) =>
        prev.map((s) => (s.id === settlementId ? { ...s, status: 'settled' } : s)),
      );

      setAssistantMessages((prev) => [
        ...prev.map((m) =>
          m.cards
            ? {
                ...m,
                cards: m.cards.map((c) =>
                  c.actionTarget?.type === 'settle' &&
                  c.actionTarget.settlementId === settlementId
                    ? { ...c, resolved: true }
                    : c,
                ),
              }
            : m,
        ),
        {
          id: `asst_stl_${Date.now()}`,
          sender: 'assistant',
          category: 'settlement',
          content: `已完成项目结算核销：账单 ${record.id}（${record.projectName} · ${record.agentHandle}）项目签约款 ${formatUsd(record.amountUsd)} 已划转归档。`,
          timestamp: ts,
        },
      ]);

      setAuditLogs((prev) => [
        {
          id: `aud_stl_${Date.now()}`,
          category: 'settlement',
          title: `项目签约款已结算：${formatUsd(record.amountUsd)}`,
          detail: `${record.projectName} · ${record.agentHandle}（${record.milestoneLabel}）已完成放款。`,
          severity: 'success',
          timestamp: ts,
        },
        ...prev,
      ]);
    },
    [settlements],
  );

  const settleAllUnsettled = useCallback(() => {
    const pending = settlements.filter((s) => s.status === 'unsettled');
    if (pending.length === 0) return;
    const total = pending.reduce((sum, s) => sum + s.amountUsd, 0);
    const ts = nowTimeStr();

    setSettlements((prev) => prev.map((s) => ({ ...s, status: 'settled' })));
    setAssistantMessages((prev) => [
      ...prev.map((m) =>
        m.cards
          ? {
              ...m,
              cards: m.cards.map((c) =>
                c.actionTarget?.type === 'settle' ? { ...c, resolved: true } : c,
              ),
            }
          : m,
      ),
      {
        id: `asst_stl_all_${Date.now()}`,
        sender: 'assistant',
        category: 'settlement',
        content: `已批量完成 ${pending.length} 笔项目签约结算核销，合计金额 ${formatUsd(total)}，各项目托管账本已全部对齐结清。`,
        timestamp: ts,
      },
    ]);
    setAuditLogs((prev) => [
      {
        id: `aud_stl_all_${Date.now()}`,
        category: 'settlement',
        title: `批量项目结算完成（${pending.length} 笔 · ${formatUsd(total)}）`,
        detail: '所有到期项目里程碑签约费用已核销归档。',
        severity: 'success',
        timestamp: ts,
      },
      ...prev,
    ]);
  }, [settlements]);

  const resolveSpaceApplication = useCallback(
    (applicationId: string, decision: 'approved' | 'rejected') => {
      const app = spaceApplications.find((a) => a.id === applicationId);
      if (!app || app.status !== 'pending') return;
      const ts = nowTimeStr();

      setSpaceApplications((prev) =>
        prev.map((a) => (a.id === applicationId ? { ...a, status: decision } : a)),
      );

      if (decision === 'approved') {
        const newMember: SpaceMember = {
          id: `mem_app_${Date.now().toString().slice(-5)}`,
          humanExpertId: app.humanExpertId,
          name: app.applicantName,
          title: app.applicantTitle,
          role: app.requestedRole,
          avatarInitials: app.avatarInitials,
          avatarAccent: app.avatarAccent,
          joinedAt: ts,
        };
        setZones((prev) =>
          prev.map((z) => {
            if (z.id !== app.zoneId) return z;
            const existing = z.members || [];
            if (
              app.humanExpertId &&
              existing.some((m) => m.humanExpertId === app.humanExpertId)
            ) {
              return z;
            }
            return {
              ...z,
              members: [...existing, newMember],
              memberCount: Math.max(existing.length + 1, z.memberCount + 1),
            };
          }),
        );
      }

      const resolvedLabel = decision === 'approved' ? '已同意入驻' : '已拒绝';
      setAssistantMessages((prev) => [
        ...prev.map((m) =>
          m.cards
            ? {
                ...m,
                cards: m.cards.map((c) =>
                  c.actionTarget?.type === 'space_application' &&
                  c.actionTarget.applicationId === applicationId
                    ? { ...c, resolved: true, resolvedLabel }
                    : c,
                ),
              }
            : m,
        ),
        {
          id: `asst_app_${Date.now()}`,
          sender: 'assistant',
          category: 'approval',
          content:
            decision === 'approved'
              ? `已通过入驻申请：${app.applicantName}（${app.applicantTitle}）已正式加入「${app.zoneName}」成员列表，并同步获得该空间的协作访问权限。`
              : `已拒绝入驻申请：已向 ${app.applicantName} 通知未通过「${app.zoneName}」的成员加入申请。`,
          timestamp: ts,
        },
      ]);

      setAuditLogs((prev) => [
        {
          id: `aud_app_${Date.now()}`,
          category: 'approval',
          title:
            decision === 'approved'
              ? `成员入驻审批通过：${app.applicantName}`
              : `成员入驻审批拒绝：${app.applicantName}`,
          detail: `${app.zoneName} · ${app.applicantTitle}`,
          severity: decision === 'approved' ? 'success' : 'info',
          timestamp: ts,
        },
        ...prev,
      ]);
    },
    [spaceApplications],
  );

  const sendAssistantMessage = useCallback(
    async (text: string) => {
      const cleaned = text.trim();
      if (!cleaned) return;
      setAiError(null);

      const ts = nowTimeStr();
      const userMsg: AssistantMessage = {
        id: `asst_u_${Date.now()}`,
        sender: 'user',
        content: cleaned,
        timestamp: ts,
      };

      const nextHistory = [...assistantMessages, userMsg];
      setAssistantMessages(nextHistory);
      setAssistantBusy(true);

      try {
        const res = await sendPlatformAssistantMessage({
          message: cleaned,
          history: nextHistory,
          workspaces,
          tasks: allTasks,
          negotiations,
          settlements,
          privateAgents,
        });

        const validCat = new Set<PlatformServiceCategory>([
          'approval',
          'settlement',
          'order',
          'audit',
          'general',
        ]);
        const isApprovalIntent = /审批|申请|入驻|加入空间|成员/.test(cleaned);
        const category: PlatformServiceCategory = validCat.has(res.category)
          ? res.category
          : isApprovalIntent
            ? 'approval'
            : 'general';

        const firstPendingApp = spaceApplications.find((a) => a.status === 'pending');
        const firstUnsettled = settlements.find((s) => s.status === 'unsettled');
        const firstActiveNeg = negotiations.find((n) => n.status !== 'hired');

        let actionLabel: string | undefined;
        let actionTarget:
          | { type: 'settle'; settlementId: string }
          | { type: 'open_dm'; agentId: string }
          | { type: 'open_kanban'; projectId?: string }
          | { type: 'open_team' }
          | { type: 'space_application'; applicationId: string }
          | undefined;

        if ((category === 'approval' || isApprovalIntent) && firstPendingApp) {
          actionLabel = '同意加入';
          actionTarget = { type: 'space_application', applicationId: firstPendingApp.id };
        } else if (category === 'settlement' && firstUnsettled) {
          actionLabel = `确认结算 ${formatUsd(firstUnsettled.amountUsd)}`;
          actionTarget = { type: 'settle', settlementId: firstUnsettled.id };
        } else if (category === 'order' && firstActiveNeg) {
          actionLabel = '打开私聊协商';
          actionTarget = { type: 'open_dm', agentId: firstActiveNeg.agentId };
        } else if (category === 'audit') {
          actionLabel = '去项目看板复核';
          actionTarget = { type: 'open_kanban' };
        }

        const replyMsg: AssistantMessage = {
          id: `asst_a_${Date.now()}`,
          sender: 'assistant',
          category,
          content: res.reply,
          timestamp: nowTimeStr(),
          cards: res.cardTitle
            ? [
                {
                  id: `acard_${Date.now()}`,
                  category,
                  title: res.cardTitle,
                  detail: res.cardDetail,
                  metricLabel: res.metricLabel,
                  actionLabel,
                  actionTarget,
                },
              ]
            : undefined,
        };

        setAssistantMessages((prev) => [...prev, replyMsg]);
      } catch (err) {
        setAiError(err instanceof Error ? err.message : 'Nexa 平台助理响应失败');
      } finally {
        setAssistantBusy(false);
      }
    },
    [
      allTasks,
      assistantMessages,
      negotiations,
      privateAgents,
      settlements,
      spaceApplications,
      workspaces,
    ],
  );

  const savePrivateAgent = useCallback(
    (expert: ExpertAgent, isNew: boolean) => {
      const normalizedZones = Array.from(new Set(expert.listedZoneIds || []));
      const normalizedExpert: ExpertAgent = {
        ...expert,
        listedZoneIds: normalizedZones,
        isListedInMarket: normalizedZones.length > 0,
      };
      if (isNew) {
        setAgents((prev) => [normalizedExpert, ...prev]);
      } else {
        setAgents((prev) => prev.map((a) => (a.id === normalizedExpert.id ? normalizedExpert : a)));
      }
      const ts = nowTimeStr();
      if (normalizedZones.length > 0) {
        const zoneNames = normalizedZones
          .map((zid) => zones.find((z) => z.id === zid)?.name || zid)
          .join('、');
        setAuditLogs((prev) => [
          {
            id: `aud_list_${Date.now()}`,
            category: 'order',
            title: `私有节点 ${normalizedExpert.handle} 已上架至：${zoneNames}`,
            detail: `项目签约挂牌价 ${formatUsd(normalizedExpert.projectPriceUsd)}/项目，Nexa 助理将自动跟进外部雇主咨询与结算。`,
            severity: 'success',
            timestamp: ts,
          },
          ...prev,
        ]);
      }
    },
    [zones],
  );

  const toggleMarketListing = useCallback(
    (agentId: string, targetZoneId?: string) => {
      const target = agents.find((a) => a.id === agentId);
      if (!target || target.ownership !== 'private') return;
      const zoneId = targetZoneId || activeZone.id;
      const zoneName = zones.find((z) => z.id === zoneId)?.name || '当前协作空间';
      const isInZone = target.listedZoneIds.includes(zoneId);
      const nextZones = isInZone
        ? target.listedZoneIds.filter((id) => id !== zoneId)
        : [...target.listedZoneIds, zoneId];
      const ts = nowTimeStr();

      setAgents((prev) =>
        prev.map((a) =>
          a.id === agentId
            ? {
                ...a,
                listedZoneIds: nextZones,
                isListedInMarket: nextZones.length > 0,
                isOnlineForOrders: true,
              }
            : a,
        ),
      );

      setAuditLogs((prev) => [
        {
          id: `aud_tgl_${Date.now()}`,
          category: 'order',
          title: !isInZone
            ? `私有节点 ${target.handle} 已上架「${zoneName}」`
            : `私有节点 ${target.handle} 已从「${zoneName}」下架`,
          detail: !isInZone
            ? `已在「${zoneName}」服务市场曝光接单，平台助理将实时播报雇佣协商与收益结算。`
            : nextZones.length > 0
              ? `已撤回在「${zoneName}」的曝光，其余已勾选协作空间仍保持接单。`
              : '已撤回全部对外市场曝光，当前仅保留个人私有自用权限。',
          severity: 'info',
          timestamp: ts,
        },
        ...prev,
      ]);
    },
    [activeZone.id, agents, zones],
  );

  const updateAgentRuntimeConfig = useCallback(
    (agentId: string, runtimeAgent: string, defaultModel: string) => {
      setAgents((prev) =>
        prev.map((a) =>
          a.id === agentId ? { ...a, runtimeAgent, defaultModel } : a,
        ),
      );
    },
    [],
  );

  const sendGroupMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setAiError(null);

      const userMsgId = `msg_user_${Date.now()}`;
      const userMsg: ChatMessage = {
        id: userMsgId,
        sessionId: activeWorkspace.id,
        senderType: 'employer',
        senderId: 'employer',
        senderName: '我（项目负责人）',
        senderHandle: '@指挥官',
        content: trimmed,
        timestamp: nowTimeStr(),
      };

      const nextSessionMessages = [...sessionMessages, userMsg];
      setAllMessages((prev) => [...prev, userMsg]);
      setIsAiBusy(true);

      try {
        const result = await orchestrateGroupChat({
          message: trimmed,
          workspace: activeWorkspace,
          hiredAgents,
          recentMessages: nextSessionMessages,
          existingTasks: sessionTasks,
        });

        const ts = nowTimeStr();
        const validTypes = new Set<WorkCardType>(['planning', 'development', 'testing', 'review']);
        const createdTasks: WorkflowTask[] = (result.newTasks || []).map((nt, idx) => {
          const validAssignee = hiredAgents.find((a) => a.id === nt.assigneeId) || hiredAgents[0];
          const wType: WorkCardType = validTypes.has(nt.workType) ? nt.workType : 'development';
          return {
            id: `tsk_${Date.now().toString().slice(-4)}_${idx + 1}`,
            sessionId: activeWorkspace.id,
            featureModule: nt.featureModule?.trim() || 'A功能 · 多币种结算',
            workType: wType,
            title: nt.title,
            description: nt.description,
            assigneeId: validAssignee ? validAssignee.id : 'butler',
            assigneeHandle: validAssignee ? validAssignee.handle : nt.assigneeHandle || '@Nexa',
            status: 'pending',
            priority: nt.priority === '高' || nt.priority === '低' ? nt.priority : '中',
            createdAt: ts,
            updatedAt: ts,
            sourceMessageId: userMsgId,
          };
        });

        if (createdTasks.length > 0) {
          setAllTasks((prev) => [...createdTasks, ...prev]);
        }

        const aiReplies: ChatMessage[] = (result.replies || []).map((r, idx) => ({
          id: `msg_ai_${Date.now()}_${idx}`,
          sessionId: activeWorkspace.id,
          senderType: r.senderType === 'butler' ? 'butler' : 'agent',
          senderId: r.senderId,
          senderName: r.senderName,
          senderHandle: r.senderHandle,
          content: r.content,
          timestamp: ts,
          linkedTaskIds:
            idx === result.replies.length - 1 ? createdTasks.map((t) => t.id) : undefined,
        }));

        if (aiReplies.length > 0) {
          setAllMessages((prev) => [...prev, ...aiReplies]);
        }
      } catch (err) {
        setAiError(err instanceof Error ? err.message : '群聊智能体响应失败');
      } finally {
        setIsAiBusy(false);
      }
    },
    [activeWorkspace, hiredAgents, sessionMessages, sessionTasks],
  );

  const updateTaskStatus = useCallback(
    (taskId: string, nextStatus: TaskStatus) => {
      const target = allTasks.find((t) => t.id === taskId);
      if (!target) return;
      const ts = nowTimeStr();

      setAllTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: nextStatus, updatedAt: ts } : t)),
      );

      if (nextStatus === 'done') {
        const proj = workspaces.find((w) => w.id === target.sessionId);
        setAllMessages((prev) => [
          ...prev,
          {
            id: `msg_approve_${Date.now()}`,
            sessionId: target.sessionId,
            senderType: 'system',
            senderId: 'system',
            senderName: '项目看板同步',
            senderHandle: '看板同步',
            content: `已审批通过工作卡片「${target.title}」（${target.assigneeHandle}），交付产物已归档至工作区。`,
            timestamp: ts,
            linkedTaskIds: [taskId],
          },
        ]);
        setTaskSessions((prev) => {
          const existing = prev[taskId] || [];
          return {
            ...prev,
            [taskId]: [
              ...existing,
              {
                id: `tsm_done_${Date.now()}`,
                taskId,
                sender: 'system',
                content: `雇主已验证通过「${target.title}」，产物归档完成，结论已自动摘要回写至项目群聊。`,
                timestamp: ts,
                milestoneSynced: true,
              },
            ],
          };
        });
        setAuditLogs((prev) => [
          {
            id: `aud_ok_${Date.now()}`,
            category: 'audit',
            title: `交付验证通过：${target.title}`,
            detail: `${proj?.name || '项目'} · ${target.assigneeHandle} 产物已合并归档。`,
            severity: 'success',
            timestamp: ts,
          },
          ...prev,
        ]);
      }
    },
    [allTasks, workspaces],
  );

  const openTaskSession = useCallback(
    (taskId: string) => {
      const target = allTasks.find((t) => t.id === taskId);
      if (!target) return;
      const agent = agents.find((a) => a.id === target.assigneeId);

      setTaskSessions((prev) => {
        if (prev[taskId] && prev[taskId].length > 0) return prev;
        return {
          ...prev,
          [taskId]: [
            {
              id: `tsm_init_${Date.now()}`,
              taskId,
              sender: 'agent',
              content: `已进入 ${agent?.handle || target.assigneeHandle} 的任务执行 Session（#${target.id} · ${target.title}）。本 Session 支持多轮细节确认、代码/方案微调与边界追问，不会刷屏项目群；关键里程碑与验收节点我会自动摘要回写至项目群。请直接告诉我你最关心的约束条件或点击下方快捷选项开工。`,
              timestamp: nowTimeStr(),
              suggestedActions: [
                '请先输出执行计划与需要确认的边界条件',
                '按卡片规格直接开始执行并产出初版方案',
              ],
              awaitingConfirmation: target.status !== 'done',
            },
          ],
        };
      });

      setActiveSessionId(target.sessionId);
      setActiveChatChannel({ type: 'task_session', taskId, projectId: target.sessionId });
      setActiveView('chat');
      setTaskSessionError(null);
    },
    [agents, allTasks],
  );

  const openNegotiationsHub = useCallback(() => {
    const firstThread = negotiations[0];
    if (firstThread) {
      setActiveChatChannel({ type: 'dm', agentId: firstThread.agentId });
      setActiveView('chat');
      return;
    }
    const fallbackAgent = agents.find((a) => a.isListedInMarket) || agents[0];
    if (fallbackAgent) {
      startOrOpenNegotiation(fallbackAgent.id, true);
    }
  }, [agents, negotiations, startOrOpenNegotiation]);

  const sendTaskSessionTurn = useCallback(
    async (taskId: string, rawText: string) => {
      const cleaned = rawText.trim();
      if (!cleaned) return;
      const task = allTasks.find((t) => t.id === taskId);
      if (!task) return;

      const assignedAgent = agents.find((a) => a.id === task.assigneeId);
      const taskWorkspace = workspaces.find((w) => w.id === task.sessionId) || activeWorkspace;
      const prevHistory = taskSessions[taskId] || [];
      const ts = nowTimeStr();

      setTaskSessionError(null);
      setTaskSessionBusyId(taskId);

      const userTurn: TaskSessionMessage = {
        id: `tsm_u_${Date.now()}`,
        taskId,
        sender: 'employer',
        content: cleaned,
        timestamp: ts,
      };

      // Clear previous awaitingConfirmation flags and append employer message
      const nextHistory: TaskSessionMessage[] = [
        ...prevHistory.map((m) => (m.awaitingConfirmation ? { ...m, awaitingConfirmation: false } : m)),
        userTurn,
      ];

      setTaskSessions((prev) => ({
        ...prev,
        [taskId]: nextHistory,
      }));

      // If task was pending, move to in_progress and emit one concise milestone start broadcast to project group
      if (task.status === 'pending') {
        setAllTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: 'in_progress', updatedAt: ts } : t)),
        );
        setAllMessages((prev) => [
          ...prev,
          {
            id: `msg_ts_start_${Date.now()}`,
            sessionId: task.sessionId,
            senderType: 'system',
            senderId: 'system',
            senderName: 'Agent 任务里程碑同步',
            senderHandle: '里程碑同步',
            content: `${assignedAgent?.handle || task.assigneeHandle} 已在 Agent 任务 Session #${task.id} 启动执行「${task.title}」（过程细节保留在 Session 内，待验证时自动回写结论）。`,
            timestamp: ts,
            linkedTaskIds: [taskId],
          },
        ]);
      }

      try {
        const result = await sendTaskSessionMessage({
          task: { ...task, status: task.status === 'pending' ? 'in_progress' : task.status },
          agent: assignedAgent,
          workspace: taskWorkspace,
          history: nextHistory,
          message: cleaned,
        });

        const replyTs = nowTimeStr();
        const shouldSyncMilestone = Boolean(result.readyForReview);

        const agentTurn: TaskSessionMessage = {
          id: `tsm_a_${Date.now()}`,
          taskId,
          sender: 'agent',
          content: result.reply,
          timestamp: replyTs,
          executionSteps: (result.executionSteps || []).filter(Boolean),
          artifactPath: result.artifactPath?.trim() || undefined,
          artifactSnippet: result.artifactSnippet?.trim() || undefined,
          suggestedActions: (result.suggestedActions || []).filter(Boolean),
          awaitingConfirmation: Boolean(result.awaitingConfirmation),
          milestoneSynced: shouldSyncMilestone,
        };

        setTaskSessions((prev) => ({
          ...prev,
          [taskId]: [...(prev[taskId] || nextHistory), agentTurn],
        }));

        if (shouldSyncMilestone) {
          const finalArtifact =
            result.artifactPath?.trim() || task.deliverableArtifact || `artifacts/${task.id}_deliverable.md`;
          const milestoneText =
            result.groupMilestoneSummary?.trim() ||
            `已完成「${task.title}」本轮 Agent Session 迭代并提交待验证（产物：${finalArtifact}）。`;

          setAllTasks((prev) =>
            prev.map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    status: t.status === 'done' ? 'done' : 'review',
                    deliverableSummary: result.reply,
                    deliverableArtifact: finalArtifact,
                    updatedAt: replyTs,
                  }
                : t,
            ),
          );

          setAllMessages((prev) => [
            ...prev,
            {
              id: `msg_ts_rev_${Date.now()}`,
              sessionId: task.sessionId,
              senderType: 'agent',
              senderId: assignedAgent?.id || 'butler',
              senderName: assignedAgent?.name || 'Nexa 助理',
              senderHandle: assignedAgent?.handle || task.assigneeHandle,
              content: `【Agent 任务里程碑】${milestoneText}`,
              timestamp: replyTs,
              linkedTaskIds: [taskId],
            },
          ]);

          setAuditLogs((prev) => [
            {
              id: `aud_ts_${Date.now()}`,
              category: 'audit',
              title: `Agent 任务交付就绪待验证：${task.title}`,
              detail: `${taskWorkspace.name} · ${task.assigneeHandle} 已在 Session #${task.id} 完成迭代并回写群聊摘要。`,
              severity: 'warning',
              timestamp: replyTs,
            },
            ...prev,
          ]);
        } else if (result.artifactPath?.trim()) {
          setAllTasks((prev) =>
            prev.map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    deliverableArtifact: result.artifactPath.trim(),
                    updatedAt: replyTs,
                  }
                : t,
            ),
          );
        }
      } catch (err) {
        setTaskSessionError(err instanceof Error ? err.message : 'Agent 任务 Session 调用失败');
      } finally {
        setTaskSessionBusyId(null);
      }
    },
    [activeWorkspace, agents, allTasks, taskSessions, workspaces],
  );

  const syncTaskSummaryToGroup = useCallback(
    (taskId: string, customNote?: string) => {
      const task = allTasks.find((t) => t.id === taskId);
      if (!task) return;
      const assignedAgent = agents.find((a) => a.id === task.assigneeId);
      const history = taskSessions[taskId] || [];
      const lastAgentTurn = [...history].reverse().find((m) => m.sender === 'agent');
      const ts = nowTimeStr();
      const summary =
        customNote?.trim() ||
        (lastAgentTurn
          ? lastAgentTurn.content.slice(0, 88) + (lastAgentTurn.content.length > 88 ? '...' : '')
          : `「${task.title}」已在 Agent Session 同步阶段进展。`);

      setAllMessages((prev) => [
        ...prev,
        {
          id: `msg_ts_sync_${Date.now()}`,
          sessionId: task.sessionId,
          senderType: 'agent',
          senderId: assignedAgent?.id || 'butler',
          senderName: assignedAgent?.name || 'Nexa 助理',
          senderHandle: assignedAgent?.handle || task.assigneeHandle,
          content: `【Agent 任务阶段同步】${summary}${task.deliverableArtifact ? `（产物：${task.deliverableArtifact}）` : ''}`,
          timestamp: ts,
          linkedTaskIds: [taskId],
        },
      ]);

      setTaskSessions((prev) => ({
        ...prev,
        [taskId]: [
          ...(prev[taskId] || []),
          {
            id: `tsm_sync_${Date.now()}`,
            taskId,
            sender: 'system',
            content: '已将本轮阶段结论手动摘要回写至所属项目群聊。',
            timestamp: ts,
            milestoneSynced: true,
          },
        ],
      }));
    },
    [agents, allTasks, taskSessions],
  );

  const runAutonomousTask = useCallback(
    async (taskId: string) => {
      const task = allTasks.find((t) => t.id === taskId);
      if (!task) return;
      setAiError(null);
      setExecutingTaskId(taskId);

      setAllTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: 'in_progress', updatedAt: nowTimeStr() } : t,
        ),
      );

      const assignedAgent = agents.find((a) => a.id === task.assigneeId);
      const taskWorkspace = workspaces.find((w) => w.id === task.sessionId) || activeWorkspace;

      try {
        const result = await executeKanbanTask({
          task,
          agent: assignedAgent,
          workspace: taskWorkspace,
        });

        const ts = nowTimeStr();

        setAllTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: 'review',
                  deliverableSummary: result.deliverableSummary,
                  deliverableArtifact: result.deliverableArtifact,
                  updatedAt: ts,
                }
              : t,
          ),
        );

        setTaskSessions((prev) => ({
          ...prev,
          [taskId]: [
            ...(prev[taskId] || []).map((m) =>
              m.awaitingConfirmation ? { ...m, awaitingConfirmation: false } : m,
            ),
            {
              id: `tsm_exec_${Date.now()}`,
              taskId,
              sender: 'agent',
              content: `${result.deliverableSummary}\n\n本轮自动执行已进入「待验证」并自动回写摘要至项目群。如需继续修改细节或追加边界测试，可直接在当前 Agent 任务 Session 向我提出。`,
              timestamp: ts,
              artifactPath: result.deliverableArtifact,
              suggestedActions: [
                '补充高并发边界单测后再定稿',
                '已复核产物，确认验证通过',
              ],
              awaitingConfirmation: true,
              milestoneSynced: true,
            },
          ],
        }));

        setAuditLogs((prev) => [
          {
            id: `aud_exec_${Date.now()}`,
            category: 'audit',
            title: `新交付物待验证：${task.title}`,
            detail: `${taskWorkspace.name} · ${task.assigneeHandle} 已提交产物 ${result.deliverableArtifact}，请雇主复核验证。`,
            severity: 'warning',
            timestamp: ts,
          },
          ...prev,
        ]);

        setAllMessages((prev) => [
          ...prev,
          {
            id: `msg_exec_${Date.now()}`,
            sessionId: task.sessionId,
            senderType: 'agent',
            senderId: assignedAgent?.id || 'butler',
            senderName: assignedAgent?.name || 'Nexa 助理',
            senderHandle: assignedAgent?.handle || task.assigneeHandle,
            content: `${result.chatBroadcast}（产物已更新至 ${result.deliverableArtifact}）`,
            timestamp: ts,
            linkedTaskIds: [taskId],
          },
        ]);
      } catch (err) {
        setAiError(err instanceof Error ? err.message : '专家自主执行任务失败');
        setAllTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: 'pending' } : t)),
        );
      } finally {
        setExecutingTaskId(null);
      }
    },
    [activeWorkspace, agents, allTasks, workspaces],
  );

  const jumpToChatWithMention = useCallback((handle: string, projectId?: string) => {
    const targetProj = projectId || activeSessionId;
    setActiveSessionId(targetProj);
    setActiveChatChannel({ type: 'group', projectId: targetProj });
    setActiveView('chat');
    setChatDraftSeed(`${handle} `);
  }, [activeSessionId]);

  const jumpToMarketWithCategory = useCallback((category: 'all' | AgentCategory) => {
    setMarketCategorySeed(category);
    setActiveView('market');
  }, []);

  const jumpToMountPrivateAgent = useCallback(() => {
    setActiveView('team');
    setOpenMountDrawerSignal((n) => n + 1);
  }, []);

  const openZoneProjectsCount = useMemo(
    () => zoneProjects.filter((p) => p.direction === 'recruiting' && p.status === 'open').length,
    [zoneProjects],
  );

  const awaitingTaskSessionCount = useMemo(
    () =>
      allTasks.filter((t) => {
        if (t.status === 'done') return false;
        const msgs = taskSessions[t.id] || [];
        const last = msgs[msgs.length - 1];
        return Boolean(last?.awaitingConfirmation) || t.status === 'review';
      }).length,
    [allTasks, taskSessions],
  );

  const toggleFollowEntity = useCallback((entityKey: string) => {
    setFollowedEntityKeys((prev) =>
      prev.includes(entityKey) ? prev.filter((k) => k !== entityKey) : [entityKey, ...prev],
    );
  }, []);

  const leaseAgent = useCallback(
    (agentId: string, period: LeasePeriod, targetWorkspaceId?: string) => {
      const target = agents.find((a) => a.id === agentId);
      if (!target) return;
      const pricing = getAgentLeasePricing({
        runtimeAgent: target.runtimeAgent,
        defaultModel: target.defaultModel,
        capabilityTier: target.performance.capabilityTier,
        ownership: target.ownership,
        projectPriceUsd: target.projectPriceUsd,
        monthlyLeaseUsd: target.monthlyLeaseUsd,
      });
      const priceUsd = pricing.getPriceForPeriod(period);
      const periodMeta = LEASE_PERIOD_META[period];
      const ts = nowTimeStr();
      const workspaceId = targetWorkspaceId || activeWorkspace.id;
      const targetProj = workspaces.find((w) => w.id === workspaceId) || activeWorkspace;
      const alreadyInProj = targetProj.hiredAgentIds.includes(agentId);

      setAgentLeases((prev) => ({
        ...prev,
        [agentId]: {
          agentId,
          period,
          priceUsd,
          startedAt: '刚刚',
          expiresLabel: `${periodMeta.shortLabel} · 剩余 ${periodMeta.days} 天`,
          autoRenew: true,
        },
      }));

      if (!alreadyInProj) {
        setWorkspaces((prev) =>
          prev.map((w) =>
            w.id === targetProj.id
              ? {
                  ...w,
                  hiredAgentIds: [...w.hiredAgentIds, agentId],
                  spentUsd: w.spentUsd + priceUsd,
                }
              : w,
          ),
        );
        setAllMessages((prev) => [
          ...prev,
          {
            id: `msg_lease_${Date.now()}`,
            sessionId: targetProj.id,
            senderType: 'system',
            senderId: 'system',
            senderName: '系统协同同步',
            senderHandle: '系统通知',
            content: `已按${periodMeta.label}（${formatUsd(priceUsd)}${periodMeta.unitSuffix}）租赁 ${target.handle} 并派驻项目群「${targetProj.name}」。`,
            timestamp: ts,
          },
        ]);
      }

      setAuditLogs((prev) => [
        {
          id: `aud_lease_${Date.now()}`,
          category: 'order',
          title: `已租赁专业 Agent：${target.handle}（${periodMeta.label}）`,
          detail: `租期费用 ${formatUsd(priceUsd)}${periodMeta.unitSuffix}，已关联项目「${targetProj.name}」。`,
          severity: 'success',
          timestamp: ts,
        },
        ...prev,
      ]);
    },
    [activeWorkspace, agents, workspaces],
  );

  const acquireSkill = useCallback((skillId: string, skillName?: string, priceUsd = 0) => {
    setPurchasedSkillIds((prev) => (prev.includes(skillId) ? prev : [skillId, ...prev]));
    if (skillName) {
      const ts = nowTimeStr();
      setAuditLogs((prev) => [
        {
          id: `aud_skill_buy_${Date.now()}`,
          category: 'order',
          title:
            priceUsd > 0
              ? `已买断 Skill/MCP：${skillName}（${formatUsd(priceUsd)}）`
              : `已免费获取 Skill/MCP：${skillName}`,
          detail:
            priceUsd > 0
              ? '一次性买断永久授权生效，可在团队任意自建 Agent 中无限次装配与更新。'
              : '免费开源授权生效，可直接装配至自建 Agent 或通过 CLI 安装。',
          severity: 'success',
          timestamp: ts,
        },
        ...prev,
      ]);
    }
  }, []);

  const inviteTeamExpert = useCallback(
    (input: {
      expertId: string;
      relation: ExpertRelationType;
      targetWorkspaceId?: string;
      sourceZoneId?: string;
      outsourcingScope?: string;
    }) => {
      const expert = humanExperts.find((h) => h.id === input.expertId);
      if (!expert) return;
      const ts = nowTimeStr();
      const targetProj = input.targetWorkspaceId
        ? workspaces.find((w) => w.id === input.targetWorkspaceId)
        : undefined;

      setTeamExperts((prev) => {
        const existing = prev.find((m) => m.expertId === input.expertId);
        if (existing) {
          const nextWorkspaceIds = targetProj
            ? Array.from(new Set([...existing.assignedWorkspaceIds, targetProj.id]))
            : existing.assignedWorkspaceIds;
          return prev.map((m) =>
            m.expertId === input.expertId
              ? {
                  ...m,
                  relation: input.relation,
                  assignedWorkspaceIds: nextWorkspaceIds,
                  outsourcingScope: input.outsourcingScope || m.outsourcingScope,
                }
              : m,
          );
        }
        return [
          {
            expertId: input.expertId,
            relation: input.relation,
            sourceZoneId: input.sourceZoneId || expert.zoneIds[0] || activeZone.id,
            assignedWorkspaceIds: targetProj ? [targetProj.id] : [],
            outsourcingScope:
              input.outsourcingScope || expert.outsourcingDomain || expert.specialties[0] || '',
            joinedAt: '刚刚',
            status: 'active',
          },
          ...prev,
        ];
      });

      if (input.relation === 'mutual_friend') {
        const followKey = `human:${expert.name}`;
        setFollowedEntityKeys((prev) => (prev.includes(followKey) ? prev : [...prev, followKey]));
      }

      if (targetProj) {
        setWorkspaces((prev) =>
          prev.map((w) =>
            w.id === targetProj.id
              ? {
                  ...w,
                  hiredExpertIds: Array.from(new Set([...(w.hiredExpertIds || []), input.expertId])),
                }
              : w,
          ),
        );
      }

      const sourceZoneName =
        zones.find((z) => z.id === (input.sourceZoneId || expert.zoneIds[0] || activeZone.id))
          ?.name || '中文 AI 社区';

      setAuditLogs((prev) => [
        {
          id: `aud_exp_inv_${Date.now()}`,
          category: 'order',
          title: `已将 ${expert.name} 加入专家团队（${input.relation === 'mutual_friend' ? '互关好友' : '项目合作'}）`,
          detail: targetProj
            ? `来源空间：${sourceZoneName}；已同步派驻项目「${targetProj.name}」。`
            : `来源空间：${sourceZoneName}；已加入 AGN 专家团队，可随时派驻项目。`,
          severity: 'success',
          timestamp: ts,
        },
        ...prev,
      ]);
    },
    [activeZone.id, humanExperts, workspaces, zones],
  );

  const assignExpertToWorkspace = useCallback(
    (expertId: string, workspaceId: string) => {
      const expert = humanExperts.find((h) => h.id === expertId);
      const proj = workspaces.find((w) => w.id === workspaceId);
      if (!expert || !proj) return;

      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === workspaceId
            ? {
                ...w,
                hiredExpertIds: Array.from(new Set([...(w.hiredExpertIds || []), expertId])),
              }
            : w,
        ),
      );

      setTeamExperts((prev) => {
        const exists = prev.some((m) => m.expertId === expertId);
        if (exists) {
          return prev.map((m) =>
            m.expertId === expertId
              ? {
                  ...m,
                  assignedWorkspaceIds: Array.from(new Set([...m.assignedWorkspaceIds, workspaceId])),
                }
              : m,
          );
        }
        return [
          {
            expertId,
            relation: 'project_collab',
            sourceZoneId: expert.zoneIds[0] || activeZone.id,
            assignedWorkspaceIds: [workspaceId],
            outsourcingScope: expert.outsourcingDomain || expert.specialties[0] || '',
            joinedAt: '刚刚',
            status: 'active',
          },
          ...prev,
        ];
      });
    },
    [activeZone.id, humanExperts, workspaces],
  );

  const removeExpertFromWorkspace = useCallback((expertId: string, workspaceId: string) => {
    setWorkspaces((prev) =>
      prev.map((w) =>
        w.id === workspaceId
          ? {
              ...w,
              hiredExpertIds: (w.hiredExpertIds || []).filter((id) => id !== expertId),
            }
          : w,
      ),
    );
    setTeamExperts((prev) =>
      prev.map((m) =>
        m.expertId === expertId
          ? {
              ...m,
              assignedWorkspaceIds: m.assignedWorkspaceIds.filter((id) => id !== workspaceId),
            }
          : m,
      ),
    );
  }, []);

  const updateTeamExpertRelation = useCallback(
    (expertId: string, relation: ExpertRelationType) => {
      setTeamExperts((prev) =>
        prev.map((m) => (m.expertId === expertId ? { ...m, relation } : m)),
      );
    },
    [],
  );

  const removeTeamExpert = useCallback((expertId: string) => {
    setTeamExperts((prev) => prev.filter((m) => m.expertId !== expertId));
    setWorkspaces((prev) =>
      prev.map((w) => ({
        ...w,
        hiredExpertIds: (w.hiredExpertIds || []).filter((id) => id !== expertId),
      })),
    );
  }, []);

  // ================= DEDICATED SPACE (OS NODES, CLOUD STORAGE, CLI AGENTS) =================
  const mountPrivateNode = useCallback(
    (input: {
      name: string;
      os: NodeOsType;
      osVersion: string;
      region: string;
      cpuCores: number;
      memoryGb: number;
      storageQuotaGb: number;
      description: string;
    }) => {
      const cleaned = input.name.trim();
      if (!cleaned) return '';
      const id = `node_priv_${Date.now().toString().slice(-5)}`;
      const slug = id.replace('node_priv_', '');
      const newNode: ComputeNode = {
        id,
        name: cleaned,
        os: input.os,
        osVersion: input.osVersion,
        origin: 'private',
        region: input.region.trim() || '自有设备',
        cpuCores: Math.max(2, Math.round(input.cpuCores || 8)),
        memoryGb: Math.max(4, Math.round(input.memoryGb || 16)),
        storageQuotaGb: Math.max(50, Math.round(input.storageQuotaGb || 256)),
        storageUsedGb: 12,
        status: 'online',
        endpoint: `tunnel://${input.os}-${slug}.local`,
        monthlyCostUsd: 0,
        mountedAt: '刚刚挂载',
        description:
          input.description.trim() ||
          `挂载的自有 ${input.osVersion} 设备，可在「Agent 配置」安装 Claude Code / Antigravity / Codex 等 CLI 并挂载共享存储。`,
        installedClis: [],
        mountedStorageIds: [],
      };
      setComputeNodes((prev) => [newNode, ...prev]);
      setAuditLogs((prev) => [
        {
          id: `aud_node_${Date.now()}`,
          category: 'audit',
          title: `挂载自有设备节点「${newNode.name}」`,
          detail: `${newNode.osVersion} · ${newNode.cpuCores}C / ${newNode.memoryGb}GB · 零月租费用`,
          severity: 'success',
          timestamp: nowTimeStr(),
        },
        ...prev,
      ]);
      return id;
    },
    [],
  );

  const provisionCloudNode = useCallback(
    (input: {
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
    }) => {
      const cleaned = input.name.trim();
      if (!cleaned) return '';
      const id = `node_cloud_${Date.now().toString().slice(-5)}`;
      const slug = id.replace('node_cloud_', '');
      const newNode: ComputeNode = {
        id,
        name: cleaned,
        os: input.os,
        osVersion: input.osVersion,
        origin: 'cloud',
        region: input.region.trim() || '华东-上海云区',
        cpuCores: Math.max(4, Math.round(input.cpuCores || 8)),
        memoryGb: Math.max(8, Math.round(input.memoryGb || 32)),
        gpuSpec: input.gpuSpec?.trim() || undefined,
        storageQuotaGb: Math.max(100, Math.round(input.storageQuotaGb || 256)),
        storageUsedGb: 16,
        status: 'online',
        endpoint: `cloud://${input.os}-${slug}.agentnexus.io`,
        monthlyCostUsd: Math.max(0, Math.round(input.monthlyCostUsd || 59)),
        mountedAt: '刚刚租用',
        description:
          input.description.trim() ||
          `云端租用的 7×24 在线 ${input.osVersion} 节点，可在「Agent 配置」安装多路 Agent CLI。`,
        installedClis: [],
        mountedStorageIds: [],
      };
      setComputeNodes((prev) => [newNode, ...prev]);
      setAuditLogs((prev) => [
        {
          id: `aud_cloud_${Date.now()}`,
          category: 'settlement',
          title: `租用云端节点「${newNode.name}」`,
          detail: `${newNode.osVersion} · ${newNode.region} · ${newNode.cpuCores}C/${newNode.memoryGb}GB · $${newNode.monthlyCostUsd}/月`,
          severity: 'success',
          timestamp: nowTimeStr(),
        },
        ...prev,
      ]);
      return id;
    },
    [],
  );

  const toggleNodeStatus = useCallback((nodeId: string) => {
    setComputeNodes((prev) =>
      prev.map((n) =>
        n.id === nodeId
          ? { ...n, status: n.status === 'online' ? 'standby' : 'online' }
          : n,
      ),
    );
  }, []);

  const removeComputeNode = useCallback((nodeId: string) => {
    setComputeNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setAgents((prev) =>
      prev.map((a) =>
        a.hostNodeId === nodeId ? { ...a, hostNodeId: undefined, hostCliId: undefined } : a,
      ),
    );
    setStorageVolumes((prev) =>
      prev.map((v) => ({
        ...v,
        boundNodeIds: v.boundNodeIds.filter((id) => id !== nodeId),
      })),
    );
    setWorkspaces((prev) =>
      prev.map((w) => ({
        ...w,
        boundNodeIds: (w.boundNodeIds || []).filter((id) => id !== nodeId),
      })),
    );
  }, []);

  const createStorageVolume = useCallback(
    (input: {
      name: string;
      tierLabel: string;
      region: string;
      quotaGb: number;
      billingMode: StorageBillingMode;
      priceUsd: number;
      encrypted: boolean;
      boundNodeIds: string[];
      boundProjectIds: string[];
    }) => {
      const cleaned = input.name.trim();
      if (!cleaned) return '';
      const id = `vol_${Date.now().toString().slice(-5)}`;
      const newVol: StorageVolume = {
        id,
        name: cleaned,
        tierLabel: input.tierLabel,
        region: input.region || '华东-上海多可用区',
        quotaGb: Math.max(50, Math.round(input.quotaGb || 200)),
        usedGb: 2,
        billingMode: input.billingMode,
        priceUsd: Math.max(0, Math.round(input.priceUsd)),
        encrypted: input.encrypted,
        mountPath: `cloud://space-storage/${id}`,
        boundNodeIds: input.boundNodeIds,
        boundProjectIds: input.boundProjectIds,
        updatedAt: '刚刚开通',
      };
      setStorageVolumes((prev) => [newVol, ...prev]);
      if (input.boundNodeIds.length > 0) {
        setComputeNodes((prev) =>
          prev.map((n) =>
            input.boundNodeIds.includes(n.id)
              ? {
                  ...n,
                  mountedStorageIds: Array.from(new Set([...n.mountedStorageIds, id])),
                }
              : n,
          ),
        );
      }
      setAuditLogs((prev) => [
        {
          id: `aud_vol_${Date.now()}`,
          category: 'settlement',
          title: `${input.billingMode === 'permanent' ? '购买永久云存储' : '租用云存储'}「${newVol.name}」`,
          detail: `${newVol.quotaGb}GB · ${
            newVol.billingMode === 'permanent'
              ? `$${newVol.priceUsd} 永久买断`
              : `$${newVol.priceUsd}/月`
          } · 供多 Agent 共同读写`,
          severity: 'success',
          timestamp: nowTimeStr(),
        },
        ...prev,
      ]);
      return id;
    },
    [],
  );

  const expandStorageVolume = useCallback((volumeId: string, addGb: number) => {
    setStorageVolumes((prev) =>
      prev.map((v) =>
        v.id === volumeId
          ? { ...v, quotaGb: v.quotaGb + Math.max(50, addGb), updatedAt: '刚刚扩容' }
          : v,
      ),
    );
  }, []);

  const addNodeCli = useCallback(
    (
      nodeId: string,
      input: {
        cliTool: CliToolType;
        runtimeAgent: string;
        defaultModel: string;
        authMode: CliAuthMode;
        credentialLabel: string;
        concurrency: number;
      },
    ) => {
      const node = computeNodes.find((n) => n.id === nodeId);
      if (!node) return '';
      const cliVersionMap: Record<CliToolType, string> = {
        claude_code: 'v1.4.2',
        antigravity: 'v2.1.0',
        codex: 'v0.38.0',
        gemini_cli: 'v0.9.4',
        qoder: 'v1.2.0',
      };
      const id = `cli_${Date.now().toString().slice(-5)}`;
      const cleanCred = input.credentialLabel.trim();
      const entry: NodeCliEntry = {
        id,
        cliTool: input.cliTool,
        runtimeAgent: input.runtimeAgent,
        cliVersion: cliVersionMap[input.cliTool] || 'v1.0.0',
        defaultModel: input.defaultModel,
        authMode: input.authMode,
        credentialLabel:
          cleanCred ||
          (input.authMode === 'account_oauth' ? 'ronnie.shi@workspace.io' : 'sk-cli-••••••9a1f'),
        authStatus: 'connected',
        concurrency: Math.min(16, Math.max(1, Math.round(input.concurrency || 2))),
        enabled: true,
      };
      setComputeNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId ? { ...n, installedClis: [...n.installedClis, entry] } : n,
        ),
      );
      setAuditLogs((prev) => [
        {
          id: `aud_cli_add_${Date.now()}`,
          category: 'audit',
          title: `节点「${node.name}」新增 ${entry.runtimeAgent} CLI`,
          detail: `默认模型 ${entry.defaultModel} · ${entry.concurrency} 路并发 · ${
            entry.authMode === 'account_oauth' ? '账号登录' : 'API Key'
          }`,
          severity: 'success',
          timestamp: nowTimeStr(),
        },
        ...prev,
      ]);
      return id;
    },
    [computeNodes],
  );

  const updateNodeCli = useCallback(
    (nodeId: string, cliId: string, patch: Partial<Omit<NodeCliEntry, 'id'>>) => {
      setComputeNodes((prev) =>
        prev.map((n) => {
          if (n.id !== nodeId) return n;
          return {
            ...n,
            installedClis: n.installedClis.map((cli) =>
              cli.id === cliId
                ? {
                    ...cli,
                    ...patch,
                    concurrency:
                      patch.concurrency !== undefined
                        ? Math.min(16, Math.max(1, Math.round(patch.concurrency)))
                        : cli.concurrency,
                  }
                : cli,
            ),
          };
        }),
      );
      // Keep any AGN Team professional Agent bound to this CLI entry in sync
      setAgents((prev) =>
        prev.map((ag) => {
          if (ag.hostCliId !== cliId) return ag;
          const nextModel = patch.defaultModel ?? ag.defaultModel;
          const nextConcurrency =
            patch.concurrency !== undefined
              ? Math.min(16, Math.max(1, Math.round(patch.concurrency)))
              : ag.cliConfig?.concurrency;
          return {
            ...ag,
            defaultModel: nextModel,
            cliConfig: ag.cliConfig
              ? {
                  ...ag.cliConfig,
                  authMode: patch.authMode ?? ag.cliConfig.authMode,
                  credentialLabel: patch.credentialLabel ?? ag.cliConfig.credentialLabel,
                  concurrency: nextConcurrency ?? ag.cliConfig.concurrency,
                }
              : ag.cliConfig,
          };
        }),
      );
    },
    [],
  );

  const removeNodeCli = useCallback((nodeId: string, cliId: string) => {
    setComputeNodes((prev) =>
      prev.map((n) =>
        n.id === nodeId
          ? { ...n, installedClis: n.installedClis.filter((c) => c.id !== cliId) }
          : n,
      ),
    );
    setAgents((prev) =>
      prev.map((ag) => (ag.hostCliId === cliId ? { ...ag, hostCliId: undefined } : ag)),
    );
  }, []);

  const toggleNodeStorageMount = useCallback((nodeId: string, volumeId: string) => {
    let mountedNow = false;
    setComputeNodes((prev) =>
      prev.map((n) => {
        if (n.id !== nodeId) return n;
        const exists = n.mountedStorageIds.includes(volumeId);
        mountedNow = !exists;
        return {
          ...n,
          mountedStorageIds: exists
            ? n.mountedStorageIds.filter((id) => id !== volumeId)
            : [...n.mountedStorageIds, volumeId],
        };
      }),
    );
    setStorageVolumes((prev) =>
      prev.map((v) => {
        if (v.id !== volumeId) return v;
        const exists = v.boundNodeIds.includes(nodeId);
        return {
          ...v,
          boundNodeIds: exists
            ? v.boundNodeIds.filter((id) => id !== nodeId)
            : [...v.boundNodeIds, nodeId],
          updatedAt: mountedNow ? '刚刚挂载' : '刚刚卸载',
        };
      }),
    );
  }, []);

  const deployAgentOnNode = useCallback(
    (input: {
      nodeId: string;
      handle: string;
      name: string;
      title: string;
      category: AgentCategory;
      cliTool: CliToolType;
      runtimeAgent: string;
      defaultModel: string;
      authMode: CliAuthMode;
      credentialLabel: string;
      concurrency: number;
      storageVolumeId?: string;
      skills: string[];
      bio: string;
      bindToProjectId?: string;
    }) => {
      const node = computeNodes.find((n) => n.id === input.nodeId);
      const cleanedName = input.name.trim() || input.handle.replace(/^@/, '').trim();
      if (!node || !cleanedName) return '';
      const rawHandle = input.handle.trim() || cleanedName;
      const normalizedHandle = rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`;
      const id = `agent_space_${Date.now().toString().slice(-5)}`;
      const accents = ['#0284c7', '#4f46e5', '#0f766e', '#7c3aed', '#b45309'];
      const accent = accents[agents.length % accents.length];
      const code =
        cleanedName.replace(/[^A-Za-z0-9\u4e00-\u9fa5]/g, '').slice(0, 2).toUpperCase() || 'AG';

      const cliVersionMap: Record<CliToolType, string> = {
        claude_code: 'v1.4.2',
        antigravity: 'v2.1.0',
        codex: 'v0.38.0',
        gemini_cli: 'v0.9.4',
        qoder: 'v1.2.0',
      };

      const cleanCred = input.credentialLabel.trim();
      const newAgent: ExpertAgent = {
        id,
        handle: normalizedHandle,
        name: cleanedName,
        title: input.title.trim() || `${input.runtimeAgent} CLI 节点实例`,
        category: input.category,
        region: node.region,
        nodeTier: node.origin === 'cloud' ? 'official-cloud' : 'idle-peer',
        serviceMode: 'pure-agent',
        ownership: 'private',
        ownerHumanId: 'human_me',
        ownerHumanName: account?.name || '我（个人节点）',
        ownerHumanTitle: '节点负责人',
        listedZoneIds: [],
        isListedInMarket: false,
        runtimeAgent: input.runtimeAgent,
        defaultModel: input.defaultModel,
        engineModel: `${input.runtimeAgent} CLI (${input.defaultModel})`,
        skills: input.skills.length > 0 ? input.skills : ['CLI 自动化编码', '多路并发交付'],
        mcpTools: ['Cloud Work Storage', 'Git CLI'],
        projectPriceUsd: 0,
        bio:
          input.bio.trim() ||
          `配置在「${node.name}」的 ${input.runtimeAgent} CLI 专业 Agent，支持 ${Math.max(
            1,
            input.concurrency,
          )} 路并发并自动调度隔离环境。`,
        avatarAccent: accent,
        avatarCode: code,
        hostNodeId: node.id,
        cliConfig: {
          cliTool: input.cliTool,
          cliVersion: cliVersionMap[input.cliTool] || 'v1.0.0',
          authMode: input.authMode,
          credentialLabel:
            cleanCred ||
            (input.authMode === 'account_oauth' ? 'workspace-pro@account' : 'sk-cli-••••••9a1f'),
          authStatus: 'connected',
          concurrency: Math.min(16, Math.max(1, Math.round(input.concurrency || 2))),
          activeSlots: 0,
          storageVolumeId: input.storageVolumeId || storageVolumes[0]?.id,
        },
        isOnlineForOrders: node.status === 'online',
        performance: {
          completedProjects: 0,
          successRate: 100,
          reputationScore: 95,
          repeatHireRate: 100,
          avgDeliveryDays: 1.0,
          rating: 5.0,
          capabilityTier: 'A 级专业',
          demandStatus: '档期充裕',
          demandNote: `运行于 ${node.name}`,
          pricingBasis: '自有/租用节点 CLI 实例，按自身账号或 Key 配额消耗',
          recentReviews: [],
        },
      };

      setAgents((prev) => [newAgent, ...prev]);
      if (input.bindToProjectId) {
        setWorkspaces((prev) =>
          prev.map((w) =>
            w.id === input.bindToProjectId
              ? {
                  ...w,
                  hiredAgentIds: Array.from(new Set([...w.hiredAgentIds, id])),
                  boundNodeIds: Array.from(new Set([...(w.boundNodeIds || []), node.id])),
                }
              : w,
          ),
        );
      }
      setAuditLogs((prev) => [
        {
          id: `aud_dep_${Date.now()}`,
          category: 'audit',
          title: `配置节点 CLI Agent：${newAgent.handle}`,
          detail: `节点 ${node.name} · ${newAgent.runtimeAgent} CLI · ${
            newAgent.cliConfig?.concurrency || 1
          } 路并发`,
          severity: 'success',
          timestamp: nowTimeStr(),
        },
        ...prev,
      ]);
      return id;
    },
    [account?.name, agents.length, computeNodes, storageVolumes],
  );

  const assignAgentHostNode = useCallback((agentId: string, nodeId: string | undefined) => {
    setAgents((prev) =>
      prev.map((a) => (a.id === agentId ? { ...a, hostNodeId: nodeId } : a)),
    );
  }, []);

  const updateAgentCliConfig = useCallback(
    (agentId: string, patch: Partial<NodeCliConfig>) => {
      setAgents((prev) =>
        prev.map((a) => {
          if (a.id !== agentId) return a;
          const base: NodeCliConfig = a.cliConfig || {
            cliTool:
              a.runtimeAgent === 'Antigravity'
                ? 'antigravity'
                : a.runtimeAgent === 'Codex'
                  ? 'codex'
                  : a.runtimeAgent === 'Gemini CLI'
                    ? 'gemini_cli'
                    : 'claude_code',
            cliVersion: 'v1.4.2',
            authMode: 'account_oauth',
            credentialLabel: 'ronnie.shi@workspace.io',
            authStatus: 'connected',
            concurrency: 2,
            activeSlots: 0,
            storageVolumeId: storageVolumes[0]?.id,
          };
          return {
            ...a,
            cliConfig: {
              ...base,
              ...patch,
              concurrency:
                patch.concurrency !== undefined
                  ? Math.min(16, Math.max(1, Math.round(patch.concurrency)))
                  : base.concurrency,
            },
          };
        }),
      );
    },
    [storageVolumes],
  );

  // ================= WORK PROJECT LIFECYCLE & STAGE PIPELINE ORCHESTRATION =================
  const updateProjectLifecycle = useCallback(
    (workspaceId: string, status: ProjectLifecycleStatus) => {
      const today = new Date().toISOString().slice(0, 10);
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === workspaceId
            ? {
                ...w,
                lifecycleStatus: status,
                completedAt: status === 'active' ? undefined : w.completedAt || today,
              }
            : w,
        ),
      );
      const proj = workspaces.find((w) => w.id === workspaceId);
      if (proj) {
        const label =
          status === 'completed' ? '标记已完成' : status === 'archived' ? '已归档' : '重新激活为开发中';
        setAuditLogs((prev) => [
          {
            id: `aud_life_${Date.now()}`,
            category: 'audit',
            title: `项目状态变更：${proj.name}`,
            detail: `生命周期已更新为「${label}」。`,
            severity: 'info',
            timestamp: nowTimeStr(),
          },
          ...prev,
        ]);
      }
    },
    [workspaces],
  );

  const updateProjectSpaceBinding = useCallback(
    (workspaceId: string, boundNodeIds: string[], storageVolumeId?: string) => {
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === workspaceId
            ? { ...w, boundNodeIds, storageVolumeId: storageVolumeId || w.storageVolumeId }
            : w,
        ),
      );
      if (storageVolumeId) {
        setStorageVolumes((prev) =>
          prev.map((v) =>
            v.id === storageVolumeId
              ? { ...v, boundProjectIds: Array.from(new Set([...v.boundProjectIds, workspaceId])) }
              : v,
          ),
        );
      }
    },
    [],
  );

  const updateProjectStageSlot = useCallback(
    (projectId: string, stage: WorkCardType, patch: Partial<Omit<ProjectStageSlot, 'stage'>>) => {
      setProjectPipelines((prev) => {
        const existing = prev[projectId] || [
          {
            stage: 'planning',
            roleTitle: '主产品架构师',
            agentId: 'agent_pm_lin',
            handoffMode: 'manual' as PipelineHandoffMode,
            deliverableContract: 'PRD 规格书与核心验收清单',
          },
          {
            stage: 'development',
            roleTitle: '核心研发工程师',
            agentId: 'agent_dev_us',
            handoffMode: 'auto' as PipelineHandoffMode,
            deliverableContract: '核心功能实现与构建验证',
          },
          {
            stage: 'testing',
            roleTitle: '质量验收工程师',
            agentId: 'agent_qa_eu',
            handoffMode: 'auto' as PipelineHandoffMode,
            deliverableContract: '自动化测试脚本与缺陷回归报告',
          },
          {
            stage: 'review',
            roleTitle: '安全与架构审查官',
            agentId: 'agent_review_my',
            handoffMode: 'manual' as PipelineHandoffMode,
            deliverableContract: '架构合规复核与上线签字',
          },
        ];
        return {
          ...prev,
          [projectId]: existing.map((slot) =>
            slot.stage === stage ? { ...slot, ...patch } : slot,
          ),
        };
      });
    },
    [],
  );

  const syncPipelineAgentsToProject = useCallback(
    (projectId: string) => {
      const slots = projectPipelines[projectId] || [];
      const slotAgentIds = slots.map((s) => s.agentId).filter(Boolean);
      const slotNodeIds = slotAgentIds
        .map((aid) => agents.find((a) => a.id === aid)?.hostNodeId)
        .filter((nid): nid is string => Boolean(nid));

      if (slotAgentIds.length === 0) return;

      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === projectId
            ? {
                ...w,
                hiredAgentIds: Array.from(new Set([...w.hiredAgentIds, ...slotAgentIds])),
                boundNodeIds: Array.from(new Set([...(w.boundNodeIds || []), ...slotNodeIds])),
              }
            : w,
        ),
      );
      const proj = workspaces.find((w) => w.id === projectId);
      setAuditLogs((prev) => [
        {
          id: `aud_pipe_${Date.now()}`,
          category: 'audit',
          title: `工作编排已同步：${proj?.name || projectId}`,
          detail: `已将 ${slotAgentIds.length} 个阶段工位 Agent 及其宿主机载体节点同步至项目协同阵容。`,
          severity: 'success',
          timestamp: nowTimeStr(),
        },
        ...prev,
      ]);
    },
    [agents, projectPipelines, workspaces],
  );

  return {
    zones,
    joinedZones,
    activeZoneId,
    activeZone,
    setActiveZoneId,
    joinedZoneIds,
    spaceSharedNodes,
    toggleJoinZone,
    createCollabZone,
    deleteCollabZone,
    inviteSpaceMember,
    updateSpaceMemberRole,
    kickSpaceMember,
    addSpaceSharedNode,
    toggleSpaceSharedNodeStatus,
    updateSpaceSharedNode,
    removeSpaceSharedNode,
    toggleSpaceAgentOnline,
    publishAgentToSpace,
    removeAgentFromSpace,
    activeView,
    setActiveView,
    activeChatChannel,
    setActiveChatChannel,
    workspaces,
    zoneProjects,
    communityPosts,
    openZoneProjectsCount,
    activeWorkspace,
    selectSession,
    createSession,
    publishZoneProject,
    claimZoneProject,
    createCommunityPost,
    togglePinPost,
    toggleLikePost,
    addPostComment,
    followedEntityKeys,
    toggleFollowEntity,
    openAssistantChat,
    openTaskSession,
    openNegotiationsHub,
    openKanbanForProject,
    openWorkspaceTab,
    openTeamTab,
    openCommunityDiscover,
    openMarketForZone,
    kanbanProjectSeed,
    clearKanbanProjectSeed: () => setKanbanProjectSeed(null),
    kanbanTabSeed,
    clearKanbanTabSeed: () => setKanbanTabSeed(null),
    teamTabSeed,
    clearTeamTabSeed: () => setTeamTabSeed(null),
    discoverZoneSeed,
    clearDiscoverZoneSeed: () => setDiscoverZoneSeed(null),
    agents,
    humanExperts,
    agentLeases,
    purchasedSkillIds,
    teamExperts,
    computeNodes,
    storageVolumes,
    projectPipelines,
    mountPrivateNode,
    provisionCloudNode,
    toggleNodeStatus,
    removeComputeNode,
    createStorageVolume,
    expandStorageVolume,
    addNodeCli,
    updateNodeCli,
    removeNodeCli,
    toggleNodeStorageMount,
    deployAgentOnNode,
    assignAgentHostNode,
    updateAgentCliConfig,
    updateProjectLifecycle,
    updateProjectSpaceBinding,
    updateProjectStageSlot,
    syncPipelineAgentsToProject,
    leaseAgent,
    acquireSkill,
    inviteTeamExpert,
    assignExpertToWorkspace,
    removeExpertFromWorkspace,
    updateTeamExpertRelation,
    removeTeamExpert,
    marketplaceAgents,
    totalMarketExpertsCount,
    privateAgents,
    hiredIds,
    hiredAgents,
    allTasks,
    sessionTasks,
    allMessages,
    sessionMessages,
    taskSessions,
    taskSessionBusyId,
    taskSessionError,
    clearTaskSessionError: () => setTaskSessionError(null),
    awaitingTaskSessionCount,
    sendTaskSessionTurn,
    syncTaskSummaryToGroup,
    negotiations,
    activeNegotiationCount,
    assistantMessages,
    assistantBusy,
    assistantPendingCount,
    spaceApplications,
    pendingSpaceApplicationCount,
    resolveSpaceApplication,
    settlements,
    unsettledCount,
    auditLogs,
    reviewTaskCount,
    dmHistories,
    dmBusyAgentId,
    dmError,
    clearDmError: () => setDmError(null),
    startOrOpenNegotiation,
    updateNegotiationTerms,
    sendDirectMessage,
    confirmHireFromNegotiation,
    sendAssistantMessage,
    settleRecord,
    settleAllUnsettled,
    isAiBusy,
    executingTaskId,
    aiError,
    clearAiError: () => setAiError(null),
    chatDraftSeed,
    clearChatDraftSeed: () => setChatDraftSeed(''),
    marketCategorySeed,
    clearMarketCategorySeed: () => setMarketCategorySeed('all'),
    openMountDrawerSignal,
    account,
    authModalOpen,
    setAuthModalOpen,
    loginAccount,
    logoutAccount,
    createWorkCard,
    hireAgent,
    hireAgentIntoProject,
    releaseAgent,
    savePrivateAgent,
    toggleMarketListing,
    updateAgentRuntimeConfig,
    sendGroupMessage,
    updateTaskStatus,
    runAutonomousTask,
    jumpToChatWithMention,
    jumpToMarketWithCategory,
    jumpToMountPrivateAgent,
  };
}
