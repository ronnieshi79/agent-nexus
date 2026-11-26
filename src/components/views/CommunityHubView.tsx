import { useMemo } from 'react';
import { Blocks, Briefcase, Cpu, Flame, Pin, Rocket, UserCheck } from 'lucide-react';
import type {
  AgentCategory,
  AgentLeaseRecord,
  AgentSliceFirewallPolicy,
  CommunityHubTab,
  CommunityPost,
  CommunityPostType,
  CommunityZone,
  DirectMessage,
  ExpertAgent,
  ExpertRelationType,
  HumanExpert,
  LeasePeriod,
  MarketSkill,
  ProjectWorkspace,
  SkillKind,
  TeamExpertMembership,
  ZoneProjectOpportunity,
} from '../../types/agentnexus';
import { displayEntityName } from '../shared/EntityIdentity';
import {
  RailNavButton,
  RailSectionLabel,
  WorkspacePrimaryRail,
} from '../shared/ViewToolbar';
import { AgentMarketView, type MarketEntityTab } from './AgentMarketView';
import { CommunityDiscoverView, type SocialFeedScope } from './CommunityDiscoverView';

interface CommunityHubViewProps {
  activeTab: CommunityHubTab;
  onChangeTab: (tab: CommunityHubTab) => void;
  zones: CommunityZone[];
  activeZone: CommunityZone;
  joinedZoneIds: string[];
  workspace: ProjectWorkspace;
  workspaces: ProjectWorkspace[];
  allAgents: ExpertAgent[];
  marketplaceAgents: ExpertAgent[];
  privateAgents: ExpertAgent[];
  humanExperts: HumanExpert[];
  marketSkills: MarketSkill[];
  agentLeases: Record<string, AgentLeaseRecord>;
  purchasedSkillIds: string[];
  teamExperts: TeamExpertMembership[];
  hiredIds: string[];
  dmHistories: Record<string, DirectMessage[]>;
  dmBusyAgentId: string | null;
  dmError: string | null;
  categorySeed: 'all' | AgentCategory;
  zoneProjects: ZoneProjectOpportunity[];
  communityPosts: CommunityPost[];
  followedEntityKeys: string[];
  zoneSeed: string | null;
  onSelectZone: (zoneId: string) => void;
  onClearDmError: () => void;
  onSendDm: (agentId: string, text: string) => Promise<void>;
  onStartNegotiation: (agentId: string) => void;
  onLeaseAgent: (
    agentId: string,
    period: LeasePeriod,
    targetWorkspaceId?: string,
    firewallPolicy?: Partial<AgentSliceFirewallPolicy>,
  ) => void;
  onAcquireSkill: (
    skillId: string,
    skillName?: string,
    priceUsd?: number,
    sourceZoneId?: string,
  ) => void;
  onInviteTeamExpert: (input: {
    expertId: string;
    relation: ExpertRelationType;
    targetWorkspaceId?: string;
    sourceZoneId?: string;
    outsourcingScope?: string;
  }) => void;
  onSavePrivateAgent: (expert: ExpertAgent, isNew: boolean) => void;
  onClearCategorySeed: () => void;
  onHire: (agentId: string) => void;
  onRelease: (agentId: string) => void;
  onJumpToMountPrivate: () => void;
  onClearZoneSeed: () => void;
  onToggleJoinZone: (zoneId: string) => void;
  onToggleFollowEntity: (entityKey: string) => void;
  onCreatePost: (input: {
    zoneId: string;
    type: Exclude<CommunityPostType, 'project'>;
    title: string;
    content: string;
    tags?: string[];
    pinned?: boolean;
    pinnedBy?: string;
    linkedAgentId?: string;
    linkedSkillId?: string;
  }) => void;
  onPublishSkill: (input: {
    zoneId: string;
    name: string;
    summary: string;
    kind: SkillKind;
    category: AgentCategory;
    priceUsd: number;
    postContent?: string;
  }) => string;
  onTogglePinPost: (postId: string, principalName?: string) => void;
  onToggleLikePost: (postId: string) => void;
  onAddPostComment: (postId: string, content: string) => void;
  onPublishZoneProject: (input: {
    zoneId: string;
    title: string;
    summary: string;
    budgetUsd: number;
    durationDays: number;
    requiredRoles: string[];
  }) => string;
  onClaimZoneProject: (oppId: string) => string;
  onJumpToKanban: (projectId?: string) => void;
}

function getHumanFollowKey(name: string): string {
  return `human:${displayEntityName(name).replace(/（我）$/, '').trim()}`;
}

function getAgentFollowKey(handle: string): string {
  return `agent:${displayEntityName(handle)}`;
}

