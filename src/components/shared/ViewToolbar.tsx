import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

/** Shared horizontal gutter and max-width tokens so ViewToolbar and page content stay mathematically flush-aligned */
export const WORKSPACE_GUTTER_CLASS = 'px-4 sm:px-6 lg:px-8';
export const WORKSPACE_MAX_WIDTH_CLASS = 'max-w-[1360px] mx-auto w-full';

/**
 * Subtle typographic brand backdrop rendered uniformly near the bottom whitespace of every module's left menu rail.
 */
export function RailBrandBackdrop({ compact = false }: { compact?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`${compact ? 'pt-12 pb-3 px-2.5' : 'mt-auto pt-14 pb-1 px-2.5'} select-none pointer-events-none`}
    >
      <p className="text-[11px] font-medium leading-relaxed text-slate-300 tracking-wide">
        FDE / OPC 专属的
        <br />
        网络专业 Agent 团队
      </p>
    </div>
  );
}

/**
 * Full-height far-left primary filter rail shared across Market, Community, Kanban, Team, and Artifacts.
 * Anchored at the far-left edge so the right-side ViewToolbar (search & secondary filters) aligns flush with content.
 */
export function WorkspacePrimaryRail({
  ariaLabel,
  children,
  footer,
  showBackdrop = true,
}: {
  ariaLabel: string;
  children: ReactNode;
  footer?: ReactNode;
  showBackdrop?: boolean;
}) {
  return (
    <aside
      aria-label={ariaLabel}
      className="hidden @[760px]/shell:flex flex-col w-[192px] @[1280px]/shell:w-[208px] shrink-0 border-r border-slate-200 bg-white overflow-y-auto clean-scroll px-2.5 py-3.5"
    >
      <div className="space-y-3">{children}</div>
      {showBackdrop && <RailBrandBackdrop />}
      {footer && <div className={showBackdrop ? 'pt-4' : 'mt-auto pt-6'}>{footer}</div>}
    </aside>
  );
}

export function RailSectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2.5 pt-1 pb-1 text-[11px] font-semibold text-slate-400 tracking-wide">
      {children}
    </div>
  );
}

