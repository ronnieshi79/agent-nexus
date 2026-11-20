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
  WorkflowTask,
} from '../../types/agentnexus';
import { GroupChatView } from '../views/GroupChatView';
import { DirectNegotiationPane } from './DirectNegotiationPane';
import { PlatformAssistantPane } from './PlatformAssistantPane';

interface UnifiedChatViewProps {
  activeChannel: ActiveChatChannel;
  workspaces: ProjectWorkspace[];
  activeWorkspace: ProjectWorkspace;
  agents: ExpertAgent[];
  hiredAgents: ExpertAgent[];
  privateAgents: ExpertAgent[];
  sessionMessages: ChatMessage[];
  sessionTasks: WorkflowTask[];
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
  onSelectProject: (projectId: string) => void;
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
  sessionMessages,
  sessionTasks,
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
  onSelectProject,
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

  return (
    <div className="h-full w-full overflow-hidden bg-white">
      {activeChannel.type === 'assistant' && (
        <PlatformAssistantPane
          messages={assistantMessages}
          settlements={settlements}
          auditLogs={auditLogs}
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

      {activeChannel.type === 'group' && (
        <GroupChatView
          workspace={activeWorkspace}
          hiredAgents={hiredAgents}
          messages={sessionMessages}
          tasks={sessionTasks}
          account={account}
          isBusy={isGroupBusy}
          executingTaskId={executingTaskId}
          draftSeed={draftSeed}
          onClearDraftSeed={onClearDraftSeed}
          onSendMessage={onSendGroupMessage}
          onCreateWorkCard={onCreateWorkCard}
          onRunTask={onRunTask}
          onApproveTask={onApproveTask}
          onJumpToMarket={onJumpToMarket}
          onJumpToKanban={() => onJumpToKanban(activeWorkspace.id)}
          onJumpToTeam={onJumpToTeam}
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
          onJumpToProjectGroup={onSelectProject}
        />
      )}
    </div>
  );
}
