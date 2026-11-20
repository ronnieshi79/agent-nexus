import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, RefreshCw } from 'lucide-react';
import type { AirobotState, BrainRecommendation, ServiceCardId } from '../../types/agentnexus';

interface AirobotCompanionProps {
  state: AirobotState;
  recommendation: BrainRecommendation;
  activeCard: ServiceCardId;
  isBusy: boolean;
  onTriggerSense: () => void;
  onAcceptRecommendation: () => void;
}

const STATE_CAPTIONS: Record<AirobotState, string> = {
  standby: '待命感知中',
  market: '人才雷达扫描中',
  chat: '群聊协同监听中',
  kanban: '工作流调度编排中',
  expert: '专家档案调优中',
  thinking: 'AI 大脑推演中',
  celebrating: '协同节点已同步',
};

const STATE_ACCENTS: Record<AirobotState, { primary: string; glow: string }> = {
  standby: { primary: '#2563eb', glow: 'rgba(37,99,235,0.22)' },
  market: { primary: '#d97706', glow: 'rgba(217,119,6,0.24)' },
  chat: { primary: '#0f766e', glow: 'rgba(15,118,110,0.24)' },
  kanban: { primary: '#1d4ed8', glow: 'rgba(29,78,216,0.24)' },
  expert: { primary: '#4f46e5', glow: 'rgba(79,70,229,0.24)' },
  thinking: { primary: '#0284c7', glow: 'rgba(2,132,199,0.32)' },
  celebrating: { primary: '#16a34a', glow: 'rgba(22,163,74,0.28)' },
};

