import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import type { ServiceCardId } from '../../types/agentnexus';

interface ServiceCardShellProps {
  cardId: ServiceCardId;
  kicker: string;
  title: string;
  subtitle: string;
  headerRight?: ReactNode;
  children: ReactNode;
}

const METAPHOR_NOTCH_COLORS: Record<ServiceCardId, string> = {
  market: 'from-amber-500/80 via-amber-400/50 to-transparent',
  chat: 'from-teal-600/80 via-teal-500/45 to-transparent',
  kanban: 'from-blue-600/85 via-blue-500/45 to-transparent',
  expert: 'from-indigo-600/80 via-indigo-500/45 to-transparent',
};

export function ServiceCardShell({
  cardId,
  kicker,
  title,
  subtitle,
  headerRight,
  children,
}: ServiceCardShellProps) {
  return (
    <motion.section
      key={cardId}
      initial={{ opacity: 0, y: 18, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.985 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className="skeuo-card relative w-full max-w-6xl mx-auto rounded-[28px] overflow-hidden"
    >
      {/* Subtle metaphorical machined top edge rail */}
      <div
        className={`h-1.5 w-full bg-gradient-to-r ${METAPHOR_NOTCH_COLORS[cardId]}`}
        aria-hidden="true"
      />

      {/* Card Header */}
      <div className="px-6 sm:px-7 pt-5 pb-4 border-b border-slate-200/80 flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white/60">
        <div className="min-w-0">
          <div className="text-xs font-medium text-slate-500 tracking-wide mb-1">
            {kicker}
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-tight">
            {title}
          </h2>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            {subtitle}
          </p>
        </div>

        {headerRight && (
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            {headerRight}
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className="p-6 sm:p-7">{children}</div>
    </motion.section>
  );
}
