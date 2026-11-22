import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Briefcase,
  Check,
  CheckCircle2,
  Clock,
  Heart,
  Lock,
  MessageCircle,
  MessageSquare,
  Plus,
  Send,
  Sparkles,
  Store,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { AgentMark, EntityAvatar, HumanMark, displayEntityName } from '../shared/EntityIdentity';
import {
  ToolbarDivider,
  ToolbarSearch,
  ToolbarSegment,
  ViewToolbar,
} from '../shared/ViewToolbar';
import { ZoneSelectorDropdown } from '../shared/ZoneSelectorDropdown';
import type {
  CommunityPost,
  CommunityPostType,
  CommunityZone,
  ExpertAgent,
  HumanExpert,
  ServiceMode,
  ZoneProjectOpportunity,
} from '../../types/agentnexus';

interface CommunityDiscoverViewProps {
  zones: CommunityZone[];
  joinedZoneIds: string[];
  zoneProjects: ZoneProjectOpportunity[];
  communityPosts: CommunityPost[];
  allAgents: ExpertAgent[];
  humanExperts: HumanExpert[];
  zoneSeed: string | null;
  onClearZoneSeed: () => void;
  onToggleJoinZone: (zoneId: string) => void;
  onCreatePost: (input: {
    zoneId: string;
    type: Exclude<CommunityPostType, 'project'>;
    title: string;
    content: string;
    tags?: string[];
  }) => void;
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
  onStartNegotiation: (agentId: string) => void;
  onJumpToZoneMarket: (zoneId: string) => void;
  onJumpToKanban: (projectId?: string) => void;
}

const POST_TYPE_META: Record<CommunityPostType, { label: string; cls: string }> = {
  project: { label: '项目撮合', cls: 'text-blue-700' },
  discussion: { label: '交流讨论', cls: 'text-slate-600' },
  showcase: { label: '专家自荐', cls: 'text-indigo-700' },
};

const SERVICE_MODE_LABELS: Record<ServiceMode, string> = {
  'pure-agent': '纯 Agent 租用',
  'human-agent': '人 + Agent 协同',
};

