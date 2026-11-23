import { useState, type FormEvent } from 'react';
import {
  Check,
  Cloud,
  Copy,
  Cpu,
  HardDrive,
  Laptop,
  Monitor,
  PauseCircle,
  PlayCircle,
  Plus,
  Server,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import type {
  ComputeNode,
  ExpertAgent,
  NodeOsType,
  StorageVolume,
} from '../../types/agentnexus';

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
  onOpenNodeCliConfig: (nodeId: string) => void;
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
  onOpenNodeCliConfig,
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

  const q = searchKeyword.trim().toLowerCase();
  const filteredNodes = nodes.filter((n) => {
    if (osFilter !== 'all' && n.os !== osFilter) return false;
    if (originFilter !== 'all' && n.origin !== originFilter) return false;
    if (!q) return true;
    return (
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

  return (
    <div className="space-y-5">
      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 @[760px]:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium">在线设备节点</span>
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
            已绑定 {boundAgentCount} 个专业 Agent · 自动隔离
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

      {/* Nodes Grid */}
      {filteredNodes.length === 0 ? (
        <div className="py-14 text-center rounded-xl border border-dashed border-slate-300 bg-white space-y-3">
          <p className="text-sm font-medium text-slate-700">当前筛选下暂无节点</p>
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
        <div className="grid grid-cols-1 @[920px]:grid-cols-2 gap-4">
          {filteredNodes.map((node) => {
            const osMeta = OS_META[node.os];
            const OsIcon = osMeta.icon;
            const enabledClis = node.installedClis.filter((c) => c.enabled);
            const nodeConcurrency = enabledClis.reduce((s, c) => s + c.concurrency, 0);
            const nodeBoundAgents = agents.filter((a) => a.hostNodeId === node.id);
            const mountedVolNames = node.mountedStorageIds
              .map((vid) => storageVolumes.find((v) => v.id === vid)?.name)
              .filter((v): v is string => Boolean(v));
            const diskPct = Math.min(
              100,
              Math.round((node.storageUsedGb / Math.max(1, node.storageQuotaGb)) * 100),
            );
            const isOnline = node.status === 'online';

            return (
              <article
                key={node.id}
                className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between gap-3.5 hover:border-slate-300 transition-colors"
              >
                <div className="space-y-3">
                  {/* Top Row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
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
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
                          <span className="inline-flex items-center gap-1 font-semibold">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                              }`}
                            />
                            <span className={isOnline ? 'text-emerald-700' : 'text-slate-500'}>
                              {isOnline ? '在线' : '休眠'}
                            </span>
                          </span>
                          <span className="text-slate-300" aria-hidden="true">·</span>
                          <span>{node.osVersion}</span>
                          <span className="text-slate-300" aria-hidden="true">·</span>
                          <span>{node.region}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenNodeCliConfig(node.id)}
                      className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-white whitespace-nowrap cursor-pointer shrink-0"
                    >
                      Agent 配置
                    </button>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">{node.description}</p>

                  {/* Hardware Spec Strip */}
                  <div className="rounded-lg bg-slate-50/90 border border-slate-200/70 p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums">
                      <span className="text-slate-800 font-semibold">
                        {node.cpuCores} vCPU · {node.memoryGb} GB RAM
                        {node.gpuSpec ? ` · ${node.gpuSpec}` : ''}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        本地盘 {node.storageUsedGb}/{node.storageQuotaGb} GB ({diskPct}%)
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-200/80 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          diskPct >= 80 ? 'bg-amber-500' : 'bg-blue-600'
                        }`}
                        style={{ width: `${diskPct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span className="truncate">{node.endpoint}</span>
                      <span className="shrink-0">接入：{node.mountedAt}</span>
                    </div>
                  </div>

                  {/* Supported Agent CLIs & Mounted Shared Storage on this node */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>
                        已配置 Agent CLI（{node.installedClis.length} 个 · 沙箱已用{' '}
                        {nodeBoundAgents.length}/{nodeConcurrency}）
                      </span>
                      <span className="text-slate-400">
                        共享存储 {mountedVolNames.length} 卷
                      </span>
                    </div>
                    {node.installedClis.length === 0 ? (
                      <div className="text-xs text-slate-400 py-0.5">
                        暂未配置 Agent CLI，点击右上角「Agent 配置」安装 Claude Code / Antigravity / Codex。
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {node.installedClis.map((cli) => {
                          const cliUsed = nodeBoundAgents.filter((a) => a.hostCliId === cli.id).length;
                          const cliFull = cliUsed >= cli.concurrency;
                          return (
                            <div
                              key={cli.id}
                              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] ${
                                cli.enabled
                                  ? 'bg-slate-50 border-slate-200 text-slate-800'
                                  : 'bg-slate-50/50 border-slate-100 text-slate-400'
                              }`}
                            >
                              <Terminal className="w-3 h-3 text-slate-500 shrink-0" />
                              <span className="font-semibold">{cli.runtimeAgent}</span>
                              <span className="font-mono text-[10px] text-slate-400">
                                {cli.defaultModel}
                              </span>
                              <span
                                className={`text-[10px] font-mono font-semibold ${
                                  cliFull ? 'text-amber-700' : 'text-blue-700'
                                }`}
                              >
                                {cliUsed}/{cli.concurrency} 沙箱
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Action Row */}
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleNodeStatus(node.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer"
                  >
                    {isOnline ? (
                      <>
                        <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
                        <span>暂停休眠</span>
                      </>
                    ) : (
                      <>
                        <PlayCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>唤醒上线</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => onRemoveNode(node.id)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{node.origin === 'cloud' ? '退租节点' : '解除挂载'}</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Slide-in Drawer: Mount Private Device OR Rent Cloud Node */}
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
                    ? '支持将自己的 Windows 11、Linux 或 macOS 电脑挂载为专属算力节点，零月租费用。'
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
    </div>
  );
}