export function CommunityHubView({
  activeTab,
  onChangeTab,
  zones,
  activeZone,
  joinedZoneIds,
  workspace,
  workspaces,
  allAgents,
  marketplaceAgents,
  privateAgents,
  humanExperts,
  marketSkills,
  agentLeases,
  purchasedSkillIds,
  teamExperts,
  hiredIds,
  dmHistories,
  dmBusyAgentId,
  dmError,
  categorySeed,
  zoneProjects,
  communityPosts,
  followedEntityKeys,
  zoneSeed,
  onSelectZone,
  onClearDmError,
  onSendDm,
  onStartNegotiation,
  onLeaseAgent,
  onAcquireSkill,
  onInviteTeamExpert,
  onSavePrivateAgent,
  onClearCategorySeed,
  onHire,
  onRelease,
  onJumpToMountPrivate,
  onClearZoneSeed,
  onToggleJoinZone,
  onToggleFollowEntity,
  onCreatePost,
  onPublishSkill,
  onTogglePinPost,
  onToggleLikePost,
  onAddPostComment,
  onPublishZoneProject,
  onClaimZoneProject,
  onJumpToKanban,
}: CommunityHubViewProps) {
  const isServiceMode = activeTab.startsWith('service_');

  const marketEntityTab: MarketEntityTab =
    activeTab === 'service_humans'
      ? 'humans'
      : activeTab === 'service_skills'
        ? 'skills'
        : 'agents';

  const socialFeedScope: SocialFeedScope =
    activeTab === 'social_projects'
      ? 'projects'
      : activeTab === 'social_following'
        ? 'following'
        : activeTab === 'social_pinned'
          ? 'pinned'
          : 'all';

  // Live rail counts for activeZone
  const zoneHumansCount = useMemo(
    () =>
      humanExperts.filter(
        (h) =>
          h.zoneIds.includes(activeZone.id) ||
          marketplaceAgents.some((a) => a.ownerHumanId === h.id),
      ).length,
    [activeZone.id, humanExperts, marketplaceAgents],
  );

  const zoneSkillsCount = useMemo(
    () => marketSkills.filter((s) => s.zoneIds.includes(activeZone.id)).length,
    [activeZone.id, marketSkills],
  );

  const zonePosts = useMemo(
    () => communityPosts.filter((p) => p.zoneId === activeZone.id),
    [activeZone.id, communityPosts],
  );

  const zoneProjectsCount = useMemo(
    () => zoneProjects.filter((p) => p.zoneId === activeZone.id).length,
    [activeZone.id, zoneProjects],
  );

  const followedSet = useMemo(() => new Set(followedEntityKeys), [followedEntityKeys]);

  const followingPostsCount = useMemo(
    () =>
      zonePosts.filter((p) => {
        const primaryKey =
          p.authorEntityType === 'agent'
            ? getAgentFollowKey(p.authorHandle || p.authorName)
            : getHumanFollowKey(p.authorName);
        if (followedSet.has(primaryKey)) return true;
        if (p.authorEntityType === 'agent' && p.authorOwnerName) {
          return followedSet.has(getHumanFollowKey(p.authorOwnerName));
        }
        return false;
      }).length,
    [followedSet, zonePosts],
  );

  const pinnedPostsCount = useMemo(
    () => zonePosts.filter((p) => Boolean(p.pinned)).length,
    [zonePosts],
  );

  const hasCommunityAccess =
    activeZone.kind === 'official' || joinedZoneIds.includes(activeZone.id);

  const socialItems: {
    id: CommunityHubTab;
    label: string;
    count: number;
    icon: typeof Flame;
    tint: string;
  }[] = [
    {
      id: 'social_all',
      label: '全部动态',
      count: zonePosts.length,
      icon: Flame,
      tint: 'text-sky-600',
    },
    {
      id: 'social_projects',
      label: '项目共创',
      count: zoneProjectsCount,
      icon: Rocket,
      tint: 'text-blue-600',
    },
    {
      id: 'social_following',
      label: '我的关注',
      count: followingPostsCount,
      icon: UserCheck,
      tint: 'text-indigo-600',
    },
    {
      id: 'social_pinned',
      label: '主理置顶',
      count: pinnedPostsCount,
      icon: Pin,
      tint: 'text-amber-500',
    },
  ];

  const serviceItems: {
    id: CommunityHubTab;
    label: string;
    count: number;
    icon: typeof Cpu;
    tint: string;
  }[] = [
    {
      id: 'service_agents',
      label: '专家 Agent',
      count: marketplaceAgents.length,
      icon: Cpu,
      tint: 'text-indigo-500',
    },
    {
      id: 'service_humans',
      label: 'Agent 主理',
      count: zoneHumansCount,
      icon: Briefcase,
      tint: 'text-emerald-600',
    },
    {
      id: 'service_skills',
      label: 'Skills / MCP',
      count: zoneSkillsCount,
      icon: Blocks,
      tint: 'text-amber-600',
    },
  ];

  return (
    <div className="h-full flex min-h-0 bg-white relative @container/shell">
      {/* FAR-LEFT PRIMARY NAVIGATION RAIL: Community Exchange + Service Market + Whitespace Slogan Backdrop */}
      <WorkspacePrimaryRail ariaLabel="AGN社区导航">
        {/* Group 1: Community Social & Exchange */}
        <div className="space-y-0.5">
          <RailSectionLabel>社区交流</RailSectionLabel>
          {socialItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <RailNavButton
                key={item.id}
                active={active}
                variant="primary"
                disabled={!hasCommunityAccess}
                label={item.label}
                count={item.count}
                icon={
                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 ${
                      active
                        ? item.id === 'social_pinned'
                          ? 'text-amber-300'
                          : 'text-sky-300'
                        : item.tint
                    }`}
                  />
                }
                onClick={() => onChangeTab(item.id)}
              />
            );
          })}
        </div>

        {/* Group 2: Service Market */}
        <div className="space-y-0.5 pt-2.5 border-t border-slate-100">
          <RailSectionLabel>服务市场</RailSectionLabel>
          {serviceItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <RailNavButton
                key={item.id}
                active={active}
                variant="primary"
                label={item.label}
                count={item.count}
                icon={
                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 ${
                      active ? 'text-sky-300' : item.tint
                    }`}
                  />
                }
                onClick={() => onChangeTab(item.id)}
              />
            );
          })}
        </div>
      </WorkspacePrimaryRail>

      {/* RIGHT MAIN CONTENT: Narrow-Screen Selector Bar + Embedded Service or Social View */}
      <div className="flex-1 min-w-0 flex flex-col h-full min-h-0">
        {/* Compact Narrow-Screen Bar (< 760px) */}
        <div className="@[760px]/shell:hidden shrink-0 border-b border-slate-200 bg-white px-4 py-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {[...socialItems, ...serviceItems].map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChangeTab(item.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer border transition-colors ${
                    active
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.label}</span>
                  <span className="text-[10px] font-mono tabular-nums opacity-75">
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 min-h-0 flex">
          {isServiceMode ? (
            <AgentMarketView
              embeddedMode
              controlledEntityTab={marketEntityTab}
              onChangeEntityTab={(next) => {
                if (next === 'humans') onChangeTab('service_humans');
                else if (next === 'skills') onChangeTab('service_skills');
                else onChangeTab('service_agents');
              }}
              zones={zones}
              activeZone={activeZone}
              workspace={workspace}
              workspaces={workspaces}
              allAgents={allAgents}
              agents={marketplaceAgents}
              privateAgents={privateAgents}
              humanExperts={humanExperts}
              marketSkills={marketSkills}
              agentLeases={agentLeases}
              purchasedSkillIds={purchasedSkillIds}
              teamExperts={teamExperts}
              hiredIds={hiredIds}
              dmHistories={dmHistories}
              dmBusyAgentId={dmBusyAgentId}
              dmError={dmError}
              onClearDmError={onClearDmError}
              onSendDm={onSendDm}
              onStartNegotiation={onStartNegotiation}
              onLeaseAgent={onLeaseAgent}
              onAcquireSkill={onAcquireSkill}
              onInviteTeamExpert={onInviteTeamExpert}
              onSavePrivateAgent={onSavePrivateAgent}
              categorySeed={categorySeed}
              onClearCategorySeed={onClearCategorySeed}
              onSelectZone={onSelectZone}
              onHire={onHire}
              onRelease={onRelease}
              onJumpToMountPrivate={onJumpToMountPrivate}
              onJumpToZoneProjects={(zoneId) => {
                onSelectZone(zoneId);
                onChangeTab('social_projects');
              }}
            />
          ) : (
            <CommunityDiscoverView
              embeddedMode
              controlledFeedScope={socialFeedScope}
              onChangeFeedScope={(next) => {
                if (next === 'projects') onChangeTab('social_projects');
                else if (next === 'following') onChangeTab('social_following');
                else if (next === 'pinned') onChangeTab('social_pinned');
                else onChangeTab('social_all');
              }}
              zones={zones}
              activeZone={activeZone}
              joinedZoneIds={joinedZoneIds}
              zoneProjects={zoneProjects}
              communityPosts={communityPosts}
              followedEntityKeys={followedEntityKeys}
              allAgents={allAgents}
              privateAgents={privateAgents}
              humanExperts={humanExperts}
              marketSkills={marketSkills}
              purchasedSkillIds={purchasedSkillIds}
              zoneSeed={zoneSeed}
              onClearZoneSeed={onClearZoneSeed}
              onSelectZone={onSelectZone}
              onToggleJoinZone={onToggleJoinZone}
              onToggleFollowEntity={onToggleFollowEntity}
              onCreatePost={onCreatePost}
              onPublishSkill={onPublishSkill}
              onAcquireSkill={onAcquireSkill}
              onTogglePinPost={onTogglePinPost}
              onToggleLikePost={onToggleLikePost}
              onAddPostComment={onAddPostComment}
              onPublishZoneProject={onPublishZoneProject}
              onClaimZoneProject={onClaimZoneProject}
              onStartNegotiation={onStartNegotiation}
              onJumpToZoneMarket={(zoneId) => {
                onSelectZone(zoneId);
                onChangeTab('service_agents');
              }}
              onJumpToKanban={onJumpToKanban}
            />
          )}
        </div>
      </div>
    </div>
  );
}
