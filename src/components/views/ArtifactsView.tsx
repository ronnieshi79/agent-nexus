import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Check,
  Code2,
  Copy,
  ExternalLink,
  FileCode2,
  FileText,
  FolderOpen,
  LayoutGrid,
  List,
  MessageSquare,
  Palette,
  Plus,
  Presentation,
  Send,
  Share2,
  Shapes,
  Sparkles,
  Star,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import type {
  ArtifactCategoryGroup,
  ArtifactKind,
  ArtifactScopeTab,
  ArtifactSourceType,
  ProjectArtifact,
  ProjectWorkspace,
  WorkflowTask,
} from '../../types/agentnexus';
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

interface ArtifactsViewProps {
  artifacts: ProjectArtifact[];
  workspaces: ProjectWorkspace[];
  allTasks: WorkflowTask[];
  onCreateArtifact: (input: {
    projectId: string;
    title: string;
    kind: ArtifactKind;
    summary: string;
    content: string;
    sourceType: ArtifactSourceType;
    sourceTaskId?: string;
    tags: string[];
    slides?: { heading: string; bullets: string[] }[];
    designSpec?: { palette: string[]; typography: string; components: string[] };
  }) => void;
  onShareArtifactToChat: (artifactId: string, projectId: string, note?: string) => void;
  onToggleStarArtifact: (artifactId: string) => void;
  onDeleteArtifact: (artifactId: string) => void;
  onOpenTaskSession: (taskId: string) => void;
  onOpenProjectChat: (projectId: string) => void;
  onBreadcrumbContextChange?: (ctx: {
    scope: ArtifactScopeTab;
    category: ArtifactCategoryGroup;
  }) => void;
  embeddedMode?: boolean;
  controlledScope?: ArtifactScopeTab;
  onChangeScope?: (scope: ArtifactScopeTab) => void;
}

const KIND_META: Record<
  ArtifactKind,
  {
    label: string;
    group: Exclude<ArtifactCategoryGroup, 'all'>;
    badgeCls: string;
    icon: typeof FileText;
  }
> = {
  prd: {
    label: 'PRD 文档',
    group: 'docs',
    badgeCls: 'bg-sky-50 text-sky-700 border-sky-200/80',
    icon: FileText,
  },
  solution: {
    label: '方案讨论',
    group: 'docs',
    badgeCls: 'bg-blue-50 text-blue-700 border-blue-200/80',
    icon: MessageSquare,
  },
  ppt: {
    label: '演示稿 Slides',
    group: 'slides',
    badgeCls: 'bg-orange-50 text-orange-800 border-orange-200/80',
    icon: Presentation,
  },
  design: {
    label: '设计素材 Design',
    group: 'design',
    badgeCls: 'bg-violet-50 text-violet-700 border-violet-200/80',
    icon: Palette,
  },
  architecture: {
    label: '架构设计',
    group: 'code',
    badgeCls: 'bg-teal-50 text-teal-700 border-teal-200/80',
    icon: Code2,
  },
  code_test: {
    label: '代码与测试',
    group: 'code',
    badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    icon: FileCode2,
  },
};

const SOURCE_META: Record<ArtifactSourceType, { label: string; cls: string }> = {
  task_session: { label: '任务生成', cls: 'text-indigo-700 bg-indigo-50 border-indigo-200/70' },
  project_group: { label: '对话分享', cls: 'text-sky-700 bg-sky-50 border-sky-200/70' },
  manual: { label: '手动创作', cls: 'text-slate-600 bg-slate-100 border-slate-200/80' },
};

const LAUNCHER_PRESETS: {
  id: Exclude<ArtifactCategoryGroup, 'all'>;
  kind: ArtifactKind;
  title: string;
  subtitle: string;
  cardBg: string;
  iconColor: string;
  accentRing: string;
  icon: typeof FileText;
}[] = [
  {
    id: 'docs',
    kind: 'prd',
    title: '文档 · Docs',
    subtitle: 'PRD 规格、方案讨论与决策纪要',
    cardBg: 'bg-gradient-to-br from-sky-100/90 via-blue-50 to-sky-100/70',
    iconColor: 'text-blue-700',
    accentRing: 'hover:border-blue-300',
    icon: FileText,
  },
  {
    id: 'slides',
    kind: 'ppt',
    title: '演示稿 · Slides',
    subtitle: '项目汇报 PPT 与方案路演分镜',
    cardBg: 'bg-gradient-to-br from-orange-100/90 via-amber-50 to-rose-100/60',
    iconColor: 'text-amber-800',
    accentRing: 'hover:border-orange-300',
    icon: Presentation,
  },
  {
    id: 'design',
    kind: 'design',
    title: '设计素材 · Design',
    subtitle: '视觉情绪板、配色规范与原型草图',
    cardBg: 'bg-gradient-to-br from-violet-100/90 via-purple-50 to-indigo-100/70',
    iconColor: 'text-violet-700',
    accentRing: 'hover:border-violet-300',
    icon: Palette,
  },
  {
    id: 'code',
    kind: 'code_test',
    title: '代码与架构 · Code',
    subtitle: '系统架构图、补丁与回归测试报告',
    cardBg: 'bg-gradient-to-br from-emerald-100/85 via-teal-50 to-emerald-100/60',
    iconColor: 'text-emerald-700',
    accentRing: 'hover:border-emerald-300',
    icon: Code2,
  },
];

