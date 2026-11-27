import type { CreateWorkCardInput } from '../../hooks/useAgentNexusStore';
import type {
  ActiveChatChannel,
  AgentNexusAccount,
  AssistantMessage,
  ChatMessage,
  CommunityZone,
  ExpertAgent,
  HumanDirectThread,
  HumanExpert,
  NegotiationThread,
  PlatformAuditLog,
  ProjectAgentAssignment,
  ProjectStageSlot,
  ProjectWorkspace,
  SettlementRecord,
  SpaceJoinApplication,
  TaskSessionMessage,
  TaskStatus,
  WorkCardType,
  WorkflowTask,
} from '../../types/agentnexus';
import { GroupChatView } from '../views/GroupChatView';
import { DirectNegotiationPane } from './DirectNegotiationPane';
import { HumanDirectChatPane } from './HumanDirectChatPane';
import { NewSessionLauncherPane } from './NewSessionLauncherPane';
import { PlatformAssistantPane } from './PlatformAssistantPane';
import { TaskSessionPane } from './TaskSessionPane';

interface UnifiedChatViewProps {
  activeChannel: ActiveChatChannel;
  zones: CommunityZone[];
  workspaces: ProjectWorkspace[];
  activeWorkspace: ProjectWorkspace;
  projectPipelines: Record<string, ProjectStageSlot[]>;
  projectAgentAssignments: Record<string, ProjectAgentAssignment[]>;
  agents: ExpertAgent[];
  humanExperts: HumanExpert[];
  hiredAgents: ExpertAgent[];
  privateAgents: ExpertAgent[];
  allTasks: WorkflowTask[];
  sessionMessages: ChatMessage[];
  sessionTasks: WorkflowTask[];
  taskSessions: Record<string, TaskSessionMessage[]>;
  taskSessionBusyId: string | null;
  taskSessionError: string | null;
  negotiations: NegotiationThread[];
  humanDmThreads: HumanDirectThread[];
  assistantMessages: AssistantMessage[];
  settlements: SettlementRecord[];
  spaceApplications: SpaceJoinApplication[];
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
  onOpenAgentTaskSession: (agentId: string) => void;
  onCreateAndOpenTaskSession: (input: CreateWorkCardInput) => void;
  onSendTaskSessionTurn: (taskId: string, text: string, targetAgentId?: string) => Promise<void>;
  onSyncTaskSummaryToGroup: (taskId: string) => void;
  onStartNegotiation: (agentId: string) => void;
  onSendHumanDm: (expertId: string, text: string, linkedTaskId?: string) => void;
  onSendGroupMessage: (text: string) => Promise<void>;
  onCreateWorkCard: (input: CreateWorkCardInput) => void;
  onRunTask: (taskId: string) => Promise<void>;
  onApproveTask: (taskId: string) => void;
  onUpdateTaskStatus: (taskId: string, status: TaskStatus) => void;
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
  onResolveSpaceApplication: (applicationId: string, decision: 'approved' | 'rejected') => void;
  onJumpToMarket: () => void;
  onJumpToCommunity?: () => void;
  onJumpToKanban: (projectId?: string) => void;
  onJumpToTeam: () => void;
  onJumpToMountPrivate: () => void;
  onCreateProjectForLauncher: (name: string, goal: string, sourceZoneId?: string) => string;
  onLaunchNewTaskSession: (input: {
    sessionId: string;
    assigneeId: string;
    workType: WorkCardType;
    prompt: string;
    featureModule?: string;
    syncToGroup?: boolean;
  }) => Promise<void>;
  onReactivateProject?: (projectId: string) => void;
}

