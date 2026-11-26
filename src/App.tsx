import { useCallback, useEffect, useMemo, useState } from 'react';
import { FolderKanban, X } from 'lucide-react';
import { AccountAuthModal } from './components/account/AccountPanel';
import { UnifiedChatView } from './components/chat/UnifiedChatView';
import { Sidebar } from './components/layout/Sidebar';
import { TopHeader, type BreadcrumbItem } from './components/layout/TopHeader';
import { formatAgentDisplayName } from './components/shared/EntityIdentity';
import { ToolbarDropdown } from './components/shared/ViewToolbar';
import { CommunityHubView } from './components/views/CommunityHubView';
import { MyTeamView } from './components/views/MyTeamView';
import { WorkflowKanbanView, type WorkKanbanTab } from './components/views/WorkflowKanbanView';
import { useAgentNexusStore } from './hooks/useAgentNexusStore';
import type {
  ArtifactCategoryGroup,
  CommunityHubTab,
  TeamSectionTab,
} from './types/agentnexus';

const WORKSPACE_TAB_META: Record<
  WorkKanbanTab,
  { group: '工作项目' | 'Artifacts'; groupRoot: WorkKanbanTab; label: string }
> = {
  overview: { group: '工作项目', groupRoot: 'overview', label: '项目概要' },
  my_projects: { group: '工作项目', groupRoot: 'overview', label: '项目看板' },
  orchestration: { group: '工作项目', groupRoot: 'overview', label: '任务编排' },
  artifacts_all: { group: 'Artifacts', groupRoot: 'artifacts_all', label: '全部产物' },
  artifacts_yours: { group: 'Artifacts', groupRoot: 'artifacts_all', label: '我创建的' },
  artifacts_shared: { group: 'Artifacts', groupRoot: 'artifacts_all', label: '分享给我的' },
  artifacts_starred: { group: 'Artifacts', groupRoot: 'artifacts_all', label: '标星收藏' },
};

const ARTIFACT_CATEGORY_LABELS: Record<ArtifactCategoryGroup, string> = {
  all: '全部类型',
  docs: '文档 · Docs',
  slides: '演示稿 · Slides',
  design: '设计素材 · Design',
  code: '代码与架构 · Code',
};

const TEAM_SECTION_META: Record<
  TeamSectionTab,
  { group: string; label: string; parentTab?: TeamSectionTab }
> = {
  agents: { group: 'Agent 团队', label: 'Agent 成员' },
  principals: { group: 'Agent 团队', label: 'Agent 主理' },
  collab_my: { group: 'Agent 团队', label: 'Agent 社区' },
  collab_manage: { group: 'Agent 团队', label: '主理人管理', parentTab: 'collab_my' },
  collab_discover: { group: 'Agent 团队', label: '发现社区', parentTab: 'collab_my' },
  nodes: { group: '空间资源', label: 'Agent 节点' },
  nodes_purchase: { group: '空间资源', label: '平台采购', parentTab: 'nodes' },
  storage: { group: '空间资源', label: 'Agent 存储' },
  storage_purchase: { group: '空间资源', label: '平台采购', parentTab: 'storage' },
  skills: { group: '空间资源', label: 'Skills / MCP' },
  skills_purchase: { group: '空间资源', label: '平台采购', parentTab: 'skills' },
};

const COMMUNITY_TAB_META: Record<
  CommunityHubTab,
  { group: string; label: string; groupRoot: CommunityHubTab }
> = {
  service_agents: { group: '服务市场', label: '专业 Agent', groupRoot: 'service_agents' },
  service_humans: { group: '服务市场', label: '人类专家', groupRoot: 'service_agents' },
  service_skills: { group: '服务市场', label: 'Skills / MCP', groupRoot: 'service_agents' },
  social_all: { group: '社区交流', label: '全部动态', groupRoot: 'social_all' },
  social_projects: { group: '社区交流', label: '项目共创', groupRoot: 'social_all' },
  social_following: { group: '社区交流', label: '我的关注', groupRoot: 'social_all' },
  social_pinned: { group: '社区交流', label: '主理置顶', groupRoot: 'social_all' },
};

