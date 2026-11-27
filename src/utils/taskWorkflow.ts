import type {
  ActiveWorkflowStage,
  ExpertAgent,
  ProjectAgentAssignment,
  ProjectStageSlot,
  ProjectWorkspace,
  TaskStatus,
  WorkflowTask,
} from '../types/agentnexus';

export interface TaskWorkflowStageMeta {
  id: ActiveWorkflowStage;
  label: string;
  shortLabel: string;
  status: TaskStatus;
  description: string;
}

export const TASK_WORKFLOW_STAGES: TaskWorkflowStageMeta[] = [
  {
    id: 'planning',
    label: '计划',
    shortLabel: '计划',
    status: 'pending',
    description: '需求拆解、边界确认与方案规划',
  },
  {
    id: 'development',
    label: '执行',
    shortLabel: '执行',
    status: 'in_progress',
    description: '编码实现、产出交付物与单测',
  },
  {
    id: 'testing',
    label: '验收',
    shortLabel: '验收',
    status: 'review',
    description: '代码评审、压测回归与质量验收',
  },
];

export const STAGE_LABEL_MAP: Record<ActiveWorkflowStage, string> = {
  planning: '计划',
  development: '执行',
  testing: '验收',
};

export function getTaskCurrentStage(status: TaskStatus): ActiveWorkflowStage {
  if (status === 'pending') return 'planning';
  if (status === 'in_progress') return 'development';
  return 'testing';
}

export function getStageIndex(stage: ActiveWorkflowStage): number {
  if (stage === 'planning') return 0;
  if (stage === 'development') return 1;
  return 2;
}

export function getNextWorkflowStage(stage: ActiveWorkflowStage): ActiveWorkflowStage | null {
  if (stage === 'planning') return 'development';
  if (stage === 'development') return 'testing';
  return null;
}

export interface ResolvedTaskWorkflowTeam {
  stageAgents: Record<ActiveWorkflowStage, ExpertAgent | null>;
  currentStage: ActiveWorkflowStage;
  activeAgent: ExpertAgent | null;
  participants: ExpertAgent[];
}

function findFallbackAgentForStage(
  stage: ActiveWorkflowStage,
  preferredPool: ExpertAgent[],
  allAgents: ExpertAgent[],
  excludeIds: Set<string>,
): ExpertAgent | null {
  const preferredCategories: Record<ActiveWorkflowStage, ExpertAgent['category'][]> = {
    planning: ['product', 'architecture', 'design'],
    development: ['engineering', 'design', 'architecture'],
    testing: ['qa', 'architecture', 'engineering'],
  };

  const cats = preferredCategories[stage];
  for (const pool of [preferredPool, allAgents]) {
    for (const cat of cats) {
      const match = pool.find((a) => a.category === cat && !excludeIds.has(a.id));
      if (match) return match;
    }
  }
  for (const pool of [preferredPool, allAgents]) {
    const anyUnique = pool.find((a) => !excludeIds.has(a.id));
    if (anyUnique) return anyUnique;
  }
  return preferredPool[0] || allAgents[0] || null;
}

/**
 * Resolve the multi-agent workflow roster (计划 / 执行 / 验收) for a project task.
 * A task stays anchored while different specialist Agents relay across stages.
 */
export function resolveTaskWorkflowTeam(
  task: WorkflowTask,
  workspace: ProjectWorkspace | undefined,
  agents: ExpertAgent[],
  assignments: ProjectAgentAssignment[] = [],
  pipelineSlots: ProjectStageSlot[] = [],
): ResolvedTaskWorkflowTeam {
  const agentMap = new Map(agents.map((a) => [a.id, a]));
  const hiredPool = (workspace?.hiredAgentIds || [])
    .map((id) => agentMap.get(id))
    .filter((a): a is ExpertAgent => Boolean(a));
  const currentStage = getTaskCurrentStage(task.status);
  const currentAssignee = agentMap.get(task.assigneeId) || null;

  const pickForStage = (
    stage: ActiveWorkflowStage,
    alreadyPicked: Set<string>,
  ): ExpertAgent | null => {
    // 1. Explicit per-task stage mapping
    const explicitId = task.stageAgents?.[stage];
    if (explicitId && agentMap.has(explicitId)) {
      return agentMap.get(explicitId)!;
    }

    // 2. Current task assignee owns the current active stage
    if (stage === currentStage && currentAssignee) {
      return currentAssignee;
    }

    // 3. Project workflow assignments matching this stage
    const stageAssigns = assignments.filter((a) => a.stages.includes(stage));
    const uniqueAssign = stageAssigns.find(
      (a) => !alreadyPicked.has(a.agentId) && agentMap.has(a.agentId),
    );
    if (uniqueAssign) return agentMap.get(uniqueAssign.agentId)!;
    if (stageAssigns[0] && agentMap.has(stageAssigns[0].agentId)) {
      return agentMap.get(stageAssigns[0].agentId)!;
    }

    // 4. Legacy pipeline slot mapping
    const slot = pipelineSlots.find((s) => s.stage === stage);
    if (slot?.agentId && agentMap.has(slot.agentId)) {
      return agentMap.get(slot.agentId)!;
    }

    // 5. Role-appropriate specialist fallback from project team / global roster
    return findFallbackAgentForStage(stage, hiredPool, agents, alreadyPicked);
  };

  const pickedIds = new Set<string>();
  const stageAgents: Record<ActiveWorkflowStage, ExpertAgent | null> = {
    planning: null,
    development: null,
    testing: null,
  };

  // Resolve current stage first so the active owner is anchored accurately
  const currentOwner = pickForStage(currentStage, pickedIds);
  stageAgents[currentStage] = currentOwner;
  if (currentOwner) pickedIds.add(currentOwner.id);

  // Resolve remaining stages with distinct specialists wherever possible
  (['planning', 'development', 'testing'] as ActiveWorkflowStage[]).forEach((st) => {
    if (st === currentStage) return;
    const owner = pickForStage(st, pickedIds);
    stageAgents[st] = owner;
    if (owner) pickedIds.add(owner.id);
  });

  // Deduplicated ordered participant list (计划 -> 执行 -> 验收)
  const seen = new Set<string>();
  const participants: ExpertAgent[] = [];
  (['planning', 'development', 'testing'] as ActiveWorkflowStage[]).forEach((st) => {
    const ag = stageAgents[st];
    if (ag && !seen.has(ag.id)) {
      seen.add(ag.id);
      participants.push(ag);
    }
  });

  return {
    stageAgents,
    currentStage,
    activeAgent: stageAgents[currentStage] || currentAssignee,
    participants,
  };
}
