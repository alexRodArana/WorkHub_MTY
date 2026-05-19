import { useRef, useEffect, type CSSProperties } from 'react';
import type { ReservationResponse, SpaceAvailability, FilterValues } from '../../../types/reservation';
import { PRIORITY_CATEGORY_LABELS } from '../../../data/floorLayouts';
import { getBadgeImage } from '../../../utils/badgeVisual';
import styles from './SuccessModal.module.css';

interface SuccessModalProps {
  isOpen: boolean;
  reservation: ReservationResponse;
  space: SpaceAvailability | null;
  filters: FilterValues;
  onViewReservations: () => void;
}

const FLOOR_NAMES: Record<string, string> = {
  '0': 'Planta Baja',
  '1': 'Mezzanine',
  '3': 'Piso 3',
  '9': 'Piso 9',
};

function getFloorName(floorId: number | string): string {
  return FLOOR_NAMES[String(floorId)] ?? String(floorId);
}

export function SuccessModal({
  isOpen,
  reservation,
  space,
  filters,
  onViewReservations,
}: SuccessModalProps) {
  const viewBtnRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      viewBtnRef.current?.focus();
    } else {
      previousFocusRef.current?.focus();
    }
  }, [isOpen]);

  // Focus trap
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Tab') return;

    const modal = e.currentTarget;
    const focusable = modal.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  }

  if (!isOpen) return null;

  const categoryLabel = space
    ? PRIORITY_CATEGORY_LABELS[space.priority_category] ?? space.priority_category
    : 'Estacionamiento';
  const newBadges = reservation.newBadges ?? [];

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onViewReservations();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="success-modal-title"
        className={styles.modal}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.modalHeader}>
          <div className={styles.checkCircle} aria-hidden="true">✓</div>
          <h2 id="success-modal-title" className={styles.title}>
            ¡Reserva confirmada!
          </h2>
        </div>

        <div className={styles.modalBody}>
        <div className={styles.codeSection}>
          <span className={styles.codeLabel}>Tu código de reserva</span>
          <span className={styles.code}>{reservation.reservation_code}</span>
        </div>

        <div className={styles.summary}>
          <div className={styles.row}>
            <span className={styles.rowLabel}>{space ? 'Espacio' : 'Reserva'}</span>
            <span className={styles.rowValue}>{space?.space_number ?? 'Solo estacionamiento'}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Tipo</span>
            <span className={styles.rowValue}>{categoryLabel}</span>
          </div>
          {space && (
            <div className={styles.row}>
              <span className={styles.rowLabel}>Piso</span>
              <span className={styles.rowValue}>{getFloorName(space.floor_id)}</span>
            </div>
          )}
          <div className={styles.row}>
            <span className={styles.rowLabel}>Fecha</span>
            <span className={styles.rowValue}>{filters.reservation_date}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Horario</span>
            <span className={styles.rowValue}>
              {filters.start_time} – {filters.end_time}
            </span>
          </div>
          {reservation.requiere_estacionamiento && (
            <div className={styles.row}>
              <span className={styles.rowLabel}>Estacionamiento</span>
              <span className={styles.rowValue}>
                {reservation.parking_spot
                  ? `${reservation.parking_spot.zone_name} · ${reservation.parking_spot.spot_number}`
                  : 'Sin disponibilidad'}
              </span>
            </div>
          )}
        </div>

        {newBadges.length > 0 && (
          <section className={styles.badgeUnlockPanel} aria-label="Logros desbloqueados">
            <div className={styles.badgeUnlockHeader}>
              <span>Logros desbloqueados</span>
              <strong>{newBadges.length}</strong>
            </div>
            <div className={styles.badgeUnlockList}>
              {newBadges.map((badge, index) => (
                <article
                  key={badge.id}
                  className={styles.badgeUnlockItem}
                  style={{ '--unlock-delay': `${index * 90}ms` } as CSSProperties}
                >
                  <span className={styles.badgeUnlockGlow} aria-hidden="true" />
                  <img src={getBadgeImage(badge.key, true)} alt="" />
                  <div>
                    <strong>{badge.name}</strong>
                    <small>{badge.description}</small>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <button
          ref={viewBtnRef}
          type="button"
          className={styles.viewBtn}
          onClick={onViewReservations}
        >
          Ver mis reservas
        </button>
        </div>
      </div>
    </div>
  );
}
