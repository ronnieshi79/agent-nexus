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
  /** Visual density variant: 'header' sits cleanly inside TopHeader breadcrumb */
  variant?: 'default' | 'header';
}

export function ZoneSelectorDropdown({
  zones,
  activeZoneId,
  onSelectZone,
  getZoneStat,
  joinedZoneIds,
  onToggleJoinZone,
  variant = 'default',
}: ZoneSelectorDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const activeZone = zones.find((z) => z.id === activeZoneId) || zones[0];
  const publicZones = zones.filter((z) => z.kind === 'public');
  const privateZones = zones.filter((z) => z.kind !== 'public');

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
    if (zone.kind === 'public') return <Globe className={cls} />;
    if (zone.kind === 'enterprise') return <Building2 className={cls} />;
    return <Lock className={cls} />;
  };

  const renderZoneItem = (z: CommunityZone) => {
    const isSelected = z.id === activeZone.id;
    const isPub = z.kind === 'public';
    const isJoined = isPub || (joinedZoneIds ? joinedZoneIds.includes(z.id) : true);
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
          {!isPub && onToggleJoinZone && (
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

  return (
    <div ref={containerRef} className="relative inline-block shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 h-8 pl-1.5 pr-2 rounded-lg border text-left transition-colors cursor-pointer ${
          open
            ? 'bg-white border-slate-900 ring-2 ring-slate-900/10'
            : isHeader
              ? 'bg-slate-50/80 border-slate-200/90 hover:border-slate-300 hover:bg-slate-100/70'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
        }`}
      >
        <span
          className="w-5 h-5 rounded text-[10px] font-bold text-white inline-flex items-center justify-center shrink-0"
          style={{ backgroundColor: activeZone.accentColor }}
        >
          {activeZone.shortCode}
        </span>
        <span className="text-xs font-bold text-slate-900 whitespace-nowrap max-w-[140px] sm:max-w-[180px] truncate">
          {activeZone.name}
        </span>
        {!isHeader && (
          <span className="hidden sm:inline-flex items-center gap-0.5 text-[11px] text-slate-400 whitespace-nowrap">
            {renderKindIcon(activeZone, 'w-3 h-3 text-slate-400 shrink-0')}
            <span>{activeZone.typeLabel}</span>
          </span>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${
            open ? 'rotate-180 text-slate-700' : ''
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 mt-1.5 w-[min(340px,calc(100vw-2rem))] bg-white rounded-xl border border-slate-200 shadow-lg p-1.5 z-50 space-y-1.5"
        >
          {publicZones.length > 0 && (
            <div className="space-y-0.5">
              <div className="px-2.5 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                公共开放空间
              </div>
              {publicZones.map(renderZoneItem)}
            </div>
          )}

          {privateZones.length > 0 && (
            <div className="pt-1 border-t border-slate-100 space-y-0.5">
              <div className="px-2.5 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                私有 / 企业专属社区 ({privateZones.length})
              </div>
              {privateZones.map(renderZoneItem)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
