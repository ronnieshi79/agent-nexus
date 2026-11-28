import { Bot, Cpu, FolderKanban, Terminal, User, Users } from 'lucide-react';
import type { AgentCategory, PrincipalRoleType } from '../../types/agentnexus';

export const PRINCIPAL_ROLE_META: Record<
  PrincipalRoleType,
  {
    shortLabel: string;
    label: string;
    description: string;
    textCls: string;
  }
> = {
  fde: {
    shortLabel: 'FDE',
    label: 'FDE 前线工程师',
    description: '面向一线业务场景，对话驱动方案拆解、系统落地与项目协同',
    textCls: 'text-indigo-700',
  },
  opc: {
    shortLabel: 'OPC',
    label: 'OPC 一人公司',
    description: '一人统筹多路异构 Agent 矩阵，独立推进产品交付与业务运营',
    textCls: 'text-emerald-700',
  },
  aibuilder: {
    shortLabel: 'AI Builder',
    label: 'AI Builder 创客',
    description: '围绕 AI 原生应用、机器人与智能体工具开展快速构建与运营探索',
    textCls: 'text-sky-700',
  },
};

export const PRINCIPAL_ROLE_OPTIONS: { id: 'all' | PrincipalRoleType; label: string }[] = [
  { id: 'all', label: '全部类型' },
  { id: 'fde', label: 'FDE 前线工程师' },
  { id: 'opc', label: 'OPC 一人公司' },
  { id: 'aibuilder', label: 'AI Builder 创客' },
];

export const DOMAIN_CATEGORY_LABELS: Record<AgentCategory, string> = {
  engineering: '研发开发',
  design: '设计体验',
  product: '产品策划',
  architecture: '架构审查',
  qa: '测试质量',
  media: '自媒体运营',
};

export const DOMAIN_CATEGORY_OPTIONS: { id: 'all' | AgentCategory; label: string }[] = [
  { id: 'all', label: '全部方向' },
  { id: 'engineering', label: '研发开发' },
  { id: 'design', label: '设计体验' },
  { id: 'product', label: '产品策划' },
  { id: 'architecture', label: '架构审查' },
  { id: 'qa', label: '测试质量' },
  { id: 'media', label: '自媒体运营' },
];

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
    label: 'Codex CLI (cx)',
    shortCode: 'cx',
    defaultModel: 'GPT-6.2',
    models: ['GPT-6.2', 'o3-pro', 'GPT-5.4-Codex'],
    badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    prefixCls: 'text-emerald-700',
  },
  {
    id: 'Claude Code',
    label: 'Claude Code (cc)',
    shortCode: 'cc',
    defaultModel: 'Claude Opus 5.5',
    models: ['Claude Opus 5.5', 'Claude Sonnet 5.5', 'Claude Haiku 5.5'],
    badgeCls: 'bg-amber-50 text-amber-800 border-amber-200/80',
    prefixCls: 'text-amber-700',
  },
  {
    id: 'Antigravity',
    label: 'Antigravity CLI (at)',
    shortCode: 'at',
    defaultModel: 'Gemini 4 Neon',
    models: ['Gemini 4 Neon', 'Claude Opus 5.5', 'GPT-6.2'],
    badgeCls: 'bg-blue-50 text-blue-700 border-blue-200/80',
    prefixCls: 'text-blue-700',
  },
  {
    id: 'Gemini CLI',
    label: 'Gemini CLI (gm)',
    shortCode: 'gm',
    defaultModel: 'Gemini 4 Neon',
    models: ['Gemini 4 Neon', 'Gemini 4 Flash', 'Gemini 3.1 Pro'],
    badgeCls: 'bg-sky-50 text-sky-700 border-sky-200/80',
    prefixCls: 'text-sky-700',
  },
  {
    id: 'Qoder',
    label: 'Qoder (qd)',
    shortCode: 'qd',
    defaultModel: 'Qwen3-Coder-Max',
    models: ['Qwen3-Coder-Max', 'Claude Opus 5.5', 'GPT-6.2'],
    badgeCls: 'bg-teal-50 text-teal-700 border-teal-200/80',
    prefixCls: 'text-teal-700',
  },
  {
    id: 'Cursor',
    label: 'Cursor (cs)',
    shortCode: 'cs',
    defaultModel: 'Claude Opus 5.5',
    models: ['Claude Opus 5.5', 'GPT-6.2', 'Gemini 4 Neon'],
    badgeCls: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    prefixCls: 'text-indigo-700',
  },
  {
    id: 'OpenHands',
    label: 'OpenHands (oh)',
    shortCode: 'oh',
    defaultModel: 'DeepSeek-R2',
    models: ['DeepSeek-R2', 'GPT-6.2', 'Claude Opus 5.5'],
    badgeCls: 'bg-cyan-50 text-cyan-800 border-cyan-200/80',
    prefixCls: 'text-cyan-700',
  },
  {
    id: 'Playwright',
    label: 'Playwright (pw)',
    shortCode: 'pw',
    defaultModel: 'GPT-6.2',
    models: ['GPT-6.2', 'Gemini 4 Flash', 'Claude Haiku 5.5'],
    badgeCls: 'bg-violet-50 text-violet-700 border-violet-200/80',
    prefixCls: 'text-violet-700',
  },
  {
    id: 'Figma AI',
    label: 'Figma AI (fg)',
    shortCode: 'fg',
    defaultModel: 'Gemini 4 Neon',
    models: ['Gemini 4 Neon', 'Claude Opus 5.5', 'GPT-6.2'],
    badgeCls: 'bg-pink-50 text-pink-700 border-pink-200/80',
    prefixCls: 'text-pink-700',
  },
  {
    id: 'ROS2 Agent',
    label: 'ROS2 Agent (ros2)',
    shortCode: 'ros2',
    defaultModel: 'GPT-6.2',
    models: ['GPT-6.2', 'Gemini 4 Neon', 'o3-pro'],
    badgeCls: 'bg-purple-50 text-purple-700 border-purple-200/80',
    prefixCls: 'text-purple-700',
  },
];

