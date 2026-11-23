import { useState, type FormEvent } from 'react';
import {
  Cloud,
  Cpu,
  Database,
  FolderKanban,
  HardDrive,
  Lock,
  Plus,
  Server,
  ShoppingBag,
  X,
} from 'lucide-react';
import type {
  ComputeNode,
  ExpertAgent,
  ProjectWorkspace,
  StorageBillingMode,
  StorageVolume,
} from '../../types/agentnexus';

interface StoragePlanPreset {
  id: string;
  tierLabel: string;
  quotaGb: number;
  billingMode: StorageBillingMode;
  priceUsd: number;
  tagline: string;
}

const STORAGE_PLANS: StoragePlanPreset[] = [
  {
    id: 'monthly_100',
    tierLabel: '标准共享云存储',
    quotaGb: 100,
    billingMode: 'monthly',
    priceUsd: 9,
    tagline: '适合个人多节点共享代码仓库与日常产物',
  },
  {
    id: 'monthly_500',
    tierLabel: '高速团队共享云存储',
    quotaGb: 500,
    billingMode: 'monthly',
    priceUsd: 29,
    tagline: '高吞吐低延迟，支持多路 CLI Agent 并发读写共享工作区',
  },
  {
    id: 'permanent_200',
    tierLabel: '永久云存储买断包（200GB）',
    quotaGb: 200,
    billingMode: 'permanent',
    priceUsd: 199,
    tagline: '一次性买断永久保留，适合长期项目资产、文档与交付归档',
  },
  {
    id: 'permanent_1000',
    tierLabel: '旗舰永久云存储包（1TB）',
    quotaGb: 1000,
    billingMode: 'permanent',
    priceUsd: 599,
    tagline: '企业级多副本永久云盘，支持跨区域节点秒级挂载',
  },
];

interface SpaceStoragePanelProps {
  volumes: StorageVolume[];
  nodes: ComputeNode[];
  agents: ExpertAgent[];
  workspaces: ProjectWorkspace[];
  searchKeyword: string;
  billingFilter: 'all' | StorageBillingMode;
  drawerOpen: boolean;
  onChangeDrawerOpen: (open: boolean) => void;
  onCreateVolume: (input: {
    name: string;
    tierLabel: string;
    region: string;
    quotaGb: number;
    billingMode: StorageBillingMode;
    priceUsd: number;
    encrypted: boolean;
    boundNodeIds: string[];
    boundProjectIds: string[];
  }) => string;
  onExpandVolume: (volumeId: string, addGb: number) => void;
}

