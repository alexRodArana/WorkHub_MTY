# WorkHub MTY

## Arquitectura

WorkHub MTY es una plataforma web para administrar reservas de espacios de oficina y estacionamiento. El sistema permite que empleados reserven escritorios y cajones, que administradores consulten indicadores y bloqueen espacios, y que guardias revisen los estacionamientos reservados del dia.

El proyecto esta dividido en dos aplicaciones:

- `luminaFront-main`: frontend web desarrollado con React, TypeScript y Vite.
- `luminaBack-main`: API REST desarrollada con Node.js, Express, TypeScript y PostgreSQL.

Flujo general del sistema:

```text
Usuario
  |
  v
Frontend React
  |
  | REST API + Server-Sent Events
  v
Backend Express
  |
  | SQL parametrizado
  v
PostgreSQL / Supabase
  |
  | Contexto autorizado por rol
  v
Gemini API
```

Plataformas y servicios usados:

- Frontend: React 18, TypeScript, Vite, React Router y CSS Modules.
- Backend: Node.js, Express, TypeScript, JWT, bcrypt, CORS y rate limiting.
- Base de datos: PostgreSQL, recomendado con Supabase.
- IA: Google Gemini API para recomendaciones de espacios y chatbot.
- Tiempo real: Server-Sent Events para actualizar ocupacion y reservas sin recargar la pagina.
- Despliegue recomendado: Vercel para frontend, Render para backend y Supabase/PostgreSQL para base de datos.

La autenticacion usa JWT y el acceso se controla por rol. El backend arma el contexto permitido para cada usuario antes de consultar Gemini, por lo que el frontend no expone secretos de IA ni calcula recomendaciones finales.

## Uso del sistema

Objetivo del sistema:

- Centralizar la reserva de escritorios y estacionamiento.
- Mostrar disponibilidad y ocupacion de espacios.
- Permitir check-in y check-out de reservas.
- Apoyar a administradores con reportes, KPIs y bloqueos operativos.
- Apoyar a guardias con la consulta de estacionamientos reservados del dia.

Roles disponibles:

| Rol | Rutas principales | Que puede hacer |
|---|---|---|
| Empleado | `/dashboard`, `/nueva-reserva`, `/mis-reservas`, `/logros`, `/perfil` | Reservar escritorio, reservar estacionamiento, registrar vehiculos, hacer check-in/check-out, ver logros y usar el chatbot. |
| Administrador | `/admin`, `/admin/gestion`, `/admin/bloqueos` | Consultar KPIs, filtrar dashboard, exportar XLSX, buscar usuarios, bloquear espacios y usar el chatbot administrativo. |
| Guardia | `/guardia` | Ver estacionamientos reservados del dia, consultar datos de vehiculo y buscar usuarios con acceso limitado. |

Flujo principal de uso:

1. El usuario inicia sesion.
2. El sistema identifica su rol.
3. El usuario entra a las vistas permitidas.
4. El empleado puede crear reservas, hacer check-in, hacer check-out y administrar vehiculos.
5. El administrador puede revisar indicadores, exportar reportes y gestionar bloqueos.
6. El guardia puede consultar los estacionamientos reservados del dia.

Credenciales demo incluidas por el seed:

| Rol | Correo | Contrasena | Uso recomendado |
|---|---|---|---|
| Empleado principal | `ana.garcia@lumina.demo` | `WorkHubDemo123!` | Dashboard, mapa, checkout, perfil, vehiculos y badges. |
| Empleado para badge en vivo | `lucia.moreno@lumina.demo` | `WorkHubDemo123!` | Crear una quinta reserva para desbloquear una badge durante la demo. |
| Administrador | `admin.demo@lumina.demo` | `WorkHubDemo123!` | KPIs, reportes XLSX, bloqueos y busqueda de usuarios. |
| Guardia | `guardia.demo@lumina.demo` | `WorkHubDemo123!` | Consulta de estacionamientos reservados del dia. |

Para ejecutar el proyecto en local:

```bash
cd luminaBack-main
npm install
npm run dev
```

```bash
cd luminaFront-main
npm install
npm run dev
```

URLs locales:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`

Para preparar la base de datos con migraciones y datos demo:

```bash
cd luminaBack-main
npm run db:setup
```

Variables principales que deben configurarse:

- Backend: `DATABASE_URL`, `JWT_SECRET`, `JWT_ALGORITHM`, `JWT_EXPIRES_IN`, `ALLOWED_ORIGINS`, `GEMINI_API_KEY`, `GEMINI_MODEL`.
- Frontend: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.

Consideraciones importantes:

- No subir archivos `.env` reales al repositorio.
- Verificar que `VITE_API_URL` apunte al backend correcto.
- Verificar que `ALLOWED_ORIGINS` incluya la URL real del frontend.
- Gemini debe estar configurado para probar recomendaciones y chatbot.
- Las credenciales demo son para pruebas y presentacion, no para uso final en produccion.

## Enlaces clave

| Recurso | Enlace o ruta | Notas |
|---|---|---|
| Repositorio | Este repositorio | No se documenta una URL remota en el README actual. |
| Frontend local | `http://localhost:5173` | Disponible al ejecutar `npm run dev` en `luminaFront-main`. |
| Backend local | `http://localhost:3000` | Disponible al ejecutar `npm run dev` en `luminaBack-main`. |
| Backend desplegado | `https://workhub-mty.onrender.com` | Documentado como backend de produccion/fallback. |
| Frontend desplegado | Pendiente | No se documenta una URL final de Vercel. |
| Configuracion Vercel | `luminaFront-main/vercel.json` | Configuracion del frontend para despliegue. |
| Configuracion Render | `render.yaml` | Configuracion del backend para despliegue. |
| Restauracion de base de datos | `database/README.md` | Instrucciones para recrear la base de datos. |
| Guia de demo | `docs/demo/DEMO_PRODUCTO_WORKHUB_MTY.md` | Guia para presentar el producto. |
| Casos de prueba demo | `docs/demo/CASOS_PRUEBA_DEMO_WORKHUB_MTY.md` | Matriz de validacion funcional. |
| Evidencia visual | `docs/demo/screenshots/` | Capturas usadas para validacion y presentacion. |
