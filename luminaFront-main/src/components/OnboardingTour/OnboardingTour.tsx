import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { isAdminRole, isGuardRole } from '../../utils/roleRouting'
import styles from './OnboardingTour.module.css'

type TourRole = 'employee' | 'admin' | 'guard'
type TourPlacement = 'top' | 'right' | 'bottom' | 'left' | 'center'

type TourStep = {
  id: string
  route: string
  selector?: string
  eyebrow: string
  title: string
  body: string
  placement?: TourPlacement
}

type TargetRect = {
  left: number
  top: number
  width: number
  height: number
}

type OnboardingTourProps = {
  role?: string
  userId?: number | string | null
  restartKey: number
}

const STORAGE_PREFIX = 'workhub-onboarding-tour-v6'
const ACTIVE_SESSION_KEY = 'workhub-onboarding-tour-active'
const CARD_WIDTH = 390
const VIEWPORT_GAP = 18

type ActiveTourState = {
  role: TourRole
  userKey: string
  stepIndex: number
}

function tourSelector(id: string): string {
  return `[data-tour="${id}"]`
}

function getTourRole(role?: string): TourRole {
  if (isGuardRole(role)) return 'guard'
  if (isAdminRole(role)) return 'admin'
  return 'employee'
}

function shouldOpenSidebar(step?: TourStep): boolean {
  if (!step?.selector) return false
  return step.selector.includes('main-navigation') ||
    step.selector.includes('nav-') ||
    step.selector.includes('brand')
}

function setSidebarTourState(open: boolean): void {
  if (open) document.body.setAttribute('data-tour-sidebar', 'open')
  else document.body.removeAttribute('data-tour-sidebar')
}

function getUserKey(userId: OnboardingTourProps['userId']): string {
  return userId == null ? 'anonymous' : String(userId)
}

function readActiveTour(): ActiveTourState | null {
  try {
    const raw = window.sessionStorage.getItem(ACTIVE_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ActiveTourState>
    if (!parsed.role || typeof parsed.stepIndex !== 'number' || !parsed.userKey) return null
    return {
      role: parsed.role,
      userKey: parsed.userKey,
      stepIndex: parsed.stepIndex,
    }
  } catch {
    return null
  }
}

function writeActiveTour(state: ActiveTourState): void {
  try {
    window.sessionStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(state))
  } catch {
    // Non-critical; the tour still works inside the current mounted page.
  }
}

function clearActiveTour(): void {
  try {
    window.sessionStorage.removeItem(ACTIVE_SESSION_KEY)
  } catch {
    // Ignore storage failures.
  }
}

