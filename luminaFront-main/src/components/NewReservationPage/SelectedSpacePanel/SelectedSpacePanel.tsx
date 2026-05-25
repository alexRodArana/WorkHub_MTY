import type { SpaceAvailability, FilterValues } from '../../../types/reservation';
import { PRIORITY_CATEGORY_LABELS } from '../../../data/floorLayouts';
import styles from './SelectedSpacePanel.module.css';

const FLOOR_NAMES: Record<string, string> = {
  '0': 'Planta Baja',
  '1': 'Mezzanine',
  '3': 'Piso 3',
  '9': 'Piso 9',
};

function getFloorName(floorId: number | string): string {
  return FLOOR_NAMES[String(floorId)] ?? String(floorId);
}

interface SelectedSpacePanelProps {
  space: SpaceAvailability | null;
  filters: FilterValues;
  mode?: 'desk-parking' | 'desk-only' | 'parking-only';
  onContinue: () => void;
}

function formatDate(value: string): string {
  if (!value) return '—';
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(year, month - 1, day));
}

export function SelectedSpacePanel({ space, filters, mode = 'desk-parking', onContinue }: SelectedSpacePanelProps) {
  const categoryLabel = space
    ? (PRIORITY_CATEGORY_LABELS[space.priority_category] ?? space.priority_category)
    : null;
  const includesParking = mode === 'desk-parking';

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.eyebrow}>Selección actual</span>
        <h2 className={styles.title}>Tu espacio</h2>
      </div>

      {space ? (
        <>
          <div className={styles.spaceBadge}>
            <span className={styles.spaceNumber}>{space.display_name || space.space_number}</span>
            <span className={styles.spaceType}>{categoryLabel}</span>
          </div>

          <span className={`${styles.modePill} ${includesParking ? styles.modePillParking : ''}`}>
            {includesParking ? 'Incluye estacionamiento' : 'Solo escritorio'}
          </span>

          <div className={styles.info}>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Piso</span>
              <span className={styles.rowValue}>{getFloorName(space.floor_id)}</span>
            </div>
            {filters.reservation_date && (
              <div className={styles.row}>
                <span className={styles.rowLabel}>Fecha</span>
                <span className={styles.rowValue}>{formatDate(filters.reservation_date)}</span>
              </div>
            )}
            {filters.start_time && filters.end_time && (
              <div className={styles.row}>
                <span className={styles.rowLabel}>Horario</span>
                <span className={styles.rowValue}>{filters.start_time} – {filters.end_time}</span>
              </div>
            )}
          </div>
        </>
      ) : (
        <p className={styles.placeholder}>Selecciona un espacio en el mapa para continuar.</p>
      )}

      <button
        type="button"
        className={styles.continueBtn}
        onClick={onContinue}
        disabled={!space}
      >
        {includesParking ? 'Confirmar escritorio + estacionamiento' : 'Confirmar escritorio'}
      </button>
    </div>
  );
}
