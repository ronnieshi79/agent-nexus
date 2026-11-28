import { useMemo, useState } from 'react';
import { ArrowUpRight, Check, Copy, Paperclip, Shapes } from 'lucide-react';
import type { ProjectArtifact, WorkflowTask } from '../../types/agentnexus';
import { ARTIFACT_KIND_META, ARTIFACT_SOURCE_LABEL } from './GroupArtifactCard';

interface ProjectArtifactsRailTabProps {
  projectId: string;
  artifacts: ProjectArtifact[];
  tasks: WorkflowTask[];
  onPreviewArtifact: (artifact: ProjectArtifact) => void;
  onOpenProjectArtifacts?: (projectId: string) => void;
}

/**
 * Compact, high-density flat list for project Artifacts inside the chat right rail.
 * Keeps space utilization high (no heavy card chrome); clicking any row opens the full preview modal.
 */
export function ProjectArtifactsRailTab({
  projectId,
  artifacts,
  tasks,
  onPreviewArtifact,
  onOpenProjectArtifacts,
}: ProjectArtifactsRailTabProps) {
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
    }, 1500);
  };

  if (combinedArtifacts.length === 0) {
    return (
      <div className="py-10 text-center space-y-2">
        <Shapes className="w-6 h-6 text-slate-300 mx-auto" />
        <div className="text-xs font-medium text-slate-600">当前对话暂无产出物</div>
        <p className="text-[11px] text-slate-400 leading-relaxed px-3">
          对话中上传的文件，以及 AI 输出的 PPT、分析报告、设计与代码都会以简洁列表汇集于此。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-1 pb-1 text-[11px] text-slate-500">
        <span>
          共 <strong className="font-mono tabular-nums text-slate-800">{combinedArtifacts.length}</strong> 项对话产出
        </span>
        {onOpenProjectArtifacts && (
          <button
            type="button"
            onClick={() => onOpenProjectArtifacts(projectId)}
            className="inline-flex items-center gap-0.5 font-semibold text-blue-700 hover:text-blue-900 cursor-pointer whitespace-nowrap"
          >
            <span>完整产物库</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Compact borderless flat list (zero card chrome) */}
      <ul className="divide-y divide-slate-200/70">
        {combinedArtifacts.map((art) => {
          const meta = ARTIFACT_KIND_META[art.kind] || ARTIFACT_KIND_META.prd;
          const Icon = meta.icon;
          const isCopied = copiedId === art.id;
          const isUserUpload = art.sourceType === 'manual';

          return (
            <li key={art.id} className="group/row flex items-center gap-2 py-2 px-1.5 hover:bg-slate-200/50 rounded-md transition-colors">
              <button
                type="button"
                onClick={() => onPreviewArtifact(art)}
                className="flex items-start gap-2 min-w-0 flex-1 text-left cursor-pointer"
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${meta.iconTextCls}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-medium text-slate-800 group-hover/row:text-slate-950 truncate leading-snug">
                    {art.title}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10.5px] text-slate-400 mt-0.5 truncate">
                    <span className={`font-medium shrink-0 ${meta.tagCls}`}>{meta.shortLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-0.5 shrink-0">
                      {isUserUpload && <Paperclip className="w-2.5 h-2.5" />}
                      <span>{ARTIFACT_SOURCE_LABEL[art.sourceType]}</span>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums shrink-0">{art.updatedAt}</span>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy(art);
                }}
                title="复制产物内容"
                className="opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-white transition-opacity cursor-pointer shrink-0"
              >
                {isCopied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