const RUNTIME_PRESET_MAP = new Map<string, AgentRuntimePreset>(
  AGENT_RUNTIME_PRESETS.map((p) => [p.id.toLowerCase(), p]),
);

const RUNTIME_ALIAS_MAP: Record<string, string> = {
  'claude code cli': 'claude code',
  claudecode: 'claude code',
  cc: 'claude code',
  'codex cli': 'codex',
  cx: 'codex',
  'antigravity cli': 'antigravity',
  'anthropic cli': 'antigravity',
  at: 'antigravity',
  gemini: 'gemini cli',
  gm: 'gemini cli',
  qd: 'qoder',
  cs: 'cursor',
  oh: 'openhands',
  pw: 'playwright',
  fg: 'figma ai',
  ros2: 'ros2 agent',
};

function resolveRuntimePreset(runtime?: string): AgentRuntimePreset | undefined {
  if (!runtime) return undefined;
  const key = runtime.trim().toLowerCase();
  const mappedKey = RUNTIME_ALIAS_MAP[key] || key;
  return RUNTIME_PRESET_MAP.get(mappedKey);
}

const MODEL_SHORT_MAP: Record<string, string> = {
  'GPT-6.2': 'GPT-6.2',
  'GPT-5.4': 'GPT-5.4',
  'GPT-5.4-Codex': 'GPT-5.4',
  'o3-pro': 'o3-pro',
  'Claude Opus 5.5': 'Opus5.5',
  'Claude 5.5 Opus': 'Opus5.5',
  'Claude Sonnet 5.5': 'Sonnet5.5',
  'Claude Haiku 5.5': 'Haiku5.5',
  'Claude 4.5 Sonnet': 'Sonnet4.5',
  'Claude 4.5 Opus': 'Opus4.5',
  'Claude 4.5 Haiku': 'Haiku4.5',
  'Gemini 4 Neon': 'G4-Neon',
  'Gemini 4 Flash': 'G4-Flash',
  'Gemini 3.1 Pro': 'G3.1-Pro',
  'Gemini 3.0 Flash': 'G3.0-Flash',
  'Gemini 2.5 Pro': 'G2.5-Pro',
  'Qwen3-Coder-Max': 'Qwen3-Max',
  'DeepSeek-R2': 'DS-R2',
};

