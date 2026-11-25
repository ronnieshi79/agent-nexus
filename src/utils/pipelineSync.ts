import type {
  ActiveWorkflowStage,
  AgentCategory,
  ExpertAgent,
  PipelineHandoffMode,
  ProjectAgentAssignment,
  ProjectStageSlot,
  ProjectTaskType,
  ProjectWorkspace,
  TaskStatus,
  TaskTypeAccent,
  WorkCardType,
  WorkflowTask,
} from '../types/agentnexus';

export interface PipelineStageMeta {
  stage: WorkCardType;
  status: TaskStatus;
  step: string;
  label: string;
  shortLabel: string;
  hint: string;
  accentCls: string;
  badgeBgCls: string;
  dotCls: string;
  barCls: string;
}

export const PIPELINE_STAGE_META: PipelineStageMeta[] = [
  {
    stage: 'planning',
    status: 'pending',
    step: '01',
    label: '任务计划',
    shortLabel: '计划',
    hint: '需求/选题拆解、问题分析与方案规划',
    accentCls: 'text-slate-800',
    badgeBgCls: 'bg-slate-100 text-slate-700 border-slate-200',
    dotCls: 'bg-slate-500',
    barCls: 'bg-slate-500',
  },
  {
    stage: 'development',
    status: 'in_progress',
    step: '02',
    label: '任务执行',
    shortLabel: '执行',
    hint: '专业 Agent 按计划自主执行并产出交付物',
    accentCls: 'text-blue-700',
    badgeBgCls: 'bg-blue-50 text-blue-700 border-blue-200',
    dotCls: 'bg-blue-600',
    barCls: 'bg-blue-600',
  },
  {
    stage: 'testing',
    status: 'review',
    step: '03',
    label: '任务验证',
    shortLabel: '验证',
    hint: '质量测试、内容审校、代码评审与交付验证',
    accentCls: 'text-amber-700',
    badgeBgCls: 'bg-amber-50 text-amber-800 border-amber-200',
    dotCls: 'bg-amber-500',
    barCls: 'bg-amber-500',
  },
  {
    stage: 'review',
    status: 'done',
    step: '04',
    label: '已完成',
    shortLabel: '完成',
    hint: '验证通过并归档结束',
    accentCls: 'text-emerald-700',
    badgeBgCls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotCls: 'bg-emerald-500',
    barCls: 'bg-emerald-500',
  },
];

/** Strictly the 3 active working positions where specialist Agents are placed; 完成 is terminal */
export const ACTIVE_WORKFLOW_STAGES: (PipelineStageMeta & { stage: ActiveWorkflowStage })[] =
  PIPELINE_STAGE_META.slice(0, 3) as (PipelineStageMeta & { stage: ActiveWorkflowStage })[];

export const PIPELINE_STAGE_ORDER: WorkCardType[] = [
  'planning',
  'development',
  'testing',
  'review',
];

export const STAGE_TO_STATUS: Record<WorkCardType, TaskStatus> = {
  planning: 'pending',
  development: 'in_progress',
  testing: 'review',
  review: 'done',
};

export const STATUS_TO_STAGE: Record<TaskStatus, WorkCardType> = {
  pending: 'planning',
  in_progress: 'development',
  review: 'testing',
  done: 'review',
};

export function getNextPipelineStage(stage: WorkCardType): WorkCardType | null {
  const idx = PIPELINE_STAGE_ORDER.indexOf(stage);
  if (idx < 0 || idx >= PIPELINE_STAGE_ORDER.length - 1) return null;
  return PIPELINE_STAGE_ORDER[idx + 1];
}

export function getNextTaskStatus(status: TaskStatus): TaskStatus | null {
  if (status === 'pending') return 'in_progress';
  if (status === 'in_progress') return 'review';
  if (status === 'review') return 'done';
  return null;
}

export function getPipelineStageMeta(stage: WorkCardType): PipelineStageMeta {
  return (
    PIPELINE_STAGE_META.find((m) => m.stage === stage) || PIPELINE_STAGE_META[0]
  );
}

export function getPipelineStageMetaByStatus(status: TaskStatus): PipelineStageMeta {
  return (
    PIPELINE_STAGE_META.find((m) => m.status === status) || PIPELINE_STAGE_META[0]
  );
}

