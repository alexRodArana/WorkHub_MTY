import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../Layout/AppShell'
import { LoadingSpinner } from '../LoadingSpinner/LoadingSpinner'
import { getSession, updateSessionUser } from '../../services/tokenStore'
import { fetchProfile, updateProfilePhoto } from '../../services/profileService'
import type { UserData } from '../../types/auth'
import styles from './ProfilePage.module.css'

function initials(profile: Pick<UserData, 'first_name' | 'last_name'>): string {
  return `${profile.first_name[0] ?? ''}${profile.last_name[0] ?? ''}`.toUpperCase()
}

async function fileToAvatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('INVALID_TYPE')

  const imageUrl = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('IMAGE_LOAD_FAILED'))
      img.src = imageUrl
    })

    const size = 240
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    if (!context) throw new Error('CANVAS_NOT_SUPPORTED')

    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight)
    const sx = (image.naturalWidth - sourceSize) / 2
    const sy = (image.naturalHeight - sourceSize) / 2
    context.drawImage(image, sx, sy, sourceSize, sourceSize, 0, 0, size, size)
    return canvas.toDataURL('image/jpeg', 0.82)
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}

function persistProfileInSession(profile: UserData): void {
  updateSessionUser(profile)
}

export function ProfilePage(): JSX.Element {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [profile, setProfile] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingPhoto, setSavingPhoto] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = getSession()?.access_token
    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    fetchProfile(token).then((result) => {
      setLoading(false)
      if (!result.success) {
        if (result.unauthorized) navigate('/login', { replace: true })
        else setError('No se pudo cargar tu perfil.')
        return
      }
      setProfile(result.data)
      persistProfileInSession(result.data)
    })
  }, [navigate])

  useEffect(() => {
    if (!error) return
    const timeoutId = window.setTimeout(() => setError(null), 5000)
    return () => window.clearTimeout(timeoutId)
  }, [error])

  useEffect(() => {
    if (!message) return
    const timeoutId = window.setTimeout(() => setMessage(null), 5000)
    return () => window.clearTimeout(timeoutId)
  }, [message])

  async function savePhoto(profilePhotoUrl: string | null): Promise<void> {
    const token = getSession()?.access_token
    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    setSavingPhoto(true)
    setError(null)
    setMessage(null)
    const result = await updateProfilePhoto(token, profilePhotoUrl)
    setSavingPhoto(false)

    if (!result.success) {
      if (result.unauthorized) navigate('/login', { replace: true })
      else setError('No se pudo actualizar la foto.')
      return
    }

    setProfile(result.data)
    persistProfileInSession(result.data)
    setMessage(profilePhotoUrl ? 'Foto de perfil actualizada.' : 'Foto de perfil eliminada.')
  }

  async function handleUploadPhoto(file: File): Promise<void> {
    try {
      await savePhoto(await fileToAvatarDataUrl(file))
    } catch {
      setError('Selecciona una imagen válida desde tu dispositivo.')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <AppShell title="Perfil" subtitle="Administra tu identidad visible en el mapa">
      {loading ? (
        <div className={styles.loadingWrap}><LoadingSpinner /></div>
      ) : profile ? (
        <div className={styles.page}>
          {error && <div className={styles.errorMsg}>{error}</div>}
          {message && <div className={styles.successMsg}>{message}</div>}

          <section className={styles.profileCard} data-tour="profile-card">
            <div className={styles.avatarLg}>
              {profile.profile_photo_url ? (
                <img src={profile.profile_photo_url} alt="" />
              ) : (
                <span>{initials(profile)}</span>
              )}
            </div>
            <div className={styles.profileCopy}>
              <h3>{profile.first_name} {profile.last_name}</h3>
              <p>{profile.email}</p>
              <span>{profile.department || 'Sin departamento'} · {profile.role}</span>
            </div>
            <div className={styles.photoActions} data-tour="profile-photo">
              <input
                ref={fileInputRef}
                className={styles.fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void handleUploadPhoto(file)
                }}
              />
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => fileInputRef.current?.click()}
                disabled={savingPhoto}
              >
                {savingPhoto ? 'Guardando...' : 'Cambiar foto'}
              </button>
              {profile.profile_photo_url && (
                <button type="button" className={styles.ghostBtn} onClick={() => void savePhoto(null)} disabled={savingPhoto}>
                  Quitar foto
                </button>
              )}
            </div>
          </section>

          <section className={styles.infoGrid} data-tour="profile-info">
            <div>
              <span className={styles.infoLabel}>ID empleado</span>
              <strong>{profile.employee_id}</strong>
            </div>
            <div>
              <span className={styles.infoLabel}>Departamento</span>
              <strong>{profile.department || 'Sin departamento'}</strong>
            </div>
            <div>
              <span className={styles.infoLabel}>Rol</span>
              <strong>{profile.role}</strong>
            </div>
          </section>
        </div>
      ) : null}
    </AppShell>
  )
}
