import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Blocks,
  Briefcase,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Flame,
  Heart,
  Lock,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Pin,
  PinOff,
  Plus,
  Rocket,
  Send,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  CommunityEventInlineCard,
  CommunityEventsPanel,
} from '../community/CommunityEventsPanel';
import {
  AgentIdentityName,
  AgentMark,
  EntityAvatar,
  displayEntityName,
  evaluateAgentTierRating,
  getSkillPurchasePricing,
} from '../shared/EntityIdentity';
import { EmptyStateCard, ModalShell } from '../shared/UiPrimitives';
import {
  RailNavButton,
  RailSectionLabel,
  ToolbarDropdown,
  ToolbarSearch,
  ViewToolbar,
  WORKSPACE_GUTTER_CLASS,
  WORKSPACE_MAX_WIDTH_CLASS,
  WorkspacePrimaryRail,
} from '../shared/ViewToolbar';
import type {
  AgentCategory,
  CommunityEvent,
  CommunityEventFormat,
  CommunityPost,
  CommunityPostType,
  CommunityZone,
  ExpertAgent,
  HumanExpert,
  MarketSkill,
  PublishCommunityEventInput,
  ServiceMode,
  SkillKind,
  ZoneProjectOpportunity,
} from '../../types/agentnexus';

export type SocialFeedScope = 'all' | 'projects' | 'events' | 'following' | 'pinned';

interface CommunityDiscoverViewProps {
  zones: CommunityZone[];
  activeZone: CommunityZone;
  joinedZoneIds: string[];
  zoneProjects: ZoneProjectOpportunity[];
  communityEvents?: CommunityEvent[];
  communityPosts: CommunityPost[];
  followedEntityKeys: string[];
  allAgents: ExpertAgent[];
  privateAgents?: ExpertAgent[];
  humanExperts: HumanExpert[];
  marketSkills?: MarketSkill[];
  purchasedSkillIds?: string[];
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
    linkedEventId?: string;
    linkedAgentId?: string;
    linkedSkillId?: string;
  }) => void;
  onPublishSkill?: (input: {
    zoneId: string;
    name: string;
    summary: string;
    kind: SkillKind;
    category: AgentCategory;
    priceUsd: number;
    postContent?: string;
  }) => string;
  onAcquireSkill?: (
    skillId: string,
    skillName?: string,
    priceUsd?: number,
    sourceZoneId?: string,
  ) => void;
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
  onPublishEvent?: (input: PublishCommunityEventInput) => string;
  onToggleRegisterEvent?: (eventId: string, note?: string) => void;
  onStartNegotiation: (agentId: string) => void;
  onJumpToZoneMarket: (zoneId: string) => void;
  onJumpToKanban: (projectId?: string) => void;
  embeddedMode?: boolean;
  controlledFeedScope?: SocialFeedScope;
  onChangeFeedScope?: (scope: SocialFeedScope) => void;
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
    label: '项目共创',
    cls: 'text-blue-700',
    badgeCls: 'bg-blue-50 text-blue-700 border-blue-200/80',
    icon: Rocket,
  },
  event: {
    label: '主题活动',
    cls: 'text-violet-700',
    badgeCls: 'bg-violet-50 text-violet-700 border-violet-200/80',
    icon: CalendarDays,
  },
  skill_share: {
    label: '发布 Skill',
    cls: 'text-amber-800',
    badgeCls: 'bg-amber-50 text-amber-800 border-amber-200/80',
    icon: Blocks,
  },
  agn_recommend: {
    label: '专家 Agent',
    cls: 'text-indigo-700',
    badgeCls: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    icon: Sparkles,
  },
  announcement: {
    label: '社区公告',
    cls: 'text-slate-700',
    badgeCls: 'bg-slate-100 text-slate-700 border-slate-200/80',
    icon: Megaphone,
  },
};

