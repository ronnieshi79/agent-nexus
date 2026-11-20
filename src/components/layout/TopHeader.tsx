import { Bot, Menu, MessageSquareText, ShieldCheck } from 'lucide-react';
import type {
  ActiveChatChannel,
  ExpertAgent,
  NavViewId,
  ProjectWorkspace,
} from '../../types/agentnexus';

interface TopHeaderProps {
  activeView: NavViewId;
  activeChatChannel: ActiveChatChannel;
  workspace: ProjectWorkspace;
  agents: ExpertAgent[];
  unsettledCount: number;
  onOpenMobileMenu: () => void;
  onOpenAssistant: () => void;
  onBackToChat: () => void;
}

const VIEW_LABELS: Record<NavViewId, string> = {
  chat: '聊天会话',
  kanban: '工作看板',
  team: '我的团队',
  market: '专家市场',
};

export function TopHeader({
  activeView,
  activeChatChannel,
  workspace,
  agents,
  unsettledCount,
  onOpenMobileMenu,
  onOpenAssistant,
  onBackToChat,
}: TopHeaderProps) {
  let subLabel = workspace.name;
  if (activeView === 'chat') {
    if (activeChatChannel.type === 'assistant') {
      subLabel = 'Nexa 平台助理（结算 · 接单 · 审计）';
    } else if (activeChatChannel.type === 'dm') {
      const dmAgent = agents.find((a) => a.id === activeChatChannel.agentId);
      subLabel = dmAgent ? `私聊协商 · ${dmAgent.handle}` : '私聊协商';
    } else {
      subLabel = `项目群 · ${workspace.name}`;
    }
  }

  const isOnAssistant =
    activeView === 'chat' && activeChatChannel.type === 'assistant';

  return (
    <header className="h-14 shrink-0 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-6">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer shrink-0"
          aria-label="打开导航菜单"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-sm min-w-0 truncate">
          <span className="font-semibold text-slate-900 whitespace-nowrap">
            {VIEW_LABELS[activeView]}
          </span>
          <span className="text-slate-300" aria-hidden="true">/</span>
          <span className="text-slate-600 truncate">{subLabel}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-600 font-mono tabular-nums whitespace-nowrap">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>
            项目签约 ${workspace.spentUsd.toLocaleString('en-US')} / 预算 $
            {workspace.budgetCapUsd.toLocaleString('en-US')}
          </span>
        </div>

        {activeView === 'chat' ? (
          !isOnAssistant && (
            <button
              type="button"
              onClick={onOpenAssistant}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Bot className="w-3.5 h-3.5 text-blue-600" />
              <span>
                平台助理{unsettledCount > 0 ? ` (${unsettledCount} 待结)` : ''}
              </span>
            </button>
          )
        ) : (
          <button
            type="button"
            onClick={onBackToChat}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <MessageSquareText className="w-3.5 h-3.5" />
            <span>返回聊天</span>
          </button>
        )}
      </div>
    </header>
  );
}
