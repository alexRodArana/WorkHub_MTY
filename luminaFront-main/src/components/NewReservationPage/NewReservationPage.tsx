import { useState, useEffect, useRef, useMemo, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import type {
  AiSpaceRecommendationMarker,
  FilterValues,
  RecommendationResult,
  SpaceAvailability,
  ReservationResponse,
  UserVehicle,
} from '../../types/reservation'
import { getSession } from '../../services/tokenStore'
import { fetchAvailability, createReservation, fetchRecommendations, fetchMyVehicles, createVehicle } from '../../services/reservationService'
import { mapReservationError } from '../../utils/reservationValidator'
import { getReservationIncentive, type ReservationIncentive } from '../../utils/reservationIncentives'
import { useReservationRealtime } from '../../hooks/useReservationRealtime'
import { FilterPanel } from './FilterPanel/FilterPanel'
import { FloorMap } from './FloorMap/FloorMap'
import { SelectedSpacePanel } from './SelectedSpacePanel/SelectedSpacePanel'
import { ConfirmationModal } from './ConfirmationModal/ConfirmationModal'
import { SuccessModal } from './SuccessModal/SuccessModal'
import { ErrorBanner } from '../ErrorBanner/ErrorBanner'
import AppShell from '../Layout/AppShell'
import styles from './NewReservationPage.module.css'

type ReservationMode = 'desk-parking' | 'desk-only' | 'parking-only'

const RESERVATION_MODES: Array<{
  value: ReservationMode
  label: string
  description: string
}> = [
  {
    value: 'desk-parking',
    label: 'Escritorio + estacionamiento',
    description: 'Reserva un escritorio y solicita cajón en el mismo flujo.',
  },
  {
    value: 'desk-only',
    label: 'Solo escritorio',
    description: 'Usa el mapa para elegir únicamente tu lugar de trabajo.',
  },
  {
    value: 'parking-only',
    label: 'Solo estacionamiento',
    description: 'Reserva un cajón sin seleccionar escritorio.',
  },
]

interface ReservationFlowState {
  filters: FilterValues
  availableSpaces: SpaceAvailability[]
  selectedSpace: SpaceAvailability | null
  confirmedSpace: SpaceAvailability | null
  reservationMode: ReservationMode
  isSearching: boolean
  hasSearched: boolean
  searchError: string | null
  floorCategories: string[] | null
  recommendations: RecommendationResult | null
  showConfirmationModal: boolean
  showSuccessModal: boolean
  confirmedReservation: ReservationResponse | null
  confirmError: string | null
  isConfirming: boolean
  vehicles: UserVehicle[]
  selectedVehicleId: number | null
  showVehiclePrompt: boolean
  vehicleError: string | null
  vehicleForm: {
    plate: string
    alias: string
    make: string
    model: string
    color: string
  }
  isSavingVehicle: boolean
  activeIncentive: ReservationIncentive | null
}

function getDefaultFilters(): FilterValues {
  const today = new Date().toISOString().slice(0, 10)
  const now = new Date()
  const h = now.getHours()
  const m = now.getMinutes()

  let startH = h
  let startM: number
  if (m === 0) { startM = 0 }
  else if (m <= 30) { startM = 30 }
  else { startH = h + 1; startM = 0 }

  if (startH < 7) { startH = 7; startM = 0 }
  if (startH > 22 || (startH === 22 && startM > 0)) { startH = 22; startM = 0 }

  const startTime = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`

  let endH = startH + 1
  const endM = startM
  if (endH > 22) endH = 22
  const endTime = startH >= 22 ? '' : `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`

  return {
    reservation_date: today,
    start_time: startTime,
    end_time: endTime,
    floor_id: null,
    priority_category: null,
  }
}

function getRecommendationReason(item: RecommendationResult['recommendations'][number]): string {
  if (item.nearby_user) {
    return `Cerca de ${item.nearby_user.first_name} ${item.nearby_user.last_name}`
  }

  const strongSignal = item.signals.find((signal) => signal.strength >= 0.55)
  if (strongSignal?.label === 'Patrón personal') return 'Coincide con tu historial de uso'
  if (strongSignal?.label === 'Disponibilidad prevista') return 'Buena disponibilidad para este horario'
  if (strongSignal?.label === 'Tipo de espacio') return 'Coincide con la zona que buscas'
  if (strongSignal?.label === 'Distribución del mapa') return 'Mejor distribución alrededor del espacio'

  return 'Buen ajuste por ocupación y disponibilidad'
}

export function NewReservationPage(): JSX.Element {
  const navigate = useNavigate()
  const [mapRefreshKey, setMapRefreshKey] = useState(0)
  const [state, setState] = useState<ReservationFlowState>({
    filters: getDefaultFilters(),
    availableSpaces: [],
    selectedSpace: null,
    confirmedSpace: null,
    reservationMode: 'desk-parking',
    isSearching: false,
    hasSearched: false,
    searchError: null,
    floorCategories: null,
    recommendations: null,
    showConfirmationModal: false,
    showSuccessModal: false,
    confirmedReservation: null,
    confirmError: null,
    isConfirming: false,
    vehicles: [],
    selectedVehicleId: null,
    showVehiclePrompt: false,
    vehicleError: null,
    vehicleForm: { plate: '', alias: '', make: '', model: '', color: '' },
    isSavingVehicle: false,
    activeIncentive: null,
  })

  useEffect(() => {
    const token = getSession()?.access_token
    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    fetchMyVehicles(token).then((result) => {
      if (result.success) {
        const defaultVehicle = result.data.find((vehicle) => vehicle.is_default) ?? result.data[0] ?? null
        setState((prev) => ({
          ...prev,
          vehicles: result.data,
          selectedVehicleId: prev.selectedVehicleId ?? defaultVehicle?.id ?? null,
        }))
      } else if (result.unauthorized) {
        navigate('/login', { replace: true })
      }
    })
  }, [navigate])

  // Stable ref so auto-search effect doesn't re-register when handleSearch identity changes
  const handleSearchRef = useRef<() => Promise<void>>(null as unknown as () => Promise<void>)
  const searchRequestIdRef = useRef(0)
  const dismissedIncentivesRef = useRef(new Set<string>())

  // Auto-search when all required fields are valid
  useEffect(() => {
    const { reservation_date, start_time, end_time } = state.filters
    if (state.reservationMode === 'parking-only') return
    const allFilled = reservation_date && start_time && end_time && end_time > start_time
    if (!allFilled) return
    const timeoutId = window.setTimeout(() => {
      handleSearchRef.current?.()
    }, 220)
    return () => window.clearTimeout(timeoutId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.filters.reservation_date, state.filters.start_time, state.filters.end_time, state.filters.floor_id, state.filters.priority_category, state.reservationMode])

  useEffect(() => {
    const incentive = getReservationIncentive(state.filters.reservation_date)
    if (!incentive || dismissedIncentivesRef.current.has(incentive.key)) {
      setState((prev) => (prev.activeIncentive === null ? prev : { ...prev, activeIncentive: null }))
      return
    }

    setState((prev) => (
      prev.activeIncentive?.key === incentive.key
        ? prev
        : { ...prev, activeIncentive: incentive }
    ))
  }, [state.filters.reservation_date])

  useEffect(() => {
    if (!state.searchError) return
    const timeoutId = window.setTimeout(() => {
      setState((prev) => ({ ...prev, searchError: null }))
    }, 5000)
    return () => window.clearTimeout(timeoutId)
  }, [state.searchError])

  useEffect(() => {
    if (!state.confirmError) return
    const timeoutId = window.setTimeout(() => {
      setState((prev) => ({ ...prev, confirmError: null }))
    }, 5000)
    return () => window.clearTimeout(timeoutId)
  }, [state.confirmError])

  async function handleSearch() {
    if (state.reservationMode === 'parking-only') return

    const token = getSession()?.access_token
    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    const requestId = searchRequestIdRef.current + 1
    searchRequestIdRef.current = requestId

    setState((prev) => ({ ...prev, isSearching: true, searchError: null }))

    const [result, recommendationResult] = await Promise.all([
      fetchAvailability(state.filters, token),
      fetchRecommendations(state.filters, token),
    ])

    if (requestId !== searchRequestIdRef.current) {
      return
    }

    if (!result.success) {
      if (result.unauthorized) {
        navigate('/login', { replace: true })
        return
      }
      setState((prev) => ({
        ...prev,
        isSearching: false,
        searchError: 'No se pudo obtener la disponibilidad. Intenta de nuevo.',
      }))
      return
    }

    setState((prev) => ({
      ...prev,
      isSearching: false,
      hasSearched: true,
      availableSpaces: result.data,
      selectedSpace: null,
      recommendations: recommendationResult.success ? recommendationResult.data : null,
    }))
  }

  function handleSelectSpace(space: SpaceAvailability) {
    setState((prev) => ({ ...prev, selectedSpace: space, confirmError: null }))
  }

  function handleVisibleFloorChange(floorId: number) {
    setState((prev) => {
      if (!prev.selectedSpace || prev.selectedSpace.floor_id === floorId) return prev
      return { ...prev, selectedSpace: null, confirmError: null }
    })
  }

  function requiresVehicleForCurrentMode(mode = state.reservationMode): boolean {
    return mode === 'desk-parking' || mode === 'parking-only'
  }

  function continueWithVehicleGate() {
    if (!requiresVehicleForCurrentMode()) {
      setState((prev) => ({ ...prev, showConfirmationModal: true }))
      return
    }

    if (state.vehicles.length === 0 || !state.selectedVehicleId) {
      setState((prev) => ({
        ...prev,
        showVehiclePrompt: true,
        vehicleError: state.vehicles.length === 0
          ? 'Agrega un vehículo antes de reservar estacionamiento.'
          : 'Selecciona el vehículo que usarás para esta reserva.',
      }))
      return
    }

    setState((prev) => ({ ...prev, showConfirmationModal: true }))
  }

  function handleContinue() {
    continueWithVehicleGate()
  }

  function handleParkingOnlyContinue() {
    const { reservation_date, start_time, end_time } = state.filters
    if (!reservation_date || !start_time || !end_time || end_time <= start_time) {
      setState((prev) => ({
        ...prev,
        searchError: 'Selecciona una fecha y un horario válido para reservar estacionamiento.',
      }))
      return
    }

    setState((prev) => ({ ...prev, selectedSpace: null, confirmError: null }))
    continueWithVehicleGate()
  }

  function handleModeChange(mode: ReservationMode) {
    setState((prev) => ({
      ...prev,
      reservationMode: mode,
      selectedSpace: mode === 'parking-only' ? null : prev.selectedSpace,
      confirmError: null,
      searchError: null,
    }))
  }

  function dismissIncentive() {
    setState((prev) => {
      if (prev.activeIncentive) {
        dismissedIncentivesRef.current.add(prev.activeIncentive.key)
      }

      return { ...prev, activeIncentive: null }
    })
  }

  async function handleSaveVehicle() {
    const token = getSession()?.access_token
    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    const plate = state.vehicleForm.plate.trim()
    if (plate.length < 4) {
      setState((prev) => ({ ...prev, vehicleError: 'La placa debe tener al menos 4 caracteres.' }))
      return
    }

    setState((prev) => ({ ...prev, isSavingVehicle: true, vehicleError: null }))
    const result = await createVehicle(token, {
      plate,
      alias: state.vehicleForm.alias,
      make: state.vehicleForm.make,
      model: state.vehicleForm.model,
      color: state.vehicleForm.color,
      is_default: state.vehicles.length === 0,
    })

    if (!result.success) {
      if (result.unauthorized) navigate('/login', { replace: true })
      else {
        setState((prev) => ({
          ...prev,
          isSavingVehicle: false,
          vehicleError: 'No se pudo guardar el vehículo. Revisa los datos e intenta de nuevo.',
        }))
      }
      return
    }

    setState((prev) => ({
      ...prev,
      isSavingVehicle: false,
      vehicles: [result.data, ...prev.vehicles.filter((vehicle) => vehicle.id !== result.data.id)],
      selectedVehicleId: result.data.id,
      vehicleError: null,
      vehicleForm: { plate: '', alias: '', make: '', model: '', color: '' },
    }))
  }

  function handleVehiclePromptContinue() {
    if (!state.selectedVehicleId) {
      setState((prev) => ({ ...prev, vehicleError: 'Selecciona o registra un vehículo para continuar.' }))
      return
    }

    setState((prev) => ({
      ...prev,
      showVehiclePrompt: false,
      vehicleError: null,
      showConfirmationModal: true,
    }))
  }

  async function handleConfirm(requiresParking: boolean) {
    const token = getSession()?.access_token
    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    if (state.reservationMode !== 'parking-only' && !state.selectedSpace) return

    setState((prev) => ({ ...prev, isConfirming: true, confirmError: null }))

    const isParkingOnly = state.reservationMode === 'parking-only'
    const modeRequiresParking = state.reservationMode === 'desk-parking' || isParkingOnly
    const payload = {
      space_id: isParkingOnly ? null : state.selectedSpace?.id,
      reservation_date: state.filters.reservation_date,
      start_time: state.filters.start_time,
      end_time: state.filters.end_time,
      requiere_estacionamiento: modeRequiresParking || requiresParking,
      vehicle_id: modeRequiresParking ? state.selectedVehicleId : null,
    }

    const optimisticSpace = state.selectedSpace
    if (optimisticSpace && !isParkingOnly) {
      setState((prev) => ({
        ...prev,
        availableSpaces: prev.availableSpaces.filter((space) => space.id !== optimisticSpace.id),
      }))
    }

    const result = await createReservation(payload, token)

    if (result.success) {
      setState((prev) => ({
        ...prev,
        isConfirming: false,
        confirmedReservation: result.data,
        confirmedSpace: isParkingOnly ? null : state.selectedSpace,
        showSuccessModal: true,
        showConfirmationModal: false,
      }))
      return
    }

    if (result.unauthorized) {
      navigate('/login', { replace: true })
      return
    }

    const errorCode = result.error

    if (errorCode === 'VEHICLE_REQUIRED' || errorCode === 'VEHICLE_SELECTION_REQUIRED' || errorCode === 'VEHICLE_NOT_FOUND') {
      setState((prev) => ({
        ...prev,
        isConfirming: false,
        showConfirmationModal: false,
        showVehiclePrompt: true,
        vehicleError: errorCode === 'VEHICLE_NOT_FOUND'
          ? 'El vehículo seleccionado ya no está disponible. Selecciona otro o registra uno nuevo.'
          : 'Selecciona o registra un vehículo antes de continuar.',
        availableSpaces: optimisticSpace && !isParkingOnly
          ? [optimisticSpace, ...prev.availableSpaces]
          : prev.availableSpaces,
      }))
      return
    }

    if ((errorCode === 'SPACE_NOT_FOUND' || errorCode === 'SPACE_UNAVAILABLE') && state.selectedSpace) {
      const removedId = state.selectedSpace?.id
      setState((prev) => ({
        ...prev,
        isConfirming: false,
        confirmError: mapReservationError(errorCode),
        availableSpaces: removedId ? prev.availableSpaces.filter((s) => s.id !== removedId) : prev.availableSpaces,
        selectedSpace: null,
      }))
      return
    }

    setState((prev) => ({
      ...prev,
      isConfirming: false,
      confirmError: mapReservationError(errorCode),
      availableSpaces: optimisticSpace && !isParkingOnly
        ? [optimisticSpace, ...prev.availableSpaces]
        : prev.availableSpaces,
    }))
  }

  function handleCancelModal() {
    setState((prev) => ({ ...prev, showConfirmationModal: false, confirmError: null }))
  }

  function handleViewReservations() {
    navigate('/mis-reservas')
  }

  function handleCategoriesLoaded(cats: string[]) {
    setState((prev) => {
      const catInvalid =
        prev.filters.priority_category !== null &&
        !cats.includes(prev.filters.priority_category)

      return {
        ...prev,
        floorCategories: cats,
        filters: catInvalid
          ? { ...prev.filters, priority_category: null }
          : prev.filters,
      }
    })
  }

  // Keep ref in sync after each render so auto-search always calls the latest closure
  handleSearchRef.current = handleSearch

  useReservationRealtime((event) => {
    if (state.reservationMode === 'parking-only') return

    const filters = state.filters
    const hasValidSearch = filters.reservation_date && filters.start_time && filters.end_time && filters.end_time > filters.start_time
    const sameDate = !event.reservation_date || event.reservation_date === filters.reservation_date
    const sameFloor = filters.floor_id === null || event.floor_id === undefined || event.floor_id === filters.floor_id

    if (!sameDate || !sameFloor) return

    setMapRefreshKey((value) => value + 1)
    if (hasValidSearch) {
      handleSearchRef.current?.()
    }
  })

  const aiRecommendedSpaces = useMemo(
    () => new Map<number, AiSpaceRecommendationMarker>(
      state.recommendations?.recommendations.map((item) => [
        item.space.id,
        {
          floor_id: item.space.floor_id,
          score: item.score,
          reason: getRecommendationReason(item),
        },
      ]) ?? []
    ),
    [state.recommendations]
  )
  const recommendationCount = state.recommendations?.recommendations.length ?? 0
  const isParkingOnlyMode = state.reservationMode === 'parking-only'
  const selectedVehicle = state.vehicles.find((vehicle) => vehicle.id === state.selectedVehicleId) ?? null
  const selectedVehicleLabel = selectedVehicle
    ? `${selectedVehicle.alias || [selectedVehicle.make, selectedVehicle.model].filter(Boolean).join(' ') || 'Vehículo'} · ${selectedVehicle.plate}`
    : null

  return (
    <AppShell title="Nueva Reserva">
      <div className={styles.pageContent}>
        <section className={styles.filterSection}>
          <div className={styles.filterCard} data-tour="reservation-filters">
            <div className={styles.modeTabs} role="tablist" aria-label="Tipo de reserva" data-tour="reservation-modes">
              {RESERVATION_MODES.map((mode, index) => (
                <button
                  key={mode.value}
                  type="button"
                  role="tab"
                  aria-selected={state.reservationMode === mode.value}
                  aria-label={`${mode.label}: ${mode.description}`}
                  title={mode.description}
                  className={`${styles.modeTab} ${state.reservationMode === mode.value ? styles.modeTabActive : ''}`}
                  onClick={() => handleModeChange(mode.value)}
                  style={{ '--tab-delay': `${index * 70}ms` } as CSSProperties}
                >
                  <span>{mode.label}</span>
                </button>
              ))}
            </div>
            <FilterPanel
              values={state.filters}
              onChange={(filters) => setState((prev) => ({ ...prev, filters }))}
              onSearch={handleSearch}
              isLoading={state.isSearching}
              availableCategories={state.floorCategories}
            />
            {state.activeIncentive && (
              <aside className={styles.incentiveCard} role="status" aria-live="polite">
                <span className={styles.incentiveIcon} aria-hidden="true">{state.activeIncentive.label}</span>
                <div>
                  <strong>{state.activeIncentive.title}</strong>
                  <p>{state.activeIncentive.message}</p>
                </div>
                <button type="button" onClick={dismissIncentive} aria-label="Cerrar incentivo">
                  ×
                </button>
              </aside>
            )}
          </div>
        </section>

        <section className={styles.mapRow}>
          <main className={styles.mapMain}>
            {state.searchError && (
              <div className={styles.errorWrap}>
                <ErrorBanner
                  message={state.searchError}
                  onDismiss={() => setState((prev) => ({ ...prev, searchError: null }))}
                />
              </div>
            )}

            {!isParkingOnlyMode && state.hasSearched && state.availableSpaces.length === 0 && !state.searchError && (
              <div className={styles.emptyWrap}>
                Sin espacios disponibles para los filtros seleccionados. Prueba otra fecha u horario.
              </div>
            )}

            <div className={`${styles.mapCard} ${recommendationCount > 0 ? styles.aiMapCard : ''}`} data-tour="reservation-map">
              {isParkingOnlyMode ? (
                <div className={styles.parkingOnlyPanel} data-tour="reservation-parking-only">
                  <span className={styles.parkingOnlyIcon} aria-hidden="true">P</span>
                  <h2>Reserva de estacionamiento</h2>
                  <p>
                    Se asignará automáticamente el primer cajón disponible según la prioridad de zonas.
                    Esta reserva no requiere seleccionar asiento ni hacer check-in.
                  </p>
                  <div className={styles.vehicleInline}>
                    <span>Vehículo</span>
                    <strong>{selectedVehicleLabel ?? 'Pendiente de registrar'}</strong>
                    <button type="button" onClick={() => setState((prev) => ({ ...prev, showVehiclePrompt: true, vehicleError: null }))}>
                      {selectedVehicleLabel ? 'Cambiar' : 'Agregar vehículo'}
                    </button>
                  </div>
                  <dl>
                    <div>
                      <dt>Fecha</dt>
                      <dd>{state.filters.reservation_date || 'Selecciona fecha'}</dd>
                    </div>
                    <div>
                      <dt>Horario</dt>
                      <dd>{state.filters.start_time && state.filters.end_time ? `${state.filters.start_time} - ${state.filters.end_time}` : 'Selecciona horario'}</dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    className={styles.parkingContinueBtn}
                    onClick={handleParkingOnlyContinue}
                    disabled={state.isConfirming}
                  >
                    Continuar
                  </button>
                </div>
              ) : (
                <FloorMap
                  floorId={state.filters.floor_id}
                  availableSpaces={state.availableSpaces}
                  selectedSpaceId={state.selectedSpace?.id ?? null}
                  onSelectSpace={handleSelectSpace}
                  isLoading={state.isSearching}
                  hasSearched={state.hasSearched}
                  reservationDate={state.filters.reservation_date}
                  aiRecommendedSpaces={aiRecommendedSpaces}
                  refreshKey={mapRefreshKey}
                  onCategoriesLoaded={handleCategoriesLoaded}
                  onVisibleFloorChange={handleVisibleFloorChange}
                />
              )}
            </div>
          </main>

          <aside className={`${styles.sidePanel} ${!isParkingOnlyMode && state.selectedSpace ? styles.sidePanelOpen : ''}`}>
            <div className={styles.selectedCard}>
              <SelectedSpacePanel
                space={state.selectedSpace}
                filters={state.filters}
                mode={state.reservationMode}
                onContinue={handleContinue}
              />
            </div>
          </aside>
        </section>
      </div>

      {state.showConfirmationModal && (state.reservationMode === 'parking-only' || state.selectedSpace) && (
        <ConfirmationModal
          isOpen={state.showConfirmationModal}
          mode={state.reservationMode}
          space={state.selectedSpace}
          filters={state.filters}
          onConfirm={handleConfirm}
          onCancel={handleCancelModal}
          onDismissError={() => setState((prev) => ({ ...prev, confirmError: null }))}
          isLoading={state.isConfirming}
          error={state.confirmError}
        />
      )}

      {state.showVehiclePrompt && (
        <div
          className={styles.vehicleBackdrop}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setState((prev) => ({ ...prev, showVehiclePrompt: false, vehicleError: null }))
            }
          }}
        >
          <section className={styles.vehicleModal} role="dialog" aria-modal="true" aria-label="Vehículo para estacionamiento">
            <div className={styles.vehicleHeader}>
              <span>Estacionamiento</span>
              <h2>Selecciona un vehículo</h2>
              <p>Para asignarte un cajón necesitamos saber qué vehículo usarás. Puedes tener varios registrados.</p>
            </div>

            {state.vehicles.length > 0 && (
              <div className={styles.vehicleList}>
                {state.vehicles.map((vehicle) => (
                  <button
                    key={vehicle.id}
                    type="button"
                    className={`${styles.vehicleOption} ${state.selectedVehicleId === vehicle.id ? styles.vehicleOptionActive : ''}`}
                    onClick={() => setState((prev) => ({ ...prev, selectedVehicleId: vehicle.id, vehicleError: null }))}
                  >
                    <strong>{vehicle.alias || [vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Vehículo'}</strong>
                    <span>{vehicle.plate}{vehicle.color ? ` · ${vehicle.color}` : ''}</span>
                  </button>
                ))}
              </div>
            )}

            <div className={styles.vehicleForm}>
              <label>
                <span>Placa</span>
                <input
                  value={state.vehicleForm.plate}
                  onChange={(event) => setState((prev) => ({ ...prev, vehicleForm: { ...prev.vehicleForm, plate: event.target.value.toUpperCase() } }))}
                  placeholder="ABC-123"
                />
              </label>
              <label>
                <span>Alias</span>
                <input
                  value={state.vehicleForm.alias}
                  onChange={(event) => setState((prev) => ({ ...prev, vehicleForm: { ...prev.vehicleForm, alias: event.target.value } }))}
                  placeholder="Mi carro"
                />
              </label>
              <label>
                <span>Marca</span>
                <input
                  value={state.vehicleForm.make}
                  onChange={(event) => setState((prev) => ({ ...prev, vehicleForm: { ...prev.vehicleForm, make: event.target.value } }))}
                  placeholder="Honda"
                />
              </label>
              <label>
                <span>Modelo</span>
                <input
                  value={state.vehicleForm.model}
                  onChange={(event) => setState((prev) => ({ ...prev, vehicleForm: { ...prev.vehicleForm, model: event.target.value } }))}
                  placeholder="Civic"
                />
              </label>
              <label>
                <span>Color</span>
                <input
                  value={state.vehicleForm.color}
                  onChange={(event) => setState((prev) => ({ ...prev, vehicleForm: { ...prev.vehicleForm, color: event.target.value } }))}
                  placeholder="Gris"
                />
              </label>
            </div>

            {state.vehicleError && <div className={styles.vehicleError}>{state.vehicleError}</div>}

            <div className={styles.vehicleActions}>
              <button
                type="button"
                onClick={() => setState((prev) => ({ ...prev, showVehiclePrompt: false, vehicleError: null }))}
              >
                Cancelar
              </button>
              <button type="button" onClick={() => void handleSaveVehicle()} disabled={state.isSavingVehicle}>
                {state.isSavingVehicle ? 'Guardando...' : 'Guardar vehículo'}
              </button>
              <button type="button" onClick={handleVehiclePromptContinue} disabled={!state.selectedVehicleId}>
                Continuar
              </button>
            </div>
          </section>
        </div>
      )}

      {state.showSuccessModal && state.confirmedReservation && (
        <SuccessModal
          isOpen={state.showSuccessModal}
          reservation={state.confirmedReservation}
          space={state.confirmedSpace}
          filters={state.filters}
          onViewReservations={handleViewReservations}
        />
      )}
    </AppShell>
  )
}
