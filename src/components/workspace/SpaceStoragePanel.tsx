import { useState, type FormEvent } from 'react';
import {
  Check,
  Database,
  Lock,
  Plus,
  Server,
  ShoppingBag,
} from 'lucide-react';
import type {
  ComputeNode,
  ExpertAgent,
  ProjectWorkspace,
  StorageBillingMode,
  StorageVolume,
} from '../../types/agentnexus';
import { ModalShell } from '../shared/UiPrimitives';

interface StoragePlanPreset {
  id: string;
  tierLabel: string;
  audience: string;
  quotaGb: number;
  billingMode: StorageBillingMode;
  priceUsd: number;
  tagline: string;
}

const STORAGE_PLANS: StoragePlanPreset[] = [
  {
    id: 'monthly_100',
    tierLabel: '标准共享云存储',
    audience: '适合个人多节点共享',
    quotaGb: 100,
    billingMode: 'monthly',
    priceUsd: 9,
    tagline: '适合个人多节点共享代码仓库、上下文知识库与日常产物',
  },
  {
    id: 'monthly_500',
    tierLabel: '高速团队共享云存储',
    audience: '适合多 Agent 并发协作',
    quotaGb: 500,
    billingMode: 'monthly',
    priceUsd: 29,
    tagline: '高吞吐低延迟，支持多路 CLI Agent 并发读写同一项目工作目录',
  },
  {
    id: 'permanent_200',
    tierLabel: '永久云存储买断包（200GB）',
    audience: '适合长期资产归档',
    quotaGb: 200,
    billingMode: 'permanent',
    priceUsd: 199,
    tagline: '一次性买断永久保留，适合核心项目资产、规范文档与交付归档',
  },
  {
    id: 'permanent_1000',
    tierLabel: '旗舰永久云存储包（1TB）',
    audience: '适合企业级多区域共享',
    quotaGb: 1000,
    billingMode: 'permanent',
    priceUsd: 599,
    tagline: '企业级多副本加密永久云盘，支持跨 Win11 / Linux / macOS 节点秒级挂载',
  },
];

interface SpaceStoragePanelProps {
  mode: 'list' | 'purchase';
  volumes: StorageVolume[];
  nodes: ComputeNode[];
  agents: ExpertAgent[];
  workspaces: ProjectWorkspace[];
  searchKeyword: string;
  billingFilter: 'all' | StorageBillingMode;
  mountDrawerOpen: boolean;
  onChangeMountDrawerOpen: (open: boolean) => void;
  onOpenPurchasePage: () => void;
  onReturnToList: () => void;
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
  onToggleNodeStorageMount?: (nodeId: string, volumeId: string) => void;
}

