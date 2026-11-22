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
  showFigureValues?: boolean;
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
  disabled = false,
  showFigureValues = false,
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

      {showFigureValues && card.number >= 10 && (
        <span className="spanish-card__value-badge">{`= ${card.value}`}</span>
      )}

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