const employeeSteps: TourStep[] = [
  {
    id: 'employee-welcome',
    route: '/dashboard',
    selector: tourSelector('page-header'),
    eyebrow: 'Inicio',
    title: 'Bienvenido a WorkHub MTY',
    body: 'Esta guía te muestra las funciones principales: reservas, disponibilidad en tiempo real, recomendaciones con Gemini, logros, perfil y asistente IA.',
    placement: 'bottom',
  },
  {
    id: 'employee-nav',
    route: '/dashboard',
    selector: tourSelector('main-navigation'),
    eyebrow: 'Navegación',
    title: 'Tus pestañas principales siempre a mano',
    body: 'La barra se expande automáticamente durante esta guía para que veas los nombres. Aquí entras a Inicio, Nueva Reserva, Mis Reservas, Logros y Perfil.',
    placement: 'right',
  },
  {
    id: 'employee-today',
    route: '/dashboard',
    selector: tourSelector('dashboard-today'),
    eyebrow: 'Dashboard',
    title: 'Tu reserva del día',
    body: 'Aquí ves si tienes reserva para hoy, el horario, estado y la opción de hacer check-in cuando el sistema lo permita.',
    placement: 'bottom',
  },
  {
    id: 'employee-actions',
    route: '/dashboard',
    selector: tourSelector('dashboard-actions'),
    eyebrow: 'Accesos rápidos',
    title: 'Reservar o revisar historial',
    body: 'Estos accesos te llevan directo a crear una reserva o revisar tus reservas actuales e históricas.',
    placement: 'top',
  },
  {
    id: 'employee-new-reservation-nav',
    route: '/dashboard',
    selector: tourSelector('nav-new-reservation'),
    eyebrow: 'Nueva Reserva',
    title: 'Empieza el flujo de reserva',
    body: 'Para reservar, entra primero a Nueva Reserva. Ahí eliges el tipo de reserva, defines fecha y horario, revisas el mapa y confirmas.',
    placement: 'right',
  },
  {
    id: 'employee-reservation-modes',
    route: '/nueva-reserva',
    selector: tourSelector('reservation-modes'),
    eyebrow: 'Paso 1',
    title: 'Selecciona qué quieres reservar',
    body: 'Elige una de las tres tabs: Escritorio + estacionamiento si necesitas ambos, Solo escritorio si no ocupas cajón, o Solo estacionamiento si únicamente necesitas acceso al parking.',
    placement: 'bottom',
  },
  {
    id: 'employee-reservation-filters',
    route: '/nueva-reserva',
    selector: tourSelector('reservation-filters'),
    eyebrow: 'Paso 2',
    title: 'Define fecha, horario y zona',
    body: 'Después selecciona fecha, hora de inicio, hora de fin y una zona opcional. Con esos datos el sistema consulta disponibilidad real y actualiza el mapa sin recargar.',
    placement: 'bottom',
  },
  {
    id: 'employee-floor-tabs',
    route: '/nueva-reserva',
    selector: tourSelector('floor-tabs'),
    eyebrow: 'Paso 3',
    title: 'Revisa el piso que prefieras',
    body: 'Cambia entre pisos para ver sus planos completos. Si Gemini recomienda escritorios en otro piso, la tab del piso muestra un brillo con el número de sugerencias.',
    placement: 'bottom',
  },
  {
    id: 'employee-map',
    route: '/nueva-reserva',
    selector: tourSelector('floor-map'),
    eyebrow: 'Paso 4',
    title: 'Selecciona tu lugar en el mapa',
    body: 'Haz clic sobre un escritorio disponible. El hover grande te muestra piso, nombre del lugar, ocupantes, foto y horario ocupado. Las recomendaciones de Gemini aparecen con brillo animado.',
    placement: 'left',
  },
  {
    id: 'employee-reservation-confirm',
    route: '/nueva-reserva',
    selector: tourSelector('reservation-map'),
    eyebrow: 'Paso 5',
    title: 'Confirma según el tipo de reserva',
    body: 'Si elegiste escritorio, al seleccionar un lugar se abre el panel lateral para confirmar. Si elegiste solo estacionamiento, no necesitas mapa: revisa fecha y horario y presiona Continuar.',
    placement: 'top',
  },
  {
    id: 'employee-ai',
    route: '/nueva-reserva',
    selector: tourSelector('ai-assistant'),
    eyebrow: 'Gemini',
    title: 'Asistente IA integrado',
    body: 'El chat consulta Gemini desde el backend para responder sobre ocupación, disponibilidad y recomendaciones usando datos reales del sistema.',
    placement: 'left',
  },
  {
    id: 'employee-my-reservations',
    route: '/mis-reservas',
    selector: tourSelector('my-reservations-tabs'),
    eyebrow: 'Mis Reservas',
    title: 'Consulta reservas activas e historial',
    body: 'En Activas ves lo que aún puedes usar o cancelar. En Historial revisas reservas pasadas, canceladas, no-show y registros con check-in.',
    placement: 'bottom',
  },
  {
    id: 'employee-reservation-list',
    route: '/mis-reservas',
    selector: tourSelector('my-reservations-list'),
    eyebrow: 'Gestión',
    title: 'Identifica el tipo de cada reserva',
    body: 'Cada tarjeta indica si es Solo estacionamiento, Solo escritorio o Escritorio + estacionamiento. También muestra piso, horario, código, cajón asignado y acciones disponibles.',
    placement: 'top',
  },
  {
    id: 'employee-badges-progress',
    route: '/logros',
    selector: tourSelector('badges-progress'),
    eyebrow: 'Gamificación',
    title: 'Progreso y rachas',
    body: 'Los logros se desbloquean por comportamiento de uso. Cuando ganas uno, aparece una animación y el badge queda a color.',
    placement: 'bottom',
  },
  {
    id: 'employee-badges-grid',
    route: '/logros',
    selector: tourSelector('badges-grid'),
    eyebrow: 'Badges',
    title: 'Insignias desbloqueadas y pendientes',
    body: 'Los badges pendientes se ven en blanco y negro; los desbloqueados muestran imagen, título, descripción y porcentaje de usuarios que lo consiguieron.',
    placement: 'top',
  },
  {
    id: 'employee-profile',
    route: '/perfil',
    selector: tourSelector('profile-card'),
    eyebrow: 'Perfil',
    title: 'Tu identidad visible',
    body: 'Tu foto se usa en el mapa cuando ocupas un espacio, para que otros usuarios sepan quién reservó ese lugar.',
    placement: 'bottom',
  },
  {
    id: 'employee-photo',
    route: '/perfil',
    selector: tourSelector('profile-photo'),
    eyebrow: 'Foto',
    title: 'Sube tu imagen desde el dispositivo',
    body: 'Puedes cambiar o quitar tu foto. El sistema la optimiza antes de guardarla para mantener buena velocidad.',
    placement: 'left',
  },
  {
    id: 'employee-theme',
    route: '/perfil',
    selector: tourSelector('theme-toggle'),
    eyebrow: 'Apariencia',
    title: 'Tema claro u oscuro',
    body: 'Este control cambia el fondo blanco por un gris oscuro azulado, manteniendo la paleta morada de la aplicación.',
    placement: 'left',
  },
]

