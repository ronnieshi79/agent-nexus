import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowUpRight,
  Check,
  Database,
  KeyRound,
  Layers,
  Minus,
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
  StorageVolume,
} from '../../types/agentnexus';
import { getRuntimePreset } from '../shared/EntityIdentity';

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

interface SpaceAgentsPanelProps {
  nodes: ComputeNode[];
  agents: ExpertAgent[];
  storageVolumes: StorageVolume[];
  searchKeyword: string;
  nodeFilterId: string;
  drawerOpen: boolean;
  preselectedNodeId: string | null;
  onChangeDrawerOpen: (open: boolean) => void;
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
  onJumpToNodes: () => void;
  onJumpToStorage: () => void;
  onJumpToTeam: () => void;
}

export function SpaceAgentsPanel({
  nodes,
  agents,
  storageVolumes,
  searchKeyword,
  nodeFilterId,
  drawerOpen,
  preselectedNodeId,
  onChangeDrawerOpen,
  onAddNodeCli,
  onUpdateNodeCli,
  onRemoveNodeCli,
  onToggleNodeStorageMount,
  onJumpToNodes,
  onJumpToStorage,
  onJumpToTeam,
}: SpaceAgentsPanelProps) {
  const onlineNodes = nodes.filter((n) => n.status === 'online');

  // Inline Credential Editor state (keyed by `${nodeId}:${cliId}`)
  const [editingAuthKey, setEditingAuthKey] = useState<string | null>(null);
  const [editAuthMode, setEditAuthMode] = useState<CliAuthMode>('account_oauth');
  const [editCredLabel, setEditCredLabel] = useState('');

  // Drawer form state (Add CLI to a node)
  const [targetNodeId, setTargetNodeId] = useState<string>(
    preselectedNodeId || onlineNodes[0]?.id || nodes[0]?.id || '',
  );
  const [cliTool, setCliTool] = useState<CliToolType>('claude_code');
  const [defaultModel, setDefaultModel] = useState<string>('Claude 4.5 Sonnet');
  const [authMode, setAuthMode] = useState<CliAuthMode>('api_key');
  const [credentialLabel, setCredentialLabel] = useState('');
  const [concurrency, setConcurrency] = useState<number>(4);

  useEffect(() => {
    if (preselectedNodeId) {
      setTargetNodeId(preselectedNodeId);
    } else if (!targetNodeId && (onlineNodes[0] || nodes[0])) {
      setTargetNodeId((onlineNodes[0] || nodes[0]).id);
    }
  }, [nodes, onlineNodes, preselectedNodeId, targetNodeId]);

  const selectedCliPreset =
    CLI_TOOL_PRESETS.find((c) => c.id === cliTool) || CLI_TOOL_PRESETS[0];
  const runtimePreset = getRuntimePreset(selectedCliPreset.runtimeAgent);

  const q = searchKeyword.trim().toLowerCase();

  const visibleNodes = nodes.filter((n) =>
    nodeFilterId === 'all' ? true : n.id === nodeFilterId,
  );

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
    if (!targetNodeId) return;
    onAddNodeCli(targetNodeId, {
      cliTool,
      runtimeAgent: selectedCliPreset.runtimeAgent,
      defaultModel,
      authMode,
      credentialLabel,
      concurrency,
    });
    setCredentialLabel('');
    onChangeDrawerOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* Architecture Guidance Bar: Node CLI Config vs AGN Team Professional Agents */}
      <section className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="text-xs text-slate-600 leading-relaxed">
          <span className="font-semibold text-slate-900">Agent 空间底座与并发沙箱配置：</span>
          在此为各 Win11 / Linux / macOS 节点安装或删除 Agent CLI（Claude Code、Antigravity、Codex 等）、管理账号/Key、设定并发沙箱数并挂载共享存储；并发沙箱数即该 CLI 可配置专业 Agent 的上限，自建专业 Agent 请前往「AGN 团队」绑定。
        </div>
        <button
          type="button"
          onClick={onJumpToTeam}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-900 hover:text-white hover:border-slate-900 text-xs font-semibold text-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Users className="w-3.5 h-3.5" />
          <span>前往 AGN 团队配置专业 Agent</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </section>

      {/* Node-Grouped CLI & Shared Storage Configuration */}
      {visibleNodes.length === 0 ? (
        <div className="py-14 text-center rounded-xl border border-dashed border-slate-300 bg-white space-y-3">
          <p className="text-sm font-medium text-slate-700">
            请先在「Agent 节点」挂载自有设备或租用云端节点
          </p>
          <button
            type="button"
            onClick={onJumpToNodes}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer"
          >
            <Server className="w-3.5 h-3.5" />
            <span>前往 Agent 节点</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleNodes.map((node) => {
            const matchedClis = node.installedClis.filter((cli) => {
              if (!q) return true;
              const preset = CLI_TOOL_PRESETS.find((p) => p.id === cli.cliTool);
              return (
                node.name.toLowerCase().includes(q) ||
                cli.runtimeAgent.toLowerCase().includes(q) ||
                (preset?.label || '').toLowerCase().includes(q) ||
                cli.defaultModel.toLowerCase().includes(q) ||
                cli.credentialLabel.toLowerCase().includes(q)
              );
            });

            const isOnline = node.status === 'online';
            const totalConcurrency = node.installedClis
              .filter((c) => c.enabled)
              .reduce((sum, c) => sum + c.concurrency, 0);
            const nodeBoundCount = agents.filter(
              (a) => a.hostNodeId === node.id && Boolean(a.hostCliId),
            ).length;

            return (
              <section
                key={node.id}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden"
              >
                {/* Node Header */}
                <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs min-w-0">
                    <Server className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="font-bold text-slate-900">{node.name}</span>
                    <span className="text-slate-300" aria-hidden="true">·</span>
                    <span className="text-[11px] font-medium text-slate-600">
                      {node.osVersion}
                    </span>
                    <span className="text-slate-300" aria-hidden="true">·</span>
                    <span className="font-mono text-[11px] text-slate-500">
                      {node.cpuCores}C/{node.memoryGb}GB · {node.installedClis.length} 个 CLI · 并发沙箱 {nodeBoundCount}/{totalConcurrency}
                    </span>
                    <span className="text-slate-300" aria-hidden="true">·</span>
                    <span
                      className={`text-[11px] font-semibold ${
                        isOnline ? 'text-emerald-700' : 'text-slate-500'
                      }`}
                    >
                      {isOnline ? '在线' : '休眠'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setTargetNodeId(node.id);
                      onChangeDrawerOpen(true);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-white cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3 h-3" />
                    <span>添加 Agent CLI</span>
                  </button>
                </div>

                {/* Node Mounted Shared Work Storage Strip */}
                <div className="px-4 py-2.5 bg-slate-50/40 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 shrink-0">
                      <Database className="w-3.5 h-3.5 text-indigo-600" />
                      <span>节点挂载共享存储：</span>
                    </span>

                    {storageVolumes.length === 0 ? (
                      <button
                        type="button"
                        onClick={onJumpToStorage}
                        className="text-[11px] text-blue-700 hover:underline cursor-pointer"
                      >
                        暂无共享云存储，前往购买/租用 →
                      </button>
                    ) : (
                      storageVolumes.map((vol) => {
                        const mounted = node.mountedStorageIds.includes(vol.id);
                        return (
                          <button
                            key={vol.id}
                            type="button"
                            onClick={() => onToggleNodeStorageMount(node.id, vol.id)}
                            title={mounted ? '点击从该节点卸载此共享存储' : '点击挂载此共享存储到该节点'}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors cursor-pointer ${
                              mounted
                                ? 'bg-indigo-50/80 border-indigo-200 text-indigo-800'
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
                            <span className="truncate max-w-[180px]">{vol.name}</span>
                            <span className="font-mono text-[10px] opacity-75">
                              {vol.quotaGb}GB
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={onJumpToStorage}
                    className="text-[11px] font-medium text-slate-500 hover:text-blue-700 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    管理 Agent 存储 →
                  </button>
                </div>

                {/* Installed Agent CLIs List */}
                {matchedClis.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-slate-400">
                    {node.installedClis.length === 0
                      ? '该节点尚未配置任何 Agent CLI，点击右上角「添加 Agent CLI」安装 Claude Code / Antigravity / Codex 等。'
                      : '当前搜索关键词下该节点无匹配的 CLI 配置。'}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {matchedClis.map((cli) => {
                      const preset =
                        CLI_TOOL_PRESETS.find((p) => p.id === cli.cliTool) || CLI_TOOL_PRESETS[0];
                      const rtPreset = getRuntimePreset(cli.runtimeAgent);
                      const authKey = `${node.id}:${cli.id}`;
                      const isEditingAuth = editingAuthKey === authKey;
                      const boundAgents = agents.filter(
                        (a) => a.hostNodeId === node.id && a.hostCliId === cli.id,
                      );

                      return (
                        <div
                          key={cli.id}
                          className={`p-4 space-y-3 transition-colors ${
                            cli.enabled ? 'hover:bg-slate-50/50' : 'bg-slate-50/40 opacity-75'
                          }`}
                        >
                          {/* Row 1: CLI Identity + Model Selector + Enable/Delete */}
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                              <span className="w-7 h-7 rounded-lg bg-slate-900 text-white inline-flex items-center justify-center shrink-0">
                                <Terminal className="w-3.5 h-3.5" />
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

                          {/* Row 2: 3-Column Strip — Account/Key | Concurrency | Bound AGN Team Agents */}
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
                            {/* 1. Account / Key Management */}
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

                            {/* 2. Concurrent Sandbox Quota Stepper (Professional Agent Capacity Limit) */}
                            {(() => {
                              const minConcurrency = Math.max(1, boundAgents.length);
                              const atFloor = cli.concurrency <= minConcurrency;
                              const isFull = boundAgents.length >= cli.concurrency;
                              const remainingSlots = Math.max(0, cli.concurrency - boundAgents.length);

                              return (
                                <>
                                  <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-2.5 flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                                        <Layers className="w-3.5 h-3.5 text-blue-600" />
                                        <span>并发沙箱数</span>
                                      </div>
                                      <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                                        最多可配置 {cli.concurrency} 个专业 Agent
                                      </div>
                                    </div>
                                    <div className="inline-flex items-center gap-1.5 shrink-0">
                                      <button
                                        type="button"
                                        disabled={atFloor}
                                        title={
                                          boundAgents.length > 0 && cli.concurrency <= boundAgents.length
                                            ? `已绑定 ${boundAgents.length} 个专业 Agent，无法低于当前已用沙箱数`
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

                                  {/* 3. Professional Agents Bound to This Node CLI (Configured in AGN Team) */}
                                  <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-2.5 flex flex-col justify-between gap-1">
                                    <div className="flex items-center justify-between gap-2 text-[11px]">
                                      <span className="inline-flex items-center gap-1 font-semibold text-slate-600 min-w-0">
                                        <Users className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                        <span className="truncate">
                                          已绑定专业 Agent ({boundAgents.length}/{cli.concurrency})
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
                                            就绪待用 · 可在 AGN 团队选用
                                          </span>
                                        )}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={onJumpToTeam}
                                        className="text-blue-700 hover:underline font-medium cursor-pointer whitespace-nowrap shrink-0"
                                      >
                                        AGN 团队 →
                                      </button>
                                    </div>
                                  </div>
                                </>
                              );
                            })()}
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

      {/* Slide-in Drawer: Add Agent CLI to Node */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-slate-900/30"
            onClick={() => onChangeDrawerOpen(false)}
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
                  配置该节点支持的 Agent CLI、认证账号/Key 与并发沙箱数（决定专业 Agent 配置上限），完成后即可在 AGN 团队绑定创建。
                </p>
              </div>
              <button
                type="button"
                onClick={() => onChangeDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleAddCliSubmit}
              className="flex-1 overflow-y-auto clean-scroll p-5 space-y-4"
            >
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">目标 Agent 节点 *</label>
                <select
                  required
                  value={targetNodeId}
                  onChange={(e) => setTargetNodeId(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none"
                >
                  {nodes.length === 0 ? (
                    <option value="">暂无节点，请先在 Agent 节点挂载或租用</option>
                  ) : (
                    nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name} · {n.osVersion}（{n.status === 'online' ? '在线' : '休眠'}）
                      </option>
                    ))
                  )}
                </select>
              </div>

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
                          setDefaultModel(preset.defaultModel);
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
                    value={defaultModel}
                    onChange={(e) => setDefaultModel(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none"
                  >
                    {Array.from(new Set([...runtimePreset.models, defaultModel])).map((m) => (
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
                      value={concurrency}
                      onChange={(e) => setConcurrency(Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="font-mono tabular-nums text-xs font-bold text-slate-900 w-12 text-right">
                      {concurrency} 沙箱
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 -mt-2">
                并发沙箱为 <span className="font-mono font-semibold text-slate-800">{concurrency}</span>，意味着该 CLI 下最多可配置{' '}
                <span className="font-mono font-semibold text-slate-800">{concurrency}</span> 个专业 Agent（节点内部自动隔离）。
              </p>

              {/* CLI Auth Config */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-800">CLI 账号 / Key 认证信息</span>
                  <div className="inline-flex rounded-md bg-slate-200/80 p-0.5">
                    <button
                      type="button"
                      onClick={() => setAuthMode('account_oauth')}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                        authMode === 'account_oauth' ? 'bg-white text-slate-900' : 'text-slate-600'
                      }`}
                    >
                      账号登录
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMode('api_key')}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                        authMode === 'api_key' ? 'bg-white text-slate-900' : 'text-slate-600'
                      }`}
                    >
                      API Key
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={credentialLabel}
                  onChange={(e) => setCredentialLabel(e.target.value)}
                  placeholder={selectedCliPreset.defaultCredPlaceholder}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onChangeDrawerOpen(false)}
                  className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={nodes.length === 0}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-45 text-xs font-semibold text-white cursor-pointer"
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
