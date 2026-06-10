# Casos de Prueba de Demostracion - WorkHub MTY

Esta matriz concentra los casos funcionales recomendados para demostrar el producto en vivo o como evidencia de QA. Los casos estan agrupados por rol y flujo de negocio.

## Autenticacion y Roles

| ID | Caso | Rol | Datos sugeridos | Resultado esperado |
|---|---|---|---|---|
| AUTH-01 | Login empleado | Empleado | `ana.garcia@lumina.demo` | Redirige a dashboard de empleado |
| AUTH-02 | Login administrador | Admin | `admin.demo@lumina.demo` | Redirige a dashboard admin |
| AUTH-03 | Login guardia | Guardia | `guardia.demo@lumina.demo` | Redirige solo a vista guardia |
| AUTH-04 | Proteccion de rutas admin | Empleado | Entrar manualmente a `/admin` | Redirige al home del rol |
| AUTH-05 | Proteccion de rutas guardia | Guardia | Entrar manualmente a `/dashboard` | Redirige a `/guardia` |

## Reservas de Empleado

| ID | Caso | Rol | Datos sugeridos | Resultado esperado |
|---|---|---|---|---|
| RES-01 | Reserva escritorio + estacionamiento | Empleado | Ana o Lucia, vehiculo default | Reserva creada con espacio y cajon |
| RES-02 | Reserva solo escritorio | Empleado | Lucia para desbloquear badge | Reserva creada sin parking |
| RES-03 | Reserva solo estacionamiento | Empleado | Ana con vehiculo default | Reserva creada sin escritorio |
| RES-04 | Validacion sin vehiculo | Empleado sin vehiculo | Crear usuario sin vehiculo si se requiere | Sistema solicita registrar vehiculo |
| RES-05 | Cambio de piso | Empleado | Planta Baja, Mezzanine, Piso 3, Piso 9 | Mapa cambia sin duplicarse |
| RES-06 | Recomendacion IA | Empleado | Fecha/hora disponible | Solo recomienda escritorios individuales |
| RES-07 | Hover de espacio ocupado | Empleado | Espacio con avatar visible | Popup muestra ocupante, foto y horario |
| RES-08 | Incentivo de martes | Empleado | Fecha martes | Muestra mensaje de tacos |
| RES-09 | Incentivo de jueves | Empleado | Fecha jueves | Muestra mensaje de barista |
| RES-10 | Estacionamiento Central | Empleado | Si el cajon asignado es Central | Muestra flujo para avisar a guardia |

## Mis Reservas, Check-in y Checkout

| ID | Caso | Rol | Datos sugeridos | Resultado esperado |
|---|---|---|---|---|
| MY-01 | Ver reservas activas | Empleado | Ana | Lista reservas activas |
| MY-02 | Ver historial | Empleado | Ana o Lucia | Lista reservas finalizadas/canceladas |
| MY-03 | Identificar tipo de reserva | Empleado | Cualquier empleado demo | Distingue escritorio, parking o combinado |
| MY-04 | Check-in valido | Empleado | Reserva confirmada dentro de ventana | Cambia a activa |
| MY-05 | Checkout inmediato | Empleado | Ana con reserva activa | Libera espacio y parking sin espera |
| MY-06 | Cancelar reserva confirmada | Empleado | Reserva futura confirmada | Cambia a cancelada |

## Perfil y Vehiculos

| ID | Caso | Rol | Datos sugeridos | Resultado esperado |
|---|---|---|---|---|
| PROF-01 | Ver perfil | Empleado | Ana | Datos personales y foto visibles |
| PROF-02 | Cambiar foto | Empleado | Imagen local | Foto se actualiza |
| PROF-03 | Registrar vehiculo | Empleado | Placa demo | Vehiculo aparece en lista |
| PROF-04 | Editar vehiculo | Empleado | Cambiar alias/color | Cambios persistidos |
| PROF-05 | Eliminar vehiculo | Empleado | Vehiculo no default | Vehiculo desaparece |
| PROF-06 | Seleccionar principal | Empleado | Ana o Mateo con 2 vehiculos | Tarjeta cambia de estado visual |

## Logros y Gamificacion