export function getDefaultStagesForAgentCategory(
  category: AgentCategory,
): ActiveWorkflowStage[] {
  if (category === 'product') return ['planning'];
  if (category === 'qa') return ['testing'];
  if (category === 'architecture') return ['planning', 'testing'];
  return ['development'];
}

export function getDefaultProjectPipelineSlots(): ProjectStageSlot[] {
  return [
    {
      stage: 'planning',
      roleTitle: '任务规划师',
      agentId: 'agent_pm_lin',
      handoffMode: 'manual' as PipelineHandoffMode,
      deliverableContract: '拆解任务边界、影响面分析与可验证的验收清单',
    },
    {
      stage: 'development',
      roleTitle: '主力执行 Agent',
      agentId: 'agent_dev_us',
      handoffMode: 'auto' as PipelineHandoffMode,
      deliverableContract: '按任务计划完成核心实现、文档或修复并自测通过',
    },
    {
      stage: 'testing',
      roleTitle: '质量验证专家',
      agentId: 'agent_qa_peer',
      handoffMode: 'manual' as PipelineHandoffMode,
      deliverableContract: '回归用例验证、代码审查与交付物签收确认',
    },
    {
      stage: 'review',
      roleTitle: '归档结束',
      agentId: 'agent_review_my',
      handoffMode: 'manual' as PipelineHandoffMode,
      deliverableContract: '验证通过并归档结束',
    },
  ];
}

export function deriveInitialAgentAssignments(
  workspaces: ProjectWorkspace[],
  pipelines: Record<string, ProjectStageSlot[]>,
  agents: ExpertAgent[],
): Record<string, ProjectAgentAssignment[]> {
  const agentMap = new Map(agents.map((a) => [a.id, a]));
  const result: Record<string, ProjectAgentAssignment[]> = {};

  for (const ws of workspaces) {
    const slots = pipelines[ws.id] || getDefaultProjectPipelineSlots();
    const byAgent = new Map<string, ProjectAgentAssignment>();

    // Seed positions from existing active workflow slots (planning / development / testing)
    for (const slot of slots) {
      if (!slot.agentId || !agentMap.has(slot.agentId)) continue;
      // Map legacy 'review' slot onto 'testing' (任务验证) so every reviewer stands in 验证
      const activeStage: ActiveWorkflowStage =
        slot.stage === 'review' ? 'testing' : slot.stage;
      const existing = byAgent.get(slot.agentId);
      if (existing) {
        if (!existing.stages.includes(activeStage)) {
          existing.stages.push(activeStage);
        }
      } else {
        byAgent.set(slot.agentId, {
          agentId: slot.agentId,
          stages: [activeStage],
          roleNote: slot.roleTitle || agentMap.get(slot.agentId)?.title || '项目专家',
          handoffMode: slot.handoffMode || 'manual',
        });
      }
    }

    // Ensure every hired Agent in the project also appears in the Agent-centric orchestration roster
    for (const aid of ws.hiredAgentIds) {
      if (byAgent.has(aid)) continue;
      const ag = agentMap.get(aid);
      if (!ag) continue;
      byAgent.set(aid, {
        agentId: aid,
        stages: getDefaultStagesForAgentCategory(ag.category),
        roleNote: ag.title,
        handoffMode: 'auto',
      });
    }

    result[ws.id] = Array.from(byAgent.values());
  }

  return result;
}

export function syncSlotsFromAssignments(
  assignments: ProjectAgentAssignment[],
  previousSlots?: ProjectStageSlot[],
): ProjectStageSlot[] {
  const prevMap = new Map(
    (previousSlots || getDefaultProjectPipelineSlots()).map((s) => [s.stage, s]),
  );
  const activeStages: ActiveWorkflowStage[] = ['planning', 'development', 'testing'];

  const activeSlots: ProjectStageSlot[] = activeStages.map((stage) => {
    const matched = assignments.find((a) => a.stages.includes(stage));
    const prev = prevMap.get(stage);
    return {
      stage,
      roleTitle: matched?.roleNote || prev?.roleTitle || getPipelineStageMeta(stage).label,
      agentId: matched?.agentId || prev?.agentId || '',
      handoffMode: matched?.handoffMode || prev?.handoffMode || 'manual',
      deliverableContract: prev?.deliverableContract || getPipelineStageMeta(stage).hint,
    };
  });

  const donePrev = prevMap.get('review');
  activeSlots.push({
    stage: 'review',
    roleTitle: '已完成',
    agentId: activeSlots[2]?.agentId || donePrev?.agentId || '',
    handoffMode: 'manual',
    deliverableContract: '验证通过并归档结束',
  });

  return activeSlots;
}

