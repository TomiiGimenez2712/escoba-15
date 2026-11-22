import { useId } from 'react';
import { motion } from 'motion/react';
import type { Card, CardNumber, Suit } from '../../shared/types';

export interface SpanishCardProps {
  card?: Card;
  faceDown?: boolean;
  compact?: boolean;
  onClick?: () => void;
  selected?: boolean;
  highlighted?: boolean;
  botTarget?: boolean;
  disabled?: boolean;
  showFigureValues?: boolean;
}

const SUIT_META: Record<
  Suit,
  { label: string; colorClass: string; primary: string; secondary: string; pintaBreaks: 0 | 1 | 2 | 3 }
> = {
  oros: {
    label: 'Oros',
    colorClass: 'spanish-card--oros',
    primary: '#d97706',
    secondary: '#fef3c7',
    pintaBreaks: 0,
  },
  copas: {
    label: 'Copas',
    colorClass: 'spanish-card--copas',
    primary: '#dc2626',
    secondary: '#fee2e2',
    pintaBreaks: 1,
  },
  espadas: {
    label: 'Espadas',
    colorClass: 'spanish-card--espadas',
    primary: '#1d4ed8',
    secondary: '#dbeafe',
    pintaBreaks: 2,
  },
  bastos: {
    label: 'Bastos',
    colorClass: 'spanish-card--bastos',
    primary: '#15803d',
    secondary: '#dcfce7',
    pintaBreaks: 3,
  },
};

const FIGURE_NAMES: Partial<Record<CardNumber, string>> = {
  10: 'Sota',
  11: 'Caballo',
  12: 'Rey',
};

interface PipPoint {
  x: number;
  y: number;
  size: number;
  rotate?: number;
}

const PIP_LAYOUTS: Record<1 | 2 | 3 | 4 | 5 | 6 | 7, readonly PipPoint[]> = {
  1: [{ x: 50, y: 50, size: 58 }],
  2: [
    { x: 50, y: 27, size: 32 },
    { x: 50, y: 73, size: 32, rotate: 180 },
  ],
  3: [
    { x: 50, y: 20, size: 31 },
    { x: 50, y: 50, size: 31 },
    { x: 50, y: 80, size: 31, rotate: 180 },
  ],
  4: [
    { x: 30, y: 27, size: 31 },
    { x: 70, y: 27, size: 31 },
    { x: 30, y: 73, size: 31, rotate: 180 },
    { x: 70, y: 73, size: 31, rotate: 180 },
  ],
  5: [
    { x: 28, y: 22, size: 31 },
    { x: 72, y: 22, size: 31 },
    { x: 50, y: 50, size: 31 },
    { x: 28, y: 78, size: 31, rotate: 180 },
    { x: 72, y: 78, size: 31, rotate: 180 },
  ],
  6: [
    { x: 30, y: 20, size: 30 },
    { x: 70, y: 20, size: 30 },
    { x: 30, y: 50, size: 30 },
    { x: 70, y: 50, size: 30 },
    { x: 30, y: 80, size: 30, rotate: 180 },
    { x: 70, y: 80, size: 30, rotate: 180 },
  ],
  7: [
    { x: 28, y: 19, size: 29 },
    { x: 72, y: 19, size: 29 },
    { x: 50, y: 35, size: 29 },
    { x: 28, y: 52, size: 29 },
    { x: 72, y: 52, size: 29 },
    { x: 28, y: 81, size: 29, rotate: 180 },
    { x: 72, y: 81, size: 29, rotate: 180 },
  ],
};

