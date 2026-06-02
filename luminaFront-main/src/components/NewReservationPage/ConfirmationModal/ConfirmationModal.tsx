import { useRef, useEffect } from 'react';
import type { SpaceAvailability, FilterValues } from '../../../types/reservation';
import { PRIORITY_CATEGORY_LABELS } from '../../../data/floorLayouts';
import { isParkingEligible } from '../../../utils/parkingUtils';
import { LoadingSpinner } from '../../LoadingSpinner/LoadingSpinner';
import { ErrorBanner } from '../../ErrorBanner/ErrorBanner';
import styles from './ConfirmationModal.module.css';

interface ConfirmationModalProps {
  isOpen: boolean;
  mode?: 'desk-parking' | 'desk-only' | 'parking-only';
  space: SpaceAvailability | null;
  filters: FilterValues;
  onConfirm: (requiresParking: boolean) => void;
  onCancel: () => void;
  onDismissError?: () => void;
  isLoading: boolean;
  error: string | null;
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

export function ConfirmationModal({
  isOpen,
  mode = 'desk-parking',
  space,
  filters,
  onConfirm,
  onCancel,
  onDismissError,
  isLoading,
  error,
}: ConfirmationModalProps) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const parkingEligible = isParkingEligible(filters.reservation_date, filters.start_time);
  const isParkingOnly = mode === 'parking-only';
  const includesParking = mode === 'desk-parking' || isParkingOnly;
  const canConfirm = !isLoading && (!includesParking || parkingEligible);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      confirmBtnRef.current?.focus();
    } else {
      previousFocusRef.current?.focus();
    }
  }, [isOpen]);

  // Focus trap
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      onCancel();
      return;
    }
    if (e.key !== 'Tab') return;

    const modal = e.currentTarget;
    const focusable = modal.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
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

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-modal-title"
        className={styles.modal}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.modalHeader}>
          <div className={styles.modalHeaderIcon} aria-hidden="true" />
          <h2 id="confirmation-modal-title" className={styles.title}>
            {isParkingOnly ? 'Reservar estacionamiento' : 'Confirmar reserva'}
          </h2>
        </div>

        <div className={styles.modalBody}>
        <div className={styles.summary}>
          <div className={styles.row}>
            <span className={styles.rowLabel}>{isParkingOnly ? 'Reserva' : 'Espacio'}</span>
            <span className={styles.rowValue}>{space ? (space.display_name || space.space_number) : 'Solo estacionamiento'}</span>
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
            <span className={styles.rowLabel}>Hora inicio</span>
            <span className={styles.rowValue}>{filters.start_time}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Hora fin</span>
            <span className={styles.rowValue}>{filters.end_time}</span>
          </div>
        </div>

        <div className={`${styles.parkingSection} ${includesParking ? styles.parkingOnlySection : ''} ${includesParking && !parkingEligible ? styles.parkingSectionDisabled : ''}`}>
          {isParkingOnly ? (
            <div className={styles.parkingLabel}>
              <span className={styles.parkingIcon}>P</span>
              <span className={styles.parkingText}>Se asignará el primer cajón disponible</span>
            </div>
          ) : includesParking ? (
            <div className={styles.parkingLabel}>
              <span className={styles.parkingIcon}>P</span>
              <span className={styles.parkingText}>Esta reserva incluye estacionamiento</span>
            </div>
          ) : (
            <div className={styles.parkingLabel}>
              <span className={styles.parkingIcon}>P</span>
              <span className={styles.parkingText}>Sin estacionamiento</span>
            </div>
          )}
          {includesParking && !parkingEligible && (
            <p className={styles.parkingHint}>
              Selecciona fecha y hora para asignar estacionamiento.
            </p>
          )}
        </div>

        {isLoading && (
          <div className={styles.spinnerWrapper}>
            <LoadingSpinner />
          </div>
        )}

        {error && <ErrorBanner message={error} onDismiss={onDismissError} />}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancelar
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            className={styles.confirmBtn}
            onClick={() => onConfirm(includesParking)}
            disabled={!canConfirm}
          >
            {isParkingOnly ? 'Confirmar estacionamiento' : 'Confirmar reserva'}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