export default function App() {
  const store = useAgentNexusStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [teamBreadcrumbCtx, setTeamBreadcrumbCtx] = useState<{
    section: TeamSectionTab;
    managedZoneName?: string | null;
  }>({ section: 'agents' });

  const [workspaceBreadcrumbCtx, setWorkspaceBreadcrumbCtx] = useState<{
    tab: WorkKanbanTab;
    focusedProjectName?: string | null;
    artifactCategory?: ArtifactCategoryGroup;
    onClearFocus?: () => void;
  }>({ tab: 'overview', artifactCategory: 'all' });

  const [selectedWorkspaceProjectId, setSelectedWorkspaceProjectId] = useState<string>(
    store.workspaces[0]?.id || '',
  );

  useEffect(() => {
    if (store.kanbanProjectSeed && store.kanbanProjectSeed !== 'all') {
      setSelectedWorkspaceProjectId(store.kanbanProjectSeed);
    }
  }, [store.kanbanProjectSeed]);

  const activeWorkspaceProject = useMemo(
    () =>
      store.workspaces.find((w) => w.id === selectedWorkspaceProjectId) ||
      store.workspaces[0] ||
      null,
    [selectedWorkspaceProjectId, store.workspaces],
  );

  const handleTeamBreadcrumbChange = useCallback(
    (ctx: { section: TeamSectionTab; managedZoneName?: string | null }) => {
      setTeamBreadcrumbCtx((prev) =>
        prev.section === ctx.section && prev.managedZoneName === ctx.managedZoneName ? prev : ctx,
      );
    },
    [],
  );

  const handleWorkspaceBreadcrumbChange = useCallback(
    (ctx: {
      tab: WorkKanbanTab;
      focusedProjectName?: string | null;
      artifactCategory?: ArtifactCategoryGroup;
      onClearFocus?: () => void;
    }) => {
      setWorkspaceBreadcrumbCtx((prev) =>
        prev.tab === ctx.tab &&
        prev.focusedProjectName === ctx.focusedProjectName &&
        prev.artifactCategory === ctx.artifactCategory
          ? prev
          : ctx,
      );
    },
    [],
  );

  const breadcrumbs = useMemo<BreadcrumbItem[]>(() => {
    if (store.activeView === 'team') {
      const meta = TEAM_SECTION_META[teamBreadcrumbCtx.section] || TEAM_SECTION_META.agents;
      const items: BreadcrumbItem[] = [
        { label: 'AGN空间', onClick: () => store.openTeamTab('agents') },
        {
          label: meta.group,
          onClick: () =>
            store.openTeamTab(meta.group === '空间资源' ? 'nodes' : 'agents'),
        },
      ];
      if (meta.parentTab) {
        items.push({
          label: TEAM_SECTION_META[meta.parentTab].label,
          onClick: () => store.openTeamTab(meta.parentTab!),
        });
        items.push({
          label:
            teamBreadcrumbCtx.section === 'collab_manage' && teamBreadcrumbCtx.managedZoneName
              ? `${teamBreadcrumbCtx.managedZoneName} · 主理人管理`
              : meta.label,
        });
      } else {
        items.push({ label: meta.label });
      }
      return items;
    }

    if (store.activeView === 'kanban') {
      const meta = WORKSPACE_TAB_META[workspaceBreadcrumbCtx.tab] || WORKSPACE_TAB_META.overview;
      const items: BreadcrumbItem[] = [
        { label: '工作台', onClick: () => store.openWorkspaceTab('overview') },
        {
          label: meta.group,
          onClick: () => store.openWorkspaceTab(meta.groupRoot),
        },
        { label: meta.label },
      ];
      if (
        meta.group === 'Artifacts' &&
        workspaceBreadcrumbCtx.artifactCategory &&
        workspaceBreadcrumbCtx.artifactCategory !== 'all'
      ) {
        items.push({
          label: ARTIFACT_CATEGORY_LABELS[workspaceBreadcrumbCtx.artifactCategory],
        });
      }
      return items;
    }

    if (store.activeView === 'community') {
      const meta =
        COMMUNITY_TAB_META[store.activeCommunityTab] || COMMUNITY_TAB_META.service_agents;
      return [
        {
          label: 'AGN社区',
          onClick: () => store.setActiveCommunityTab('social_all'),
        },
        { label: store.activeZone.name },
        {
          label: meta.group,
          onClick: () => store.setActiveCommunityTab(meta.groupRoot),
        },
        { label: meta.label },
      ];
    }

    // Chat view unified breadcrumbs: clear distinction between 新会话 / 任务模式 / 对话模式
    const ch = store.activeChatChannel;
    if (ch.type === 'new_session') {
      return [{ label: '新会话' }];
    }
    if (ch.type === 'task_session') {
      const task = store.allTasks.find((t) => t.id === ch.taskId);
      const taskAgent = task ? store.agents.find((a) => a.id === task.assigneeId) : undefined;
      const taskProj = task ? store.workspaces.find((w) => w.id === task.sessionId) : undefined;
      return [
        { label: '任务模式' },
        {
          label: taskAgent
            ? formatAgentDisplayName(taskAgent.handle, taskAgent.runtimeAgent)
            : task?.assigneeHandle || 'Agent 任务',
        },
        ...(taskProj
          ? [
              {
                label: taskProj.name,
                onClick: () => store.selectSession(taskProj.id),
              },
            ]
          : []),
        { label: task ? `#${task.id} ${task.title}` : '任务执行会话' },
      ];
    }
    if (ch.type === 'human_dm') {
      const expert = store.humanExperts.find((h) => h.id === ch.expertId);
      return [
        { label: '对话模式' },
        { label: '人类专家单聊' },
        { label: expert ? expert.name : '专家沟通' },
      ];
    }
    if (ch.type === 'dm') {
      const dmAgent = store.agents.find((a) => a.id === ch.agentId);
      return [
        { label: '对话模式' },
        { label: 'Agent 单聊' },
        {
          label: dmAgent
            ? formatAgentDisplayName(dmAgent.handle, dmAgent.runtimeAgent)
            : '专家协商',
        },
      ];
    }
    if (ch.type === 'assistant') {
      return [{ label: '对话模式' }, { label: 'Nexa 助理' }];
    }
    return [
      { label: '对话模式' },
      { label: '项目群' },
      { label: store.activeWorkspace.name },
    ];
  }, [
    store,
    teamBreadcrumbCtx.managedZoneName,
    teamBreadcrumbCtx.section,
    workspaceBreadcrumbCtx,
  ]);

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-slate-50 text-slate-900">
      <Sidebar
        activeView={store.activeView}
        activeChatChannel={store.activeChatChannel}
        conversationMode={store.conversationMode}
        zones={store.joinedZones}
        workspaces={store.workspaces}
        agents={store.agents}
        humanExperts={store.humanExperts}
        allMessages={store.allMessages}
        allTasks={store.allTasks}
        taskSessions={store.taskSessions}
        negotiations={store.negotiations}
        humanDmThreads={store.humanDmThreads}
        assistantMessages={store.assistantMessages}
        assistantPendingCount={store.assistantPendingCount}
        awaitingTaskSessionCount={store.awaitingTaskSessionCount}
        reviewTaskCount={store.reviewTaskCount}
        hiredCount={store.hiredAgents.length}
        privateCount={store.privateAgents.length}
        account={store.account}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onSelectView={store.setActiveView}
        onSelectProjectChat={store.selectSession}
        onSelectDm={(agentId) => store.startOrOpenNegotiation(agentId, true)}
        onSelectHumanDm={store.openHumanDm}
        onSelectAssistant={store.openAssistantChat}
        onSelectTaskSession={store.openTaskSession}
        onCreateAndOpenTaskSession={store.createAndOpenTaskSession}
        onCreateProject={(name, goal, sourceZoneId) => {
          store.createSession(name, goal, sourceZoneId);
          store.setActiveView('chat');
        }}
        onOpenNewSessionLauncher={store.openNewSessionLauncher}
        onSwitchConversationMode={store.switchConversationMode}
        onOpenLogin={() => store.setAuthModalOpen(true)}
        onLogout={store.logoutAccount}
      />

      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        <TopHeader
          breadcrumbs={breadcrumbs}
          breadcrumbTrailing={
            store.activeView === 'kanban' &&
            (workspaceBreadcrumbCtx.tab === 'my_projects' ||
              workspaceBreadcrumbCtx.tab === 'orchestration') &&
            activeWorkspaceProject ? (
              <ToolbarDropdown
                label="项目"
                value={activeWorkspaceProject.id}
                defaultValue=""
                icon={<FolderKanban className="w-3.5 h-3.5 text-blue-600" />}
                onChange={(nextId) => setSelectedWorkspaceProjectId(nextId)}
                options={store.workspaces.map((w) => ({
                  id: w.id,
                  label: w.name,
                  hint: `${store.allTasks.filter((t) => t.sessionId === w.id).length} 卡`,
                }))}
              />
            ) : undefined
          }
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebarCollapse={() => setSidebarCollapsed((v) => !v)}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        {store.aiError && (
          <div className="shrink-0 bg-red-50 border-b border-red-200 px-5 py-2.5 text-xs text-red-800 flex items-center justify-between gap-3">
            <span>{store.aiError}</span>
            <button
              type="button"
              onClick={store.clearAiError}
              className="text-red-500 hover:text-red-800 cursor-pointer shrink-0"
              aria-label="关闭错误提示"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <main className="flex-1 min-h-0 overflow-hidden">
          {store.activeView === 'chat' && (
            <UnifiedChatView
              activeChannel={store.activeChatChannel}
              zones={store.joinedZones}
              workspaces={store.workspaces}
              activeWorkspace={store.activeWorkspace}
              projectPipelines={store.projectPipelines}
              agents={store.agents}
              humanExperts={store.humanExperts}
              hiredAgents={store.hiredAgents}
              privateAgents={store.privateAgents}
              allTasks={store.allTasks}
              sessionMessages={store.sessionMessages}
              sessionTasks={store.sessionTasks}
              taskSessions={store.taskSessions}
              taskSessionBusyId={store.taskSessionBusyId}
              taskSessionError={store.taskSessionError}
              negotiations={store.negotiations}
              humanDmThreads={store.humanDmThreads}
              assistantMessages={store.assistantMessages}
              settlements={store.settlements}
              spaceApplications={store.managedSpaceApplications}
              auditLogs={store.auditLogs}
              account={store.account}
              isGroupBusy={store.isAiBusy}
              isAssistantBusy={store.assistantBusy}
              dmBusyAgentId={store.dmBusyAgentId}
              dmError={store.dmError}
              executingTaskId={store.executingTaskId}
              draftSeed={store.chatDraftSeed}
              onClearDraftSeed={store.clearChatDraftSeed}
              onClearDmError={store.clearDmError}
              onClearTaskSessionError={store.clearTaskSessionError}
              onSelectProjectChat={store.selectSession}
              onOpenTaskSession={store.openTaskSession}
              onOpenAgentTaskSession={store.openAgentTaskSession}
              onCreateAndOpenTaskSession={store.createAndOpenTaskSession}
              onSendTaskSessionTurn={store.sendTaskSessionTurn}
              onSyncTaskSummaryToGroup={store.syncTaskSummaryToGroup}
              onStartNegotiation={(agentId) => store.startOrOpenNegotiation(agentId, true)}
              onSendHumanDm={store.sendHumanDmMessage}
              onSendGroupMessage={store.sendGroupMessage}
              onCreateWorkCard={store.createWorkCard}
              onRunTask={store.runAutonomousTask}
              onApproveTask={(id) => store.updateTaskStatus(id, 'done')}
              onSendDm={store.sendDirectMessage}
              onUpdateNegotiationTerms={store.updateNegotiationTerms}
              onConfirmHire={store.confirmHireFromNegotiation}
              onSendAssistantMessage={store.sendAssistantMessage}
              onSettleRecord={store.settleRecord}
              onSettleAll={store.settleAllUnsettled}
              onResolveSpaceApplication={store.resolveSpaceApplication}
              onJumpToMarket={() => store.openCommunityService()}
              onJumpToKanban={store.openKanbanForProject}
              onJumpToTeam={() => store.setActiveView('team')}
              onJumpToMountPrivate={store.jumpToMountPrivateAgent}
              onCreateProjectForLauncher={(name, goal, sourceZoneId) =>
                store.createSession(name, goal, sourceZoneId, undefined, undefined, {
                  stayOnCurrentChannel: true,
                })
              }
              onLaunchNewTaskSession={store.launchNewTaskSessionFromPrompt}
              onReactivateProject={(projectId) =>
                store.updateProjectLifecycle(projectId, 'active')
              }
            />
          )}

          {store.activeView === 'kanban' && (
            <WorkflowKanbanView
              zones={store.zones}
              joinedZoneIds={store.joinedZoneIds}
              spaceSharedNodes={store.spaceSharedNodes}
              workspaces={store.workspaces}
              computeNodes={store.computeNodes}
              storageVolumes={store.storageVolumes}
              projectAgentAssignments={store.projectAgentAssignments}
              projectTaskTypes={store.projectTaskTypes}
              selectedProjectId={activeWorkspaceProject?.id || ''}
              onSelectProjectId={setSelectedWorkspaceProjectId}
              projectSeed={store.kanbanProjectSeed}
              onClearProjectSeed={store.clearKanbanProjectSeed}
              tabSeed={store.kanbanTabSeed}
              onClearTabSeed={store.clearKanbanTabSeed}
              allTasks={store.allTasks}
              agents={store.agents}
              humanExperts={store.humanExperts}
              agentLeases={store.agentLeases}
              teamExperts={store.teamExperts}
              negotiations={store.negotiations}
              settlements={store.settlements}
              executingTaskId={store.executingTaskId}
              artifacts={store.artifacts}
              onCreateArtifact={store.createProjectArtifact}
              onShareArtifactToChat={store.shareArtifactToProjectChat}
              onToggleStarArtifact={store.toggleStarArtifact}
              onDeleteArtifact={store.deleteProjectArtifact}
              onOpenProjectChat={store.selectSession}
              onBreadcrumbContextChange={handleWorkspaceBreadcrumbChange}
              onCreateProject={store.createSession}
              onRunTask={store.runAutonomousTask}
              onUpdateStatus={store.updateTaskStatus}
              onOpenTaskSession={store.openTaskSession}
              onConfirmHire={store.confirmHireFromNegotiation}
              onJumpToMarket={() => store.openCommunityService()}
              onJumpToZoneMarket={store.openMarketForZone}
              onJumpToDiscover={() => store.openCommunityDiscover()}
              onJumpToTeam={() => store.setActiveView('team')}
              onJumpToTeamNodes={() => store.openTeamTab('nodes')}
              onReleaseAgent={store.releaseAgent}
              onLeaseAgent={store.leaseAgent}
              onAssignExpertToWorkspace={store.assignExpertToWorkspace}
              onRemoveExpertFromWorkspace={store.removeExpertFromWorkspace}
              onUpdateProjectLifecycle={store.updateProjectLifecycle}
              onAddProjectAgentAssignment={store.addProjectAgentAssignment}
              onRemoveProjectAgentAssignment={store.removeProjectAgentAssignment}
              onUpdateProjectAgentAssignment={store.updateProjectAgentAssignment}
              onAddProjectTaskType={store.addProjectTaskType}
              onUpdateProjectTaskType={store.updateProjectTaskType}
              onDeleteProjectTaskType={store.deleteProjectTaskType}
              onApplyTaskTypePresetPack={store.applyTaskTypePresetPack}
              onStartTemplateConversation={store.startTemplateConversation}
            />
          )}

          {store.activeView === 'team' && (
            <MyTeamView
              zones={store.joinedZones}
              allZones={store.zones}
              joinedZoneIds={store.joinedZoneIds}
              activeZone={store.activeZone}
              communityPosts={store.communityPosts}
              zoneProjects={store.zoneProjects}
              spaceApplications={store.spaceApplications}
              pendingSpaceApplicationsCount={store.pendingSpaceApplicationCount}
              onOpenAssistant={store.openAssistantChat}
              onResolveSpaceApplication={store.resolveSpaceApplication}
              onApplyToJoinZone={store.applyToJoinZone}
              onUpdateZoneInviteCode={store.updateZoneInviteCode}
              onTogglePinPost={store.togglePinPost}
              onDeleteCommunityPost={store.deleteCommunityPost}
              onCreateCommunityPost={store.createCommunityPost}
              workspace={store.activeWorkspace}
              workspaces={store.workspaces}
              allAgents={store.agents}
              computeNodes={store.computeNodes}
              spaceSharedNodes={store.spaceSharedNodes}
              storageVolumes={store.storageVolumes}
              humanExperts={store.humanExperts}
              agentLeases={store.agentLeases}
              teamExperts={store.teamExperts}
              hiredAgents={store.hiredAgents}
              privateAgents={store.privateAgents}
              hiredIds={store.hiredIds}
              tasks={store.allTasks}
              openMountDrawerSignal={store.openMountDrawerSignal}
              teamSectionSeed={store.teamTabSeed}
              onClearTeamSectionSeed={store.clearTeamTabSeed}
              onBreadcrumbContextChange={handleTeamBreadcrumbChange}
              onHireAgent={store.hireAgent}
              onReleaseAgent={store.releaseAgent}
              onLeaseAgent={store.leaseAgent}
              onInviteTeamExpert={store.inviteTeamExpert}
              onAssignExpertToWorkspace={store.assignExpertToWorkspace}
              onRemoveExpertFromWorkspace={store.removeExpertFromWorkspace}
              onUpdateTeamExpertRelation={store.updateTeamExpertRelation}
              onRemoveTeamExpert={store.removeTeamExpert}
              onStartNegotiation={(agentId) => store.startOrOpenNegotiation(agentId, true)}
              onOpenTaskSession={store.openTaskSession}
              onOpenAgentTaskSession={store.openAgentTaskSession}
              onSavePrivateAgent={store.savePrivateAgent}
              onToggleMarketListing={store.toggleMarketListing}
              onRecruitCategory={store.jumpToMarketWithCategory}
              onJumpToMarket={() => store.openCommunityService()}
              onMountPrivateNode={store.mountPrivateNode}
              onProvisionCloudNode={store.provisionCloudNode}
              onToggleNodeStatus={store.toggleNodeStatus}
              onRemoveComputeNode={store.removeComputeNode}
              onAddNodeCli={store.addNodeCli}
              onUpdateNodeCli={store.updateNodeCli}
              onRemoveNodeCli={store.removeNodeCli}
              onToggleNodeStorageMount={store.toggleNodeStorageMount}
              onCreateStorageVolume={store.createStorageVolume}
              onExpandStorageVolume={store.expandStorageVolume}
              onToggleJoinZone={store.toggleJoinZone}
              onCreateCollabZone={store.createCollabZone}
              onDeleteCollabZone={store.deleteCollabZone}
              onJumpToZoneMarket={store.openMarketForZone}
              onJumpToZoneDiscover={store.openCommunityDiscover}
              onInviteSpaceMember={store.inviteSpaceMember}
              onUpdateSpaceMemberRole={store.updateSpaceMemberRole}
              onKickSpaceMember={store.kickSpaceMember}
              onAddSpaceSharedNode={store.addSpaceSharedNode}
              onToggleSpaceSharedNodeStatus={store.toggleSpaceSharedNodeStatus}
              onUpdateSpaceSharedNode={store.updateSpaceSharedNode}
              onRemoveSpaceSharedNode={store.removeSpaceSharedNode}
              onToggleSpaceAgentOnline={store.toggleSpaceAgentOnline}
              onPublishAgentToSpace={store.publishAgentToSpace}
              onRemoveAgentFromSpace={store.removeAgentFromSpace}
              marketSkills={store.marketSkills}
              purchasedSkillIds={store.purchasedSkillIds}
              onAcquireSkill={store.acquireSkill}
              onCreateSpaceSkill={store.createSpaceSkill}
              onToggleAgentSkillBinding={store.toggleAgentSkillBinding}
              onToggleZoneSkillDistribution={store.toggleZoneSkillDistribution}
            />
          )}

          {store.activeView === 'community' && (
            <CommunityHubView
              activeTab={store.activeCommunityTab}
              onChangeTab={store.setActiveCommunityTab}
              zones={store.joinedZones}
              activeZone={store.activeZone}
              joinedZoneIds={store.joinedZoneIds}
              workspace={store.activeWorkspace}
              workspaces={store.workspaces}
              allAgents={store.agents}
              marketplaceAgents={store.marketplaceAgents}
              privateAgents={store.privateAgents}
              humanExperts={store.humanExperts}
              marketSkills={store.marketSkills}
              agentLeases={store.agentLeases}
              purchasedSkillIds={store.purchasedSkillIds}
              teamExperts={store.teamExperts}
              hiredIds={store.hiredIds}
              dmHistories={store.dmHistories}
              dmBusyAgentId={store.dmBusyAgentId}
              dmError={store.dmError}
              categorySeed={store.marketCategorySeed}
              zoneProjects={store.zoneProjects}
              communityPosts={store.communityPosts}
              followedEntityKeys={store.followedEntityKeys}
              zoneSeed={store.discoverZoneSeed}
              onSelectZone={store.setActiveZoneId}
              onManageCollabSpaces={() => store.openTeamTab('collab_my')}
              onClearDmError={store.clearDmError}
              onSendDm={store.sendDirectMessage}
              onStartNegotiation={(agentId) => store.startOrOpenNegotiation(agentId, true)}
              onLeaseAgent={store.leaseAgent}
              onAcquireSkill={store.acquireSkill}
              onInviteTeamExpert={store.inviteTeamExpert}
              onSavePrivateAgent={store.savePrivateAgent}
              onClearCategorySeed={store.clearMarketCategorySeed}
              onHire={store.hireAgent}
              onRelease={store.releaseAgent}
              onJumpToMountPrivate={store.jumpToMountPrivateAgent}
              onClearZoneSeed={store.clearDiscoverZoneSeed}
              onToggleJoinZone={store.toggleJoinZone}
              onToggleFollowEntity={store.toggleFollowEntity}
              onCreatePost={store.createCommunityPost}
              onPublishSkill={store.publishCommunitySkill}
              onTogglePinPost={store.togglePinPost}
              onToggleLikePost={store.toggleLikePost}
              onAddPostComment={store.addPostComment}
              onPublishZoneProject={store.publishZoneProject}
              onClaimZoneProject={store.claimZoneProject}
              onJumpToKanban={store.openKanbanForProject}
            />
          )}
        </main>
      </div>

      <AccountAuthModal
        open={store.authModalOpen}
        onClose={() => store.setAuthModalOpen(false)}
        onLogin={store.loginAccount}
      />
    </div>
  );
}
