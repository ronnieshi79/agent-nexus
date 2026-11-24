import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  ArrowUp,
  Bot,
  Check,
  ChevronDown,
  Compass,
  FolderKanban,
  FolderPlus,
  Layers,
  Plus,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import type {
  AgentCategory,
  AgentNexusAccount,
  CommunityZone,
  ExpertAgent,
  ProjectWorkspace,
  WorkCardType,
} from '../../types/agentnexus';
import {
  AgentIdentityName,
  EntityAvatar,
  displayEntityName,
  formatShortModel,
} from '../shared/EntityIdentity';

interface NewSessionLauncherPaneProps {
  workspaces: ProjectWorkspace[];
  activeWorkspace: ProjectWorkspace;
  zones: CommunityZone[];
  agents: ExpertAgent[];
  account: AgentNexusAccount | null;
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
}

type ScenarioId = 'code' | 'product' | 'architecture' | 'testing' | 'docs' | 'multi_agent';
type OpenDropdown = 'none' | 'project' | 'agent' | 'workType';

const WORK_TYPE_OPTIONS: { id: WorkCardType; label: string }[] = [
  { id: 'development', label: '功能开发' },
  { id: 'planning', label: '产品策划' },
  { id: 'review', label: '架构评审' },
  { id: 'testing', label: '功能测试' },
];

const SCENARIOS: {
  id: ScenarioId;
  label: string;
  workType: WorkCardType;
  preferredCategories: AgentCategory[];
  moduleLabel: string;
}[] = [
  {
    id: 'code',
    label: '代码开发',
    workType: 'development',
    preferredCategories: ['engineering'],
    moduleLabel: '核心功能开发',
  },
  {
    id: 'product',
    label: '产品策划',
    workType: 'planning',
    preferredCategories: ['product', 'design'],
    moduleLabel: '产品需求与策划',
  },
  {
    id: 'architecture',
    label: '架构评审',
    workType: 'review',
    preferredCategories: ['architecture', 'engineering'],
    moduleLabel: '架构与安全评审',
  },
  {
    id: 'testing',
    label: '测试验证',
    workType: 'testing',
    preferredCategories: ['qa', 'engineering'],
    moduleLabel: '质量验收与回归',
  },
  {
    id: 'docs',
    label: '方案文档',
    workType: 'planning',
    preferredCategories: ['product', 'media', 'architecture'],
    moduleLabel: '方案与汇报文档',
  },
  {
    id: 'multi_agent',
    label: '多 Agent 协同',
    workType: 'development',
    preferredCategories: ['architecture', 'product', 'engineering'],
    moduleLabel: '多 Agent 协同交付',
  },
];