export type TaskTemplatePackId = 'engineering' | 'operations' | 'general';

export interface TaskTemplatePresetPack {
  id: TaskTemplatePackId;
  label: string;
  summary: string;
  templates: Omit<ProjectTaskType, 'creatorAgentIds'>[];
}

export const DEFAULT_PROJECT_TASK_TYPES: ProjectTaskType[] = [
  {
    id: 'tt_feature',
    name: '新功能',
    description: '全新产品能力、核心模块或业务特性交付',
    templateChecklist: '1. 核心场景与边界条件；2. 接口与状态机设计；3. 单元测试与验收标准',
    accent: 'blue',
    creatorAgentIds: ['agent_pm_lin'],
    isBuiltin: true,
  },
  {
    id: 'tt_story',
    name: 'Story',
    description: '端到端用户故事、需求规划与交互方案拆解',
    templateChecklist: '1. 用户角色与目标；2. 核心交互路径与异常态；3. 验收检查项',
    accent: 'indigo',
    creatorAgentIds: ['agent_pm_lin'],
    isBuiltin: true,
  },
  {
    id: 'tt_task',
    name: 'Task',
    description: '常规工程事项、接口联调、运维配置或文档任务',
    templateChecklist: '1. 执行目标与输入依赖；2. 具体改动范围；3. 自测验证说明',
    accent: 'slate',
    creatorAgentIds: ['agent_dev_us'],
    isBuiltin: true,
  },
  {
    id: 'tt_bug',
    name: 'Bug 分析',
    description: '缺陷定位、根因排查、并发压测与回归修复',
    templateChecklist: '1. 复现步骤与现场日志；2. 根因分析与影响面；3. 修复方案与回归用例',
    accent: 'rose',
    creatorAgentIds: ['agent_qa_peer', 'agent_dev_us'],
    isBuiltin: true,
  },
  {
    id: 'tt_refactor',
    name: '架构重构',
    description: '架构演进、权限/安全审计与性能重构优化',
    templateChecklist: '1. 现状瓶颈与风险清单；2. 重构目标与灰度回滚策略；3. 压测/审计基线',
    accent: 'amber',
    creatorAgentIds: ['agent_review_my'],
    isBuiltin: true,
  },
];

export const TASK_TEMPLATE_PRESET_PACKS: TaskTemplatePresetPack[] = [
  {
    id: 'engineering',
    label: '软件研发套件',
    summary: '适用于产品研发、接口开发、缺陷排查与架构重构',
    templates: DEFAULT_PROJECT_TASK_TYPES.map(({ creatorAgentIds: _c, ...rest }) => rest),
  },
  {
    id: 'operations',
    label: '内容运营套件',
    summary: '适用于新媒体选题、图文/视频生产、活动投放与数据复盘',
    templates: [
      {
        id: 'tt_op_topic',
        name: '选题策划',
        description: '热点趋势洞察、受众画像定位与内容大纲输出',
        templateChecklist: '1. 目标受众与核心痛点；2. 标题备选（3组）与结构大纲；3. 预期传播指标',
        accent: 'indigo',
        isBuiltin: true,
      },
      {
        id: 'tt_op_content',
        name: '内容创作',
        description: '公众号/小红书/短视频脚本与配图物料生成',
        templateChecklist: '1. 正文成稿与金句提炼；2. 封面/视觉分镜建议；3. 合规与敏感词自检',
        accent: 'blue',
        isBuiltin: true,
      },
      {
        id: 'tt_op_campaign',
        name: '活动投放',
        description: '渠道排期、落地页素材配置与转化漏斗追踪',
        templateChecklist: '1. 渠道排期与预算分配；2. UTM/埋点配置核对；3. 应急下线预案',
        accent: 'emerald',
        isBuiltin: true,
      },
      {
        id: 'tt_op_review',
        name: '数据复盘',
        description: '投放 ROI、阅读转化漏斗分析与下周期策略迭代',
        templateChecklist: '1. 核心曝光/点击/转化数据；2. 优劣势归因；3. 下周优化行动项',
        accent: 'amber',
        isBuiltin: true,
      },
    ],
  },
  {
    id: 'general',
    label: '通用协作套件',
    summary: '适用于咨询调研、商业分析、跨部门专项与综合项目',
    templates: [
      {
        id: 'tt_gen_plan',
        name: '方案规划',
        description: '明确项目目标、拆解里程碑与关键假设',
        templateChecklist: '1. 背景与核心目标；2. 阶段里程碑；3. 风险与资源依赖',
        accent: 'indigo',
        isBuiltin: true,
      },
      {
        id: 'tt_gen_exec',
        name: '专项执行',
        description: '资料调研、报告撰写、数据处理或核心交付物产出',
        templateChecklist: '1. 执行输入材料；2. 交付成果正文/附件；3. 关键结论摘要',
        accent: 'blue',
        isBuiltin: true,
      },
      {
        id: 'tt_gen_audit',
        name: '复核验收',
        description: '事实核查、合规审校与最终交付质量把关',
        templateChecklist: '1. 准确性与一致性核查；2. 遗留问题清单；3. 终审签收结论',
        accent: 'emerald',
        isBuiltin: true,
      },
    ],
  },
];

