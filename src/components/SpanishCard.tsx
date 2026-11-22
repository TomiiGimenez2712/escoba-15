import { useId } from 'react';
import type { Card, CardNumber, Suit } from '../../shared/types';

export interface SpanishCardProps {
  card?: Card;
  faceDown?: boolean;
  compact?: boolean;
  onClick?: () => void;
  selected?: boolean;
  highlighted?: boolean;
  disabled?: boolean;
}

const SUIT_META: Record<
  Suit,
  { label: string; colorClass: string; pintaBreaks: 0 | 1 | 2 | 3 }
> = {
  oros: { label: 'Oros', colorClass: 'spanish-card--oros', pintaBreaks: 0 },
  copas: { label: 'Copas', colorClass: 'spanish-card--copas', pintaBreaks: 1 },
  espadas: { label: 'Espadas', colorClass: 'spanish-card--espadas', pintaBreaks: 2 },
  bastos: { label: 'Bastos', colorClass: 'spanish-card--bastos', pintaBreaks: 3 },
};

const FIGURE_NAMES: Partial<Record<CardNumber, string>> = {
  10: 'Sota',
  11: 'Caballo',
  12: 'Rey',
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
          <circle cx="32" cy="32" r="24" fill="#facc15" stroke="#a16207" strokeWidth="3" />
          <circle cx="32" cy="32" r="18" fill="#fef08a" stroke="#ca8a04" strokeWidth="2" />
          <path
            d="M32 10 L35 17 L42 13 L41 20 L49 19 L45 26 L53 29 L47 33 L53 38 L45 40 L48 47 L40 46 L40 53 L34 49 L32 56 L30 49 L24 53 L24 46 L16 47 L19 40 L11 38 L17 33 L11 29 L19 26 L15 19 L23 20 L22 13 L29 17 Z"
            fill="#eab308"
            opacity="0.35"
          />
          <circle cx="32" cy="32" r="11" fill="#f59e0b" stroke="#92400e" strokeWidth="1.8" />
          <circle cx="28.5" cy="29.5" r="1.4" fill="#78350f" />
          <circle cx="35.5" cy="29.5" r="1.4" fill="#78350f" />
          <path
            d="M28 35 Q32 38 36 35"
            fill="none"
            stroke="#78350f"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
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
            d="M15 14 H49 L46 28 C44.5 35 39 39 32 39 C25 39 19.5 35 18 28 Z"
            fill="#f59e0b"
            stroke="#92400e"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path
            d="M19 18 H45 L43 27 C41.8 32 37.5 35 32 35 C26.5 35 22.2 32 21 27 Z"
            fill="#fef08a"
            opacity="0.7"
          />
          <rect
            x="28"
            y="39"
            width="8"
            height="10"
            fill="#d97706"
            stroke="#92400e"
            strokeWidth="2"
          />
          <ellipse
            cx="32"
            cy="44"
            rx="6"
            ry="3"
            fill="#b91c1c"
            stroke="#92400e"
            strokeWidth="1.8"
          />
          <path
            d="M18 54 C20 49 25 48 32 48 C39 48 44 49 46 54 Z"
            fill="#eab308"
            stroke="#92400e"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <circle cx="32" cy="24" r="3" fill="#b91c1c" />
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
      <rect x="6" y="6" width="88" height="148" rx="6" fill="#881337" stroke="#fbbf24" strokeWidth="2.5" />
      <rect x="12" y="12" width="76" height="136" rx="4" fill="none" stroke="#fde68a" strokeWidth="1.2" />
      <pattern id={patternId} width="16" height="16" patternUnits="userSpaceOnUse">
        <path d="M8 0 L16 8 L8 16 L0 8 Z" fill="none" stroke="#fda4af" strokeWidth="0.9" opacity="0.45" />
      </pattern>
      <rect x="14" y="14" width="72" height="132" rx="3" fill={`url(#${patternId})`} />
      <circle cx="50" cy="80" r="18" fill="#9f1239" stroke="#fbbf24" strokeWidth="2" />
      <path d="M50 65 L56 80 L50 95 L44 80 Z" fill="#fde68a" />
      <path d="M35 80 L50 74 L65 80 L50 86 Z" fill="#fbbf24" />
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
  disabled = false,
}: SpanishCardProps) {
  const sizeClass = compact ? 'spanish-card--compact' : '';

  if (faceDown || !card) {
    return (
      <div
        className={`spanish-card spanish-card--back ${sizeClass}`.trim()}
        role="img"
        aria-label="Carta oculta"
      >
        <CardBackArt />
      </div>
    );
  }

  const meta = SUIT_META[card.suit];
  const figureName = FIGURE_NAMES[card.number];
  const className = [
    'spanish-card',
    'spanish-card--front',
    meta.colorClass,
    sizeClass,
    selected ? 'spanish-card--selected' : '',
    highlighted ? 'spanish-card--highlighted' : '',
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
        <SuitSvg suit={card.suit} className="spanish-card__mini-suit" />
      </span>

      <span className="spanish-card__center">
        <SuitSvg suit={card.suit} className="spanish-card__suit-art" />
      </span>

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
  };

  if (onClick) {
    return (
      <button
        type="button"
        {...sharedProps}
        onClick={onClick}
        disabled={disabled}
        aria-pressed={selected}
      >
        {cardContent}
      </button>
    );
  }

  return (
    <div role="group" {...sharedProps}>
      {cardContent}
    </div>
  );
}

export default SpanishCard;
