import type { CreateWorkCardInput } from '../../hooks/useAgentNexusStore';
import type {
  ActiveChatChannel,
  AgentNexusAccount,
  AssistantMessage,
  ChatMessage,
  ExpertAgent,
  NegotiationThread,
  PlatformAuditLog,
  ProjectWorkspace,
  SettlementRecord,
  TaskSessionMessage,
  WorkflowTask,
} from '../../types/agentnexus';
import { GroupChatView } from '../views/GroupChatView';
import { DirectNegotiationPane } from './DirectNegotiationPane';
import { PlatformAssistantPane } from './PlatformAssistantPane';
import { TaskSessionPane } from './TaskSessionPane';

interface UnifiedChatViewProps {
  activeChannel: ActiveChatChannel;
  workspaces: ProjectWorkspace[];
  activeWorkspace: ProjectWorkspace;
  agents: ExpertAgent[];
  hiredAgents: ExpertAgent[];
  privateAgents: ExpertAgent[];
  allTasks: WorkflowTask[];
  sessionMessages: ChatMessage[];
  sessionTasks: WorkflowTask[];
  taskSessions: Record<string, TaskSessionMessage[]>;
  taskSessionBusyId: string | null;
  taskSessionError: string | null;
  negotiations: NegotiationThread[];
  assistantMessages: AssistantMessage[];
  settlements: SettlementRecord[];
  auditLogs: PlatformAuditLog[];
  account: AgentNexusAccount | null;
  isGroupBusy: boolean;
  isAssistantBusy: boolean;
  dmBusyAgentId: string | null;
  dmError: string | null;
  executingTaskId: string | null;
  draftSeed: string;
  onClearDraftSeed: () => void;
  onClearDmError: () => void;
  onClearTaskSessionError: () => void;
  onSelectProjectChat: (projectId: string) => void;
  onOpenTaskSession: (taskId: string) => void;
  onSendTaskSessionTurn: (taskId: string, text: string) => Promise<void>;
  onSyncTaskSummaryToGroup: (taskId: string) => void;
  onStartNegotiation: (agentId: string) => void;
  onSendGroupMessage: (text: string) => Promise<void>;
  onCreateWorkCard: (input: CreateWorkCardInput) => void;
  onRunTask: (taskId: string) => Promise<void>;
  onApproveTask: (taskId: string) => void;
  onSendDm: (agentId: string, text: string) => Promise<void>;
  onUpdateNegotiationTerms: (
    agentId: string,
    patch: Partial<
      Pick<
        NegotiationThread,
        'targetProjectId' | 'negotiatedPriceUsd' | 'scopeNote' | 'firstWorkCardTitle'
      >
    >,
  ) => void;
  onConfirmHire: (agentId: string, createFirstCard: boolean) => void;
  onSendAssistantMessage: (text: string) => Promise<void>;
  onSettleRecord: (settlementId: string) => void;
  onSettleAll: () => void;
  onJumpToMarket: () => void;
  onJumpToKanban: (projectId?: string) => void;
  onJumpToTeam: () => void;
}

