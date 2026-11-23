import { Compass, Menu, PanelLeftOpen } from 'lucide-react';
import { INITIAL_MARKET_SKILLS } from '../../data/initialData';
import { formatAgentDisplayName, formatShortModel } from '../shared/EntityIdentity';
import { WORKSPACE_GUTTER_CLASS } from '../shared/ViewToolbar';
import { ZoneSelectorDropdown } from '../shared/ZoneSelectorDropdown';
import type {
  ActiveChatChannel,
  CommunityPost,
  CommunityZone,
  ExpertAgent,
  NavViewId,
  ProjectWorkspace,
  WorkflowTask,
  ZoneProjectOpportunity,
} from '../../types/agentnexus';

interface TopHeaderProps {
  zones: CommunityZone[];
  activeZone: CommunityZone;
  joinedZoneIds: string[];
  activeView: NavViewId;
  activeChatChannel: ActiveChatChannel;
  workspace: ProjectWorkspace;
  agents: ExpertAgent[];
  allTasks: WorkflowTask[];
  communityPosts: CommunityPost[];
  zoneProjects: ZoneProjectOpportunity[];
  sidebarCollapsed?: boolean;
  onToggleSidebarCollapse?: () => void;
  onOpenMobileMenu: () => void;
  onSelectZone: (zoneId: string) => void;
  onToggleJoinZone: (zoneId: string) => void;
  onManageCollabSpaces: () => void;
}

const VIEW_DESCRIPTIONS: Record<'kanban' | 'team', string> = {
  kanban: '工作项目协作编排、协作空间管理，以及 Agent 空间节点、存储与并发沙箱配置',
  team: 'Agent 成员、合作专家与我的好友',
};

export function TopHeader({
  zones,
  activeZone,
  joinedZoneIds,
  activeView,
  activeChatChannel,
  workspace,
  agents,
  allTasks,
  communityPosts,
  zoneProjects,
  sidebarCollapsed = false,
  onToggleSidebarCollapse,
  onOpenMobileMenu,
  onSelectZone,
  onManageCollabSpaces,
}: TopHeaderProps) {
  const isCommunityScopedView = activeView === 'discover' || activeView === 'market';
  const joinedZones = zones.filter((z) => z.isPlatformDefault || joinedZoneIds.includes(z.id));

  let primaryLabel: string;
  let subLabel = '';

  if (activeView === 'chat') {
    if (activeChatChannel.type === 'task_session') {
      const task = allTasks.find((t) => t.id === activeChatChannel.taskId);
      const taskAgent = task ? agents.find((a) => a.id === task.assigneeId) : undefined;
      primaryLabel = 'Agent 任务';
      subLabel = task
        ? `${formatAgentDisplayName(task.assigneeHandle, taskAgent?.runtimeAgent)}${taskAgent ? ` (${formatShortModel(taskAgent.defaultModel)})` : ''} · #${task.id} · ${task.title}`
        : 'Agent 任务执行 Session';
    } else if (activeChatChannel.type === 'dm') {
      const dmAgent = agents.find((a) => a.id === activeChatChannel.agentId);
      primaryLabel = '单聊 · 专家协商';
      subLabel = dmAgent
        ? `${formatAgentDisplayName(dmAgent.handle, dmAgent.runtimeAgent)} (${formatShortModel(dmAgent.defaultModel)})${dmAgent.ownerHumanName ? ` · 归属专家 ${dmAgent.ownerHumanName}` : ''}`
        : '1v1 专家私聊与报价协商';
    } else if (activeChatChannel.type === 'assistant') {
      primaryLabel = 'Nexa 助理';
      subLabel = '日常结算核销、审核评价与接单提醒';
    } else {
      primaryLabel = '项目群';
      subLabel = workspace.name;
    }
  } else if (activeView === 'market') {
    primaryLabel = '服务市场';
  } else if (activeView === 'discover') {
    primaryLabel = '交流社区';
  } else {
    const labelMap: Record<'kanban' | 'team', string> = {
      kanban: '工作空间',
      team: 'AGN 团队',
    };
    primaryLabel = labelMap[activeView];
    subLabel = VIEW_DESCRIPTIONS[activeView];
  }

  return (
    <header
      className={`h-14 shrink-0 bg-white border-b border-slate-200 ${WORKSPACE_GUTTER_CLASS} flex items-center justify-between gap-3 relative z-30`}
    >
      {/* Left: Contextual Breadcrumb & Top-Level Community Switcher */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer shrink-0"
          aria-label="打开导航菜单"
        >
          <Menu className="w-5 h-5" />
        </button>

        {sidebarCollapsed && onToggleSidebarCollapse && (
          <button
            type="button"
            onClick={onToggleSidebarCollapse}
            title="展开左侧栏"
            aria-label="展开左侧栏"
            className="hidden lg:inline-flex items-center justify-center p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        )}

        {isCommunityScopedView ? (
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
            <span className="text-sm font-bold text-slate-900 whitespace-nowrap shrink-0">
              {primaryLabel}
            </span>
            <span className="text-slate-300 shrink-0" aria-hidden="true">/</span>
            <ZoneSelectorDropdown
              variant="header"
              zones={joinedZones}
              activeZoneId={activeZone.id}
              onSelectZone={onSelectZone}
              onManageSpaces={onManageCollabSpaces}
              getZoneStat={(z) => {
                if (activeView === 'market') {
                  const suspended = new Set(z.suspendedAgentIds || []);
                  const agentCount = agents.filter(
                    (a) => a.listedZoneIds.includes(z.id) && !suspended.has(a.id),
                  ).length;
                  const skillCount = INITIAL_MARKET_SKILLS.filter((s) =>
                    s.zoneIds.includes(z.id),
                  ).length;
                  return `${agentCount} Agent · ${skillCount} Skills`;
                }
                const postCnt = communityPosts.filter((p) => p.zoneId === z.id).length;
                const openProjCnt = zoneProjects.filter(
                  (p) => p.zoneId === z.id && p.status === 'open',
                ).length;
                return `${postCnt} 帖子 · ${openProjCnt} 社区项目 · 主理 ${z.principalName}`;
              }}
            />
            <span className="hidden md:inline text-slate-300 shrink-0" aria-hidden="true">·</span>
            <span
              title={activeZone.tagline}
              className="hidden md:block text-xs text-slate-500 truncate min-w-0"
            >
              {activeZone.tagline}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 min-w-0 truncate">
            <span className="text-sm font-bold text-slate-900 whitespace-nowrap shrink-0">
              {primaryLabel}
            </span>
            <span className="text-slate-300 shrink-0" aria-hidden="true">/</span>
            <span className="text-xs sm:text-sm text-slate-500 truncate">{subLabel}</span>
          </div>
        )}
      </div>

      {/* Right: Direct Collaboration Spaces Management Entry in Market & Community */}
      {isCommunityScopedView && (
        <button
          type="button"
          onClick={onManageCollabSpaces}
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Compass className="w-3.5 h-3.5 text-blue-600" />
          <span>协作空间 ({joinedZones.length})</span>
        </button>
      )}
    </header>
  );
}
