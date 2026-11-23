import { useState } from 'react';
import { X } from 'lucide-react';
import { AccountAuthModal } from './components/account/AccountPanel';
import { UnifiedChatView } from './components/chat/UnifiedChatView';
import { Sidebar } from './components/layout/Sidebar';
import { TopHeader } from './components/layout/TopHeader';
import { AgentMarketView } from './components/views/AgentMarketView';
import { CommunityDiscoverView } from './components/views/CommunityDiscoverView';
import { MyTeamView } from './components/views/MyTeamView';
import { WorkflowKanbanView } from './components/views/WorkflowKanbanView';
import { useAgentNexusStore } from './hooks/useAgentNexusStore';

export default function App() {
  const store = useAgentNexusStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-slate-50 text-slate-900">
      <Sidebar
        activeView={store.activeView}
        activeChatChannel={store.activeChatChannel}
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
        marketCount={store.totalMarketExpertsCount}
        discoverCount={store.openZoneProjectsCount}
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
        onCreateProject={(name, goal) => {
          store.createSession(name, goal);
          store.setActiveView('chat');
        }}
        onOpenLogin={() => store.setAuthModalOpen(true)}
        onLogout={store.logoutAccount}
      />

      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        <TopHeader
          zones={store.zones}
          activeZone={store.activeZone}
          joinedZoneIds={store.joinedZoneIds}
          activeView={store.activeView}
          activeChatChannel={store.activeChatChannel}
          workspace={store.activeWorkspace}
          agents={store.agents}
          allTasks={store.allTasks}
          communityPosts={store.communityPosts}
          zoneProjects={store.zoneProjects}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebarCollapse={() => setSidebarCollapsed((v) => !v)}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onSelectZone={store.setActiveZoneId}
          onToggleJoinZone={store.toggleJoinZone}
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
              onJumpToMarket={() => store.setActiveView('market')}
              onJumpToKanban={store.openKanbanForProject}
              onJumpToTeam={() => store.setActiveView('team')}
            />
          )}

          {store.activeView === 'kanban' && (
            <WorkflowKanbanView
              zones={store.zones}
              workspaces={store.workspaces}
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
              onCreateProject={store.createSession}
              onRunTask={store.runAutonomousTask}
              onUpdateStatus={store.updateTaskStatus}
              onOpenTaskSession={store.openTaskSession}
              onConfirmHire={store.confirmHireFromNegotiation}
              onJumpToMarket={() => store.setActiveView('market')}
              onJumpToZoneMarket={store.openMarketForZone}
              onJumpToDiscover={() => store.openCommunityDiscover()}
              onReleaseAgent={store.releaseAgent}
              onLeaseAgent={store.leaseAgent}
              onAssignExpertToWorkspace={store.assignExpertToWorkspace}
              onRemoveExpertFromWorkspace={store.removeExpertFromWorkspace}
              onUpdateAgentRuntimeConfig={store.updateAgentRuntimeConfig}
            />
          )}

          {store.activeView === 'team' && (
            <MyTeamView
              zones={store.zones}
              activeZone={store.activeZone}
              workspace={store.activeWorkspace}
              workspaces={store.workspaces}
              allAgents={store.agents}
              humanExperts={store.humanExperts}
              agentLeases={store.agentLeases}
              teamExperts={store.teamExperts}
              hiredAgents={store.hiredAgents}
              privateAgents={store.privateAgents}
              hiredIds={store.hiredIds}
              tasks={store.sessionTasks}
              openMountDrawerSignal={store.openMountDrawerSignal}
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
              onJumpToMarket={() => store.setActiveView('market')}
            />
          )}

          {store.activeView === 'market' && (
            <AgentMarketView
              zones={store.zones}
              activeZone={store.activeZone}
              workspace={store.activeWorkspace}
              workspaces={store.workspaces}
              allAgents={store.agents}
              agents={store.marketplaceAgents}
              privateAgents={store.privateAgents}
              humanExperts={store.humanExperts}
              agentLeases={store.agentLeases}
              purchasedSkillIds={store.purchasedSkillIds}
              teamExperts={store.teamExperts}
              hiredIds={store.hiredIds}
              dmHistories={store.dmHistories}
              dmBusyAgentId={store.dmBusyAgentId}
              dmError={store.dmError}
              onClearDmError={store.clearDmError}
              onSendDm={store.sendDirectMessage}
              onStartNegotiation={(agentId) => store.startOrOpenNegotiation(agentId, true)}
              onLeaseAgent={store.leaseAgent}
              onAcquireSkill={store.acquireSkill}
              onInviteTeamExpert={store.inviteTeamExpert}
              onSavePrivateAgent={store.savePrivateAgent}
              categorySeed={store.marketCategorySeed}
              onClearCategorySeed={store.clearMarketCategorySeed}
              onSelectZone={store.setActiveZoneId}
              onHire={store.hireAgent}
              onRelease={store.releaseAgent}
              onJumpToMountPrivate={store.jumpToMountPrivateAgent}
              onJumpToZoneProjects={store.openCommunityDiscover}
            />
          )}

          {store.activeView === 'discover' && (
            <CommunityDiscoverView
              zones={store.zones}
              activeZone={store.activeZone}
              joinedZoneIds={store.joinedZoneIds}
              zoneProjects={store.zoneProjects}
              communityPosts={store.communityPosts}
              followedEntityKeys={store.followedEntityKeys}
              allAgents={store.agents}
              humanExperts={store.humanExperts}
              zoneSeed={store.discoverZoneSeed}
              onClearZoneSeed={store.clearDiscoverZoneSeed}
              onSelectZone={store.setActiveZoneId}
              onToggleJoinZone={store.toggleJoinZone}
              onToggleFollowEntity={store.toggleFollowEntity}
              onCreatePost={store.createCommunityPost}
              onTogglePinPost={store.togglePinPost}
              onToggleLikePost={store.toggleLikePost}
              onAddPostComment={store.addPostComment}
              onPublishZoneProject={store.publishZoneProject}
              onClaimZoneProject={store.claimZoneProject}
              onStartNegotiation={(agentId) => store.startOrOpenNegotiation(agentId, true)}
              onJumpToZoneMarket={store.openMarketForZone}
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