export function NewSessionLauncherPane({
  workspaces,
  activeWorkspace,
  zones,
  agents,
  account,
  onLaunchTaskSession,
  onCreateProjectForLauncher,
  onJumpToMountPrivate,
  onJumpToMarket,
}: NewSessionLauncherPaneProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    activeWorkspace?.id || workspaces[0]?.id || '',
  );
  const [selectedScenarioId, setSelectedScenarioId] = useState<ScenarioId>('code');
  const [workType, setWorkType] = useState<WorkCardType>('development');
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

  // Default selected agent: prefer a hired agent in the selected project, else first agent
  const [selectedAgentId, setSelectedAgentId] = useState<string>(() => {
    const firstHired = activeWorkspace?.hiredAgentIds?.[0];
    if (firstHired && agents.some((a) => a.id === firstHired)) return firstHired;
    return agents[0]?.id || '';
  });

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId) || agents[0],
    [agents, selectedAgentId],
  );

  const activeScenario = useMemo(
    () => SCENARIOS.find((s) => s.id === selectedScenarioId) || SCENARIOS[0],
    [selectedScenarioId],
  );

  const zoneMap = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);

  const { projectAgents, otherAgents } = useMemo(() => {
    const hiredSet = new Set(selectedProject?.hiredAgentIds || []);
    return {
      projectAgents: agents.filter((a) => hiredSet.has(a.id)),
      otherAgents: agents.filter((a) => !hiredSet.has(a.id)),
    };
  }, [agents, selectedProject?.hiredAgentIds]);

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

  const handleSelectScenario = (scenarioId: ScenarioId) => {
    setSelectedScenarioId(scenarioId);
    const sc = SCENARIOS.find((s) => s.id === scenarioId);
    if (!sc) return;
    setWorkType(sc.workType);

    // Smartly recommend the best matching expert Agent for this scenario
    const hiredSet = new Set(selectedProject?.hiredAgentIds || []);
    const matchInProject = agents.find(
      (a) => hiredSet.has(a.id) && sc.preferredCategories.includes(a.category),
    );
    const matchAny = agents.find((a) => sc.preferredCategories.includes(a.category));
    const recommended = matchInProject || matchAny;
    if (recommended) {
      setSelectedAgentId(recommended.id);
    }
  };

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
        workType,
        prompt: cleaned,
        featureModule: activeScenario.moduleLabel,
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

  const activeWorkTypeLabel =
    WORK_TYPE_OPTIONS.find((w) => w.id === workType)?.label || '功能开发';

  return (
    <div className="h-full w-full overflow-y-auto clean-scroll bg-white">
      <div className="min-h-full max-w-3xl mx-auto px-5 sm:px-8 py-10 sm:py-14 flex flex-col justify-center">
        {/* Clean Hero Brand Mark + Product Slogan */}
        <div className="text-center space-y-3 mb-7">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-slate-900 text-sky-300 shadow-xs mx-auto">
            <Sparkles className="w-5 h-5" />
          </div>
          <h1 className="font-display text-2xl sm:text-[28px] font-extrabold tracking-tight text-slate-900">
            {account ? `${account.name} · 多专家 Agent 网络，协同达成目标` : '多专家 Agent 网络，协同达成目标'}
          </h1>
        </div>

        {/* Scenario Quick-Selectors (Clean rectangular tabs inspired by WorkBuddy) */}
        <div className="flex items-center justify-center flex-wrap gap-1.5 mb-5">
          {SCENARIOS.map((sc) => {
            const active = sc.id === selectedScenarioId;
            return (
              <button
                key={sc.id}
                type="button"
                onClick={() => handleSelectScenario(sc.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-slate-900 border-slate-900 text-white shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {sc.label}
              </button>
            );
          })}
        </div>

        {/* Inline Quick-Create Project Card (when triggered from Project selector or guidance strip) */}
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

        {/* Unified Antigravity + WorkBuddy Command Composer */}
        <div
          ref={dropdownContainerRef}
          className="rounded-2xl border border-slate-200 bg-white shadow-sm focus-within:border-slate-400 focus-within:ring-4 focus-within:ring-slate-900/5 transition-all"
        >
          {/* Top Context Toolbar (Project Picker | Expert Agent Picker | Work Type | Sync Toggle) */}
          <div className="px-3.5 py-2 border-b border-slate-100 bg-slate-50/70 rounded-t-2xl flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              {/* 1. Project Selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenDropdown((cur) => (cur === 'project' ? 'none' : 'project'))
                  }
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer max-w-[210px] ${
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

              <span className="text-slate-300 text-xs select-none" aria-hidden="true">
                /
              </span>

              {/* 2. Expert Agent Selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenDropdown((cur) => (cur === 'agent' ? 'none' : 'agent'))}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer max-w-[230px] ${
                    openDropdown === 'agent'
                      ? 'bg-slate-200/80 text-slate-900'
                      : 'text-slate-700 hover:bg-slate-200/55 hover:text-slate-900'
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
                  <span className="truncate font-semibold text-slate-800">
                    {selectedAgent ? displayEntityName(selectedAgent.handle) : '选择专家 Agent'}
                  </span>
                  {selectedAgent?.runtimeAgent && (
                    <span className="text-[10.5px] font-mono text-slate-400 shrink-0 hidden sm:inline">
                      {selectedAgent.runtimeAgent}
                    </span>
                  )}
                  <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                </button>

                {openDropdown === 'agent' && (
                  <div className="absolute left-0 top-full mt-1.5 w-80 max-w-[85vw] z-40 rounded-xl bg-white border border-slate-200 shadow-xl py-1.5 text-xs">
                    <div className="max-h-64 overflow-y-auto clean-scroll">
                      {projectAgents.length > 0 && (
                        <>
                          <div className="px-3 py-1 text-[10.5px] font-semibold text-slate-400">
                            当前项目已加入专家 ({projectAgents.length})
                          </div>
                          {projectAgents.map((ag) => {
                            const active = ag.id === selectedAgent?.id;
                            return (
                              <button
                                key={ag.id}
                                type="button"
                                onClick={() => {
                                  setSelectedAgentId(ag.id);
                                  setOpenDropdown('none');
                                }}
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
                                onClick={() => {
                                  setSelectedAgentId(ag.id);
                                  setOpenDropdown('none');
                                }}
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

              {/* 3. Work Type Selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenDropdown((cur) => (cur === 'workType' ? 'none' : 'workType'))
                  }
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    openDropdown === 'workType'
                      ? 'bg-slate-200/80 text-slate-900'
                      : 'text-slate-600 hover:bg-slate-200/55 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{activeWorkTypeLabel}</span>
                  <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                </button>

                {openDropdown === 'workType' && (
                  <div className="absolute left-0 top-full mt-1.5 w-40 z-40 rounded-xl bg-white border border-slate-200 shadow-xl py-1 text-xs">
                    {WORK_TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setWorkType(opt.id);
                          setOpenDropdown('none');
                        }}
                        className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center justify-between gap-2 text-left cursor-pointer"
                      >
                        <span
                          className={
                            workType === opt.id
                              ? 'font-bold text-slate-900'
                              : 'font-medium text-slate-700'
                          }
                        >
                          {opt.label}
                        </span>
                        {workType === opt.id && (
                          <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
                  selectedAgent ? displayEntityName(selectedAgent.handle) : '专家 Agent'
                } 描述任务目标或问题…`}
                className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none resize-none leading-relaxed"
              />
            </div>

            {/* Bottom Composer Bar (Runtime/Model Readout + Launch CTA) */}
            <div className="px-3.5 py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 text-[11.5px] text-slate-500">
                {selectedAgent && (
                  <button
                    type="button"
                    onClick={() => setOpenDropdown((cur) => (cur === 'agent' ? 'none' : 'agent'))}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer truncate"
                  >
                    <span className="font-semibold text-slate-800">
                      {selectedAgent.runtimeAgent}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400 truncate">
                      {formatShortModel(selectedAgent.defaultModel)}
                    </span>
                    <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                  </button>
                )}
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

        {/* Minimal Creation Guidance Links */}
        <div className="mt-6 flex items-center justify-center flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
          <button
            type="button"
            onClick={() => setShowInlineCreateProject(true)}
            className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5 text-blue-600" />
            <span>创建新项目</span>
          </button>
          <button
            type="button"
            onClick={onJumpToMountPrivate}
            className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <Bot className="w-3.5 h-3.5 text-slate-700" />
            <span>新建 Agent</span>
          </button>
          <button
            type="button"
            onClick={onJumpToMarket}
            className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5 text-emerald-600" />
            <span>招募专家</span>
          </button>
        </div>
      </div>
    </div>
  );
}
