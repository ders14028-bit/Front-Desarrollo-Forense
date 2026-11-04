# Dashboard SOC · Front-Desarrollo-Forense

Proyecto universitario (Escuela Colombiana de Ingeniería). Dashboard que lee TheHive 6
y muestra lo que TheHive no muestra: métricas consolidadas para un gerente.
Todo el texto de la interfaz va en español. Trabajamos paso a paso: haz SOLO lo que pide
el prompt actual, y al terminar resume qué cambió y qué quedó pendiente.

## Arquitectura

```
React (frontend/)  →  Spring Boot (backend/)  →  TheHive API (/api/v1/query)
```

- `frontend/`: React 18 + TypeScript + Vite. CSS propio con variables, sin frameworks de UI.
  Gráficas con CSS/SVG simple (sin librería de gráficos salvo que se pida).
- `backend/`: Spring Boot 3, Java 21. Es el único que habla con TheHive.
- El frontend NUNCA llama a TheHive directamente ni conoce la API key.
- Mientras el backend no exista, el frontend usa datos mock (`frontend/src/mocks/`)
  detrás de la misma interfaz que usará con el backend (`src/api/`). Cambiar de mock a
  real debe ser una sola variable: `VITE_USE_MOCK=true|false`.

## Decisiones de diseño del frontend

- **Contrato de `src/api/`**: expone `obtenerResumenGerencial()` y `listarAlertas(filtros)`.
  El backend devolverá métricas YA AGREGADAS; el frontend no recalcula contra TheHive.
- **Mocks**: se generan AL CARGAR LA APP (módulos en `src/mocks/`), con un generador de
  números pseudoaleatorios de SEMILLA FIJA y fechas relativas a `Date.now()`: así salen siempre
  iguales en forma y nunca quedan viejos. No hay script que escriba JSON estático ni timestamps
  fijos. ~40 alertas en 30 días con forma idéntica a TheHive; ~6 casos y tareas.
  Todo mock es ficticio y debe estar marcado como tal.
- `src/api/mock.ts` calcula los agregados desde los mocks crudos con las funciones puras de
  `src/utils/metricas.ts`, devolviendo la misma forma que dará el backend.
- Casos y tareas no tienen formato real aún (TheHive tiene 0 casos): se usan nombres de la API
  v1 de TheHive 5/6 y `types/` lleva el comentario "PENDIENTE: confirmar con datos reales".
- **Navegación**: pestañas con estado simple (`useState`), sin react-router.
- **Vista unificada**: por ahora solo un marcador "En construcción". Más adelante será una tabla
  de alertas con filtros y columnas extra (¿tiene caso?, ¿fuera de SLA?, antigüedad) y un panel
  de detalle.
- **Pruebas**: Vitest para `src/utils/` (métricas y fechas en `America/Bogota`).
- **Ramas**: el frontend se desarrolla en `feature/frontend`. `.idea/` está en `.gitignore`.

## Seguridad (no negociable)

- La API key de TheHive solo vive en la variable de entorno `THEHIVE_API_KEY` del backend.
  Nunca en código, en `.env` versionado, en logs ni en el frontend.
- El backend solo hace consultas de LECTURA (`POST /api/v1/query`, `GET`). La key tiene
  perfil analyst y podría modificar datos: no escribas código que cree, edite o cierre nada.
- No subir `.env`, `*.crt`, `*.pem`.

## TheHive

- URL: `https://srvlinuxqa.tail2ab6e9.ts.net:8445` (por Tailscale). Organización: `escuelaing`.
- Headers: `Authorization: Bearer <key>`, `X-Organisation: escuelaing`.
- Consultas: `{"query":[{"_name":"listAlert"}, ...]}`, `listCase`, `sort`, `page`, `filter`.
- Para TOTALES usa `{"_name":"count"}`, nunca el largo de una lista paginada.
- Fechas: vienen en milisegundos desde epoch (instante UTC). Todo agrupamiento por día y
  toda hora mostrada usan `America/Bogota`.
- Campos de alerta que usamos: `_id`, `_createdAt`, `title`, `description`, `severity`
  (1 baja, 2 media, 3 alta, 4 crítica), `severityLabel`, `status` (`New` = sin atender),
  `source`, `sourceRef`, `type`, `tags`, `caseId` (si ya se convirtió en caso).
- Forma real de una alerta (los mocks deben ser idénticos en campos y tipos):
  `_id`, `_type:"Alert"`, `_createdBy`, `_createdAt`, `type`, `source`, `sourceRef`, `title`,
  `description`, `severity`, `severityLabel` (LOW/MEDIUM/HIGH/CRITICAL), `date`, `tags`,
  `tlp`, `tlpLabel`, `pap`, `papLabel`, `follow`, `customFields`, `observableCount`,
  `status`, `stage`, `extraData`, `newDate`, `timeToDetect`, y `caseId` si se convirtió.
  Estados vistos/usados: `New`, `InProgress`, `Imported`, `Ignored`.

## Reglas de negocio (decididas con el equipo)

Alertas
- Alertas recibidas = total de alertas.
- Sin atender = alertas con `status = New`.
- Críticas y altas = severidad 3 o 4.
- Antigüedad: alerta sin atender más antigua y antigüedad promedio de las sin atender.
- Fuera de SLA = alerta sin atender cuya antigüedad supera el SLA de su severidad.
  SLA (minutos): crítica 15, alta 30, media 120, baja 240. Va en configuración, no en código.
- Tipo de amenaza = etiqueta `escenario:<tipo>`. Las alertas sin esa etiqueta son
  "Sin clasificar". NUNCA deducir el tipo por el título o el `source`.
- Herramienta de origen = campo `source`.

Respuesta a incidentes (casos)
- Incidentes reportados = casos; desglose abiertos / en progreso / cerrados.
- Alertas convertidas en caso = alertas con `caseId`, mostrado como "X de N (P %)".
- Contenciones hechas = tareas completadas cuyo grupo es `Contención`.
- Incidentes confirmados y cerrados = casos cerrados con estado `TruePositive`.
- Tiempo promedio de cierre = promedio de (fecha de cierre − creación) de casos cerrados.
- Los nombres `Contención` y `TruePositive` están PENDIENTES de confirmar con el grupo de
  TheHive: ponlos en una constante de configuración, no repetidos por el código.

## Reglas de interfaz

- Dos vistas: "Vista gerencial" y "Vista unificada".
- Refresco automático cada 30 s. Arriba a la derecha: hora de última actualización
  (Bogotá), "cada 30 s" y estado de conexión ("TheHive conectado" completo, sin cortarse).
- Nunca inventar datos. Sin datos → mostrar 0 o "—" con una frase corta que explique
  por qué (ej. "Aún no hay casos cerrados").
- Las métricas afectadas por datos de prueba llevan la nota "Datos de laboratorio".
- Debe verse bien en modo claro y oscuro, y en pantallas desde 360 px de ancho.

## Forma de trabajar

- Antes de cambios grandes, propón un plan corto y espera aprobación.
- Cambios pequeños y enfocados en lo que pide el prompt.
- Al terminar cada paso: `npm run build` en `frontend/` (y `./mvnw test` en `backend/`
  cuando exista) debe pasar sin errores.
- No hagas commit ni push salvo que se pida.
