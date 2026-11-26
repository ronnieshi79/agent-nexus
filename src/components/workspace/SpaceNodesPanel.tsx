import { useState, type FormEvent } from 'react';
import {
  Check,
  Cloud,
  Copy,
  Database,
  KeyRound,
  Laptop,
  Minus,
  Monitor,
  PauseCircle,
  PlayCircle,
  Plus,
  Server,
  ShoppingBag,
  Terminal,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import type {
  CliAuthMode,
  CliToolType,
  ComputeNode,
  ExpertAgent,
  NodeCliEntry,
  NodeLeaseBillingCycle,
  NodeOsType,
  StorageVolume,
} from '../../types/agentnexus';

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
  cliCmd: string;
  defaultCredPlaceholder: string;
}[] = [
  {
    id: 'claude_code',
    label: 'Claude Code (CC)',
    runtimeAgent: 'Claude Code',
    cliCmd: 'claude --headless',
    defaultCredPlaceholder: 'Anthropic 账号或 API Key 标签（如 sk-ant-••••8f2a）',
  },
  {
    id: 'antigravity',
    label: 'Antigravity CLI',
    runtimeAgent: 'Antigravity',
    cliCmd: 'antigravity-cli serve',
    defaultCredPlaceholder: 'Antigravity OAuth 账号或 Key 标签',
  },
  {
    id: 'codex',
    label: 'Codex CLI',
    runtimeAgent: 'Codex',
    cliCmd: 'codex --full-auto',
    defaultCredPlaceholder: 'OpenAI 账号或 API Key 标签（如 sk-proj-••••3c91）',
  },
  {
    id: 'gemini_cli',
    label: 'Gemini CLI',
    runtimeAgent: 'Gemini CLI',
    cliCmd: 'gemini --yolo',
    defaultCredPlaceholder: 'Google 账号或凭证标签',
  },
  {
    id: 'qoder',
    label: 'Qoder CLI',
    runtimeAgent: 'Qoder',
    cliCmd: 'qoder-cli daemon',
    defaultCredPlaceholder: 'Qoder 账号或凭证标签',
  },
];

interface CloudNodePlan {
  id: string;
  os: NodeOsType;
  osVersion: string;
  label: string;
  audience: string;
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
    audience: '适合日常多路并发研发',
    tagline: '稳定承载 Claude Code / Codex CLI 多沙箱并发编码与构建测试',
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
    audience: '适合桌面与浏览器交付',
    tagline: '原生 Windows 环境，适合客户端构建、办公套件与 RPA 自动化交付',
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
    audience: '适合 Apple 生态与全栈团队',
    tagline: 'Apple Silicon 独享算力，支持 iOS / macOS 原生编译与 Antigravity 并发开发',
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
    audience: '适合高并发与多模态推理',
    tagline: '支持 8+ 路 CLI 并发与本地多模态、仿真及大规模自动化验证任务',
    cpuCores: 16,
    memoryGb: 64,
    gpuSpec: 'NVIDIA L40S 48GB',
    storageQuotaGb: 500,
    monthlyCostUsd: 119,
  },
];

