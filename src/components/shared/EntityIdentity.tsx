import { Bot, Cpu, FolderKanban, Terminal, User, Users } from 'lucide-react';

/**
 * Strip leading '@' from an agent handle for non-mention display contexts.
 * '@' should ONLY appear when explicitly mentioning someone/an agent inside chat messages.
 */
export function displayEntityName(handleOrName: string): string {
  return handleOrName.replace(/^@+/, '').trim();
}

/**
 * Crisp visual identity mark distinguishing an autonomous Agent from a human collaborator.
 * Uses a geometric circuit glyph + compact mono label instead of '@'.
 */
export function AgentMark({
  label = 'AI',
  inverted = false,
}: {
  label?: string;
  inverted?: boolean;
}) {
  return (
    <span
      title="Agent 智能体节点"
      className={`inline-flex items-center gap-0.5 px-1 py-[1px] rounded text-[10px] font-mono font-semibold leading-tight whitespace-nowrap shrink-0 select-none ${
        inverted
          ? 'bg-sky-400/20 text-sky-200 border border-sky-300/30'
          : 'bg-indigo-50 text-indigo-700 border border-indigo-200/80'
      }`}
    >
      <Cpu className="w-2.5 h-2.5 shrink-0" />
      <span>{label}</span>
    </span>
  );
}

/**
 * Crisp visual identity mark for Human Experts / Operators when shown alongside Agents.
 */
export function HumanMark({ label = '真人专家' }: { label?: string }) {
  return (
    <span
      title="人类专家"
      className="inline-flex items-center gap-0.5 px-1 py-[1px] rounded text-[10px] font-medium leading-tight whitespace-nowrap shrink-0 select-none bg-emerald-50 text-emerald-700 border border-emerald-200/80"
    >
      <User className="w-2.5 h-2.5 shrink-0" />
      <span>{label}</span>
    </span>
  );
}

/**
 * Unified Avatar with immediate shape & corner-badge semantics:
 * - human: circular avatar (rounded-full)
 * - agent: rounded-square tech avatar (rounded-lg) with crisp CPU/Terminal corner badge
 * - group: indigo project group icon with member badge
 * - assistant: blue platform assistant bot icon
 */
export function EntityAvatar({
  kind,
  code,
  accent = '#334155',
  size = 'md',
  showCornerMark = true,
  sessionCorner = false,
  title,
}: {
  kind: 'human' | 'agent' | 'group' | 'assistant';
  code?: string;
  accent?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showCornerMark?: boolean;
  sessionCorner?: boolean;
  title?: string;
}) {
  const sizeCls =
    size === 'xs'
      ? 'w-5 h-5 text-[9px]'
      : size === 'sm'
        ? 'w-7 h-7 text-[10px]'
        : size === 'lg'
          ? 'w-10 h-10 text-xs'
          : 'w-8 h-8 text-[11px]';

  if (kind === 'assistant') {
    return (
      <div
        title={title || '平台助理'}
        className={`${sizeCls} rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0`}
      >
        <Bot className={size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} />
      </div>
    );
  }

  if (kind === 'group') {
    return (
      <div
        title={title || '项目群'}
        className={`relative ${sizeCls} rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0`}
      >
        <FolderKanban className={size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} />
        {showCornerMark && size !== 'xs' && (
          <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded bg-white border border-indigo-200 text-indigo-700 flex items-center justify-center">
            <Users className="w-2.5 h-2.5" />
          </span>
        )}
      </div>
    );
  }

  if (kind === 'human') {
    return (
      <div
        title={title || '人类专家'}
        className={`${sizeCls} rounded-full flex items-center justify-center font-bold text-white shrink-0`}
        style={{ backgroundColor: accent }}
      >
        {code || '人'}
      </div>
    );
  }

  return (
    <div
      title={title || 'Agent 智能体'}
      className={`relative ${sizeCls} rounded-lg flex items-center justify-center font-bold text-white shrink-0`}
      style={{ backgroundColor: accent }}
    >
      {code || 'AI'}
      {showCornerMark && size !== 'xs' && (
        <span
          className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded flex items-center justify-center border ${
            sessionCorner
              ? 'bg-slate-900 border-white text-sky-300'
              : 'bg-white border-indigo-200 text-indigo-700'
          }`}
        >
          {sessionCorner ? (
            <Terminal className="w-2.5 h-2.5" />
          ) : (
            <Cpu className="w-2.5 h-2.5" />
          )}
        </span>
      )}
    </div>
  );
}
