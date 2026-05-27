import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { validateLoginForm } from '../../utils/validator'
import type { ValidationErrors } from '../../utils/validator'
import * as authService from '../../services/authService'
import { saveSession } from '../../services/tokenStore'
import { getRoleHomePath } from '../../utils/roleRouting'
import { ErrorBanner } from '../ErrorBanner/ErrorBanner'
import styles from './LoginForm.module.css'

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

export function LoginForm(): JSX.Element {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<ValidationErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value)
    setServerError(null)
    if (fieldErrors.email) setFieldErrors((prev) => { const n = { ...prev }; delete n.email; return n })
  }

  function handlePasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPassword(e.target.value)
    setServerError(null)
    if (fieldErrors.password) setFieldErrors((prev) => { const n = { ...prev }; delete n.password; return n })
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const errors = validateLoginForm(email, password)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setFieldErrors({})
    setIsLoading(true)

    try {
      const result = await authService.login({ email, password })

      if (result.success) {
        saveSession(result.data)
        navigate(getRoleHomePath(result.data.user.role), { replace: true })
      } else {
        setServerError(result.errorMessage)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {serverError && <ErrorBanner message={serverError} />}

      <div className={styles.field}>
        <label htmlFor="email" className={styles.label}>
          Correo electrónico
        </label>
        <input
          id="email"
          type="email"
          className={`${styles.input} ${fieldErrors.email ? styles.inputError : ''}`}
          value={email}
          onChange={handleEmailChange}
          aria-describedby={fieldErrors.email ? 'email-error' : undefined}
          disabled={isLoading}
          autoComplete="email"
          placeholder="tu@accenture.com"
        />
        {fieldErrors.email && (
          <span id="email-error" className={styles.fieldError} role="alert">
            {fieldErrors.email}
          </span>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="password" className={styles.label}>
          Contraseña
        </label>
        <div className={styles.passwordWrap}>
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            className={`${styles.input} ${fieldErrors.password ? styles.inputError : ''}`}
            value={password}
            onChange={handlePasswordChange}
            aria-describedby={fieldErrors.password ? 'password-error' : undefined}
            disabled={isLoading}
            autoComplete="current-password"
            placeholder="••••••••"
          />
          <button
            type="button"
            className={styles.eyeBtn}
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            tabIndex={-1}
          >
            <EyeIcon open={showPassword} />
          </button>
        </div>
        {fieldErrors.password && (
          <span id="password-error" className={styles.fieldError} role="alert">
            {fieldErrors.password}
          </span>
        )}
      </div>

      <button type="submit" className={styles.button} disabled={isLoading}>
        {isLoading ? (
          <span className={styles.loadingText}>Entrando...</span>
        ) : (
          <>
            Entrar
            <span className={styles.btnArrow}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </span>
          </>
        )}
      </button>
    </form>
  )
}
