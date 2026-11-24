import { useState, type FormEvent } from 'react';
import {
  Check,
  Cloud,
  Copy,
  Cpu,
  Database,
  HardDrive,
  KeyRound,
  Laptop,
  Layers,
  Minus,
  Monitor,
  PauseCircle,
  PlayCircle,
  Plus,
  Server,
  Terminal,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import type {
  CliAuthMode,
  CliToolType,
  ComputeNode,
  ExpertAgent,
  NodeCliEntry,
  NodeOsType,
  StorageVolume,
} from '../../types/agentnexus';
import { getRuntimePreset } from '../shared/EntityIdentity';

export type NodeDrawerMode = 'private' | 'cloud' | null;

const OS_META: Record<
  NodeOsType,
  { label: string; short: string; defaultVersion: string; icon: typeof Laptop; cls: string }
> = {
  linux: {
    label: 'Linux',
    short: 'Linux',
    defaultVersion: 'Ubuntu 24.04 LTS',
    icon: Server,
    cls: 'text-indigo-700',
  },
  macos: {
    label: 'macOS',
    short: 'macOS',
    defaultVersion: 'macOS Sequoia 15.2',
    icon: Laptop,
    cls: 'text-slate-800',
  },
  win11: {
    label: 'Windows 11',
    short: 'Win11',
    defaultVersion: 'Windows 11 Pro 24H2',
    icon: Monitor,
    cls: 'text-blue-700',
  },
};

export const CLI_TOOL_PRESETS: {
  id: CliToolType;
  label: string;
  runtimeAgent: string;
  defaultModel: string;
  cliCmd: string;
  defaultCredPlaceholder: string;
}[] = [
  {
    id: 'claude_code',
    label: 'Claude Code (CC)',
    runtimeAgent: 'Claude Code',
    defaultModel: 'Claude 4.5 Sonnet',
    cliCmd: 'claude --headless',
    defaultCredPlaceholder: 'Anthropic 账号或 API Key 标签（如 sk-ant-••••8f2a）',
  },
  {
    id: 'antigravity',
    label: 'Antigravity CLI',
    runtimeAgent: 'Antigravity',
    defaultModel: 'Gemini 3.1 Pro',
    cliCmd: 'antigravity-cli serve',
    defaultCredPlaceholder: 'Antigravity OAuth 账号或 Key 标签',
  },
  {
    id: 'codex',
    label: 'Codex CLI',
    runtimeAgent: 'Codex',
    defaultModel: 'GPT-5.4-Codex',
    cliCmd: 'codex --full-auto',
    defaultCredPlaceholder: 'OpenAI 账号或 API Key 标签（如 sk-proj-••••3c91）',
  },
  {
    id: 'gemini_cli',
    label: 'Gemini CLI',
    runtimeAgent: 'Gemini CLI',
    defaultModel: 'Gemini 3.1 Pro',
    cliCmd: 'gemini --yolo',
    defaultCredPlaceholder: 'Google 账号或凭证标签',
  },
  {
    id: 'qoder',
    label: 'Qoder CLI',
    runtimeAgent: 'Qoder',
    defaultModel: 'Qwen3-Coder-Max',
    cliCmd: 'qoder-cli daemon',
    defaultCredPlaceholder: 'Qoder 账号或凭证标签',
  },
];

interface CloudNodePlan {
  id: string;
  os: NodeOsType;
  osVersion: string;
  label: string;
  tagline: string;
  cpuCores: number;
  memoryGb: number;
  gpuSpec?: string;
  storageQuotaGb: number;
  monthlyCostUsd: number;
}

const CLOUD_NODE_PLANS: CloudNodePlan[] = [
  {
    id: 'linux_std',
    os: 'linux',
    osVersion: 'Ubuntu 24.04 LTS (Cloud)',
    label: 'Linux 高效研发节点',
    tagline: '适合多路 Claude Code / Codex CLI 并发编码与构建',
    cpuCores: 8,
    memoryGb: 32,
    storageQuotaGb: 256,
    monthlyCostUsd: 39,
  },
  {
    id: 'win11_pro',
    os: 'win11',
    osVersion: 'Windows 11 Pro 24H2',
    label: 'Win11 桌面自动化节点',
    tagline: '适合 Windows 客户端构建、办公软件与浏览器自动化',
    cpuCores: 8,
    memoryGb: 32,
    storageQuotaGb: 256,
    monthlyCostUsd: 49,
  },
  {
    id: 'macos_m3',
    os: 'macos',
    osVersion: 'macOS Sequoia 15.2 (M3 Pro)',
    label: 'macOS 专属编译云主机',
    tagline: '适合 iOS / macOS 原生构建与 Antigravity / CC 并发开发',
    cpuCores: 12,
    memoryGb: 36,
    storageQuotaGb: 512,
    monthlyCostUsd: 89,
  },
  {
    id: 'linux_gpu',
    os: 'linux',
    osVersion: 'Ubuntu 24.04 LTS · CUDA 12.6',
    label: 'Linux 高配 GPU 节点',
    tagline: '支持 8+ 路 CLI 并发与本地多模态/仿真推理任务',
    cpuCores: 16,
    memoryGb: 64,
    gpuSpec: 'NVIDIA L40S 48GB',
    storageQuotaGb: 500,
    monthlyCostUsd: 119,
  },
];

interface SpaceNodesPanelProps {
  nodes: ComputeNode[];
  agents: ExpertAgent[];
  storageVolumes: StorageVolume[];
  searchKeyword: string;
  osFilter: 'all' | NodeOsType;
  originFilter: 'all' | 'private' | 'cloud';
  drawerMode: NodeDrawerMode;
  onChangeDrawerMode: (mode: NodeDrawerMode) => void;
  onMountPrivateNode: (input: {
    name: string;
    os: NodeOsType;
    osVersion: string;
    region: string;
    cpuCores: number;
    memoryGb: number;
    storageQuotaGb: number;
    description: string;
  }) => string;
  onProvisionCloudNode: (input: {
    name: string;
    os: NodeOsType;
    osVersion: string;
    region: string;
    cpuCores: number;
    memoryGb: number;
    gpuSpec?: string;
    storageQuotaGb: number;
    monthlyCostUsd: number;
    description: string;
  }) => string;
  onToggleNodeStatus: (nodeId: string) => void;
  onRemoveNode: (nodeId: string) => void;
  onAddNodeCli: (
    nodeId: string,
    input: {
      cliTool: CliToolType;
      runtimeAgent: string;
      defaultModel: string;
      authMode: CliAuthMode;
      credentialLabel: string;
      concurrency: number;
    },
  ) => string;
  onUpdateNodeCli: (
    nodeId: string,
    cliId: string,
    patch: Partial<Omit<NodeCliEntry, 'id'>>,
  ) => void;
  onRemoveNodeCli: (nodeId: string, cliId: string) => void;
  onToggleNodeStorageMount: (nodeId: string, volumeId: string) => void;
  onJumpToStorage: () => void;
  onJumpToAgents: () => void;
}

export function SpaceNodesPanel({
  nodes,
  agents,
  storageVolumes,
  searchKeyword,
  osFilter,
  originFilter,
  drawerMode,
  onChangeDrawerMode,
  onMountPrivateNode,
  onProvisionCloudNode,
  onToggleNodeStatus,
  onRemoveNode,
  onAddNodeCli,
  onUpdateNodeCli,
  onRemoveNodeCli,
  onToggleNodeStorageMount,
  onJumpToStorage,
  onJumpToAgents,
}: SpaceNodesPanelProps) {
  // Mount Private Device form state
  const [privOs, setPrivOs] = useState<NodeOsType>('macos');
  const [privName, setPrivName] = useState('');
  const [privRegion, setPrivRegion] = useState('自有设备 · 本地网络');
  const [privCpu, setPrivCpu] = useState(12);
  const [privMem, setPrivMem] = useState(32);
  const [privDisk, setPrivDisk] = useState(512);
  const [privDesc, setPrivDesc] = useState('');
  const [copiedCmd, setCopiedCmd] = useState(false);

  // Rent Cloud Node form state
  const [cloudPlanId, setCloudPlanId] = useState<string>('linux_std');
  const [cloudName, setCloudName] = useState('');
  const [cloudRegion, setCloudRegion] = useState('华东-上海云区');
  const [cloudDesc, setCloudDesc] = useState('');

  // Inline CLI Auth Editor state (keyed by `${nodeId}:${cliId}`)
  const [editingAuthKey, setEditingAuthKey] = useState<string | null>(null);
  const [editAuthMode, setEditAuthMode] = useState<CliAuthMode>('account_oauth');
  const [editCredLabel, setEditCredLabel] = useState('');

  // Add CLI Drawer state (inline right from any node card)
  const [cliDrawerNodeId, setCliDrawerNodeId] = useState<string | null>(null);
  const [cliTool, setCliTool] = useState<CliToolType>('claude_code');
  const [cliDefaultModel, setCliDefaultModel] = useState<string>('Claude 4.5 Sonnet');
  const [cliAuthMode, setCliAuthMode] = useState<CliAuthMode>('api_key');
  const [cliCredLabel, setCliCredLabel] = useState('');
  const [cliConcurrency, setCliConcurrency] = useState<number>(4);

  const selectedCliPreset =
    CLI_TOOL_PRESETS.find((c) => c.id === cliTool) || CLI_TOOL_PRESETS[0];
  const runtimePreset = getRuntimePreset(selectedCliPreset.runtimeAgent);
  const cliDrawerNode = cliDrawerNodeId
    ? nodes.find((n) => n.id === cliDrawerNodeId) || null
    : null;

  const q = searchKeyword.trim().toLowerCase();
  const filteredNodes = nodes.filter((n) => {
    if (osFilter !== 'all' && n.os !== osFilter) return false;
    if (originFilter !== 'all' && n.origin !== originFilter) return false;
    if (!q) return true;
    const cliMatch = n.installedClis.some((cli) => {
      const preset = CLI_TOOL_PRESETS.find((p) => p.id === cli.cliTool);
      return (
        cli.runtimeAgent.toLowerCase().includes(q) ||
        (preset?.label || '').toLowerCase().includes(q) ||
        cli.defaultModel.toLowerCase().includes(q) ||
        cli.credentialLabel.toLowerCase().includes(q)
      );
    });
    return (
      cliMatch ||
      n.name.toLowerCase().includes(q) ||
      n.osVersion.toLowerCase().includes(q) ||
      n.region.toLowerCase().includes(q) ||
      n.description.toLowerCase().includes(q)
    );
  });

  const onlineCount = nodes.filter((n) => n.status === 'online').length;
  const totalCpu = nodes.reduce((s, n) => s + n.cpuCores, 0);
  const totalMem = nodes.reduce((s, n) => s + n.memoryGb, 0);
  const monthlyCloudCost = nodes.reduce((s, n) => s + n.monthlyCostUsd, 0);
  const totalConcurrency = nodes.reduce(
    (sum, n) =>
      sum +
      n.installedClis.filter((c) => c.enabled).reduce((s, c) => s + c.concurrency, 0),
    0,
  );
  const boundAgentCount = agents.filter((a) => Boolean(a.hostNodeId && a.hostCliId)).length;

  const selectedPlan =
    CLOUD_NODE_PLANS.find((p) => p.id === cloudPlanId) || CLOUD_NODE_PLANS[0];

  const cliJoinCommand =
    privOs === 'win11'
      ? `irm https://get.agentnexus.io/node.ps1 | iex; anx-node join --os=win11 --name="${
          privName.trim() || 'my-win11-pc'
        }"`
      : `curl -fsSL https://get.agentnexus.io/node.sh | sh -s -- --os=${privOs} --name="${
          privName.trim() || `my-${privOs}-node`
        }"`;

  const handleCopyCli = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(cliJoinCommand).catch(() => {});
    }
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 1800);
  };

  const handlePrivateSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!privName.trim()) return;
    onMountPrivateNode({
      name: privName,
      os: privOs,
      osVersion: OS_META[privOs].defaultVersion,
      region: privRegion,
      cpuCores: privCpu,
      memoryGb: privMem,
      storageQuotaGb: privDisk,
      description: privDesc,
    });
    setPrivName('');
    setPrivDesc('');
    onChangeDrawerMode(null);
  };

  const handleCloudSubmit = (e: FormEvent) => {
    e.preventDefault();
    const effectiveName = cloudName.trim() || `${selectedPlan.label} · ${cloudRegion}`;
    onProvisionCloudNode({
      name: effectiveName,
      os: selectedPlan.os,
      osVersion: selectedPlan.osVersion,
      region: cloudRegion,
      cpuCores: selectedPlan.cpuCores,
      memoryGb: selectedPlan.memoryGb,
      gpuSpec: selectedPlan.gpuSpec,
      storageQuotaGb: selectedPlan.storageQuotaGb,
      monthlyCostUsd: selectedPlan.monthlyCostUsd,
      description: cloudDesc || selectedPlan.tagline,
    });
    setCloudName('');
    setCloudDesc('');
    onChangeDrawerMode(null);
  };

  const openInlineAuthEditor = (nodeId: string, cli: NodeCliEntry) => {
    setEditingAuthKey(`${nodeId}:${cli.id}`);
    setEditAuthMode(cli.authMode);
    setEditCredLabel(cli.credentialLabel);
  };

  const saveInlineAuth = (nodeId: string, cliId: string) => {
    onUpdateNodeCli(nodeId, cliId, {
      authMode: editAuthMode,
      credentialLabel:
        editCredLabel.trim() ||
        (editAuthMode === 'account_oauth' ? 'ronnie.shi@workspace.io' : 'sk-cli-••••••9f2a'),
      authStatus: 'connected',
    });
    setEditingAuthKey(null);
  };

  const handleAddCliSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!cliDrawerNodeId) return;
    onAddNodeCli(cliDrawerNodeId, {
      cliTool,
      runtimeAgent: selectedCliPreset.runtimeAgent,
      defaultModel: cliDefaultModel,
      authMode: cliAuthMode,
      credentialLabel: cliCredLabel,
      concurrency: cliConcurrency,
    });
    setCliCredLabel('');
    setCliDrawerNodeId(null);
  };

  return (
    <div className="space-y-5">
      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 @[760px]:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium">在线 Agent 节点</span>
            <Server className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {onlineCount}/{nodes.length}
            </span>
            <span className="text-xs font-semibold text-emerald-700">运行中</span>
          </div>
          <div className="text-[11px] text-slate-500">
            Linux {nodes.filter((n) => n.os === 'linux').length} · macOS{' '}
            {nodes.filter((n) => n.os === 'macos').length} · Win11{' '}
            {nodes.filter((n) => n.os === 'win11').length}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium">总算力资源</span>
            <Cpu className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {totalCpu}C
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-600">
              {totalMem} GB RAM
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            自有挂载 {nodes.filter((n) => n.origin === 'private').length} · 云端租用{' '}
            {nodes.filter((n) => n.origin === 'cloud').length}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium">并发沙箱总配额</span>
            <Terminal className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {totalConcurrency}
            </span>
            <span className="text-xs text-slate-500">个沙箱上限</span>
          </div>
          <div className="text-[11px] text-slate-500">
            已绑定 {boundAgentCount} 位自建专业 Agent · 自动隔离
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium">云端节点月租</span>
            <Cloud className="w-4 h-4 text-sky-600" />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              ${monthlyCloudCost}
            </span>
            <span className="text-xs text-slate-500">/ 月</span>
          </div>
          <div className="text-[11px] text-slate-500">挂载自有 Win11/Linux/Mac 零月租</div>
        </div>
      </div>

      {/* Unified Node Cards: Hardware + Shared Storage Mount + Direct CLI & Concurrency Config */}
      {filteredNodes.length === 0 ? (
        <div className="py-14 text-center rounded-xl border border-dashed border-slate-300 bg-white space-y-3">
          <p className="text-sm font-medium text-slate-700">当前筛选下暂无 Agent 节点</p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => onChangeDrawerMode('private')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>挂载自有设备</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeDrawerMode('cloud')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>租用云端节点</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredNodes.map((node) => {
            const osMeta = OS_META[node.os];
            const OsIcon = osMeta.icon;
            const enabledClis = node.installedClis.filter((c) => c.enabled);
            const nodeConcurrency = enabledClis.reduce((s, c) => s + c.concurrency, 0);
            const nodeBoundAgents = agents.filter((a) => a.hostNodeId === node.id);
            const diskPct = Math.min(
              100,
              Math.round((node.storageUsedGb / Math.max(1, node.storageQuotaGb)) * 100),
            );
            const isOnline = node.status === 'online';

            return (
              <section
                key={node.id}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-slate-300 transition-colors"
              >
                {/* 1. Node Header & Hardware Spec */}
                <div className="p-4 bg-slate-50/70 border-b border-slate-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                        <OsIcon className={`w-4 h-4 ${osMeta.cls}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <h3 className="text-sm font-bold text-slate-900 truncate">
                            {node.name}
                          </h3>
                          <span className={`text-xs font-bold ${osMeta.cls}`}>{osMeta.short}</span>
                          <span className="text-slate-300" aria-hidden="true">·</span>
                          <span
                            className={`text-[11px] font-semibold ${
                              node.origin === 'cloud' ? 'text-blue-700' : 'text-slate-600'
                            }`}
                          >
                            {node.origin === 'cloud'
                              ? `云端租用 $${node.monthlyCostUsd}/月`
                              : '自有设备挂载'}
                          </span>
                          <span className="text-slate-300" aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                              }`}
                            />
                            <span className={isOnline ? 'text-emerald-700' : 'text-slate-500'}>
                              {isOnline ? '在线' : '休眠'}
                            </span>
                          </span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                          <span>{node.osVersion}</span>
                          <span className="text-slate-300" aria-hidden="true">·</span>
                          <span>{node.region}</span>
                          <span className="text-slate-300" aria-hidden="true">·</span>
                          <span className="font-mono text-slate-600">
                            {node.cpuCores} vCPU / {node.memoryGb} GB RAM
                            {node.gpuSpec ? ` / ${node.gpuSpec}` : ''}
                          </span>
                          <span className="text-slate-300" aria-hidden="true">·</span>
                          <span className="font-mono text-slate-600">
                            本地盘 {node.storageUsedGb}/{node.storageQuotaGb} GB ({diskPct}%)
                          </span>
                          <span className="text-slate-300" aria-hidden="true">·</span>
                          <span className="font-mono font-semibold text-blue-700">
                            沙箱 {nodeBoundAgents.length}/{nodeConcurrency}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setCliDrawerNodeId(node.id)}
                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-white cursor-pointer whitespace-nowrap"
                      >
                        <Plus className="w-3 h-3" />
                        <span>添加 CLI</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleNodeStatus(node.id)}
                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
                      >
                        {isOnline ? (
                          <>
                            <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
                            <span>休眠</span>
                          </>
                        ) : (
                          <>
                            <PlayCircle className="w-3.5 h-3.5 text-emerald-600" />
                            <span>上线</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveNode(node.id)}
                        title={node.origin === 'cloud' ? '退租节点' : '解除挂载'}
                        className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-medium text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer whitespace-nowrap"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{node.origin === 'cloud' ? '退租' : '解绑'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Endpoint & Mounted Shared Storage Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 shrink-0">
                        <Database className="w-3.5 h-3.5 text-indigo-600" />
                        <span>挂载共享存储：</span>
                      </span>
                      {storageVolumes.length === 0 ? (
                        <button
                          type="button"
                          onClick={onJumpToStorage}
                          className="text-[11px] text-blue-700 hover:underline cursor-pointer"
                        >
                          暂无 Agent 存储，去购买/租用 →
                        </button>
                      ) : (
                        storageVolumes.map((vol) => {
                          const mounted = node.mountedStorageIds.includes(vol.id);
                          return (
                            <button
                              key={vol.id}
                              type="button"
                              onClick={() => onToggleNodeStorageMount(node.id, vol.id)}
                              title={
                                mounted
                                  ? '点击从该节点卸载此共享存储'
                                  : '点击挂载此共享存储到该节点'
                              }
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-medium transition-colors cursor-pointer ${
                                mounted
                                  ? 'bg-indigo-50/90 border-indigo-200 text-indigo-800'
                                  : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                              }`}
                            >
                              <span
                                className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                                  mounted
                                    ? 'bg-indigo-600 border-indigo-600 text-white'
                                    : 'bg-white border-slate-300'
                                }`}
                              >
                                {mounted && <Check className="w-2.5 h-2.5" />}
                              </span>
                              <span className="truncate max-w-[160px]">{vol.name}</span>
                              <span className="font-mono text-[10px] opacity-75">
                                {vol.quotaGb}GB
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] shrink-0">
                      <span className="hidden md:inline font-mono text-slate-400">
                        {node.endpoint}
                      </span>
                      <button
                        type="button"
                        onClick={onJumpToStorage}
                        className="font-medium text-slate-500 hover:text-blue-700 cursor-pointer whitespace-nowrap"
                      >
                        管理 Agent 存储 →
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. Inline Agent CLI, Auth & Concurrency Sandbox Configuration */}
                {node.installedClis.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-slate-400 space-y-2">
                    <p>
                      该节点暂未配置 Agent CLI，点击右上角「添加 CLI」安装 Claude Code / Antigravity / Codex 并设置并发沙箱数。
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {node.installedClis.map((cli) => {
                      const preset =
                        CLI_TOOL_PRESETS.find((p) => p.id === cli.cliTool) || CLI_TOOL_PRESETS[0];
                      const rtPreset = getRuntimePreset(cli.runtimeAgent);
                      const authKey = `${node.id}:${cli.id}`;
                      const isEditingAuth = editingAuthKey === authKey;
                      const boundAgents = agents.filter(
                        (a) => a.hostNodeId === node.id && a.hostCliId === cli.id,
                      );
                      const minConcurrency = Math.max(1, boundAgents.length);
                      const atFloor = cli.concurrency <= minConcurrency;
                      const isFull = boundAgents.length >= cli.concurrency;
                      const remainingSlots = Math.max(0, cli.concurrency - boundAgents.length);

                      return (
                        <div
                          key={cli.id}
                          className={`p-4 space-y-3 transition-colors ${
                            cli.enabled ? 'hover:bg-slate-50/40' : 'bg-slate-50/50 opacity-75'
                          }`}
                        >
                          {/* CLI Row 1: Identity + Default Model + Enable/Delete */}
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                              <span className="w-6 h-6 rounded-md bg-slate-900 text-white inline-flex items-center justify-center shrink-0">
                                <Terminal className="w-3 h-3" />
                              </span>
                              <span className="text-xs font-bold text-slate-900">
                                {preset.label}
                              </span>
                              <span className="font-mono text-[11px] text-slate-500">
                                {cli.cliVersion}
                              </span>
                              <span className="text-slate-300" aria-hidden="true">·</span>
                              <span
                                className={`text-[11px] font-semibold ${
                                  cli.enabled ? 'text-emerald-700' : 'text-slate-500'
                                }`}
                              >
                                {cli.enabled ? '已启用' : '已暂停'}
                              </span>
                              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                                ·
                              </span>
                              <code className="hidden sm:inline text-[11px] font-mono text-slate-400">
                                $ {preset.cliCmd}
                              </code>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              <select
                                value={cli.defaultModel}
                                onChange={(e) =>
                                  onUpdateNodeCli(node.id, cli.id, {
                                    defaultModel: e.target.value,
                                  })
                                }
                                aria-label={`${preset.label} 默认模型`}
                                className="h-7 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-mono text-slate-800 focus:outline-none"
                              >
                                {Array.from(
                                  new Set([...rtPreset.models, cli.defaultModel]),
                                ).map((m) => (
                                  <option key={m} value={m}>
                                    模型：{m}
                                  </option>
                                ))}
                              </select>

                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateNodeCli(node.id, cli.id, { enabled: !cli.enabled })
                                }
                                className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-medium text-slate-700 cursor-pointer"
                              >
                                {cli.enabled ? (
                                  <>
                                    <PauseCircle className="w-3 h-3 text-amber-600" />
                                    <span>暂停</span>
                                  </>
                                ) : (
                                  <>
                                    <PlayCircle className="w-3 h-3 text-emerald-600" />
                                    <span>启用</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => onRemoveNodeCli(node.id, cli.id)}
                                title="从此节点卸载该 Agent CLI"
                                className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-medium text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>删除</span>
                              </button>
                            </div>
                          </div>

                          {/* CLI Row 2: Account/Key | Concurrency Sandbox Stepper | Bound Professional Agents */}
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
                            {/* Account / API Key */}
                            <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-2.5 space-y-1.5">
                              <div className="flex items-center justify-between gap-2 text-[11px]">
                                <span className="inline-flex items-center gap-1 font-semibold text-slate-600">
                                  {cli.authMode === 'account_oauth' ? (
                                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                                  )}
                                  <span>
                                    {cli.authMode === 'account_oauth'
                                      ? 'CLI 账号登录'
                                      : 'API Key 凭证'}
                                  </span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    isEditingAuth
                                      ? setEditingAuthKey(null)
                                      : openInlineAuthEditor(node.id, cli)
                                  }
                                  className="text-blue-700 hover:text-blue-900 font-semibold cursor-pointer"
                                >
                                  {isEditingAuth ? '取消' : '编辑账号/Key'}
                                </button>
                              </div>

                              {isEditingAuth ? (
                                <div className="space-y-1.5 pt-1">
                                  <div className="grid grid-cols-2 gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setEditAuthMode('account_oauth')}
                                      className={`py-1 rounded text-[10px] font-semibold cursor-pointer ${
                                        editAuthMode === 'account_oauth'
                                          ? 'bg-slate-900 text-white'
                                          : 'bg-white border border-slate-200 text-slate-600'
                                      }`}
                                    >
                                      账号 OAuth
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditAuthMode('api_key')}
                                      className={`py-1 rounded text-[10px] font-semibold cursor-pointer ${
                                        editAuthMode === 'api_key'
                                          ? 'bg-slate-900 text-white'
                                          : 'bg-white border border-slate-200 text-slate-600'
                                      }`}
                                    >
                                      API Key
                                    </button>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="text"
                                      value={editCredLabel}
                                      onChange={(e) => setEditCredLabel(e.target.value)}
                                      placeholder={
                                        editAuthMode === 'account_oauth'
                                          ? '输入账号邮箱...'
                                          : '输入 Key 标签如 sk-ant-••••'
                                      }
                                      className="flex-1 min-w-0 h-7 rounded border border-slate-200 bg-white px-2 text-[11px] font-mono text-slate-800 focus:outline-none"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => saveInlineAuth(node.id, cli.id)}
                                      className="h-7 px-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold cursor-pointer shrink-0"
                                    >
                                      <Check className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between gap-2 text-xs">
                                  <span className="font-mono text-[11px] text-slate-800 truncate">
                                    {cli.credentialLabel}
                                  </span>
                                  <span className="text-[10px] font-semibold text-emerald-700 shrink-0">
                                    已授权
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Concurrency Sandbox Stepper */}
                            <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-2.5 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                                  <span>并发沙箱数</span>
                                </div>
                                <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                                  最多可配置 {cli.concurrency} 位专业 Agent
                                </div>
                              </div>
                              <div className="inline-flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  disabled={atFloor}
                                  title={
                                    boundAgents.length > 0 && cli.concurrency <= boundAgents.length
                                      ? `已绑定 ${boundAgents.length} 位专业 Agent，无法低于当前已用沙箱数`
                                      : '减少并发沙箱数'
                                  }
                                  onClick={() =>
                                    onUpdateNodeCli(node.id, cli.id, {
                                      concurrency: Math.max(minConcurrency, cli.concurrency - 1),
                                    })
                                  }
                                  aria-label="减少并发沙箱数"
                                  className="w-6 h-6 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-slate-700 cursor-pointer"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="min-w-[50px] text-center font-mono tabular-nums text-xs font-bold text-slate-900">
                                  {cli.concurrency} 沙箱
                                </span>
                                <button
                                  type="button"
                                  disabled={cli.concurrency >= 16}
                                  onClick={() =>
                                    onUpdateNodeCli(node.id, cli.id, {
                                      concurrency: Math.min(16, cli.concurrency + 1),
                                    })
                                  }
                                  aria-label="增加并发沙箱数"
                                  className="w-6 h-6 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 flex items-center justify-center text-slate-700 cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            {/* Bound Professional Agents */}
                            <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-2.5 flex flex-col justify-between gap-1">
                              <div className="flex items-center justify-between gap-2 text-[11px]">
                                <span className="inline-flex items-center gap-1 font-semibold text-slate-600 min-w-0">
                                  <Users className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                  <span className="truncate">
                                    已绑定 Agent ({boundAgents.length}/{cli.concurrency})
                                  </span>
                                </span>
                                <span
                                  className={`text-[10px] font-semibold shrink-0 ${
                                    isFull ? 'text-amber-700' : 'text-emerald-700'
                                  }`}
                                >
                                  {isFull ? '沙箱已满' : `余 ${remainingSlots} 席位`}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2 text-[11px]">
                                <div className="min-w-0 truncate">
                                  {boundAgents.length > 0 ? (
                                    <span className="font-semibold text-slate-800">
                                      {boundAgents.map((a) => a.handle).join('、')}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">
                                      就绪待用 · 可在「Agent 成员」选用
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={onJumpToAgents}
                                  className="text-blue-700 hover:underline font-medium cursor-pointer whitespace-nowrap shrink-0"
                                >
                                  Agent 成员 →
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Slide-in Drawer A: Mount Private Device OR Rent Cloud Node */}
      {drawerMode && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-slate-900/30"
            onClick={() => onChangeDrawerMode(null)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-lg bg-white h-full border-l border-slate-200 shadow-xl flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  {drawerMode === 'private' ? '挂载自有设备节点' : '直接租用云端节点'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {drawerMode === 'private'
                    ? '支持将自己的 Windows 11、Linux 或 macOS 电脑挂载为个人 Agent 节点，零月租费用。'
                    : '即开即用的 Win11 / Linux / macOS 云主机，24/7 在线承载多路 CLI Agent。'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onChangeDrawerMode(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 pt-3 pb-2 border-b border-slate-100 shrink-0">
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => onChangeDrawerMode('private')}
                  className={`py-1.5 text-xs font-semibold rounded-md cursor-pointer transition-colors ${
                    drawerMode === 'private'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  挂载自有设备（免费）
                </button>
                <button
                  type="button"
                  onClick={() => onChangeDrawerMode('cloud')}
                  className={`py-1.5 text-xs font-semibold rounded-md cursor-pointer transition-colors ${
                    drawerMode === 'cloud'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  租用云端节点（按月）
                </button>
              </div>
            </div>

            {drawerMode === 'private' ? (
              <form
                onSubmit={handlePrivateSubmit}
                className="flex-1 overflow-y-auto clean-scroll p-5 space-y-4"
              >
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">设备操作系统</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['win11', 'linux', 'macos'] as NodeOsType[]).map((osKey) => {
                      const m = OS_META[osKey];
                      const Icon = m.icon;
                      const active = privOs === osKey;
                      return (
                        <button
                          key={osKey}
                          type="button"
                          onClick={() => setPrivOs(osKey)}
                          className={`p-2.5 rounded-lg border text-xs font-semibold flex flex-col items-center gap-1.5 cursor-pointer transition-colors ${
                            active
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">节点名称 *</label>
                    <input
                      type="text"
                      required
                      value={privName}
                      onChange={(e) => setPrivName(e.target.value)}
                      placeholder={`例如：我的 ${OS_META[privOs].short} 开发机`}
                      className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">位置 / 备注网络</label>
                    <input
                      type="text"
                      value={privRegion}
                      onChange={(e) => setPrivRegion(e.target.value)}
                      placeholder="自有设备 · 办公室"
                      className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">CPU 核数</label>
                    <input
                      type="number"
                      min={2}
                      max={128}
                      value={privCpu}
                      onChange={(e) => setPrivCpu(Number(e.target.value))}
                      className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">内存 (GB)</label>
                    <input
                      type="number"
                      min={4}
                      max={512}
                      value={privMem}
                      onChange={(e) => setPrivMem(Number(e.target.value))}
                      className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">可用磁盘 (GB)</label>
                    <input
                      type="number"
                      min={50}
                      max={4000}
                      value={privDisk}
                      onChange={(e) => setPrivDisk(Number(e.target.value))}
                      className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">用途说明（可选）</label>
                  <input
                    type="text"
                    value={privDesc}
                    onChange={(e) => setPrivDesc(e.target.value)}
                    placeholder="例如：运行 Claude Code / Antigravity CLI 做日常前端和全栈交付"
                    className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="rounded-lg bg-slate-900 text-slate-100 p-3 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-slate-200">
                      <Terminal className="w-3.5 h-3.5 text-sky-400" />
                      <span>在目标 {OS_META[privOs].label} 设备终端运行挂载命令</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyCli}
                      className="inline-flex items-center gap-1 text-sky-300 hover:text-white cursor-pointer"
                    >
                      {copiedCmd ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedCmd ? '已复制' : '复制'}</span>
                    </button>
                  </div>
                  <code className="block font-mono text-[11px] text-sky-200 break-all leading-relaxed">
                    {cliJoinCommand}
                  </code>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => onChangeDrawerMode(null)}
                    className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
                  >
                    确认挂载并上线
                  </button>
                </div>
              </form>
            ) : (
              <form
                onSubmit={handleCloudSubmit}
                className="flex-1 overflow-y-auto clean-scroll p-5 space-y-4"
              >
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700">
                    选择云端节点（Win11 / Linux / macOS）
                  </label>
                  <div className="space-y-2">
                    {CLOUD_NODE_PLANS.map((plan) => {
                      const active = cloudPlanId === plan.id;
                      const om = OS_META[plan.os];
                      return (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => setCloudPlanId(plan.id)}
                          className={`w-full text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                            active
                              ? 'border-blue-600 bg-blue-50/50'
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">
                                {plan.label}
                              </span>
                              <span className={`text-[11px] font-bold ${om.cls}`}>
                                {om.short}
                              </span>
                            </div>
                            <span className="text-sm font-bold font-mono tabular-nums text-blue-700">
                              ${plan.monthlyCostUsd}/月
                            </span>
                          </div>
                          <div className="mt-1 text-[11px] font-mono tabular-nums text-slate-700">
                            {plan.cpuCores} vCPU · {plan.memoryGb} GB RAM · {plan.storageQuotaGb} GB
                            NVMe
                            {plan.gpuSpec ? ` · ${plan.gpuSpec}` : ''}
                          </div>
                          <p className="mt-1 text-[11px] text-slate-500">{plan.tagline}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">自定义节点名称</label>
                    <input
                      type="text"
                      value={cloudName}
                      onChange={(e) => setCloudName(e.target.value)}
                      placeholder={`${selectedPlan.label} · ${cloudRegion}`}
                      className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">部署地域</label>
                    <select
                      value={cloudRegion}
                      onChange={(e) => setCloudRegion(e.target.value)}
                      className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none"
                    >
                      <option value="华东-上海云区">华东-上海云区</option>
                      <option value="华北-北京云区">华北-北京云区</option>
                      <option value="亚太-新加坡云区">亚太-新加坡云区</option>
                      <option value="美西-硅谷云区">美西-硅谷云区</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">备注说明（可选）</label>
                  <input
                    type="text"
                    value={cloudDesc}
                    onChange={(e) => setCloudDesc(e.target.value)}
                    placeholder="例如：专门用于 4 路 Claude Code 并发执行主力项目"
                    className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5 text-slate-600">
                    <HardDrive className="w-3.5 h-3.5 text-slate-500" />
                    <span>{selectedPlan.osVersion} · 随时可退租</span>
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    ${selectedPlan.monthlyCostUsd}/月
                  </span>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => onChangeDrawerMode(null)}
                    className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white cursor-pointer"
                  >
                    立即租用上线
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Slide-in Drawer B: Add Agent CLI directly to a Node */}
      {cliDrawerNode && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-slate-900/30"
            onClick={() => setCliDrawerNodeId(null)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-lg bg-white h-full border-l border-slate-200 shadow-xl flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-blue-600" />
                  <span>为节点添加 Agent CLI</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  目标节点：<strong className="text-slate-800">{cliDrawerNode.name}</strong> · 配置支持的 CLI、认证凭证与并发沙箱数。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCliDrawerNodeId(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleAddCliSubmit}
              className="flex-1 overflow-y-auto clean-scroll p-5 space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">选择要安装的 Agent CLI</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CLI_TOOL_PRESETS.map((preset) => {
                    const active = cliTool === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setCliTool(preset.id);
                          setCliDefaultModel(preset.defaultModel);
                        }}
                        className={`p-2.5 rounded-lg border text-left cursor-pointer transition-colors ${
                          active
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-xs font-bold truncate">{preset.label}</div>
                        <div className="text-[10px] font-mono opacity-75 truncate mt-0.5">
                          $ {preset.cliCmd}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">默认模型</label>
                  <select
                    value={cliDefaultModel}
                    onChange={(e) => setCliDefaultModel(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none"
                  >
                    {Array.from(new Set([...runtimePreset.models, cliDefaultModel])).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    并发沙箱数（专业 Agent 上限）
                  </label>
                  <div className="flex items-center gap-2 h-9 px-2.5 rounded-lg border border-slate-200 bg-slate-50">
                    <input
                      type="range"
                      min={1}
                      max={12}
                      value={cliConcurrency}
                      onChange={(e) => setCliConcurrency(Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="font-mono tabular-nums text-xs font-bold text-slate-900 w-12 text-right">
                      {cliConcurrency} 沙箱
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 -mt-2">
                并发沙箱为 <span className="font-mono font-semibold text-slate-800">{cliConcurrency}</span>，意味着该 CLI 下最多可配置{' '}
                <span className="font-mono font-semibold text-slate-800">{cliConcurrency}</span> 位专业 Agent（节点内部自动隔离）。
              </p>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-800">CLI 账号 / Key 认证信息</span>
                  <div className="inline-flex rounded-md bg-slate-200/80 p-0.5">
                    <button
                      type="button"
                      onClick={() => setCliAuthMode('account_oauth')}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                        cliAuthMode === 'account_oauth' ? 'bg-white text-slate-900' : 'text-slate-600'
                      }`}
                    >
                      账号登录
                    </button>
                    <button
                      type="button"
                      onClick={() => setCliAuthMode('api_key')}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                        cliAuthMode === 'api_key' ? 'bg-white text-slate-900' : 'text-slate-600'
                      }`}
                    >
                      API Key
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={cliCredLabel}
                  onChange={(e) => setCliCredLabel(e.target.value)}
                  placeholder={selectedCliPreset.defaultCredPlaceholder}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCliDrawerNodeId(null)}
                  className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white cursor-pointer"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>安装并启用 {selectedCliPreset.label}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
