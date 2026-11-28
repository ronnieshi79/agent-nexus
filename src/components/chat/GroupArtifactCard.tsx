import { useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  ExternalLink,
  FileCode2,
  FileText,
  MessageSquare,
  Palette,
  Paperclip,
  Presentation,
  Sparkles,
} from 'lucide-react';
import type { ArtifactKind, ArtifactSourceType, ProjectArtifact } from '../../types/agentnexus';
import { ModalShell } from '../shared/UiPrimitives';

export const ARTIFACT_KIND_META: Record<
  ArtifactKind,
  {
    label: string;
    shortLabel: string;
    icon: typeof FileText;
    iconBgCls: string;
    iconTextCls: string;
    tagCls: string;
  }
> = {
  prd: {
    label: 'PRD 文档',
    shortLabel: 'PRD',
    icon: FileText,
    iconBgCls: 'bg-sky-50 border-sky-200/80',
    iconTextCls: 'text-sky-700',
    tagCls: 'text-sky-700',
  },
  solution: {
    label: '方案分析',
    shortLabel: '方案',
    icon: MessageSquare,
    iconBgCls: 'bg-blue-50 border-blue-200/80',
    iconTextCls: 'text-blue-700',
    tagCls: 'text-blue-700',
  },
  ppt: {
    label: '演示稿 PPT',
    shortLabel: 'PPT',
    icon: Presentation,
    iconBgCls: 'bg-orange-50 border-orange-200/80',
    iconTextCls: 'text-orange-700',
    tagCls: 'text-orange-700',
  },
  design: {
    label: '视觉与设计',
    shortLabel: '设计',
    icon: Palette,
    iconBgCls: 'bg-violet-50 border-violet-200/80',
    iconTextCls: 'text-violet-700',
    tagCls: 'text-violet-700',
  },
  architecture: {
    label: '架构设计',
    shortLabel: '架构',
    icon: Code2,
    iconBgCls: 'bg-teal-50 border-teal-200/80',
    iconTextCls: 'text-teal-700',
    tagCls: 'text-teal-700',
  },
  code_test: {
    label: '代码与测试',
    shortLabel: '代码',
    icon: FileCode2,
    iconBgCls: 'bg-emerald-50 border-emerald-200/80',
    iconTextCls: 'text-emerald-700',
    tagCls: 'text-emerald-700',
  },
};

export const ARTIFACT_SOURCE_LABEL: Record<ArtifactSourceType, string> = {
  task_session: '任务 AI 产出',
  project_group: '群聊 AI 产出',
  manual: '我对话上传',
};

interface GroupArtifactCardProps {
  artifact: ProjectArtifact;
  onPreview: (artifact: ProjectArtifact) => void;
}

/**
 * Structured Artifact card embedded directly inside chat messages
 * (for both user-uploaded inputs and AI-generated PPTs, reports, designs, and code).
 */