export function SpaceStoragePanel({
  mode,
  volumes,
  nodes,
  agents,
  workspaces,
  searchKeyword,
  billingFilter,
  mountDrawerOpen,
  onChangeMountDrawerOpen,
  onOpenPurchasePage,
  onReturnToList,
  onCreateVolume,
  onExpandVolume,
  onToggleNodeStorageMount,
}: SpaceStoragePanelProps) {
  // Self-mounted NAS / S3 / OSS Drawer State
  const [customName, setCustomName] = useState('');
  const [customProtocol, setCustomProtocol] = useState('S3 / OSS 对象存储');
  const [customRegion, setCustomRegion] = useState('自建存储 · 内网 NAS / S3');
  const [customQuotaGb, setCustomQuotaGb] = useState(500);
  const [customNodeIds, setCustomNodeIds] = useState<string[]>(
    nodes.filter((n) => n.status === 'online').map((n) => n.id),
  );
  const [customProjectIds, setCustomProjectIds] = useState<string[]>([]);

  // Secondary Procurement Page (Platform Cloud Storage) State
  const [purchaseRegion, setPurchaseRegion] = useState('华东-上海多可用区');
  const [purchaseNamePrefix, setPurchaseNamePrefix] = useState('');
  const [purchaseNodeIds, setPurchaseNodeIds] = useState<string[]>(
    nodes.filter((n) => n.status === 'online').map((n) => n.id),
  );

  const q = searchKeyword.trim().toLowerCase();
  const filteredVolumes = volumes.filter((v) => {
    if (billingFilter !== 'all' && v.billingMode !== billingFilter) return false;
    if (!q) return true;
    return (
      v.name.toLowerCase().includes(q) ||
      v.tierLabel.toLowerCase().includes(q) ||
      v.region.toLowerCase().includes(q) ||
      v.mountPath.toLowerCase().includes(q)
    );
  });

  const filteredPlans = STORAGE_PLANS.filter((plan) => {
    if (billingFilter !== 'all' && plan.billingMode !== billingFilter) return false;
    if (!q) return true;
    return (
      plan.tierLabel.toLowerCase().includes(q) ||
      plan.tagline.toLowerCase().includes(q) ||
      plan.audience.toLowerCase().includes(q)
    );
  });

  const totalQuotaGb = volumes.reduce((s, v) => s + v.quotaGb, 0);
  const totalUsedGb = volumes.reduce((s, v) => s + v.usedGb, 0);
  const overallPct =
    totalQuotaGb > 0 ? Math.min(100, Math.round((totalUsedGb / totalQuotaGb) * 100)) : 0;
  const monthlyStorageFee = volumes
    .filter((v) => v.billingMode === 'monthly')
    .reduce((s, v) => s + v.priceUsd, 0);
  const connectedAgentCount = agents.filter((a) =>
    Boolean(a.storageVolumeId || a.cliConfig?.storageVolumeId),
  ).length;

  const toggleSelection = (list: string[], id: string, setter: (v: string[]) => void) => {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const handleSelfMountSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    onCreateVolume({
      name: customName.trim(),
      tierLabel: `自有挂载 · ${customProtocol}`,
      region: customRegion.trim() || '自有存储挂载',
      quotaGb: Math.max(20, Number(customQuotaGb) || 500),
      billingMode: 'permanent',
      priceUsd: 0,
      encrypted: true,
      boundNodeIds: customNodeIds,
      boundProjectIds: customProjectIds,
    });
    setCustomName('');
    setCustomProjectIds([]);
    onChangeMountDrawerOpen(false);
  };

  const handlePurchasePlan = (plan: StoragePlanPreset) => {
    const effectiveName = purchaseNamePrefix.trim()
      ? `${purchaseNamePrefix.trim()} · ${plan.quotaGb >= 1000 ? `${plan.quotaGb / 1000}TB` : `${plan.quotaGb}GB`}`
      : `${plan.tierLabel} · ${purchaseRegion.slice(0, 4)}`;
    onCreateVolume({
      name: effectiveName,
      tierLabel: plan.tierLabel,
      region: purchaseRegion,
      quotaGb: plan.quotaGb,
      billingMode: plan.billingMode,
      priceUsd: plan.priceUsd,
      encrypted: true,
      boundNodeIds: purchaseNodeIds,
      boundProjectIds: [],
    });
    setPurchaseNamePrefix('');
    onReturnToList();
  };

  /* ================= SECONDARY PAGE: PLATFORM CLOUD STORAGE PROCUREMENT ================= */
  if (mode === 'purchase') {
    return (
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            <strong className="text-slate-900">AGN 平台共享云存储采购</strong>
            <span className="mx-1.5 text-slate-300" aria-hidden="true">·</span>
            <span>多 Agent 协同共享读写目录，支持按月租用或一次性永久买断，跨节点实时加密同步</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
              <span className="whitespace-nowrap">可用区</span>
              <select
                value={purchaseRegion}
                onChange={(e) => setPurchaseRegion(e.target.value)}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-900 focus:outline-none"
              >
                <option value="华东-上海多可用区">华东-上海多可用区</option>
                <option value="华北-北京多可用区">华北-北京多可用区</option>
                <option value="亚太-新加坡高可用">亚太-新加坡高可用</option>
                <option value="美西-硅谷高可用">美西-硅谷高可用</option>
              </select>
            </label>
            <input
              type="text"
              value={purchaseNamePrefix}
              onChange={(e) => setPurchaseNamePrefix(e.target.value)}
              placeholder="自定义存储名称（可选）"
              className="h-8 w-44 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-900 focus:outline-none"
            />
          </div>
        </div>

        {/* Default Auto-Mount Node Selector */}
        {nodes.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
            <span className="text-[11px] font-semibold text-slate-500 mr-1">
              开通后默认挂载节点：
            </span>
            {nodes.map((n) => {
              const selected = purchaseNodeIds.includes(n.id);
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => toggleSelection(purchaseNodeIds, n.id, setPurchaseNodeIds)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium cursor-pointer transition-colors ${
                    selected
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-800'
                      : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {selected && <Check className="w-3 h-3 text-indigo-600" />}
                  <span>{n.name}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Unified List Layout: Left = Storage Plan Summary, Right = Capacity & Purchase */}
        {filteredPlans.length === 0 ? (
          <div className="py-12 text-center rounded-xl border border-dashed border-slate-300 bg-white text-xs text-slate-500">
            当前筛选下暂无匹配的平台云存储套餐
          </div>
        ) : (
          <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
            <div className="hidden @[860px]:grid @[860px]:grid-cols-[minmax(280px,360px)_minmax(0,1fr)_180px] @[860px]:items-center @[860px]:gap-6 px-5 py-2.5 bg-slate-50/90 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
              <div>平台存储方案</div>
              <div>容量规格与适用场景</div>
              <div className="text-right">费用与采购</div>
            </div>

            <div className="divide-y divide-slate-200">
              {filteredPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="px-5 py-4 grid grid-cols-1 @[860px]:grid-cols-[minmax(280px,360px)_minmax(0,1fr)_180px] @[860px]:items-center gap-4 @[860px]:gap-6 hover:bg-slate-50/60 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                      <Database className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900">{plan.tierLabel}</h3>
                      <div className="mt-0.5 text-[11px] text-slate-500 flex flex-wrap items-center gap-x-1.5">
                        <span
                          className={
                            plan.billingMode === 'permanent'
                              ? 'text-emerald-700 font-semibold'
                              : 'text-blue-700 font-semibold'
                          }
                        >
                          {plan.billingMode === 'permanent' ? '一次买断永久' : '按月灵活租用'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{plan.audience}</span>
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="text-xs font-mono tabular-nums font-semibold text-slate-800">
                      {plan.quotaGb >= 1000 ? `${plan.quotaGb / 1000} TB` : `${plan.quotaGb} GB`} 加密持久化存储 · 多节点并发挂载
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{plan.tagline}</p>
                  </div>

                  <div className="flex @[860px]:flex-col @[860px]:items-end items-center justify-between gap-2 shrink-0">
                    <div className="font-mono tabular-nums text-right">
                      <span className="text-base font-bold text-slate-900">${plan.priceUsd}</span>
                      <span className="text-xs text-slate-500">
                        {plan.billingMode === 'permanent' ? ' 永久' : ' / 月'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePurchasePlan(plan)}
                      className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>立即采购开通</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ================= PRIMARY PAGE: MY AGENT STORAGE UNIFIED LIST ================= */
  return (
    <div className="space-y-4">
      {/* Concise Single-Line Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>
            存储空间 <strong className="font-mono tabular-nums text-slate-900">{volumes.length}</strong> 个
          </span>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <span className="font-mono tabular-nums text-slate-700">
            总已用 {totalUsedGb} / {totalQuotaGb} GB ({overallPct}%)
          </span>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <span>
            协同 Agent <strong className="font-mono tabular-nums text-slate-900">{connectedAgentCount}</strong> 位
          </span>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <span>
            云存储月租 <strong className="font-mono tabular-nums text-slate-900">${monthlyStorageFee}/月</strong>
          </span>
        </div>
        <span className="text-xs font-mono tabular-nums text-slate-400 shrink-0">
          共 {filteredVolumes.length} 个存储
        </span>
      </div>

      {/* Unified Bordered List: Left = Storage Summary, Right = Node Mounts, Collaboration & Expansion */}
      {filteredVolumes.length === 0 ? (
        <div className="py-14 text-center rounded-xl border border-dashed border-slate-300 bg-white space-y-3">
          <p className="text-sm font-medium text-slate-700">当前筛选下暂无 Agent 存储空间</p>
          <p className="text-xs text-slate-500">
            可免费挂载自有 NAS / S3 对象存储，或前往平台采购高速共享云盘。
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => onChangeMountDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>挂载自有存储</span>
            </button>
            <button
              type="button"
              onClick={onOpenPurchasePage}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>平台采购存储</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl bg-white overflow-hidden mb-16">
          {/* Desktop Column Header */}
          <div className="hidden @[900px]:grid @[900px]:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] @[900px]:items-center @[900px]:gap-6 px-5 py-2.5 bg-slate-50/90 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
            <div>存储概要</div>
            <div>节点挂载与协同配置</div>
          </div>

          <div className="divide-y divide-slate-200">
            {filteredVolumes.map((vol) => {
              const pct = Math.min(100, Math.round((vol.usedGb / Math.max(1, vol.quotaGb)) * 100));
              const boundProjects = workspaces.filter((w) => vol.boundProjectIds.includes(w.id));
              const boundAgents = agents.filter(
                (a) => (a.storageVolumeId || a.cliConfig?.storageVolumeId) === vol.id,
              );
              const isSelfHosted = vol.priceUsd === 0;

              return (
                <div
                  key={vol.id}
                  className="px-5 py-4 grid grid-cols-1 @[900px]:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] gap-4 @[900px]:gap-6 hover:bg-slate-50/40 transition-colors"
                >
                  {/* LEFT COLUMN: Storage Summary & Usage Bar */}
                  <div className="min-w-0 space-y-2.5 @[900px]:pr-4 @[900px]:border-r @[900px]:border-slate-100">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                        <Database className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <h3 className="text-sm font-bold text-slate-900 truncate">{vol.name}</h3>
                          <span
                            className={`text-xs font-semibold whitespace-nowrap ${
                              isSelfHosted
                                ? 'text-slate-600'
                                : vol.billingMode === 'permanent'
                                  ? 'text-emerald-700'
                                  : 'text-blue-700'
                            }`}
                          >
                            {isSelfHosted
                              ? '自有挂载 · 免费'
                              : vol.billingMode === 'permanent'
                                ? `永久买断 $${vol.priceUsd}`
                                : `月租 $${vol.priceUsd}/月`}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                          <span>{vol.tierLabel}</span>
                          <span aria-hidden="true">·</span>
                          <span>{vol.region}</span>
                          {vol.encrypted && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-0.5 text-emerald-700">
                                <Lock className="w-2.5 h-2.5" />
                                <span>加密</span>
                              </span>
                            </>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 truncate">
                          {vol.mountPath}
                        </div>
                      </div>
                    </div>

                    {/* Capacity Bar */}
                    <div className="pl-12 space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                        <span className="text-slate-500">已用容量</span>
                        <span className="font-semibold text-slate-800">
                          {vol.usedGb} / {vol.quotaGb} GB ({pct}%)
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
                  </div>

                  {/* RIGHT COLUMN: Mounted Nodes Configuration + Collaboration Metadata + Expand */}
                  <div className="min-w-0 flex flex-col justify-between gap-3">
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                        <div className="text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5">
                          <Server className="w-3.5 h-3.5 text-slate-500" />
                          <span>挂载到 Agent 节点（点击切换挂载状态）</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onExpandVolume(vol.id, 100)}
                          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-800 cursor-pointer whitespace-nowrap"
                        >
                          <Plus className="w-3 h-3" />
                          <span>扩容 +100GB</span>
                        </button>
                      </div>

                      {nodes.length === 0 ? (
                        <div className="text-xs text-slate-400">
                          当前暂无 Agent 节点，前往「Agent 节点」挂载或采购节点后即可关联。
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {nodes.map((n) => {
                            const mounted =
                              n.mountedStorageIds.includes(vol.id) ||
                              vol.boundNodeIds.includes(n.id);
                            return (
                              <button
                                key={n.id}
                                type="button"
                                disabled={!onToggleNodeStorageMount}
                                onClick={() => onToggleNodeStorageMount?.(n.id, vol.id)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors cursor-pointer ${
                                  mounted
                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-800 hover:bg-indigo-100'
                                    : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300'
                                }`}
                              >
                                {mounted && <Check className="w-3 h-3 text-indigo-600" />}
                                <span>{n.name}</span>
                                <span className="text-[10px] font-mono opacity-70">
                                  {n.os.toUpperCase()}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Clean Unboxed Metadata Footer */}
                    <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                      <span>
                        共享 Agent：
                        {boundAgents.length === 0 ? (
                          <span className="text-slate-400">可在自建 Agent 配置中选择</span>
                        ) : (
                          <span className="font-semibold text-slate-800">
                            {boundAgents.map((a) => a.handle).join('、')}
                          </span>
                        )}
                      </span>
                      <span className="text-slate-300" aria-hidden="true">·</span>
                      <span>
                        关联项目：
                        {boundProjects.length === 0 ? (
                          <span className="text-slate-400">全项目通用</span>
                        ) : (
                          <span className="font-semibold text-blue-700">
                            {boundProjects.map((p) => p.name).join('、')}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal: Self-Mount Private Storage (NAS / S3 / OSS) */}
      <ModalShell
        open={mountDrawerOpen}
        onClose={() => onChangeMountDrawerOpen(false)}
        icon={<Database className="w-4 h-4 text-blue-600" />}
        title="挂载自有存储空间"
        subtitle="接入团队自有 S3、OSS、NFS 或局域网 NAS 目录供多 Agent 共享读写，零平台月租。"
        maxWidthClass="max-w-lg"
        onSubmit={handleSelfMountSubmit}
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                onChangeMountDrawerOpen(false);
                onOpenPurchasePage();
              }}
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
            >
              需要免运维高速云盘？去平台采购 →
            </button>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onChangeMountDrawerOpen(false)}
                className="h-8 px-3.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                取消
              </button>
              <button
                type="submit"
                className="h-8 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
              >
                确认挂载
              </button>
            </div>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">存储空间名称 *</label>
            <input
              type="text"
              required
              autoFocus
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="例如：研发内网 NAS 共享仓 / 自建 MinIO 资产桶"
              className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">接入协议</label>
              <select
                value={customProtocol}
                onChange={(e) => setCustomProtocol(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none"
              >
                <option value="S3 / OSS 对象存储">S3 / OSS 对象存储</option>
                <option value="局域网 NAS / NFS">局域网 NAS / NFS</option>
                <option value="WebDAV / SMB 共享盘">WebDAV / SMB 共享盘</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">可用容量配额 (GB)</label>
              <input
                type="number"
                min={20}
                max={20000}
                value={customQuotaGb}
                onChange={(e) => setCustomQuotaGb(Number(e.target.value))}
                className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">位置 / Endpoint 备注</label>
            <input
              type="text"
              value={customRegion}
              onChange={(e) => setCustomRegion(e.target.value)}
              placeholder="例如：内网 10.0.12.88 · /mnt/agn-shared"
              className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:bg-white focus:outline-none"
            />
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
                      checked={customNodeIds.includes(n.id)}
                      onChange={() => toggleSelection(customNodeIds, n.id, setCustomNodeIds)}
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
            <div className="space-y-1.5 max-h-28 overflow-y-auto clean-scroll">
              {workspaces.map((w) => (
                <label
                  key={w.id}
                  className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50/70 text-xs cursor-pointer hover:bg-slate-100/70"
                >
                  <input
                    type="checkbox"
                    checked={customProjectIds.includes(w.id)}
                    onChange={() =>
                      toggleSelection(customProjectIds, w.id, setCustomProjectIds)
                    }
                  />
                  <span className="font-medium text-slate-800 truncate">{w.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </ModalShell>
    </div>
  );
}