export function UnifiedChatView({
  activeChannel,
  workspaces,
  activeWorkspace,
  agents,
  hiredAgents,
  privateAgents,
  allTasks,
  sessionMessages,
  sessionTasks,
  taskSessions,
  taskSessionBusyId,
  taskSessionError,
  negotiations,
  assistantMessages,
  settlements,
  auditLogs,
  account,
  isGroupBusy,
  isAssistantBusy,
  dmBusyAgentId,
  dmError,
  executingTaskId,
  draftSeed,
  onClearDraftSeed,
  onClearDmError,
  onClearTaskSessionError,
  onSelectProjectChat,
  onOpenTaskSession,
  onSendTaskSessionTurn,
  onSyncTaskSummaryToGroup,
  onStartNegotiation,
  onSendGroupMessage,
  onCreateWorkCard,
  onRunTask,
  onApproveTask,
  onSendDm,
  onUpdateNegotiationTerms,
  onConfirmHire,
  onSendAssistantMessage,
  onSettleRecord,
  onSettleAll,
  onJumpToMarket,
  onJumpToKanban,
  onJumpToTeam,
}: UnifiedChatViewProps) {
  const activeDmThread =
    activeChannel.type === 'dm'
      ? negotiations.find((n) => n.agentId === activeChannel.agentId) || negotiations[0] || null
      : null;
  const activeDmAgent = activeDmThread
    ? agents.find((a) => a.id === activeDmThread.agentId) || null
    : null;

  const activeTask =
    activeChannel.type === 'task_session'
      ? allTasks.find((t) => t.id === activeChannel.taskId) || allTasks[0] || null
      : null;
  const activeTaskWorkspace = activeTask
    ? workspaces.find((w) => w.id === activeTask.sessionId) || activeWorkspace
    : activeWorkspace;
  const activeTaskAgent = activeTask
    ? agents.find((a) => a.id === activeTask.assigneeId) || null
    : null;
  const activeTaskSiblings = activeTask
    ? allTasks.filter((t) => t.sessionId === activeTask.sessionId)
    : [];

  return (
    <div className="h-full w-full overflow-hidden bg-white">
      {activeChannel.type === 'group' && (
        <GroupChatView
          workspace={activeWorkspace}
          hiredAgents={hiredAgents}
          messages={sessionMessages}
          tasks={sessionTasks}
          taskSessions={taskSessions}
          account={account}
          isBusy={isGroupBusy}
          executingTaskId={executingTaskId}
          draftSeed={draftSeed}
          onClearDraftSeed={onClearDraftSeed}
          onSendMessage={onSendGroupMessage}
          onCreateWorkCard={onCreateWorkCard}
          onRunTask={onRunTask}
          onApproveTask={onApproveTask}
          onOpenTaskSession={onOpenTaskSession}
          onJumpToMarket={onJumpToMarket}
          onJumpToKanban={() => onJumpToKanban(activeWorkspace.id)}
          onJumpToTeam={onJumpToTeam}
        />
      )}

      {activeChannel.type === 'task_session' && activeTask && (
        <TaskSessionPane
          task={activeTask}
          workspace={activeTaskWorkspace}
          agent={activeTaskAgent}
          agents={agents}
          siblingTasks={activeTaskSiblings}
          messages={taskSessions[activeTask.id] || []}
          allTaskSessions={taskSessions}
          account={account}
          isBusy={taskSessionBusyId === activeTask.id}
          isExecuting={executingTaskId === activeTask.id}
          error={taskSessionError}
          onClearError={onClearTaskSessionError}
          onSendTurn={onSendTaskSessionTurn}
          onRunTask={onRunTask}
          onApproveTask={onApproveTask}
          onSyncSummaryToGroup={onSyncTaskSummaryToGroup}
          onBackToGroup={onSelectProjectChat}
          onSelectTaskSession={onOpenTaskSession}
        />
      )}

      {activeChannel.type === 'dm' && activeDmAgent && activeDmThread && (
        <DirectNegotiationPane
          agent={activeDmAgent}
          thread={activeDmThread}
          workspaces={workspaces}
          account={account}
          isBusy={dmBusyAgentId === activeDmAgent.id}
          error={dmError}
          onClearError={onClearDmError}
          onSendMessage={onSendDm}
          onUpdateTerms={onUpdateNegotiationTerms}
          onConfirmHire={onConfirmHire}
        />
      )}

      {activeChannel.type === 'assistant' && (
        <PlatformAssistantPane
          messages={assistantMessages}
          settlements={settlements}
          auditLogs={auditLogs}
          agents={agents}
          privateAgents={privateAgents}
          account={account}
          isBusy={isAssistantBusy}
          onSendMessage={onSendAssistantMessage}
          onSettleRecord={onSettleRecord}
          onSettleAll={onSettleAll}
          onOpenDm={(agentId) => onStartNegotiation(agentId)}
          onOpenKanban={onJumpToKanban}
          onOpenTeam={onJumpToTeam}
        />
      )}
    </div>
  );
}
