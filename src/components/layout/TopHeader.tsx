import type { ReactNode } from 'react';
import { Menu, PanelLeftOpen } from 'lucide-react';
import { WORKSPACE_GUTTER_CLASS } from '../shared/ViewToolbar';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface TopHeaderProps {
  breadcrumbs: BreadcrumbItem[];
  breadcrumbTrailing?: ReactNode;
  rightActions?: ReactNode;
  sidebarCollapsed?: boolean;
  onToggleSidebarCollapse?: () => void;
  onOpenMobileMenu: () => void;
}

export function TopHeader({
  breadcrumbs,
  breadcrumbTrailing,
  rightActions,
  sidebarCollapsed = false,
  onToggleSidebarCollapse,
  onOpenMobileMenu,
}: TopHeaderProps) {
  return (
    <header
      className={`h-14 shrink-0 bg-white border-b border-slate-200 ${WORKSPACE_GUTTER_CLASS} flex items-center justify-between gap-3 relative z-30`}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
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
            const isLast = idx === breadcrumbs.length - 1 && !breadcrumbTrailing;
            const clickable = Boolean(item.onClick) && !isLast;
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
                      isLast
                        ? isFirst
                          ? 'text-sm font-bold text-slate-900 truncate'
                          : 'text-xs sm:text-sm font-semibold text-slate-800 truncate'
                        : isFirst
                          ? 'text-sm font-bold text-slate-900 whitespace-nowrap'
                          : 'text-xs sm:text-sm font-medium text-slate-500 whitespace-nowrap'
                    }
                    title={item.label}
                  >
                    {item.label}
                  </span>
                )}
              </div>
            );
          })}

          {breadcrumbTrailing && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-slate-300 select-none shrink-0" aria-hidden="true">
                /
              </span>
              {breadcrumbTrailing}
            </div>
          )}
        </nav>
      </div>

      {rightActions && (
        <div className="flex items-center gap-1.5 shrink-0">{rightActions}</div>
      )}
    </header>
  );
}
