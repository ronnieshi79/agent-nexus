import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { MessageSquareQuote, Sparkles } from 'lucide-react';
import type { CreateWorkCardInput } from '../../hooks/useAgentNexusStore';
import type {
  ChatMessage,
  ExpertAgent,
  ProjectAgentAssignment,
  ProjectWorkspace,
  WorkCardType,
} from '../../types/agentnexus';
import { displayEntityName, formatAgentDisplayName } from '../shared/EntityIdentity';
import { ModalShell } from '../shared/UiPrimitives';

interface MessageToTaskModalProps {
  open: boolean;
  sourceMessage: ChatMessage | null;
  workspace: ProjectWorkspace;
  agents: ExpertAgent[];
  assignments: ProjectAgentAssignment[];
  onClose: () => void;
  onConfirmCreate: (input: CreateWorkCardInput) => void;
}

function inferWorkType(text: string): WorkCardType {
  const lower = text.toLowerCase();
  if (/测试|压测|回归|验收|qa|用例|漏洞验证|跑通/.test(lower)) return 'testing';
  if (/评审|审计|架构|风控|安全|越权|review|重构/.test(lower)) return 'review';
  if (/prd|策划|规划|需求|方案|原型|调研|设计|交互|矩阵/.test(lower)) return 'planning';
  return 'development';
}

function inferPriority(text: string): '高' | '中' | '低' {
  if (/紧急|立刻|优先|阻断|熔断|风控|核心|线上|高优|尽快/.test(text)) return '高';
  if (/优化|调研|补充|参考|后续/.test(text)) return '低';
  return '中';
}

function extractTaskTitle(content: string): string {
  // Strip @mentions and leading polite/command phrasing
  const cleaned = content
    .replace(/@[\u4e00-\u9fa5A-Za-z0-9_.-]+/g, '')
    .replace(/^(请|麻烦|帮忙|咱们|我们|需要|希望|可以|先|直接|把|帮我)+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Prefer quoted phrase if present (e.g. “xxx” or 「xxx」)
  const quoted = cleaned.match(/[“「《"]([^”」》"]{4,28})[”」》"]/);
  if (quoted?.[1]) {
    return quoted[1].trim();
  }

  // Otherwise take first meaningful clause
  const firstClause = cleaned.split(/[。！？!?\n；;]/)[0]?.trim() || cleaned;
  if (firstClause.length <= 30) {
    return firstClause || '基于群聊讨论的新增协同任务';
  }
  return `${firstClause.slice(0, 28)}…`;
}

function resolveBestAgentId(
  text: string,
  workType: WorkCardType,
  agents: ExpertAgent[],
  assignments: ProjectAgentAssignment[],
): string {
  // 1. Explicit @mention match
  const mentioned = agents.find((a) => text.includes(a.handle) || text.includes(displayEntityName(a.name)));
  if (mentioned) return mentioned.id;

  // 2. Match project workflow stage assignment
  const stageKey =
    workType === 'planning' ? 'planning' : workType === 'development' ? 'development' : 'testing';
  const stageAssignee = assignments.find((a) => a.stages.includes(stageKey));
  if (stageAssignee && agents.some((ag) => ag.id === stageAssignee.agentId)) {
    return stageAssignee.agentId;
  }

  // 3. Fallback by agent category
  const catTarget =
    workType === 'planning'
      ? 'product'
      : workType === 'testing'
        ? 'qa'
        : workType === 'review'
          ? 'architecture'
          : 'engineering';
  const byCat = agents.find((a) => a.category === catTarget);
  return byCat?.id || agents[0]?.id || '';
}

export function MessageToTaskModal({
  open,
  sourceMessage,
  workspace,
  agents,
  assignments,
  onClose,
  onConfirmCreate,
}: MessageToTaskModalProps) {
  const [extracting, setExtracting] = useState(false);
  const [title, setTitle] = useState('');
  const [featureModule, setFeatureModule] = useState(workspace.name);
  const [workType, setWorkType] = useState<WorkCardType>('development');
  const [assigneeId, setAssigneeId] = useState(agents[0]?.id || '');
  const [priority, setPriority] = useState<'高' | '中' | '低'>('高');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!open || !sourceMessage) return;
    setExtracting(true);
    const inferredType = inferWorkType(sourceMessage.content);
    const inferredTitle = extractTaskTitle(sourceMessage.content);
    const inferredPriority = inferPriority(sourceMessage.content);
    const inferredAgentId = resolveBestAgentId(
      sourceMessage.content,
      inferredType,
      agents,
      assignments,
    );

    const timer = window.setTimeout(() => {
      setTitle(inferredTitle);
      setWorkType(inferredType);
      setPriority(inferredPriority);
      setAssigneeId(inferredAgentId);
      setFeatureModule(workspace.name);
      setDescription(
        `由群聊对话自动提炼（${displayEntityName(sourceMessage.senderHandle)} · ${sourceMessage.timestamp}）：\n${sourceMessage.content}`,
      );
      setExtracting(false);
    }, 260);

    return () => window.clearTimeout(timer);
  }, [agents, assignments, open, sourceMessage, workspace.name]);

  const effectiveAssigneeId = useMemo(
    () => (agents.some((a) => a.id === assigneeId) ? assigneeId : agents[0]?.id || ''),
    [agents, assigneeId],
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || extracting) return;
    onConfirmCreate({
      sessionId: workspace.id,
      featureModule: featureModule.trim() || workspace.name,
      workType,
      title: title.trim(),
      description: description.trim() || sourceMessage?.content || title.trim(),
      assigneeId: effectiveAssigneeId,
      priority,
    });
    onClose();
  };

  return (
    <ModalShell
      open={open && Boolean(sourceMessage)}
      onClose={onClose}
      icon={<Sparkles className="w-4 h-4 text-blue-600" />}
      title="AI 基于对话生成任务卡片"
      subtitle={`已从「${workspace.name}」该条对话中自动提炼目标、阶段与承接专家`}
      maxWidthClass="max-w-lg"
      onSubmit={handleSubmit}
      footer={
        <>
          <span className="text-[11px] text-slate-500">
            确认后同步至群聊、顶部看板并开启任务会话
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
              确认生成任务
            </button>
          </div>
        </>
      }
    >
      <div className="space-y-3.5">
        {/* Source Message Quote */}
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
              AI 正在从该条对话中提炼任务标题、工作流阶段与承接专家...
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">AI 提炼任务标题 *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">建议承接专家</label>
                <select
                  value={effectiveAssigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none"
                >
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {formatAgentDisplayName(a.handle, a.runtimeAgent, a.defaultModel)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">首阶段</label>
                  <select
                    value={workType}
                    onChange={(e) => setWorkType(e.target.value as WorkCardType)}
                    className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-2 text-xs text-slate-900 focus:bg-white focus:outline-none"
                  >
                    <option value="planning">产品策划</option>
                    <option value="development">功能开发</option>
                    <option value="testing">功能测试</option>
                    <option value="review">架构评审</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">优先级</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as '高' | '中' | '低')}
                    className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-2 text-xs text-slate-900 focus:bg-white focus:outline-none"
                  >
                    <option value="高">高</option>
                    <option value="中">中</option>
                    <option value="低">低</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">任务上下文与验收要求</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 resize-none leading-relaxed"
              />
            </div>
          </>
        )}
      </div>
    </ModalShell>
  );
}
