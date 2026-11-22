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
  Pin,
  PinOff,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Store,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  AgentIdentityName,
  EntityAvatar,
  HumanMark,
  displayEntityName,
  evaluateAgentTierRating,
} from '../shared/EntityIdentity';
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
    pinned?: boolean;
    pinnedBy?: string;
  }) => void;
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
  onStartNegotiation: (agentId: string) => void;
  onJumpToZoneMarket: (zoneId: string) => void;
  onJumpToKanban: (projectId?: string) => void;
}

const POST_TYPE_META: Record<
  CommunityPostType,
  { label: string; cls: string; badgeCls: string }
> = {
  tech: {
    label: '技术讨论',
    cls: 'text-sky-700',
    badgeCls: 'bg-sky-50 text-sky-700 border-sky-200/80',
  },
  business: {
    label: '商业分析',
    cls: 'text-emerald-700',
    badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  },
  project: {
    label: '项目招募',
    cls: 'text-blue-700',
    badgeCls: 'bg-blue-50 text-blue-700 border-blue-200/80',
  },
  agn_recommend: {
    label: 'AGN 推荐',
    cls: 'text-indigo-700',
    badgeCls: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
  },
  announcement: {
    label: '社区公告',
    cls: 'text-amber-800',
    badgeCls: 'bg-amber-50 text-amber-800 border-amber-200/80',
  },
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
  onTogglePinPost,
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
  const [principalDemoZones, setPrincipalDemoZones] = useState<Record<string, boolean>>({});

  // Publish Modal State
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<CommunityPostType>('tech');
  const [composerPin, setComposerPin] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postBody, setPostBody] = useState('');
  const [projBudget, setProjBudget] = useState(3200);
  const [projDays, setProjDays] = useState(7);
  const [projRoles, setProjRoles] = useState('架构审查, 全栈研发');

  const openComposer = (mode: CommunityPostType = 'tech') => {
    setComposerMode(mode);
    setComposerPin(mode === 'announcement');
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
  const canManagePin = Boolean(
    activeCommunity.isCurrentUserPrincipal || principalDemoZones[activeCommunity.id],
  );

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

  const zoneAllPostsCount = useMemo(
    () => communityPosts.filter((p) => p.zoneId === activeCommunity.id).length,
    [activeCommunity.id, communityPosts],
  );

  const communityFeedPosts = useMemo(() => {
    const q = searchKeyword.trim().toLowerCase();
    const filtered = communityPosts.filter((p) => {
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
    return [...filtered].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
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
        pinned: canManagePin && composerPin,
        pinnedBy: canManagePin && composerPin ? activeCommunity.principalName : undefined,
      });
    }

    setPostTitle('');
    setPostBody('');
    setComposerPin(false);
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
                return `${postCnt} 帖子 · ${openProjCnt} 招募项目 · 主理 ${z.principalName}`;
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
                    { id: 'all', label: '全部', count: zoneAllPostsCount },
                    { id: 'tech', label: '技术讨论' },
                    { id: 'business', label: '商业分析' },
                    { id: 'project', label: '项目招募' },
                    { id: 'agn_recommend', label: 'AGN 推荐' },
                    { id: 'announcement', label: '社区公告' },
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
                placeholder="搜索帖子、标签或作者..."
              />
              <button
                type="button"
                onClick={() => openComposer(postFilter === 'all' ? 'tech' : postFilter)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap transition-colors shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>发帖</span>
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
                    浏览该社区服务市场
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
                        该分类下暂无内容，欢迎发起技术讨论、商业分析、AGN 推荐或项目招募。
                      </p>
                      <button
                        type="button"
                        onClick={() => openComposer(postFilter === 'all' ? 'tech' : postFilter)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>立即发帖</span>
                      </button>
                    </div>
                  ) : (
                    communityFeedPosts.map((post) => {
                      const typeInfo = POST_TYPE_META[post.type] || POST_TYPE_META.tech;
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
                          className={`rounded-xl border p-5 space-y-3.5 transition-colors ${
                            post.pinned
                              ? 'bg-amber-50/20 border-amber-300/80'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          {/* Author Header: Co-existing Human Member or Autonomous Agent + Principal Pin Control */}
                          {(() => {
                            const isAgentAuthor = post.authorEntityType === 'agent';
                            const authorAgent = isAgentAuthor
                              ? linkedAgent ||
                                allAgents.find(
                                  (a) =>
                                    a.handle === post.authorHandle ||
                                    displayEntityName(a.handle) ===
                                      displayEntityName(post.authorName),
                                )
                              : undefined;
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
                                      {isAgentAuthor ? (
                                        <AgentIdentityName
                                          name={post.authorName}
                                          runtime={authorAgent?.runtimeAgent}
                                          model={authorAgent?.defaultModel}
                                          className="font-bold text-slate-900"
                                        />
                                      ) : (
                                        <>
                                          <span className="font-bold text-slate-900">
                                            {displayEntityName(post.authorName)}
                                          </span>
                                          <HumanMark label="真人" />
                                        </>
                                      )}
                                      <span className="text-slate-400">
                                        {isAgentAuthor && post.authorOwnerName
                                          ? `主理人：${post.authorOwnerName} · ${post.authorRole}`
                                          : post.authorRole}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-1.5 mt-1">
                                      {post.pinned && (
                                        <span
                                          title={
                                            post.pinnedBy
                                              ? `由社区主理 ${post.pinnedBy} 置顶`
                                              : '社区主理置顶'
                                          }
                                          className="inline-flex items-center gap-0.5 px-1.5 py-[1px] rounded text-[10px] font-semibold bg-amber-100/90 text-amber-800 border border-amber-300/80"
                                        >
                                          <Pin className="w-2.5 h-2.5" />
                                          <span>主理置顶</span>
                                        </span>
                                      )}
                                      <span
                                        className={`inline-flex items-center px-1.5 py-[1px] rounded text-[10px] font-semibold border ${typeInfo.badgeCls}`}
                                      >
                                        {typeInfo.label}
                                      </span>
                                      <span>{post.createdAt}</span>
                                    </div>
                                  </div>
                                </div>

                                {canManagePin && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onTogglePinPost(post.id, activeCommunity.principalName)
                                    }
                                    title={post.pinned ? '取消社区置顶' : '作为社区主理置顶此帖'}
                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
                                      post.pinned
                                        ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                        : 'border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                                    }`}
                                  >
                                    {post.pinned ? (
                                      <>
                                        <PinOff className="w-3 h-3" />
                                        <span>取消置顶</span>
                                      </>
                                    ) : (
                                      <>
                                        <Pin className="w-3 h-3" />
                                        <span>置顶</span>
                                      </>
                                    )}
                                  </button>
                                )}
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

                          {/* Embedded AGN Recommendation Card (No direct sticker price — tier/cost index + principal inquiry) */}
                          {linkedAgent && (() => {
                            const rating = evaluateAgentTierRating({
                              runtimeAgent: linkedAgent.runtimeAgent,
                              defaultModel: linkedAgent.defaultModel,
                              capabilityTier: linkedAgent.performance.capabilityTier,
                              ownership: linkedAgent.ownership,
                              projectPriceUsd: linkedAgent.projectPriceUsd,
                            });
                            return (
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
                                      <AgentIdentityName
                                        name={linkedAgent.handle}
                                        runtime={linkedAgent.runtimeAgent}
                                        model={linkedAgent.defaultModel}
                                        showModel
                                        className="text-xs font-bold text-slate-900"
                                      />
                                      <span className="px-1.5 py-[1px] rounded text-[10px] font-mono font-bold bg-slate-900 text-white shrink-0">
                                        {rating.code}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                                      {linkedAgent.ownerHumanName
                                        ? `主理人 ${linkedAgent.ownerHumanName} · `
                                        : ''}
                                      {rating.description} · 信誉{' '}
                                      <span className="font-mono tabular-nums">
                                        {linkedAgent.performance.reputationScore}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => onStartNegotiation(linkedAgent.id)}
                                  className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap shrink-0"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                  <span>咨询 / 询价</span>
                                </button>
                              </div>
                            );
                          })()}

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
                                  {post.comments.map((cmt) => {
                                    const cmtAgent = cmt.isAgent
                                      ? allAgents.find(
                                          (a) =>
                                            a.handle === cmt.authorHandle ||
                                            displayEntityName(a.handle) ===
                                              displayEntityName(cmt.authorName),
                                        )
                                      : undefined;
                                    return (
                                      <div
                                        key={cmt.id}
                                        className="rounded-lg bg-slate-50 px-3 py-2 text-xs space-y-0.5"
                                      >
                                        <div className="flex items-center justify-between gap-2 text-[11px]">
                                          {cmt.isAgent ? (
                                            <AgentIdentityName
                                              name={cmt.authorName}
                                              runtime={cmtAgent?.runtimeAgent}
                                              model={cmtAgent?.defaultModel}
                                              className="font-semibold text-slate-800"
                                            />
                                          ) : (
                                            <span className="font-semibold text-slate-800">
                                              {displayEntityName(cmt.authorName)}
                                            </span>
                                          )}
                                          <span className="text-slate-400">{cmt.timestamp}</span>
                                        </div>
                                        <p className="text-slate-700 leading-relaxed">
                                          {cmt.content}
                                        </p>
                                      </div>
                                    );
                                  })}
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

              {/* Community Principal & Pin Authority */}
              <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 min-w-0 text-slate-600">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="truncate">
                    社区主理：<strong className="text-slate-900">{activeCommunity.principalName}</strong>
                  </span>
                </div>
                {activeCommunity.isCurrentUserPrincipal ? (
                  <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200/80 text-amber-800 font-semibold text-[10px] shrink-0">
                    主理权限 · 可置顶
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setPrincipalDemoZones((prev) => ({
                        ...prev,
                        [activeCommunity.id]: !prev[activeCommunity.id],
                      }))
                    }
                    className={`px-2 py-0.5 rounded border text-[10px] font-semibold cursor-pointer transition-colors shrink-0 ${
                      canManagePin
                        ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {canManagePin ? '退出主理视角' : '切换主理视角'}
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => onJumpToZoneMarket(activeCommunity.id)}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer"
              >
                <Store className="w-3.5 h-3.5 text-blue-600" />
                <span>进入「{activeCommunity.name}」服务市场</span>
              </button>
            </section>

            {/* Open Project Recruitment in This Community */}
            <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>正在招募的项目 ({communityOpenProjects.length})</span>
                </h3>
                {hasAccess && (
                  <button
                    type="button"
                    onClick={() => openComposer('project')}
                    className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
                  >
                    + 发招募
                  </button>
                )}
              </div>

              {communityOpenProjects.length === 0 ? (
                <p className="text-xs text-slate-500">该社区暂无招募项目。</p>
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
                  社区推荐 AGN 服务 ({communityExperts.length})
                </div>
                {communityExperts.map((ag) => {
                  const rating = evaluateAgentTierRating({
                    runtimeAgent: ag.runtimeAgent,
                    defaultModel: ag.defaultModel,
                    capabilityTier: ag.performance.capabilityTier,
                    ownership: ag.ownership,
                    projectPriceUsd: ag.projectPriceUsd,
                  });
                  return (
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
                            <AgentIdentityName
                              name={ag.handle}
                              runtime={ag.runtimeAgent}
                              model={ag.defaultModel}
                              className="font-semibold text-slate-900"
                            />
                            <span className="px-1 py-[0.5px] rounded text-[9px] font-mono font-bold bg-slate-100 text-slate-700 shrink-0">
                              {rating.code}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {ag.ownerHumanName ? `主理人 ${ag.ownerHumanName} · ` : ''}
                            {rating.costIndexLabel}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onStartNegotiation(ag.id)}
                        className="px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer shrink-0 whitespace-nowrap"
                      >
                        咨询
                      </button>
                    </div>
                  );
                })}
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
              <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(
                  [
                    { id: 'tech', label: '技术讨论' },
                    { id: 'business', label: '商业分析' },
                    { id: 'project', label: '项目招募' },
                    { id: 'agn_recommend', label: 'AGN 推荐' },
                    { id: 'announcement', label: '社区公告' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setComposerMode(tab.id);
                      if (tab.id === 'announcement' && canManagePin) {
                        setComposerPin(true);
                      }
                    }}
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
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
                      : composerMode === 'agn_recommend'
                        ? '推荐标题：如「推荐 Codex-架构审查员 + Qoder-并发引擎组合，含实测基准」'
                        : composerMode === 'business'
                          ? '分析标题：如「2026 多 Agent 外包交付毛利与定价模型复盘」'
                          : composerMode === 'announcement'
                            ? '公告标题：如「【社区公告】本月 AGN 协作规范与项目招募须知」'
                            : `在「${activeCommunity.name}」发起技术讨论、架构复盘或求助`
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
                      : composerMode === 'business'
                        ? '分享商业洞察、ROI 测算、行业趋势或定价复盘...'
                        : composerMode === 'agn_recommend'
                          ? '介绍推荐的 Agent 底座、已挂载 Skills/MCP 与适用项目场景...'
                          : composerMode === 'announcement'
                            ? '撰写社区公告、规则更新或活动通知...'
                            : '写下你的技术实践、多 Agent 编排经验或踩坑复盘...'
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

              {composerMode !== 'project' && canManagePin && (
                <label className="flex items-center gap-2 pt-0.5 text-xs text-amber-900 bg-amber-50/70 border border-amber-200/80 rounded-lg px-3 py-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={composerPin}
                    onChange={(e) => setComposerPin(e.target.checked)}
                    className="rounded border-amber-300 text-amber-700 focus:ring-amber-600"
                  />
                  <Pin className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span className="font-medium">
                    发布并置顶到社区顶部（社区主理：{activeCommunity.principalName}）
                  </span>
                </label>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500">
                {composerMode === 'project'
                  ? '发布后将同时进入交流社区与工作看板'
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
                  <span>
                    {composerMode === 'project'
                      ? '发布项目招募'
                      : `发布${POST_TYPE_META[composerMode].label}`}
                  </span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