| ID | Caso | Rol | Datos sugeridos | Resultado esperado |
|---|---|---|---|---|
| BADGE-01 | Ver badges desbloqueadas | Empleado | Ana | Badges desbloqueadas con color |
| BADGE-02 | Ver badges bloqueadas | Empleado | Ana | Badges pendientes en gris/opacidad |
| BADGE-03 | Detalle de badge | Empleado | Click en badge | Modal con imagen, titulo, descripcion, fecha y rareza |
| BADGE-04 | Tooltip de porcentaje | Empleado | Hover en porcentaje | Tooltip explica el porcentaje |
| BADGE-05 | Desbloqueo en vivo | Empleado | Lucia crea quinta reserva | Animacion de `Cafecito en la Mano` |

## Administracion

| ID | Caso | Rol | Datos sugeridos | Resultado esperado |
|---|---|---|---|---|
| ADM-01 | Dashboard por dia | Admin | Fecha actual | KPIs del dia |
| ADM-02 | Dashboard por semana | Admin | Semana actual | KPIs agregados |
| ADM-03 | Dashboard por mes | Admin | Mes actual | KPIs agregados |
| ADM-04 | Dashboard por rango | Admin | Rango personalizado | KPIs del rango |
| ADM-05 | Expandir KPI | Admin | Click en tarjeta | Tabla detallada con filtros |
| ADM-06 | Buscar usuario | Admin | `Ana` o `DEMO-101` | Resultados filtrados |
| ADM-07 | Exportar XLSX | Admin | Periodo visible | Archivo formal descargado |
| ADM-08 | Bloquear espacio | Admin | Mapa de gestion | Bloqueo confirmado |
| ADM-09 | Cambiar piso tras seleccionar | Admin | Seleccionar y cambiar piso | Seleccion se limpia |
| ADM-10 | Liberar bloqueo | Admin | Pestaña Bloqueos | Espacio vuelve a estar disponible |
| ADM-11 | Evitar bloqueo ocupado | Admin | Espacio ocupado | Sistema impide bloqueo conflictivo |

## Guardia

| ID | Caso | Rol | Datos sugeridos | Resultado esperado |
|---|---|---|---|---|
| GUA-01 | Ver estacionamientos del dia | Guardia | Guardia Demo | Tabla de reservas del dia |
| GUA-02 | Buscar por usuario | Guardia | `Ana` | Filtra resultados |
| GUA-03 | Buscar por placa | Guardia | `NL-AG-218` | Encuentra vehiculo |
| GUA-04 | Buscar por zona/cajon | Guardia | `T1`, `T2`, `Central` | Filtra estacionamientos |
| GUA-05 | Restriccion de rol | Guardia | Intentar `/admin` | Acceso denegado/redirigido |

## IA y Tiempo Real

| ID | Caso | Rol | Datos sugeridos | Resultado esperado |
|---|---|---|---|---|
| AI-01 | Chatbot empleado | Empleado | `Que reservas tengo hoy?` | Responde con contexto del empleado |
| AI-02 | Chatbot vehiculos | Empleado | `Que vehiculo tengo registrado?` | Responde con vehiculo real |
| AI-03 | Chatbot badges | Empleado | `Que badges tengo?` | Responde con badges reales |
| AI-04 | Chatbot admin | Admin | `Cual es la ocupacion de hoy?` | Responde con KPIs disponibles |
| AI-05 | Chatbot guardia | Guardia | `Quien tiene estacionamiento hoy?` | Responde solo con contexto guardia |
| RT-01 | Reserva en tiempo real | Dos navegadores | Crear reserva en uno | Mapa se actualiza sin refresh |
| RT-02 | Checkout en tiempo real | Dos navegadores | Checkout de Ana | Mapa libera espacio sin refresh |
| RT-03 | Bloqueo en tiempo real | Admin + empleado | Bloquear espacio | Empleado lo ve bloqueado sin refresh |

## Responsividad y Tema

| ID | Caso | Rol | Datos sugeridos | Resultado esperado |
|---|---|---|---|---|
| UI-01 | Desktop 1440px | Todos | Navegador desktop | Layout completo sin traslapes |
| UI-02 | Laptop 1366px | Todos | Navegador laptop | Controles siguen visibles |
| UI-03 | Movil 390px | Empleado | Nueva reserva | Flujo usable en pantalla pequena |
| UI-04 | Tema oscuro | Todos | Activar dark mode | Fondos y tarjetas con contraste correcto |
| UI-05 | Onboarding manual | Empleado | Click en Guia | Tour abre solo manualmente |