const adminSteps: TourStep[] = [
  {
    id: 'admin-welcome',
    route: '/admin',
    selector: tourSelector('page-header'),
    eyebrow: 'Administrador',
    title: 'Centro operativo',
    body: 'La vista admin se divide en KPIs y Gestión. Desde aquí monitoreas uso, ocupación, estacionamiento y bloqueos.',
    placement: 'bottom',
  },
  {
    id: 'admin-date',
    route: '/admin',
    selector: tourSelector('admin-date-filter'),
    eyebrow: 'Fecha',
    title: 'Consulta por día',
    body: 'Selecciona una fecha para recalcular todos los KPIs y gráficas con la información de reservas de ese día.',
    placement: 'bottom',
  },
  {
    id: 'admin-kpis',
    route: '/admin',
    selector: tourSelector('admin-kpis'),
    eyebrow: 'KPIs',
    title: 'Indicadores clave',
    body: 'Aquí ves reservas, ocupación, usuarios únicos, estacionamiento, cancelaciones, no-shows y espacios bloqueados.',
    placement: 'bottom',
  },
  {
    id: 'admin-insights',
    route: '/admin',
    selector: tourSelector('admin-insights'),
    eyebrow: 'Análisis',
    title: 'Salud operativa',
    body: 'Las gráficas muestran ocupación total, uso de estacionamiento, pico de demanda y piso más activo.',
    placement: 'top',
  },
  {
    id: 'admin-charts',
    route: '/admin',
    selector: tourSelector('admin-charts'),
    eyebrow: 'Gráficas',
    title: 'Demanda y comportamiento',
    body: 'Revisa distribución por piso, tipo de espacio, demanda por hora y usuarios con más actividad.',
    placement: 'top',
  },
  {
    id: 'admin-management-nav',
    route: '/admin',
    selector: tourSelector('nav-admin-management'),
    eyebrow: 'Gestión',
    title: 'Bloqueo de espacios',
    body: 'Desde esta pestaña puedes bloquear un escritorio o sala por fecha y horario sin usar recomendaciones IA.',
    placement: 'right',
  },
  {
    id: 'admin-management-controls',
    route: '/admin/gestion',
    selector: tourSelector('management-controls'),
    eyebrow: 'Parámetros',
    title: 'Define fecha, horario y motivo',
    body: 'Antes de seleccionar un lugar, indica cuándo estará bloqueado y por qué. El motivo queda visible para operación.',
    placement: 'bottom',
  },
  {
    id: 'admin-management-map',
    route: '/admin/gestion',
    selector: tourSelector('management-map'),
    eyebrow: 'Mapa admin',
    title: 'Selecciona en el plano',
    body: 'Haz clic en un espacio del mapa para abrir la confirmación de bloqueo. Este mapa no muestra recomendaciones IA.',
    placement: 'top',
  },
  {
    id: 'admin-management-blocks',
    route: '/admin/gestion',
    selector: tourSelector('management-blocks'),
    eyebrow: 'Bloqueos activos',
    title: 'Libera espacios cuando vuelvan a estar disponibles',
    body: 'Esta lista muestra los bloqueos del día y permite liberar cada espacio para que vuelva a aceptar reservas.',
    placement: 'top',
  },
  {
    id: 'admin-theme',
    route: '/admin/gestion',
    selector: tourSelector('theme-toggle'),
    eyebrow: 'Apariencia',
    title: 'Dashboard listo para tema oscuro',
    body: 'El tema oscuro mantiene la paleta morada y ajusta tarjetas, gráficas y controles para operación prolongada.',
    placement: 'left',
  },
]