export function getRuntimePreset(runtime?: string): AgentRuntimePreset {
  if (!runtime) return AGENT_RUNTIME_PRESETS[0];
  return (
    resolveRuntimePreset(runtime) || {
      id: runtime,
      label: runtime,
      shortCode: runtime.toLowerCase(),
      defaultModel: 'GPT-6.2',
      models: ['GPT-6.2', 'Claude Opus 5.5', 'Gemini 4 Neon'],
      badgeCls: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
      prefixCls: 'text-indigo-700',
    }
  );
}

/**
 * Compact host agent runtime abbreviation (e.g. "Claude Code" -> "cc", "Codex" -> "cx", "Antigravity" -> "at").
 */
export function formatShortRuntime(runtime?: string): string {
  if (!runtime) return '';
  if (runtime === 'Nexa' || runtime === '助理') return 'Nexa';
  const preset = resolveRuntimePreset(runtime);
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
    /neon|opus|sonnet|gpt-6\.2|o3-pro/.test(model) ||
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
 * Plain-text unified Agent display name in `名称.宿主agent缩写.模型` format
 * (e.g. "全栈开发员.cc.Sonnet4.5", "架构审查员.cx.GPT-6.2", "前端特工.at.G3.1-Pro").
 */
export function formatAgentDisplayName(
  handleOrName: string,
  runtime?: string,
  model?: string,
): string {
  const clean = displayEntityName(handleOrName);
  const shortRt = formatShortRuntime(runtime);
  const shortModel = formatShortModel(model);
  if (shortRt === 'Nexa') {
    return clean.startsWith('Nexa') ? clean : `Nexa·${clean}`;
  }
  const parts = [clean];
  if (shortRt) parts.push(shortRt);
  if (shortModel) parts.push(shortModel);
  return parts.join('.');
}

/**
 * Unified Specialist Agent Identity Name:
 * Renders `名称.宿主agent缩写.模型` (e.g. `全栈开发员.cc.Sonnet4.5`, `架构审查员.cx.GPT-6.2`,
 * `前端特工.at.G3.1-Pro`), highlighting the host runtime code and model directly.
 */
export function AgentIdentityName({
  name,
  runtime,
  model,
  showModel = true,
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
  const preset = resolveRuntimePreset(runtime);
  const isNexaAssistant = shortRt === 'Nexa';

  const runtimeColorCls = inverted
    ? 'text-sky-300'
    : preset
      ? preset.prefixCls
      : isNexaAssistant
        ? 'text-blue-700'
        : 'text-indigo-700';

  const dotCls = inverted ? 'text-slate-500' : 'text-slate-300';
  const modelColorCls = inverted ? 'text-sky-200' : 'text-slate-600';

  const tooltip = runtime
    ? model
      ? `${cleanName} · 宿主 Agent：${runtime} (${shortRt}) · 模型：${model}`
      : `${cleanName} · 宿主 Agent：${runtime} (${shortRt})`
    : model
      ? `${cleanName} · 模型：${model}`
      : cleanName;

  if (isNexaAssistant) {
    return (
      <span
        title={tooltip}
        className={`inline-flex items-baseline min-w-0 max-w-full ${className}`}
      >
        <span className="truncate">
          {!cleanName.startsWith('Nexa') && (
            <>
              <span className={`font-mono font-semibold ${runtimeColorCls}`}>Nexa</span>
              <span className={`${dotCls} mx-[2px]`}>·</span>
            </>
          )}
          <span>{cleanName}</span>
        </span>
      </span>
    );
  }

  return (
    <span
      title={tooltip}
      className={`inline-flex items-baseline min-w-0 max-w-full ${className}`}
    >
      <span className="truncate">
        <span>{cleanName}</span>
        {shortRt && (
          <>
            <span className={dotCls}>.</span>
            <span className={`font-mono font-semibold text-[0.92em] ${runtimeColorCls}`}>
              {shortRt}
            </span>
          </>
        )}
        {showModel && shortModel && (
          <>
            <span className={dotCls}>.</span>
            <span className={`font-mono font-semibold text-[0.92em] ${modelColorCls}`}>
              {shortModel}
            </span>
          </>
        )}
      </span>
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
  const preset = resolveRuntimePreset(runtime);
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
export function HumanMark({ label = 'Agent 主理' }: { label?: string }) {
  return (
    <span
      title="Agent 主理"
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
        title={title || 'Agent 主理'}
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