function SuitSvg({ suit, className }: { suit: Suit; className?: string }) {
  switch (suit) {
    case 'oros':
      return (
        <svg
          className={className}
          viewBox="0 0 64 64"
          aria-hidden="true"
          data-suit-svg="oros"
        >
          <circle cx="32" cy="32" r="24" fill="#f59e0b" stroke="#b45309" strokeWidth="2.5" />
          <circle cx="32" cy="32" r="18" fill="#fef3c7" stroke="#d97706" strokeWidth="1.8" />
          <path
            d="M32 14 L35.2 24.8 L45.5 18.5 L39.2 28.8 L50 32 L39.2 35.2 L45.5 45.5 L35.2 39.2 L32 50 L28.8 39.2 L18.5 45.5 L24.8 35.2 L14 32 L24.8 28.8 L18.5 18.5 L28.8 24.8 Z"
            fill="#f59e0b"
            opacity="0.72"
          />
          <circle cx="32" cy="32" r="7" fill="#fffbeb" stroke="#b45309" strokeWidth="1.8" />
          <circle cx="32" cy="32" r="2.6" fill="#d97706" />
        </svg>
      );

    case 'copas':
      return (
        <svg
          className={className}
          viewBox="0 0 64 64"
          aria-hidden="true"
          data-suit-svg="copas"
        >
          <path
            d="M16 14 H48 L45 28 C43.5 35 38.5 39 32 39 C25.5 39 20.5 35 19 28 Z"
            fill="#dc2626"
            stroke="#7f1d1d"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <path
            d="M20 18 H44 L42 26.5 C40.8 31.5 37 34.5 32 34.5 C27 34.5 23.2 31.5 22 26.5 Z"
            fill="#fca5a5"
            opacity="0.35"
          />
          <rect
            x="29"
            y="39"
            width="6"
            height="10"
            fill="#b91c1c"
            stroke="#7f1d1d"
            strokeWidth="2"
          />
          <ellipse
            cx="32"
            cy="44"
            rx="5.5"
            ry="2.6"
            fill="#ef4444"
            stroke="#7f1d1d"
            strokeWidth="1.6"
          />
          <path
            d="M19 54 C21 49.5 25.5 48 32 48 C38.5 48 43 49.5 45 54 Z"
            fill="#b91c1c"
            stroke="#7f1d1d"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <circle cx="32" cy="24" r="2.6" fill="#fef2f2" opacity="0.85" />
        </svg>
      );

    case 'espadas':
      return (
        <svg
          className={className}
          viewBox="0 0 64 64"
          aria-hidden="true"
          data-suit-svg="espadas"
        >
          <path
            d="M32 6 L37 15 L36 42 H28 L27 15 Z"
            fill="#e2e8f0"
            stroke="#334155"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <line x1="32" y1="9" x2="32" y2="41" stroke="#64748b" strokeWidth="1.6" />
          <path
            d="M16 40 C22 44 42 44 48 40 C46 45 39 46 32 46 C25 46 18 45 16 40 Z"
            fill="#eab308"
            stroke="#854d0e"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <rect
            x="29.5"
            y="45"
            width="5"
            height="9"
            rx="1"
            fill="#991b1b"
            stroke="#450a0a"
            strokeWidth="1.6"
          />
          <circle cx="32" cy="56" r="4" fill="#eab308" stroke="#854d0e" strokeWidth="2" />
        </svg>
      );

    case 'bastos':
      return (
        <svg
          className={className}
          viewBox="0 0 64 64"
          aria-hidden="true"
          data-suit-svg="bastos"
        >
          <path
            d="M27 56 L29 36 C25 26 24 14 29 9 C32 7 36 8 38 12 C41 18 39 28 35 37 L37 56 Z"
            fill="#a16207"
            stroke="#451a03"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <path
            d="M31 15 L33 24 M30 30 L33 38"
            stroke="#713f12"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M26 26 C18 24 15 18 20 15 C24 17 26 21 26 26 Z"
            fill="#16a34a"
            stroke="#14532d"
            strokeWidth="1.8"
          />
          <path
            d="M38 22 C46 20 49 14 44 11 C40 13 38 17 38 22 Z"
            fill="#22c55e"
            stroke="#14532d"
            strokeWidth="1.8"
          />
          <rect
            x="26.5"
            y="43"
            width="11"
            height="4"
            rx="1.5"
            fill="#eab308"
            stroke="#854d0e"
            strokeWidth="1.5"
          />
        </svg>
      );
  }
}