export function UnifiedChatView({
  activeChannel,
  zones,
  workspaces,
  activeWorkspace,
  projectPipelines,
  projectAgentAssignments,
  agents,
  humanExperts,
  hiredAgents,
  privateAgents,
  allTasks,
  sessionMessages,
  sessionTasks,
  taskSessions,
  taskSessionBusyId,
  taskSessionError,
  negotiations,
  humanDmThreads,
  assistantMessages,
  settlements,
  spaceApplications,
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
  onOpenAgentTaskSession,
  onCreateAndOpenTaskSession,
  onSendTaskSessionTurn,
  onSyncTaskSummaryToGroup,
  onStartNegotiation,
  onSendHumanDm,
  onSendGroupMessage,
  onCreateWorkCard,
  onRunTask,
  onApproveTask,
  onUpdateTaskStatus,
  onSendDm,
  onUpdateNegotiationTerms,
  onConfirmHire,
  onSendAssistantMessage,
  onSettleRecord,
  onSettleAll,
  onResolveSpaceApplication,
  onJumpToMarket,
  onJumpToCommunity,
  onJumpToKanban,
  onJumpToTeam,
  onJumpToMountPrivate,
  onCreateProjectForLauncher,
  onLaunchNewTaskSession,
  onReactivateProject,
}: UnifiedChatViewProps) {
  const activeDmThread =
    activeChannel.type === 'dm'
      ? negotiations.find((n) => n.agentId === activeChannel.agentId) || negotiations[0] || null
      : null;
  const activeDmAgent = activeDmThread
    ? agents.find((a) => a.id === activeDmThread.agentId) || null
    : null;
  const activeDmAgentTasks = activeDmAgent
    ? allTasks.filter((t) => t.assigneeId === activeDmAgent.id)
    : [];

  const activeHumanExpert =
    activeChannel.type === 'human_dm'
      ? humanExperts.find((h) => h.id === activeChannel.expertId) || null
      : null;
  const activeHumanThread: HumanDirectThread | null =
    activeChannel.type === 'human_dm' && activeHumanExpert
      ? humanDmThreads.find((t) => t.expertId === activeHumanExpert.id) || {
          expertId: activeHumanExpert.id,
          updatedAt: '刚刚',
          messages: [],
        }
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
      {activeChannel.type === 'new_session' && (
        <NewSessionLauncherPane
          workspaces={workspaces}
          activeWorkspace={activeWorkspace}
          projectPipelines={projectPipelines}
          zones={zones}
          agents={agents}
          onLaunchTaskSession={onLaunchNewTaskSession}
          onCreateProjectForLauncher={onCreateProjectForLauncher}
          onJumpToMountPrivate={onJumpToMountPrivate}
          onJumpToMarket={onJumpToMarket}
          onJumpToCommunity={onJumpToCommunity}
        />
      )}

      {activeChannel.type === 'group' && (
        <GroupChatView
          workspace={activeWorkspace}
          linkedZone={
            activeWorkspace.sourceZoneId
              ? zones.find((z) => z.id === activeWorkspace.sourceZoneId)
              : undefined
          }
          hiredAgents={hiredAgents}
          allAgents={agents}
          assignments={projectAgentAssignments[activeWorkspace.id] || []}
          pipelineSlots={projectPipelines[activeWorkspace.id] || []}
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
          onUpdateTaskStatus={onUpdateTaskStatus}
          onOpenTaskSession={onOpenTaskSession}
          onJumpToMarket={onJumpToMarket}
          onJumpToKanban={() => onJumpToKanban(activeWorkspace.id)}
          onJumpToTeam={onJumpToTeam}
          onReactivateProject={onReactivateProject}
        />
      )}

      {activeChannel.type === 'task_session' && activeTask && (
        <TaskSessionPane
          task={activeTask}
          workspace={activeTaskWorkspace}
          workspaces={workspaces}
          agent={activeTaskAgent}
          agents={agents}
          assignments={projectAgentAssignments[activeTaskWorkspace.id] || []}
          pipelineSlots={projectPipelines[activeTaskWorkspace.id] || []}
          allTasks={allTasks}
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
          onUpdateTaskStatus={onUpdateTaskStatus}
          onSyncSummaryToGroup={onSyncTaskSummaryToGroup}
          onBackToGroup={onSelectProjectChat}
          onSelectTaskSession={onOpenTaskSession}
          onCreateAndOpenTaskSession={onCreateAndOpenTaskSession}
          onReactivateProject={onReactivateProject}
        />
      )}

      {activeChannel.type === 'dm' && activeDmAgent && activeDmThread && (
        <DirectNegotiationPane
          agent={activeDmAgent}
          thread={activeDmThread}
          workspaces={workspaces}
          agentTasks={activeDmAgentTasks}
          account={account}
          isBusy={dmBusyAgentId === activeDmAgent.id}
          error={dmError}
          onClearError={onClearDmError}
          onSendMessage={onSendDm}
          onUpdateTerms={onUpdateNegotiationTerms}
          onConfirmHire={onConfirmHire}
          onOpenTaskSession={onOpenTaskSession}
        />
      )}

      {activeChannel.type === 'human_dm' && activeHumanExpert && activeHumanThread && (
        <HumanDirectChatPane
          expert={activeHumanExpert}
          thread={activeHumanThread}
          agents={agents}
          workspaces={workspaces}
          allTasks={allTasks}
          taskSessions={taskSessions}
          account={account}
          onSendMessage={onSendHumanDm}
          onOpenTaskSession={onOpenTaskSession}
          onOpenAgentTaskSession={onOpenAgentTaskSession}
          onSelectProjectChat={onSelectProjectChat}
        />
      )}

      {activeChannel.type === 'assistant' && (
        <PlatformAssistantPane
          messages={assistantMessages}
          settlements={settlements}
          spaceApplications={spaceApplications}
          auditLogs={auditLogs}
          agents={agents}
          privateAgents={privateAgents}
          account={account}
          isBusy={isAssistantBusy}
          onSendMessage={onSendAssistantMessage}
          onSettleRecord={onSettleRecord}
          onSettleAll={onSettleAll}
          onResolveSpaceApplication={onResolveSpaceApplication}
          onOpenDm={(agentId) => onStartNegotiation(agentId)}
          onOpenKanban={onJumpToKanban}
          onOpenTeam={onJumpToTeam}
        />
      )}
    </div>
  );
}
