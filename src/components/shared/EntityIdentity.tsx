import { Bot, Cpu, FolderKanban, Terminal, User, Users } from 'lucide-react';

export interface AgentRuntimePreset {
  id: string;
  label: string;
  shortCode: string;
  defaultModel: string;
  models: string[];
  badgeCls: string;
  prefixCls: string;
}

/**
 * Unified catalog of Host Agent Runtimes ("本体 Agent") and their orchestrated default models.
 */
export const AGENT_RUNTIME_PRESETS: AgentRuntimePreset[] = [
  {
    id: 'Codex',
    label: 'Codex',
    shortCode: 'Codex',
    defaultModel: 'GPT-6.2',
    models: ['GPT-6.2', 'GPT-5.4-Codex', 'o3-pro'],
    badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    prefixCls: 'text-emerald-700',
  },
  {
    id: 'Claude Code',
    label: 'Claude Code',
    shortCode: 'CC',
    defaultModel: 'Claude 4.5 Sonnet',
    models: ['Claude 4.5 Sonnet', 'Claude 4.5 Opus', 'Claude 4.5 Haiku'],
    badgeCls: 'bg-amber-50 text-amber-800 border-amber-200/80',
    prefixCls: 'text-amber-700',
  },
  {
    id: 'Gemini CLI',
    label: 'Gemini CLI',
    shortCode: 'Gemini',
    defaultModel: 'Gemini 3.1 Pro',
    models: ['Gemini 3.1 Pro', 'Gemini 3.0 Flash', 'Gemini 2.5 Pro'],
    badgeCls: 'bg-sky-50 text-sky-700 border-sky-200/80',
    prefixCls: 'text-sky-700',
  },
  {
    id: 'Qoder',
    label: 'Qoder',
    shortCode: 'Qoder',
    defaultModel: 'Qwen3-Coder-Max',
    models: ['Qwen3-Coder-Max', 'Claude 4.5 Sonnet', 'GPT-6.2'],
    badgeCls: 'bg-teal-50 text-teal-700 border-teal-200/80',
    prefixCls: 'text-teal-700',
  },
  {
    id: 'Cursor',
    label: 'Cursor',
    shortCode: 'Cursor',
    defaultModel: 'Claude 4.5 Sonnet',
    models: ['Claude 4.5 Sonnet', 'GPT-6.2', 'Gemini 3.1 Pro'],
    badgeCls: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    prefixCls: 'text-indigo-700',
  },
  {
    id: 'OpenHands',
    label: 'OpenHands',
    shortCode: 'OH',
    defaultModel: 'DeepSeek-R2',
    models: ['DeepSeek-R2', 'GPT-6.2', 'Claude 4.5 Sonnet'],
    badgeCls: 'bg-cyan-50 text-cyan-800 border-cyan-200/80',
    prefixCls: 'text-cyan-700',
  },
  {
    id: 'Playwright',
    label: 'Playwright',
    shortCode: 'PW',
    defaultModel: 'GPT-6.2',
    models: ['GPT-6.2', 'Gemini 3.0 Flash', 'Claude 4.5 Haiku'],
    badgeCls: 'bg-violet-50 text-violet-700 border-violet-200/80',
    prefixCls: 'text-violet-700',
  },
  {
    id: 'Figma AI',
    label: 'Figma AI',
    shortCode: 'Figma',
    defaultModel: 'Gemini 3.1 Pro',
    models: ['Gemini 3.1 Pro', 'Claude 4.5 Sonnet', 'GPT-6.2'],
    badgeCls: 'bg-pink-50 text-pink-700 border-pink-200/80',
    prefixCls: 'text-pink-700',
  },
  {
    id: 'ROS2 Agent',
    label: 'ROS2 Agent',
    shortCode: 'ROS2',
    defaultModel: 'GPT-6.2',
    models: ['GPT-6.2', 'Gemini 3.1 Pro', 'o3-pro'],
    badgeCls: 'bg-purple-50 text-purple-700 border-purple-200/80',
    prefixCls: 'text-purple-700',
  },
];

const RUNTIME_PRESET_MAP = new Map<string, AgentRuntimePreset>(
  AGENT_RUNTIME_PRESETS.map((p) => [p.id.toLowerCase(), p]),
);

