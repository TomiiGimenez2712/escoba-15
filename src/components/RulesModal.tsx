import { useEffect, useId } from 'react';
import type { MouseEvent } from 'react';
import { motion } from 'motion/react';

export interface RulesModalProps {
  open: boolean;
  onClose: () => void;
}

/** Modal accesible con el resumen compacto de las reglas oficiales de la Escoba del 15. */
export function RulesModal({ open, onClose }: RulesModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <motion.div
      className="modal-backdrop"
      onClick={handleBackdropClick}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
    >
      <motion.div
        className="round-modal rules-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      >
        <h2 id={titleId} className="round-modal__title">
          Reglas rápidas
        </h2>

        <div className="rules-modal__sections">
          <section className="rules-section">
            <h3 className="rules-section__title">Valores para sumar 15</h3>
            <ul className="rules-list">
              <li>
                <strong>1 al 7</strong> valen su número.
              </li>
              <li>
                <strong>Sota (10)</strong> = 8.
              </li>
              <li>
                <strong>Caballo (11)</strong> = 9.
              </li>
              <li>
                <strong>Rey (12)</strong> = 10.
              </li>
            </ul>
          </section>

          <section className="rules-section">
            <h3 className="rules-section__title">Escobas</h3>
            <ul className="rules-list">
              <li>
                <strong>Escoba</strong>: vaciar la mesa al capturar suma +1 punto.
              </li>
              <li>
                <strong>Escoba de mano</strong>: si las 4 cartas iniciales de la mesa suman 15 (+1
                para el repartidor) o 30 en dos grupos independientes de 15 (+2).
              </li>
            </ul>
          </section>

          <section className="rules-section">
            <h3 className="rules-section__title">Puntaje al final de ronda</h3>
            <ul className="rules-list">
              <li>
                <strong>Escobas</strong>: 1 punto por cada escoba.
              </li>
              <li>
                <strong>7 de Oros</strong> (El Velo): 1 punto para quien lo capture.
              </li>
              <li>
                <strong>Sietes</strong> (La Setenta): 1 punto por mayoría de 7s.
              </li>
              <li>
                <strong>Oros</strong>: 1 punto por mayoría del palo de Oros.
              </li>
              <li>
                <strong>Cartas</strong> (Mayoría): 1 punto por mayor cantidad total de cartas.
              </li>
              <li>
                <strong>Empate</strong>: en mayorías, el empate otorga 0 puntos (nadie suma).
              </li>
            </ul>
          </section>

          <section className="rules-section">
            <h3 className="rules-section__title">Victoria</h3>
            <p className="rules-section__text">
              Gana quien supere primero la meta de 15 o 21 puntos (con rondas de desempate si hay
              empate en el máximo).
            </p>
          </section>
        </div>

        <div className="round-modal__actions">
          <button
            type="button"
            className="play-button round-modal__button"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default RulesModal;