function FigureIllustration({
  number,
  suit,
}: {
  number: 10 | 11 | 12;
  suit: Suit;
}) {
  const { primary, secondary } = SUIT_META[suit];

  if (number === 10) {
    // Sota: paje con boina emplumada y túnica sosteniendo el emblema del palo
    return (
      <div className="spanish-card__figure-scene" aria-hidden="true">
        <svg viewBox="0 0 80 100" className="spanish-card__figure-svg">
          {/* Pluma y boina */}
          <path d="M46 14 C56 8 62 14 54 22 Z" fill={primary} opacity="0.85" />
          <path d="M25 26 C26 17 48 16 53 25 Z" fill={primary} stroke="#1e293b" strokeWidth="2" />
          {/* Rostro */}
          <circle cx="39" cy="33" r="9.5" fill="#fde68a" stroke="#78350f" strokeWidth="1.8" />
          <circle cx="36" cy="32" r="1.2" fill="#1e293b" />
          <circle cx="42" cy="32" r="1.2" fill="#1e293b" />
          {/* Cuello y túnica */}
          <path d="M24 47 C24 41 54 41 54 47 L58 84 H20 Z" fill={primary} stroke="#1e293b" strokeWidth="2" strokeLinejoin="round" />
          <path d="M32 44 L39 54 L46 44 Z" fill={secondary} />
          <rect x="23" y="64" width="32" height="5" rx="2" fill="#f59e0b" stroke="#78350f" strokeWidth="1.3" />
          {/* Escudo grande con el palo */}
          <circle cx="55" cy="54" r="16" fill="#ffffff" stroke={primary} strokeWidth="2.2" />
        </svg>
        <div className="spanish-card__figure-emblem spanish-card__figure-emblem--sota">
          <SuitSvg suit={suit} className="spanish-card__emblem-svg" />
        </div>
      </div>
    );
  }

  if (number === 11) {
    // Caballo: corcel estilizado al trote/galope con jinete y emblema bien visible
    return (
      <div className="spanish-card__figure-scene" aria-hidden="true">
        <svg viewBox="0 0 80 100" className="spanish-card__figure-svg">
          {/* Cola del caballo */}
          <path
            d="M17 57 C9 59 7 68 12 75 C15 69 17 65 21 63 Z"
            fill="#78350f"
            stroke="#451a03"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Jinete */}
          <path d="M29 19 C30 12 42 12 44 19 Z" fill={primary} stroke="#1e293b" strokeWidth="1.8" />
          <circle cx="36" cy="25" r="6" fill="#fde68a" stroke="#78350f" strokeWidth="1.6" />
          <path d="M28 33 L44 33 L46 51 L27 51 Z" fill={primary} stroke="#1e293b" strokeWidth="1.8" strokeLinejoin="round" />
          {/* Caballo (cuerpo estilizado, cuello arqueado, orejas, hocico y patas al galope) */}
          <path
            d="M19 57 C21 47 34 46 47 48 L53 31 L56 24 L59 29 L62 25 L62 32 L70 38 L66 43 L60 41 L57 48 C61 53 60 61 55 65 L65 77 L59 83 L50 69 L32 69 L25 84 L18 82 L24 66 C20 64 18 61 19 57 Z"
            fill="#d97706"
            stroke="#451a03"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Crin y rienda */}
          <path d="M52 32 C47 36 45 42 47 47" fill="none" stroke="#78350f" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M62 40 L44 47" fill="none" stroke="#451a03" strokeWidth="1.3" />
          <circle cx="61" cy="34" r="1.4" fill="#1e293b" />
          {/* Silla */}
          <path d="M29 48 H45 L43 56 H30 Z" fill={secondary} stroke="#1e293b" strokeWidth="1.5" />
          {/* Medallón grande del palo */}
          <circle cx="20" cy="31" r="15.5" fill="#ffffff" stroke={primary} strokeWidth="2.2" />
        </svg>
        <div className="spanish-card__figure-emblem spanish-card__figure-emblem--caballo">
          <SuitSvg suit={suit} className="spanish-card__emblem-svg" />
        </div>
      </div>
    );
  }

  // 12 — Rey: corona real, barba, manto y emblema grande del palo
  return (
    <div className="spanish-card__figure-scene" aria-hidden="true">
      <svg viewBox="0 0 80 100" className="spanish-card__figure-svg">
        {/* Corona */}
        <path
          d="M26 24 L29 12 L35 19 L40 10 L45 19 L51 12 L54 24 Z"
          fill="#facc15"
          stroke="#92400e"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        {/* Cabeza y barba */}
        <circle cx="40" cy="33" r="9.5" fill="#fde68a" stroke="#78350f" strokeWidth="1.8" />
        <path d="M31 35 C32 45 48 45 49 35 C45 38 35 38 31 35 Z" fill="#cbd5e1" stroke="#475569" strokeWidth="1.4" />
        <circle cx="37" cy="31.5" r="1.2" fill="#1e293b" />
        <circle cx="43" cy="31.5" r="1.2" fill="#1e293b" />
        {/* Manto real */}
        <path
          d="M19 49 C22 42 58 42 61 49 L64 86 H16 Z"
          fill={primary}
          stroke="#1e293b"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M33 44 H47 L45 86 H35 Z" fill={secondary} opacity="0.9" />
        <circle cx="40" cy="54" r="3" fill="#f59e0b" />
        {/* Emblema real grande */}
        <circle cx="57" cy="54" r="16" fill="#ffffff" stroke="#b45309" strokeWidth="2.2" />
      </svg>
      <div className="spanish-card__figure-emblem spanish-card__figure-emblem--rey">
        <SuitSvg suit={suit} className="spanish-card__emblem-svg" />
      </div>
    </div>
  );
}

