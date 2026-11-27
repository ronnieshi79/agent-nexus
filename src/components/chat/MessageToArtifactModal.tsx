import { useEffect, useState, type FormEvent } from 'react';
import { MessageSquareQuote, Shapes, Sparkles } from 'lucide-react';
import type { CreateArtifactInput } from '../../hooks/useAgentNexusStore';
import type {
  ArtifactKind,
  ChatMessage,
  ProjectWorkspace,
} from '../../types/agentnexus';
import { displayEntityName } from '../shared/EntityIdentity';
import { ModalShell } from '../shared/UiPrimitives';

interface MessageToArtifactModalProps {
  open: boolean;
  sourceMessage: ChatMessage | null;
  workspace: ProjectWorkspace;
  onClose: () => void;
  onConfirmCreate: (input: CreateArtifactInput) => void;
}

const KIND_OPTIONS: { id: ArtifactKind; label: string }[] = [
  { id: 'prd', label: 'PRD 文档' },
  { id: 'solution', label: '方案讨论' },
  { id: 'ppt', label: '演示稿 Slides' },
  { id: 'design', label: '设计素材' },
  { id: 'architecture', label: '架构设计' },
  { id: 'code_test', label: '代码与测试' },
];

function inferArtifactKind(text: string): ArtifactKind {
  const lower = text.toLowerCase();
  if (/ppt|演示|汇报|路演|slide|分镜|宣讲/.test(lower)) return 'ppt';
  if (/原型|视觉|设计|配色|交互|情绪板|ui|figma|组件规范/.test(lower)) return 'design';
  if (/架构|重构|评审|隔离|分布式|风控|拓扑|rbac|熔断/.test(lower)) return 'architecture';
  if (/代码|补丁|单测|回归|压测|脚本|api|网关|实现|test|ts|sql/.test(lower)) return 'code_test';
  if (/prd|需求|状态机|验收标准|规格|文档/.test(lower)) return 'prd';
  return 'solution';
}

