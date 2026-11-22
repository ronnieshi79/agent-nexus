import { Bot, Cpu, FolderKanban, Terminal, User, Users } from 'lucide-react';

export interface AgentRuntimePreset {
  id: string;
  label: string;
  defaultModel: string;
  models: string[];
  badgeCls: string;
}

/**
 * Unified catalog of Host Agent Runtimes ("本体 Agent") and their orchestrated default models.
 */
export const AGENT_RUNTIME_PRESETS: AgentRuntimePreset[] = [
  {
    id: 'Codex',
    label: 'Codex',
    defaultModel: 'GPT-6.2',
    models: ['GPT-6.2', 'GPT-5.4-Codex', 'o3-pro'],
    badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  },
  {
    id: 'Claude Code',
    label: 'Claude Code',
    defaultModel: 'Claude 4.5 Sonnet',
    models: ['Claude 4.5 Sonnet', 'Claude 4.5 Opus', 'Claude 4.5 Haiku'],
    badgeCls: 'bg-amber-50 text-amber-800 border-amber-200/80',
  },
  {
    id: 'Gemini CLI',
    label: 'Gemini CLI',
    defaultModel: 'Gemini 3.1 Pro',
    models: ['Gemini 3.1 Pro', 'Gemini 3.0 Flash', 'Gemini 2.5 Pro'],
    badgeCls: 'bg-sky-50 text-sky-700 border-sky-200/80',
  },
  {
    id: 'Cursor',
    label: 'Cursor',
    defaultModel: 'Claude 4.5 Sonnet',
    models: ['Claude 4.5 Sonnet', 'GPT-6.2', 'Gemini 3.1 Pro'],
    badgeCls: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
  },
  {
    id: 'OpenHands',
    label: 'OpenHands',
    defaultModel: 'DeepSeek-R2',
    models: ['DeepSeek-R2', 'GPT-6.2', 'Claude 4.5 Sonnet'],
    badgeCls: 'bg-cyan-50 text-cyan-800 border-cyan-200/80',
  },
  {
    id: 'Playwright',
    label: 'Playwright',
    defaultModel: 'GPT-6.2',
    models: ['GPT-6.2', 'Gemini 3.0 Flash', 'Claude 4.5 Haiku'],
    badgeCls: 'bg-violet-50 text-violet-700 border-violet-200/80',
  },
  {
    id: 'Figma AI',
    label: 'Figma AI',
    defaultModel: 'Gemini 3.1 Pro',
    models: ['Gemini 3.1 Pro', 'Claude 4.5 Sonnet', 'GPT-6.2'],
    badgeCls: 'bg-pink-50 text-pink-700 border-pink-200/80',
  },
  {
    id: 'ROS2 Agent',
    label: 'ROS2 Agent',
    defaultModel: 'GPT-6.2',
    models: ['GPT-6.2', 'Gemini 3.1 Pro', 'o3-pro'],
    badgeCls: 'bg-purple-50 text-purple-700 border-purple-200/80',
  },
];

const RUNTIME_PRESET_MAP = new Map<string, AgentRuntimePreset>(
  AGENT_RUNTIME_PRESETS.map((p) => [p.id.toLowerCase(), p]),
);

export function getRuntimePreset(runtime?: string): AgentRuntimePreset {
  if (!runtime) return AGENT_RUNTIME_PRESETS[0];
  return (
    RUNTIME_PRESET_MAP.get(runtime.toLowerCase()) || {
      id: runtime,
      label: runtime,
      defaultModel: 'GPT-6.2',
      models: ['GPT-6.2', 'Claude 4.5 Sonnet', 'Gemini 3.1 Pro'],
      badgeCls: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    }
  );
}

/**
 * Strip leading '@' from an agent handle for non-mention display contexts.
 * '@' should ONLY appear when explicitly mentioning someone/an agent inside chat messages.
 */
export function displayEntityName(handleOrName: string): string {
  return handleOrName.replace(/^@+/, '').trim();
}

/**
 * Unified Agent Runtime Identity Mark:
 * Displays the underlying host Agent runtime (e.g. Codex, Claude Code, Gemini CLI)
 * instead of a generic "AI" tag, optionally accompanied by its orchestrated default model.
 */
export function AgentMark({
  runtime,
  model,
  label,
  showModel = false,
  inverted = false,
}: {
  runtime?: string;
  model?: string;
  label?: string;
  showModel?: boolean;
  inverted?: boolean;
}) {
  const displayRuntime = runtime || label || 'Agent';
  const preset = runtime ? RUNTIME_PRESET_MAP.get(runtime.toLowerCase()) : undefined;
  const colorCls = inverted
    ? 'bg-sky-400/20 text-sky-200 border border-sky-300/30'
    : preset
      ? `${preset.badgeCls} border`
      : displayRuntime === 'Nexa' || displayRuntime === '助理'
        ? 'bg-blue-50 text-blue-700 border border-blue-200/80'
        : 'bg-indigo-50 text-indigo-700 border border-indigo-200/80';

  return (
    <span
      title={
        model
          ? `本体 Agent：${displayRuntime} · 默认模型：${model}`
          : `本体 Agent：${displayRuntime}`
      }
      className={`inline-flex items-center gap-1 px-1.5 py-[1px] rounded text-[10px] font-mono font-semibold leading-tight whitespace-nowrap shrink-0 select-none ${colorCls}`}
    >
      <Cpu className="w-2.5 h-2.5 shrink-0 opacity-85" />
      <span>{displayRuntime}</span>
      {showModel && model && (
        <span className={inverted ? 'text-sky-200/80 font-normal' : 'opacity-75 font-normal'}>
          · {model}
        </span>
      )}
    </span>
  );
}

/**
 * Crisp visual identity mark for Human Experts when shown alongside Agents.
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