export const TASK_TYPE_ACCENT_OPTIONS: { id: TaskTypeAccent; label: string; dotCls: string }[] = [
  { id: 'blue', label: '海蓝', dotCls: 'bg-blue-600' },
  { id: 'indigo', label: '靛蓝', dotCls: 'bg-indigo-600' },
  { id: 'emerald', label: '翠绿', dotCls: 'bg-emerald-600' },
  { id: 'amber', label: '琥珀', dotCls: 'bg-amber-500' },
  { id: 'rose', label: '玫红', dotCls: 'bg-rose-600' },
  { id: 'slate', label: '石板灰', dotCls: 'bg-slate-600' },
];

export const TASK_TYPE_ACCENT_STYLES: Record<
  TaskTypeAccent,
  { textCls: string; dotCls: string; subtleBgCls: string }
> = {
  blue: {
    textCls: 'text-blue-700',
    dotCls: 'bg-blue-600',
    subtleBgCls: 'bg-blue-50 text-blue-700 border-blue-200/80',
  },
  indigo: {
    textCls: 'text-indigo-700',
    dotCls: 'bg-indigo-600',
    subtleBgCls: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
  },
  emerald: {
    textCls: 'text-emerald-700',
    dotCls: 'bg-emerald-600',
    subtleBgCls: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  },
  amber: {
    textCls: 'text-amber-700',
    dotCls: 'bg-amber-500',
    subtleBgCls: 'bg-amber-50 text-amber-800 border-amber-200/80',
  },
  rose: {
    textCls: 'text-rose-700',
    dotCls: 'bg-rose-600',
    subtleBgCls: 'bg-rose-50 text-rose-700 border-rose-200/80',
  },
  slate: {
    textCls: 'text-slate-700',
    dotCls: 'bg-slate-500',
    subtleBgCls: 'bg-slate-100 text-slate-700 border-slate-200/80',
  },
};

export function buildTaskTypesFromPack(
  packId: TaskTemplatePackId,
  assignments: ProjectAgentAssignment[],
): ProjectTaskType[] {
  const pack =
    TASK_TEMPLATE_PRESET_PACKS.find((p) => p.id === packId) || TASK_TEMPLATE_PRESET_PACKS[0];
  const plannerId = assignments.find((a) => a.stages.includes('planning'))?.agentId;
  const executorId = assignments.find((a) => a.stages.includes('development'))?.agentId;
  const verifierId = assignments.find((a) => a.stages.includes('testing'))?.agentId;
  const fallbackId = assignments[0]?.agentId;

  return pack.templates.map((tpl, idx) => {
    let preferredCreator = plannerId || fallbackId;
    if (tpl.id.includes('bug') || tpl.id.includes('review') || tpl.id.includes('audit')) {
      preferredCreator = verifierId || executorId || fallbackId;
    } else if (
      tpl.id.includes('task') ||
      tpl.id.includes('content') ||
      tpl.id.includes('campaign') ||
      tpl.id.includes('exec')
    ) {
      preferredCreator = executorId || plannerId || fallbackId;
    } else if (tpl.id.includes('refactor')) {
      preferredCreator = verifierId || plannerId || fallbackId;
    } else if (idx > 1 && executorId) {
      preferredCreator = executorId;
    }
    return {
      ...tpl,
      creatorAgentIds: preferredCreator ? [preferredCreator] : [],
    };
  });
}