export function RailNavButton({
  active,
  variant = 'primary',
  disabled = false,
  icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  variant?: 'primary' | 'subtle';
  disabled?: boolean;
  icon?: ReactNode;
  label: string;
  count?: number | string;
  onClick: () => void;
}) {
  const cls =
    variant === 'primary'
      ? active
        ? 'bg-slate-900 text-white font-semibold shadow-2xs'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-semibold'
      : active
        ? 'bg-slate-100 text-slate-900 font-semibold'
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${cls}`}
    >
      <span className="inline-flex items-center gap-2 min-w-0 truncate">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      {count !== undefined && (
        <span
          className={`text-[11px] font-mono tabular-nums shrink-0 ${
            active && variant === 'primary' ? 'text-slate-300' : 'text-slate-400'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/**
 * Unified single-row workspace toolbar container shared across Market, Community, Kanban, Team, etc.
 * All child mini-widgets conform to a strict 32px (h-8) control height and 1px hairline grammar.
 */
export function ViewToolbar({
  left,
  right,
  subStrip,
  maxWidthClass = WORKSPACE_MAX_WIDTH_CLASS,
}: {
  left: ReactNode;
  right?: ReactNode;
  /** Optional thin strip rendered ONLY when active contextual filters/banners exist */
  subStrip?: ReactNode;
  /** Override max-width container class if a specific view uses a custom width */
  maxWidthClass?: string;
}) {
  return (
    <div className={`shrink-0 bg-white border-b border-slate-200 ${WORKSPACE_GUTTER_CLASS} py-2.5`}>
      <div className={`${maxWidthClass} flex flex-wrap items-center justify-between gap-x-3 gap-y-2`}>
        <div className="flex items-center gap-2 flex-wrap min-w-0">{left}</div>
        {right && (
          <div className="flex items-center gap-2 flex-wrap min-w-0 ml-auto justify-end">
            {right}
          </div>
        )}
      </div>
      {subStrip && <div className={`${maxWidthClass} mt-2`}>{subStrip}</div>}
    </div>
  );
}

/** Hairline vertical separator between mounted toolbar widget groups */
export function ToolbarDivider() {
  return <span className="hidden sm:inline-block h-4 w-px bg-slate-200 shrink-0" aria-hidden="true" />;
}

/** Compact h-8 segmented switcher mini-widget */
export function ToolbarSegment<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { id: T; label: string; count?: number; icon?: ReactNode }[];
}) {
  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 h-8 rounded-lg bg-slate-100 border border-slate-200/70 max-w-full overflow-x-auto shrink-0">
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`inline-flex items-center gap-1 h-[26px] px-2.5 rounded-md text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              active
                ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            {opt.icon}
            <span>{opt.label}</span>
            {opt.count !== undefined && (
              <span
                className={`font-mono tabular-nums text-[11px] ${
                  active ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Compact h-8 dropdown filter mini-widget */
export function ToolbarDropdown<T extends string>({
  label,
  value,
  defaultValue,
  options,
  onChange,
  icon,
  align = 'left',
}: {
  label: string;
  value: T;
  defaultValue?: T;
  options: { id: T; label: string; hint?: string }[];
  onChange: (next: T) => void;
  icon?: ReactNode;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    window.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const activeOpt = options.find((o) => o.id === value) || options[0];
  const isFiltered = defaultValue !== undefined && value !== defaultValue;

  return (
    <div ref={ref} className="relative inline-block shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs transition-colors whitespace-nowrap cursor-pointer ${
          isFiltered
            ? 'bg-blue-50/70 border-blue-300 text-blue-800 font-semibold'
            : open
              ? 'bg-slate-50 border-slate-400 text-slate-900 font-medium'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 text-slate-700 font-medium'
        }`}
      >
        {icon}
        <span className={isFiltered ? 'text-blue-600 font-normal' : 'text-slate-400 font-normal'}>
          {label}
        </span>
        <span className="max-w-[110px] truncate">{activeOpt?.label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 transition-transform ${
            open ? 'rotate-180' : ''
          } ${isFiltered ? 'text-blue-600' : 'text-slate-400'}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className={`absolute ${
            align === 'right' ? 'right-0' : 'left-0'
          } mt-1.5 min-w-[180px] max-w-[260px] bg-white rounded-xl border border-slate-200 shadow-lg p-1 z-40 space-y-0.5`}
        >
          {options.map((opt) => {
            const selected = opt.id === value;
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors cursor-pointer ${
                  selected
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="truncate">{opt.label}</span>
                <span className="flex items-center gap-1.5 shrink-0">
                  {opt.hint && (
                    <span
                      className={`text-[10px] font-mono tabular-nums ${
                        selected ? 'text-slate-300' : 'text-slate-400'
                      }`}
                    >
                      {opt.hint}
                    </span>
                  )}
                  {selected && <Check className="w-3.5 h-3.5 text-sky-300 shrink-0" />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Compact h-8 search input mini-widget with clear button */
export function ToolbarSearch({
  value,
  onChange,
  placeholder,
  widthClass = 'w-44 sm:w-52',
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  widthClass?: string;
}) {
  return (
    <div className={`relative shrink-0 ${widthClass}`}>
      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-8 bg-slate-50/80 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 rounded-lg pl-8 pr-7 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/15 transition-colors"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="清空搜索"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

/** Compact h-8 button that mounts a floating popover widget on demand (e.g. AI 选人顾问) */
export function ToolbarPopoverWidget({
  open,
  onOpenChange,
  triggerLabel,
  triggerIcon,
  activeHighlight = false,
  widthClass = 'w-[340px] sm:w-[400px]',
  children,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  triggerLabel: string;
  triggerIcon?: ReactNode;
  activeHighlight?: boolean;
  widthClass?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOpenChange(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('mousedown', onOutside);
    window.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={ref} className="relative inline-block shrink-0">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
          activeHighlight || open
            ? 'bg-blue-50 border-blue-300 text-blue-700'
            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
        }`}
      >
        {triggerIcon}
        <span>{triggerLabel}</span>
      </button>

      {open && (
        <div
          className={`absolute right-0 mt-1.5 ${widthClass} max-w-[92vw] bg-white rounded-xl border border-slate-200 shadow-xl p-3.5 z-40`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
