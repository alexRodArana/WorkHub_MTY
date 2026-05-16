# WorkHub MTY

Sistema web para gestionar reservas de espacios de oficina y estacionamiento en WorkHub MTY. La aplicación permite consultar disponibilidad por fecha, horario, piso y zona; reservar escritorios o salas; solicitar estacionamiento como parte de una reserva de espacio; hacer check-in; visualizar ocupación real sobre planos; recibir recomendaciones inteligentes; administrar bloqueos operativos; y consultar accesos de estacionamiento desde una vista exclusiva para guardia.

Repositorio: `https://github.com/alexRodArana/WorkHub_MTY`

## Contenido

- `luminaBack-main`: API REST con Node.js, Express, TypeScript, PostgreSQL/Supabase y Vitest.
- `luminaFront-main`: SPA con React, Vite, TypeScript, CSS Modules y Vitest Testing Library.
- `README.md`: documentación raíz del proyecto.

## Funcionalidades Principales

- Autenticación JWT con roles.
- Reservas de espacios por fecha, horario, piso y categoría.
- Estacionamiento ligado obligatoriamente a una reserva de escritorio o sala.
- Mapa interactivo por piso con disponibilidad, ocupación y fotos de las personas que reservaron.
- Popup contextual al hacer hover sobre un espacio con nombre, piso, ocupante, foto y horario ocupado.
- Modal de ocupación por espacio con horarios, estado y perfil del ocupante.
- Perfil de usuario con foto cargada desde computadora o móvil.
- Predicción inteligente de ocupación con IA real usando Gemini API.
- Recomendaciones con IA resaltadas directamente en el mapa con brillo visual y explicación breve al hacer hover.
- Chatbot con IA para recomendaciones, estado de reservas e insights operativos.
- Recomendaciones distribuidas entre pisos cuando el usuario no filtra un piso específico.
- Vista administrador separada en Dashboard de KPIs y Gestión de bloqueos por espacio/sala con mapa, fecha y horario.
- Vista guardia exclusiva para revisar estacionamientos reservados del día.
- Monitoreo en tiempo real por Server-Sent Events para reflejar reservas, cancelaciones, check-ins y bloqueos sin refrescar la página.
- Mensajes de error y confirmación con cierre automático y animación.
- Diseño responsivo para desktop y móvil con transiciones y microanimaciones.

## Roles

- `employee`: usuario estándar. Puede reservar espacios, solicitar estacionamiento con su reserva, hacer check-in y gestionar su perfil.
- `admin` o `administrador`: acceso únicamente a Dashboard y Gestión. Puede revisar KPIs y bloquear/liberar espacios o salas por fecha y horario.
- `guard` o `guardia`: acceso exclusivo a la vista de estacionamientos reservados.

La migración `migrate_hu17_remove_friends_parking_only_admin_ai.ts` crea el rol `guardia` si no existe. La migración `migrate_hu19_space_blocks_and_spaces.ts` crea los bloqueos por espacio y verifica que los espacios esperados estén cargados.

El rol `guard`/`guardia` no tiene acceso a dashboard, nueva reserva, mis reservas, logros, perfil ni administración. Si intenta abrir otra ruta autenticada, el frontend lo redirige automáticamente a `/guardia`.

## Requisitos

- Node.js 20 o superior.
- npm.
- PostgreSQL accesible mediante `DATABASE_URL`.
- Variables de entorno del backend.

## Variables de Entorno

Crear `luminaBack-main/.env`:

```env
JWT_SECRET=<secret-seguro>
JWT_ALGORITHM=HS256
JWT_EXPIRES_IN=3600

PORT=3000
NODE_ENV=development

DATABASE_URL=postgresql://<usuario>:<password>@<host>:<puerto>/<db>

# Opcionales
ALLOWED_ORIGINS=http://localhost:5173
TRUST_PROXY=1
RESERVATION_TIMEZONE=America/Monterrey
CHECK_IN_ALLOWED_CIDRS=10.0.0.0/8,192.168.0.0/16
# CHECK_IN_WINDOW_OVERRIDE_MINUTES=30

# IA real para recomendaciones y chatbot
AI_PROVIDER=gemini
GEMINI_API_KEY=<gemini-api-key>
GEMINI_MODEL=gemini-2.5-flash-lite
GEMINI_FALLBACK_MODELS=gemini-2.5-flash,gemini-2.0-flash-lite
# GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
```