export function SpaceStoragePanel({
  volumes,
  nodes,
  agents,
  workspaces,
  searchKeyword,
  billingFilter,
  drawerOpen,
  onChangeDrawerOpen,
  onCreateVolume,
  onExpandVolume,
}: SpaceStoragePanelProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string>('monthly_500');
  const [name, setName] = useState('');
  const [region, setRegion] = useState('华东-上海多可用区');
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>(
    nodes.filter((n) => n.status === 'online').map((n) => n.id),
  );
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  const selectedPlan =
    STORAGE_PLANS.find((p) => p.id === selectedPlanId) || STORAGE_PLANS[0];

  const q = searchKeyword.trim().toLowerCase();
  const filteredVolumes = volumes.filter((v) => {
    if (billingFilter !== 'all' && v.billingMode !== billingFilter) return false;
    if (!q) return true;
    return (
      v.name.toLowerCase().includes(q) ||
      v.tierLabel.toLowerCase().includes(q) ||
      v.region.toLowerCase().includes(q)
    );
  });

  const totalQuotaGb = volumes.reduce((s, v) => s + v.quotaGb, 0);
  const totalUsedGb = volumes.reduce((s, v) => s + v.usedGb, 0);
  const overallPct =
    totalQuotaGb > 0 ? Math.min(100, Math.round((totalUsedGb / totalQuotaGb) * 100)) : 0;
  const monthlyStorageFee = volumes
    .filter((v) => v.billingMode === 'monthly')
    .reduce((s, v) => s + v.priceUsd, 0);
  const permanentCount = volumes.filter((v) => v.billingMode === 'permanent').length;
  const connectedAgentCount = agents.filter((a) =>
    Boolean(a.storageVolumeId || a.cliConfig?.storageVolumeId),
  ).length;

  const toggleSelection = (list: string[], id: string, setter: (v: string[]) => void) => {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const handleCreateSubmit = (e: FormEvent) => {
    e.preventDefault();
    const effectiveName = name.trim() || `${selectedPlan.tierLabel} · ${region.slice(0, 4)}`;
    onCreateVolume({
      name: effectiveName,
      tierLabel: selectedPlan.tierLabel,
      region,
      quotaGb: selectedPlan.quotaGb,
      billingMode: selectedPlan.billingMode,
      priceUsd: selectedPlan.priceUsd,
      encrypted: true,
      boundNodeIds: selectedNodeIds,
      boundProjectIds: selectedProjectIds,
    });
    setName('');
    setSelectedProjectIds([]);
    onChangeDrawerOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* Cloud Storage KPI Strip */}
      <div className="grid grid-cols-2 @[760px]:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium">共享云存储空间</span>
            <Cloud className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
            {volumes.length}
          </div>
          <div className="text-[11px] text-slate-500">
            永久买断 {permanentCount} · 按月租用 {volumes.length - permanentCount}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium">总容量使用率</span>
            <HardDrive className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {overallPct}%
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-600">
              {totalUsedGb} / {totalQuotaGb} GB
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full" style={{ width: `${overallPct}%` }} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium">已挂载协同 Agent</span>
            <Cpu className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
            {connectedAgentCount}
          </div>
          <div className="text-[11px] text-slate-500">多 Agent 共享读写同一工作目录</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium">云存储月租增值费</span>
            <ShoppingBag className="w-4 h-4 text-sky-600" />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              ${monthlyStorageFee}
            </span>
            <span className="text-xs text-slate-500">/ 月</span>
          </div>
          <div className="text-[11px] text-slate-500">另支持一次性买断永久存储包</div>
        </div>
      </div>

      {/* Cloud Storage Cards */}
      {filteredVolumes.length === 0 ? (
        <div className="py-14 text-center rounded-xl border border-dashed border-slate-300 bg-white space-y-3">
          <p className="text-sm font-medium text-slate-700">当前筛选下暂无云存储空间</p>
          <button
            type="button"
            onClick={() => onChangeDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>购买 / 租用云存储</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredVolumes.map((vol) => {
            const pct = Math.min(100, Math.round((vol.usedGb / Math.max(1, vol.quotaGb)) * 100));
            const boundNodes = nodes.filter(
              (n) => vol.boundNodeIds.includes(n.id) || n.mountedStorageIds.includes(vol.id),
            );
            const boundProjects = workspaces.filter((w) => vol.boundProjectIds.includes(w.id));
            const boundAgents = agents.filter(
              (a) => (a.storageVolumeId || a.cliConfig?.storageVolumeId) === vol.id,
            );

            return (
              <article
                key={vol.id}
                className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 hover:border-slate-300 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <Database className="w-4 h-4 text-blue-600 shrink-0" />
                      <h3 className="text-sm font-bold text-slate-900">{vol.name}</h3>
                      <span
                        className={`text-xs font-semibold ${
                          vol.billingMode === 'permanent' ? 'text-emerald-700' : 'text-blue-700'
                        }`}
                      >
                        {vol.billingMode === 'permanent'
                          ? `永久存储包 ($${vol.priceUsd} 已买断)`
                          : `云存储月租 ($${vol.priceUsd}/月)`}
                      </span>
                      {vol.encrypted && (
                        <>
                          <span className="text-slate-300" aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
                            <Lock className="w-3 h-3 text-emerald-600" />
                            <span>永久持久化加密</span>
                          </span>
                        </>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[11px] text-slate-500">
                      <span>{vol.tierLabel}</span>
                      <span className="text-slate-300" aria-hidden="true">·</span>
                      <span>{vol.region}</span>
                      <span className="text-slate-300" aria-hidden="true">·</span>
                      <span className="font-mono">{vol.mountPath}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onExpandVolume(vol.id, 100)}
                    className="px-3 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-800 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    +100GB 扩容
                  </button>
                </div>

                {/* Capacity Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                    <span className="text-slate-500">云端存储占用</span>
                    <span className="font-semibold text-slate-800">
                      {vol.usedGb} GB / {vol.quotaGb} GB ({pct}%)
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct >= 80 ? 'bg-amber-500' : 'bg-blue-600'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Multi-Agent & Node Sharing Info */}
                <div className="pt-2.5 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 shrink-0">
                      <Cpu className="w-3.5 h-3.5 text-indigo-500" />
                      <span>共享 Agent：</span>
                    </span>
                    {boundAgents.length === 0 ? (
                      <span className="text-[11px] text-slate-400">可在「Agent 配置」为节点挂载</span>
                    ) : (
                      boundAgents.map((a) => (
                        <span key={a.id} className="text-[11px] font-semibold text-indigo-700">
                          {a.handle}
                        </span>
                      ))
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 shrink-0">
                      <Server className="w-3.5 h-3.5 text-slate-400" />
                      <span>接入节点：</span>
                    </span>
                    {boundNodes.length === 0 ? (
                      <span className="text-[11px] text-slate-400">全节点可挂载</span>
                    ) : (
                      boundNodes.map((n) => (
                        <span key={n.id} className="text-[11px] font-semibold text-slate-700">
                          {n.name}
                        </span>
                      ))
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 shrink-0">
                      <FolderKanban className="w-3.5 h-3.5 text-slate-400" />
                      <span>关联项目：</span>
                    </span>
                    {boundProjects.length === 0 ? (
                      <span className="text-[11px] text-slate-400">通用共享盘</span>
                    ) : (
                      boundProjects.map((p) => (
                        <span key={p.id} className="text-[11px] font-semibold text-blue-700">
                          {p.name}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Slide-in Drawer: Purchase / Rent Cloud Work Storage */}
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
                <h2 className="text-sm font-bold text-slate-900">购买 / 租用共享云存储</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  多 Agent 共同读写的永久云存储增值服务，跨 Win11/Linux/macOS 节点实时同步。
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
              onSubmit={handleCreateSubmit}
              className="flex-1 overflow-y-auto clean-scroll p-5 space-y-4"
            >
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700">选择云存储套餐</label>
                <div className="space-y-2">
                  {STORAGE_PLANS.map((plan) => {
                    const active = selectedPlanId === plan.id;
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => setSelectedPlanId(plan.id)}
                        className={`w-full text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                          active
                            ? 'border-blue-600 bg-blue-50/50'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">
                              {plan.tierLabel}
                            </span>
                            <span className="text-[11px] font-mono font-semibold text-slate-600">
                              {plan.quotaGb >= 1000 ? `${plan.quotaGb / 1000}TB` : `${plan.quotaGb}GB`}
                            </span>
                          </div>
                          <span
                            className={`text-sm font-bold font-mono tabular-nums ${
                              plan.billingMode === 'permanent' ? 'text-emerald-700' : 'text-blue-700'
                            }`}
                          >
                            {plan.billingMode === 'permanent'
                              ? `$${plan.priceUsd} 永久`
                              : `$${plan.priceUsd}/月`}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">{plan.tagline}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">存储空间名称</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={`${selectedPlan.tierLabel}`}
                    className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:bg-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">存储可用区</label>
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none"
                  >
                    <option value="华东-上海多可用区">华东-上海多可用区</option>
                    <option value="华北-北京多可用区">华北-北京多可用区</option>
                    <option value="亚太-新加坡高可用">亚太-新加坡高可用</option>
                    <option value="美西-硅谷高可用">美西-硅谷高可用</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">默认授权接入节点</label>
                <div className="space-y-1.5 max-h-32 overflow-y-auto clean-scroll">
                  {nodes.map((n) => (
                    <label
                      key={n.id}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50/70 text-xs cursor-pointer hover:bg-slate-100/70"
                    >
                      <span className="inline-flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={selectedNodeIds.includes(n.id)}
                          onChange={() =>
                            toggleSelection(selectedNodeIds, n.id, setSelectedNodeIds)
                          }
                        />
                        <span className="font-medium text-slate-800 truncate">{n.name}</span>
                      </span>
                      <span className="text-[11px] text-slate-500 shrink-0">{n.osVersion}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">关联工作项目（可选）</label>
                <div className="space-y-1.5 max-h-32 overflow-y-auto clean-scroll">
                  {workspaces.map((w) => (
                    <label
                      key={w.id}
                      className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50/70 text-xs cursor-pointer hover:bg-slate-100/70"
                    >
                      <input
                        type="checkbox"
                        checked={selectedProjectIds.includes(w.id)}
                        onChange={() =>
                          toggleSelection(selectedProjectIds, w.id, setSelectedProjectIds)
                        }
                      />
                      <span className="font-medium text-slate-800 truncate">{w.name}</span>
                    </label>
                  ))}
                </div>
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
                  className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white cursor-pointer"
                >
                  {selectedPlan.billingMode === 'permanent'
                    ? `确认购买 ($${selectedPlan.priceUsd} 永久)`
                    : `确认租用 ($${selectedPlan.priceUsd}/月)`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
