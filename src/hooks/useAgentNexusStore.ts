import { useCallback, useMemo, useState } from 'react';
import {
  INITIAL_ASSISTANT_MESSAGES,
  INITIAL_AUDIT_LOGS,
  INITIAL_COMMUNITY_POSTS,
  INITIAL_EXPERT_AGENTS,
  INITIAL_HUMAN_EXPERTS,
  INITIAL_MESSAGES,
  INITIAL_NEGOTIATIONS,
  INITIAL_SETTLEMENTS,
  INITIAL_TASKS,
  INITIAL_TASK_SESSIONS,
  INITIAL_WORKSPACES,
  INITIAL_ZONES,
  INITIAL_ZONE_PROJECTS,
} from '../data/initialData';
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
  AgentNexusAccount,
  AssistantMessage,
  ChatMessage,
  CommunityPost,
  CommunityPostType,
  DirectMessage,
  ExpertAgent,
  NavViewId,
  NegotiationThread,
  PlatformAuditLog,
  PlatformServiceCategory,
  ProjectWorkspace,
  SettlementRecord,
  TaskSessionMessage,
  TaskStatus,
  WorkCardType,
  WorkflowTask,
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
  const [zones] = useState(INITIAL_ZONES);
  const [humanExperts] = useState(INITIAL_HUMAN_EXPERTS);
  const [activeZoneId, setActiveZoneId] = useState<string>('zone_public');
  const [joinedZoneIds, setJoinedZoneIds] = useState<string[]>([
    'zone_hz_dnx',
    'zone_zj_opc',
    'zone_ai_robotics',
  ]);

  const [activeView, setActiveView] = useState<NavViewId>('chat');
  const [workspaces, setWorkspaces] = useState<ProjectWorkspace[]>(INITIAL_WORKSPACES);
  const [zoneProjects, setZoneProjects] = useState<ZoneProjectOpportunity[]>(INITIAL_ZONE_PROJECTS);
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>(INITIAL_COMMUNITY_POSTS);
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
  const [auditLogs, setAuditLogs] = useState<PlatformAuditLog[]>(INITIAL_AUDIT_LOGS);

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
  const [kanbanTabSeed, setKanbanTabSeed] = useState<
    'overview' | 'my_projects' | 'kanban' | 'agents' | null
  >(null);
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

  const activeZone = useMemo(
    () => zones.find((z) => z.id === activeZoneId) || zones[0],
    [zones, activeZoneId],
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

  // Zone-scoped Expert Market: controlled inside Expert Market view
  const marketplaceAgents = useMemo(
    () => agents.filter((a) => a.listedZoneIds.includes(activeZone.id)),
    [agents, activeZone.id],
  );

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

  const assistantPendingCount = unsettledCount + reviewTaskCount + activeNegotiationCount;

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

  const openCommunityDiscover = useCallback((zoneId?: string) => {
    if (zoneId) setDiscoverZoneSeed(zoneId);
    setActiveView('discover');
  }, []);

  const openMarketForZone = useCallback((zoneId: string) => {
    setActiveZoneId(zoneId);
    setActiveView('market');
  }, []);

  const toggleJoinZone = useCallback((zoneId: string) => {
    setJoinedZoneIds((prev) =>
      prev.includes(zoneId) ? prev.filter((id) => id !== zoneId) : [...prev, zoneId],
    );
  }, []);

  const createSession = useCallback(
    (name: string, goal: string, sourceZoneId?: string) => {
      const cleanedName = name.trim();
      if (!cleanedName) return '';
      const newId = `ses_${Date.now().toString().slice(-5)}`;
      const newWorkspace: ProjectWorkspace = {
        id: newId,
        name: cleanedName,
        goal: goal.trim() || '协同产品与研发专家 Agent 按工作卡片推进项目交付',
        role: 'leading',
        sourceZoneId,
        workspaceTier: '加密持久化工作区 (50GB)',
        budgetCapUsd: 8000,
        spentUsd: 1200,
        hiredAgentIds: ['agent_pm_lin'],
      };
      const ts = nowTimeStr();
      setWorkspaces((prev) => [newWorkspace, ...prev]);
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
          content: `已创建项目群「${newWorkspace.name}」，默认已签约 @产品策划师（$1,200/项目）。你可以直接在这里自然对话拆解需求，或在服务市场咨询与招募社区专家进群协同。`,
          timestamp: ts,
        },
      ]);
      setAuditLogs((prev) => [
        {
          id: `aud_${Date.now()}`,
          category: 'audit',
          title: `新建主管项目「${newWorkspace.name}」`,
          detail: `已开启加密持久化工作区，项目总预算设定为 ${formatUsd(newWorkspace.budgetCapUsd)}。`,
          severity: 'success',
          timestamp: ts,
        },
        ...prev,
      ]);
      return newId;
    },
    [],
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
      const zoneName = zones.find((z) => z.id === input.zoneId)?.name || '专区';
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
        summary: input.summary.trim() || '面向该专区专家团队开放项目发包，欢迎直接私聊报价签约。',
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
          content: `已将项目「${cleanedTitle}」发布至「${zoneName}」专区项目大厅（预算 ${formatUsd(newOpp.budgetUsd)} · 周期 ${newOpp.durationDays} 天）。你可以前往「服务市场 → ${zoneName}」主动咨询专家与 Agent 报价。`,
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
      const zoneName = zones.find((z) => z.id === opp.zoneId)?.name || '专区';
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
        goal: `承接「${zoneName}」专区项目：${opp.summary}`,
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
          content: `已承接「${zoneName}」专区项目「${opp.title}」（合同预算 ${formatUsd(opp.budgetUsd)}），我方 Agent 团队已进驻协作群并立项首张工作卡片。`,
          timestamp: ts,
          linkedTaskIds: [kickoffTask.id],
        },
      ]);
      setAuditLogs((prev) => [
        {
          id: `aud_claim_${Date.now()}`,
          category: 'order',
          title: `已承接「${zoneName}」项目：${opp.title}`,
          detail: `已归入「工作看板 → 我的项目（我参与）」，首张交付卡片已同步任务流看板。`,
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
        tech: '技术讨论',
        business: '商业分析',
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
          content: `已在项目群创建工作卡片「${newTask.title}」（所属模块：${newTask.featureModule}），指派给 ${newTask.assigneeHandle}，已自动同步至「工作看板」。`,
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
          'settlement',
          'order',
          'audit',
          'general',
        ]);
        const category: PlatformServiceCategory = validCat.has(res.category)
          ? res.category
          : 'general';

        const firstUnsettled = settlements.find((s) => s.status === 'unsettled');
        const firstActiveNeg = negotiations.find((n) => n.status !== 'hired');

        let actionLabel: string | undefined;
        let actionTarget:
          | { type: 'settle'; settlementId: string }
          | { type: 'open_dm'; agentId: string }
          | { type: 'open_kanban'; projectId?: string }
          | { type: 'open_team' }
          | undefined;

        if (category === 'settlement' && firstUnsettled) {
          actionLabel = `确认结算 ${formatUsd(firstUnsettled.amountUsd)}`;
          actionTarget = { type: 'settle', settlementId: firstUnsettled.id };
        } else if (category === 'order' && firstActiveNeg) {
          actionLabel = '打开私聊协商';
          actionTarget = { type: 'open_dm', agentId: firstActiveNeg.agentId };
        } else if (category === 'audit') {
          actionLabel = '去工作看板复核';
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
    [allTasks, assistantMessages, negotiations, privateAgents, settlements, workspaces],
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
      const zoneName = zones.find((z) => z.id === zoneId)?.name || '当前专区';
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
              ? `已撤回在「${zoneName}」的曝光，其余已勾选专区仍保持接单。`
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
            senderName: '工作看板同步',
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

  return {
    zones,
    activeZoneId,
    activeZone,
    setActiveZoneId,
    joinedZoneIds,
    toggleJoinZone,
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
    openAssistantChat,
    openTaskSession,
    openNegotiationsHub,
    openKanbanForProject,
    openCommunityDiscover,
    openMarketForZone,
    kanbanProjectSeed,
    clearKanbanProjectSeed: () => setKanbanProjectSeed(null),
    kanbanTabSeed,
    clearKanbanTabSeed: () => setKanbanTabSeed(null),
    discoverZoneSeed,
    clearDiscoverZoneSeed: () => setDiscoverZoneSeed(null),
    agents,
    humanExperts,
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
