import { AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { AirobotCompanion } from './components/airobot/AirobotCompanion';
import { ContextBrainBar } from './components/brain/ContextBrainBar';
import { AgentMarketCard } from './components/cards/AgentMarketCard';
import { ExpertStudioCard } from './components/cards/ExpertStudioCard';
import { TeamChatCard } from './components/cards/TeamChatCard';
import { WorkflowKanbanCard } from './components/cards/WorkflowKanbanCard';
import { useAgentNexusStore } from './hooks/useAgentNexusStore';

export default function App() {
  const store = useAgentNexusStore();
  const reviewTaskCount = store.tasks.filter((t) => t.status === 'review').length;

  const handleAcceptRecommendation = () => {
    const nextCard = store.recommendation.recommendedCard;
    store.setActiveCard(nextCard);
    if (nextCard === 'expert') {
      store.switchPerspective('expert');
    } else if (store.perspective !== 'employer') {
      store.switchPerspective('employer');
      store.setActiveCard(nextCard);
    }
  };

  return (
    <div className="studio-canvas min-h-screen w-full flex flex-col justify-between px-4 sm:px-6 lg:px-10 py-5 sm:py-6">
      {/* Ultra-minimal menu-free top bar: Brand wordmark + Dual-sided role switch */}
      <header className="w-full max-w-6xl mx-auto flex items-center justify-between gap-6 pb-4">
        <span className="font-display text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          AgentNexus
        </span>

        <div
          role="group"
          aria-label="切换雇主端或专家端视角"
          className="skeuo-well inline-flex items-center gap-1 p-1 rounded-xl shrink-0"
        >
          <button
            type="button"
            onClick={() => store.switchPerspective('employer')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              store.perspective === 'employer'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            雇主指挥端
          </button>
          <button
            type="button"
            onClick={() => store.switchPerspective('expert')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              store.perspective === 'expert'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            专家接单端
          </button>
        </div>
      </header>

      {/* Main Centered Agentic Stage */}
      <main className="w-full max-w-6xl mx-auto flex-1 flex flex-col items-center justify-center gap-5 py-1">
        {/* Borderless Skeuomorphic Cartoon Airobot + Context Brain Whisper */}
        <div className="w-full flex justify-center">
          <AirobotCompanion
            state={store.airobotState}
            recommendation={store.recommendation}
            activeCard={store.activeCard}
            isBusy={store.isAiBusy || Boolean(store.executingTaskId)}
            onTriggerSense={() => store.askContextBrain()}
            onAcceptRecommendation={handleAcceptRecommendation}
          />
        </div>

        {/* Real API Error Notice */}
        {store.aiError && (
          <div className="w-full max-w-4xl px-4 py-3 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center justify-between gap-3">
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

        {/* Centered Single-Responsibility Pop-Up Skeuomorphic Service Card */}
        <div className="w-full">
          <AnimatePresence mode="wait">
            {store.activeCard === 'market' && (
              <AgentMarketCard
                key="market"
                agents={store.agents}
                hiredIds={store.hiredIds}
                requirementSeed={store.marketRequirementSeed}
                onClearRequirementSeed={store.clearMarketRequirementSeed}
                onHire={store.hireAgent}
                onRelease={store.releaseAgent}
                onJumpToChat={() => store.setActiveCard('chat')}
              />
            )}

            {store.activeCard === 'chat' && (
              <TeamChatCard
                key="chat"
                workspace={store.workspace}
                hiredAgents={store.hiredAgents}
                messages={store.messages}
                tasks={store.tasks}
                isBusy={store.isAiBusy}
                executingTaskId={store.executingTaskId}
                draftSeed={store.chatDraftSeed}
                onClearDraftSeed={store.clearChatDraftSeed}
                onSendMessage={store.sendGroupMessage}
                onRunTask={store.runAutonomousTask}
                onApproveTask={(id) => store.updateTaskStatus(id, 'done')}
                onJumpToMarket={() => store.setActiveCard('market')}
                onJumpToKanban={() => store.setActiveCard('kanban')}
              />
            )}

            {store.activeCard === 'kanban' && (
              <WorkflowKanbanCard
                key="kanban"
                workspace={store.workspace}
                tasks={store.tasks}
                agents={store.agents}
                executingTaskId={store.executingTaskId}
                onRunTask={store.runAutonomousTask}
                onUpdateStatus={store.updateTaskStatus}
                onJumpToChat={() => store.setActiveCard('chat')}
              />
            )}

            {store.activeCard === 'expert' && (
              <ExpertStudioCard
                key="expert"
                agents={store.agents}
                onSaveExpert={store.saveOrPublishExpert}
                onJumpToMarket={() => {
                  store.switchPerspective('employer');
                  store.setActiveCard('market');
                }}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Bottom Context-Aware AI Brain Command Capsule + Tactile Card Deck */}
        <div className="w-full pt-1">
          <ContextBrainBar
            activeCard={store.activeCard}
            perspective={store.perspective}
            recommendedCard={store.recommendation.recommendedCard}
            marketCount={store.agents.length}
            hiredCount={store.hiredAgents.length}
            reviewTaskCount={reviewTaskCount}
            totalTaskCount={store.tasks.length}
            isBusy={store.isAiBusy}
            onSelectCard={(card) => {
              store.setActiveCard(card);
              if (card === 'expert') {
                store.switchPerspective('expert');
              } else if (store.perspective === 'expert') {
                store.switchPerspective('employer');
                store.setActiveCard(card);
              }
            }}
            onSubmitIntent={(intent) => store.askContextBrain(intent)}
          />
        </div>
      </main>
    </div>
  );
}