export function CommunityDiscoverView({
  zones,
  joinedZoneIds,
  zoneProjects,
  communityPosts,
  allAgents,
  humanExperts,
  zoneSeed,
  onClearZoneSeed,
  onToggleJoinZone,
  onCreatePost,
  onToggleLikePost,
  onAddPostComment,
  onPublishZoneProject,
  onClaimZoneProject,
  onStartNegotiation,
  onJumpToZoneMarket,
  onJumpToKanban,
}: CommunityDiscoverViewProps) {
  const [activeCommunityId, setActiveCommunityId] = useState<string>(zones[0]?.id || 'zone_public');
  const [postFilter, setPostFilter] = useState<'all' | CommunityPostType>('all');
  const [searchKeyword, setSearchKeyword] = useState('');

  // Publish Modal State
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<CommunityPostType>('discussion');
  const [postTitle, setPostTitle] = useState('');
  const [postBody, setPostBody] = useState('');
  const [projBudget, setProjBudget] = useState(3200);
  const [projDays, setProjDays] = useState(7);
  const [projRoles, setProjRoles] = useState('架构审查, 全栈研发');

  const openComposer = (mode: CommunityPostType = 'discussion') => {
    setComposerMode(mode);
    setIsComposerOpen(true);
  };

  useEffect(() => {
    if (!isComposerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsComposerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isComposerOpen]);

  // Comments Expand & Draft Map
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({
    post_pub_1: true,
    post_pub_2: true,
    post_dnx_1: true,
    post_zj_1: true,
    post_robo_1: true,
    post_robo_2: true,
  });
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (zoneSeed) {
      if (zones.some((z) => z.id === zoneSeed)) {
        setActiveCommunityId(zoneSeed);
      }
      onClearZoneSeed();
    }
  }, [onClearZoneSeed, zoneSeed, zones]);

  const activeCommunity = useMemo(
    () => zones.find((z) => z.id === activeCommunityId) || zones[0],
    [activeCommunityId, zones],
  );

  const isPublicCommunity = activeCommunity.kind === 'public';
  const hasAccess = isPublicCommunity || joinedZoneIds.includes(activeCommunity.id);

  const projectMap = useMemo(() => {
    const map = new Map<string, ZoneProjectOpportunity>();
    zoneProjects.forEach((p) => map.set(p.id, p));
    return map;
  }, [zoneProjects]);

  const agentMap = useMemo(() => {
    const map = new Map<string, ExpertAgent>();
    allAgents.forEach((a) => map.set(a.id, a));
    return map;
  }, [allAgents]);

  const communityFeedPosts = useMemo(() => {
    const q = searchKeyword.trim().toLowerCase();
    return communityPosts.filter((p) => {
      if (p.zoneId !== activeCommunity.id) return false;
      if (postFilter !== 'all' && p.type !== postFilter) return false;
      if (!q) return true;
      const haystack = [
        p.title,
        p.content,
        p.authorName,
        p.authorOwnerName || '',
        ...p.tags,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [activeCommunity.id, communityPosts, postFilter, searchKeyword]);

  const communityOpenProjects = useMemo(
    () => zoneProjects.filter((p) => p.zoneId === activeCommunity.id),
    [activeCommunity.id, zoneProjects],
  );

  const communityExperts = useMemo(
    () => allAgents.filter((a) => a.listedZoneIds.includes(activeCommunity.id)).slice(0, 4),
    [activeCommunity.id, allAgents],
  );

  const communityHumans = useMemo(() => {
    return humanExperts
      .map((h) => ({
        human: h,
        agentCount: allAgents.filter((a) => a.ownerHumanId === h.id && a.isListedInMarket).length,
      }))
      .filter(({ human }) => human.zoneIds.includes(activeCommunity.id))
      .slice(0, 4);
  }, [activeCommunity.id, allAgents, humanExperts]);

  const handleComposerSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!postBody.trim() && !postTitle.trim()) return;

    if (composerMode === 'project') {
      const roles = projRoles
        .split(/[,，、/]/)
        .map((s) => s.trim())
        .filter(Boolean);
      onPublishZoneProject({
        zoneId: activeCommunity.id,
        title: postTitle.trim() || postBody.trim().slice(0, 28),
        summary: postBody.trim() || postTitle.trim(),
        budgetUsd: projBudget,
        durationDays: projDays,
        requiredRoles: roles,
      });
    } else {
      onCreatePost({
        zoneId: activeCommunity.id,
        type: composerMode,
        title: postTitle.trim() || postBody.trim().slice(0, 32),
        content: postBody.trim() || postTitle.trim(),
      });
    }

    setPostTitle('');
    setPostBody('');
    setPostFilter('all');
    setIsComposerOpen(false);
  };

  const handleCommentSubmit = (postId: string, e: FormEvent) => {
    e.preventDefault();
    const text = (commentDrafts[postId] || '').trim();
    if (!text) return;
    onAddPostComment(postId, text);
    setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
    setExpandedComments((prev) => ({ ...prev, [postId]: true }));
  };

  return (
    <div className="h-full flex flex-col min-h-0 bg-white">
      {/* Unified Single-Row Composable Widget Toolbar */}
      <ViewToolbar
        left={
          <>
            <ZoneSelectorDropdown
              zones={zones}
              activeZoneId={activeCommunity.id}
              onSelectZone={(zId) => {
                setActiveCommunityId(zId);
                setPostFilter('all');
                setSearchKeyword('');
              }}
              joinedZoneIds={joinedZoneIds}
              onToggleJoinZone={onToggleJoinZone}
              getZoneStat={(z) => {
                const postCnt = communityPosts.filter((p) => p.zoneId === z.id).length;
                const openProjCnt = zoneProjects.filter(
                  (p) => p.zoneId === z.id && p.status === 'open',
                ).length;
                return `${postCnt} 动态 · ${openProjCnt} 撮合项目 · ${z.memberCount} 成员`;
              }}
            />

            {!isPublicCommunity && (
              <button
                type="button"
                onClick={() => onToggleJoinZone(activeCommunity.id)}
                className={`inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer border ${
                  hasAccess
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                    : 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {hasAccess ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>已加入</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>加入社区</span>
                  </>
                )}
              </button>
            )}

            {hasAccess && (
              <>
                <ToolbarDivider />
                <ToolbarSegment
                  value={postFilter}
                  onChange={setPostFilter}
                  options={[
                    { id: 'all', label: '全部', count: communityFeedPosts.length },
                    { id: 'project', label: '项目撮合' },
                    { id: 'discussion', label: '交流讨论' },
                    { id: 'showcase', label: '专家自荐' },
                  ]}
                />
              </>
            )}
          </>
        }
        right={
          hasAccess ? (
            <>
              <ToolbarSearch
                value={searchKeyword}
                onChange={setSearchKeyword}
                placeholder="搜索动态、项目或标签..."
              />
              <button
                type="button"
                onClick={() =>
                  openComposer(postFilter === 'all' ? 'discussion' : postFilter)
                }
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap transition-colors shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>发布</span>
              </button>
            </>
          ) : undefined
        }
      />

      {/* Main Scrollable Community Information Flow + Right Community Context Rail */}
      <div className="flex-1 min-h-0 overflow-y-auto clean-scroll bg-slate-50/70 px-5 sm:px-8 py-5">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: Information Flow & Matchmaking Stream */}
          <div className="lg:col-span-8 space-y-4">
            {!hasAccess ? (
              /* Private Community Access Gate */
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 inline-flex items-center justify-center mx-auto">
                  <Lock className="w-5 h-5" />
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  「{activeCommunity.name}」为认证私有社区
                </h2>
                <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                  {activeCommunity.tagline}。加入社区后即可浏览内部实战信息流、参与评论交流，并直接承接或向社区发布项目撮合。
                </p>
                <div className="pt-1 flex items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onToggleJoinZone(activeCommunity.id)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>加入「{activeCommunity.name}」私有社区</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onJumpToZoneMarket(activeCommunity.id)}
                    className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer"
                  >
                    浏览该社区专家市场
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Information Flow Stream */}
                <div className="space-y-3.5">
                  {communityFeedPosts.length === 0 ? (
                    <div className="bg-white rounded-xl border border-dashed border-slate-300 py-12 text-center space-y-2.5">
                      <p className="text-xs text-slate-500">
                        该分类下暂无动态，欢迎发布第一条社区交流或项目撮合。
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          openComposer(postFilter === 'all' ? 'discussion' : postFilter)
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>立即发布</span>
                      </button>
                    </div>
                  ) : (
                    communityFeedPosts.map((post) => {
                      const typeInfo = POST_TYPE_META[post.type];
                      const linkedProj = post.linkedProjectId
                        ? projectMap.get(post.linkedProjectId)
                        : undefined;
                      const linkedAgent = post.linkedAgentId
                        ? agentMap.get(post.linkedAgentId)
                        : undefined;
                      const isCommentsOpen = Boolean(expandedComments[post.id]);

                      return (
                        <article
                          key={post.id}
                          className="bg-white rounded-xl border border-slate-200 p-5 space-y-3.5"
                        >
                          {/* Author Header: Co-existing Human Member or Autonomous Agent */}
                          {(() => {
                            const isAgentAuthor = post.authorEntityType === 'agent';
                            return (
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <EntityAvatar
                                    kind={isAgentAuthor ? 'agent' : 'human'}
                                    code={post.authorCode}
                                    accent={post.authorAccent}
                                    size="md"
                                  />
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
                                      <span className="font-bold text-slate-900">
                                        {displayEntityName(post.authorName)}
                                      </span>
                                      {isAgentAuthor ? (
                                        <AgentMark />
                                      ) : (
                                        <HumanMark label="真人" />
                                      )}
                                      <span className="text-slate-400">
                                        {isAgentAuthor && post.authorOwnerName
                                          ? `归属专家：${post.authorOwnerName} · ${post.authorRole}`
                                          : post.authorRole}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                      <span>{post.createdAt}</span>
                                      <span aria-hidden="true">·</span>
                                      <span className={`font-semibold ${typeInfo.cls}`}>
                                        {typeInfo.label}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Post Title & Natural Conversational Body */}
                          <div>
                            <h3 className="text-sm font-bold text-slate-900 leading-snug">
                              {post.title}
                            </h3>
                            <p className="text-xs text-slate-700 mt-1.5 leading-relaxed whitespace-pre-wrap">
                              {post.content}
                            </p>
                            {post.tags.length > 0 && (
                              <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-slate-400">
                                {post.tags.map((tag) => (
                                  <span key={tag}>#{tag}</span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Embedded Live Project Matchmaking Card */}
                          {linkedProj && (
                            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-2.5">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 text-[11px]">
                                    <Briefcase className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                    <span className="font-semibold text-blue-700">
                                      {linkedProj.direction === 'published_by_me'
                                        ? '我方发起的项目撮合'
                                        : linkedProj.status === 'claimed'
                                          ? '我方已承接参与'
                                          : '开放撮合 · 招募团队承接'}
                                    </span>
                                    <span className="text-slate-300" aria-hidden="true">·</span>
                                    <span className="font-mono tabular-nums text-slate-500 inline-flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {linkedProj.durationDays} 天交付
                                    </span>
                                  </div>
                                  <div className="text-xs font-bold text-slate-900 mt-1">
                                    {linkedProj.title}
                                  </div>
                                </div>

                                <div className="text-left sm:text-right shrink-0">
                                  <div className="text-sm font-bold font-mono tabular-nums text-slate-900">
                                    ${linkedProj.budgetUsd.toLocaleString('en-US')} / 项目
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {linkedProj.serviceModePref === 'any'
                                      ? '纯 Agent / 人+Agent 皆可'
                                      : SERVICE_MODE_LABELS[linkedProj.serviceModePref]}
                                  </div>
                                </div>
                              </div>

                              <div className="pt-2 border-t border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                                <div className="text-slate-600 truncate">
                                  <span className="text-slate-400 mr-1.5">需求角色</span>
                                  <span className="font-medium text-slate-800">
                                    {linkedProj.requiredRoles.join(' · ')}
                                  </span>
                                </div>

                                {linkedProj.direction === 'published_by_me' ? (
                                  <button
                                    type="button"
                                    onClick={() => onJumpToKanban(linkedProj.linkedWorkspaceId)}
                                    className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap shrink-0"
                                  >
                                    <span>去工作看板管理</span>
                                  </button>
                                ) : linkedProj.status === 'claimed' ? (
                                  <button
                                    type="button"
                                    onClick={() => onJumpToKanban(linkedProj.linkedWorkspaceId)}
                                    className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>已承接 · 进入工作看板</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => onClaimZoneProject(linkedProj.id)}
                                    className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white cursor-pointer whitespace-nowrap shrink-0"
                                  >
                                    <UserPlus className="w-3.5 h-3.5" />
                                    <span>派出团队承接</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Embedded Expert Showcase Card */}
                          {linkedAgent && (
                            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <EntityAvatar
                                  kind="agent"
                                  code={linkedAgent.avatarCode}
                                  accent={linkedAgent.avatarAccent}
                                  size="md"
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-xs font-bold text-slate-900 truncate">
                                      {displayEntityName(linkedAgent.handle)}
                                    </span>
                                    <AgentMark />
                                    <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap shrink-0">
                                      · {linkedAgent.performance.capabilityTier}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 font-mono tabular-nums truncate mt-0.5">
                                    {linkedAgent.ownerHumanName
                                      ? `归属专家 ${linkedAgent.ownerHumanName} · `
                                      : ''}
                                    信誉 {linkedAgent.performance.reputationScore} · $
                                    {linkedAgent.projectPriceUsd.toLocaleString('en-US')}/项目
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => onStartNegotiation(linkedAgent.id)}
                                className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap shrink-0"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>私聊对接</span>
                              </button>
                            </div>
                          )}

                          {/* Feed Action Footer: Like & Toggle Comments */}
                          <div className="pt-2.5 border-t border-slate-100 flex items-center gap-5 text-xs">
                            <button
                              type="button"
                              onClick={() => onToggleLikePost(post.id)}
                              className={`inline-flex items-center gap-1.5 font-medium cursor-pointer transition-colors ${
                                post.likedByMe
                                  ? 'text-rose-600'
                                  : 'text-slate-500 hover:text-slate-900'
                              }`}
                            >
                              <Heart
                                className={`w-3.5 h-3.5 ${post.likedByMe ? 'fill-rose-600' : ''}`}
                              />
                              <span className="font-mono tabular-nums">赞同 {post.likes}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setExpandedComments((prev) => ({
                                  ...prev,
                                  [post.id]: !prev[post.id],
                                }))
                              }
                              className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-900 font-medium cursor-pointer transition-colors"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span className="font-mono tabular-nums">
                                讨论 {post.comments.length}
                              </span>
                            </button>
                          </div>

                          {/* Expandable Inline Comments Thread */}
                          {isCommentsOpen && (
                            <div className="pt-2 border-t border-slate-100 space-y-2.5">
                              {post.comments.length > 0 && (
                                <div className="space-y-2">
                                  {post.comments.map((cmt) => (
                                    <div
                                      key={cmt.id}
                                      className="rounded-lg bg-slate-50 px-3 py-2 text-xs space-y-0.5"
                                    >
                                      <div className="flex items-center justify-between gap-2 text-[11px]">
                                        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                                          <span>{displayEntityName(cmt.authorName)}</span>
                                          {cmt.isAgent && <AgentMark />}
                                        </span>
                                        <span className="text-slate-400">{cmt.timestamp}</span>
                                      </div>
                                      <p className="text-slate-700 leading-relaxed">
                                        {cmt.content}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <form
                                onSubmit={(e) => handleCommentSubmit(post.id, e)}
                                className="flex items-center gap-2"
                              >
                                <input
                                  type="text"
                                  value={commentDrafts[post.id] || ''}
                                  onChange={(e) =>
                                    setCommentDrafts((prev) => ({
                                      ...prev,
                                      [post.id]: e.target.value,
                                    }))
                                  }
                                  placeholder="写下你的观点、补充需求或对接意向..."
                                  className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                                />
                                <button
                                  type="submit"
                                  disabled={!(commentDrafts[post.id] || '').trim()}
                                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer disabled:opacity-40 whitespace-nowrap shrink-0"
                                >
                                  回复
                                </button>
                              </form>
                            </div>
                          )}
                        </article>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>

          {/* RIGHT RAIL: Community Profile, Live Matchmaking Projects & Active Community Experts */}
          <aside className="lg:col-span-4 space-y-4">
            {/* Community Overview Card */}
            <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-8 h-8 rounded-lg text-xs font-bold text-white inline-flex items-center justify-center shrink-0"
                    style={{ backgroundColor: activeCommunity.accentColor }}
                  >
                    {activeCommunity.shortCode}
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-slate-900 truncate">
                      {activeCommunity.name}
                    </h2>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <span>{activeCommunity.typeLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums inline-flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {activeCommunity.memberCount}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                {activeCommunity.tagline}
              </p>

              <div className="text-[11px] text-slate-500">
                聚焦方向：{activeCommunity.focusDomains.join(' · ')}
              </div>

              <button
                type="button"
                onClick={() => onJumpToZoneMarket(activeCommunity.id)}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer"
              >
                <Store className="w-3.5 h-3.5 text-blue-600" />
                <span>进入「{activeCommunity.name}」专家市场</span>
              </button>
            </section>

            {/* Open Matchmaking Projects in This Community */}
            <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>正在撮合的项目 ({communityOpenProjects.length})</span>
                </h3>
                {hasAccess && (
                  <button
                    type="button"
                    onClick={() => openComposer('project')}
                    className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
                  >
                    + 发项目
                  </button>
                )}
              </div>

              {communityOpenProjects.length === 0 ? (
                <p className="text-xs text-slate-500">该社区暂无撮合项目。</p>
              ) : (
                <div className="space-y-2.5">
                  {communityOpenProjects.map((proj) => (
                    <div
                      key={proj.id}
                      className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1.5"
                    >
                      <div className="text-xs font-semibold text-slate-900 leading-snug">
                        {proj.title}
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-mono tabular-nums font-bold text-slate-800">
                          ${proj.budgetUsd.toLocaleString('en-US')} · {proj.durationDays}天
                        </span>
                        {proj.status === 'claimed' || proj.direction === 'published_by_me' ? (
                          <button
                            type="button"
                            onClick={() => onJumpToKanban(proj.linkedWorkspaceId)}
                            className="font-semibold text-emerald-700 hover:text-emerald-900 cursor-pointer"
                          >
                            进看板 →
                          </button>
                        ) : hasAccess ? (
                          <button
                            type="button"
                            onClick={() => onClaimZoneProject(proj.id)}
                            className="font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
                          >
                            承接 →
                          </button>
                        ) : (
                          <span className="text-slate-400">加入后可承接</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Co-existing Human Operators & Certified External Agents in This Community */}
            <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-slate-900">
                  社区专家 · 真人与 Agent 共存
                </h3>
                <button
                  type="button"
                  onClick={() => onJumpToZoneMarket(activeCommunity.id)}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  全部 →
                </button>
              </div>

              {communityHumans.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-slate-500">
                    活跃人类专家 ({communityHumans.length})
                  </div>
                  {communityHumans.map(({ human, agentCount }) => (
                    <div
                      key={human.id}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <EntityAvatar
                          kind="human"
                          code={human.avatarInitials}
                          accent={human.avatarAccent}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-semibold text-slate-900 truncate">
                              {human.name}
                            </span>
                            <HumanMark label="真人" />
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            旗下 {agentCount} 个对外 Agent · {human.title}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2.5 border-t border-slate-100 space-y-2.5">
                <div className="text-[11px] font-semibold text-slate-500">
                  社区对外工作 Agent ({communityExperts.length})
                </div>
                {communityExperts.map((ag) => (
                  <div
                    key={ag.id}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <EntityAvatar
                        kind="agent"
                        code={ag.avatarCode}
                        accent={ag.avatarAccent}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-semibold text-slate-900 truncate">
                            {displayEntityName(ag.handle)}
                          </span>
                          <AgentMark />
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {ag.ownerHumanName ? `归属专家 ${ag.ownerHumanName} · ` : ''}
                          <span className="font-mono tabular-nums">
                            ${ag.projectPriceUsd.toLocaleString('en-US')}/项目
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onStartNegotiation(ag.id)}
                      className="px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer shrink-0 whitespace-nowrap"
                    >
                      私聊
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>

      {/* Publish Post / Project Matchmaking Modal */}
      {isComposerOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/45 flex items-center justify-center p-4"
          onClick={() => setIsComposerOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="community-publish-modal-title"
        >
          <form
            onSubmit={handleComposerSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden"
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2
                  id="community-publish-modal-title"
                  className="text-sm font-bold text-slate-900"
                >
                  发布社区内容
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  目标社区：
                  <strong style={{ color: activeCommunity.accentColor }}>
                    {activeCommunity.name}
                  </strong>
                  （{activeCommunity.typeLabel}）
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsComposerOpen(false)}
                aria-label="关闭发布弹框"
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 inline-flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-3.5">
              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(
                  [
                    { id: 'discussion', label: '交流发言' },
                    { id: 'project', label: '发布项目撮合' },
                    { id: 'showcase', label: '自荐能力' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setComposerMode(tab.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      composerMode === tab.id
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  标题
                </label>
                <input
                  type="text"
                  autoFocus
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder={
                    composerMode === 'project'
                      ? '一句话标题：如「寻东南亚支付网关架构与全栈协同交付，7 天上线」'
                      : composerMode === 'showcase'
                        ? '能力标题：如「开放本月 1 个高并发风控审查档期，支持人+Agent 协同」'
                        : `在「${activeCommunity.name}」发起讨论、复盘或求助`
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  {composerMode === 'project' ? '项目说明与验收标准' : '内容详情'}
                </label>
                <textarea
                  rows={4}
                  value={postBody}
                  onChange={(e) => setPostBody(e.target.value)}
                  placeholder={
                    composerMode === 'project'
                      ? '补充项目背景、交付范围与验收标准（发布后自动同步到你的「工作看板 → 我主管」）...'
                      : '写下你的实战经验、踩坑复盘或具体问题...'
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 resize-none"
                />
              </div>

              {composerMode === 'project' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-0.5">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      项目预算（USD）
                    </label>
                    <input
                      type="number"
                      min={500}
                      step={100}
                      value={projBudget}
                      onChange={(e) => setProjBudget(Number(e.target.value) || 1000)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      期望周期（天）
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={projDays}
                      onChange={(e) => setProjDays(Number(e.target.value) || 7)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      需求角色（逗号分隔）
                    </label>
                    <input
                      type="text"
                      value={projRoles}
                      onChange={(e) => setProjRoles(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500">
                {composerMode === 'project'
                  ? '发布后将同时进入社区信息流与工作看板'
                  : '发布后支持社区成员与专家节点评论交流'}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsComposerOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={!postBody.trim() && !postTitle.trim()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer disabled:opacity-45 whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{composerMode === 'project' ? '发布项目撮合' : '发布动态'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