export function ArtifactsView({
  artifacts,
  workspaces,
  allTasks,
  onCreateArtifact,
  onShareArtifactToChat,
  onToggleStarArtifact,
  onDeleteArtifact,
  onOpenTaskSession,
  onOpenProjectChat,
  onBreadcrumbContextChange,
  embeddedMode = false,
  controlledScope,
  onChangeScope,
}: ArtifactsViewProps) {
  const [internalScopeTab, setInternalScopeTab] = useState<ArtifactScopeTab>(
    controlledScope || 'all',
  );
  const scopeTab = controlledScope ?? internalScopeTab;
  const setScopeTab = (next: ArtifactScopeTab) => {
    setInternalScopeTab(next);
    onChangeScope?.(next);
  };
  const [categoryGroup, setCategoryGroup] = useState<ArtifactCategoryGroup>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | ArtifactSourceType>('all');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Preview & Share Drawer
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [shareProjectId, setShareProjectId] = useState<string>(workspaces[0]?.id || '');
  const [shareNote, setShareNote] = useState('');
  const [shareSuccessProjectId, setShareSuccessProjectId] = useState<string | null>(null);

  // Create Artifact Drawer
  const [createOpen, setCreateOpen] = useState(false);
  const [newKind, setNewKind] = useState<ArtifactKind>('prd');
  const [newProjectId, setNewProjectId] = useState<string>(workspaces[0]?.id || '');
  const [newSourceType, setNewSourceType] = useState<ArtifactSourceType>('manual');
  const [newTitle, setNewTitle] = useState('');
  const [newSummary, setNewSummary] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newTagsText, setNewTagsText] = useState('方案沉淀, 协作分享');

  useEffect(() => {
    onBreadcrumbContextChange?.({ scope: scopeTab, category: categoryGroup });
  }, [categoryGroup, onBreadcrumbContextChange, scopeTab]);

  const workspaceMap = useMemo(() => new Map(workspaces.map((w) => [w.id, w])), [workspaces]);
  const taskMap = useMemo(() => new Map(allTasks.map((t) => [t.id, t])), [allTasks]);

  // Combine persisted artifacts + auto-derived task deliverables
  const combinedArtifacts = useMemo(() => {
    const existingTaskIds = new Set(artifacts.map((a) => a.sourceTaskId).filter(Boolean));
    const derivedFromTasks: ProjectArtifact[] = allTasks
      .filter((t) => Boolean(t.deliverableArtifact) && !existingTaskIds.has(t.id))
      .map((t) => ({
        id: `art_task_${t.id}`,
        projectId: t.sessionId,
        title: `${t.title}（${t.deliverableArtifact}）`,
        kind: t.workType === 'planning' ? 'prd' : t.workType === 'review' ? 'architecture' : 'code_test',
        ownership: 'yours',
        summary: t.deliverableSummary || t.description,
        content: `来源任务：#${t.id} ${t.title}\n产物路径：${t.deliverableArtifact}\n\n${
          t.deliverableSummary || t.description
        }`,
        sourceType: 'task_session',
        sourceTaskId: t.id,
        authorName: t.assigneeHandle.replace(/^@/, ''),
        authorType: 'agent',
        version: 'v1.0',
        updatedAt: t.updatedAt,
        tags: [t.featureModule, '任务自动生成'],
      }));
    return [...artifacts, ...derivedFromTasks];
  }, [allTasks, artifacts]);

  const scopeCounts = useMemo(() => {
    return {
      all: combinedArtifacts.length,
      yours: combinedArtifacts.filter((a) => a.ownership === 'yours').length,
      shared: combinedArtifacts.filter((a) => a.ownership === 'shared').length,
      starred: combinedArtifacts.filter((a) => Boolean(a.starred)).length,
    };
  }, [combinedArtifacts]);

  const scopedBase = useMemo(() => {
    return combinedArtifacts.filter((a) => {
      if (scopeTab === 'yours' && a.ownership !== 'yours') return false;
      if (scopeTab === 'shared' && a.ownership !== 'shared') return false;
      if (scopeTab === 'starred' && !a.starred) return false;
      return true;
    });
  }, [combinedArtifacts, scopeTab]);

  const categoryCounts = useMemo(() => {
    const counts: Record<ArtifactCategoryGroup, number> = {
      all: scopedBase.length,
      docs: 0,
      slides: 0,
      design: 0,
      code: 0,
    };
    scopedBase.forEach((a) => {
      const grp = KIND_META[a.kind]?.group || 'docs';
      counts[grp] += 1;
    });
    return counts;
  }, [scopedBase]);

  const filteredArtifacts = useMemo(() => {
    const q = searchKeyword.trim().toLowerCase();
    return scopedBase.filter((a) => {
      if (categoryGroup !== 'all' && KIND_META[a.kind]?.group !== categoryGroup) return false;
      if (projectFilter !== 'all' && a.projectId !== projectFilter) return false;
      if (sourceFilter !== 'all' && a.sourceType !== sourceFilter) return false;
      if (!q) return true;
      const projName = workspaceMap.get(a.projectId)?.name || '';
      const haystack = [
        a.title,
        a.summary,
        a.content,
        a.authorName,
        a.sharedByName || '',
        projName,
        ...a.tags,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [categoryGroup, projectFilter, scopedBase, searchKeyword, sourceFilter, workspaceMap]);

  const previewArtifact = useMemo(
    () => (previewId ? combinedArtifacts.find((a) => a.id === previewId) || null : null),
    [combinedArtifacts, previewId],
  );

  useEffect(() => {
    if (previewArtifact) {
      setShareProjectId(previewArtifact.projectId || workspaces[0]?.id || '');
      setShareNote('');
      setShareSuccessProjectId(null);
    }
  }, [previewArtifact?.id, previewArtifact?.projectId, workspaces]);

  const openCreateWithKind = (kind: ArtifactKind) => {
    setNewKind(kind);
    setNewProjectId(projectFilter !== 'all' ? projectFilter : workspaces[0]?.id || '');
    setNewSourceType('manual');
    setNewTitle('');
    setNewSummary('');
    setNewContent('');
    setNewTagsText(
      kind === 'design'
        ? '设计素材, 视觉情绪板'
        : kind === 'ppt'
          ? '演示稿, 方案汇报'
          : kind === 'code_test' || kind === 'architecture'
            ? '架构代码, 技术产物'
            : '产品文档, 方案讨论',
    );
    setCreateOpen(true);
  };

  const handleCopyContent = (art: ProjectArtifact) => {
    const text =
      art.slides && art.slides.length > 0
        ? `${art.title}\n\n${art.slides
            .map((s) => `${s.heading}\n${s.bullets.map((b) => `- ${b}`).join('\n')}`)
            .join('\n\n')}`
        : art.content;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedId(art.id);
    window.setTimeout(() => {
      setCopiedId((prev) => (prev === art.id ? null : prev));
    }, 1800);
  };

  const handleCreateSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const tags = newTagsText
      .split(/[,，、/]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const slides =
      newKind === 'ppt'
        ? [
            {
              heading: `01 · ${newTitle.trim()}`,
              bullets: [
                newSummary.trim() || '核心背景、业务目标与关键挑战拆解',
                '自动按结构化大纲生成演示分镜，支持分享至项目群评审',
              ],
            },
            {
              heading: '02 · 核心方案与落地排期',
              bullets: (newContent.trim() || '第一阶段完成原型验证\n第二阶段上线核心能力')
                .split('\n')
                .map((l) => l.replace(/^[-*•\d.]+\s*/, '').trim())
                .filter(Boolean)
                .slice(0, 4),
            },
          ]
        : undefined;
    const designSpec =
      newKind === 'design'
        ? {
            palette: ['#0f172a', '#2563eb', '#7c3aed', '#10b981', '#f8fafc'],
            typography: 'Inter + Noto Sans SC',
            components: ['视觉情绪板', '主色阶规范', '核心交互组件草图'],
          }
        : undefined;

    onCreateArtifact({
      projectId: newProjectId || workspaces[0]?.id || 'ses_settlement_mvp',
      title: newTitle,
      kind: newKind,
      summary: newSummary || '新建协作产物，支持在对话与任务间复用分享。',
      content: newContent || newSummary || newTitle,
      sourceType: newSourceType,
      tags,
      slides,
      designSpec,
    });
    setCreateOpen(false);
  };

  const handleShareSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!previewArtifact || !shareProjectId) return;
    onShareArtifactToChat(previewArtifact.id, shareProjectId, shareNote);
    setShareSuccessProjectId(shareProjectId);
    setShareNote('');
  };

  const renderCardThumbnail = (art: ProjectArtifact) => {
    if (art.kind === 'design') {
      const palette = art.designSpec?.palette || ['#0f172a', '#6366f1', '#a78bfa', '#f5f3ff'];
      return (
        <div className="h-28 rounded-t-xl bg-gradient-to-br from-violet-50 via-purple-50/60 to-indigo-50/70 border-b border-slate-100 p-3 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold text-violet-700 bg-white/90 px-2 py-0.5 rounded border border-violet-200/70">
              Design Board
            </span>
            <div className="flex items-center -space-x-1">
              {palette.slice(0, 5).map((hex, i) => (
                <span
                  key={`${hex}-${i}`}
                  className="w-4 h-4 rounded-full border border-white shadow-2xs"
                  style={{ backgroundColor: hex }}
                  title={hex}
                />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {(art.designSpec?.components || ['配色规范', '组件规范', '页面原型'])
              .slice(0, 3)
              .map((comp) => (
                <div
                  key={comp}
                  className="bg-white/90 border border-violet-200/60 rounded-md px-2 py-1.5 text-[10px] font-medium text-slate-700 truncate"
                >
                  {comp}
                </div>
              ))}
          </div>
        </div>
      );
    }

    if (art.kind === 'ppt') {
      const firstSlide = art.slides?.[0];
      return (
        <div className="h-28 rounded-t-xl bg-gradient-to-br from-orange-50/90 via-amber-50/60 to-rose-50/50 border-b border-slate-100 p-3 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold text-amber-800 bg-white/90 px-2 py-0.5 rounded border border-amber-200/70">
              Slides · {art.slides?.length || 1} 页
            </span>
            <Presentation className="w-3.5 h-3.5 text-amber-600/80" />
          </div>
          <div className="bg-white/95 rounded-lg border border-amber-200/60 px-2.5 py-2 shadow-2xs">
            <div className="text-[11px] font-bold text-slate-800 truncate">
              {firstSlide?.heading || art.title}
            </div>
            <div className="text-[10px] text-slate-500 truncate mt-0.5">
              {firstSlide?.bullets?.[0] || art.summary}
            </div>
          </div>
        </div>
      );
    }

    if (art.kind === 'code_test' || art.kind === 'architecture') {
      return (
        <div className="h-28 rounded-t-xl bg-slate-900 border-b border-slate-800 p-3 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono font-semibold text-emerald-300">
              {art.kind === 'code_test' ? 'Code & Test' : 'Architecture'}
            </span>
            <span className="text-[10px] font-mono text-slate-400">{art.version}</span>
          </div>
          <pre className="text-[10px] leading-relaxed font-mono text-slate-300 line-clamp-3 whitespace-pre-wrap overflow-hidden">
            {art.content}
          </pre>
        </div>
      );
    }

    // Docs (PRD / Solution)
    return (
      <div className="h-28 rounded-t-xl bg-gradient-to-br from-sky-50/80 via-slate-50 to-blue-50/50 border-b border-slate-100 p-3 flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold text-sky-700 bg-white/90 px-2 py-0.5 rounded border border-sky-200/70">
            {KIND_META[art.kind].label}
          </span>
          <FileText className="w-3.5 h-3.5 text-sky-600/70" />
        </div>
        <div className="bg-white/90 rounded-lg border border-slate-200/70 px-2.5 py-2 space-y-1">
          <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
            {art.summary}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`${
        embeddedMode ? 'flex-1 min-w-0' : ''
      } h-full flex min-h-0 bg-white relative @container/shell`}
    >
      {/* FAR-LEFT PRIMARY NAVIGATION RAIL: Claude-style Scopes + Artifact Categories (Standalone Only) */}
      {!embeddedMode && (
        <WorkspacePrimaryRail ariaLabel="Artifacts 导航">
          <div className="space-y-0.5">
            <RailSectionLabel>产物视图</RailSectionLabel>
            {[
              { id: 'all' as const, label: '全部产物', icon: Shapes, count: scopeCounts.all },
              { id: 'yours' as const, label: '我创建的', icon: User, count: scopeCounts.yours },
              { id: 'shared' as const, label: '分享给我的', icon: Users, count: scopeCounts.shared },
              { id: 'starred' as const, label: '标星收藏', icon: Star, count: scopeCounts.starred },
            ].map((item) => {
              const Icon = item.icon;
              const active = scopeTab === item.id;
              return (
                <RailNavButton
                  key={item.id}
                  variant="primary"
                  active={active}
                  label={item.label}
                  count={item.count}
                  icon={
                    <Icon
                      className={`w-3.5 h-3.5 shrink-0 ${
                        active
                          ? item.id === 'starred'
                            ? 'text-amber-300'
                            : 'text-sky-300'
                          : item.id === 'starred'
                            ? 'text-amber-500'
                            : 'text-slate-400'
                      }`}
                    />
                  }
                  onClick={() => setScopeTab(item.id)}
                />
              );
            })}
          </div>

          <div className="space-y-0.5 pt-2.5 border-t border-slate-100">
            <RailSectionLabel>产物类型</RailSectionLabel>
            {[
              { id: 'all' as const, label: '全部类型', icon: FolderOpen, tint: 'text-slate-400' },
              { id: 'docs' as const, label: '文档 · Docs', icon: FileText, tint: 'text-sky-600' },
              {
                id: 'slides' as const,
                label: '演示稿 · Slides',
                icon: Presentation,
                tint: 'text-orange-600',
              },
              {
                id: 'design' as const,
                label: '设计素材 · Design',
                icon: Palette,
                tint: 'text-violet-600',
              },
              {
                id: 'code' as const,
                label: '代码与架构 · Code',
                icon: Code2,
                tint: 'text-emerald-600',
              },
            ].map((item) => {
              const Icon = item.icon;
              const active = categoryGroup === item.id;
              return (
                <RailNavButton
                  key={item.id}
                  variant="subtle"
                  active={active}
                  label={item.label}
                  count={categoryCounts[item.id]}
                  icon={
                    <Icon
                      className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-slate-900' : item.tint}`}
                    />
                  }
                  onClick={() => setCategoryGroup(item.id)}
                />
              );
            })}
          </div>
        </WorkspacePrimaryRail>
      )}

      {/* RIGHT WORKSPACE COLUMN: Toolbar + Make Something New + Artifacts Gallery */}
      <div className="flex-1 min-w-0 flex flex-col h-full min-h-0 @container/view">
        <ViewToolbar
          left={
            <>
              <ToolbarSearch
                value={searchKeyword}
                onChange={setSearchKeyword}
                placeholder="搜索文档、PPT、设计素材、标签或分享人..."
                widthClass="flex-1 min-w-[160px] max-w-[290px]"
              />
              {embeddedMode && (
                <ToolbarDropdown
                  label="类型"
                  value={categoryGroup}
                  defaultValue="all"
                  onChange={setCategoryGroup}
                  options={[
                    { id: 'all', label: '全部类型', hint: `${categoryCounts.all}` },
                    { id: 'docs', label: '文档 · Docs', hint: `${categoryCounts.docs}` },
                    { id: 'slides', label: '演示稿 · Slides', hint: `${categoryCounts.slides}` },
                    { id: 'design', label: '设计素材 · Design', hint: `${categoryCounts.design}` },
                    { id: 'code', label: '代码与架构 · Code', hint: `${categoryCounts.code}` },
                  ]}
                />
              )}
              <ToolbarDropdown
                label="来源"
                value={sourceFilter}
                defaultValue="all"
                onChange={setSourceFilter}
                options={[
                  { id: 'all', label: '全部来源' },
                  { id: 'task_session', label: '任务生成' },
                  { id: 'project_group', label: '对话分享' },
                  { id: 'manual', label: '手动创作' },
                ]}
              />
              <ToolbarDropdown
                label="项目"
                value={projectFilter}
                defaultValue="all"
                onChange={setProjectFilter}
                options={[
                  { id: 'all', label: '全部项目' },
                  ...workspaces.map((w) => ({ id: w.id, label: w.name })),
                ]}
              />
            </>
          }
          right={
            <>
              <div className="inline-flex items-center p-0.5 rounded-lg border border-slate-200 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  title="卡片画廊视图"
                  className={`p-1.5 rounded-md cursor-pointer transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-400 hover:text-slate-700'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  title="紧凑列表视图"
                  className={`p-1.5 rounded-md cursor-pointer transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-400 hover:text-slate-700'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => openCreateWithKind('prd')}
                className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white whitespace-nowrap cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>新建 Artifact</span>
              </button>
            </>
          }
        />

        {/* Scrollable Canvas */}
        <div
          className={`flex-1 min-h-0 overflow-y-auto clean-scroll bg-slate-50/70 ${WORKSPACE_GUTTER_CLASS} py-5`}
        >
          <div className={`${WORKSPACE_MAX_WIDTH_CLASS} space-y-5`}>
            {/* Narrow-Screen Scope Tabs (< 760px) */}
            <div className="@[760px]/shell:hidden flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {(
                [
                  { id: 'all', label: '全部产物', count: scopeCounts.all },
                  { id: 'yours', label: '我创建的', count: scopeCounts.yours },
                  { id: 'shared', label: '分享给我的', count: scopeCounts.shared },
                  { id: 'starred', label: '标星收藏', count: scopeCounts.starred },
                ] as { id: ArtifactScopeTab; label: string; count: number }[]
              ).map((tab) => {
                const active = scopeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setScopeTab(tab.id)}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer border ${
                      active
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="text-[10px] font-mono opacity-75">{tab.count}</span>
                  </button>
                );
              })}
            </div>

            {/* Claude-Style "快速创作 · Make something new" Visual Launcher Cards */}
            <section className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-semibold text-slate-500">
                  快速创作 · 新建 Artifact
                </h2>
                <span className="text-[11px] text-slate-400">
                  支持文档、演示稿、设计素材与代码架构，并可一键分享至对话
                </span>
              </div>
              <div className="grid grid-cols-2 @[720px]:grid-cols-4 gap-3">
                {LAUNCHER_PRESETS.map((preset) => {
                  const Icon = preset.icon;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => openCreateWithKind(preset.kind)}
                      className={`group text-left bg-white rounded-xl border border-slate-200/90 ${preset.accentRing} p-2.5 transition-all hover:shadow-xs cursor-pointer`}
                    >
                      <div
                        className={`h-20 rounded-lg ${preset.cardBg} flex items-center justify-center transition-transform group-hover:scale-[1.01]`}
                      >
                        <Icon className={`w-7 h-7 ${preset.iconColor}`} strokeWidth={1.75} />
                      </div>
                      <div className="mt-2.5 px-0.5">
                        <div className="text-xs font-bold text-slate-900">{preset.title}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {preset.subtitle}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Artifacts Gallery / List */}
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-800">
                    {scopeTab === 'all'
                      ? '全部 Artifacts'
                      : scopeTab === 'yours'
                        ? '我创建的 Artifacts'
                        : scopeTab === 'shared'
                          ? '分享给我的 Artifacts'
                          : '标星收藏'}
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="font-mono tabular-nums">{filteredArtifacts.length} 项</span>
                </div>
                {(categoryGroup !== 'all' || projectFilter !== 'all' || sourceFilter !== 'all' || searchKeyword.trim()) && (
                  <button
                    type="button"
                    onClick={() => {
                      setCategoryGroup('all');
                      setProjectFilter('all');
                      setSourceFilter('all');
                      setSearchKeyword('');
                    }}
                    className="text-xs font-medium text-blue-700 hover:text-blue-900 cursor-pointer"
                  >
                    清除筛选
                  </button>
                )}
              </div>

              {filteredArtifacts.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-slate-300 py-14 px-6 text-center space-y-2.5">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 inline-flex items-center justify-center mx-auto">
                    <Shapes className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-semibold text-slate-800">
                    {scopeTab === 'shared'
                      ? '暂无分享给你的 Artifact'
                      : scopeTab === 'starred'
                        ? '暂无标星收藏的 Artifact'
                        : '当前筛选下暂无匹配的 Artifact'}
                  </p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    {scopeTab === 'shared'
                      ? '当协作者或社区专家在项目群或任务会话中分享文档、PPT 或设计素材时，会自动汇聚到这里。'
                      : '你可以点击上方「快速创作」卡片新建文档、演示稿或设计素材，或在 Agent 任务执行后自动沉淀。'}
                  </p>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 @[560px]:grid-cols-2 @[980px]:grid-cols-3 gap-4">
                  {filteredArtifacts.map((art) => {
                    const kindMeta = KIND_META[art.kind];
                    const srcMeta = SOURCE_META[art.sourceType];
                    const proj = workspaceMap.get(art.projectId);
                    const isDerived = art.id.startsWith('art_task_');

                    return (
                      <article
                        key={art.id}
                        onClick={() => setPreviewId(art.id)}
                        className="group bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-xs transition-all flex flex-col justify-between cursor-pointer overflow-hidden"
                      >
                        <div>
                          {renderCardThumbnail(art)}
                          <div className="p-3.5 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors line-clamp-1">
                                {art.title}
                              </h3>
                              {!isDerived && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleStarArtifact(art.id);
                                  }}
                                  title={art.starred ? '取消标星' : '标星收藏'}
                                  className={`p-1 rounded-md shrink-0 cursor-pointer transition-colors ${
                                    art.starred
                                      ? 'text-amber-500 hover:bg-amber-50'
                                      : 'text-slate-300 hover:text-amber-500 hover:bg-slate-100'
                                  }`}
                                >
                                  <Star
                                    className="w-3.5 h-3.5"
                                    fill={art.starred ? 'currentColor' : 'none'}
                                  />
                                </button>
                              )}
                            </div>

                            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                              {art.summary}
                            </p>

                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[10px]">
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded border font-semibold ${kindMeta.badgeCls}`}
                              >
                                {kindMeta.label}
                              </span>
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded border font-medium ${srcMeta.cls}`}
                              >
                                {srcMeta.label}
                                {art.sourceTaskId ? ` #${art.sourceTaskId}` : ''}
                              </span>
                              {proj && (
                                <span className="text-slate-500 truncate max-w-[120px]">
                                  · {proj.name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="px-3.5 py-2.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2 text-[11px]">
                          <span className="text-slate-500 truncate min-w-0">
                            {art.ownership === 'shared' && art.sharedByName
                              ? `来自 ${art.sharedByName}`
                              : art.authorName}{' '}
                            · {art.updatedAt}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewId(art.id);
                              }}
                              title="分享到对话或查看详情"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer"
                            >
                              <Share2 className="w-3 h-3 text-blue-600" />
                              <span>分享</span>
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                  {filteredArtifacts.map((art) => {
                    const kindMeta = KIND_META[art.kind];
                    const srcMeta = SOURCE_META[art.sourceType];
                    const KindIcon = kindMeta.icon;
                    const proj = workspaceMap.get(art.projectId);
                    const isDerived = art.id.startsWith('art_task_');

                    return (
                      <div
                        key={art.id}
                        onClick={() => setPreviewId(art.id)}
                        className="px-4 py-3.5 hover:bg-slate-50/80 transition-colors flex flex-col @[760px]:flex-row @[760px]:items-center justify-between gap-3 cursor-pointer"
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <span
                            className={`w-9 h-9 rounded-lg border inline-flex items-center justify-center shrink-0 mt-0.5 ${kindMeta.badgeCls}`}
                          >
                            <KindIcon className="w-4 h-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-bold text-slate-900 truncate">
                                {art.title}
                              </span>
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-semibold ${kindMeta.badgeCls}`}
                              >
                                {kindMeta.label}
                              </span>
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${srcMeta.cls}`}
                              >
                                {srcMeta.label}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 line-clamp-1 mt-0.5">
                              {art.summary}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-1">
                              <span>{proj?.name || '个人产物'}</span>
                              <span className="text-slate-300">·</span>
                              <span>
                                {art.ownership === 'shared' && art.sharedByName
                                  ? `分享自 ${art.sharedByName}`
                                  : `作者 ${art.authorName}`}
                              </span>
                              <span className="text-slate-300">·</span>
                              <span className="font-mono text-[10px]">{art.version}</span>
                              <span className="text-slate-300">·</span>
                              <span>{art.updatedAt}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 self-end @[760px]:self-center">
                          {!isDerived && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleStarArtifact(art.id);
                              }}
                              className={`p-1.5 rounded-lg border cursor-pointer ${
                                art.starred
                                  ? 'border-amber-200 bg-amber-50 text-amber-500'
                                  : 'border-slate-200 bg-white text-slate-400 hover:text-amber-500'
                              }`}
                            >
                              <Star
                                className="w-3.5 h-3.5"
                                fill={art.starred ? 'currentColor' : 'none'}
                              />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewId(art.id);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
                          >
                            <Share2 className="w-3.5 h-3.5 text-blue-600" />
                            <span>查看 / 分享</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      {/* SLIDE-IN PREVIEW & SHARE DRAWER */}
      {previewArtifact && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-slate-900/35"
            onClick={() => setPreviewId(null)}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-full max-w-2xl bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col">
            {/* Drawer Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3 shrink-0">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-semibold ${
                      KIND_META[previewArtifact.kind].badgeCls
                    }`}
                  >
                    {KIND_META[previewArtifact.kind].label}
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium ${
                      SOURCE_META[previewArtifact.sourceType].cls
                    }`}
                  >
                    {SOURCE_META[previewArtifact.sourceType].label}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {previewArtifact.version}
                  </span>
                </div>
                <h2 className="text-base font-bold text-slate-900 leading-snug">
                  {previewArtifact.title}
                </h2>
                <div className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5">
                  <span>{workspaceMap.get(previewArtifact.projectId)?.name || '独立产物'}</span>
                  <span className="text-slate-300">·</span>
                  <span>
                    {previewArtifact.ownership === 'shared' && previewArtifact.sharedByName
                      ? `来自 ${previewArtifact.sharedByName} 分享`
                      : `创建者：${previewArtifact.authorName}`}
                  </span>
                  <span className="text-slate-300">·</span>
                  <span>{previewArtifact.updatedAt}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewId(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer shrink-0"
                aria-label="关闭预览"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 min-h-0 overflow-y-auto clean-scroll p-5 space-y-5">
              {/* Summary */}
              <div className="bg-slate-50 rounded-xl border border-slate-200/80 p-3.5 text-xs text-slate-700 leading-relaxed">
                {previewArtifact.summary}
              </div>

              {/* Slides Preview */}
              {previewArtifact.kind === 'ppt' &&
                previewArtifact.slides &&
                previewArtifact.slides.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Presentation className="w-4 h-4 text-orange-600" />
                      <span>演示分镜预览（共 {previewArtifact.slides.length} 页）</span>
                    </div>
                    <div className="space-y-2.5">
                      {previewArtifact.slides.map((slide, idx) => (
                        <div
                          key={`${slide.heading}-${idx}`}
                          className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-bold text-slate-900">{slide.heading}</div>
                            <span className="text-[10px] font-mono text-slate-400">
                              Slide {idx + 1}
                            </span>
                          </div>
                          <ul className="space-y-1.5 text-xs text-slate-600 list-disc pl-4">
                            {slide.bullets.map((b, bi) => (
                              <li key={bi}>{b}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Design Moodboard & Tokens Preview */}
              {previewArtifact.kind === 'design' && previewArtifact.designSpec && (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Palette className="w-4 h-4 text-violet-600" />
                    <span>设计情绪板与视觉规范</span>
                  </div>
                  <div className="rounded-xl border border-violet-200/80 bg-violet-50/30 p-4 space-y-4">
                    <div>
                      <div className="text-[11px] font-semibold text-slate-600 mb-2">
                        主色板 Palette Tokens
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {previewArtifact.designSpec.palette.map((hex) => (
                          <div
                            key={hex}
                            className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2 py-1.5"
                          >
                            <span
                              className="w-5 h-5 rounded-md border border-slate-200 shrink-0"
                              style={{ backgroundColor: hex }}
                            />
                            <span className="text-[11px] font-mono text-slate-700">{hex}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-slate-600 mb-1">字体排版</div>
                      <div className="text-xs font-mono text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2">
                        {previewArtifact.designSpec.typography}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-slate-600 mb-1.5">
                        包含组件素材
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {previewArtifact.designSpec.components.map((comp) => (
                          <div
                            key={comp}
                            className="bg-white border border-violet-200/70 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 flex items-center gap-2"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                            <span className="truncate">{comp}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Content Body */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800">完整内容</span>
                  <button
                    type="button"
                    onClick={() => handleCopyContent(previewArtifact)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    {copiedId === previewArtifact.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">已复制</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>复制全文</span>
                      </>
                    )}
                  </button>
                </div>
                {previewArtifact.kind === 'code_test' ? (
                  <pre className="rounded-xl bg-slate-900 text-slate-100 p-4 text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap">
                    {previewArtifact.content}
                  </pre>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {previewArtifact.content}
                  </div>
                )}
              </div>

              {/* Share to Project Group Chat Card */}
              <form
                onSubmit={handleShareSubmit}
                className="rounded-xl border border-blue-200/80 bg-blue-50/40 p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900 inline-flex items-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>对话分享 · 推送至项目群</span>
                  </span>
                  {shareSuccessProjectId && (
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewId(null);
                        onOpenProjectChat(shareSuccessProjectId);
                      }}
                      className="text-xs font-semibold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>已发送 · 前往查看</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={shareProjectId}
                    onChange={(e) => setShareProjectId(e.target.value)}
                    aria-label="选择目标项目群"
                    className="bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  >
                    {workspaces.map((w) => (
                      <option key={w.id} value={w.id}>
                        项目群：{w.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={shareNote}
                    onChange={(e) => setShareNote(e.target.value)}
                    placeholder="附言（可选，如：请大家评审第 2 页）"
                    className="bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>分享到该对话</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Drawer Footer */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                {previewArtifact.sourceTaskId && taskMap.has(previewArtifact.sourceTaskId) && (
                  <button
                    type="button"
                    onClick={() => {
                      const tid = previewArtifact.sourceTaskId!;
                      setPreviewId(null);
                      onOpenTaskSession(tid);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-800 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                    <span>打开来源任务 #{previewArtifact.sourceTaskId}</span>
                  </button>
                )}
                {!previewArtifact.id.startsWith('art_task_') && (
                  <button
                    type="button"
                    onClick={() => onToggleStarArtifact(previewArtifact.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-medium text-slate-700 cursor-pointer"
                  >
                    <Star
                      className={`w-3.5 h-3.5 ${
                        previewArtifact.starred ? 'text-amber-500' : 'text-slate-400'
                      }`}
                      fill={previewArtifact.starred ? 'currentColor' : 'none'}
                    />
                    <span>{previewArtifact.starred ? '已收藏' : '收藏'}</span>
                  </button>
                )}
              </div>

              {!previewArtifact.id.startsWith('art_task_') && (
                <button
                  type="button"
                  onClick={() => {
                    onDeleteArtifact(previewArtifact.id);
                    setPreviewId(null);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>删除</span>
                </button>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* SLIDE-IN CREATE ARTIFACT DRAWER */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-slate-900/35"
            onClick={() => setCreateOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-full max-w-lg bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <div>
                <h2 className="text-sm font-bold text-slate-900">新建 Artifact 产物</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  创建后自动归入「我创建的」，并可一键分享至任意项目群协作评审
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleCreateSubmit}
              className="flex-1 min-h-0 overflow-y-auto clean-scroll p-5 space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">产物类型</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.keys(KIND_META) as ArtifactKind[]).map((k) => {
                    const meta = KIND_META[k];
                    const active = newKind === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setNewKind(k)}
                        className={`px-2.5 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                          active
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">关联项目</label>
                  <select
                    value={newProjectId}
                    onChange={(e) => setNewProjectId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-600/20"
                  >
                    {workspaces.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">生成来源</label>
                  <select
                    value={newSourceType}
                    onChange={(e) => setNewSourceType(e.target.value as ArtifactSourceType)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-600/20"
                  >
                    <option value="manual">手动创作</option>
                    <option value="project_group">对话分享</option>
                    <option value="task_session">任务生成</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">标题 *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={
                    newKind === 'design'
                      ? '例如：新版本控制台情绪板与配色规范'
                      : newKind === 'ppt'
                        ? '例如：Q4 产品路线图评审演示稿'
                        : '例如：多币种清分异常处理方案'
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">摘要说明</label>
                <input
                  type="text"
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  placeholder="一句话概括该产物用途或核心亮点..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">
                  {newKind === 'ppt' ? '演示大纲要点（每行一条）' : '正文 / 设计说明 / 代码内容'}
                </label>
                <textarea
                  rows={6}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="输入详细文档内容、演示要点或视觉设计规范..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-600/20 resize-y"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">标签（逗号分隔）</label>
                <input
                  type="text"
                  value={newTagsText}
                  onChange={(e) => setNewTagsText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
                >
                  保存 Artifact
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}
    </div>
  );
}