export function createInitialProjectTaskTypes(
  workspaces: ProjectWorkspace[],
  assignmentsByProject: Record<string, ProjectAgentAssignment[]>,
): Record<string, ProjectTaskType[]> {
  const map: Record<string, ProjectTaskType[]> = {};
  for (const ws of workspaces) {
    const assignments = assignmentsByProject[ws.id] || [];
    map[ws.id] = buildTaskTypesFromPack('engineering', assignments);
  }
  return map;
}

export function getTemplateCreatorIds(taskType: ProjectTaskType): string[] {
  if (taskType.creatorAgentIds && taskType.creatorAgentIds.length > 0) {
    return taskType.creatorAgentIds;
  }
  if (taskType.defaultAgentId) return [taskType.defaultAgentId];
  return [];
}

export function resolveTaskType(
  task: WorkflowTask,
  projectTypes: ProjectTaskType[] = DEFAULT_PROJECT_TASK_TYPES,
): ProjectTaskType {
  const types = projectTypes.length > 0 ? projectTypes : DEFAULT_PROJECT_TASK_TYPES;
  if (task.taskTypeId) {
    const matched = types.find((t) => t.id === task.taskTypeId);
    if (matched) return matched;
  }
  if (task.taskTypeLabel) {
    const byName = types.find((t) => t.name === task.taskTypeLabel);
    if (byName) return byName;
  }

  const text = `${task.title} ${task.description} ${task.featureModule}`.toLowerCase();
  if (
    text.includes('bug') ||
    text.includes('修复') ||
    text.includes('缺陷') ||
    text.includes('压测') ||
    text.includes('回归') ||
    task.workType === 'testing'
  ) {
    return types.find((t) => t.id === 'tt_bug') || types[0];
  }
  if (
    text.includes('架构') ||
    text.includes('重构') ||
    text.includes('审计') ||
    text.includes('审查') ||
    text.includes('越权') ||
    task.workType === 'review'
  ) {
    return types.find((t) => t.id === 'tt_refactor') || types[0];
  }
  if (
    text.includes('prd') ||
    text.includes('规划') ||
    text.includes('方案') ||
    text.includes('矩阵') ||
    text.includes('故事') ||
    task.workType === 'planning'
  ) {
    return types.find((t) => t.id === 'tt_story') || types[0];
  }
  if (
    text.includes('开发') ||
    text.includes('实现') ||
    text.includes('功能') ||
    task.workType === 'development'
  ) {
    return types.find((t) => t.id === 'tt_feature') || types[0];
  }
  return types.find((t) => t.id === 'tt_task') || types[0];
}

export type PipelineStageLiveStatus =
  | 'idle'
  | 'pending'
  | 'in_progress'
  | 'review'
  | 'done';

export interface PipelineStageLiveState {
  stage: WorkCardType;
  status: TaskStatus;
  meta: PipelineStageMeta;
  /** Tasks currently sitting in this unified workflow stage (1:1 with Kanban column) */
  tasks: WorkflowTask[];
  totalCount: number;
  sharePct: number;
  liveStatus: PipelineStageLiveStatus;
  liveStatusLabel: string;
  statusTextCls: string;
  statusPillCls: string;
  dotCls: string;
  barCls: string;
}

export interface ProjectPipelineLiveSummary {
  stages: Record<WorkCardType, PipelineStageLiveState>;
  orderedStages: PipelineStageLiveState[];
  overallProgressPct: number;
  completedStagesCount: number;
  activeStagesCount: number;
  totalTasksCount: number;
  doneTasksCount: number;
  currentFocusStage: WorkCardType;
}