const MODEL_SHORT_MAP: Record<string, string> = {
  'GPT-6.2': 'GPT-6.2',
  'GPT-5.4-Codex': 'GPT-5.4',
  'o3-pro': 'o3-pro',
  'Claude 4.5 Sonnet': 'Sonnet4.5',
  'Claude 4.5 Opus': 'Opus4.5',
  'Claude 4.5 Haiku': 'Haiku4.5',
  'Gemini 3.1 Pro': 'G3.1-Pro',
  'Gemini 3.0 Flash': 'G3.0-Flash',
  'Gemini 2.5 Pro': 'G2.5-Pro',
  'Qwen3-Coder-Max': 'Qwen3-Max',
  'DeepSeek-R2': 'DS-R2',
};

export function getRuntimePreset(runtime?: string): AgentRuntimePreset {
  if (!runtime) return AGENT_RUNTIME_PRESETS[0];
  return (
    RUNTIME_PRESET_MAP.get(runtime.toLowerCase()) || {
      id: runtime,
      label: runtime,
      shortCode: runtime,
      defaultModel: 'GPT-6.2',
      models: ['GPT-6.2', 'Claude 4.5 Sonnet', 'Gemini 3.1 Pro'],
      badgeCls: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
      prefixCls: 'text-indigo-700',
    }
  );
}

/**
 * Compact runtime prefix used before agent role names (e.g. "Claude Code" -> "CC", "Codex" -> "Codex").
 */
export function formatShortRuntime(runtime?: string): string {
  if (!runtime) return '';
  if (runtime === 'Nexa' || runtime === '助理') return 'Nexa';
  const preset = RUNTIME_PRESET_MAP.get(runtime.toLowerCase());
  return preset ? preset.shortCode : runtime;
}

/**
 * Compact model abbreviation for tight card/list layouts (e.g. "Claude 4.5 Sonnet" -> "Sonnet4.5").
 */
export function formatShortModel(model?: string): string {
  if (!model) return '';
  if (MODEL_SHORT_MAP[model]) return MODEL_SHORT_MAP[model];
  return model
    .replace(/^Claude\s+/i, 'C')
    .replace(/^Gemini\s+/i, 'G')
    .replace(/^DeepSeek-/i, 'DS-');
}

export type CapabilityGrade = 'S' | 'A+' | 'A';
export type CostGrade = 'H' | 'M' | 'L';

export interface AgentTierRating {
  capability: CapabilityGrade;
  capabilityLabel: string;
  cost: CostGrade;
  costLabel: string;
  costIndexLabel: string;
  code: string;
  description: string;
}

/**
 * Evaluate unified Agent Capability Grade (S / A+ / A) and Non-Token Cost Index (H / M / L)
 * from runtime base, default model, ownership, and market capability profile.
 */
export function evaluateAgentTierRating(params: {
  runtimeAgent?: string;
  defaultModel?: string;
  capabilityTier?: string;
  ownership?: 'private' | 'marketplace';
  projectPriceUsd?: number;
}): AgentTierRating {
  const runtime = (params.runtimeAgent || '').toLowerCase();
  const model = (params.defaultModel || '').toLowerCase();
  const tierHint = params.capabilityTier || '';
  const isExternal = params.ownership === 'marketplace';
  const price = params.projectPriceUsd ?? 0;

  const isLightweightModel = /flash|haiku|mini|deepseek/.test(model);
  const isFlagshipModel =
    /opus|sonnet|gpt-6\.2|o3-pro/.test(model) ||
    (runtime === 'claude code' && !isLightweightModel);

  let capability: CapabilityGrade;
  if (isFlagshipModel || tierHint.startsWith('S')) {
    capability = 'S';
  } else if (isLightweightModel && !/deepseek-r2/.test(model) && !tierHint.startsWith('A+')) {
    capability = 'A';
  } else {
    capability = 'A+';
  }

  let cost: CostGrade;
  if (isLightweightModel) {
    cost = isExternal && price >= 2200 ? 'M' : 'L';
  } else if (isFlagshipModel || (isExternal && price >= 2400)) {
    cost = 'H';
  } else {
    cost = 'M';
  }

  const capabilityLabel =
    capability === 'S' ? '旗舰能力' : capability === 'A+' ? '资深能力' : '标准高效';
  const costLabel = cost === 'H' ? '高成本' : cost === 'M' ? '中成本' : '低成本';
  const costIndexLabel =
    cost === 'H' ? '成本指数 H（高）' : cost === 'M' ? '成本指数 M（中）' : '成本指数 L（低）';

  return {
    capability,
    capabilityLabel,
    cost,
    costLabel,
    costIndexLabel,
    code: `${capability}/${cost}`,
    description: `${capabilityLabel} · ${costIndexLabel}`,
  };
}