export function AirobotCompanion({
  state,
  recommendation,
  activeCard,
  isBusy,
  onTriggerSense,
  onAcceptRecommendation,
}: AirobotCompanionProps) {
  const accent = STATE_ACCENTS[state];
  const isAlreadyOnRecommended = activeCard === recommendation.recommendedCard;

  return (
    <div className="flex flex-col lg:flex-row items-center lg:items-end gap-4 lg:gap-5 select-none">
      {/* Borderless Skeuomorphic Cartoon Animated Airobot (No Box / No Border) */}
      <motion.button
        type="button"
        onClick={onTriggerSense}
        disabled={isBusy}
        title="点击让 Nexa AI 大脑重新感知当前情境"
        aria-label="点击触发 Nexa 智能管家情境感知"
        className="relative group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-full cursor-pointer shrink-0 bg-transparent border-0 p-0"
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
      >
        <div className="relative w-32 h-36 sm:w-36 sm:h-40 flex items-center justify-center">
          {/* Soft ground levitation shadow */}
          <motion.div
            className="absolute bottom-1 w-20 h-4 rounded-full blur-md pointer-events-none"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.18)' }}
            animate={{
              scaleX: state === 'thinking' ? [0.85, 1.05, 0.85] : [0.92, 1.04, 0.92],
              opacity: [0.22, 0.14, 0.22],
            }}
            transition={{
              duration: state === 'thinking' ? 1.1 : 3.2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          {/* Floating ceramic cartoon robot SVG */}
          <motion.svg
            viewBox="0 0 180 196"
            className="w-full h-full overflow-visible drop-shadow-[0_14px_18px_rgba(15,23,42,0.16)]"
            animate={
              state === 'celebrating'
                ? { y: [0, -12, 0, -8, 0], rotate: [0, -4, 4, -2, 0] }
                : state === 'thinking'
                  ? { y: [0, -7, 0], rotate: [-1.5, 1.5, -1.5] }
                  : { y: [0, -6, 0], rotate: [0, 0.8, 0, -0.8, 0] }
            }
            transition={{
              duration: state === 'thinking' ? 1.1 : state === 'celebrating' ? 0.95 : 3.4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <defs>
              {/* Glossy Ceramic White Body Gradient */}
              <linearGradient id="ceramicShell" x1="20%" y1="5%" x2="80%" y2="95%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="55%" stopColor="#eef2f7" />
                <stop offset="100%" stopColor="#cbd5e1" />
              </linearGradient>

              {/* Soft Metallic Ear / Collar */}
              <linearGradient id="titaniumCap" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e2e8f0" />
                <stop offset="50%" stopColor="#94a3b8" />
                <stop offset="100%" stopColor="#64748b" />
              </linearGradient>

              {/* Deep Smoked Glass Visor */}
              <linearGradient id="visorGlass" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#1e293b" />
                <stop offset="50%" stopColor="#0f172a" />
                <stop offset="100%" stopColor="#172554" />
              </linearGradient>

              {/* Specular Glint on Visor */}
              <linearGradient id="visorGlint" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.34" />
                <stop offset="60%" stopColor="#ffffff" stopOpacity="0.04" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </linearGradient>

              {/* Dynamic Accent Core */}
              <radialGradient id="accentOrb" cx="35%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                <stop offset="45%" stopColor={accent.primary} />
                <stop offset="100%" stopColor="#0f172a" stopOpacity="0.65" />
              </radialGradient>
            </defs>

            {/* Thinking Orbit Ring around antenna */}
            {state === 'thinking' && (
              <motion.ellipse
                cx="90"
                cy="24"
                rx="26"
                ry="8"
                fill="none"
                stroke={accent.primary}
                strokeWidth="2.5"
                strokeDasharray="10 6"
                animate={{ rotate: 360 }}
                style={{ originX: '90px', originY: '24px' }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
              />
            )}

            {/* Antenna Stem & Glowing Orb */}
            <path
              d="M90 48 L90 27"
              stroke="url(#titaniumCap)"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <motion.circle
              cx="90"
              cy="22"
              r="8.5"
              fill="url(#accentOrb)"
              animate={{
                scale: state === 'thinking' ? [1, 1.24, 1] : [1, 1.08, 1],
              }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            />

            {/* Left & Right Floating Ceramic Hands */}
            <motion.g
              animate={
                state === 'chat'
                  ? { y: [0, -3, 0], rotate: [0, 8, 0] }
                  : state === 'kanban'
                    ? { y: [-2, 4, -2], rotate: [-6, 6, -6] }
                    : { y: [0, 3, 0] }
              }
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <ellipse cx="32" cy="138" rx="13" ry="15" fill="url(#ceramicShell)" stroke="#cbd5e1" strokeWidth="1.2" />
              <ellipse cx="29" cy="133" rx="4" ry="6" fill="#ffffff" opacity="0.7" />
            </motion.g>

            <motion.g
              animate={
                state === 'market'
                  ? { y: [-6, -10, -6], x: [0, 3, 0], rotate: [0, -10, 0] }
                  : state === 'celebrating'
                    ? { y: [-14, -22, -14], rotate: [-15, 10, -15] }
                    : { y: [0, -3, 0] }
              }
              transition={{ duration: 2.1, repeat: Infinity, ease: 'easeInOut' }}
            >
              <ellipse cx="148" cy="138" rx="13" ry="15" fill="url(#ceramicShell)" stroke="#cbd5e1" strokeWidth="1.2" />
              <ellipse cx="145" cy="133" rx="4" ry="6" fill="#ffffff" opacity="0.7" />

              {/* Context Accessory: Magnifier in Market Mode */}
              {state === 'market' && (
                <g transform="translate(150, 108)">
                  <circle cx="8" cy="8" r="10" fill="rgba(251, 191, 36, 0.22)" stroke="#d97706" strokeWidth="3" />
                  <line x1="1" y1="16" x2="-5" y2="24" stroke="#b45309" strokeWidth="3.5" strokeLinecap="round" />
                </g>
              )}
            </motion.g>

            {/* Lower Ceramic Torso Pod */}
            <path
              d="M54 126 C54 114, 126 114, 126 126 L119 162 C116 175, 64 175, 61 162 Z"
              fill="url(#ceramicShell)"
              stroke="#cbd5e1"
              strokeWidth="1.4"
            />
            {/* Chest Recessed Status Medallion */}
            <rect
              x="74"
              y="136"
              width="32"
              height="18"
              rx="9"
              fill="#e2e8f0"
              stroke="#cbd5e1"
              strokeWidth="1"
            />
            <rect x="79" y="141" width="22" height="8" rx="4" fill={accent.primary} opacity="0.88" />
            <rect x="82" y="143" width="8" height="2.5" rx="1.2" fill="#ffffff" opacity="0.65" />

            {/* Neck Joint */}
            <rect x="77" y="111" width="26" height="10" rx="5" fill="url(#titaniumCap)" />

            {/* Left & Right Ear Caps */}
            <rect x="27" y="70" width="14" height="32" rx="7" fill="url(#titaniumCap)" />
            <rect x="139" y="70" width="14" height="32" rx="7" fill="url(#titaniumCap)" />

            {/* Context Accessory: Comms Boom Mic in Chat Mode */}
            {state === 'chat' && (
              <g>
                <path
                  d="M146 96 Q150 114 118 112"
                  fill="none"
                  stroke="#0f766e"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                />
                <circle cx="115" cy="112" r="4.2" fill="#14b8a6" />
                <motion.path
                  d="M158 76 Q165 86 158 96"
                  fill="none"
                  stroke="#0f766e"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  animate={{ opacity: [0.25, 0.9, 0.25] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                />
                <motion.path
                  d="M164 70 Q174 86 164 102"
                  fill="none"
                  stroke="#0f766e"
                  strokeWidth="2"
                  strokeLinecap="round"
                  animate={{ opacity: [0.15, 0.7, 0.15] }}
                  transition={{ duration: 1.4, repeat: Infinity, delay: 0.2 }}
                />
              </g>
            )}

            {/* Context Accessory: Kanban Mini Progress Bars Floating */}
            {state === 'kanban' && (
              <motion.g
                transform="translate(136, 40)"
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <rect x="0" y="0" width="32" height="24" rx="6" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
                <rect x="5" y="6" width="14" height="3.5" rx="1.7" fill="#1d4ed8" />
                <rect x="5" y="12" width="22" height="3.5" rx="1.7" fill="#93c5fd" />
                <rect x="5" y="17.5" width="10" height="2.5" rx="1.2" fill="#16a34a" />
              </motion.g>
            )}

            {/* Context Accessory: Expert Creator Star Crest */}
            {state === 'expert' && (
              <motion.g
                transform="translate(138, 36)"
                animate={{ rotate: [-6, 6, -6], y: [0, -3, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                <circle cx="14" cy="14" r="13" fill="#ffffff" stroke="#c7d2fe" strokeWidth="1.5" />
                <path
                  d="M14 6 L16.4 11 L22 11.7 L17.9 15.5 L18.9 21 L14 18.3 L9.1 21 L10.1 15.5 L6 11.7 L11.6 11 Z"
                  fill="#4f46e5"
                />
              </motion.g>
            )}

            {/* Main Ceramic Rounded Head */}
            <rect
              x="36"
              y="45"
              width="108"
              height="74"
              rx="34"
              fill="url(#ceramicShell)"
              stroke="#cbd5e1"
              strokeWidth="1.5"
            />
            {/* Glossy top ceramic reflection */}
            <path
              d="M58 53 C76 47, 104 47, 122 53"
              fill="none"
              stroke="#ffffff"
              strokeWidth="4.5"
              strokeLinecap="round"
              opacity="0.92"
            />

            {/* Dark Curved Glass Face Visor */}
            <rect
              x="47"
              y="58"
              width="86"
              height="50"
              rx="23"
              fill="url(#visorGlass)"
              stroke="#334155"
              strokeWidth="1.5"
            />
            {/* Glass Specular Sheen */}
            <path
              d="M55 68 C70 60, 110 60, 125 68 C110 75, 70 75, 55 68 Z"
              fill="url(#visorGlint)"
            />

            {/* Expressive Animated OLED Eyes based on state */}
            {state === 'celebrating' ? (
              <g stroke="#4ade80" strokeWidth="4.5" strokeLinecap="round" fill="none">
                <path d="M64 85 Q72 74 80 85" />
                <path d="M100 85 Q108 74 116 85" />
                <path d="M84 95 Q90 101 96 95" stroke="#86efac" strokeWidth="3" />
              </g>
            ) : state === 'thinking' ? (
              <g>
                <motion.circle
                  cx="72"
                  cy="83"
                  r="6.5"
                  fill="#38bdf8"
                  animate={{ scale: [1, 0.7, 1.15, 1] }}
                  transition={{ duration: 0.9, repeat: Infinity }}
                />
                <motion.circle
                  cx="108"
                  cy="83"
                  r="6.5"
                  fill="#38bdf8"
                  animate={{ scale: [1.15, 1, 0.7, 1.15] }}
                  transition={{ duration: 0.9, repeat: Infinity }}
                />
                <path d="M85 95 L95 95" stroke="#7dd3fc" strokeWidth="3" strokeLinecap="round" />
              </g>
            ) : state === 'market' ? (
              <motion.g
                animate={{ x: [-4, 4, -4] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              >
                <ellipse cx="72" cy="83" rx="6" ry="8" fill="#fbbf24" />
                <circle cx="70" cy="79" r="2.2" fill="#ffffff" />
                {/* Cute Radar Monocle Ring over right eye */}
                <circle cx="108" cy="83" r="10.5" fill="none" stroke="#f59e0b" strokeWidth="2.4" />
                <ellipse cx="108" cy="83" rx="5.5" ry="7" fill="#fcd34d" />
                <circle cx="106" cy="79.5" r="2" fill="#ffffff" />
                <path d="M86 96 Q90 99 94 96" stroke="#fde68a" strokeWidth="2.6" strokeLinecap="round" fill="none" />
              </motion.g>
            ) : state === 'kanban' ? (
              <g>
                <rect x="65" y="77" width="14" height="12" rx="6" fill="#60a5fa" />
                <rect x="101" y="77" width="14" height="12" rx="6" fill="#60a5fa" />
                <circle cx="70" cy="80.5" r="2.2" fill="#ffffff" />
                <circle cx="106" cy="80.5" r="2.2" fill="#ffffff" />
                <path d="M84 95 Q90 99 96 95" stroke="#93c5fd" strokeWidth="2.8" strokeLinecap="round" fill="none" />
              </g>
            ) : state === 'expert' ? (
              <g>
                <ellipse cx="72" cy="83" rx="6.5" ry="8.5" fill="#818cf8" />
                <circle cx="70" cy="79" r="2.2" fill="#ffffff" />
                {/* Confident wink */}
                <path d="M101 84 Q108 77 115 84" stroke="#a5b4fc" strokeWidth="4" strokeLinecap="round" fill="none" />
                <path d="M84 95 Q90 100 96 95" stroke="#c7d2fe" strokeWidth="2.8" strokeLinecap="round" fill="none" />
              </g>
            ) : (
              /* Chat & Standby friendly blinking eyes */
              <motion.g
                animate={{ scaleY: [1, 1, 0.12, 1, 1] }}
                style={{ originY: '83px' }}
                transition={{ duration: 4.2, repeat: Infinity, times: [0, 0.46, 0.5, 0.54, 1] }}
              >
                <ellipse cx="72" cy="83" rx="6.5" ry="9" fill="#2dd4bf" />
                <ellipse cx="108" cy="83" rx="6.5" ry="9" fill="#2dd4bf" />
                <circle cx="70" cy="79" r="2.3" fill="#ffffff" />
                <circle cx="106" cy="79" r="2.3" fill="#ffffff" />
                <path d="M83 95 Q90 101 97 95" stroke="#99f6e4" strokeWidth="2.8" strokeLinecap="round" fill="none" />
              </motion.g>
            )}
          </motion.svg>
        </div>
      </motion.button>

      {/* Lightweight Context-Aware AI Brain Speech Whisper */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${recommendation.recommendedCard}-${recommendation.headline}`}
          initial={{ opacity: 0, y: 6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-xl w-full bg-white/85 backdrop-blur-md rounded-2xl px-4 py-3.5 shadow-[0_10px_28px_-10px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] border border-slate-200/80"
        >
          <div className="flex items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-800">Nexa 管家</span>
              <span aria-hidden="true">·</span>
              <span>{STATE_CAPTIONS[state]}</span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-600">{recommendation.confidenceNote}</span>
            </div>
            <button
              type="button"
              onClick={onTriggerSense}
              disabled={isBusy}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap shrink-0"
              title="重新基于当前情境推演推荐"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin' : ''}`} />
              <span>重算情境</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 leading-snug">
                {recommendation.headline}
              </p>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                {recommendation.reason}
              </p>
            </div>

            {!isAlreadyOnRecommended && (
              <button
                type="button"
                onClick={onAcceptRecommendation}
                className="skeuo-primary inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-white whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>{recommendation.suggestedActionLabel}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
