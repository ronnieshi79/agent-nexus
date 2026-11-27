import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronUp,
  Code2,
  Copy,
  FileCode2,
  FileText,
  MessageSquare,
  MessageSquareCode,
  Palette,
  Presentation,
  Shapes,
} from 'lucide-react';
import type {
  ArtifactKind,
  ProjectArtifact,
  WorkflowTask,
} from '../../types/agentnexus';

interface ProjectArtifactsRailTabProps {
  projectId: string;
  artifacts: ProjectArtifact[];
  tasks: WorkflowTask[];
  onOpenTaskSession: (taskId: string) => void;
  onOpenProjectArtifacts?: (projectId: string) => void;
}

const KIND_META: Record<
  ArtifactKind,
  { label: string; icon: typeof FileText; textCls: string }
> = {
  prd: { label: 'PRD 文档', icon: FileText, textCls: 'text-sky-700' },
  solution: { label: '方案讨论', icon: MessageSquare, textCls: 'text-blue-700' },
  ppt: { label: '演示稿', icon: Presentation, textCls: 'text-orange-700' },
  design: { label: '设计素材', icon: Palette, textCls: 'text-violet-700' },
  architecture: { label: '架构设计', icon: Code2, textCls: 'text-teal-700' },
  code_test: { label: '代码与测试', icon: FileCode2, textCls: 'text-emerald-700' },
};