Crear `luminaFront-main/.env` solo si la API no corre en `http://localhost:3000`:

```env
VITE_API_URL=http://localhost:3000
```

## Instalación

```bash
cd luminaBack-main
npm install

cd ../luminaFront-main
npm install
```

## Datos Demo

Desde `luminaBack-main` existen scripts auxiliares para poblar datos de prueba:

```bash
npx ts-node seed_demo_users_and_reservations.ts
node seed_guard_user.js
```

Úsalos solo contra una base de desarrollo o QA. No ejecutes seeds de prueba en producción sin revisar el contenido.

## Migraciones

Ejecutar desde `luminaBack-main`.

```bash
npx ts-node migrate_hu17_remove_friends_parking_only_admin_ai.ts
npx ts-node migrate_hu18_realtime_ai_indexes.ts
npx ts-node migrate_hu19_space_blocks_and_spaces.ts
```

Esta migración es destructiva por diseño porque aplica los cambios solicitados:

- Elimina la tabla `friendships`.
- Borra reservas sin `space_id`.
- Hace `reservations.space_id` obligatorio.
- Crea `area_blocks`.
- Crea el rol `guardia` si falta.
- Mantiene estacionamiento como complemento de una reserva de espacio, no como reserva independiente.

La migración HU18 agrega índices para consultas de disponibilidad, monitoreo en tiempo real e IA.

La migración HU19 agrega:

- Tabla `space_blocks` para bloqueos por espacio, fecha y horario.
- Índices para detectar traslapes de bloqueos.
- Validación idempotente de espacios esperados por piso: Planta Baja 74, Mezzanine 117, Piso 3 36 y Piso 9 74.
- Actualización de `floors.total_spaces` con los conteos reales.

Recomendación: aplicarlas primero en una base de prueba antes de producción.

## Ejecución Local

Backend:

```bash
cd luminaBack-main
npm run dev
```

Frontend:

```bash
cd luminaFront-main
npm run dev
```

URLs por defecto:

- API: `http://localhost:3000`
- Frontend: `http://localhost:5173`

## Pruebas

Backend:

```bash
cd luminaBack-main
npm test
```

Frontend:

```bash
cd luminaFront-main
npm test
```

Build:

```bash
cd luminaBack-main
npm run build

cd ../luminaFront-main
npm run build
```

Cobertura funcional incluida:

- Servicio de reservas: creación con/sin estacionamiento, rechazo sin escritorio, recomendaciones inteligentes.
- Controladores de reservas: creación, errores, ocupación con perfil, recomendaciones.
- Admin/guardia: bloqueo por espacio, KPIs y consulta de estacionamientos.
- Admin/gestión: bloqueo temporal por espacio y liberación de bloqueos.
- Perfil: lectura y actualización de foto.
- Frontend services: disponibilidad, ocupación, recomendaciones, admin, guardia y perfil.
- Restricción de rutas por rol para guardia.
- Integración UI: recomendación inteligente y reserva de escritorio con estacionamiento.

Última validación local:

- Backend: `npm test` con 17 pruebas y `npm run build`.
- Frontend: `npm run lint`, `npm test` con 15 pruebas y `npm run build`.

## Arquitectura

### Backend

- `src/index.ts`: configuración de Express, CORS, JSON body limit y rutas.
- `src/auth`: login, JWT, perfil y repositorios de usuario/roles.
- `src/reservations`: reservas, pisos, estacionamiento, gamificación, recomendaciones, admin y guardia.
- `src/shared`: autenticación y contrato común de base de datos.

### Frontend

- `src/components`: pantallas y componentes visuales.
- `src/services`: clientes HTTP.
- `src/types`: contratos compartidos del frontend.
- `src/utils`: validación y helpers.
- `src/data`: etiquetas y layouts base.

## API Principal

Autenticación:

- `POST /auth/login`
- `GET /auth/profile`
- `PATCH /auth/profile`

Reservas:

