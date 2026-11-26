import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  ArrowRight,
  ArrowUp,
  Bot,
  Check,
  ChevronDown,
  Compass,
  FolderKanban,
  FolderPlus,
  MessageSquare,
  Plus,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import type {
  AgentCategory,
  CommunityZone,
  ExpertAgent,
  ProjectStageSlot,
  ProjectWorkspace,
  WorkCardType,
} from '../../types/agentnexus';
import {
  AgentIdentityName,
  EntityAvatar,
  formatAgentDisplayName,
} from '../shared/EntityIdentity';

interface NewSessionLauncherPaneProps {
  workspaces: ProjectWorkspace[];
  activeWorkspace: ProjectWorkspace;
  projectPipelines: Record<string, ProjectStageSlot[]>;
  zones: CommunityZone[];
  agents: ExpertAgent[];
  onLaunchTaskSession: (input: {
    sessionId: string;
    assigneeId: string;
    workType: WorkCardType;
    prompt: string;
    featureModule?: string;
    syncToGroup?: boolean;
  }) => Promise<void>;
  onCreateProjectForLauncher: (name: string, goal: string, sourceZoneId?: string) => string;
  onJumpToMountPrivate: () => void;
  onJumpToMarket: () => void;
  onJumpToCommunity?: () => void;
}

type OpenDropdown = 'none' | 'project' | 'agent' | 'skill';

const STAGE_LABELS: Record<WorkCardType, string> = {
  planning: '产品策划',
  development: '功能开发',
  testing: '功能测试',
  review: '架构评审',
};

const STANDARD_SKILLS: { id: string; label: string; stage: WorkCardType }[] = [
  { id: 'std:development', label: '功能开发', stage: 'development' },
  { id: 'std:planning', label: '产品策划', stage: 'planning' },
  { id: 'std:testing', label: '功能测试', stage: 'testing' },
  { id: 'std:review', label: '架构评审', stage: 'review' },
];

function inferStageFromCategory(category: AgentCategory): WorkCardType {
  switch (category) {
    case 'product':
    case 'design':
    case 'media':
      return 'planning';
    case 'qa':
      return 'testing';
    case 'architecture':
      return 'review';
    case 'engineering':
    default:
      return 'development';
  }
}

function inferStageFromSkillLabel(skillLabel: string): WorkCardType | null {
  const lower = skillLabel.toLowerCase();
  if (/(测试|回归|qa|压测|验证|质量|用例|playwright|脱敏|审计)/.test(lower)) return 'testing';
  if (/(架构|评审|安全|风控|合规|review|审计|治理)/.test(lower)) return 'review';
  if (/(产品|策划|prd|原型|需求|设计|文案|增长|seo|营销|运营)/.test(lower)) return 'planning';
  if (/(开发|全栈|编码|代码|接口|固件|后端|前端|部署|mcp|脚本)/.test(lower)) return 'development';
  return null;
}

