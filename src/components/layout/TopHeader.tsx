import { Menu, ShieldCheck } from 'lucide-react';
import { displayEntityName } from '../shared/EntityIdentity';
import type {
  ActiveChatChannel,
  CommunityZone,
  ExpertAgent,
  NavViewId,
  ProjectWorkspace,
  WorkflowTask,
} from '../../types/agentnexus';

interface TopHeaderProps {
  activeZone: CommunityZone;
  activeView: NavViewId;
  activeChatChannel: ActiveChatChannel;
  workspace: ProjectWorkspace;
  agents: ExpertAgent[];
  allTasks: WorkflowTask[];
  onOpenMobileMenu: () => void;
}

const VIEW_DESCRIPTIONS: Record<'kanban' | 'team' | 'discover', string> = {
  kanban: '统筹我主管与参与的项目概览、多项目任务流看板与专家雇佣协同',
  team: '永久在线，按需持续交付的外部 / 内部 Agent 专家团队',
  discover: '公共社区与私有社区信息流交流、实战复盘分享与项目撮合对接',
};

export function TopHeader({
  activeZone,
  activeView,
  activeChatChannel,
  workspace,
  agents,
  allTasks,
  onOpenMobileMenu,
}: TopHeaderProps) {
  let primaryLabel: string;
  let subLabel: string;

  if (activeView === 'chat') {
    if (activeChatChannel.type === 'task_session') {
      const task = allTasks.find((t) => t.id === activeChatChannel.taskId);
      primaryLabel = 'Agent 任务';
      subLabel = task
        ? `${displayEntityName(task.assigneeHandle)} · Session #${task.id} · ${task.title}`
        : 'Agent 任务执行 Session';
    } else if (activeChatChannel.type === 'dm') {
      const dmAgent = agents.find((a) => a.id === activeChatChannel.agentId);
      primaryLabel = '单聊 · 专家协商';
      subLabel = dmAgent
        ? `${displayEntityName(dmAgent.handle)}${dmAgent.ownerHumanName ? `（主理人 ${dmAgent.ownerHumanName}）` : ''} · ${dmAgent.name}`
        : '1v1 专家私聊与报价协商';
    } else if (activeChatChannel.type === 'assistant') {
      primaryLabel = 'Nexa 助理';
      subLabel = '日常结算核销、审核评价与接单提醒';
    } else {
      primaryLabel = '项目群';
      subLabel = workspace.name;
    }
  } else if (activeView === 'market') {
    primaryLabel = '专家市场';
    subLabel = `${activeZone.name} · ${activeZone.tagline}`;
  } else {
    const labelMap: Record<'kanban' | 'team' | 'discover', string> = {
      kanban: '工作看板',
      team: '我的团队',
      discover: '社区发现',
    };
    primaryLabel = labelMap[activeView];
    subLabel = VIEW_DESCRIPTIONS[activeView];
  }

  return (
    <header className="h-14 shrink-0 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4">
      {/* Left: Contextual Breadcrumb */}
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
            {primaryLabel}
          </span>
          <span className="text-slate-300 shrink-0" aria-hidden="true">/</span>
          <span className="text-xs sm:text-sm text-slate-500 truncate">{subLabel}</span>
        </div>
      </div>

      {/* Right: Project Budget Readout */}
      <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-600 font-mono tabular-nums whitespace-nowrap shrink-0">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
        <span>
          项目签约 ${workspace.spentUsd.toLocaleString('en-US')} / 预算 $
          {workspace.budgetCapUsd.toLocaleString('en-US')}
        </span>
      </div>
    </header>
  );
}