- `GET /reservations/availability`
- `GET /reservations/occupancy`
- `GET /reservations/recommendations`
- `POST /reservations/assistant`
- `GET /reservations/events`
- `POST /reservations`
- `GET /reservations/my`
- `POST /reservations/:id/check-in`
- `DELETE /reservations/:id`

Pisos:

- `GET /reservations/floors`
- `GET /reservations/floors/:id/spaces`

Admin:

- `GET /reservations/admin/overview`
- `POST /reservations/admin/space-blocks`
- `DELETE /reservations/admin/space-blocks/:id`
- `POST /reservations/admin/area-blocks`
- `DELETE /reservations/admin/area-blocks/:id`

Guardia:

- `GET /reservations/guard/parking`

## Reglas de Negocio

- Toda reserva requiere escritorio, sala o espacio reservable.
- El estacionamiento solo se solicita dentro de una reserva de espacio.
- El estacionamiento requiere al menos 24 horas de anticipación.
- Un usuario no puede tener reservas de oficina traslapadas.
- Un usuario no puede tener estacionamientos traslapados.
- Un espacio bloqueado por admin para una fecha y horario no aparece disponible ni puede reservarse durante ese rango.
- El check-in respeta ventana de anticipación y red permitida si se configura.
- Las reservas vencidas sin check-in se expiran automáticamente como `no_show`.

## Predicciones y Recomendaciones

El motor inteligente usa dos capas. Primero prepara señales locales auditables con los datos existentes del sistema. Después envía candidatos y contexto a Gemini para que el modelo elija y ordene recomendaciones reales.

Proveedor recomendado para desarrollo:

- `AI_PROVIDER=gemini`
- `GEMINI_MODEL=gemini-2.5-flash-lite`
- `GEMINI_FALLBACK_MODELS=gemini-2.5-flash,gemini-2.0-flash-lite`

Gemini puede usarse con el tier gratuito de Google AI Studio mientras no se habilite facturación y se respeten los límites del servicio. En producción conviene revisar límites, privacidad y billing del proveedor antes de exponerlo a usuarios finales.
Si el modelo principal responde con saturación temporal o rate limit, el backend intenta automáticamente los modelos de fallback configurados.

Señales usadas:

- Ocupación histórica por día de semana, horario, piso y categoría.
- Reservas actuales del mismo horario.
- Usuarios con los que el usuario autenticado ha coincidido frecuentemente.
- Coordenadas del layout para priorizar espacios cercanos.
- Preferencias recientes del usuario por espacio, piso y categoría.
- Presión histórica de demanda por asiento.

La respuesta incluye:

- `predicted_occupancy`: porcentaje estimado.
- `prediction_label`: `baja`, `media` o `alta`.
- `model`: nombre, versión, confianza y factores usados.
- `recommendations`: espacios ordenados por score, confianza, señales, explicación breve y persona cercana si aplica.

En el frontend, las recomendaciones se muestran como brillo sobre el mapa. Si no hay filtro de piso, el backend reparte las recomendaciones entre pisos para evitar que todas queden concentradas en el primer piso. Al hacer hover sobre un espacio recomendado se muestra una razón corta, por ejemplo cercanía con una persona frecuente o afinidad con el historial del usuario.

El chatbot usa el mismo proveedor de IA y responde solo con el contexto autorizado del usuario autenticado. Si el usuario es administrador, puede incluir KPIs operativos; si es empleado, limita la respuesta a sus reservas y recomendaciones.

## Monitoreo en Tiempo Real

La API expone `GET /reservations/events` como un canal SSE autenticado. El frontend mantiene una conexión `EventSource` mientras la sesión está activa y escucha eventos de:

- `reservation.created`
- `reservation.cancelled`
- `reservation.checked_in`
- `area_block.created`
- `area_block.deleted`
- `space_block.created`
- `space_block.deleted`

Cada evento incluye `id`, `type`, `timestamp` y, cuando aplica, fecha de reserva, espacio, piso, usuario actor y si afecta estacionamiento.

Vistas que se resincronizan sin refrescar:

