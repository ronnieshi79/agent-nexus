import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, FolderKanban, Menu, PanelLeftOpen } from 'lucide-react';
import { WORKSPACE_GUTTER_CLASS } from '../shared/ViewToolbar';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

export interface TopbarProjectOption {
  id: string;
  label: string;
  hint?: string;
  statusLabel?: string;
}

interface TopbarProjectSelectorProps {
  value: string;
  options: TopbarProjectOption[];
  onChange: (nextId: string) => void;
  ariaLabel?: string;
}

export function TopbarProjectSelector({
  value,
  options,
  onChange,
  ariaLabel = '切换当前项目',
}: TopbarProjectSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const activeOpt = options.find((o) => o.id === value) || options[0];

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  if (!activeOpt) return null;

  return (
    <div ref={containerRef} className="relative inline-block shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`inline-flex items-center justify-between gap-2 h-9 pl-2 pr-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
          open
            ? 'bg-white border-slate-900 ring-2 ring-slate-900/10'
            : 'bg-slate-50/80 border-slate-200 hover:border-slate-300 hover:bg-slate-100/70'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-5 h-5 rounded bg-blue-600 text-white inline-flex items-center justify-center shrink-0">
            <FolderKanban className="w-3 h-3" />
          </span>
          <span className="text-[13px] font-bold text-slate-900 whitespace-nowrap truncate max-w-[150px] sm:max-w-[240px]">
            {activeOpt.label}
          </span>
          {activeOpt.hint && (
            <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-mono tabular-nums text-slate-400 whitespace-nowrap shrink-0">
              <span aria-hidden="true">·</span>
              <span>{activeOpt.hint}</span>
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${
            open ? 'rotate-180 text-slate-700' : ''
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-1/2 -translate-x-1/2 mt-1.5 w-[min(320px,calc(100vw-2rem))] bg-white rounded-xl border border-slate-200 shadow-lg p-1.5 z-50 space-y-0.5"
        >
          <div className="px-2.5 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            切换工作项目 ({options.length})
          </div>
          {options.map((opt) => {
            const isSelected = opt.id === activeOpt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                  isSelected ? 'bg-slate-900 text-white' : 'text-slate-800 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-5 h-5 rounded inline-flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-white/15 text-sky-300' : 'bg-blue-50 text-blue-600'
                    }`}
                  >
                    <FolderKanban className="w-3 h-3" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">{opt.label}</div>
                    {(opt.hint || opt.statusLabel) && (
                      <div
                        className={`text-[11px] font-mono tabular-nums truncate mt-0.5 ${
                          isSelected ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        {[opt.hint, opt.statusLabel].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-sky-300 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface TopHeaderProps {
  breadcrumbs: BreadcrumbItem[];
  centerContent?: ReactNode;
  rightActions?: ReactNode;
  sidebarCollapsed?: boolean;
  onToggleSidebarCollapse?: () => void;
  onOpenMobileMenu: () => void;
}

export function TopHeader({
  breadcrumbs,
  centerContent,
  rightActions,
  sidebarCollapsed = false,
  onToggleSidebarCollapse,
  onOpenMobileMenu,
}: TopHeaderProps) {
  return (
    <header
      className={`h-14 shrink-0 bg-white border-b border-slate-200 ${WORKSPACE_GUTTER_CLASS} flex sm:grid sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center justify-between gap-3 relative z-30`}
    >
      {/* Left Zone: Mobile Toggle + Sidebar Expand + Unified 1st-Level Navigation */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer shrink-0"
          aria-label="打开导航菜单"
        >
          <Menu className="w-5 h-5" />
        </button>

        {sidebarCollapsed && onToggleSidebarCollapse && (
          <button
            type="button"
            onClick={onToggleSidebarCollapse}
            title="展开左侧栏"
            aria-label="展开左侧栏"
            className="hidden lg:inline-flex items-center justify-center p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        )}

        <nav aria-label="页面导航路径" className="flex items-center gap-2 min-w-0">
          {breadcrumbs.map((item, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === breadcrumbs.length - 1;
            const clickable = Boolean(item.onClick);
            return (
              <div
                key={`${item.label}-${idx}`}
                className={`flex items-center gap-2 ${isLast ? 'min-w-0' : 'shrink-0'}`}
              >
                {idx > 0 && (
                  <span className="text-slate-300 select-none shrink-0" aria-hidden="true">
                    /
                  </span>
                )}
                {clickable ? (
                  <button
                    type="button"
                    onClick={item.onClick}
                    className={`transition-colors cursor-pointer whitespace-nowrap ${
                      isFirst
                        ? 'text-sm font-bold text-slate-900 hover:text-blue-700'
                        : 'text-xs sm:text-sm font-medium text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ) : (
                  <span
                    className={
                      isFirst
                        ? 'text-sm font-bold text-slate-900 whitespace-nowrap truncate'
                        : 'text-xs sm:text-sm font-semibold text-slate-800 truncate'
                    }
                    title={item.label}
                  >
                    {item.label}
                  </span>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Center Zone: Contextual Project / Community Dropdown Switcher */}
      <div className="flex items-center justify-center min-w-0">{centerContent}</div>

      {/* Right Zone: Optional Right Actions (balances 3-column grid so centerContent stays truly centered) */}
      <div className="hidden sm:flex items-center justify-end gap-1.5 min-w-0">
        {rightActions}
      </div>
      {rightActions && (
        <div className="flex sm:hidden items-center justify-end gap-1.5 shrink-0">
          {rightActions}
        </div>
      )}
    </header>
  );
}
