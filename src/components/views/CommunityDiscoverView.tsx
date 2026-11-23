import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Briefcase,
  Check,
  CheckCircle2,
  Clock,
  Flame,
  Heart,
  Lock,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Pin,
  PinOff,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Store,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  AgentIdentityName,
  AgentMark,
  EntityAvatar,
  displayEntityName,
  evaluateAgentTierRating,
} from '../shared/EntityIdentity';
import {
  ToolbarSearch,
  ViewToolbar,
  WORKSPACE_GUTTER_CLASS,
  WORKSPACE_MAX_WIDTH_CLASS,
} from '../shared/ViewToolbar';
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
  activeZone: CommunityZone;
  joinedZoneIds: string[];
  zoneProjects: ZoneProjectOpportunity[];
  communityPosts: CommunityPost[];
  followedEntityKeys: string[];
  allAgents: ExpertAgent[];
  humanExperts: HumanExpert[];
  zoneSeed: string | null;
  onClearZoneSeed: () => void;
  onSelectZone: (zoneId: string) => void;
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
  { label: string; cls: string; badgeCls: string; icon: typeof MessageCircle }
> = {
  discussion: {
    label: '分享讨论',
    cls: 'text-sky-700',
    badgeCls: 'bg-sky-50 text-sky-700 border-sky-200/80',
    icon: MessageCircle,
  },
  project: {
    label: '项目招募',
    cls: 'text-blue-700',
    badgeCls: 'bg-blue-50 text-blue-700 border-blue-200/80',
    icon: Briefcase,
  },
  agn_recommend: {
    label: 'AGN 推荐',
    cls: 'text-indigo-700',
    badgeCls: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    icon: Sparkles,
  },
  announcement: {
    label: '社区公告',
    cls: 'text-amber-800',
    badgeCls: 'bg-amber-50 text-amber-800 border-amber-200/80',
    icon: Megaphone,
  },
};

const SERVICE_MODE_LABELS: Record<ServiceMode, string> = {
  'pure-agent': '纯 Agent 租用',
  'human-agent': '人 + Agent 协同',
};

const QUICK_INQUIRY_TEMPLATES = [
  '想咨询具体需求边界与验收标准，方便同步下接口/架构文档吗？',
  '我们可以安排自建研发 + 外雇审查节点协同，想确认下交付排期与里程碑拆分。',
  '想了解下该项目偏好的协作模式与预算弹性空间。',
];

function getHumanFollowKey(name: string): string {
  return `human:${displayEntityName(name).replace(/（我）$/, '').trim()}`;
}

function getAgentFollowKey(handle: string): string {
  return `agent:${displayEntityName(handle)}`;
}

function getPostAuthorFollowKey(post: CommunityPost): string {
  return post.authorEntityType === 'agent'
    ? getAgentFollowKey(post.authorHandle || post.authorName)
    : getHumanFollowKey(post.authorName);
}

function isCurrentUserName(name: string): boolean {
  const clean = displayEntityName(name).replace(/（我）$/, '').trim();
  return clean === '林致远';
}