interface SpaceNodesPanelProps {
  mode: 'list' | 'purchase';
  nodes: ComputeNode[];
  agents: ExpertAgent[];
  storageVolumes: StorageVolume[];
  searchKeyword: string;
  osFilter: 'all' | NodeOsType;
  originFilter: 'all' | 'private' | 'cloud';
  mountDrawerOpen: boolean;
  onChangeMountDrawerOpen: (open: boolean) => void;
  onOpenPurchasePage: () => void;
  onReturnToList: () => void;
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
    yearlyCostUsd?: number;
    leaseBillingCycle?: NodeLeaseBillingCycle;
    description: string;
  }) => string;
  onToggleNodeStatus: (nodeId: string) => void;
  onRemoveNode: (nodeId: string) => void;
  onAddNodeCli: (
    nodeId: string,
    input: {
      cliTool: CliToolType;
      runtimeAgent: string;
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
  mode,
  nodes,
  agents,
  storageVolumes,
  searchKeyword,
  osFilter,
  originFilter,
  mountDrawerOpen,
  onChangeMountDrawerOpen,
  onOpenPurchasePage,
  onReturnToList,
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
  // Self-mounted Private Device Drawer state
  const [privOs, setPrivOs] = useState<NodeOsType>('macos');
  const [privName, setPrivName] = useState('');
  const [privRegion, setPrivRegion] = useState('自有设备 · 本地网络');
  const [privCpu, setPrivCpu] = useState(12);
  const [privMem, setPrivMem] = useState(32);
  const [privDisk, setPrivDisk] = useState(512);
  const [privDesc, setPrivDesc] = useState('');
  const [copiedCmd, setCopiedCmd] = useState(false);

  // Secondary Procurement Page (Platform Cloud Node) config state
  const [cloudRegion, setCloudRegion] = useState('华东-上海云区');
  const [cloudNamePrefix, setCloudNamePrefix] = useState('');
  const [billingCycle, setBillingCycle] = useState<NodeLeaseBillingCycle>('monthly');

  // Inline CLI Auth Editor state (keyed by `${nodeId}:${cliId}`)
  const [editingAuthKey, setEditingAuthKey] = useState<string | null>(null);
  const [editAuthMode, setEditAuthMode] = useState<CliAuthMode>('account_oauth');
  const [editCredLabel, setEditCredLabel] = useState('');

  // Add CLI Drawer state
  const [cliDrawerNodeId, setCliDrawerNodeId] = useState<string | null>(null);
  const [cliTool, setCliTool] = useState<CliToolType>('claude_code');
  const [cliAuthMode, setCliAuthMode] = useState<CliAuthMode>('api_key');
  const [cliCredLabel, setCliCredLabel] = useState('');
  const [cliConcurrency, setCliConcurrency] = useState<number>(4);

  const selectedCliPreset =
    CLI_TOOL_PRESETS.find((c) => c.id === cliTool) || CLI_TOOL_PRESETS[0];
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

  const filteredPlans = CLOUD_NODE_PLANS.filter((plan) => {
    if (osFilter !== 'all' && plan.os !== osFilter) return false;
    if (!q) return true;
    return (
      plan.label.toLowerCase().includes(q) ||
      plan.osVersion.toLowerCase().includes(q) ||
      plan.tagline.toLowerCase().includes(q) ||
      (plan.gpuSpec || '').toLowerCase().includes(q)
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
      name: privName.trim(),
      os: privOs,
      osVersion: OS_META[privOs].defaultVersion,
      region: privRegion.trim() || '自有设备 · 本地网络',
      cpuCores: privCpu,
      memoryGb: privMem,
      storageQuotaGb: privDisk,
      description: privDesc.trim(),
    });
    setPrivName('');
    setPrivDesc('');
    onChangeMountDrawerOpen(false);
  };

  const handlePurchasePlan = (plan: CloudNodePlan) => {
    const effectiveName = cloudNamePrefix.trim()
      ? `${cloudNamePrefix.trim()} · ${OS_META[plan.os].short}`
      : `${plan.label} · ${cloudRegion.slice(0, 5)}`;
    const yearlyPrice = Math.round(plan.monthlyCostUsd * 10);
    onProvisionCloudNode({
      name: effectiveName,
      os: plan.os,
      osVersion: plan.osVersion,
      region: cloudRegion,
      cpuCores: plan.cpuCores,
      memoryGb: plan.memoryGb,
      gpuSpec: plan.gpuSpec,
      storageQuotaGb: plan.storageQuotaGb,
      monthlyCostUsd: plan.monthlyCostUsd,
      yearlyCostUsd: yearlyPrice,
      leaseBillingCycle: billingCycle,
      description: plan.tagline,
    });
    setCloudNamePrefix('');
    onReturnToList();
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
      authMode: cliAuthMode,
      credentialLabel: cliCredLabel,
      concurrency: cliConcurrency,
    });
    setCliCredLabel('');
    setCliDrawerNodeId(null);
  };

  /* ================= SECONDARY PAGE: PLATFORM CLOUD NODE PROCUREMENT ================= */
  if (mode === 'purchase') {
    return (
      <div className="space-y-4">
        {/* Concise Context & Inline Procurement Options */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1">
            <strong className="text-slate-900">AGN 平台云端算力节点采购</strong>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span>专属私有算力底座，上线后自行安装 CLI 与凭证（账号仅存本节点绝不外泄），按需封装为专家 Agent 隔离切片对外服务</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer transition-colors ${
                  billingCycle === 'monthly'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                按月租用
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('yearly')}
                className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer transition-colors ${
                  billingCycle === 'yearly'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                按年租用 · 省 17%
              </button>
            </div>
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
              <span className="whitespace-nowrap">地域</span>
              <select
                value={cloudRegion}
                onChange={(e) => setCloudRegion(e.target.value)}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-900 focus:outline-none"
              >
                <option value="华东-上海云区">华东-上海云区</option>
                <option value="华北-北京云区">华北-北京云区</option>
                <option value="亚太-新加坡云区">亚太-新加坡云区</option>
                <option value="美西-硅谷云区">美西-硅谷云区</option>
              </select>
            </label>
            <input
              type="text"
              value={cloudNamePrefix}
              onChange={(e) => setCloudNamePrefix(e.target.value)}
              placeholder="自定义节点前缀（可选）"
              className="h-8 w-40 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-900 focus:outline-none"
            />
          </div>
        </div>

        {/* Unified List Layout: Left = Plan Summary, Right = Specs & Purchase Action */}
        {filteredPlans.length === 0 ? (
          <div className="py-12 text-center rounded-xl border border-dashed border-slate-300 bg-white text-xs text-slate-500">
            当前筛选下暂无匹配的平台云节点规格
          </div>
        ) : (
          <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
            <div className="hidden @[860px]:grid @[860px]:grid-cols-[minmax(280px,360px)_minmax(0,1fr)_180px] @[860px]:items-center @[860px]:gap-6 px-5 py-2.5 bg-slate-50/90 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
              <div>平台节点概要</div>
              <div>硬件规格与适用说明</div>
              <div className="text-right">租金与采购</div>
            </div>

            <div className="divide-y divide-slate-200">
              {filteredPlans.map((plan) => {
                const osMeta = OS_META[plan.os];
                const OsIcon = osMeta.icon;
                const yearlyPrice = Math.round(plan.monthlyCostUsd * 10);
                const displayPrice =
                  billingCycle === 'yearly' ? yearlyPrice : plan.monthlyCostUsd;
                return (
                  <div
                    key={plan.id}
                    className="px-5 py-4 grid grid-cols-1 @[860px]:grid-cols-[minmax(280px,360px)_minmax(0,1fr)_180px] @[860px]:items-center gap-4 @[860px]:gap-6 hover:bg-slate-50/60 transition-colors"
                  >
                    {/* Left: Plan Summary */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                        <OsIcon className={`w-4 h-4 ${osMeta.cls}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <h3 className="text-sm font-bold text-slate-900">{plan.label}</h3>
                          <span className={`text-xs font-semibold ${osMeta.cls}`}>
                            {osMeta.short}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500 flex flex-wrap items-center gap-x-1.5">
                          <span>{plan.osVersion}</span>
                          <span aria-hidden="true">·</span>
                          <span>{plan.audience}</span>
                        </div>
                      </div>
                    </div>

                    {/* Middle: Hardware Specs & Tagline */}
                    <div className="min-w-0 space-y-1">
                      <div className="text-xs font-mono tabular-nums font-semibold text-slate-800">
                        {plan.cpuCores} vCPU · {plan.memoryGb} GB RAM · {plan.storageQuotaGb} GB NVMe
                        {plan.gpuSpec ? ` · ${plan.gpuSpec}` : ''}
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{plan.tagline}</p>
                    </div>

                    {/* Right: Price & Instant Purchase */}
                    <div className="flex @[860px]:flex-col @[860px]:items-end items-center justify-between gap-2 shrink-0">
                      <div className="font-mono tabular-nums text-right">
                        <span className="text-base font-bold text-slate-900">
                          ${displayPrice}
                        </span>
                        <span className="text-xs text-slate-500">
                          {billingCycle === 'yearly' ? ' / 年' : ' / 月'}
                        </span>
                        {billingCycle === 'yearly' && (
                          <div className="text-[11px] text-emerald-700 font-sans">
                            折合 ${Math.round(yearlyPrice / 12)}/月
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePurchasePlan(plan)}
                        className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>{billingCycle === 'yearly' ? '按年租用上线' : '按月租用上线'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ================= PRIMARY PAGE: MY AGENT NODES UNIFIED LIST ================= */
  return (
    <div className="space-y-4">
      {/* Concise Single-Line Summary Bar (No 4-Card KPI Clutter) */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>
            在线 <strong className="font-mono tabular-nums text-slate-900">{onlineCount}/{nodes.length}</strong> 节点
          </span>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <span className="font-mono tabular-nums text-slate-700">
            {totalCpu} vCPU / {totalMem} GB RAM
          </span>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <span>
            并发沙箱配额 <strong className="font-mono tabular-nums text-slate-900">{totalConcurrency}</strong>（已绑 {boundAgentCount} 位 Agent）
          </span>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <span>
            云端月租 <strong className="font-mono tabular-nums text-slate-900">${monthlyCloudCost}/月</strong>
          </span>
        </div>
        <span className="text-xs font-mono tabular-nums text-slate-400 shrink-0">
          共 {filteredNodes.length} 个节点
        </span>
      </div>

      {/* Unified Bordered List: Left = Node Summary, Right = Agent CLI & Storage Config */}
      {filteredNodes.length === 0 ? (
        <div className="py-14 text-center rounded-xl border border-dashed border-slate-300 bg-white space-y-3">
          <p className="text-sm font-medium text-slate-700">当前筛选下暂无 Agent 节点</p>
          <p className="text-xs text-slate-500">
            可免费挂载自己的 Win11 / Linux / macOS 设备，或前往平台采购 24/7 云端算力节点。
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => onChangeMountDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>挂载自有设备</span>
            </button>
            <button
              type="button"
              onClick={onOpenPurchasePage}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>平台采购节点</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl bg-white overflow-hidden mb-16">
          {/* Desktop Column Header */}
          <div className="hidden @[920px]:grid @[920px]:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] @[920px]:items-center @[920px]:gap-6 px-5 py-2.5 bg-slate-50/90 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
            <div>节点概要</div>
            <div>Agent CLI 与存储配置</div>
          </div>

          <div className="divide-y divide-slate-200">
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
                <div
                  key={node.id}
                  className="px-5 py-4 grid grid-cols-1 @[920px]:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] gap-4 @[920px]:gap-6 hover:bg-slate-50/40 transition-colors"
                >
                  {/* LEFT COLUMN: Node Summary & Node Lifecycle Controls */}
                  <div className="flex flex-col justify-between gap-3 min-w-0 @[920px]:pr-4 @[920px]:border-r @[920px]:border-slate-100">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                        <OsIcon className={`w-4 h-4 ${osMeta.cls}`} />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <h3 className="text-sm font-bold text-slate-900 truncate">
                            {node.name}
                          </h3>
                          <span
                            className={`text-xs font-semibold whitespace-nowrap ${
                              isOnline ? 'text-emerald-700' : 'text-slate-400'
                            }`}
                          >
                            {isOnline ? '在线' : '休眠'}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                          <span className={`font-semibold ${osMeta.cls}`}>{osMeta.short}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {node.origin === 'cloud'
                              ? node.leaseBillingCycle === 'yearly'
                                ? `平台云节点 $${node.yearlyCostUsd ?? node.monthlyCostUsd * 10}/年`
                                : `平台云节点 $${node.monthlyCostUsd}/月`
                              : '自有设备挂载'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{node.region}</span>
                        </div>

                        <div className="text-[11px] font-mono tabular-nums text-slate-600">
                          {node.cpuCores} vCPU · {node.memoryGb} GB RAM
                          {node.gpuSpec ? ` · ${node.gpuSpec}` : ''}
                        </div>

                        <div className="text-[11px] font-mono tabular-nums text-slate-500 flex flex-wrap items-center gap-x-1.5">
                          <span>
                            本地盘 {node.storageUsedGb}/{node.storageQuotaGb} GB ({diskPct}%)
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="text-blue-700 font-semibold">
                            沙箱 {nodeBoundAgents.length}/{nodeConcurrency}
                          </span>
                        </div>

                        <div className="text-[11px] font-mono text-slate-400 truncate">
                          {node.endpoint}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 pl-12">
                      <div className="flex flex-wrap items-center gap-1.5">
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
                          className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-medium text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer whitespace-nowrap"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{node.origin === 'cloud' ? '退租' : '解绑'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT COLUMN: Inline Agent CLI & Shared Storage Configuration */}
                  <div className="min-w-0 space-y-2.5">
                    {/* Config Sub-Header: Add CLI + Shared Storage Toggles */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-slate-800">
                          已配置 Agent CLI ({node.installedClis.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => setCliDrawerNodeId(node.id)}
                          className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-white cursor-pointer whitespace-nowrap"
                        >
                          <Plus className="w-3 h-3" />
                          <span>添加 CLI</span>
                        </button>
                      </div>

                      {/* Mounted Storage Volume Quick Toggles */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="text-slate-400 inline-flex items-center gap-1">
                          <Database className="w-3 h-3 text-slate-400" />
                          <span>存储：</span>
                        </span>
                        {storageVolumes.length === 0 ? (
                          <button
                            type="button"
                            onClick={onJumpToStorage}
                            className="text-blue-700 hover:underline font-medium cursor-pointer"
                          >
                            去配置 →
                          </button>
                        ) : (
                          storageVolumes.map((vol) => {
                            const mounted = node.mountedStorageIds.includes(vol.id);
                            return (
                              <button
                                key={vol.id}
                                type="button"
                                onClick={() => onToggleNodeStorageMount(node.id, vol.id)}
                                title={mounted ? '点击卸载此存储' : '点击挂载此存储到节点'}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium transition-colors cursor-pointer ${
                                  mounted
                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-800'
                                    : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800'
                                }`}
                              >
                                {mounted && <Check className="w-3 h-3 text-indigo-600" />}
                                <span className="max-w-[120px] truncate">{vol.name}</span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Compact CLI Rows */}
                    {node.installedClis.length === 0 ? (
                      <div className="py-4 text-xs text-slate-400 flex items-center justify-between gap-2">
                        <span>暂未配置 Agent CLI，点击「添加 CLI」安装 Claude Code / Antigravity / Codex。</span>
                        <button
                          type="button"
                          onClick={() => setCliDrawerNodeId(node.id)}
                          className="text-blue-700 hover:underline font-semibold cursor-pointer whitespace-nowrap"
                        >
                          + 立即配置
                        </button>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {node.installedClis.map((cli) => {
                          const preset =
                            CLI_TOOL_PRESETS.find((p) => p.id === cli.cliTool) ||
                            CLI_TOOL_PRESETS[0];
                          const authKey = `${node.id}:${cli.id}`;
                          const isEditingAuth = editingAuthKey === authKey;
                          const boundAgents = agents.filter(
                            (a) => a.hostNodeId === node.id && a.hostCliId === cli.id,
                          );
                          const minConcurrency = Math.max(1, boundAgents.length);
                          const atFloor = cli.concurrency <= minConcurrency;

                          return (
                            <div
                              key={cli.id}
                              className={`py-2.5 first:pt-0.5 last:pb-0 space-y-2 ${
                                cli.enabled ? '' : 'opacity-65'
                              }`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                {/* CLI Name + Status + Auth */}
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                                  <Terminal className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                                  <span className="text-xs font-bold text-slate-900">
                                    {preset.label}
                                  </span>
                                  <span className="text-[11px] font-mono text-slate-400">
                                    {cli.cliVersion}
                                  </span>
                                  <span className="text-slate-300" aria-hidden="true">·</span>
                                  <span
                                    className={`text-[11px] font-semibold ${
                                      cli.enabled ? 'text-emerald-700' : 'text-slate-400'
                                    }`}
                                  >
                                    {cli.enabled ? '已启用' : '已暂停'}
                                  </span>
                                  <span className="text-slate-300" aria-hidden="true">·</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      isEditingAuth
                                        ? setEditingAuthKey(null)
                                        : openInlineAuthEditor(node.id, cli)
                                    }
                                    className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-blue-700 cursor-pointer"
                                    title="点击修改 CLI 账号或 API Key（凭证仅保存在本节点内，绝不对外共享）"
                                  >
                                    {cli.authMode === 'account_oauth' ? (
                                      <UserCheck className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <KeyRound className="w-3 h-3 text-amber-600" />
                                    )}
                                    <span className="font-mono max-w-[160px] truncate">
                                      {cli.credentialLabel}
                                    </span>
                                    <span className="text-blue-600 font-medium">
                                      {isEditingAuth ? '收起' : '改凭证'}
                                    </span>
                                  </button>
                                </div>

                                {/* Inline Config Controls: Concurrency Stepper + Pause + Delete */}
                                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                  <div
                                    className="inline-flex items-center gap-1 h-7 px-1.5 rounded-md border border-slate-200 bg-white text-[11px]"
                                    title="并发隔离沙箱上限（对外仅以专家 Agent 隔离切片方式提供服务）"
                                  >
                                    <span className="text-slate-400">并发沙箱</span>
                                    <button
                                      type="button"
                                      disabled={atFloor}
                                      onClick={() =>
                                        onUpdateNodeCli(node.id, cli.id, {
                                          concurrency: Math.max(
                                            minConcurrency,
                                            cli.concurrency - 1,
                                          ),
                                        })
                                      }
                                      aria-label="减少并发沙箱数"
                                      className="w-5 h-5 rounded hover:bg-slate-100 disabled:opacity-35 flex items-center justify-center text-slate-700 cursor-pointer"
                                    >
                                      <Minus className="w-3 h-3" />
                                    </button>
                                    <span className="font-mono tabular-nums font-bold text-slate-900 min-w-[26px] text-center">
                                      {boundAgents.length}/{cli.concurrency}
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
                                      className="w-5 h-5 rounded hover:bg-slate-100 disabled:opacity-35 flex items-center justify-center text-slate-700 cursor-pointer"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      onUpdateNodeCli(node.id, cli.id, { enabled: !cli.enabled })
                                    }
                                    className="h-7 px-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-medium text-slate-700 cursor-pointer whitespace-nowrap"
                                  >
                                    {cli.enabled ? '暂停' : '启用'}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => onRemoveNodeCli(node.id, cli.id)}
                                    title="删除此 Agent CLI"
                                    className="inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                                    aria-label={`删除 ${preset.label}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Secondary Line: Bound Agents (showing each agent's own model) */}
                              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pl-5">
                                <span className="truncate">
                                  已承载专家：
                                  {boundAgents.length > 0 ? (
                                    <span className="font-medium text-slate-700">
                                      {boundAgents
                                        .map((a) => `${a.handle} (${a.defaultModel})`)
                                        .join('、')}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">
                                      暂无（空闲可用，模型由各 Agent 专家独立指定）
                                    </span>
                                  )}
                                </span>
                                <button
                                  type="button"
                                  onClick={onJumpToAgents}
                                  className="text-slate-500 hover:text-blue-700 font-medium cursor-pointer whitespace-nowrap shrink-0"
                                >
                                  配专家模型与 Skills →
                                </button>
                              </div>

                              {/* Inline Auth Editor (Expanded Only When Clicked) */}
                              {isEditingAuth && (
                                <div className="pl-5 pt-1 flex flex-wrap items-center gap-2">
                                  <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
                                    <button
                                      type="button"
                                      onClick={() => setEditAuthMode('account_oauth')}
                                      className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                                        editAuthMode === 'account_oauth'
                                          ? 'bg-slate-900 text-white'
                                          : 'text-slate-600'
                                      }`}
                                    >
                                      账号 OAuth
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditAuthMode('api_key')}
                                      className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                                        editAuthMode === 'api_key'
                                          ? 'bg-slate-900 text-white'
                                          : 'text-slate-600'
                                      }`}
                                    >
                                      API Key
                                    </button>
                                  </div>
                                  <input
                                    type="text"
                                    value={editCredLabel}
                                    onChange={(e) => setEditCredLabel(e.target.value)}
                                    placeholder={
                                      editAuthMode === 'account_oauth'
                                        ? '输入账号邮箱...'
                                        : '输入 API Key 标签如 sk-ant-••••'
                                    }
                                    className="flex-1 min-w-[180px] max-w-xs h-7 rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-mono text-slate-900 focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => saveInlineAuth(node.id, cli.id)}
                                    className="h-7 px-2.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold cursor-pointer"
                                  >
                                    保存凭证
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingAuthKey(null)}
                                    className="h-7 px-2 text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer"
                                  >
                                    取消
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Slide-in Drawer A: Self-Mount Private Device Node (Free) */}
      {mountDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-slate-900/30"
            onClick={() => onChangeMountDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-lg bg-white h-full border-l border-slate-200 shadow-xl flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <div>
                <h2 className="text-sm font-bold text-slate-900">挂载自有设备节点</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  将自己的 Windows 11、Linux 或 macOS 主机免费挂载为 Agent 节点，零月租费用。
                </p>
              </div>
              <button
                type="button"
                onClick={() => onChangeMountDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                aria-label="关闭挂载抽屉"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

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
                  <label className="text-xs font-semibold text-slate-700">位置 / 网络备注</label>
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
                    <span>在目标 {OS_META[privOs].label} 终端运行挂载命令</span>
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

              <div className="pt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onChangeMountDrawerOpen(false);
                    onOpenPurchasePage();
                  }}
                  className="text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
                >
                  没有闲置设备？去平台采购云节点 →
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onChangeMountDrawerOpen(false)}
                    className="h-9 px-3.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
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
              </div>
            </form>
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
                  目标节点：<strong className="text-slate-800">{cliDrawerNode.name}</strong> · 配置 CLI 工具、认证凭证与并发沙箱数。
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
                <label className="text-xs font-semibold text-slate-700">选择要安装的 Agent CLI 底座</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CLI_TOOL_PRESETS.map((preset) => {
                    const active = cliTool === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setCliTool(preset.id)}
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

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">
                  并发沙箱数（可承载的 Agent 专家上限）
                </label>
                <div className="flex items-center gap-2 h-9 px-3 rounded-lg border border-slate-200 bg-slate-50">
                  <input
                    type="range"
                    min={1}
                    max={12}
                    value={cliConcurrency}
                    onChange={(e) => setCliConcurrency(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="font-mono tabular-nums text-xs font-bold text-slate-900 w-14 text-right">
                    {cliConcurrency} 沙箱
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  节点仅管 CLI 底座、登录账号与并发额度；不同专家可共用同一 CLI 自由搭配 Opus / DeepSeek Flash 等模型。
                </p>
              </div>

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
