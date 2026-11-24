import { useCallback, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { AccountAuthModal } from './components/account/AccountPanel';
import { UnifiedChatView } from './components/chat/UnifiedChatView';
import { Sidebar } from './components/layout/Sidebar';
import { TopHeader, type BreadcrumbItem } from './components/layout/TopHeader';
import { formatAgentDisplayName } from './components/shared/EntityIdentity';
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
  my_projects: { group: '工作项目', groupRoot: 'overview', label: '我的项目' },
  kanban: { group: '工作项目', groupRoot: 'overview', label: '项目看板' },
  orchestration: { group: '工作项目', groupRoot: 'overview', label: '工作编排' },
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
  agents: { group: 'Agent 协作', label: 'Agent 成员' },
  collaborators: { group: 'Agent 协作', label: '合作专家' },
  friends: { group: 'Agent 协作', label: '协作好友' },
  collab_my: { group: 'Agent 协作', label: '协作空间' },
  collab_manage: { group: 'Agent 协作', label: '空间管理', parentTab: 'collab_my' },
  collab_discover: { group: 'Agent 协作', label: '发现空间', parentTab: 'collab_my' },
  nodes: { group: 'Agent 基础设施', label: 'Agent 节点' },
  storage: { group: 'Agent 基础设施', label: 'Agent 存储' },
};

const COMMUNITY_TAB_META: Record<
  CommunityHubTab,
  { group: string; label: string; groupRoot: CommunityHubTab }
> = {
  service_agents: { group: '服务市场', label: '专业 Agent', groupRoot: 'service_agents' },
  service_humans: { group: '服务市场', label: '人类专家', groupRoot: 'service_agents' },
  service_skills: { group: '服务市场', label: 'Skills / MCP', groupRoot: 'service_agents' },
  social_all: { group: '社区交流', label: '全部动态', groupRoot: 'social_all' },
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
        { label: 'Agents', onClick: () => store.openTeamTab('agents') },
        {
          label: meta.group,
          onClick: () =>
            store.openTeamTab(meta.group === 'Agent 基础设施' ? 'nodes' : 'agents'),
        },
      ];
      if (meta.parentTab) {
        items.push({
          label: '协作空间',
          onClick: () => store.openTeamTab(meta.parentTab!),
        });
        items.push({
          label:
            teamBreadcrumbCtx.section === 'collab_manage' && teamBreadcrumbCtx.managedZoneName
              ? `${teamBreadcrumbCtx.managedZoneName} · 空间管理`
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
        {
          label: meta.label,
          onClick:
            workspaceBreadcrumbCtx.tab === 'my_projects' &&
            workspaceBreadcrumbCtx.focusedProjectName
              ? () => workspaceBreadcrumbCtx.onClearFocus?.()
              : undefined,
        },
      ];
      if (
        workspaceBreadcrumbCtx.tab === 'my_projects' &&
        workspaceBreadcrumbCtx.focusedProjectName
      ) {
        items.push({ label: workspaceBreadcrumbCtx.focusedProjectName });
      }
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

    // Chat view unified breadcrumbs
    const ch = store.activeChatChannel;
    if (ch.type === 'task_session') {
      const task = store.allTasks.find((t) => t.id === ch.taskId);
      return [
        { label: '协作对话' },
        { label: 'Agent 任务' },
        { label: task ? `#${task.id} ${task.title}` : '任务执行会话' },
      ];
    }
    if (ch.type === 'dm') {
      const dmAgent = store.agents.find((a) => a.id === ch.agentId);
      return [
        { label: '协作对话' },
        { label: '专家单聊' },
        {
          label: dmAgent
            ? formatAgentDisplayName(dmAgent.handle, dmAgent.runtimeAgent)
            : '专家协商',
        },
      ];
    }
    if (ch.type === 'assistant') {
      return [{ label: '协作对话' }, { label: 'Nexa 助理' }];
    }
    return [
      { label: '协作对话' },
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
        zones={store.joinedZones}
        workspaces={store.workspaces}
        agents={store.agents}
        allMessages={store.allMessages}
        allTasks={store.allTasks}
        taskSessions={store.taskSessions}
        negotiations={store.negotiations}
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
        onSelectAssistant={store.openAssistantChat}
        onSelectTaskSession={store.openTaskSession}
        onCreateProject={(name, goal, sourceZoneId) => {
          store.createSession(name, goal, sourceZoneId);
          store.setActiveView('chat');
        }}
        onOpenLogin={() => store.setAuthModalOpen(true)}
        onLogout={store.logoutAccount}
      />

      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        <TopHeader
          breadcrumbs={breadcrumbs}
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
              agents={store.agents}
              hiredAgents={store.hiredAgents}
              privateAgents={store.privateAgents}
              allTasks={store.allTasks}
              sessionMessages={store.sessionMessages}
              sessionTasks={store.sessionTasks}
              taskSessions={store.taskSessions}
              taskSessionBusyId={store.taskSessionBusyId}
              taskSessionError={store.taskSessionError}
              negotiations={store.negotiations}
              assistantMessages={store.assistantMessages}
              settlements={store.settlements}
              spaceApplications={store.spaceApplications}
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
              onSendTaskSessionTurn={store.sendTaskSessionTurn}
              onSyncTaskSummaryToGroup={store.syncTaskSummaryToGroup}
              onStartNegotiation={(agentId) => store.startOrOpenNegotiation(agentId, true)}
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
              projectPipelines={store.projectPipelines}
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
              onUpdateAgentRuntimeConfig={store.updateAgentRuntimeConfig}
              onUpdateProjectLifecycle={store.updateProjectLifecycle}
              onUpdateProjectStageSlot={store.updateProjectStageSlot}
              onSyncPipelineAgentsToProject={store.syncPipelineAgentsToProject}
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
              pendingSpaceApplicationsCount={store.pendingSpaceApplicationCount}
              onOpenAssistant={store.openAssistantChat}
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
              tasks={store.sessionTasks}
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