const guardSteps: TourStep[] = [
  {
    id: 'guard-welcome',
    route: '/guardia',
    selector: tourSelector('page-header'),
    eyebrow: 'Guardia',
    title: 'Vista exclusiva de acceso',
    body: 'El perfil guardia solo ve esta pestaña. Está enfocada en validar quién tiene estacionamiento reservado para el día.',
    placement: 'bottom',
  },
  {
    id: 'guard-hero',
    route: '/guardia',
    selector: tourSelector('guard-hero'),
    eyebrow: 'Consulta',
    title: 'Selecciona la fecha',
    body: 'Usa el selector para revisar los cajones reservados en cualquier fecha permitida.',
    placement: 'bottom',
  },
  {
    id: 'guard-summary',
    route: '/guardia',
    selector: tourSelector('guard-summary'),
    eyebrow: 'Resumen',
    title: 'Conteo rápido',
    body: 'Estas tarjetas muestran total de reservas, activas, zonas ocupadas y la siguiente entrada programada.',
    placement: 'bottom',
  },
  {
    id: 'guard-list',
    route: '/guardia',
    selector: tourSelector('guard-list'),
    eyebrow: 'Validación',
    title: 'Personas con cajón reservado',
    body: 'Cada tarjeta muestra foto, nombre, zona, cajón, horario, código y estado para validar el acceso sin pedir ayuda a admin.',
    placement: 'top',
  },
  {
    id: 'guard-theme',
    route: '/guardia',
    selector: tourSelector('theme-toggle'),
    eyebrow: 'Apariencia',
    title: 'Tema oscuro',
    body: 'Puedes cambiar a un fondo gris oscuro azulado para operación en recepción o vigilancia.',
    placement: 'left',
  },
]