function extractArtifactTitle(content: string, kind: ArtifactKind): string {
  const cleaned = content
    .replace(/@[\u4e00-\u9fa5A-Za-z0-9_.-]+/g, '')
    .replace(/^(请|麻烦|帮忙|咱们|我们|需要|希望|可以|先|直接|把|帮我)+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const quoted = cleaned.match(/[“「《"]([^”」》"]{4,28})[”」》"]/);
  if (quoted?.[1]) {
    return quoted[1].trim();
  }

  const firstClause = cleaned.split(/[。！？!?\n；;]/)[0]?.trim() || cleaned;
  if (firstClause.length > 0) {
    return firstClause.length <= 32 ? firstClause : `${firstClause.slice(0, 30)}…`;
  }

  const fallbackByKind: Record<ArtifactKind, string> = {
    prd: '群聊需求规格沉淀 PRD',
    solution: '群聊讨论方案纪要',
    ppt: '群聊方案汇报演示稿',
    design: '群聊交互与视觉规范沉淀',
    architecture: '群聊架构评审结论文档',
    code_test: '群聊代码实现与验证记录',
  };
  return fallbackByKind[kind];
}

function buildStructuredContent(msg: ChatMessage, workspaceName: string, kind: ArtifactKind): string {
  const speaker = displayEntityName(msg.senderHandle);
  const heading =
    kind === 'prd'
      ? '## 需求背景与核心约束'
      : kind === 'architecture'
        ? '## 架构讨论与关键决策'
        : kind === 'code_test'
          ? '// 基于项目群对话沉淀的技术方案与验证要点'
          : '## 群聊讨论要点沉淀';

  const lines = msg.content
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const bulletBody = lines.map((line, i) => `${i + 1}. ${line}`).join('\n');

  return `${heading}\n${bulletBody}\n\n## 来源上下文\n- 所属项目：${workspaceName}\n- 原始发言：${speaker}（${msg.timestamp}）`;
}

function buildSlidesFromContent(title: string, summary: string, content: string) {
  const points = content
    .split('\n')
    .map((l) => l.replace(/^[-*•#\d./]+\s*/, '').trim())
    .filter((l) => l.length > 4 && !l.startsWith('来源上下文'))
    .slice(0, 4);

  return [
    {
      heading: `01 · ${title}`,
      bullets: [
        summary || '基于项目群讨论自动提炼的核心背景与目标',
        '由 AI 自动结构化为演示分镜，可直接用于评审与对外同步',
      ],
    },
    {
      heading: '02 · 核心方案与落地要点',
      bullets: points.length > 0 ? points : ['明确方案边界与交付验收标准', '进入专家协同执行阶段'],
    },
  ];
}

export function MessageToArtifactModal({
  open,
  sourceMessage,
  workspace,
  onClose,
  onConfirmCreate,
}: MessageToArtifactModalProps) {
  const [extracting, setExtracting] = useState(false);
  const [kind, setKind] = useState<ArtifactKind>('solution');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (!open || !sourceMessage) return;
    setExtracting(true);
    const inferredKind = inferArtifactKind(sourceMessage.content);
    const inferredTitle = extractArtifactTitle(sourceMessage.content, inferredKind);
    const shortSnippet = sourceMessage.content.replace(/\s+/g, ' ').trim();
    const inferredSummary =
      shortSnippet.length <= 72 ? shortSnippet : `${shortSnippet.slice(0, 70)}…`;
    const structured = buildStructuredContent(sourceMessage, workspace.name, inferredKind);

    const timer = window.setTimeout(() => {
      setKind(inferredKind);
      setTitle(inferredTitle);
      setSummary(inferredSummary);
      setContent(structured);
      setExtracting(false);
    }, 240);

    return () => window.clearTimeout(timer);
  }, [open, sourceMessage, workspace.name]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || extracting || !sourceMessage) return;

    const cleanTitle = title.trim();
    const cleanSummary = summary.trim() || cleanTitle;
    const cleanContent = content.trim() || sourceMessage.content;

    const slides =
      kind === 'ppt' ? buildSlidesFromContent(cleanTitle, cleanSummary, cleanContent) : undefined;
    const designSpec =
      kind === 'design'
        ? {
            palette: ['#0f172a', '#2563eb', '#6366f1', '#10b981', '#f8fafc'],
            typography: 'Inter + Noto Sans SC',
            components: ['核心交互流程', '关键状态组件', '视觉规范说明'],
          }
        : undefined;

    const speaker = displayEntityName(sourceMessage.senderHandle);

    onConfirmCreate({
      projectId: workspace.id,
      title: cleanTitle,
      kind,
      summary: cleanSummary,
      content: cleanContent,
      sourceType: 'project_group',
      authorName: `AI 沉淀（原发言：${speaker}）`,
      authorType: 'agent',
      tags: ['群聊 AI 沉淀', KIND_OPTIONS.find((k) => k.id === kind)?.label || 'Artifact'],
      slides,
      designSpec,
    });
    onClose();
  };

  return (
    <ModalShell
      open={open && Boolean(sourceMessage)}
      onClose={onClose}
      icon={<Shapes className="w-4 h-4 text-blue-600" />}
      title="AI 基于对话沉淀 Artifact"
      subtitle={`将「${workspace.name}」中的该条群聊内容自动整理为结构化项目产出物`}
      maxWidthClass="max-w-lg"
      onSubmit={handleSubmit}
      footer={
        <>
          <span className="text-[11px] text-slate-500">
            确认后同步至项目侧栏与全局 Artifacts 产物库
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={extracting || !title.trim()}
              className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white whitespace-nowrap cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
            >
              沉淀为 Artifact
            </button>
          </div>
        </>
      }
    >
      <div className="space-y-3.5">
        {sourceMessage && (
          <div className="rounded-xl border border-slate-200/80 bg-[#FAFAFA] px-3.5 py-2.5 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <MessageSquareQuote className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="font-semibold text-slate-700">
                {displayEntityName(sourceMessage.senderHandle)}
              </span>
              <span>·</span>
              <span className="font-mono tabular-nums">{sourceMessage.timestamp}</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed line-clamp-3 whitespace-pre-wrap">
              {sourceMessage.content}
            </p>
          </div>
        )}

        {extracting ? (
          <div className="py-8 text-center space-y-2">
            <Sparkles className="w-5 h-5 text-blue-600 mx-auto animate-pulse" />
            <div className="text-xs font-medium text-slate-700">
              AI 正在识别产物类型并整理结构化内容...
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">AI 识别产物类型</label>
              <div className="grid grid-cols-3 gap-1.5">
                {KIND_OPTIONS.map((opt) => {
                  const active = kind === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setKind(opt.id)}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                        active
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">AI 提炼标题 *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">摘要说明</label>
              <input
                type="text"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">AI 结构化内容预览</label>
              <textarea
                rows={4}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 resize-y leading-relaxed"
              />
            </div>
          </>
        )}
      </div>
    </ModalShell>
  );
}
