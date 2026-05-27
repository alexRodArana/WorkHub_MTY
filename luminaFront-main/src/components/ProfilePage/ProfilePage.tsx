import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../Layout/AppShell'
import { LoadingSpinner } from '../LoadingSpinner/LoadingSpinner'
import { getSession, updateSessionUser } from '../../services/tokenStore'
import { fetchProfile, updateProfilePhoto } from '../../services/profileService'
import { createVehicle, deleteVehicle, fetchMyVehicles, setDefaultVehicle, updateVehicle } from '../../services/reservationService'
import type { UserData } from '../../types/auth'
import type { UserVehicle } from '../../types/reservation'
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
  const [vehicles, setVehicles] = useState<UserVehicle[]>([])
  const [vehicleSavingId, setVehicleSavingId] = useState<number | 'new' | null>(null)
  const [editingVehicleId, setEditingVehicleId] = useState<number | null>(null)
  const [vehicleForm, setVehicleForm] = useState({
    plate: '',
    alias: '',
    make: '',
    model: '',
    color: '',
  })

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
    fetchMyVehicles(token).then((result) => {
      if (result.success) setVehicles(result.data)
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

  function resetVehicleForm(): void {
    setEditingVehicleId(null)
    setVehicleForm({ plate: '', alias: '', make: '', model: '', color: '' })
  }

  function startEditingVehicle(vehicle: UserVehicle): void {
    setEditingVehicleId(vehicle.id)
    setVehicleForm({
      plate: vehicle.plate,
      alias: vehicle.alias ?? '',
      make: vehicle.make ?? '',
      model: vehicle.model ?? '',
      color: vehicle.color ?? '',
    })
  }

  async function saveVehicle(): Promise<void> {
    const token = getSession()?.access_token
    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    const plate = vehicleForm.plate.trim().toUpperCase()
    if (plate.length < 4) {
      setError('La placa debe tener al menos 4 caracteres.')
      return
    }

    const payload = {
      plate,
      alias: vehicleForm.alias,
      make: vehicleForm.make,
      model: vehicleForm.model,
      color: vehicleForm.color,
      is_default: vehicles.length === 0,
    }
    setVehicleSavingId(editingVehicleId ?? 'new')
    const result = editingVehicleId
      ? await updateVehicle(token, editingVehicleId, payload)
      : await createVehicle(token, payload)
    setVehicleSavingId(null)

    if (!result.success) {
      if (result.unauthorized) navigate('/login', { replace: true })
      else setError(result.error === 'INVALID_VEHICLE' ? 'Revisa la placa. Puede estar duplicada o tener formato inválido.' : 'No se pudo guardar el vehículo.')
      return
    }

    setVehicles((prev) => {
      const without = prev.filter((vehicle) => vehicle.id !== result.data.id)
      const next = [result.data, ...without]
      return next.sort((a, b) => Number(b.is_default) - Number(a.is_default) || b.id - a.id)
    })
    resetVehicleForm()
    setMessage(editingVehicleId ? 'Vehículo actualizado.' : 'Vehículo agregado.')
  }

  async function handleDefaultVehicle(vehicleId: number): Promise<void> {
    const token = getSession()?.access_token
    if (!token) return
    setVehicleSavingId(vehicleId)
    const result = await setDefaultVehicle(token, vehicleId)
    setVehicleSavingId(null)
    if (!result.success) {
      setError('No se pudo marcar como vehículo principal.')
      return
    }
    setVehicles((prev) => prev.map((vehicle) => ({
      ...vehicle,
      is_default: vehicle.id === result.data.id,
    })))
    setMessage('Vehículo principal actualizado.')
  }

  async function handleDeleteVehicle(vehicleId: number): Promise<void> {
    const token = getSession()?.access_token
    if (!token) return
    setVehicleSavingId(vehicleId)
    const result = await deleteVehicle(token, vehicleId)
    setVehicleSavingId(null)
    if (!result.success) {
      setError('No se pudo eliminar. Si tiene reservas activas o futuras, primero cancélalas o espera a que terminen.')
      return
    }
    setVehicles((prev) => prev.filter((vehicle) => vehicle.id !== vehicleId))
    if (editingVehicleId === vehicleId) resetVehicleForm()
    setMessage('Vehículo eliminado.')
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

          <section className={styles.vehicleSection} data-tour="profile-vehicles">
            <div className={styles.sectionHeader}>
              <div>
                <span>Estacionamiento</span>
                <h3>Vehículos registrados</h3>
              </div>
              <small>{vehicles.length} activos</small>
            </div>

            <div className={styles.vehicleGrid}>
              <div className={styles.vehicleForm}>
                <label>
                  <span>Placa</span>
                  <input
                    value={vehicleForm.plate}
                    onChange={(event) => setVehicleForm((prev) => ({ ...prev, plate: event.target.value.toUpperCase() }))}
                    placeholder="ABC-123"
                  />
                </label>
                <label>
                  <span>Alias</span>
                  <input value={vehicleForm.alias} onChange={(event) => setVehicleForm((prev) => ({ ...prev, alias: event.target.value }))} placeholder="Mi carro" />
                </label>
                <label>
                  <span>Marca</span>
                  <input value={vehicleForm.make} onChange={(event) => setVehicleForm((prev) => ({ ...prev, make: event.target.value }))} placeholder="Honda" />
                </label>
                <label>
                  <span>Modelo</span>
                  <input value={vehicleForm.model} onChange={(event) => setVehicleForm((prev) => ({ ...prev, model: event.target.value }))} placeholder="Civic" />
                </label>
                <label>
                  <span>Color</span>
                  <input value={vehicleForm.color} onChange={(event) => setVehicleForm((prev) => ({ ...prev, color: event.target.value }))} placeholder="Gris" />
                </label>
                <div className={styles.vehicleFormActions}>
                  {editingVehicleId && <button type="button" className={styles.ghostBtn} onClick={resetVehicleForm}>Cancelar</button>}
                  <button type="button" className={styles.primaryBtn} onClick={() => void saveVehicle()} disabled={vehicleSavingId !== null}>
                    {vehicleSavingId !== null && (vehicleSavingId === 'new' || vehicleSavingId === editingVehicleId)
                      ? 'Guardando...'
                      : editingVehicleId
                        ? 'Actualizar vehículo'
                        : 'Agregar vehículo'}
                  </button>
                </div>
              </div>

              <div className={styles.vehicleList}>
                {vehicles.length === 0 ? (
                  <p className={styles.vehicleEmpty}>Agrega un vehículo para poder reservar estacionamiento.</p>
                ) : vehicles.map((vehicle) => (
                  <article key={vehicle.id} className={styles.vehicleCard}>
                    <div>
                      <strong>{vehicle.alias || [vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Vehículo'}</strong>
                      <span>{vehicle.plate}{vehicle.color ? ` · ${vehicle.color}` : ''}</span>
                      {(vehicle.make || vehicle.model) && <small>{[vehicle.make, vehicle.model].filter(Boolean).join(' ')}</small>}
                    </div>
                    <div className={styles.vehicleActions}>
                      {vehicle.is_default ? (
                        <span className={styles.defaultChip}>Principal</span>
                      ) : (
                        <button type="button" onClick={() => void handleDefaultVehicle(vehicle.id)} disabled={vehicleSavingId !== null}>Principal</button>
                      )}
                      <button type="button" onClick={() => startEditingVehicle(vehicle)} disabled={vehicleSavingId !== null}>Editar</button>
                      <button type="button" className={styles.dangerBtn} onClick={() => void handleDeleteVehicle(vehicle.id)} disabled={vehicleSavingId !== null}>Eliminar</button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </AppShell>
  )
}
