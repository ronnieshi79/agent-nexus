import { Menu, ShieldCheck } from 'lucide-react';
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
  onOpenMobileMenu: () => void;
}

const VIEW_LABELS: Record<NavViewId, string> = {
  chat: '聊天会话',
  kanban: '工作看板',
  team: '我的团队',
  market: '专家市场',
};

const VIEW_DESCRIPTIONS: Record<Exclude<NavViewId, 'chat'>, string> = {
  kanban: '统筹多项目概览、工作卡片任务流状态流转与专家雇佣协同',
  team: '永久在线，按需持续交付的外部 / 内部 Agent 专家团队',
  market: '按能力、信誉、稀缺度与供需项目制签约，支持先 1v1 私聊再拉入项目群',
};

export function TopHeader({
  activeView,
  activeChatChannel,
  workspace,
  agents,
  onOpenMobileMenu,
}: TopHeaderProps) {
  let subLabel: string;
  if (activeView === 'chat') {
    if (activeChatChannel.type === 'assistant') {
      subLabel = 'Nexa 平台助理';
    } else if (activeChatChannel.type === 'dm') {
      const dmAgent = agents.find((a) => a.id === activeChatChannel.agentId);
      subLabel = dmAgent ? `私聊协商 · ${dmAgent.handle}` : '私聊协商';
    } else {
      subLabel = `项目群 · ${workspace.name}`;
    }
  } else {
    subLabel = VIEW_DESCRIPTIONS[activeView];
  }

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

        <div className="flex items-center gap-2.5 min-w-0 truncate">
          <span className="text-sm font-bold text-slate-900 whitespace-nowrap shrink-0">
            {VIEW_LABELS[activeView]}
          </span>
          <span className="text-slate-300 shrink-0" aria-hidden="true">/</span>
          <span className="text-xs sm:text-sm text-slate-500 truncate">{subLabel}</span>
        </div>
      </div>

      <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-600 font-mono tabular-nums whitespace-nowrap shrink-0">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
        <span>
          项目签约 ${workspace.spentUsd.toLocaleString('en-US')} / 预算 $
          {workspace.budgetCapUsd.toLocaleString('en-US')}
        </span>
      </div>
    </header>
  );
}