/**
 * Strip leading '@' from an agent handle for non-mention display contexts.
 * '@' should ONLY appear when explicitly mentioning someone/an agent inside chat messages.
 */
export function displayEntityName(handleOrName: string): string {
  return handleOrName.replace(/^@+/, '').trim();
}

/**
 * Plain-text prefixed Agent display name (e.g. "CC-全栈开发员", "Codex-架构审查员").
 */
export function formatAgentDisplayName(handleOrName: string, runtime?: string): string {
  const clean = displayEntityName(handleOrName);
  const shortRt = formatShortRuntime(runtime);
  if (!shortRt) return clean;
  if (clean.toLowerCase().startsWith(`${shortRt.toLowerCase()}-`)) return clean;
  if (shortRt === 'Nexa' && clean.startsWith('Nexa')) return clean;
  return `${shortRt}-${clean}`;
}

/**
 * Unified Prefix-First Agent Identity Name:
 * Renders e.g. `Codex-架构审查员` or `CC-全栈开发员` without middle icon clutter,
 * optionally followed by a compact abbreviated model label (e.g. `GPT-6.2` / `Sonnet4.5`).
 */
export function AgentIdentityName({
  name,
  runtime,
  model,
  showModel = false,
  inverted = false,
  className = '',
}: {
  name: string;
  runtime?: string;
  model?: string;
  showModel?: boolean;
  inverted?: boolean;
  className?: string;
}) {
  const cleanName = displayEntityName(name);
  const shortRt = formatShortRuntime(runtime);
  const shortModel = formatShortModel(model);
  const preset = runtime ? RUNTIME_PRESET_MAP.get(runtime.toLowerCase()) : undefined;

  const prefixColorCls = inverted
    ? 'text-sky-300'
    : preset
      ? preset.prefixCls
      : shortRt === 'Nexa'
        ? 'text-blue-700'
        : 'text-indigo-700';

  const alreadyHasPrefix =
    Boolean(shortRt) &&
    (cleanName.toLowerCase().startsWith(`${shortRt.toLowerCase()}-`) ||
      (shortRt === 'Nexa' && cleanName.startsWith('Nexa')));

  const tooltip = runtime
    ? model
      ? `${cleanName} · 本体：${runtime} · 模型：${model}`
      : `${cleanName} · 本体：${runtime}`
    : cleanName;

  return (
    <span
      title={tooltip}
      className={`inline-flex items-baseline gap-1.5 min-w-0 max-w-full ${className}`}
    >
      <span className="truncate">
        {shortRt && !alreadyHasPrefix && (
          <>
            <span className={`font-mono font-semibold ${prefixColorCls}`}>{shortRt}</span>
            <span className={inverted ? 'text-slate-500 mx-[1px]' : 'text-slate-300 mx-[1px]'}>
              -
            </span>
          </>
        )}
        <span>{cleanName}</span>
      </span>
      {showModel && shortModel && (
        <span
          className={`text-[10px] font-mono font-medium shrink-0 whitespace-nowrap ${
            inverted ? 'text-sky-200/80' : 'text-slate-400'
          }`}
        >
          {shortModel}
        </span>
      )}
    </span>
  );
}

/**
 * Compact standalone runtime/model text pill (icon-free, abbreviated).
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
  const displayRuntime = formatShortRuntime(runtime || label) || 'Agent';
  const shortModel = formatShortModel(model);
  const preset = runtime ? RUNTIME_PRESET_MAP.get(runtime.toLowerCase()) : undefined;
  const colorCls = inverted
    ? 'bg-sky-400/20 text-sky-200 border border-sky-300/30'
    : preset
      ? `${preset.badgeCls} border`
      : displayRuntime === 'Nexa'
        ? 'bg-blue-50 text-blue-700 border border-blue-200/80'
        : 'bg-indigo-50 text-indigo-700 border border-indigo-200/80';

  return (
    <span
      title={
        model
          ? `本体 Agent：${runtime || displayRuntime} · 默认模型：${model}`
          : `本体 Agent：${runtime || displayRuntime}`
      }
      className={`inline-flex items-center gap-1 px-1.5 py-[1px] rounded text-[10px] font-mono font-semibold leading-tight whitespace-nowrap shrink-0 select-none ${colorCls}`}
    >
      <span>{displayRuntime}</span>
      {showModel && shortModel && (
        <span className={inverted ? 'text-sky-200/80 font-normal' : 'opacity-75 font-normal'}>
          · {shortModel}
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

export const LEASE_PERIOD_META: Record<
  'week' | 'month' | 'quarter',
  {
    label: string;
    shortLabel: string;
    unitSuffix: string;
    days: number;
    multiplier: number;
    hint: string;
  }
> = {
  week: {
    label: '1 周',
    shortLabel: '周租',
    unitSuffix: '/周',
    days: 7,
    multiplier: 0.35,
    hint: '适合短期冲刺/试用',
  },
  month: {
    label: '1 个月',
    shortLabel: '月租',
    unitSuffix: '/月',
    days: 30,
    multiplier: 1,
    hint: '标准按月租赁',
  },
  quarter: {
    label: '1 个季度',
    shortLabel: '季租',
    unitSuffix: '/季',
    days: 90,
    multiplier: 2.55,
    hint: '享 85 折优惠',
  },
};

export interface AgentLeasePricing {
  rating: AgentTierRating;
  monthlyUsd: number;
  weeklyUsd: number;
  quarterlyUsd: number;
  getPriceForPeriod: (period: 'week' | 'month' | 'quarter') => number;
}

/**
 * Computes transparent Agent lease pricing (weekly / monthly / quarterly) anchored on capability & cost rating.
 */