const TASK_STATUS_WEIGHT: Record<TaskStatus, number> = {
  pending: 15,
  in_progress: 50,
  review: 85,
  done: 100,
};

export function computeProjectPipelineProgress(
  projectTasks: WorkflowTask[],
  executingTaskId?: string | null,
): ProjectPipelineLiveSummary {
  const stages = {} as Record<WorkCardType, PipelineStageLiveState>;
  const totalTasksCount = projectTasks.length;

  let weightSum = 0;
  for (const t of projectTasks) {
    const effectiveStatus: TaskStatus =
      executingTaskId && executingTaskId === t.id ? 'in_progress' : t.status;
    weightSum += TASK_STATUS_WEIGHT[effectiveStatus];
  }

  for (const meta of PIPELINE_STAGE_META) {
    const stageTasks = projectTasks.filter((t) => {
      const effectiveStatus: TaskStatus =
        executingTaskId && executingTaskId === t.id ? 'in_progress' : t.status;
      return effectiveStatus === meta.status;
    });

    const totalCount = stageTasks.length;
    const sharePct =
      totalTasksCount > 0 ? Math.round((totalCount / totalTasksCount) * 100) : 0;

    let liveStatus: PipelineStageLiveStatus = 'idle';
    let liveStatusLabel = '空闲';
    let statusTextCls = 'text-slate-400';
    let statusPillCls = 'bg-slate-100 text-slate-500 border-slate-200';
    let dotCls = 'bg-slate-300';
    let barCls = 'bg-slate-300';

    if (totalCount > 0) {
      liveStatus = meta.status;
      if (meta.status === 'pending') {
        liveStatusLabel = `${totalCount} 项待执行`;
        statusTextCls = 'text-slate-700';
        statusPillCls = 'bg-slate-100 text-slate-700 border-slate-200';
        dotCls = 'bg-slate-500';
        barCls = 'bg-slate-500';
      } else if (meta.status === 'in_progress') {
        liveStatusLabel = `${totalCount} 项执行中`;
        statusTextCls = 'text-blue-700';
        statusPillCls = 'bg-blue-50 text-blue-700 border-blue-200';
        dotCls = 'bg-blue-600';
        barCls = 'bg-blue-600';
      } else if (meta.status === 'review') {
        liveStatusLabel = `${totalCount} 项待验证`;
        statusTextCls = 'text-amber-700';
        statusPillCls = 'bg-amber-50 text-amber-800 border-amber-200';
        dotCls = 'bg-amber-500';
        barCls = 'bg-amber-500';
      } else {
        liveStatusLabel = `${totalCount} 项已完成`;
        statusTextCls = 'text-emerald-700';
        statusPillCls = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        dotCls = 'bg-emerald-500';
        barCls = 'bg-emerald-500';
      }
    }

    stages[meta.stage] = {
      stage: meta.stage,
      status: meta.status,
      meta,
      tasks: stageTasks,
      totalCount,
      sharePct,
      liveStatus,
      liveStatusLabel,
      statusTextCls,
      statusPillCls,
      dotCls,
      barCls,
    };
  }

  const orderedStages = PIPELINE_STAGE_ORDER.map((s) => stages[s]);
  const doneTasksCount = stages.review.totalCount;
  const completedStagesCount = orderedStages.filter((s) => s.status === 'done' && s.totalCount > 0).length;
  const activeStagesCount = orderedStages.filter(
    (s) => (s.status === 'in_progress' || s.status === 'review') && s.totalCount > 0,
  ).length;

  const overallProgressPct =
    totalTasksCount > 0 ? Math.round(weightSum / totalTasksCount) : 0;

  const currentFocusStage =
    (stages.development.totalCount > 0 && 'development') ||
    (stages.testing.totalCount > 0 && 'testing') ||
    (stages.planning.totalCount > 0 && 'planning') ||
    'review';

  return {
    stages,
    orderedStages,
    overallProgressPct,
    completedStagesCount,
    activeStagesCount,
    totalTasksCount,
    doneTasksCount,
    currentFocusStage,
  };
}

export const TASK_STATUS_LABEL_MAP: Record<TaskStatus, string> = {
  pending: '任务计划',
  in_progress: '任务执行',
  review: '任务验证',
  done: '已完成',
};
