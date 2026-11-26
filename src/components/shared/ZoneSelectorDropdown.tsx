import { useEffect, useRef, useState } from 'react';
import { Building2, Check, ChevronDown, Globe, Lock, Plus } from 'lucide-react';
import type { CommunityZone } from '../../types/agentnexus';

interface ZoneSelectorDropdownProps {
  zones: CommunityZone[];
  activeZoneId: string;
  onSelectZone: (zoneId: string) => void;
  /** Optional stat label per zone, e.g. "4 动态 · 2 项目" or "5 位专家" */
  getZoneStat?: (zone: CommunityZone) => string;
  /** Optional membership controls (used in Community Discover) */
  joinedZoneIds?: string[];
  onToggleJoinZone?: (zoneId: string) => void;
  /** Optional quick link to Workspace -> Collaboration Spaces */
  onManageSpaces?: () => void;
  /** Visual density variant: 'topbar' sits centered in TopHeader; 'header' sits inline; 'rail' sits full-width inside left rail */
  variant?: 'default' | 'header' | 'rail' | 'topbar';
}

export function ZoneSelectorDropdown({
  zones,
  activeZoneId,
  onSelectZone,
  getZoneStat,
  joinedZoneIds,
  onToggleJoinZone,
  onManageSpaces,
  variant = 'default',
}: ZoneSelectorDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const activeZone = zones.find((z) => z.id === activeZoneId) || zones[0];
  const officialZones = zones.filter((z) => z.kind === 'official');
  const privateZones = zones.filter((z) => z.kind === 'private');

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

  const renderKindIcon = (zone: CommunityZone, cls = 'w-3 h-3 shrink-0') => {
    if (zone.kind === 'official') return <Globe className={cls} />;
    if (zone.privateScope === 'enterprise') return <Building2 className={cls} />;
    return <Lock className={cls} />;
  };

  const renderZoneItem = (z: CommunityZone) => {
    const isSelected = z.id === activeZone.id;
    const isOfficial = z.kind === 'official';
    const isJoined = isOfficial || (joinedZoneIds ? joinedZoneIds.includes(z.id) : true);
    const statText = getZoneStat ? getZoneStat(z) : `${z.memberCount} 成员`;

    return (
      <div
        key={z.id}
        role="option"
        aria-selected={isSelected}
        onClick={() => {
          onSelectZone(z.id);
          setOpen(false);
        }}
        className={`flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
          isSelected ? 'bg-slate-900 text-white' : 'text-slate-800 hover:bg-slate-100'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="w-6 h-6 rounded-md text-[11px] font-bold text-white inline-flex items-center justify-center shrink-0"
            style={{ backgroundColor: z.accentColor }}
          >
            {z.shortCode}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold truncate">{z.name}</span>
              <span
                className={`inline-flex items-center gap-0.5 text-[10px] whitespace-nowrap shrink-0 ${
                  isSelected ? 'text-slate-300' : 'text-slate-400'
                }`}
              >
                {renderKindIcon(z, 'w-2.5 h-2.5 shrink-0')}
                <span>{z.typeLabel}</span>
              </span>
            </div>
            <div
              className={`text-[11px] font-mono tabular-nums truncate mt-0.5 ${
                isSelected ? 'text-slate-300' : 'text-slate-500'
              }`}
            >
              {statText}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!isOfficial && onToggleJoinZone && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleJoinZone(z.id);
              }}
              className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                isJoined
                  ? isSelected
                    ? 'bg-white/15 text-emerald-300 hover:bg-white/25'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : isSelected
                    ? 'bg-blue-500 text-white hover:bg-blue-400'
                    : 'bg-slate-200/80 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {isJoined ? (
                <>
                  <Check className="w-3 h-3" />
                  <span>已加入</span>
                </>
              ) : (
                <>
                  <Plus className="w-3 h-3" />
                  <span>加入</span>
                </>
              )}
            </button>
          )}
          {isSelected && <Check className="w-3.5 h-3.5 text-sky-300 shrink-0" />}
        </div>
      </div>
    );
  };

  const isHeader = variant === 'header';
  const isRail = variant === 'rail';
  const isTopbar = variant === 'topbar';

  return (
    <div ref={containerRef} className={`relative ${isRail ? 'block w-full' : 'inline-block shrink-0'}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center justify-between gap-2 rounded-lg border text-left transition-colors cursor-pointer ${
          isRail
            ? 'w-full px-2.5 py-2'
            : isTopbar
              ? 'inline-flex h-9 pl-2 pr-2.5'
              : 'inline-flex h-8 pl-1.5 pr-2'
        } ${
          open
            ? 'bg-white border-slate-900 ring-2 ring-slate-900/10'
            : isRail
              ? 'bg-slate-50/90 border-slate-200 hover:border-slate-300 hover:bg-slate-100/70'
              : isTopbar
                ? 'bg-slate-50/80 border-slate-200 hover:border-slate-300 hover:bg-slate-100/70'
                : isHeader
                  ? 'bg-slate-50/80 border-slate-200/90 hover:border-slate-300 hover:bg-slate-100/70'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span
            className={`${
              isRail ? 'w-6 h-6 text-[11px]' : 'w-5 h-5 text-[10px]'
            } rounded font-bold text-white inline-flex items-center justify-center shrink-0`}
            style={{ backgroundColor: activeZone.accentColor }}
          >
            {activeZone.shortCode}
          </span>
          <div className="min-w-0 flex-1">
            <div
              className={`font-bold text-slate-900 truncate ${
                isRail
                  ? 'text-xs leading-tight'
                  : isTopbar
                    ? 'text-[13px] whitespace-nowrap max-w-[150px] sm:max-w-[240px]'
                    : 'text-xs whitespace-nowrap max-w-[140px] sm:max-w-[180px]'
              }`}
            >
              {activeZone.name}
            </div>
            {isRail && (
              <div className="inline-flex items-center gap-1 text-[10px] text-slate-500 mt-0.5 truncate">
                {renderKindIcon(activeZone, 'w-2.5 h-2.5 text-slate-400 shrink-0')}
                <span className="truncate">{activeZone.typeLabel}</span>
              </div>
            )}
          </div>
          {isTopbar && (
            <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-slate-400 whitespace-nowrap shrink-0">
              <span aria-hidden="true">·</span>
              <span>{activeZone.typeLabel}</span>
            </span>
          )}
          {!isHeader && !isRail && !isTopbar && (
            <span className="hidden sm:inline-flex items-center gap-0.5 text-[11px] text-slate-400 whitespace-nowrap">
              {renderKindIcon(activeZone, 'w-3 h-3 text-slate-400 shrink-0')}
              <span>{activeZone.typeLabel}</span>
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
          className={`absolute ${
            isTopbar ? 'left-1/2 -translate-x-1/2' : 'left-0'
          } mt-1.5 w-[min(340px,calc(100vw-2rem))] bg-white rounded-xl border border-slate-200 shadow-lg p-1.5 z-50 space-y-1.5`}
        >
          {officialZones.length > 0 && (
            <div className="space-y-0.5">
              <div className="px-2.5 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                官方社区（默认加入）
              </div>
              {officialZones.map(renderZoneItem)}
            </div>
          )}

          {privateZones.length > 0 && (
            <div className="pt-1 border-t border-slate-100 space-y-0.5">
              <div className="px-2.5 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                已加入 · 私有社区 ({privateZones.length})
              </div>
              {privateZones.map(renderZoneItem)}
            </div>
          )}

          {onManageSpaces && (
            <div className="pt-1 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onManageSpaces();
                }}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
              >
                <span>管理 / 发现更多 Agent 社区</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
