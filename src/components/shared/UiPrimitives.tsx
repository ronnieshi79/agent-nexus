import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  icon?: ReactNode;
  maxWidthClass?: string;
  onSubmit?: (e: FormEvent) => void;
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * Unified single-elevation modal dialog shell shared across Community, Events, and Workspace flows.
 * Handles backdrop dismiss, Escape key close, consistent 20px padding, and hairline dividers.
 */
export function ModalShell({
  open,
  onClose,
  title,
  subtitle,
  icon,
  maxWidthClass = 'max-w-lg',
  onSubmit,
  footer,
  children,
}: ModalShellProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const content = (
    <>
      <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="shrink-0">{icon}</span>}
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 truncate">{title}</h2>
            {subtitle && (
              <div className="text-[11px] text-slate-500 mt-0.5 truncate">{subtitle}</div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭弹窗"
          className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 inline-flex items-center justify-center cursor-pointer shrink-0 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 max-h-[75vh] overflow-y-auto clean-scroll">{children}</div>

      {footer && (
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          {footer}
        </div>
      )}
    </>
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {onSubmit ? (
        <form
          onSubmit={onSubmit}
          onClick={(e) => e.stopPropagation()}
          className={`w-full ${maxWidthClass} bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden`}
        >
          {content}
        </form>
      ) : (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`w-full ${maxWidthClass} bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden`}
        >
          {content}
        </div>
      )}
    </div>
  );
}

interface EmptyStateCardProps {
  icon?: ReactNode;
  title?: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
}

/**
 * Standardized empty state card used consistently across Kanban, Community, Events, and Space views.
 */
export function EmptyStateCard({
  icon,
  title,
  description,
  action,
  compact = false,
}: EmptyStateCardProps) {
  return (
    <div
      className={`bg-white rounded-xl border border-dashed border-slate-300 text-center ${
        compact ? 'py-9 px-5 space-y-2' : 'py-12 px-6 space-y-2.5'
      }`}
    >
      {icon && <div className="inline-flex items-center justify-center text-slate-400">{icon}</div>}
      {title && <p className="text-sm font-semibold text-slate-800">{title}</p>}
      <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">{description}</p>
      {action && <div className="pt-1 flex items-center justify-center gap-2">{action}</div>}
    </div>
  );
}

interface SloganCarouselProps {
  items: string[];
  intervalMs?: number;
}

/**
 * Subtle multi-slogan subtitle rotator with pause-on-hover and manual dot selection.
 * Uses compositor-only opacity/transform transitions for smooth, non-distracting motion.
 */
export function SloganCarousel({ items, intervalMs = 4200 }: SloganCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || items.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % items.length);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, items.length, paused]);

  if (items.length === 0) return null;

  return (
    <div
      className="mt-2.5 flex flex-col items-center gap-2"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative h-6 w-full max-w-xl overflow-hidden flex items-center justify-center">
        {items.map((text, idx) => {
          const isCurrent = idx === activeIndex;
          return (
            <p
              key={text}
              aria-hidden={!isCurrent}
              className={`absolute inset-x-0 text-center text-xs sm:text-sm font-medium text-slate-500 tracking-wide transition-all duration-300 ease-out whitespace-nowrap truncate px-2 ${
                isCurrent
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-2 pointer-events-none'
              }`}
            >
              {text}
            </p>
          );
        })}
      </div>

      {items.length > 1 && (
        <div
          className="inline-flex items-center gap-1.5"
          role="tablist"
          aria-label="标语切换"
        >
          {items.map((text, idx) => {
            const active = idx === activeIndex;
            return (
              <button
                key={text}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={`切换到第 ${idx + 1} 条标语`}
                onClick={() => setActiveIndex(idx)}
                className={`h-1 rounded-full transition-all duration-300 cursor-pointer ${
                  active
                    ? 'w-5 bg-slate-700'
                    : 'w-1.5 bg-slate-200 hover:bg-slate-400'
                }`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