export function getAgentLeasePricing(params: {
  runtimeAgent?: string;
  defaultModel?: string;
  capabilityTier?: string;
  ownership?: 'marketplace' | 'private';
  projectPriceUsd?: number;
  monthlyLeaseUsd?: number;
}): AgentLeasePricing {
  const rating = evaluateAgentTierRating(params);
  let monthlyUsd = params.monthlyLeaseUsd;
  if (!monthlyUsd || monthlyUsd <= 0) {
    if (rating.capability === 'S') {
      monthlyUsd = rating.cost === 'H' ? 299 : 249;
    } else if (rating.capability === 'A+') {
      monthlyUsd = rating.cost === 'H' ? 219 : 159;
    } else {
      monthlyUsd = rating.cost === 'L' ? 79 : 119;
    }
    if (params.projectPriceUsd && params.projectPriceUsd >= 4000) {
      monthlyUsd += 40;
    }
  }
  const weeklyUsd = Math.max(29, Math.round((monthlyUsd * LEASE_PERIOD_META.week.multiplier) / 5) * 5);
  const quarterlyUsd = Math.round((monthlyUsd * LEASE_PERIOD_META.quarter.multiplier) / 10) * 10 - 1;

  return {
    rating,
    monthlyUsd,
    weeklyUsd,
    quarterlyUsd,
    getPriceForPeriod: (period) =>
      period === 'week' ? weeklyUsd : period === 'quarter' ? quarterlyUsd : monthlyUsd,
  };
}

export interface SkillPurchasePricing {
  ratingTier: 'S' | 'A+' | 'A';
  isFree: boolean;
  priceUsd: number;
  priceLabel: string;
  licenseLabel: string;
}

/**
 * Computes transparent Skill / MCP rating tier & one-time purchase pricing (or free open source).
 * Skills are never leased — they are either free or one-time purchase for permanent use.
 */
export function getSkillPurchasePricing(skill: {
  rating: number;
  ratingTier?: 'S' | 'A+' | 'A';
  priceUsd?: number;
  license: '免费开源' | '社区共享' | '付费买断';
  kind: 'skill' | 'mcp' | 'workflow';
}): SkillPurchasePricing {
  const ratingTier: 'S' | 'A+' | 'A' =
    skill.ratingTier || (skill.rating >= 4.95 ? 'S' : skill.rating >= 4.91 ? 'A+' : 'A');

  if (skill.priceUsd !== undefined) {
    const priceUsd = skill.priceUsd;
    const isFree = priceUsd <= 0;
    return {
      ratingTier,
      isFree,
      priceUsd,
      priceLabel: isFree ? '免费' : `$${priceUsd}`,
      licenseLabel: isFree ? '免费开源' : '一次买断 · 永久使用',
    };
  }

  if (skill.license === '免费开源') {
    return {
      ratingTier,
      isFree: true,
      priceUsd: 0,
      priceLabel: '免费',
      licenseLabel: '免费开源',
    };
  }

  const priceUsd =
    skill.license === '付费买断'
      ? skill.kind === 'workflow'
        ? 99
        : 59
      : skill.kind === 'mcp'
        ? 39
        : 29;

  return {
    ratingTier,
    isFree: false,
    priceUsd,
    priceLabel: `$${priceUsd}`,
    licenseLabel: '一次买断 · 永久使用',
  };
}