export function NewSessionLauncherPane({
  workspaces,
  activeWorkspace,
  projectPipelines,
  zones,
  agents,
  onLaunchTaskSession,
  onCreateProjectForLauncher,
  onJumpToMountPrivate,
  onJumpToMarket,
  onJumpToCommunity,
}: NewSessionLauncherPaneProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    activeWorkspace?.id || workspaces[0]?.id || '',
  );
  const [syncToGroup, setSyncToGroup] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [launching, setLaunching] = useState(false);

  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>('none');
  const [showInlineCreateProject, setShowInlineCreateProject] = useState(false);
  const [newProjName, setNewProjName] = useState('');
  const [newProjGoal, setNewProjGoal] = useState('');
  const [newProjZoneId, setNewProjZoneId] = useState('');

  const dropdownContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const selectedProject = useMemo(
    () => workspaces.find((w) => w.id === selectedProjectId) || workspaces[0],
    [selectedProjectId, workspaces],
  );

  const [selectedAgentId, setSelectedAgentId] = useState<string>(() => {
    const firstHired = activeWorkspace?.hiredAgentIds?.[0];
    if (firstHired && agents.some((a) => a.id === firstHired)) return firstHired;
    return agents[0]?.id || '';
  });

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId) || agents[0],
    [agents, selectedAgentId],
  );

  // Selected skill: either an explicit skill string from the selected agent / standard skills, or '' for auto-match
  const [selectedSkill, setSelectedSkill] = useState<string>(
    () => agents.find((a) => a.id === (activeWorkspace?.hiredAgentIds?.[0] || agents[0]?.id))?.skills?.[0] || '功能开发',
  );

  const zoneMap = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);

  // Workflow stage bindings for the currently selected project
  const projectPipelineSlots = useMemo(
    () => (selectedProject ? projectPipelines[selectedProject.id] || [] : []),
    [projectPipelines, selectedProject],
  );

  const agentStageMap = useMemo(() => {
    const map = new Map<string, WorkCardType[]>();
    for (const slot of projectPipelineSlots) {
      const list = map.get(slot.agentId) || [];
      if (!list.includes(slot.stage)) list.push(slot.stage);
      map.set(slot.agentId, list);
    }
    return map;
  }, [projectPipelineSlots]);

  const { projectAgents, otherAgents } = useMemo(() => {
    const hiredSet = new Set(selectedProject?.hiredAgentIds || []);
    return {
      projectAgents: agents.filter((a) => hiredSet.has(a.id)),
      otherAgents: agents.filter((a) => !hiredSet.has(a.id)),
    };
  }, [agents, selectedProject?.hiredAgentIds]);

  const agentSkills = useMemo(() => selectedAgent?.skills || [], [selectedAgent]);

  // Close dropdowns on outside click
  useEffect(() => {
    if (openDropdown === 'none') return;
    const onDown = (e: MouseEvent) => {
      if (
        dropdownContainerRef.current &&
        !dropdownContainerRef.current.contains(e.target as Node)
      ) {
        setOpenDropdown('none');
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [openDropdown]);

  const handleSelectAgent = (agent: ExpertAgent) => {
    setSelectedAgentId(agent.id);
    // Automatically align default skill to this expert Agent's primary encoded skill
    if (agent.skills && agent.skills.length > 0) {
      setSelectedSkill(agent.skills[0]);
    } else {
      const fallbackStage =
        agentStageMap.get(agent.id)?.[0] || inferStageFromCategory(agent.category);
      setSelectedSkill(STAGE_LABELS[fallbackStage]);
    }
    setOpenDropdown('none');
  };

  // Resolve final workflow stage for the task card based on selected skill + agent's project pipeline stage
  const resolvedWorkType: WorkCardType = useMemo(() => {
    const matchedStandard = STANDARD_SKILLS.find((s) => s.label === selectedSkill);
    if (matchedStandard) return matchedStandard.stage;

    if (selectedAgent) {
      const boundStages = agentStageMap.get(selectedAgent.id);
      if (boundStages && boundStages.length > 0) return boundStages[0];
    }

    const inferredFromSkill = selectedSkill ? inferStageFromSkillLabel(selectedSkill) : null;
    if (inferredFromSkill) return inferredFromSkill;

    return selectedAgent ? inferStageFromCategory(selectedAgent.category) : 'development';
  }, [agentStageMap, selectedAgent, selectedSkill]);

  const handleCreateInlineProject = (e: FormEvent) => {
    e.preventDefault();
    if (!newProjName.trim()) return;
    const createdId = onCreateProjectForLauncher(
      newProjName.trim(),
      newProjGoal.trim(),
      newProjZoneId || undefined,
    );
    if (createdId) {
      setSelectedProjectId(createdId);
    }
    setNewProjName('');
    setNewProjGoal('');
    setNewProjZoneId('');
    setShowInlineCreateProject(false);
    textareaRef.current?.focus();
  };

  const triggerLaunch = async (promptOverride?: string) => {
    const cleaned = (promptOverride ?? prompt).trim();
    if (!cleaned || launching || !selectedProject || !selectedAgent) return;
    setLaunching(true);
    try {
      await onLaunchTaskSession({
        sessionId: selectedProject.id,
        assigneeId: selectedAgent.id,
        workType: resolvedWorkType,
        prompt: cleaned,
        featureModule: selectedSkill || STAGE_LABELS[resolvedWorkType],
        syncToGroup,
      });
      setPrompt('');
    } finally {
      setLaunching(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void triggerLaunch();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void triggerLaunch();
    }
  };

  const selectedAgentBoundStages = selectedAgent ? agentStageMap.get(selectedAgent.id) || [] : [];

  return (
    <div className="h-full w-full overflow-y-auto clean-scroll bg-white">
      <div className="min-h-full max-w-3xl mx-auto px-5 sm:px-8 pt-8 pb-16 sm:pb-20 flex flex-col justify-center">
        {/* Product Slogan + Two-line Positioning */}
        <div className="text-center mb-8 sm:mb-10">
          <h1 className="font-display text-2xl sm:text-[32px] font-extrabold tracking-tight text-slate-900">
            AgentNexus，专家Agents 协同网络
          </h1>
          <p className="mt-2.5 text-xs sm:text-sm font-medium text-slate-500 tracking-wide">
            组建自己的Agent团队，做专业OPC/FDE
          </p>
        </div>

        {/* Inline Quick-Create Project Card */}
        {showInlineCreateProject && (
          <form
            onSubmit={handleCreateInlineProject}
            className="mb-4 rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-blue-700" />
                <span className="text-xs font-bold text-slate-900">
                  快速创建新项目并自动建群
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowInlineCreateProject(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                aria-label="关闭创建项目表单"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                required
                value={newProjName}
                onChange={(e) => setNewProjName(e.target.value)}
                placeholder="输入新项目名称（如：AI 智能客服中台）"
                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
              <select
                value={newProjZoneId}
                onChange={(e) => setNewProjZoneId(e.target.value)}
                aria-label="选择项目归属 Agent 社区"
                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              >
                <option value="">归属：个人私有项目</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    归属：{z.name}（{z.typeLabel}）
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2.5">
              <input
                type="text"
                value={newProjGoal}
                onChange={(e) => setNewProjGoal(e.target.value)}
                placeholder="一句话描述项目交付目标（可选）"
                className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap shrink-0"
              >
                创建并选中
              </button>
            </div>
          </form>
        )}

        {/* Simplified Command Composer: Top = Project Context, Bottom = Expert Agent + Skill + Launch */}
        <div
          ref={dropdownContainerRef}
          className="rounded-2xl border border-slate-200 bg-white shadow-sm focus-within:border-slate-400 focus-within:ring-4 focus-within:ring-slate-900/5 transition-all"
        >
          {/* Top Bar: Project Workspace Context + Sync to Group Toggle */}
          <div className="px-3.5 py-2 border-b border-slate-100 bg-slate-50/70 rounded-t-2xl flex items-center justify-between gap-2">
            {/* Project Selector */}
            <div className="relative min-w-0">
              <button
                type="button"
                onClick={() =>
                  setOpenDropdown((cur) => (cur === 'project' ? 'none' : 'project'))
                }
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer max-w-[260px] ${
                  openDropdown === 'project'
                    ? 'bg-slate-200/80 text-slate-900'
                    : 'text-slate-700 hover:bg-slate-200/55 hover:text-slate-900'
                }`}
              >
                <FolderKanban className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="truncate">{selectedProject?.name || '选择项目'}</span>
                <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
              </button>

              {openDropdown === 'project' && (
                <div className="absolute left-0 top-full mt-1.5 w-72 z-40 rounded-xl bg-white border border-slate-200 shadow-xl py-1.5 text-xs">
                  <div className="px-3 py-1 text-[10.5px] font-semibold text-slate-400">
                    选择归属项目工作区
                  </div>
                  <div className="max-h-56 overflow-y-auto clean-scroll">
                    {workspaces.map((ws) => {
                      const active = ws.id === selectedProject?.id;
                      const wsZone = ws.sourceZoneId ? zoneMap.get(ws.sourceZoneId) : undefined;
                      return (
                        <button
                          key={ws.id}
                          type="button"
                          onClick={() => {
                            setSelectedProjectId(ws.id);
                            setOpenDropdown('none');
                          }}
                          className="w-full px-3 py-2 hover:bg-slate-50 flex items-center justify-between gap-2 text-left cursor-pointer"
                        >
                          <div className="min-w-0">
                            <div
                              className={`truncate ${
                                active ? 'font-bold text-slate-900' : 'font-medium text-slate-700'
                              }`}
                            >
                              {ws.name}
                            </div>
                            <div className="text-[10.5px] text-slate-400 truncate">
                              {wsZone ? `${wsZone.shortCode} · ${wsZone.name}` : '个人私有项目'} ·{' '}
                              {ws.hiredAgentIds.length} 位专家
                            </div>
                          </div>
                          {active && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    type="button"
                    onClick={() => {
                      setOpenDropdown('none');
                      setShowInlineCreateProject(true);
                    }}
                    className="w-full px-3 py-2 hover:bg-blue-50/70 flex items-center gap-2 text-blue-700 font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    <span>创建新项目并自动建群</span>
                  </button>
                </div>
              )}
            </div>

            {/* Right Multi-Agent Sync Toggle */}
            <button
              type="button"
              onClick={() => setSyncToGroup((v) => !v)}
              title="开启后，任务启动与阶段结论会自动以任务卡片同步至该项目群，便于其他 Agent 与专家协同"
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer shrink-0 ${
                syncToGroup
                  ? 'text-blue-700 bg-blue-50/80 hover:bg-blue-100/70'
                  : 'text-slate-500 hover:bg-slate-200/50'
              }`}
            >
              <Users className="w-3 h-3" />
              <span>同步项目群</span>
              {syncToGroup && <Check className="w-3 h-3" />}
            </button>
          </div>

          {/* Main Input Form */}
          <form onSubmit={handleSubmit}>
            <div className="px-4 pt-3.5 pb-2">
              <textarea
                ref={textareaRef}
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={launching}
                placeholder={`向 ${
                  selectedAgent
                    ? formatAgentDisplayName(
                        selectedAgent.handle,
                        selectedAgent.runtimeAgent,
                        selectedAgent.defaultModel,
                      )
                    : '专家 Agent'
                } 描述任务目标或问题…`}
                className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none resize-none leading-relaxed"
              />
            </div>

            {/* Bottom Composer Bar: Expert Agent + Skill (together on left) | Launch CTA (right) */}
            <div className="px-3.5 py-2.5 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                {/* 1. Expert Agent Picker */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenDropdown((cur) => (cur === 'agent' ? 'none' : 'agent'))
                    }
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer max-w-[300px] ${
                      openDropdown === 'agent'
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {selectedAgent ? (
                      <span
                        className="w-4 h-4 rounded text-[9px] font-bold text-white inline-flex items-center justify-center shrink-0"
                        style={{ backgroundColor: selectedAgent.avatarAccent }}
                      >
                        {selectedAgent.avatarCode.slice(0, 1)}
                      </span>
                    ) : (
                      <Bot className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    )}
                    {selectedAgent ? (
                      <AgentIdentityName
                        name={selectedAgent.handle}
                        runtime={selectedAgent.runtimeAgent}
                        model={selectedAgent.defaultModel}
                        className="font-semibold text-slate-900"
                      />
                    ) : (
                      <span className="truncate font-semibold text-slate-900">选择专家 Agent</span>
                    )}
                    <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                  </button>

                  {openDropdown === 'agent' && (
                    <div className="absolute left-0 bottom-full mb-2 w-80 max-w-[85vw] z-40 rounded-xl bg-white border border-slate-200 shadow-xl py-1.5 text-xs">
                      <div className="max-h-64 overflow-y-auto clean-scroll">
                        {projectAgents.length > 0 && (
                          <>
                            <div className="px-3 py-1 text-[10.5px] font-semibold text-slate-400">
                              当前项目已加入专家 ({projectAgents.length})
                            </div>
                            {projectAgents.map((ag) => {
                              const active = ag.id === selectedAgent?.id;
                              const boundStages = agentStageMap.get(ag.id) || [];
                              return (
                                <button
                                  key={ag.id}
                                  type="button"
                                  onClick={() => handleSelectAgent(ag)}
                                  className="w-full px-3 py-2 hover:bg-slate-50 flex items-center justify-between gap-2 text-left cursor-pointer"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <EntityAvatar
                                      kind="agent"
                                      code={ag.avatarCode}
                                      accent={ag.avatarAccent}
                                      size="sm"
                                      showCornerMark={false}
                                    />
                                    <div className="min-w-0">
                                      <AgentIdentityName
                                        name={ag.handle}
                                        runtime={ag.runtimeAgent}
                                        model={ag.defaultModel}
                                        className={
                                          active
                                            ? 'font-bold text-slate-900'
                                            : 'font-medium text-slate-800'
                                        }
                                      />
                                      <div className="text-[10.5px] text-slate-400 truncate">
                                        {boundStages.length > 0
                                          ? `负责阶段：${boundStages.map((s) => STAGE_LABELS[s]).join(' / ')}`
                                          : ag.title}
                                      </div>
                                    </div>
                                  </div>
                                  {active && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                                </button>
                              );
                            })}
                          </>
                        )}

                        {otherAgents.length > 0 && (
                          <>
                            <div className="px-3 pt-2 pb-1 text-[10.5px] font-semibold text-slate-400">
                              更多可用专家 / 自建 Agent ({otherAgents.length})
                            </div>
                            {otherAgents.map((ag) => {
                              const active = ag.id === selectedAgent?.id;
                              return (
                                <button
                                  key={ag.id}
                                  type="button"
                                  onClick={() => handleSelectAgent(ag)}
                                  className="w-full px-3 py-2 hover:bg-slate-50 flex items-center justify-between gap-2 text-left cursor-pointer"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <EntityAvatar
                                      kind="agent"
                                      code={ag.avatarCode}
                                      accent={ag.avatarAccent}
                                      size="sm"
                                      showCornerMark={false}
                                    />
                                    <div className="min-w-0">
                                      <AgentIdentityName
                                        name={ag.handle}
                                        runtime={ag.runtimeAgent}
                                        model={ag.defaultModel}
                                        className={
                                          active
                                            ? 'font-bold text-slate-900'
                                            : 'font-medium text-slate-800'
                                        }
                                      />
                                      <div className="text-[10.5px] text-slate-400 truncate">
                                        {ag.ownership === 'private' ? '自建 Agent · ' : ''}
                                        {ag.title}
                                      </div>
                                    </div>
                                  </div>
                                  {active && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                                </button>
                              );
                            })}
                          </>
                        )}
                      </div>

                      <div className="my-1 border-t border-slate-100" />
                      <button
                        type="button"
                        onClick={() => {
                          setOpenDropdown('none');
                          onJumpToMountPrivate();
                        }}
                        className="w-full px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-800 font-semibold cursor-pointer"
                      >
                        <Bot className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>建立 / 挂载新的自建 Agent</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenDropdown('none');
                          onJumpToMarket();
                        }}
                        className="w-full px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700 font-medium cursor-pointer"
                      >
                        <Compass className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>去 AGN 社区服务市场招募专家</span>
                      </button>
                    </div>
                  )}
                </div>

                <span className="text-slate-200 text-xs select-none" aria-hidden="true">
                  |
                </span>

                {/* 2. Skill Selector (Agent's encoded skills + standard execution skills) */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenDropdown((cur) => (cur === 'skill' ? 'none' : 'skill'))
                    }
                    title={`本次调用的技能（将自动归入工作流「${STAGE_LABELS[resolvedWorkType]}」阶段）`}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer max-w-[200px] ${
                      openDropdown === 'skill'
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">{selectedSkill || '自动匹配技能'}</span>
                    <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                  </button>

                  {openDropdown === 'skill' && (
                    <div className="absolute left-0 bottom-full mb-2 w-64 max-w-[80vw] z-40 rounded-xl bg-white border border-slate-200 shadow-xl py-1.5 text-xs">
                      <div className="max-h-64 overflow-y-auto clean-scroll">
                        {agentSkills.length > 0 && (
                          <>
                            <div className="px-3 py-1 text-[10.5px] font-semibold text-slate-400 flex items-center justify-between gap-2">
                              <span>当前专家已装配 Skills</span>
                              {selectedAgentBoundStages.length > 0 && (
                                <span className="text-[10px] font-normal text-blue-600">
                                  {STAGE_LABELS[selectedAgentBoundStages[0]]}
                                </span>
                              )}
                            </div>
                            {agentSkills.map((sk) => {
                              const active = selectedSkill === sk;
                              return (
                                <button
                                  key={sk}
                                  type="button"
                                  onClick={() => {
                                    setSelectedSkill(sk);
                                    setOpenDropdown('none');
                                  }}
                                  className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center justify-between gap-2 text-left cursor-pointer"
                                >
                                  <span
                                    className={`truncate ${
                                      active
                                        ? 'font-bold text-slate-900'
                                        : 'font-medium text-slate-700'
                                    }`}
                                  >
                                    {sk}
                                  </span>
                                  {active && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                                </button>
                              );
                            })}
                          </>
                        )}

                        <div className="px-3 pt-2 pb-1 text-[10.5px] font-semibold text-slate-400">
                          通用任务 Skills（映射工作流阶段）
                        </div>
                        {STANDARD_SKILLS.map((opt) => {
                          const active = selectedSkill === opt.label;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                setSelectedSkill(opt.label);
                                setOpenDropdown('none');
                              }}
                              className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center justify-between gap-2 text-left cursor-pointer"
                            >
                              <span
                                className={
                                  active
                                    ? 'font-bold text-slate-900'
                                    : 'font-medium text-slate-700'
                                }
                              >
                                {opt.label}
                              </span>
                              {active && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={launching || !prompt.trim() || !selectedProject || !selectedAgent}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap shrink-0"
              >
                <span>{launching ? '启动中...' : '开始会话'}</span>
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>

        {/* Compact Onboarding Guidance Strip (Positioned Cleanly Below Composer) */}
        <div className="mt-10 sm:mt-12 max-w-[540px] mx-auto w-full">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setShowInlineCreateProject(true)}
              className="group rounded-lg border border-slate-200/75 bg-slate-50/45 hover:bg-white hover:border-slate-300 px-2.5 py-1.5 text-left transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 group-hover:text-slate-900 transition-colors truncate">
                  <FolderPlus className="w-3 h-3 text-blue-600/80 shrink-0" />
                  <span className="truncate">创建新项目</span>
                </span>
                <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>
              <p className="mt-0.5 text-[10px] text-slate-400 truncate">
                新建工作区并建群
              </p>
            </button>

            <button
              type="button"
              onClick={onJumpToMarket}
              className="group rounded-lg border border-slate-200/75 bg-slate-50/45 hover:bg-white hover:border-slate-300 px-2.5 py-1.5 text-left transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 group-hover:text-slate-900 transition-colors truncate">
                  <Compass className="w-3 h-3 text-emerald-600/80 shrink-0" />
                  <span className="truncate">招募 Agent 专家</span>
                </span>
                <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>
              <p className="mt-0.5 text-[10px] text-slate-400 truncate">
                按期租赁隔离切片
              </p>
            </button>

            <button
              type="button"
              onClick={() => (onJumpToCommunity ? onJumpToCommunity() : onJumpToMarket())}
              className="group rounded-lg border border-slate-200/75 bg-slate-50/45 hover:bg-white hover:border-slate-300 px-2.5 py-1.5 text-left transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 group-hover:text-slate-900 transition-colors truncate">
                  <MessageSquare className="w-3 h-3 text-indigo-600/80 shrink-0" />
                  <span className="truncate">去社区交流</span>
                </span>
                <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>
              <p className="mt-0.5 text-[10px] text-slate-400 truncate">
                交流实战与共创项目
              </p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
