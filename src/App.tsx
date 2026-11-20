import { useState } from 'react';
import { X } from 'lucide-react';
import { AccountAuthModal } from './components/account/AccountPanel';
import { UnifiedChatView } from './components/chat/UnifiedChatView';
import { Sidebar } from './components/layout/Sidebar';
import { TopHeader } from './components/layout/TopHeader';
import { AgentMarketView } from './components/views/AgentMarketView';
import { MyTeamView } from './components/views/MyTeamView';
import { WorkflowKanbanView } from './components/views/WorkflowKanbanView';
import { useAgentNexusStore } from './hooks/useAgentNexusStore';

export default function App() {
  const store = useAgentNexusStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-slate-50 text-slate-900">
      <Sidebar
        activeView={store.activeView}
        activeChatChannel={store.activeChatChannel}
        workspaces={store.workspaces}
        agents={store.agents}
        allMessages={store.allMessages}
        allTasks={store.allTasks}
        negotiations={store.negotiations}
        assistantMessages={store.assistantMessages}
        assistantPendingCount={store.assistantPendingCount}
        reviewTaskCount={store.reviewTaskCount}
        hiredCount={store.hiredAgents.length}
        privateCount={store.privateAgents.length}
        marketCount={store.marketplaceAgents.length}
        account={store.account}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onSelectView={store.setActiveView}
        onOpenAssistant={store.openAssistantChat}
        onSelectProjectChat={store.selectSession}
        onSelectDmChat={(agentId) => store.startOrOpenNegotiation(agentId, true)}
        onCreateProject={(name, goal) => {
          store.createSession(name, goal);
          store.setActiveView('chat');
        }}
        onStartNegotiation={(agentId) => store.startOrOpenNegotiation(agentId, true)}
        onOpenLogin={() => store.setAuthModalOpen(true)}
        onLogout={store.logoutAccount}
      />

      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        <TopHeader
          activeView={store.activeView}
          activeChatChannel={store.activeChatChannel}
          workspace={store.activeWorkspace}
          agents={store.agents}
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
              workspaces={store.workspaces}
              activeWorkspace={store.activeWorkspace}
              agents={store.agents}
              hiredAgents={store.hiredAgents}
              privateAgents={store.privateAgents}
              sessionMessages={store.sessionMessages}
              sessionTasks={store.sessionTasks}
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
              workspaces={store.workspaces}
              projectSeed={store.kanbanProjectSeed}
              onClearProjectSeed={store.clearKanbanProjectSeed}
              allTasks={store.allTasks}
              agents={store.agents}
              negotiations={store.negotiations}
              settlements={store.settlements}
              executingTaskId={store.executingTaskId}
              onCreateProject={store.createSession}
              onRunTask={store.runAutonomousTask}
              onUpdateStatus={store.updateTaskStatus}
              onConfirmHire={store.confirmHireFromNegotiation}
              onJumpToMarket={() => store.setActiveView('market')}
              onReleaseAgent={store.releaseAgent}
            />
          )}

          {store.activeView === 'team' && (
            <MyTeamView
              workspace={store.activeWorkspace}
              hiredAgents={store.hiredAgents}
              privateAgents={store.privateAgents}
              hiredIds={store.hiredIds}
              tasks={store.sessionTasks}
              openMountDrawerSignal={store.openMountDrawerSignal}
              onHireAgent={store.hireAgent}
              onReleaseAgent={store.releaseAgent}
              onSavePrivateAgent={store.savePrivateAgent}
              onToggleMarketListing={store.toggleMarketListing}
              onRecruitCategory={store.jumpToMarketWithCategory}
              onJumpToMarket={() => store.setActiveView('market')}
            />
          )}

          {store.activeView === 'market' && (
            <AgentMarketView
              workspace={store.activeWorkspace}
              agents={store.marketplaceAgents}
              hiredIds={store.hiredIds}
              dmHistories={store.dmHistories}
              dmBusyAgentId={store.dmBusyAgentId}
              dmError={store.dmError}
              onClearDmError={store.clearDmError}
              onSendDm={store.sendDirectMessage}
              categorySeed={store.marketCategorySeed}
              onClearCategorySeed={store.clearMarketCategorySeed}
              onHire={store.hireAgent}
              onRelease={store.releaseAgent}
              onJumpToMountPrivate={store.jumpToMountPrivateAgent}
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
