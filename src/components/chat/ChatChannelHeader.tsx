import type { ReactNode } from 'react';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';

interface ChatChannelHeaderProps {
  avatar: ReactNode;
  title: string;
  tag?: string;
  tagClassName?: string;
  subtitle: string;
  panelOpen: boolean;
  panelToggleLabel: string;
  onTogglePanel: () => void;
  extraAction?: ReactNode;
}

export function ChatChannelHeader({
  avatar,
  title,
  tag,
  tagClassName = 'text-slate-600',
  subtitle,
  panelOpen,
  panelToggleLabel,
  onTogglePanel,
  extraAction,
}: ChatChannelHeaderProps) {
  return (
    <div className="h-[60px] shrink-0 px-5 border-b border-slate-200 bg-white flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {avatar}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <h2 className="text-sm font-bold text-slate-900 truncate">{title}</h2>
            {tag && (
              <span className={`text-[11px] font-semibold whitespace-nowrap shrink-0 ${tagClassName}`}>
                · {tag}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 truncate mt-0.5">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {extraAction}
        <button
          type="button"
          onClick={onTogglePanel}
          title={panelOpen ? `收起${panelToggleLabel}` : `展开${panelToggleLabel}`}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          {panelOpen ? (
            <>
              <PanelRightClose className="w-3.5 h-3.5 text-slate-500" />
              <span>收起侧栏</span>
            </>
          ) : (
            <>
              <PanelRightOpen className="w-3.5 h-3.5 text-blue-600" />
              <span>{panelToggleLabel}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