const STEPS_BY_ROLE: Record<TourRole, TourStep[]> = {
  employee: employeeSteps,
  admin: adminSteps,
  guard: guardSteps,
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function getTooltipPlacement(step: TourStep, rect: TargetRect | null): TourPlacement {
  if (step.placement) return step.placement
  if (!rect) return 'center'
  return rect.top > window.innerHeight * 0.52 ? 'top' : 'bottom'
}

function getTooltipStyle(rect: TargetRect | null, placement: TourPlacement): CSSProperties {
  if (!rect || placement === 'center') {
    return {
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
    }
  }

  const maxLeft = window.innerWidth - CARD_WIDTH - VIEWPORT_GAP
  const centerLeft = rect.left + rect.width / 2 - CARD_WIDTH / 2
  const left = clamp(centerLeft, VIEWPORT_GAP, Math.max(VIEWPORT_GAP, maxLeft))
  const sideTop = clamp(rect.top + rect.height / 2 - 140, VIEWPORT_GAP, Math.max(VIEWPORT_GAP, window.innerHeight - 300))

  if (placement === 'top') {
    return {
      left,
      top: Math.max(VIEWPORT_GAP, rect.top - 18),
      transform: 'translateY(-100%)',
    }
  }

  if (placement === 'left') {
    return {
      left: Math.max(VIEWPORT_GAP, rect.left - 18),
      top: sideTop,
      transform: 'translateX(-100%)',
    }
  }

  if (placement === 'right') {
    return {
      left: Math.min(window.innerWidth - CARD_WIDTH - VIEWPORT_GAP, rect.left + rect.width + 18),
      top: sideTop,
    }
  }

  return {
    left,
    top: Math.min(window.innerHeight - 260, rect.top + rect.height + 18),
  }
}

function getHighlightStyle(rect: TargetRect | null): CSSProperties | undefined {
  if (!rect) return undefined
  const pad = 9
  return {
    left: rect.left - pad,
    top: rect.top - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  }
}

function getScrimStyles(rect: TargetRect | null): CSSProperties[] {
  if (!rect) {
    return [{
      left: 0,
      top: 0,
      width: '100%',
      height: '100%',
    }]
  }

  const pad = 12
  const left = clamp(rect.left - pad, 0, window.innerWidth)
  const top = clamp(rect.top - pad, 0, window.innerHeight)
  const right = clamp(rect.left + rect.width + pad, 0, window.innerWidth)
  const bottom = clamp(rect.top + rect.height + pad, 0, window.innerHeight)
  const height = Math.max(0, bottom - top)

  return [
    {
      left: 0,
      top: 0,
      width: '100%',
      height: top,
    },
    {
      left: 0,
      top: bottom,
      width: '100%',
      height: Math.max(0, window.innerHeight - bottom),
    },
    {
      left: 0,
      top,
      width: left,
      height,
    },
    {
      left: right,
      top,
      width: Math.max(0, window.innerWidth - right),
      height,
    },
  ]
}

export function OnboardingTour({ role, userId, restartKey }: OnboardingTourProps): JSX.Element | null {
  const navigate = useNavigate()
  const location = useLocation()
  const tourRole = getTourRole(role)
  const userKey = getUserKey(userId)
  const steps = useMemo(() => STEPS_BY_ROLE[tourRole], [tourRole])
  const storageKey = `${STORAGE_PREFIX}:${tourRole}:${userKey}`
  const resumedTour = useMemo(() => {
    const activeTour = readActiveTour()
    if (!activeTour || activeTour.role !== tourRole || activeTour.userKey !== userKey) return null
    return clamp(activeTour.stepIndex, 0, Math.max(0, steps.length - 1))
  }, [steps.length, tourRole, userKey])
  const [active, setActive] = useState(() => resumedTour !== null)
  const [stepIndex, setStepIndex] = useState(() => resumedTour ?? 0)
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null)
  const targetRef = useRef<HTMLElement | null>(null)
  const autoStartedRef = useRef(false)

  const currentStep = steps[stepIndex]
  const progress = steps.length > 0 ? ((stepIndex + 1) / steps.length) * 100 : 0

  const finishTour = useCallback(() => {
    try {
      window.localStorage.setItem(storageKey, 'done')
    } catch {
      // Non-critical; the guide can safely reappear if storage is unavailable.
    }
    targetRef.current?.removeAttribute('data-tour-active-target')
    targetRef.current = null
    setSidebarTourState(false)
    clearActiveTour()
    setActive(false)
  }, [storageKey])

  const startTour = useCallback(() => {
    writeActiveTour({ role: tourRole, userKey, stepIndex: 0 })
    setStepIndex(0)
    setActive(true)
  }, [tourRole, userKey])

  useEffect(() => {
    if (restartKey <= 0) return
    startTour()
  }, [restartKey, startTour])

  useEffect(() => {
    if (autoStartedRef.current || steps.length === 0) return
    autoStartedRef.current = true

    const activeTour = readActiveTour()
    if (activeTour && activeTour.role === tourRole && activeTour.userKey === userKey) {
      setStepIndex(clamp(activeTour.stepIndex, 0, steps.length - 1))
      setActive(true)
      return
    }

    if (restartKey > 0) return

    let seen = false
    try {
      const seenValue = window.localStorage.getItem(storageKey)
      seen = seenValue === 'done' || seenValue === '1'
    } catch {
      seen = false
    }

    if (seen) return
    const id = window.setTimeout(() => startTour(), 650)
    return () => window.clearTimeout(id)
  }, [restartKey, startTour, steps.length, storageKey, tourRole, userKey])

  useEffect(() => {
    if (!active || !currentStep) return
    writeActiveTour({ role: tourRole, userKey, stepIndex })
  }, [active, currentStep, stepIndex, tourRole, userKey])

  useEffect(() => {
    if (!active || !currentStep) return
    if (location.pathname !== currentStep.route) {
      navigate(currentStep.route)
    }
  }, [active, currentStep, location.pathname, navigate])

  const updateTargetRect = useCallback(() => {
    const target = targetRef.current
    if (!target) {
      setTargetRect(null)
      return
    }

    const rect = target.getBoundingClientRect()
    setTargetRect({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    })
  }, [])

  useEffect(() => {
    if (!active || !currentStep) return

    let cancelled = false
    let attempts = 0
    const needsSidebar = shouldOpenSidebar(currentStep)
    setSidebarTourState(needsSidebar)
    targetRef.current?.removeAttribute('data-tour-active-target')
    targetRef.current = null

    function locateTarget() {
      if (cancelled) return

      const element = currentStep.selector
        ? document.querySelector<HTMLElement>(currentStep.selector)
        : null

      if (element) {
        targetRef.current = element
        element.setAttribute('data-tour-active-target', 'true')
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
        window.requestAnimationFrame(() => {
          updateTargetRect()
          window.setTimeout(updateTargetRect, needsSidebar ? 300 : 180)
          window.setTimeout(updateTargetRect, needsSidebar ? 480 : 320)
        })
        return
      }

      attempts += 1
      if (attempts < 24) {
        window.setTimeout(locateTarget, 120)
        return
      }

      setTargetRect(null)
    }

    const id = window.setTimeout(locateTarget, location.pathname === currentStep.route ? 80 : 260)

    return () => {
      cancelled = true
      window.clearTimeout(id)
      targetRef.current?.removeAttribute('data-tour-active-target')
      targetRef.current = null
      setSidebarTourState(false)
    }
  }, [active, currentStep, location.pathname, updateTargetRect])

  useEffect(() => {
    if (!active) return
    window.addEventListener('resize', updateTargetRect)
    window.addEventListener('scroll', updateTargetRect, true)
    return () => {
      window.removeEventListener('resize', updateTargetRect)
      window.removeEventListener('scroll', updateTargetRect, true)
    }
  }, [active, updateTargetRect])

  useEffect(() => {
    if (!active) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') finishTour()
      if (event.key === 'ArrowRight') {
        setStepIndex((index) => {
          const next = index >= steps.length - 1 ? index : index + 1
          writeActiveTour({ role: tourRole, userKey, stepIndex: next })
          return next
        })
      }
      if (event.key === 'ArrowLeft') {
        setStepIndex((index) => {
          const next = Math.max(0, index - 1)
          writeActiveTour({ role: tourRole, userKey, stepIndex: next })
          return next
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [active, finishTour, steps.length, tourRole, userKey])

  if (!active || !currentStep) return null

  const placement = getTooltipPlacement(currentStep, targetRect)
  const tooltipStyle = getTooltipStyle(targetRect, placement)
  const highlightStyle = getHighlightStyle(targetRect)
  const scrimStyles = getScrimStyles(targetRect)
  const isLastStep = stepIndex === steps.length - 1

  return (
    <div className={styles.root} aria-live="polite">
      {scrimStyles.map((style, index) => (
        <div
          // The pieces intentionally leave the active element uncovered.
          key={`${currentStep.id}-scrim-${index}`}
          className={`${styles.scrim} ${targetRect ? styles.scrimPiece : styles.scrimFull}`}
          style={style}
        />
      ))}
      <div className={styles.ambientOne} aria-hidden="true" />
      <div className={styles.ambientTwo} aria-hidden="true" />

      {highlightStyle && (
        <div className={styles.highlight} style={highlightStyle}>
          <span className={styles.highlightPulse} aria-hidden="true" />
          <span className={styles.highlightScan} aria-hidden="true" />
        </div>
      )}

      <section
        className={`${styles.card} ${styles[`placement_${placement}`]}`}
        style={tooltipStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        <div className={styles.cardGlow} aria-hidden="true" />
        <div className={styles.cardTop}>
          <span className={styles.spark} aria-hidden="true">✨</span>
          <span className={styles.eyebrow}>{currentStep.eyebrow}</span>
          <span className={styles.counter}>{stepIndex + 1}/{steps.length}</span>
        </div>

        <h3 id="onboarding-title">{currentStep.title}</h3>
        <p>{currentStep.body}</p>

        <div className={styles.progressTrack} aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>

        <div className={styles.dots} aria-label={`Paso ${stepIndex + 1} de ${steps.length}`}>
          {steps.map((step, index) => (
            <span
              key={step.id}
              className={index === stepIndex ? styles.dotActive : ''}
            />
          ))}
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.skipBtn} onClick={finishTour}>
            Saltar
          </button>
          <div>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => setStepIndex((index) => {
                const next = Math.max(0, index - 1)
                writeActiveTour({ role: tourRole, userKey, stepIndex: next })
                return next
              })}
              disabled={stepIndex === 0}
            >
              Atrás
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => {
                if (isLastStep) finishTour()
                else setStepIndex((index) => {
                  const next = index + 1
                  writeActiveTour({ role: tourRole, userKey, stepIndex: next })
                  return next
                })
              }}
            >
              {isLastStep ? 'Finalizar' : 'Siguiente'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