export function ProjectArtifactsRailTab({
  projectId,
  artifacts,
  tasks,
  onOpenTaskSession,
  onOpenProjectArtifacts,
}: ProjectArtifactsRailTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const combinedArtifacts = useMemo(() => {
    const projectArtifacts = artifacts.filter((a) => a.projectId === projectId);
    const coveredTaskIds = new Set(projectArtifacts.map((a) => a.sourceTaskId).filter(Boolean));
    const derivedFromTasks: ProjectArtifact[] = tasks
      .filter((t) => Boolean(t.deliverableArtifact) && !coveredTaskIds.has(t.id))
      .map((t) => ({
        id: `live_art_${t.id}`,
        projectId: t.sessionId,
        title: `${t.title}（${t.deliverableArtifact}）`,
        kind:
          t.workType === 'planning'
            ? 'prd'
            : t.workType === 'review'
              ? 'architecture'
              : 'code_test',
        ownership: 'yours',
        summary: t.deliverableSummary || t.description,
        content: `产物路径：${t.deliverableArtifact}\n\n${t.deliverableSummary || t.description}`,
        sourceType: 'task_session',
        sourceTaskId: t.id,
        authorName: t.assigneeHandle,
        authorType: 'agent',
        version: 'v1.0',
        updatedAt: t.updatedAt,
        tags: [t.featureModule || '任务交付'],
      }));
    return [...projectArtifacts, ...derivedFromTasks];
  }, [artifacts, projectId, tasks]);

  const handleCopy = (art: ProjectArtifact) => {
    const body =
      art.slides && art.slides.length > 0
        ? `${art.title}\n\n${art.slides
            .map((s) => `${s.heading}\n${s.bullets.map((b) => `- ${b}`).join('\n')}`)
            .join('\n\n')}`
        : art.content;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(body).catch(() => {});
    }
    setCopiedId(art.id);
    window.setTimeout(() => {
      setCopiedId((prev) => (prev === art.id ? null : prev));
    }, 1600);
  };

  if (combinedArtifacts.length === 0) {
    return (
      <div className="py-10 text-center space-y-2.5">
        <Shapes className="w-7 h-7 text-slate-300 mx-auto" />
        <div className="text-xs font-medium text-slate-600">当前项目暂无沉淀产出物</div>
        <p className="text-[11px] text-slate-400 leading-relaxed px-3">
          专家 Agent 在任务会话中输出文档、设计或代码后，产物会自动同步至此实时查看。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {onOpenProjectArtifacts && (
        <div className="flex items-center justify-between px-0.5 text-[11px] text-slate-500">
          <span>
            实时同步 <strong className="font-mono tabular-nums text-slate-800">{combinedArtifacts.length}</strong> 份项目产出
          </span>
          <button
            type="button"
            onClick={() => onOpenProjectArtifacts(projectId)}
            className="inline-flex items-center gap-0.5 font-semibold text-blue-700 hover:text-blue-900 cursor-pointer whitespace-nowrap"
          >
            <span>完整产物库</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {combinedArtifacts.map((art) => {
        const meta = KIND_META[art.kind] || KIND_META.prd;
        const Icon = meta.icon;
        const isExpanded = expandedId === art.id;
        const isCopied = copiedId === art.id;

        return (
          <div
            key={art.id}
            className="rounded-xl border border-slate-200/85 bg-white hover:border-slate-300 transition-colors overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setExpandedId((prev) => (prev === art.id ? null : art.id))}
              className="w-full text-left p-3.5 space-y-1.5 cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className={`inline-flex items-center gap-1 font-semibold ${meta.textCls}`}>
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{meta.label}</span>
                  <span className="text-slate-300 font-normal">·</span>
                  <span className="font-mono text-slate-400 font-normal">{art.version}</span>
                </span>
                <span className="inline-flex items-center gap-1 text-[10.5px] font-mono tabular-nums text-slate-400 shrink-0">
                  <span>{art.updatedAt}</span>
                  {isExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </span>
              </div>

              <div className="text-[13px] font-semibold text-slate-900 leading-snug line-clamp-2">
                {art.title}
              </div>

              <p className="text-[11.5px] text-slate-500 leading-relaxed line-clamp-2">
                {art.summary}
              </p>

              <div className="text-[11px] text-slate-400 pt-0.5 flex items-center gap-1.5 truncate">
                <span className="truncate">{art.authorName}</span>
                {art.sourceTaskId && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-slate-500 shrink-0">{art.sourceTaskId}</span>
                  </>
                )}
              </div>
            </button>

            {isExpanded && (
              <div className="px-3.5 pb-3.5 pt-2.5 border-t border-slate-100 bg-[#FAFAFA] space-y-2.5">
                {art.slides && art.slides.length > 0 ? (
                  <div className="space-y-2 max-h-56 overflow-y-auto clean-scroll pr-1">
                    {art.slides.map((slide, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-slate-200/80 bg-white p-2.5 space-y-1"
                      >
                        <div className="text-[11.5px] font-semibold text-slate-900">
                          {slide.heading}
                        </div>
                        <ul className="space-y-0.5 text-[11px] text-slate-600 list-disc pl-4">
                          {slide.bullets.map((b, bi) => (
                            <li key={bi}>{b}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : art.designSpec ? (
                  <div className="space-y-2 text-[11px] text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 shrink-0">色板：</span>
                      <div className="flex items-center gap-1">
                        {art.designSpec.palette.map((hex, i) => (
                          <span
                            key={`${hex}-${i}`}
                            title={hex}
                            className="w-4 h-4 rounded border border-slate-200"
                            style={{ backgroundColor: hex }}
                          />
                        ))}
                      </div>
                    </div>
                    <div>字体：{art.designSpec.typography}</div>
                    <div>组件：{art.designSpec.components.join(' · ')}</div>
                    <pre className="whitespace-pre-wrap font-sans text-[11.5px] text-slate-700 leading-relaxed bg-white border border-slate-200/80 rounded-lg p-2.5 max-h-48 overflow-y-auto clean-scroll">
                      {art.content}
                    </pre>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap font-sans text-[11.5px] text-slate-700 leading-relaxed bg-white border border-slate-200/80 rounded-lg p-2.5 max-h-56 overflow-y-auto clean-scroll">
                    {art.content}
                  </pre>
                )}

                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => handleCopy(art)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-700">已复制</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>复制内容</span>
                      </>
                    )}
                  </button>

                  {art.sourceTaskId && (
                    <button
                      type="button"
                      onClick={() => onOpenTaskSession(art.sourceTaskId!)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-white cursor-pointer whitespace-nowrap"
                    >
                      <MessageSquareCode className="w-3 h-3" />
                      <span>查看来源会话</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
