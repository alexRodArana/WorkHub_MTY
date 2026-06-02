import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { clearSession, getSession } from '../../services/tokenStore'
import { isAdminRole, isGuardRole } from '../../utils/roleRouting'
import { applyTheme, getInitialTheme, type ThemeMode } from '../../utils/theme'
import { AiAssistantWidget } from '../AiAssistant/AiAssistantWidget'
import { OnboardingTour } from '../OnboardingTour/OnboardingTour'
import styles from './AppShell.module.css'
import accGtDimensional from '../../assets/Acc_GT_Dimensional_RGB.png'

type AppShellProps = {
  title: string
  subtitle?: string
  children: ReactNode
  action?: ReactNode
  noscroll?: boolean
}

const baseNavItems = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    tourId: 'nav-dashboard',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    to: '/nueva-reserva',
    label: 'Nueva Reserva',
    tourId: 'nav-new-reservation',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
        <line x1="12" y1="14" x2="12" y2="18"/>
        <line x1="10" y1="16" x2="14" y2="16"/>
      </svg>
    ),
  },
  {
    to: '/mis-reservas',
    label: 'Mis Reservas',
    tourId: 'nav-my-reservations',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6"/>
        <line x1="8" y1="12" x2="21" y2="12"/>
        <line x1="8" y1="18" x2="21" y2="18"/>
        <line x1="3" y1="6" x2="3.01" y2="6"/>
        <line x1="3" y1="12" x2="3.01" y2="12"/>
        <line x1="3" y1="18" x2="3.01" y2="18"/>
      </svg>
    ),
  },
  {
    to: '/logros',
    label: 'Logros',
    tourId: 'nav-badges',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="6"/>
        <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
      </svg>
    ),
  },
  {
    to: '/perfil',
    label: 'Perfil',
    tourId: 'nav-profile',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21a8 8 0 10-16 0"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
]

const adminDashboardNavItem = {
  to: '/admin',
  label: 'Dashboard',
  tourId: 'nav-admin-dashboard',
  icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18"/>
      <path d="M7 14l3-3 3 2 5-6"/>
      <path d="M18 7h-4"/>
      <path d="M18 7v4"/>
    </svg>
  ),
}

const adminManagementNavItem = {
  to: '/admin/gestion',
  label: 'Gestión',
  tourId: 'nav-admin-management',
  icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8l9-5 9 5-9 5-9-5Z" />
      <path d="M3 16l9 5 9-5" />
      <path d="M3 12l9 5 9-5" />
    </svg>
  ),
}

const adminBlocksNavItem = {
  to: '/admin/bloqueos',
  label: 'Bloqueos',
  tourId: 'nav-admin-blocks',
  icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 8h10" />
      <path d="M7 12h6" />
      <path d="m15 16 2 2 4-4" />
    </svg>
  ),
}

const guardNavItem = {
  to: '/guardia',
  label: 'Guardia',
  tourId: 'nav-guard',
  icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <path d="M9 12l2 2 4-4"/>
    </svg>
  ),
}

export default function AppShell({ title, subtitle, children, action, noscroll }: AppShellProps): JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()
  const session = getSession()
  const role = session?.user.role.toLowerCase() ?? ''
  const userId = session?.user.id ?? null
  const isGuard = isGuardRole(role)
  const isAdmin = isAdminRole(role)
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme())
  const [tourRestartKey, setTourRestartKey] = useState(0)
  const navItems = isGuard
    ? [guardNavItem]
    : isAdmin
      ? [adminDashboardNavItem, adminManagementNavItem, adminBlocksNavItem]
      : baseNavItems

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  function handleLogout() {
    clearSession()
    navigate('/login', { replace: true })
  }

  function toggleTheme() {
    setTheme((current) => current === 'dark' ? 'light' : 'dark')
  }

  return (
    <div className={styles.pageShell}>
      <div className={`${styles.frame} ${noscroll ? styles.frameNoscroll : ''}`}>

        <div className={styles.sidebarZone}>
          <aside className={styles.sidebar}>

            <div className={styles.brand} data-tour="brand">
              <div className={styles.brandIconArea}>
                <div className={styles.brandMark}>
                  <img src={accGtDimensional} alt="" className={styles.brandMarkImg} />
                </div>
              </div>
              <div className={styles.brandText}>
                <h1 className={styles.brandTitle}>Lumina</h1>
                <p className={styles.brandSubtitle}>Accenture Workspace</p>
              </div>
            </div>

            <nav className={styles.nav} data-tour="main-navigation">
              {navItems.map((item) => {
                const isActive = location.pathname === item.to
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    data-tour={item.tourId}
                    className={`${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
                  >
                    <span className={styles.navIconWrap}>{item.icon}</span>
                    <span className={styles.navLabel}>{item.label}</span>
                  </Link>
                )
              })}
            </nav>

            <div className={styles.sidebarFooter}>
              <button
                type="button"
                className={styles.logoutButton}
                onClick={handleLogout}
                aria-label="Cerrar sesión"
              >
                <span className={styles.logoutIconWrap}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                </span>
                <span className={styles.logoutLabel}>Cerrar sesión</span>
              </button>
            </div>

          </aside>
        </div>

        <main className={styles.main}>
          <header className={styles.topbar} data-tour="page-header">
            <div className={styles.topbarCopy}>
              <h2 className={styles.pageTitle}>{title}</h2>
              {subtitle ? <p className={styles.pageSubtitle}>{subtitle}</p> : null}
            </div>
            <div className={styles.topbarActions}>
              {action ? <div className={styles.actionSlot}>{action}</div> : null}
              {!isGuard ? (
                <div data-tour="ai-assistant">
                  <AiAssistantWidget />
                </div>
              ) : null}
              <button
                type="button"
                className={styles.guideButton}
                onClick={() => setTourRestartKey((value) => value + 1)}
                aria-label="Abrir guía de uso"
                title="Guía de uso"
                data-tour="guide-button"
              >
                <span aria-hidden="true">?</span>
                <b>Guía</b>
              </button>
              <button
                type="button"
                className={styles.themeToggle}
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
                title={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
                data-tour="theme-toggle"
              >
                {theme === 'dark' ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2" />
                    <path d="M12 20v2" />
                    <path d="m4.93 4.93 1.41 1.41" />
                    <path d="m17.66 17.66 1.41 1.41" />
                    <path d="M2 12h2" />
                    <path d="M20 12h2" />
                    <path d="m6.34 17.66-1.41 1.41" />
                    <path d="m19.07 4.93-1.41 1.41" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 3a6 6 0 0 0 9 7.2A9 9 0 1 1 12 3Z" />
                  </svg>
                )}
              </button>
            </div>
          </header>

          <section
            key={location.pathname}
            className={`${styles.content} ${noscroll ? styles.contentNoscroll : ''}`}
          >
            {children}
          </section>
        </main>

        <OnboardingTour role={role} userId={userId} restartKey={tourRestartKey} />

      </div>
    </div>
  )
}