- `/nueva-reserva`: disponibilidad, ocupación del mapa y recomendaciones.
- `/dashboard`: reserva del día, próximas reservas, historial corto y métricas de logros.
- `/mis-reservas`: lista activa o historial según la pestaña abierta.
- `/admin`: KPIs, gráficas y ocupación.
- `/admin/gestion`: mapa de gestión y bloqueos por espacio.
- `/guardia`: reservas de estacionamiento del día.

## Vista Administrador

El administrador solo ve dos pestañas: Dashboard y Gestión.

La vista `/admin` muestra:

- Reservas totales del día.
- Reservas confirmadas, activas, canceladas y no show.
- Uso de estacionamiento.
- Usuarios únicos.
- Ocupación general.
- Medidores visuales de ocupación y estacionamiento.
- Distribución de reservas por estado.
- Demanda por hora.
- Usuarios con más actividad.
- Ocupación por piso.
- Ocupación por categoría.
- Bloqueos activos por espacio y por área.

La vista `/admin/gestion` muestra un mapa como el de reservas, sin recomendaciones de IA. Al seleccionar un escritorio o sala, el administrador puede bloquear ese lugar para una fecha y horario específicos, confirmar la acción y liberar bloqueos existentes.

## Vista Guardia

La vista `/guardia` muestra reservas de estacionamiento por fecha:

- Persona.
- Foto o iniciales.
- Lugar asignado.
- Horario.
- Código de reserva.
- Espacio de oficina asociado.

La ruta y el endpoint requieren rol `guard` o `guardia`; el usuario administrador no ve esta pestaña por defecto.

Además, el usuario guardia solo ve la pestaña Guardia en la navegación.

## Fotos de Perfil

Las fotos se guardan como data URL en `users.profile_photo_url`.

Restricciones:

- PNG, JPG/JPEG o WEBP.
- Tamaño máximo validado por backend: 750 KB.
- El frontend recorta y comprime a avatar cuadrado antes de enviar.

## Rendimiento

Mejoras incluidas:

- Consultas independientes en paralelo con `Promise.all`.
- Recomendaciones y disponibilidad consultadas en paralelo desde UI.
- Agrupación de ocupación por espacio en backend para reducir trabajo del cliente.
- Refresco selectivo por eventos realtime en lugar de recargar la aplicación completa.
- Eliminación de llamadas sociales innecesarias.
- Memos en mapa para lookups por espacio.
- Asignación de estacionamiento transaccional con `FOR UPDATE SKIP LOCKED`.
- Build de producción con Vite y TypeScript.

## Operación

Para validar una instalación:

1. Aplicar migración en base de prueba.
2. Ejecutar backend.
3. Ejecutar frontend.
4. Iniciar sesión con un usuario activo.
5. Probar `/nueva-reserva`.
6. Probar `/admin` con usuario admin.
7. Probar `/guardia` con usuario guardia.
8. Correr pruebas y builds.

## Troubleshooting

- `UNAUTHORIZED`: token expirado o no enviado.
- `FORBIDDEN`: usuario sin rol requerido.
- `PARKING_TOO_LATE`: estacionamiento solicitado con menos de 24 horas.
- `PARKING_CONFLICT`: el usuario ya tiene estacionamiento traslapado.
- `SPACE_UNAVAILABLE`: el espacio fue reservado o bloqueado.
- `AI_NOT_CONFIGURED`: falta configurar `AI_PROVIDER` y la API key correspondiente.
- `AI_PROVIDER_ERROR`: el proveedor de IA no respondió, rechazó el modelo o devolvió una respuesta inválida.
- `DATABASE_ERROR`: revisar `DATABASE_URL`, migraciones y conectividad.

## Estado de Calidad

Comandos verificados durante el desarrollo:

- `luminaBack-main`: `npm test` con 16 pruebas, `npm run build`.
- `luminaFront-main`: `npm run lint`, `npm test` con 14 pruebas, `npm run build`.

## Seguridad

- No subas archivos `.env` ni tokens personales al repositorio.
- Rota cualquier token que haya sido pegado en chats, terminales compartidas o logs.
- Usa una base de datos separada para desarrollo, pruebas y producción.
- Revisa las migraciones destructivas antes de ejecutarlas contra datos reales.