function PipsGrid({ number, suit }: { number: 1 | 2 | 3 | 4 | 5 | 6 | 7; suit: Suit }) {
  const layout = PIP_LAYOUTS[number];
  return (
    <div className="spanish-card__pips" aria-hidden="true">
      {layout.map((pip, index) => (
        <span
          key={index}
          className="spanish-card__pip"
          style={{
            left: `${pip.x}%`,
            top: `${pip.y}%`,
            width: `${pip.size}%`,
            transform: `translate(-50%, -50%)${pip.rotate ? ` rotate(${pip.rotate}deg)` : ''}`,
          }}
        >
          <SuitSvg suit={suit} className="spanish-card__suit-art" />
        </span>
      ))}
    </div>
  );
}

function PintaFrame({ breaks }: { breaks: 0 | 1 | 2 | 3 }) {
  const renderPintaBar = () => {
    if (breaks === 0) {
      return <line x1="8" y1="5" x2="92" y2="5" stroke="currentColor" strokeWidth="2" />;
    }
    if (breaks === 1) {
      return (
        <>
          <line x1="8" y1="5" x2="44" y2="5" stroke="currentColor" strokeWidth="2" />
          <line x1="56" y1="5" x2="92" y2="5" stroke="currentColor" strokeWidth="2" />
        </>
      );
    }
    if (breaks === 2) {
      return (
        <>
          <line x1="8" y1="5" x2="31" y2="5" stroke="currentColor" strokeWidth="2" />
          <line x1="40" y1="5" x2="60" y2="5" stroke="currentColor" strokeWidth="2" />
          <line x1="69" y1="5" x2="92" y2="5" stroke="currentColor" strokeWidth="2" />
        </>
      );
    }
    return (
      <>
        <line x1="8" y1="5" x2="24" y2="5" stroke="currentColor" strokeWidth="2" />
        <line x1="32" y1="5" x2="46" y2="5" stroke="currentColor" strokeWidth="2" />
        <line x1="54" y1="5" x2="68" y2="5" stroke="currentColor" strokeWidth="2" />
        <line x1="76" y1="5" x2="92" y2="5" stroke="currentColor" strokeWidth="2" />
      </>
    );
  };

  return (
    <svg
      className="spanish-card__pinta"
      viewBox="0 0 100 160"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {renderPintaBar()}
      <g transform="translate(0, 150)">{renderPintaBar()}</g>
      <line x1="5" y1="8" x2="5" y2="152" stroke="currentColor" strokeWidth="1.6" />
      <line x1="95" y1="8" x2="95" y2="152" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function CardBackArt() {
  const patternId = useId();
  return (
    <svg
      className="spanish-card__back-art"
      viewBox="0 0 100 160"
      aria-hidden="true"
    >
      <rect x="6" y="6" width="88" height="148" rx="6" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
      <rect x="12" y="12" width="76" height="136" rx="4" fill="none" stroke="#94a3b8" strokeWidth="1" opacity="0.6" />
      <pattern id={patternId} width="14" height="14" patternUnits="userSpaceOnUse">
        <path d="M7 0 L14 7 L7 14 L0 7 Z" fill="none" stroke="#64748b" strokeWidth="0.8" opacity="0.38" />
      </pattern>
      <rect x="14" y="14" width="72" height="132" rx="3" fill={`url(#${patternId})`} />
      <circle cx="50" cy="80" r="15" fill="#0f172a" stroke="#f59e0b" strokeWidth="1.6" />
      <path d="M50 68 L54.5 80 L50 92 L45.5 80 Z" fill="#fde68a" />
      <path d="M38 80 L50 75.5 L62 80 L50 84.5 Z" fill="#f59e0b" />
    </svg>
  );
}

export function SpanishCard({
  card,
  faceDown = false,
  compact = false,
  onClick,
  selected = false,
  highlighted = false,
  botTarget = false,
  disabled = false,
  showFigureValues = false,
}: SpanishCardProps) {
  const sizeClass = compact ? 'spanish-card--compact' : '';

  if (faceDown || !card) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.85, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.78, y: 8 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
        className={`spanish-card spanish-card--back ${sizeClass}`.trim()}
        role="img"
        aria-label="Carta oculta"
      >
        <CardBackArt />
      </motion.div>
    );
  }

  const meta = SUIT_META[card.suit];
  const figureName = FIGURE_NAMES[card.number];
  const isFigure = card.number === 10 || card.number === 11 || card.number === 12;
  const className = [
    'spanish-card',
    'spanish-card--front',
    meta.colorClass,
    sizeClass,
    selected ? 'spanish-card--selected' : '',
    highlighted ? 'spanish-card--highlighted' : '',
    botTarget ? 'spanish-card--bot-target' : '',
    onClick ? 'spanish-card--interactive' : '',
    disabled ? 'spanish-card--disabled' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const cardContent = (
    <>
      <PintaFrame breaks={meta.pintaBreaks} />

      <span className="spanish-card__corner">
        <span className="spanish-card__number">{card.number}</span>
      </span>

      {showFigureValues && card.number >= 10 && (
        <span className="spanish-card__value-badge">{`= ${card.value}`}</span>
      )}

      {isFigure ? (
        <FigureIllustration number={card.number as 10 | 11 | 12} suit={card.suit} />
      ) : (
        <PipsGrid number={card.number as 1 | 2 | 3 | 4 | 5 | 6 | 7} suit={card.suit} />
      )}

      {figureName && <span className="spanish-card__figure">{figureName}</span>}
    </>
  );

  const sharedProps = {
    className,
    'aria-label': `${card.number} de ${card.suit}`,
    'data-suit': card.suit,
    'data-number': card.number,
    'data-selected': selected ? 'true' : undefined,
    'data-highlighted': highlighted ? 'true' : undefined,
    'data-bot-target': botTarget ? 'true' : undefined,
  };

  const motionAnim = {
    initial: { opacity: 0, scale: 0.82, y: -14 },
    animate: {
      opacity: 1,
      scale: botTarget ? 1.04 : 1,
      y: selected ? -7 : botTarget ? -6 : 0,
    },
    exit: { opacity: 0, scale: 0.72, y: -22, transition: { duration: 0.2 } },
    transition: { type: 'spring' as const, stiffness: 420, damping: 28 },
  };

  if (onClick) {
    return (
      <motion.button
        layout
        type="button"
        {...sharedProps}
        {...motionAnim}
        whileHover={!disabled ? { y: selected ? -9 : -4, scale: 1.03 } : undefined}
        whileTap={!disabled ? { scale: 0.95 } : undefined}
        onClick={onClick}
        disabled={disabled}
        aria-pressed={selected}
      >
        {cardContent}
      </motion.button>
    );
  }

  return (
    <motion.div layout {...sharedProps} {...motionAnim} role="group">
      {cardContent}
    </motion.div>
  );
}

export default SpanishCard;
