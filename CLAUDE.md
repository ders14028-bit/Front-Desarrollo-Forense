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
  real se hace con `VITE_USE_MOCK=true|false`; si no está definida, el mock es el valor por
  defecto SOLO en desarrollo (`npm run dev`) y en el build de producción se usa el backend
  (que además necesita `VITE_API_URL`). Variables en `frontend/.env.example`: `VITE_USE_MOCK`,
  `VITE_MOCK_ERROR` (el mock falla, para probar el estado de error) y `VITE_API_URL`.

**Alcance: solo la Vista gerencial.** La "Vista unificada" (tabla de alertas, filtros, detalle, enlaces "Abrir en
TheHive") quedó FUERA DE ALCANCE y se eliminó del frontend. Se puede recuperar desde el tag
`con-vista-unificada` (`git checkout con-vista-unificada -- <ruta>` o `git diff con-vista-unificada`).

## Decisiones de diseño del frontend

**API y datos**
- **Contrato de `src/api/`** (`FuenteDatos`): `obtenerResumenGerencial()` y `obtenerMetricasWazuh()`.
  Tipos y endpoints en `docs/contrato-api.md`, que es lo que debe cumplir el backend. El backend devuelve
  métricas YA AGREGADAS; las reglas están en `src/utils/` (`metricas.ts`).
- **Mocks**: se generan AL CARGAR LA APP (módulos en `src/mocks/`), con un generador de números
  pseudoaleatorios de SEMILLA FIJA y fechas relativas a `Date.now()`: salen siempre iguales en forma y nunca
  quedan viejos. No hay script que escriba JSON estático ni timestamps fijos. ~40 alertas en 30 días con forma
  idéntica a TheHive; ~6 casos y tareas. Todo mock es ficticio y está marcado con el tag `simulacion`.
- `src/api/mock.ts` calcula los agregados desde los mocks crudos con las funciones puras de `src/utils/`,
  devolviendo la misma forma que dará el backend.
- Casos y tareas no tienen formato real aún (TheHive tiene 0 casos): se usan nombres de la API v1 de
  TheHive 5/6 y `types/` lleva comentarios "PENDIENTE: confirmar con datos reales".

**Estado y navegación**
- Una sola vista, sin pestañas ni react-router. `App.tsx` muestra directamente la Vista gerencial; el título del
  documento es "Dashboard SOC".
- La vista refresca cada 30 s; no consulta con la pestaña del navegador oculta y al volver a verla refresca de
  inmediato.

**Vista gerencial**
- Orden: tarjetas de alertas → tarjetas de incidentes → gráficas (severidad, tipo de amenaza con los 5 mayores
  y "Otros", herramienta, alertas por día 7/14/30). Gráficas con CSS, sin librerías.
- **Aviso de laboratorio**: UN aviso general "Datos de laboratorio: las cifras vienen de alertas simuladas",
  debajo del encabezado y visible cuando la respuesta trae `datosDeLaboratorio = true`
  (alertas o casos con el tag `simulacion`; PENDIENTE confirmar ese tag). Ya no hay notas por tarjeta.

**Accesibilidad y estilos**
- Estructura: enlace "Saltar al contenido", un único `<main id="contenido" tabindex="-1">` al que
  salta el enlace; el anillo de foco es `:focus-visible`.
- Colores como variables en `variables.css`, claro y oscuro. Los bordes de campos y botones usan
  `--borde-control` (≥ 3:1); `--borde` es solo para líneas decorativas. A 360 px nada debe desbordar.

**Pruebas y proceso**
- **Vitest**: utilidades puras con datos armados a mano (`src/utils/`, también las de fechas en
  `America/Bogota`), hooks con temporizadores falsos y el HTML de los componentes
  (`renderToStaticMarkup`, sin jsdom). El foco y el teclado (p. ej. "Saltar al contenido") se revisan a mano en
  el navegador. Las pruebas deben pasar también con `TZ=UTC`.
- **Ramas**: el frontend se desarrolla en `feature/frontend`.

**Para el backend (anotado en `docs/contrato-api.md`, aún no implementado en el frontend)**
- Los endpoints `GET /api/dashboard/alertas` y `/alertas/{id}` siguen existiendo pero el frontend no los usa. El
  refresco en segundo plano ya NO calcula la lista (`dashboard.refresco.lista-en-segundo-plano=false` por
  defecto): se calcula bajo demanda, para no consultar TheHive de más.
- El backend expone su configuración de SLA y el frontend la usa en vez de la suya (`config/SLA_MINUTOS`
  quedaría solo para el mock).
- El resumen incluye si TheHive respondió en la última consulta, y el encabezado distingue "Sin conexión con el
  servidor" de "TheHive no responde".

**PENDIENTES por confirmar con el grupo de TheHive** (marcados `PENDIENTE` en el código): nombres `Contención`
y `TruePositive`; valores de `stage` de casos y `status` de tareas; estados de alerta `InProgress`/`Imported`/
`Ignored`; resoluciones `Other`/`Indeterminate`/`Duplicated`; unidad de `timeToDetect`; fecha de conversión de
alerta a caso; tag `simulacion` de los datos de prueba.

## Seguridad (no negociable)

- La API key de TheHive solo vive en la variable de entorno `THEHIVE_API_KEY` del backend.
  Nunca en código, en `.env` versionado, en logs ni en el frontend.
- El backend solo hace consultas de LECTURA (`POST /api/v1/query`, `GET`). La key tiene
  perfil analyst y podría modificar datos: no escribas código que cree, edite o cierre nada.
- No subir `.env`, `*.env`, `*.crt`, `*.pem` (ignorados en el `.gitignore` de la raíz; `.env.example` sí se versiona, sin valores reales).

## TheHive

- La URL de TheHive va en `THEHIVE_URL` (no se escribe en el repo; se accede por Tailscale). Organización: `escuelaing`.
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

- Una sola vista: "Vista gerencial" (la Vista unificada está fuera de alcance; ver tag `con-vista-unificada`).
- Refresco automático cada 30 s. Arriba a la derecha: hora de última actualización
  (Bogotá), "cada 30 s" y estado de conexión ("TheHive conectado" completo, sin cortarse).
- Nunca inventar datos. Sin datos → mostrar 0 o "—" con una frase corta que explique
  por qué (ej. "Aún no hay casos cerrados").
- Cuando las cifras vienen de datos de prueba se muestra, debajo del encabezado, el aviso
  "Datos de laboratorio: las cifras vienen de alertas simuladas".
- Debe verse bien en modo claro y oscuro, y en pantallas desde 360 px de ancho.

## Forma de trabajar

- Antes de cambios grandes, propón un plan corto y espera aprobación.
- Cambios pequeños y enfocados en lo que pide el prompt.
- Al terminar cada paso: `npm run build` en `frontend/` (y `./mvnw test` en `backend/`
  cuando exista) debe pasar sin errores.
- No hagas commit ni push salvo que se pida.