export function GroupArtifactCard({ artifact, onPreview }: GroupArtifactCardProps) {
  const meta = ARTIFACT_KIND_META[artifact.kind] || ARTIFACT_KIND_META.prd;
  const Icon = meta.icon;
  const isUserUpload = artifact.sourceType === 'manual';

  return (
    <button
      type="button"
      onClick={() => onPreview(artifact)}
      className="group w-full text-left rounded-xl border border-slate-200/90 hover:border-slate-300 bg-white transition-colors overflow-hidden cursor-pointer"
    >
      <div className="px-3.5 py-3 flex items-start gap-3">
        <div
          className={`w-9 h-9 rounded-lg border inline-flex items-center justify-center shrink-0 mt-0.5 ${meta.iconBgCls} ${meta.iconTextCls}`}
        >
          <Icon className="w-4 h-4" />
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1.5 min-w-0">
              <span className={`font-semibold ${meta.tagCls}`}>{meta.label}</span>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-0.5 text-slate-500">
                {isUserUpload ? (
                  <Paperclip className="w-3 h-3 text-slate-400" />
                ) : (
                  <Sparkles className="w-3 h-3 text-indigo-500" />
                )}
                <span>{ARTIFACT_SOURCE_LABEL[artifact.sourceType]}</span>
              </span>
            </span>
            <span className="font-mono tabular-nums text-[10.5px] text-slate-400 shrink-0">
              {artifact.version}
            </span>
          </div>

          <div className="text-[13px] font-semibold text-slate-900 group-hover:text-blue-700 transition-colors leading-snug line-clamp-1">
            {artifact.title}
          </div>

          <p className="text-xs text-slate-500 line-clamp-1 leading-relaxed">{artifact.summary}</p>

          {/* Compact visual preview strip for rich artifact types */}
          {artifact.kind === 'ppt' && artifact.slides && artifact.slides.length > 0 && (
            <div className="pt-1 flex items-center gap-2 text-[11px] text-amber-800">
              <span className="font-mono tabular-nums font-semibold shrink-0">
                {artifact.slides.length} 页分镜
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-600 truncate">{artifact.slides[0].heading}</span>
            </div>
          )}

          {artifact.kind === 'design' && artifact.designSpec && (
            <div className="pt-1 flex items-center gap-2 text-[11px] text-slate-500">
              <span className="inline-flex items-center -space-x-1 shrink-0">
                {artifact.designSpec.palette.slice(0, 5).map((hex, i) => (
                  <span
                    key={`${hex}-${i}`}
                    className="w-3.5 h-3.5 rounded-full border border-white"
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </span>
              <span className="truncate">{artifact.designSpec.components.slice(0, 3).join(' / ')}</span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

interface ArtifactPreviewModalProps {
  artifact: ProjectArtifact | null;
  onClose: () => void;
  onOpenTaskSession?: (taskId: string) => void;
}

export function ArtifactPreviewModal({
  artifact,
  onClose,
  onOpenTaskSession,
}: ArtifactPreviewModalProps) {
  const [copied, setCopied] = useState(false);

  if (!artifact) return null;

  const meta = ARTIFACT_KIND_META[artifact.kind] || ARTIFACT_KIND_META.prd;
  const Icon = meta.icon;

  const handleCopy = () => {
    const body =
      artifact.slides && artifact.slides.length > 0
        ? `${artifact.title}\n\n${artifact.slides
            .map((s) => `${s.heading}\n${s.bullets.map((b) => `- ${b}`).join('\n')}`)
            .join('\n\n')}`
        : artifact.content;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(body).catch(() => {});
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <ModalShell
      open={Boolean(artifact)}
      onClose={onClose}
      icon={<Icon className={`w-4 h-4 ${meta.iconTextCls}`} />}
      title={artifact.title}
      subtitle={`${meta.label} · ${ARTIFACT_SOURCE_LABEL[artifact.sourceType]} · ${artifact.authorName} · ${artifact.version} · ${artifact.updatedAt}`}
      maxWidthClass="max-w-2xl"
      footer={
        <>
          <div className="flex items-center gap-2">
            {artifact.sourceTaskId && onOpenTaskSession && (
              <button
                type="button"
                onClick={() => {
                  const tid = artifact.sourceTaskId!;
                  onClose();
                  onOpenTaskSession(tid);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                <span>查看来源任务 #{artifact.sourceTaskId}</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">已复制</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>复制内容</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
            >
              关闭
            </button>
          </div>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 border border-slate-200/80 px-3.5 py-2.5 text-xs text-slate-700 leading-relaxed">
          {artifact.summary}
        </div>

        {artifact.kind === 'ppt' && artifact.slides && artifact.slides.length > 0 && (
          <div className="space-y-2.5">
            <div className="text-xs font-bold text-slate-800">
              演示分镜（共 {artifact.slides.length} 页）
            </div>
            <div className="space-y-2">
              {artifact.slides.map((slide, idx) => (
                <div
                  key={`${slide.heading}-${idx}`}
                  className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">{slide.heading}</span>
                    <span className="text-[10px] font-mono text-slate-400">Slide {idx + 1}</span>
                  </div>
                  <ul className="space-y-1 text-xs text-slate-600 list-disc pl-4">
                    {slide.bullets.map((b, bi) => (
                      <li key={bi}>{b}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {artifact.kind === 'design' && artifact.designSpec && (
          <div className="rounded-lg border border-violet-200/80 bg-violet-50/30 p-3.5 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {artifact.designSpec.palette.map((hex) => (
                <div
                  key={hex}
                  className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-md px-2 py-1"
                >
                  <span
                    className="w-4 h-4 rounded border border-slate-200"
                    style={{ backgroundColor: hex }}
                  />
                  <span className="text-[11px] font-mono text-slate-700">{hex}</span>
                </div>
              ))}
            </div>
            <div className="text-xs text-slate-600">
              <span className="font-semibold text-slate-700">字体：</span>
              <span className="font-mono">{artifact.designSpec.typography}</span>
            </div>
            <div className="text-xs text-slate-600">
              <span className="font-semibold text-slate-700">包含组件：</span>
              <span>{artifact.designSpec.components.join(' · ')}</span>
            </div>
          </div>
        )}

        {artifact.kind === 'code_test' ? (
          <pre className="rounded-lg bg-slate-950 text-slate-100 p-4 text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap">
            {artifact.content}
          </pre>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
            {artifact.content}
          </div>
        )}
      </div>
    </ModalShell>
  );
}
