import { useState, type FormEvent } from 'react';
import {
  Briefcase,
  KanbanSquare,
  MessageSquareText,
  SendHorizontal,
  Store,
  UserCheck,
} from 'lucide-react';
import type { ServiceCardId, UserPerspective } from '../../types/agentnexus';

interface ContextBrainBarProps {
  activeCard: ServiceCardId;
  perspective: UserPerspective;
  recommendedCard: ServiceCardId;
  marketCount: number;
  hiredCount: number;
  reviewTaskCount: number;
  totalTaskCount: number;
  isBusy: boolean;
  onSelectCard: (card: ServiceCardId) => void;
  onSubmitIntent: (intent: string) => void;
}

const DECK_ITEMS: {
  id: ServiceCardId;
  label: string;
  metaphor: string;
  icon: typeof Store;
}[] = [
  { id: 'market', label: '专家市场', metaphor: '筛选雇佣', icon: Store },
  { id: 'chat', label: '团队群聊', metaphor: '@ 派单协作', icon: MessageSquareText },
  { id: 'kanban', label: '工作流看板', metaphor: '自动同步', icon: KanbanSquare },
  { id: 'expert', label: '专家能力端', metaphor: '绩效与接单', icon: UserCheck },
];

export function ContextBrainBar({
  activeCard,
  perspective,
  recommendedCard,
  marketCount,
  hiredCount,
  reviewTaskCount,
  totalTaskCount,
  isBusy,
  onSelectCard,
  onSubmitIntent,
}: ContextBrainBarProps) {
  const [intent, setIntent] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleaned = intent.trim();
    if (!cleaned || isBusy) return;
    onSubmitIntent(cleaned);
    setIntent('');
  };

  const getCountText = (id: ServiceCardId): string => {
    if (id === 'market') return `${marketCount} 位`;
    if (id === 'chat') return `${hiredCount} 人在群`;
    if (id === 'kanban') return reviewTaskCount > 0 ? `${reviewTaskCount} 待审` : `${totalTaskCount} 任务`;
    return perspective === 'expert' ? '接单中' : '供给端';
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-3">
      {/* Context-Aware AI Brain Command Capsule */}
      <form
        onSubmit={handleSubmit}
        className="skeuo-well rounded-2xl p-1.5 flex items-center gap-2"
      >
        <div className="pl-3 pr-1 text-slate-500 hidden sm:flex items-center gap-1.5 text-xs whitespace-nowrap shrink-0">
          <Briefcase className="w-3.5 h-3.5 text-blue-600" />
          <span className="font-medium text-slate-700">情境召唤</span>
        </div>

        <input
          type="text"
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          disabled={isBusy}
          placeholder="输入你现在想做的事（如：找一位架构专家审代码 / 推进支付测试 / 发布我的专家节点）..."
          className="flex-1 min-w-0 bg-white/90 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-200/80 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-500 transition-all"
        />

        <button
          type="submit"
          disabled={isBusy || !intent.trim()}
          className="skeuo-primary inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium text-white whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
        >
          <SendHorizontal className="w-3.5 h-3.5" />
          <span>{isBusy ? '感知中...' : '智能切换卡片'}</span>
        </button>
      </form>

      {/* Tactile Card Deck Switcher (No Traditional Menu Bar — Physical Card Tabs) */}
      <div
        role="tablist"
        aria-label="按需功能服务卡片"
        className="grid grid-cols-2 sm:grid-cols-4 gap-2.5"
      >
        {DECK_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeCard === item.id;
          const isRecommended = recommendedCard === item.id && !isActive;

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelectCard(item.id)}
              className={`relative text-left px-3.5 py-2.5 rounded-xl cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                isActive
                  ? 'bg-slate-900 text-white shadow-[0_8px_18px_-6px_rgba(15,23,42,0.45),inset_0_1px_0_rgba(255,255,255,0.16)] border border-slate-800 -translate-y-0.5'
                  : 'skeuo-key text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-sky-300' : 'text-slate-600'}`} />
                  {item.label}
                </span>
                <span
                  className={`text-xs font-mono tabular-nums whitespace-nowrap ${
                    isActive ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  {getCountText(item.id)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                <span className={isActive ? 'text-slate-300' : 'text-slate-500'}>
                  {item.metaphor}
                </span>
                {isRecommended && (
                  <span className="text-blue-600 font-medium whitespace-nowrap">
                    大脑推荐
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