const SKILL_KIND_LABELS: Record<SkillKind, string> = {
  skill: 'Skill',
  mcp: 'MCP',
  workflow: '工作流',
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
  communityEvents = [],
  communityPosts,
  followedEntityKeys,
  allAgents,
  privateAgents = [],
  humanExperts,
  marketSkills = [],
  purchasedSkillIds = [],
  zoneSeed,
  onClearZoneSeed,
  onSelectZone,
  onToggleJoinZone,
  onToggleFollowEntity,
  onCreatePost,
  onPublishSkill,
  onAcquireSkill,
  onTogglePinPost,
  onToggleLikePost,
  onAddPostComment,
  onPublishZoneProject,
  onClaimZoneProject,
  onPublishEvent,
  onToggleRegisterEvent,
  onStartNegotiation,
  onJumpToZoneMarket,
  onJumpToKanban,
  embeddedMode = false,
  controlledFeedScope,
  onChangeFeedScope,
}: CommunityDiscoverViewProps) {
  const [internalFeedScope, setInternalFeedScope] = useState<SocialFeedScope>(
    controlledFeedScope || 'all',
  );
  const feedScope = controlledFeedScope ?? internalFeedScope;
  const setFeedScope = (next: SocialFeedScope) => {
    setInternalFeedScope(next);
    onChangeFeedScope?.(next);
  };
  const [topicFilter, setTopicFilter] = useState<'all' | CommunityPostType>('all');
  const [projectStatusFilter, setProjectStatusFilter] = useState<'all' | 'open' | 'claimed'>('all');
  const [eventFormatFilter, setEventFormatFilter] = useState<'all' | CommunityEventFormat>('all');
  const [eventPricingFilter, setEventPricingFilter] = useState<'all' | 'free' | 'paid' | 'registered'>('all');
  const [crossZoneFollowing, setCrossZoneFollowing] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [rankingTab, setRankingTab] = useState<'users' | 'posts'>('users');
  const [copiedSkillId, setCopiedSkillId] = useState<string | null>(null);

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
  // Event publish fields
  const [eventFormat, setEventFormat] = useState<CommunityEventFormat>('offline_meetup');
  const [eventStartTime, setEventStartTime] = useState('12月14日 (周日) 14:00 - 17:30');
  const [eventLocation, setEventLocation] = useState('杭州 · 良渚文化村路演厅');
  const [eventIsFree, setEventIsFree] = useState(false);
  const [eventPriceCny, setEventPriceCny] = useState(199);
  const [eventCapacity, setEventCapacity] = useState(30);
  const [eventAgendaText, setEventAgendaText] = useState('');
  // Skill publish fields
  const [skillName, setSkillName] = useState('');
  const [skillKind, setSkillKind] = useState<SkillKind>('skill');
  const [skillCategory, setSkillCategory] = useState<AgentCategory>('engineering');
  const [skillPrice, setSkillPrice] = useState(0);
  // Expert Agent publish field
  const [selectedPublishAgentId, setSelectedPublishAgentId] = useState<string>(
    privateAgents[0]?.id || '',
  );

  const openComposer = (mode: CommunityPostType = 'discussion') => {
    setComposerMode(mode);
    setComposerPin(mode === 'announcement');
    if (mode === 'agn_recommend' && !selectedPublishAgentId && privateAgents[0]?.id) {
      setSelectedPublishAgentId(privateAgents[0].id);
    }
    setIsComposerOpen(true);
  };

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
    if (!embeddedMode) {
      setInternalFeedScope('all');
    }
    setTopicFilter('all');
    setSearchKeyword('');
  }, [activeZone.id, embeddedMode]);

  const isPublicCommunity = activeCommunity.kind === 'official';
  const hasAccess = isPublicCommunity || joinedZoneIds.includes(activeCommunity.id);
  const canManagePin = Boolean(activeCommunity.isCurrentUserPrincipal);

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

  const skillMap = useMemo(() => {
    const map = new Map<string, MarketSkill>();
    marketSkills.forEach((s) => map.set(s.id, s));
    return map;
  }, [marketSkills]);

  const eventMap = useMemo(() => {
    const map = new Map<string, CommunityEvent>();
    communityEvents.forEach((ev) => map.set(ev.id, ev));
    return map;
  }, [communityEvents]);

  const followedSet = useMemo(() => new Set(followedEntityKeys), [followedEntityKeys]);

  const zoneMap = useMemo(() => {
    const map = new Map<string, CommunityZone>();
    zones.forEach((z) => map.set(z.id, z));
    return map;
  }, [zones]);

  const accessibleZoneIdSet = useMemo(() => {
    const set = new Set<string>(joinedZoneIds);
    zones.forEach((z) => {
      if (z.kind === 'official' && !z.comingSoon) set.add(z.id);
    });
    return set;
  }, [joinedZoneIds, zones]);

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
      event: 0,
      skill_share: 0,
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

  const scopeBasePosts = useMemo(() => {
    const pool =
      feedScope === 'following' && crossZoneFollowing
        ? communityPosts.filter((p) => accessibleZoneIdSet.has(p.zoneId))
        : zonePosts;

    return pool.filter((p) => {
      if (feedScope === 'projects') {
        return p.type === 'project';
      }
      if (feedScope === 'events') {
        return p.type === 'event';
      }
      if (feedScope === 'following') {
        const primaryKey = getPostAuthorFollowKey(p);
        const ownerFollowed =
          p.authorEntityType === 'agent' && p.authorOwnerName
            ? followedSet.has(getHumanFollowKey(p.authorOwnerName))
            : false;
        return followedSet.has(primaryKey) || ownerFollowed;
      }
      if (feedScope === 'pinned') {
        return Boolean(p.pinned);
      }
      return true;
    });
  }, [accessibleZoneIdSet, communityPosts, crossZoneFollowing, feedScope, followedSet, zonePosts]);

  const scopeTopicCounts = useMemo(() => {
    const counts: Record<'all' | CommunityPostType, number> = {
      all: scopeBasePosts.length,
      discussion: 0,
      project: 0,
      event: 0,
      skill_share: 0,
      agn_recommend: 0,
      announcement: 0,
    };
    scopeBasePosts.forEach((p) => {
      if (counts[p.type] !== undefined) {
        counts[p.type] += 1;
      }
    });
    return counts;
  }, [scopeBasePosts]);

  const communityFeedPosts = useMemo(() => {
    const q = searchKeyword.trim().toLowerCase();
    const filtered = scopeBasePosts.filter((p) => {
      if (feedScope !== 'projects' && feedScope !== 'events' && topicFilter !== 'all' && p.type !== topicFilter) return false;
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
  }, [feedScope, scopeBasePosts, searchKeyword, topicFilter]);

  const communityOpenProjects = useMemo(
    () => zoneProjects.filter((p) => p.zoneId === activeCommunity.id),
    [activeCommunity.id, zoneProjects],
  );

  const filteredZoneProjects = useMemo(() => {
    const q = searchKeyword.trim().toLowerCase();
    return communityOpenProjects.filter((p) => {
      if (projectStatusFilter !== 'all' && p.status !== projectStatusFilter) return false;
      if (!q) return true;
      return [p.title, p.summary, p.publisher, ...p.requiredRoles]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [communityOpenProjects, projectStatusFilter, searchKeyword]);

  const communityZoneEvents = useMemo(
    () => communityEvents.filter((ev) => ev.zoneId === activeCommunity.id),
    [activeCommunity.id, communityEvents],
  );

  const filteredZoneEvents = useMemo(() => {
    const q = searchKeyword.trim().toLowerCase();
    return communityZoneEvents.filter((ev) => {
      if (eventFormatFilter !== 'all' && ev.format !== eventFormatFilter) return false;
      if (eventPricingFilter === 'free' && !(ev.isFree || ev.priceCny <= 0)) return false;
      if (eventPricingFilter === 'paid' && (ev.isFree || ev.priceCny <= 0)) return false;
      if (eventPricingFilter === 'registered' && !ev.registeredByMe) return false;
      if (!q) return true;
      return [ev.title, ev.summary, ev.hostName, ev.location, ...ev.tags]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [communityZoneEvents, eventFormatFilter, eventPricingFilter, searchKeyword]);

  const trendingPostsRanking = useMemo(() => {
    return [...zonePosts]
      .sort(
        (a, b) =>
          b.likes * 2 + b.comments.length * 5 - (a.likes * 2 + a.comments.length * 5),
      )
      .slice(0, 6);
  }, [zonePosts]);

  const zoneMarketServiceCount = useMemo(() => {
    const agentCnt = allAgents.filter(
      (a) => a.isListedInMarket && a.listedZoneIds.includes(activeCommunity.id),
    ).length;
    const skillCnt = marketSkills.filter((s) => s.zoneIds.includes(activeCommunity.id)).length;
    return agentCnt + skillCnt;
  }, [activeCommunity.id, allAgents, marketSkills]);

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

  const handleCopySkillCmd = (skill: MarketSkill) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(skill.installCommand).catch(() => {});
    }
    setCopiedSkillId(skill.id);
    window.setTimeout(() => {
      setCopiedSkillId((prev) => (prev === skill.id ? null : prev));
    }, 1800);
  };

  const handleComposerSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (composerMode === 'project') {
      if (!postBody.trim() && !postTitle.trim()) return;
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
    } else if (composerMode === 'event') {
      if (!postTitle.trim() && !postBody.trim()) return;
      const agendaLines = eventAgendaText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      if (onPublishEvent) {
        onPublishEvent({
          zoneId: activeCommunity.id,
          title: postTitle.trim() || postBody.trim().slice(0, 28),
          summary: postBody.trim() || postTitle.trim(),
          format: eventFormat,
          startTimeLabel: eventStartTime.trim(),
          location: eventLocation.trim(),
          isFree: eventIsFree,
          priceCny: eventIsFree ? 0 : eventPriceCny,
          capacity: eventCapacity,
          agenda: agendaLines,
        });
      } else {
        onCreatePost({
          zoneId: activeCommunity.id,
          type: 'event',
          title: postTitle.trim() || postBody.trim().slice(0, 32),
          content: postBody.trim() || postTitle.trim(),
        });
      }
    } else if (composerMode === 'skill_share') {
      const targetName = skillName.trim() || postTitle.trim();
      if (!targetName) return;
      if (onPublishSkill) {
        onPublishSkill({
          zoneId: activeCommunity.id,
          name: targetName,
          summary: postBody.trim() || targetName,
          kind: skillKind,
          category: skillCategory,
          priceUsd: skillPrice,
          postContent: postBody.trim() || targetName,
        });
      } else {
        onCreatePost({
          zoneId: activeCommunity.id,
          type: 'skill_share',
          title: `【发布 Skill】${targetName}`,
          content: postBody.trim() || targetName,
        });
      }
    } else {
      if (!postBody.trim() && !postTitle.trim()) return;
      onCreatePost({
        zoneId: activeCommunity.id,
        type: composerMode,
        title: postTitle.trim() || postBody.trim().slice(0, 32),
        content: postBody.trim() || postTitle.trim(),
        pinned: canManagePin && composerPin,
        pinnedBy: canManagePin && composerPin ? activeCommunity.principalName : undefined,
        linkedAgentId:
          composerMode === 'agn_recommend' && selectedPublishAgentId
            ? selectedPublishAgentId
            : undefined,
      });
    }

    setPostTitle('');
    setPostBody('');
    setSkillName('');
    setSkillPrice(0);
    setEventAgendaText('');
    setComposerPin(false);
    if (composerMode === 'project') {
      setFeedScope('projects');
    } else if (composerMode === 'event') {
      setFeedScope('events');
    } else {
      setFeedScope('all');
    }
    setTopicFilter('all');
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
    id: SocialFeedScope;
    label: string;
    icon: typeof Flame;
    count: number;
  }[] = [
    { id: 'all', label: '全部动态', icon: Flame, count: categoryCounts.all },
    { id: 'projects', label: '项目共创', icon: Rocket, count: communityOpenProjects.length },
    { id: 'events', label: '主题活动', icon: CalendarDays, count: communityZoneEvents.length },
    { id: 'following', label: '我的关注', icon: UserCheck, count: followingCountInScope },
    { id: 'pinned', label: '主理置顶', icon: Pin, count: pinnedPostsCount },
  ];

  const resolveComposerMode = (): CommunityPostType => {
    if (feedScope === 'projects') return 'project';
    if (feedScope === 'events') return 'event';
    return topicFilter === 'all' ? 'discussion' : topicFilter;
  };

  return (
    <div
      className={`${
        embeddedMode ? 'flex-1 min-w-0' : ''
      } h-full flex min-h-0 bg-white relative @container/shell`}
    >
      {/* FAR-LEFT FULL-HEIGHT PRIMARY NAVIGATION RAIL: Core Feed Scopes Only */}
      {!embeddedMode && (
        <WorkspacePrimaryRail ariaLabel="交流社区导航">
          <div className="space-y-0.5">
            <RailSectionLabel>动态视角</RailSectionLabel>
            {socialChannels.map((item) => {
              const Icon = item.icon;
              const active = feedScope === item.id;
              return (
                <RailNavButton
                  key={item.id}
                  active={active}
                  variant="primary"
                  disabled={!hasAccess}
                  label={item.label}
                  count={item.count}
                  icon={
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
                  }
                  onClick={() => setFeedScope(item.id)}
                />
              );
            })}
          </div>
        </WorkspacePrimaryRail>
      )}

      {/* RIGHT MAIN WORKSPACE COLUMN: Top Search, Contextual Filters & Actions Flush-Aligned with Content */}
      <div className="flex-1 min-w-0 flex flex-col h-full min-h-0 @container/view">
        {/* Content-Level Functional Toolbar (Aligned Flush with Content Stream Below) */}
        <ViewToolbar
        left={
          <>
            {hasAccess ? (
              <>
                <ToolbarSearch
                  value={searchKeyword}
                  onChange={setSearchKeyword}
                  placeholder={
                    feedScope === 'projects'
                      ? `在「${activeCommunity.name}」搜索共创项目、所需角色...`
                      : feedScope === 'events'
                        ? `在「${activeCommunity.name}」搜索主题活动、主理人或地点...`
                        : `在「${activeCommunity.name}」搜索帖子、Skill、标签或作者...`
                  }
                  widthClass="w-full sm:w-56 lg:w-64"
                />
                {feedScope === 'projects' ? (
                  <ToolbarDropdown
                    label="状态"
                    value={projectStatusFilter}
                    defaultValue="all"
                    onChange={setProjectStatusFilter}
                    options={[
                      { id: 'all', label: '全部项目', hint: `${communityOpenProjects.length}` },
                      {
                        id: 'open',
                        label: '招募共创中',
                        hint: `${communityOpenProjects.filter((p) => p.status === 'open').length}`,
                      },
                      {
                        id: 'claimed',
                        label: '已立项协同',
                        hint: `${communityOpenProjects.filter((p) => p.status === 'claimed').length}`,
                      },
                    ]}
                  />
                ) : feedScope === 'events' ? (
                  <>
                    <ToolbarDropdown
                      label="形式"
                      value={eventFormatFilter}
                      defaultValue="all"
                      onChange={setEventFormatFilter}
                      options={[
                        { id: 'all', label: '全部形式', hint: `${communityZoneEvents.length}` },
                        {
                          id: 'offline_meetup',
                          label: '线下交流',
                          hint: `${communityZoneEvents.filter((e) => e.format === 'offline_meetup').length}`,
                        },
                        {
                          id: 'online_live',
                          label: '线上直播分享',
                          hint: `${communityZoneEvents.filter((e) => e.format === 'online_live').length}`,
                        },
                        {
                          id: 'workshop_training',
                          label: '实战培训',
                          hint: `${communityZoneEvents.filter((e) => e.format === 'workshop_training').length}`,
                        },
                      ]}
                    />
                    <ToolbarDropdown
                      label="费用"
                      value={eventPricingFilter}
                      defaultValue="all"
                      onChange={setEventPricingFilter}
                      options={[
                        { id: 'all', label: '全部费用', hint: `${communityZoneEvents.length}` },
                        {
                          id: 'free',
                          label: '免费活动',
                          hint: `${communityZoneEvents.filter((e) => e.isFree || e.priceCny <= 0).length}`,
                        },
                        {
                          id: 'paid',
                          label: '收费活动',
                          hint: `${communityZoneEvents.filter((e) => !e.isFree && e.priceCny > 0).length}`,
                        },
                        {
                          id: 'registered',
                          label: '我已报名',
                          hint: `${communityZoneEvents.filter((e) => e.registeredByMe).length}`,
                        },
                      ]}
                    />
                  </>
                ) : (
                  <ToolbarDropdown
                    label="分类"
                    value={topicFilter}
                    defaultValue="all"
                    onChange={setTopicFilter}
                    options={[
                      { id: 'all', label: '全部分类', hint: `${scopeTopicCounts.all}` },
                      { id: 'discussion', label: '分享讨论', hint: `${scopeTopicCounts.discussion}` },
                      { id: 'project', label: '项目共创', hint: `${scopeTopicCounts.project}` },
                      { id: 'event', label: '主题活动', hint: `${scopeTopicCounts.event}` },
                      { id: 'skill_share', label: '发布 Skill', hint: `${scopeTopicCounts.skill_share}` },
                      { id: 'agn_recommend', label: '专家 Agent', hint: `${scopeTopicCounts.agn_recommend}` },
                      { id: 'announcement', label: '社区公告', hint: `${scopeTopicCounts.announcement}` },
                    ]}
                  />
                )}
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>私有社区 · 加入后解锁完整讨论与共创</span>
              </span>
            )}
          </>
        }
        right={
          hasAccess ? (
            <button
              type="button"
              onClick={() => openComposer(resolveComposerMode())}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>
                {feedScope === 'projects'
                  ? '发起项目共创'
                  : feedScope === 'events'
                    ? '发布主题活动'
                    : '发布内容'}
              </span>
            </button>
          ) : undefined
        }
      />

      {/* Scrollable Community Workspace (Center Feed + Right Community Projects) */}
      <div className={`flex-1 min-h-0 overflow-y-auto clean-scroll bg-white ${WORKSPACE_GUTTER_CLASS} py-5`}>
        <div className={WORKSPACE_MAX_WIDTH_CLASS}>
          {/* Compact Horizontal Scope Strip (< @[760px]/shell and standalone) */}
          {hasAccess && !embeddedMode && (
            <div className="@[760px]/shell:hidden mb-4 flex items-center gap-1.5 overflow-x-auto pb-1">
              {socialChannels.map((item) => {
                const Icon = item.icon;
                const active = feedScope === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFeedScope(item.id)}
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

          {/* CENTER FEED + RIGHT PROJECTS/RANKING SIDEBAR */}
          <div className="flex flex-col @[840px]:flex-row gap-6 @[1100px]:gap-7 items-start">
            {/* MAIN COMMUNITY FEED STREAM */}
            <div className="flex-1 min-w-0 w-full space-y-3">
              {!hasAccess ? (
                /* Private Community Access Gate */
                <div className="border-y border-slate-200/80 py-10 px-6 text-center space-y-3">
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
                  </div>
                </div>
              ) : (
                <>
                  {/* DEDICATED CO-CREATION PROJECTS HUB when feedScope === 'projects' */}
                  {feedScope === 'projects' ? (
                    <div className="divide-y divide-slate-200/80 border-t border-b border-slate-200/80">
                      {filteredZoneProjects.length === 0 ? (
                        <EmptyStateCard
                          icon={<Rocket className="w-6 h-6" />}
                          description={`「${activeCommunity.name}」当前筛选下暂无项目共创，欢迎发起首个共创项目。`}
                          action={
                            <button
                              type="button"
                              onClick={() => openComposer('project')}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>发起项目共创</span>
                            </button>
                          }
                        />
                      ) : (
                        filteredZoneProjects.map((proj) => {
                          const projInquiries = projectInquiryLog[proj.id] || [];
                          const linkedDiscussion = zonePosts.find(
                            (p) => p.linkedProjectId === proj.id,
                          );
                          return (
                            <article
                              key={proj.id}
                              className="py-5 space-y-3 hover:bg-slate-50/40 transition-colors"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                <div className="min-w-0 space-y-1">
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                                    <span
                                      className={`inline-flex items-center gap-1 font-semibold ${
                                        proj.direction === 'published_by_me'
                                          ? 'text-emerald-700'
                                          : proj.status === 'claimed'
                                            ? 'text-slate-600'
                                            : 'text-blue-700'
                                      }`}
                                    >
                                      <Rocket className="w-3 h-3" />
                                      <span>
                                        {proj.direction === 'published_by_me'
                                          ? '我发起的共创'
                                          : proj.status === 'claimed'
                                            ? '已立项协同'
                                            : '招募共创中'}
                                      </span>
                                    </span>
                                    <span className="text-slate-300" aria-hidden="true">·</span>
                                    <span className="text-slate-600 font-medium">{proj.publisher}</span>
                                    <span className="text-slate-300" aria-hidden="true">·</span>
                                    <span className="text-slate-400">{proj.postedAt}</span>
                                    {projInquiries.length > 0 && (
                                      <>
                                        <span className="text-slate-300" aria-hidden="true">·</span>
                                        <span className="text-emerald-700 font-semibold">
                                          已发送 {projInquiries.length} 条咨询
                                        </span>
                                      </>
                                    )}
                                  </div>
                                  <h3 className="text-sm font-bold text-slate-900 leading-snug">
                                    {proj.title}
                                  </h3>
                                  <p className="text-xs text-slate-600 leading-relaxed">
                                    {proj.summary}
                                  </p>
                                </div>

                                <div className="text-left sm:text-right shrink-0">
                                  <div className="text-sm font-bold font-mono tabular-nums text-slate-900">
                                    ${proj.budgetUsd.toLocaleString('en-US')}
                                  </div>
                                  <div className="text-[11px] font-mono tabular-nums text-slate-500 inline-flex items-center gap-1 mt-0.5">
                                    <Clock className="w-3 h-3" />
                                    <span>{proj.durationDays} 天周期</span>
                                  </div>
                                </div>
                              </div>

                              <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-600 min-w-0">
                                  <span className="text-slate-400">需求角色</span>
                                  <span className="font-medium text-slate-700">
                                    {proj.requiredRoles.join(' · ')}
                                  </span>
                                  <span className="text-slate-300" aria-hidden="true">·</span>
                                  <span className="text-slate-500">
                                    {proj.serviceModePref === 'any'
                                      ? '纯 Agent / 人+Agent 皆可'
                                      : SERVICE_MODE_LABELS[proj.serviceModePref]}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {linkedDiscussion && (
                                    <span className="text-[11px] font-mono tabular-nums text-slate-400 mr-1">
                                      {linkedDiscussion.likes} 赞同 · {linkedDiscussion.comments.length} 讨论
                                    </span>
                                  )}
                                  {(proj.direction === 'published_by_me' ||
                                    proj.status === 'claimed') && (
                                    <button
                                      type="button"
                                      onClick={() => onJumpToKanban(proj.linkedWorkspaceId)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>进看板</span>
                                    </button>
                                  )}
                                  {proj.direction !== 'published_by_me' && (
                                    <button
                                      type="button"
                                      onClick={() => openProjectConsult(proj.id)}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
                                    >
                                      <MessageCircle className="w-3.5 h-3.5" />
                                      <span>咨询共创</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </article>
                          );
                        })
                      )}
                    </div>
                  ) : feedScope === 'events' ? (
                    <CommunityEventsPanel
                      communityName={activeCommunity.name}
                      events={filteredZoneEvents}
                      onToggleRegisterEvent={(eventId, note) =>
                        onToggleRegisterEvent?.(eventId, note)
                      }
                      onOpenPublishEvent={() => openComposer('event')}
                    />
                  ) : (
                    <>
                  {/* Active Filter Context Bar (shown when filtering by scope / topic / search) */}
                  {(feedScope !== 'all' || topicFilter !== 'all' || searchKeyword.trim()) && (
                    <div className="pb-2.5 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2 text-slate-600 min-w-0">
                        <span className="font-semibold text-slate-900">
                          {feedScope === 'pinned'
                            ? '主理置顶'
                            : feedScope === 'following'
                              ? '我的关注'
                              : '全部动态'}
                        </span>
                        {topicFilter !== 'all' && (
                          <>
                            <span className="text-slate-300" aria-hidden="true">·</span>
                            <span className="font-semibold text-blue-700">
                              {POST_TYPE_META[topicFilter].label}
                            </span>
                          </>
                        )}
                        <span className="text-slate-300" aria-hidden="true">·</span>
                        {feedScope === 'following' && (
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
                        {feedScope === 'following' && (
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
                            setFeedScope('all');
                            setTopicFilter('all');
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
                  <div className="divide-y divide-slate-200/80 border-t border-b border-slate-200/80">
                    {communityFeedPosts.length === 0 ? (
                      feedScope === 'following' ? (
                        <div className="py-12 px-6 text-center space-y-3.5">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 inline-flex items-center justify-center mx-auto">
                            <UserCheck className="w-5 h-5" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-slate-900">
                              {followedEntityKeys.length === 0
                                ? '你还没有关注任何社区成员或 AGN'
                                : `当前筛选下暂无你关注的成员动态`}
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
                              onClick={() => {
                                setFeedScope('all');
                                setTopicFilter('all');
                              }}
                              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                            >
                              去「全部动态」发现值得关注的成员
                            </button>
                          </div>
                        </div>
                      ) : (
                        <EmptyStateCard
                          description="该频道下暂无内容，欢迎发起分享讨论、主题活动或项目共创。"
                          action={
                            <button
                              type="button"
                              onClick={() => openComposer(resolveComposerMode())}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>立即发帖</span>
                            </button>
                          }
                        />
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
                        const linkedSkill = post.linkedSkillId
                          ? skillMap.get(post.linkedSkillId)
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
                            className={`py-5 space-y-3 transition-colors ${
                              post.pinned ? 'bg-amber-50/20 -mx-2 px-2 rounded-lg' : ''
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
                                      <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5">
                                        {post.pinned && (
                                          <>
                                            <span
                                              title={
                                                post.pinnedBy
                                                  ? `由社区主理 ${post.pinnedBy} 置顶`
                                                  : '社区主理置顶'
                                              }
                                              className="inline-flex items-center gap-0.5 font-semibold text-amber-700"
                                            >
                                              <Pin className="w-2.5 h-2.5" />
                                              <span>主理置顶</span>
                                            </span>
                                            <span className="text-slate-300" aria-hidden="true">·</span>
                                          </>
                                        )}
                                        <span className="font-semibold text-slate-600">
                                          {typeInfo.label}
                                        </span>
                                        {postZone && (
                                          <>
                                            <span className="text-slate-300" aria-hidden="true">·</span>
                                            <span className="text-slate-500">来自 {postZone.name}</span>
                                          </>
                                        )}
                                        <span className="text-slate-300" aria-hidden="true">·</span>
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
                              <div className="rounded-lg bg-[#FAFAFA] border border-slate-200/80 p-3.5 space-y-2.5">
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
                                  <div className="rounded-lg bg-[#FAFAFA] border border-slate-200/80 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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

                            {/* Embedded Skill / MCP Card — Synced with Service Market */}
                            {linkedSkill &&
                              (() => {
                                const pricing = getSkillPurchasePricing(linkedSkill);
                                const owned = purchasedSkillIds.includes(linkedSkill.id);
                                return (
                                  <div className="rounded-lg bg-[#FAFAFA] border border-slate-200/80 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-start gap-2.5 min-w-0">
                                      <div className="w-8 h-8 rounded-lg bg-amber-100/90 text-amber-800 inline-flex items-center justify-center shrink-0 mt-0.5">
                                        <Blocks className="w-4 h-4" />
                                      </div>
                                      <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <span className="text-xs font-bold text-slate-900 truncate">
                                            {linkedSkill.name}
                                          </span>
                                          <span className="px-1.5 py-[1px] rounded text-[10px] font-semibold bg-white border border-slate-200 text-slate-600">
                                            {SKILL_KIND_LABELS[linkedSkill.kind]}
                                          </span>
                                          <span
                                            className={`text-[11px] font-mono font-bold ${
                                              pricing.isFree ? 'text-emerald-700' : 'text-slate-900'
                                            }`}
                                          >
                                            {pricing.priceLabel}
                                          </span>
                                        </div>
                                        <div className="text-[11px] text-slate-500 font-mono truncate mt-0.5">
                                          {linkedSkill.slug} · {linkedSkill.installs} 安装 · ★{' '}
                                          {linkedSkill.rating.toFixed(2)}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => handleCopySkillCmd(linkedSkill)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
                                      >
                                        {copiedSkillId === linkedSkill.id ? (
                                          <>
                                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                                            <span>已复制</span>
                                          </>
                                        ) : (
                                          <>
                                            <Copy className="w-3.5 h-3.5 text-slate-500" />
                                            <span>命令</span>
                                          </>
                                        )}
                                      </button>
                                      {onAcquireSkill && (
                                        <button
                                          type="button"
                                          disabled={owned}
                                          onClick={() =>
                                            onAcquireSkill(
                                              linkedSkill.id,
                                              linkedSkill.name,
                                              pricing.priceUsd,
                                              post.zoneId,
                                            )
                                          }
                                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                                            owned
                                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                                              : 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer'
                                          }`}
                                        >
                                          <ShoppingBag className="w-3.5 h-3.5" />
                                          <span>{owned ? '已拥有' : pricing.isFree ? '免费获取' : '获取'}</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })()}

                            {/* Embedded Themed Event Card when post links a community event */}
                            {post.linkedEventId &&
                              (() => {
                                const linkedEv = eventMap.get(post.linkedEventId);
                                if (!linkedEv) return null;
                                return (
                                  <CommunityEventInlineCard
                                    event={linkedEv}
                                    onToggleRegisterEvent={(eventId) =>
                                      onToggleRegisterEvent?.(eventId)
                                    }
                                    onJumpToEventsTab={() => setFeedScope('events')}
                                  />
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
                </>
              )}
            </div>

            {/* COLUMN 3 (RIGHT): Flush Antigravity Split Rail — Community Profile & Activity Leaderboard */}
            <aside className="w-full @[840px]:w-[268px] @[1040px]:w-[288px] shrink-0 @[840px]:border-l @[840px]:border-slate-200/80 @[840px]:pl-5 divide-y divide-slate-200/80 @[840px]:sticky @[840px]:top-5">
              {/* Community Overview & Activity Snapshot */}
              <section className="pb-5 space-y-3">
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

                {/* Compact Hairline-Divided Community Activity Strip */}
                <div className="grid grid-cols-3 divide-x divide-slate-200/80 pt-2.5 border-t border-slate-200/70 text-center">
                  <div className="px-1">
                    <div className="text-xs font-bold font-mono tabular-nums text-slate-900">
                      {zonePosts.length}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">社区动态</div>
                  </div>
                  <div className="px-1">
                    <div className="text-xs font-bold font-mono tabular-nums text-slate-900">
                      {communityOpenProjects.length}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">项目共创</div>
                  </div>
                  <div className="px-1">
                    <div className="text-xs font-bold font-mono tabular-nums text-slate-900">
                      {zoneMarketServiceCount}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">沉淀服务</div>
                  </div>
                </div>

                {/* Community Principal */}
                <div className="pt-2.5 border-t border-slate-200/70 flex items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5 min-w-0 text-slate-600">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="truncate">
                      主理：<strong className="text-slate-900">{activeCommunity.principalName}</strong>
                    </span>
                  </div>
                  {activeCommunity.isCurrentUserPrincipal && (
                    <span className="text-amber-700 font-semibold text-[11px] shrink-0">
                      可置顶管理
                    </span>
                  )}
                </div>
              </section>

              {/* Invariant Activity Leaderboard: Active Members & Trending Feed */}
              <section className="pt-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    <span>活跃度排行</span>
                  </h3>
                  <div className="inline-flex items-center p-0.5 rounded-md bg-slate-100 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setRankingTab('users')}
                      className={`px-2 py-0.5 rounded font-semibold cursor-pointer transition-colors ${
                        rankingTab === 'users'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      活跃成员
                    </button>
                    <button
                      type="button"
                      onClick={() => setRankingTab('posts')}
                      className={`px-2 py-0.5 rounded font-semibold cursor-pointer transition-colors ${
                        rankingTab === 'posts'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      热门动态
                    </button>
                  </div>
                </div>

                {rankingTab === 'users' ? (
                  activeUserRankings.length === 0 ? (
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
                  )
                ) : trendingPostsRanking.length === 0 ? (
                  <p className="text-xs text-slate-500">暂无热门动态。</p>
                ) : (
                  <div className="space-y-2.5">
                    {trendingPostsRanking.map((p, index) => {
                      const rank = index + 1;
                      const rankBadgeCls =
                        rank === 1
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : rank === 2
                            ? 'bg-slate-100 text-slate-700 border-slate-200'
                            : rank === 3
                              ? 'bg-orange-50 text-orange-700 border-orange-200'
                              : 'bg-white text-slate-400 border-transparent';
                      const typeInfo = POST_TYPE_META[p.type] || POST_TYPE_META.discussion;
                      return (
                        <div key={p.id} className="flex items-start gap-2 text-xs">
                          <span
                            className={`w-5 h-5 mt-0.5 rounded-md border text-[11px] font-mono font-bold tabular-nums inline-flex items-center justify-center shrink-0 ${rankBadgeCls}`}
                          >
                            {rank}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-slate-900 leading-snug line-clamp-2">
                              {p.title}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500 font-mono tabular-nums">
                              <span className="font-sans text-slate-400">{typeInfo.label}</span>
                              <span>·</span>
                              <span>{p.likes} 赞同</span>
                              <span>·</span>
                              <span>{p.comments.length} 讨论</span>
                            </div>
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
      <ModalShell
        open={Boolean(activeConsultProject)}
        onClose={() => setConsultProjectId(null)}
        title={activeConsultProject ? `咨询项目招募 · ${activeConsultProject.publisher}` : ''}
        subtitle={activeConsultProject?.title}
        maxWidthClass="max-w-lg"
      >
        {activeConsultProject && (
          <div className="space-y-3.5">
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
                    确认合作并同步项目看板 →
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
        )}
      </ModalShell>

      {/* Publish Post / Project Recruitment Modal */}
      <ModalShell
        open={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
        title="发布社区内容"
        subtitle={
          <>
            目标社区：
            <strong style={{ color: activeCommunity.accentColor }}>
              {activeCommunity.name}
            </strong>
            （{activeCommunity.typeLabel}）
          </>
        }
        maxWidthClass="max-w-xl"
        onSubmit={handleComposerSubmit}
        footer={
          <>
            <span className="text-[11px] text-slate-500">
              {composerMode === 'project'
                ? '发布后自动进入「项目共创」并同步建立项目群聊'
                : composerMode === 'event'
                  ? '发布后自动上架「主题活动」并同步至社区动态，开放报名与凭证核验'
                  : composerMode === 'skill_share'
                    ? '发布后自动同步上架至本社区「服务市场 → Skills / MCP」'
                    : composerMode === 'agn_recommend' && selectedPublishAgentId
                      ? '发布后关联 Agent 将自动同步至本社区「服务市场 → 专家 Agent」'
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
                disabled={
                  composerMode === 'skill_share'
                    ? !skillName.trim()
                    : !postBody.trim() && !postTitle.trim()
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer disabled:opacity-45 whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {composerMode === 'project'
                    ? '发布项目共创'
                    : composerMode === 'event'
                      ? '发布主题活动'
                      : composerMode === 'skill_share'
                        ? '发布并上架 Skill'
                        : `发布${POST_TYPE_META[composerMode].label}`}
                </span>
              </button>
            </div>
          </>
        }
      >
        <div className="space-y-3.5">
              <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(
                  [
                    { id: 'discussion', label: '分享讨论' },
                    { id: 'project', label: '项目共创' },
                    { id: 'event', label: '主题活动' },
                    { id: 'skill_share', label: '发布 Skill' },
                    { id: 'agn_recommend', label: '发布专家 Agent' },
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

              {composerMode === 'skill_share' ? (
                <>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Skill / MCP 名称
                    </label>
                    <input
                      type="text"
                      autoFocus
                      value={skillName}
                      onChange={(e) => setSkillName(e.target.value)}
                      placeholder="例：Next.js + Stripe 订阅幂等脚手架 Skill"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        形态类型
                      </label>
                      <select
                        value={skillKind}
                        onChange={(e) => setSkillKind(e.target.value as SkillKind)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                      >
                        <option value="skill">Prompt Skill</option>
                        <option value="mcp">MCP Server</option>
                        <option value="workflow">工作流套件</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        所属领域
                      </label>
                      <select
                        value={skillCategory}
                        onChange={(e) => setSkillCategory(e.target.value as AgentCategory)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                      >
                        <option value="engineering">研发开发</option>
                        <option value="architecture">架构审查</option>
                        <option value="product">产品策划</option>
                        <option value="design">设计体验</option>
                        <option value="qa">测试质量</option>
                        <option value="media">自媒体运营</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        价格（USD，0 为免费）
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={5}
                        value={skillPrice}
                        onChange={(e) => setSkillPrice(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-900"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    {composerMode === 'event' ? '活动主题标题' : '标题'}
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={postTitle}
                    onChange={(e) => setPostTitle(e.target.value)}
                    placeholder={
                      composerMode === 'project'
                        ? '一句话标题：如「寻全栈与设计创客 72h 共创开源 Agent 评测工具」'
                        : composerMode === 'event'
                          ? '活动标题：如「杭州 OPC 主理人商业交付实战工作坊（1日闭门）」'
                          : composerMode === 'agn_recommend'
                            ? '专家 Agent 标题：如「发布自建 Claude Code 全栈研发特工，支持按周租赁」'
                            : composerMode === 'announcement'
                              ? '公告标题：如「【社区公告】本月共创黑客松与协作规范」'
                              : `在「${activeCommunity.name}」发起分享讨论、实战复盘或行业观察`
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
              )}

              {composerMode === 'event' && (
                <div className="space-y-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80 p-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        活动形式
                      </label>
                      <select
                        value={eventFormat}
                        onChange={(e) => {
                          const nextFmt = e.target.value as CommunityEventFormat;
                          setEventFormat(nextFmt);
                          if (nextFmt === 'online_live' && eventLocation.includes('良渚')) {
                            setEventLocation('AGN 社区直播间（报名后自动推送入口）');
                          }
                        }}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                      >
                        <option value="offline_meetup">线下交流</option>
                        <option value="online_live">线上直播分享</option>
                        <option value="workshop_training">实战培训</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        收费模式
                      </label>
                      <div className="grid grid-cols-2 gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
                        <button
                          type="button"
                          onClick={() => setEventIsFree(true)}
                          className={`py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                            eventIsFree
                              ? 'bg-emerald-600 text-white'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          免费
                        </button>
                        <button
                          type="button"
                          onClick={() => setEventIsFree(false)}
                          className={`py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                            !eventIsFree
                              ? 'bg-slate-900 text-white'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          收费
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        {eventIsFree ? '人数上限（人）' : '门票价格（¥）'}
                      </label>
                      {eventIsFree ? (
                        <input
                          type="number"
                          min={5}
                          max={2000}
                          value={eventCapacity}
                          onChange={(e) => setEventCapacity(Math.max(5, Number(e.target.value) || 30))}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-900"
                        />
                      ) : (
                        <input
                          type="number"
                          min={1}
                          step={10}
                          value={eventPriceCny}
                          onChange={(e) => setEventPriceCny(Math.max(1, Number(e.target.value) || 99))}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-900"
                        />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        活动时间
                      </label>
                      <input
                        type="text"
                        value={eventStartTime}
                        onChange={(e) => setEventStartTime(e.target.value)}
                        placeholder="例：12月14日 (周日) 14:00 - 17:30"
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                      />
                    </div>
                    <div className={eventIsFree ? 'sm:col-span-2' : ''}>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        {eventFormat === 'online_live' ? '直播入口 / 会议平台' : '活动地点'}
                      </label>
                      <input
                        type="text"
                        value={eventLocation}
                        onChange={(e) => setEventLocation(e.target.value)}
                        placeholder={
                          eventFormat === 'online_live'
                            ? '例：AGN 社区直播间 / 腾讯会议'
                            : '例：杭州 · 良渚大屋顶 2F 路演厅'
                        }
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                      />
                    </div>
                    {!eventIsFree && (
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          人数上限（人）
                        </label>
                        <input
                          type="number"
                          min={5}
                          max={2000}
                          value={eventCapacity}
                          onChange={(e) => setEventCapacity(Math.max(5, Number(e.target.value) || 30))}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-900"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {composerMode === 'agn_recommend' && (
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    关联上架到「{activeCommunity.name} · 服务市场」的专家 Agent
                  </label>
                  <select
                    value={selectedPublishAgentId}
                    onChange={(e) => setSelectedPublishAgentId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-900"
                  >
                    <option value="">不关联具体节点（仅文字分享）</option>
                    {privateAgents.length > 0 && (
                      <optgroup label="我的自建 Agent（同步上架社区服务市场）">
                        {privateAgents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {displayEntityName(a.handle)} · {a.runtimeAgent} ({a.defaultModel})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="社区已有认证 Agent">
                      {allAgents
                        .filter((a) => a.ownership === 'marketplace')
                        .slice(0, 12)
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {displayEntityName(a.handle)} · {a.runtimeAgent}
                          </option>
                        ))}
                    </optgroup>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  {composerMode === 'project'
                    ? '项目说明与共创目标'
                    : composerMode === 'event'
                      ? '活动介绍与面向人群'
                      : composerMode === 'skill_share'
                        ? '能力介绍与适用场景'
                        : '内容详情'}
                </label>
                <textarea
                  rows={composerMode === 'event' ? 3 : 4}
                  value={postBody}
                  onChange={(e) => setPostBody(e.target.value)}
                  placeholder={
                    composerMode === 'project'
                      ? '补充项目背景、交付范围与共创分工（发布后自动进入「项目共创」并同步建立项目群聊）...'
                      : composerMode === 'event'
                        ? '介绍活动亮点、主理人分享内容与适合人群（发布后自动同步至「主题活动」与「全部动态」，开放成员报名）...'
                        : composerMode === 'skill_share'
                          ? '介绍该 Skill / MCP 解决的核心问题、兼容底座与最佳实践（发布后自动同步至本社区「服务市场 → Skills / MCP」）...'
                          : composerMode === 'agn_recommend'
                            ? '介绍该专家 Agent 的擅长场景、实测案例与协作方式（关联后将自动同步至本社区「服务市场 → 专家 Agent」）...'
                            : composerMode === 'announcement'
                              ? '撰写社区公告、规则更新或活动通知...'
                              : '写下你的技术实践、商业洞察、共创想法或踩坑复盘...'
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 resize-none"
                />
              </div>

              {composerMode === 'event' && (
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    活动议程（选填，每行一条）
                  </label>
                  <textarea
                    rows={2}
                    value={eventAgendaText}
                    onChange={(e) => setEventAgendaText(e.target.value)}
                    placeholder={'14:00 - 15:00｜主题分享与实战案例拆解\n15:00 - 17:00｜现场演练与主理人答疑'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 resize-none"
                  />
                </div>
              )}

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

              {composerMode !== 'project' &&
                composerMode !== 'event' &&
                composerMode !== 'skill_share' &&
                canManagePin && (
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
      </ModalShell>
    </div>
  );
}
