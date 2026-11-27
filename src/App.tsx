import { useCallback, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { AccountAuthModal } from './components/account/AccountPanel';
import { UnifiedChatView } from './components/chat/UnifiedChatView';
import { Sidebar } from './components/layout/Sidebar';
import {
  TopHeader,
  TopbarProjectSelector,
  type BreadcrumbItem,
  type TopbarProjectOption,
} from './components/layout/TopHeader';
import { ZoneSelectorDropdown } from './components/shared/ZoneSelectorDropdown';
import { ArtifactsView } from './components/views/ArtifactsView';
import { CommunityHubView } from './components/views/CommunityHubView';
import { MyTeamView } from './components/views/MyTeamView';
import { useAgentNexusStore } from './hooks/useAgentNexusStore';
import type { CommunityZone, TeamSectionTab } from './types/agentnexus';

export default function App() {
  const store = useAgentNexusStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [teamBreadcrumbCtx, setTeamBreadcrumbCtx] = useState<{
    section: TeamSectionTab;
    managedZoneName?: string | null;
  }>({ section: 'agents' });

  const managedZones = useMemo(
    () =>
      store.zones.filter(
        (z) => z.kind === 'private' && Boolean(z.createdByMe || z.isCurrentUserPrincipal),
      ),
    [store.zones],
  );

  const [managedZoneId, setManagedZoneId] = useState<string | null>(
    () => managedZones[0]?.id || null,
  );

  const activeManagedZone = useMemo(
    () => managedZones.find((z) => z.id === managedZoneId) || managedZones[0] || null,
    [managedZoneId, managedZones],
  );

  const totalArtifactCount = useMemo(() => {
    const existingTaskIds = new Set(store.artifacts.map((a) => a.sourceTaskId).filter(Boolean));
    const derivedCount = store.allTasks.filter(
      (t) => Boolean(t.deliverableArtifact) && !existingTaskIds.has(t.id),
    ).length;
    return store.artifacts.length + derivedCount;
  }, [store.allTasks, store.artifacts]);

  const handleTeamBreadcrumbChange = useCallback(
    (ctx: { section: TeamSectionTab; managedZoneName?: string | null }) => {
      setTeamBreadcrumbCtx((prev) =>
        prev.section === ctx.section && prev.managedZoneName === ctx.managedZoneName ? prev : ctx,
      );
    },
    [],
  );

  // Unified 1st-level navigation breadcrumb across all primary views
  const breadcrumbs = useMemo<BreadcrumbItem[]>(() => {
    if (store.activeView === 'team') {
      return [
        {
          label: 'AGN空间',
          onClick:
            teamBreadcrumbCtx.section !== 'agents'
              ? () => store.openTeamTab('agents')
              : undefined,
        },
      ];
    }

    if (store.activeView === 'artifacts') {
      return [{ label: 'Artifacts' }];
    }

    if (store.activeView === 'community') {
      return [
        {
          label: 'AGN社区',
          onClick:
            store.activeCommunityTab !== 'social_all'
              ? () => store.setActiveCommunityTab('social_all')
              : undefined,
        },
      ];
    }

    // Chat view unified 1st-level label
    const ch = store.activeChatChannel;
    if (ch.type === 'new_session') {
      return [{ label: '新会话' }];
    }
    if (ch.type === 'task_session') {
      return [{ label: '任务会话' }];
    }
    return [{ label: '聊天对话' }];
  }, [store, teamBreadcrumbCtx.section]);

  const getZoneStat = useCallback(
    (z: CommunityZone) => {
      const suspended = new Set(z.suspendedAgentIds || []);
      const agentCnt = store.agents.filter(
        (a) => a.listedZoneIds.includes(z.id) && !suspended.has(a.id),
      ).length;
      const postCnt = store.communityPosts.filter((p) => p.zoneId === z.id).length;
      return `${agentCnt} Agent · ${postCnt} 动态 · ${z.memberCount} 成员`;
    },
    [store.agents, store.communityPosts],
  );

  const projectOptions = useMemo<TopbarProjectOption[]>(
    () =>
      store.workspaces.map((w) => {
        const taskCnt = store.allTasks.filter((t) => t.sessionId === w.id).length;
        const statusLabel =
          w.lifecycleStatus === 'completed'
            ? '已完结'
            : w.lifecycleStatus === 'archived'
              ? '已归档'
              : '进行中';
        return {
          id: w.id,
          label: w.name,
          hint: `${taskCnt} 卡`,
          statusLabel,
        };
      }),
    [store.allTasks, store.workspaces],
  );

  // Unified TopHeader center slot: shows Community or Project dropdown switcher whenever inside a Community or Project
  const topHeaderCenterContent = useMemo(() => {
    // 1. Inside AGN社区 -> Community Dropdown Switcher
    if (store.activeView === 'community') {
      return (
        <ZoneSelectorDropdown
          variant="topbar"
          zones={store.joinedZones}
          activeZoneId={store.activeZone.id}
          onSelectZone={store.setActiveZoneId}
          onManageSpaces={() => store.openTeamTab('collab_my')}
          getZoneStat={getZoneStat}
        />
      );
    }

    // 2. Inside AGN空间 -> Agent 社区主理人管理 -> Managed Community Dropdown Switcher
    if (
      store.activeView === 'team' &&
      teamBreadcrumbCtx.section === 'collab_manage' &&
      activeManagedZone
    ) {
      return (
        <ZoneSelectorDropdown
          variant="topbar"
          zones={managedZones}
          activeZoneId={activeManagedZone.id}
          onSelectZone={setManagedZoneId}
          getZoneStat={getZoneStat}
        />
      );
    }

    // 3. Inside 聊天对话 / 任务会话 -> Project Group Chat or Task Session -> Project Dropdown Switcher
    if (store.activeView === 'chat') {
      const ch = store.activeChatChannel;
      if (ch.type === 'group') {
        return (
          <TopbarProjectSelector
            value={store.activeWorkspace.id}
            options={projectOptions}
            onChange={store.selectSession}
            ariaLabel="切换当前项目群"
          />
        );
      }
      if (ch.type === 'task_session') {
        const task = store.allTasks.find((t) => t.id === ch.taskId);
        const taskProjId = task?.sessionId || store.activeWorkspace.id;
        return (
          <TopbarProjectSelector
            value={taskProjId}
            options={projectOptions}
            onChange={store.selectSession}
            ariaLabel="切换所属项目"
          />
        );
      }
    }

    return undefined;
  }, [
    activeManagedZone,
    getZoneStat,
    managedZones,
    projectOptions,
    store,
    teamBreadcrumbCtx.section,
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
        artifactCount={totalArtifactCount}
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
          centerContent={topHeaderCenterContent}
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
              projectAgentAssignments={store.projectAgentAssignments}
              projectTaskTypes={store.projectTaskTypes}
              computeNodes={store.computeNodes}
              spaceSharedNodes={store.spaceSharedNodes}
              storageVolumes={store.storageVolumes}
              teamExperts={store.teamExperts}
              agentLeases={store.agentLeases}
              artifacts={store.artifacts}
              groupKanbanOpenSignal={store.groupKanbanOpenSignal}
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
              onCreateArtifact={store.createProjectArtifact}
              onRunTask={store.runAutonomousTask}
              onApproveTask={(id) => store.updateTaskStatus(id, 'done')}
              onUpdateTaskStatus={store.updateTaskStatus}
              onSendDm={store.sendDirectMessage}
              onUpdateNegotiationTerms={store.updateNegotiationTerms}
              onConfirmHire={store.confirmHireFromNegotiation}
              onSendAssistantMessage={store.sendAssistantMessage}
              onSettleRecord={store.settleRecord}
              onSettleAll={store.settleAllUnsettled}
              onResolveSpaceApplication={store.resolveSpaceApplication}
              onOpenProjectArtifacts={store.openArtifactsForProject}
              onAddProjectAgentAssignment={store.addProjectAgentAssignment}
              onRemoveProjectAgentAssignment={store.removeProjectAgentAssignment}
              onUpdateProjectAgentAssignment={store.updateProjectAgentAssignment}
              onAssignExpertToWorkspace={store.assignExpertToWorkspace}
              onRemoveExpertFromWorkspace={store.removeExpertFromWorkspace}
              onAddProjectTaskType={store.addProjectTaskType}
              onUpdateProjectTaskType={store.updateProjectTaskType}
              onDeleteProjectTaskType={store.deleteProjectTaskType}
              onApplyTaskTypePresetPack={store.applyTaskTypePresetPack}
              onStartTemplateConversation={store.startTemplateConversation}
              onUpdateProjectLifecycle={store.updateProjectLifecycle}
              onJumpToMarket={() => store.openCommunityService()}
              onJumpToCommunity={() => store.openCommunityDiscover()}
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

          {store.activeView === 'artifacts' && (
            <ArtifactsView
              artifacts={store.artifacts}
              workspaces={store.workspaces}
              allTasks={store.allTasks}
              projectSeed={store.artifactsProjectSeed}
              onClearProjectSeed={store.clearArtifactsProjectSeed}
              onCreateArtifact={store.createProjectArtifact}
              onShareArtifactToChat={store.shareArtifactToProjectChat}
              onToggleStarArtifact={store.toggleStarArtifact}
              onDeleteArtifact={store.deleteProjectArtifact}
              onOpenTaskSession={store.openTaskSession}
              onOpenProjectChat={store.selectSession}
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
              managedZoneId={activeManagedZone?.id || null}
              onSelectManagedZone={setManagedZoneId}
              onBreadcrumbContextChange={handleTeamBreadcrumbChange}
              onHireAgent={store.hireAgent}
              onReleaseAgent={store.releaseAgent}
              onLeaseAgent={store.leaseAgent}
              onUpdateAgentSliceFirewall={store.updateAgentSliceFirewall}
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
              communityEvents={store.communityEvents}
              communityPosts={store.communityPosts}
              followedEntityKeys={store.followedEntityKeys}
              zoneSeed={store.discoverZoneSeed}
              onSelectZone={store.setActiveZoneId}
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
              onPublishEvent={store.publishCommunityEvent}
              onToggleRegisterEvent={store.toggleRegisterCommunityEvent}
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