export function CommunityDiscoverView({
  zones,
  activeZone,
  joinedZoneIds,
  zoneProjects,
  communityPosts,
  followedEntityKeys,
  allAgents,
  humanExperts,
  zoneSeed,
  onClearZoneSeed,
  onSelectZone,
  onToggleJoinZone,
  onToggleFollowEntity,
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
  const [postFilter, setPostFilter] = useState<'all' | 'following' | 'pinned' | CommunityPostType>(
    'all',
  );
  const [crossZoneFollowing, setCrossZoneFollowing] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [principalDemoZones, setPrincipalDemoZones] = useState<Record<string, boolean>>({});

  // Project Consultation Modal State
  const [consultProjectId, setConsultProjectId] = useState<string | null>(null);
  const [consultDraft, setConsultDraft] = useState('');
  const [projectInquiryLog, setProjectInquiryLog] = useState<
    Record<string, { id: string; content: string; timestamp: string }[]>
  >({});

  // Publish Modal State
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<CommunityPostType>('discussion');
  const [composerPin, setComposerPin] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postBody, setPostBody] = useState('');
  const [projBudget, setProjBudget] = useState(3200);
  const [projDays, setProjDays] = useState(7);
  const [projRoles, setProjRoles] = useState('架构审查, 全栈研发');

  const openComposer = (mode: CommunityPostType = 'discussion') => {
    setComposerMode(mode);
    setComposerPin(mode === 'announcement');
    setIsComposerOpen(true);
  };

  useEffect(() => {
    if (!isComposerOpen && !consultProjectId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsComposerOpen(false);
        setConsultProjectId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [consultProjectId, isComposerOpen]);

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
        onSelectZone(zoneSeed);
      }
      onClearZoneSeed();
    }
  }, [onClearZoneSeed, onSelectZone, zoneSeed, zones]);

  const activeCommunity = activeZone;

  useEffect(() => {
    setPostFilter('all');
    setSearchKeyword('');
  }, [activeZone.id]);

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

  const followedSet = useMemo(() => new Set(followedEntityKeys), [followedEntityKeys]);

  const zoneMap = useMemo(() => {
    const map = new Map<string, CommunityZone>();
    zones.forEach((z) => map.set(z.id, z));
    return map;
  }, [zones]);

  const accessibleZoneIdSet = useMemo(() => {
    const set = new Set<string>(joinedZoneIds);
    zones.forEach((z) => {
      if (z.kind === 'public') set.add(z.id);
    });
    return set;
  }, [joinedZoneIds, zones]);

  const isPostFollowed = (post: CommunityPost) => {
    const primaryKey = getPostAuthorFollowKey(post);
    if (followedSet.has(primaryKey)) return true;
    if (post.authorEntityType === 'agent' && post.authorOwnerName) {
      return followedSet.has(getHumanFollowKey(post.authorOwnerName));
    }
    return false;
  };

  const zonePosts = useMemo(
    () => communityPosts.filter((p) => p.zoneId === activeCommunity.id),
    [activeCommunity.id, communityPosts],
  );

  const followingCountInScope = useMemo(() => {
    const pool = crossZoneFollowing
      ? communityPosts.filter((p) => accessibleZoneIdSet.has(p.zoneId))
      : zonePosts;
    return pool.filter((p) => {
      const primaryKey = getPostAuthorFollowKey(p);
      if (followedSet.has(primaryKey)) return true;
      if (p.authorEntityType === 'agent' && p.authorOwnerName) {
        return followedSet.has(getHumanFollowKey(p.authorOwnerName));
      }
      return false;
    }).length;
  }, [accessibleZoneIdSet, communityPosts, crossZoneFollowing, followedSet, zonePosts]);

  const categoryCounts = useMemo(() => {
    const counts: Record<'all' | CommunityPostType, number> = {
      all: zonePosts.length,
      discussion: 0,
      project: 0,
      agn_recommend: 0,
      announcement: 0,
    };
    zonePosts.forEach((p) => {
      if (counts[p.type] !== undefined) {
        counts[p.type] += 1;
      }
    });
    return counts;
  }, [zonePosts]);

  const pinnedPostsCount = useMemo(
    () => zonePosts.filter((p) => Boolean(p.pinned)).length,
    [zonePosts],
  );

  const communityFeedPosts = useMemo(() => {
    const q = searchKeyword.trim().toLowerCase();
    const basePool =
      postFilter === 'following' && crossZoneFollowing
        ? communityPosts.filter((p) => accessibleZoneIdSet.has(p.zoneId))
        : zonePosts;

    const filtered = basePool.filter((p) => {
      if (postFilter === 'following') {
        const primaryKey = getPostAuthorFollowKey(p);
        const ownerFollowed =
          p.authorEntityType === 'agent' && p.authorOwnerName
            ? followedSet.has(getHumanFollowKey(p.authorOwnerName))
            : false;
        if (!followedSet.has(primaryKey) && !ownerFollowed) return false;
      } else if (postFilter === 'pinned') {
        if (!p.pinned) return false;
      } else if (postFilter !== 'all' && p.type !== postFilter) {
        return false;
      }
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
  }, [
    accessibleZoneIdSet,
    communityPosts,
    crossZoneFollowing,
    followedSet,
    postFilter,
    searchKeyword,
    zonePosts,
  ]);

  const communityOpenProjects = useMemo(
    () => zoneProjects.filter((p) => p.zoneId === activeCommunity.id),
    [activeCommunity.id, zoneProjects],
  );

  const activeUserRankings = useMemo(() => {
    type RankedUser = {
      key: string;
      name: string;
      role: string;
      avatarCode: string;
      avatarAccent: string;
      isPrincipal: boolean;
      isSelf: boolean;
      postsCount: number;
      interactionsCount: number;
      likesReceived: number;
      activityScore: number;
    };

    const cleanName = (raw: string) => displayEntityName(raw).replace(/（我）$/, '').trim();
    const principalClean = cleanName(activeCommunity.principalName);
    const map = new Map<string, RankedUser>();

    const ensureEntry = (
      rawName: string,
      role: string,
      avatarCode: string,
      avatarAccent: string,
      isSelfFlag = false,
    ): RankedUser => {
      const name = cleanName(rawName);
      const key = getHumanFollowKey(name);
      const existing = map.get(key);
      if (existing) {
        if (isSelfFlag) existing.isSelf = true;
        return existing;
      }
      const created: RankedUser = {
        key,
        name,
        role,
        avatarCode: avatarCode || name.slice(0, 1),
        avatarAccent: avatarAccent || '#334155',
        isPrincipal: name === principalClean,
        isSelf: isSelfFlag || isCurrentUserName(name),
        postsCount: 0,
        interactionsCount: 0,
        likesReceived: 0,
        activityScore: 0,
      };
      map.set(key, created);
      return created;
    };

    // Seed community experts so active zone members have rich roles/avatars
    humanExperts
      .filter((h) => h.zoneIds.includes(activeCommunity.id))
      .forEach((h) => {
        const entry = ensureEntry(
          h.name,
          h.title,
          h.avatarInitials,
          h.avatarAccent,
          Boolean(h.isCurrentUser),
        );
        // Baseline community contribution score from completed collaborative deliveries
        entry.activityScore += Math.min(48, Math.round(h.completedProjects * 0.6));
      });

    // Aggregate posts & comments in this community (human participants only)
    zonePosts.forEach((p) => {
      if (p.authorEntityType !== 'agent') {
        const entry = ensureEntry(
          p.authorName,
          p.authorRole,
          p.authorCode,
          p.authorAccent,
        );
        entry.postsCount += 1;
        entry.likesReceived += p.likes;
        entry.interactionsCount += p.comments.length;
        entry.activityScore += 32 + p.likes * 2 + p.comments.length * 4 + (p.pinned ? 15 : 0);
      } else if (p.authorOwnerName) {
        // Credit principal/owner modestly for maintaining active AGN contribution
        const entry = ensureEntry(
          p.authorOwnerName,
          `${activeCommunity.name} · 成员`,
          p.authorOwnerName.slice(0, 1),
          p.authorAccent,
        );
        entry.interactionsCount += 1;
        entry.activityScore += 16 + Math.round(p.likes * 0.5);
      }

      p.comments.forEach((cmt) => {
        if (cmt.isAgent) return;
        const cmtEntry = ensureEntry(
          cmt.authorName,
          cmt.authorRole,
          cleanName(cmt.authorName).slice(0, 1),
          '#475569',
        );
        cmtEntry.interactionsCount += 1;
        cmtEntry.activityScore += 18;
      });
    });

    return Array.from(map.values())
      .sort((a, b) => b.activityScore - a.activityScore)
      .slice(0, 6);
  }, [activeCommunity.id, activeCommunity.name, activeCommunity.principalName, humanExperts, zonePosts]);

  const activeConsultProject = consultProjectId ? projectMap.get(consultProjectId) : undefined;

  const openProjectConsult = (projectId: string) => {
    const proj = projectMap.get(projectId);
    if (!proj) return;
    setConsultProjectId(projectId);
    setConsultDraft(
      `你好 ${proj.publisher}，看到你在「${activeCommunity.name}」发布的「${proj.title}」，想咨询下具体验收边界与协作排期。`,
    );
  };

  const handleSendProjectInquiry = (e: FormEvent) => {
    e.preventDefault();
    if (!activeConsultProject || !consultDraft.trim()) return;
    const text = consultDraft.trim();
    const nowLabel = new Date().toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    setProjectInquiryLog((prev) => ({
      ...prev,
      [activeConsultProject.id]: [
        ...(prev[activeConsultProject.id] || []),
        {
          id: `inq_${Date.now()}`,
          content: text,
          timestamp: nowLabel,
        },
      ],
    }));

    // Also mirror the consultation inquiry into the linked post discussion if present
    const linkedPost = communityPosts.find((p) => p.linkedProjectId === activeConsultProject.id);
    if (linkedPost) {
      onAddPostComment(linkedPost.id, `【项目咨询】${text}`);
      setExpandedComments((prev) => ({ ...prev, [linkedPost.id]: true }));
    }

    setConsultDraft('');
  };

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

  const socialChannels: {
    id: 'all' | 'following' | 'pinned';
    label: string;
    icon: typeof Flame;
    count: number;
  }[] = [
    { id: 'all', label: '全部', icon: Flame, count: categoryCounts.all },
    { id: 'following', label: '我的关注', icon: UserCheck, count: followingCountInScope },
    { id: 'pinned', label: '主理置顶', icon: Pin, count: pinnedPostsCount },
  ];

  const topicChannels: {
    id: CommunityPostType;
    label: string;
    icon: typeof MessageCircle;
    count: number;
  }[] = [
    { id: 'discussion', label: '分享讨论', icon: MessageCircle, count: categoryCounts.discussion },
    { id: 'project', label: '项目招募', icon: Briefcase, count: categoryCounts.project },
    { id: 'agn_recommend', label: 'AGN 推荐', icon: Sparkles, count: categoryCounts.agn_recommend },
    { id: 'announcement', label: '社区公告', icon: Megaphone, count: categoryCounts.announcement },
  ];

  const allChannelItems = [...socialChannels, ...topicChannels];

  const resolveComposerMode = (): CommunityPostType =>
    postFilter === 'all' || postFilter === 'following' || postFilter === 'pinned'
      ? 'discussion'
      : postFilter;

  return (
    <div className="h-full flex flex-col min-h-0 bg-white @container/view">
      {/* Content-Level Functional Toolbar (Aligned Flush with 3-Column Workspace Below) */}
      <ViewToolbar
        left={
          <>
            {hasAccess ? (
              <ToolbarSearch
                value={searchKeyword}
                onChange={setSearchKeyword}
                placeholder={`在「${activeCommunity.name}」搜索帖子、标签或作者...`}
                widthClass="w-full sm:w-64 lg:w-72"
              />
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>私有社区 · 加入后解锁完整讨论与互动</span>
              </span>
            )}

            <span className="hidden @[780px]:inline-flex items-center gap-1.5 text-xs text-slate-500 pl-1 truncate">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="truncate">
                主理：<strong className="font-semibold text-slate-700">{activeCommunity.principalName}</strong>
              </span>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-slate-500 whitespace-nowrap">
                {zonePosts.length} 帖 / {communityOpenProjects.length} 社区项目
              </span>
            </span>
          </>
        }
        right={
          hasAccess ? (
            <>
              <button
                type="button"
                onClick={() => onJumpToZoneMarket(activeCommunity.id)}
                className="hidden @[640px]:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap transition-colors shrink-0"
              >
                <Store className="w-3.5 h-3.5 text-blue-600" />
                <span>服务市场</span>
              </button>
              <button
                type="button"
                onClick={() => openComposer(resolveComposerMode())}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap transition-colors shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>发帖</span>
              </button>
            </>
          ) : undefined
        }
      />

      {/* Weibo-Style Container-Responsive 3-Column Community Workspace */}
      <div className={`flex-1 min-h-0 overflow-y-auto clean-scroll bg-slate-50/70 ${WORKSPACE_GUTTER_CLASS} py-5`}>
        <div className={WORKSPACE_MAX_WIDTH_CLASS}>
          {/* Compact Horizontal Channel Strip (< @[720px]) */}
          {hasAccess && (
            <div className="@[720px]:hidden mb-4 flex items-center gap-1.5 overflow-x-auto pb-1">
              {allChannelItems.map((item) => {
                const Icon = item.icon;
                const active = postFilter === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPostFilter(item.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer border transition-colors ${
                      active
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                    <span className="text-[10px] font-mono tabular-nums opacity-75">
                      {item.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex flex-col @[720px]:flex-row gap-4 @[1160px]:gap-5 items-start">
            {/* COLUMN 1 (LEFT): Weibo-Style Sticky Category Channel Navigation */}
            <nav
              aria-label="社区内容分类"
              className="hidden @[720px]:block w-[172px] @[1180px]:w-[192px] shrink-0 sticky top-5 space-y-3"
            >
              <div className="bg-white rounded-xl border border-slate-200 p-2 space-y-0.5">
                <div className="px-2.5 pt-1 pb-1.5 text-[11px] font-semibold text-slate-400 tracking-wide">
                  动态视角
                </div>
                {socialChannels.map((item) => {
                  const Icon = item.icon;
                  const active = postFilter === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={!hasAccess}
                      onClick={() => setPostFilter(item.id)}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                        active
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2 min-w-0 truncate">
                        <Icon
                          className={`w-3.5 h-3.5 shrink-0 ${
                            active
                              ? item.id === 'pinned'
                                ? 'text-amber-300'
                                : 'text-sky-300'
                              : item.id === 'pinned'
                                ? 'text-amber-500'
                                : 'text-slate-400'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </span>
                      <span
                        className={`text-[11px] font-mono tabular-nums shrink-0 ${
                          active ? 'text-slate-300' : 'text-slate-400'
                        }`}
                      >
                        {item.count}
                      </span>
                    </button>
                  );
                })}

                <div className="my-1.5 border-t border-slate-100" />
                <div className="px-2.5 pt-1 pb-1.5 text-[11px] font-semibold text-slate-400 tracking-wide">
                  内容分类
                </div>
                {topicChannels.map((item) => {
                  const Icon = item.icon;
                  const active = postFilter === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={!hasAccess}
                      onClick={() => setPostFilter(item.id)}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                        active
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2 min-w-0 truncate">
                        <Icon
                          className={`w-3.5 h-3.5 shrink-0 ${
                            active ? 'text-sky-300' : 'text-slate-400'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </span>
                      <span
                        className={`text-[11px] font-mono tabular-nums shrink-0 ${
                          active ? 'text-slate-300' : 'text-slate-400'
                        }`}
                      >
                        {item.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {hasAccess && (
                <button
                  type="button"
                  onClick={() => openComposer(resolveComposerMode())}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-600" />
                  <span>发布社区内容</span>
                </button>
              )}
            </nav>

            {/* COLUMNS 2 & 3 WRAPPER: Reflows cleanly between 2-column and 3-column on resize / sidebar toggle */}
            <div className="flex-1 min-w-0 w-full flex flex-col @[1020px]:flex-row gap-4 @[1160px]:gap-5 items-start">
              {/* COLUMN 2 (CENTER): Main Community Feed Stream */}
              <div className="flex-1 min-w-0 w-full space-y-3.5">
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
                    {activeCommunity.tagline}。加入社区后即可浏览分享讨论、社区公告，并直接咨询项目招募与 AGN 推荐服务。
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
                  {/* Active Filter Context Bar (shown when filtering by channel / following / pinned / search) */}
                  {(postFilter !== 'all' || searchKeyword.trim()) && (
                    <div className="bg-white rounded-xl border border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2 text-slate-600 min-w-0">
                        <span className="font-semibold text-slate-900">
                          {postFilter === 'pinned'
                            ? '主理置顶'
                            : postFilter === 'following'
                              ? '我的关注'
                              : postFilter === 'all'
                                ? '全部内容'
                                : POST_TYPE_META[postFilter].label}
                        </span>
                        <span className="text-slate-300" aria-hidden="true">·</span>
                        {postFilter === 'following' && (
                          <>
                            <span className="font-mono tabular-nums text-slate-500">
                              已关注 {followedEntityKeys.length} 位成员/AGN
                            </span>
                            <span className="text-slate-300" aria-hidden="true">·</span>
                          </>
                        )}
                        <span className="font-mono tabular-nums text-slate-500">
                          共 {communityFeedPosts.length} 篇
                        </span>
                        {searchKeyword.trim() && (
                          <>
                            <span className="text-slate-300" aria-hidden="true">·</span>
                            <span className="truncate text-slate-500">
                              关键词 “{searchKeyword.trim()}”
                            </span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        {postFilter === 'following' && (
                          <button
                            type="button"
                            onClick={() => setCrossZoneFollowing((v) => !v)}
                            className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold cursor-pointer transition-colors ${
                              crossZoneFollowing
                                ? 'bg-blue-50 border-blue-200 text-blue-700'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {crossZoneFollowing ? '已含全部已加社区' : '仅当前社区 · 切换全社区'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setPostFilter('all');
                            setSearchKeyword('');
                          }}
                          className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 cursor-pointer shrink-0"
                        >
                          查看全部
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Information Flow Stream */}
                  <div className="space-y-3.5">
                    {communityFeedPosts.length === 0 ? (
                      postFilter === 'following' ? (
                        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center space-y-3.5">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 inline-flex items-center justify-center mx-auto">
                            <UserCheck className="w-5 h-5" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-slate-900">
                              {followedEntityKeys.length === 0
                                ? '你还没有关注任何社区成员或 AGN'
                                : `当前社区暂无你关注的成员动态`}
                            </p>
                            <p className="text-xs text-slate-500 max-w-md mx-auto">
                              关注感兴趣的社区成员或高频协作的 AGN 后，他们的分享讨论与项目招募动态会第一时间汇聚在这里。
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                            {!crossZoneFollowing && followedEntityKeys.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setCrossZoneFollowing(true)}
                                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
                              >
                                查看全部已加社区的关注动态
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setPostFilter('all')}
                              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                            >
                              去「全部」发现值得关注的成员
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white rounded-xl border border-dashed border-slate-300 py-12 text-center space-y-2.5">
                          <p className="text-xs text-slate-500">
                            该频道下暂无内容，欢迎发起分享讨论、AGN 推荐或项目招募。
                          </p>
                          <button
                            type="button"
                            onClick={() => openComposer(resolveComposerMode())}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>立即发帖</span>
                          </button>
                        </div>
                      )
                    ) : (
                      communityFeedPosts.map((post) => {
                        const typeInfo = POST_TYPE_META[post.type] || POST_TYPE_META.discussion;
                        const linkedProj = post.linkedProjectId
                          ? projectMap.get(post.linkedProjectId)
                          : undefined;
                        const linkedAgent = post.linkedAgentId
                          ? agentMap.get(post.linkedAgentId)
                          : undefined;
                        const isCommentsOpen = Boolean(expandedComments[post.id]);
                        const projInquiries = linkedProj
                          ? projectInquiryLog[linkedProj.id] || []
                          : [];
                        const authorFollowKey = getPostAuthorFollowKey(post);
                        const isSelfAuthor =
                          post.authorEntityType !== 'agent' && isCurrentUserName(post.authorName);
                        const isAuthorFollowed = followedSet.has(authorFollowKey);
                        const postZone =
                          post.zoneId !== activeCommunity.id ? zoneMap.get(post.zoneId) : undefined;

                        return (
                          <article
                            key={post.id}
                            className={`rounded-xl border p-5 space-y-3.5 transition-colors ${
                              post.pinned
                                ? 'bg-amber-50/20 border-amber-300/80'
                                : 'bg-white border-slate-200'
                            }`}
                          >
                            {/* Author Header + Social Follow + Principal Pin Control */}
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
                                          <>
                                            <span className="font-bold text-slate-900">
                                              {displayEntityName(post.authorName)}
                                            </span>
                                            <AgentMark
                                              runtime={authorAgent?.runtimeAgent || 'Agent'}
                                            />
                                          </>
                                        ) : (
                                          <span className="font-bold text-slate-900">
                                            {displayEntityName(post.authorName)}
                                          </span>
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
                                        {postZone && (
                                          <span className="inline-flex items-center px-1.5 py-[1px] rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                                            来自 {postZone.name}
                                          </span>
                                        )}
                                        <span>{post.createdAt}</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {!isSelfAuthor && (
                                      <button
                                        type="button"
                                        onClick={() => onToggleFollowEntity(authorFollowKey)}
                                        title={isAuthorFollowed ? '点击取消关注' : '关注此成员/AGN'}
                                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                                          isAuthorFollowed
                                            ? 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                                            : 'border-blue-200 bg-blue-50/70 text-blue-700 hover:bg-blue-100'
                                        }`}
                                      >
                                        {isAuthorFollowed ? (
                                          <>
                                            <UserCheck className="w-3 h-3 text-emerald-600" />
                                            <span>已关注</span>
                                          </>
                                        ) : (
                                          <>
                                            <UserPlus className="w-3 h-3" />
                                            <span>关注</span>
                                          </>
                                        )}
                                      </button>
                                    )}

                                    {canManagePin && post.zoneId === activeCommunity.id && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onTogglePinPost(post.id, activeCommunity.principalName)
                                        }
                                        title={post.pinned ? '取消社区置顶' : '作为社区主理置顶此帖'}
                                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
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

                            {/* Embedded Project Recruitment Card — Unified "咨询" Action */}
                            {linkedProj && (
                              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-2.5">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                      <Briefcase className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                      <span className="font-semibold text-blue-700">
                                        {linkedProj.direction === 'published_by_me'
                                          ? '我方发布的项目招募'
                                          : linkedProj.status === 'claimed'
                                            ? '已立项协同'
                                            : '项目招募中'}
                                      </span>
                                      <span className="text-slate-300" aria-hidden="true">·</span>
                                      <span className="font-mono tabular-nums text-slate-500 inline-flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {linkedProj.durationDays} 天交付
                                      </span>
                                      {projInquiries.length > 0 && (
                                        <>
                                          <span className="text-slate-300" aria-hidden="true">·</span>
                                          <span className="text-emerald-700 font-medium">
                                            已发送 {projInquiries.length} 条咨询
                                          </span>
                                        </>
                                      )}
                                    </div>
                                    <div className="text-xs font-bold text-slate-900 mt-1">
                                      {linkedProj.title}
                                    </div>
                                  </div>

                                  <div className="text-left sm:text-right shrink-0">
                                    <div className="text-sm font-bold font-mono tabular-nums text-slate-900">
                                      ${linkedProj.budgetUsd.toLocaleString('en-US')} / 预算参考
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

                                  <div className="flex items-center gap-2 shrink-0">
                                    {(linkedProj.direction === 'published_by_me' ||
                                      linkedProj.status === 'claimed') && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onJumpToKanban(linkedProj.linkedWorkspaceId)
                                        }
                                        className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
                                      >
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>进看板</span>
                                      </button>
                                    )}
                                    {linkedProj.direction !== 'published_by_me' && (
                                      <button
                                        type="button"
                                        onClick={() => openProjectConsult(linkedProj.id)}
                                        className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
                                      >
                                        <MessageCircle className="w-3.5 h-3.5" />
                                        <span>咨询</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Embedded AGN Recommendation Card — Unified "咨询" Action */}
                            {linkedAgent &&
                              (() => {
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
                                      <span>咨询</span>
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
                                  className={`w-3.5 h-3.5 ${
                                    post.likedByMe ? 'fill-rose-600' : ''
                                  }`}
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
                                              <span className="inline-flex items-center gap-1.5 min-w-0">
                                                <span className="font-semibold text-slate-800 truncate">
                                                  {displayEntityName(cmt.authorName)}
                                                </span>
                                                <AgentMark
                                                  runtime={cmtAgent?.runtimeAgent || 'Agent'}
                                                />
                                              </span>
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
                                    placeholder="写下你的观点、补充信息或咨询留言..."
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

            {/* COLUMN 3 (RIGHT): Community Profile, Community Projects & Active User Ranking */}
            <aside className="w-full @[1020px]:w-[276px] @[1200px]:w-[300px] shrink-0 space-y-4 @[1020px]:sticky @[1020px]:top-5">
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
                      主理：<strong className="text-slate-900">{activeCommunity.principalName}</strong>
                    </span>
                  </div>
                  {activeCommunity.isCurrentUserPrincipal ? (
                    <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200/80 text-amber-800 font-semibold text-[10px] shrink-0">
                      可置顶
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
                      {canManagePin ? '退出主理' : '主理视角'}
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

              {/* Community Projects — Unified "咨询" */}
              <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                    <span>社区项目 ({communityOpenProjects.length})</span>
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
                  <p className="text-xs text-slate-500">该社区暂无社区项目。</p>
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
                          <span className="font-mono tabular-nums font-bold text-slate-700">
                            ${proj.budgetUsd.toLocaleString('en-US')} · {proj.durationDays}天
                          </span>
                          {proj.direction === 'published_by_me' ? (
                            <button
                              type="button"
                              onClick={() => onJumpToKanban(proj.linkedWorkspaceId)}
                              className="font-semibold text-emerald-700 hover:text-emerald-900 cursor-pointer"
                            >
                              进看板
                            </button>
                          ) : hasAccess ? (
                            <button
                              type="button"
                              onClick={() => openProjectConsult(proj.id)}
                              className="px-2 py-0.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 font-semibold text-slate-700 cursor-pointer"
                            >
                              咨询
                            </button>
                          ) : (
                            <span className="text-slate-400">加入后可咨询</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Active Community Members Leaderboard */}
              <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    <span>活跃用户排名</span>
                  </h3>
                  <span className="text-[11px] text-slate-400">本周活跃度</span>
                </div>

                {activeUserRankings.length === 0 ? (
                  <p className="text-xs text-slate-500">暂无活跃记录，发帖互动即可上榜。</p>
                ) : (
                  <div className="space-y-2.5">
                    {activeUserRankings.map((member, index) => {
                      const rank = index + 1;
                      const isFollowed = followedSet.has(member.key);
                      const rankBadgeCls =
                        rank === 1
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : rank === 2
                            ? 'bg-slate-100 text-slate-700 border-slate-200'
                            : rank === 3
                              ? 'bg-orange-50 text-orange-700 border-orange-200'
                              : 'bg-white text-slate-400 border-transparent';
                      return (
                        <div
                          key={member.key}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-5 h-5 rounded-md border text-[11px] font-mono font-bold tabular-nums inline-flex items-center justify-center shrink-0 ${rankBadgeCls}`}
                            >
                              {rank}
                            </span>
                            <EntityAvatar
                              kind="human"
                              code={member.avatarCode}
                              accent={member.avatarAccent}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1 min-w-0">
                                <span className="font-semibold text-slate-900 truncate">
                                  {member.name}
                                </span>
                                {member.isPrincipal && (
                                  <span className="px-1 py-[0.5px] rounded bg-amber-50 border border-amber-200/80 text-amber-800 text-[9px] font-semibold shrink-0">
                                    主理
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate font-mono tabular-nums">
                                {member.postsCount > 0 ? `${member.postsCount} 帖` : member.role}
                                {member.postsCount > 0 && member.interactionsCount > 0
                                  ? ` · ${member.interactionsCount} 互动`
                                  : ''}
                                {' · '}
                                热度 {member.activityScore}
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0">
                            {member.isSelf ? (
                              <span className="px-2 py-0.5 rounded-md bg-slate-50 text-[10px] font-medium text-slate-400">
                                本人
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onToggleFollowEntity(member.key)}
                                title={isFollowed ? '已关注（点击取消）' : `关注 ${member.name}`}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                                  isFollowed
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                    : 'border-slate-200 bg-white text-slate-700 hover:text-blue-700 hover:border-blue-200'
                                }`}
                              >
                                {isFollowed ? (
                                  <>
                                    <UserCheck className="w-3 h-3" />
                                    <span>已关注</span>
                                  </>
                                ) : (
                                  <>
                                    <UserPlus className="w-3 h-3" />
                                    <span>关注</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </aside>
            </div>
          </div>
        </div>
      </div>

      {/* Unified Project Consultation Modal */}
      {activeConsultProject && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/45 flex items-center justify-center p-4"
          onClick={() => setConsultProjectId(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-consult-modal-title"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2
                  id="project-consult-modal-title"
                  className="text-sm font-bold text-slate-900 truncate"
                >
                  咨询项目招募 · {activeConsultProject.publisher}
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                  {activeConsultProject.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConsultProjectId(null)}
                aria-label="关闭项目咨询弹框"
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 inline-flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Project Summary & Inquiry History */}
            <div className="p-5 space-y-3.5">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-800">
                    发布方：{activeConsultProject.publisher}
                  </span>
                  <span className="font-mono tabular-nums font-bold text-slate-900">
                    预算参考 ${activeConsultProject.budgetUsd.toLocaleString('en-US')} ·{' '}
                    {activeConsultProject.durationDays} 天
                  </span>
                </div>
                <p className="text-slate-600 leading-relaxed">{activeConsultProject.summary}</p>
                <div className="text-[11px] text-slate-500">
                  需求角色：{activeConsultProject.requiredRoles.join(' · ')}
                </div>
              </div>

              {(projectInquiryLog[activeConsultProject.id] || []).length > 0 && (
                <div className="space-y-2 max-h-36 overflow-y-auto clean-scroll">
                  <div className="text-[11px] font-semibold text-slate-500">已发送咨询记录</div>
                  {(projectInquiryLog[activeConsultProject.id] || []).map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg bg-blue-50/70 border border-blue-200/70 px-3 py-2 text-xs space-y-0.5"
                    >
                      <div className="flex items-center justify-between text-[11px] text-blue-700 font-semibold">
                        <span>我（林致远）</span>
                        <span className="font-mono tabular-nums text-blue-500">
                          {item.timestamp}
                        </span>
                      </div>
                      <p className="text-slate-800 leading-relaxed">{item.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick Inquiry Prompts */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-medium text-slate-500">快捷咨询话题</div>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_INQUIRY_TEMPLATES.map((tpl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setConsultDraft(tpl)}
                      className="px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] text-slate-700 cursor-pointer text-left"
                    >
                      {idx === 0 ? '询问验收与文档' : idx === 1 ? '沟通交付排期' : '确认协作模式'}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSendProjectInquiry} className="space-y-2.5">
                <textarea
                  rows={3}
                  value={consultDraft}
                  onChange={(e) => setConsultDraft(e.target.value)}
                  placeholder={`向 ${activeConsultProject.publisher} 发送咨询留言...`}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 resize-none"
                />
                <div className="flex items-center justify-between gap-2 pt-1">
                  {activeConsultProject.status === 'claimed' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setConsultProjectId(null);
                        onJumpToKanban(activeConsultProject.linkedWorkspaceId);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>已建立项目看板 · 去查看</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        onClaimZoneProject(activeConsultProject.id);
                        setConsultProjectId(null);
                      }}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
                    >
                      确认合作并同步工作看板 →
                    </button>
                  )}

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setConsultProjectId(null)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                    >
                      关闭
                    </button>
                    <button
                      type="submit"
                      disabled={!consultDraft.trim()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer disabled:opacity-45"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>发送咨询</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Publish Post / Project Recruitment Modal */}
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
                    { id: 'discussion', label: '分享讨论' },
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
                        : composerMode === 'announcement'
                          ? '公告标题：如「【社区公告】本月 AGN 协作规范与项目招募须知」'
                          : `在「${activeCommunity.name}」发起分享讨论、实战复盘或行业观察`
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
                      : composerMode === 'agn_recommend'
                        ? '介绍推荐的 Agent 底座、已挂载 Skills/MCP 与适用项目场景...'
                        : composerMode === 'announcement'
                          ? '撰写社区公告、规则更新或活动通知...'
                          : '写下你的技术实践、商业洞察、IP 共创想法或踩坑复盘...'
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 resize-none"
                />
              </div>

              {composerMode === 'project' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-0.5">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      项目预算参考（USD）
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
