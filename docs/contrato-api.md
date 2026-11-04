# Contrato de la API (frontend ↔ backend)

Contrato que debe cumplir el backend Spring Boot (`backend/`) para el frontend (`frontend/`). El
frontend ya lo usa hoy con datos simulados: `frontend/src/api/mock.ts` produce respuestas con esta
misma forma, así que sirve de referencia ejecutable. Los tipos TypeScript viven en
`frontend/src/types/` (`metricas.ts`, `listaAlertas.ts`, `alerta.ts`, `caso.ts`, `tarea.ts`).

Las reglas de negocio están en `CLAUDE.md`; este documento solo fija la forma de los datos.

## Convenciones

- **Solo lectura.** Los tres endpoints son `GET`. El backend consulta TheHive solo con lectura
  (`POST /api/v1/query` con `listAlert`, `listCase`, tareas, `count`; nunca crea, edita ni cierra).
- **Sin credenciales en el frontend.** El frontend no envía `Authorization` ni cookies. La API key de
  TheHive vive solo en la variable de entorno `THEHIVE_API_KEY` del backend.
- **Fechas:** milisegundos desde epoch (instante UTC), como las da TheHive. **Duraciones:** milisegundos.
- **Días:** `YYYY-MM-DD` según la zona `America/Bogota`. Todo agrupamiento por día usa esa zona.
- **JSON** en UTF-8. Nombres de campos en camelCase en español para lo que define este contrato;
  las alertas, casos y tareas crudas conservan los nombres de TheHive (`_id`, `_createdAt`, `caseId`…).
- **Totales** con `{"_name":"count"}` de TheHive, nunca con el largo de una lista paginada.
- **Errores:** código HTTP. El frontend solo usa el código y muestra su propio mensaje en español:
  `401/403` sin autorización, `404` no existe, `>= 500` error del servidor. Cualquier cuerpo de
  error es opcional.
- **CORS:** el frontend se sirve desde otro origen en desarrollo; el backend (o un proxy) debe
  permitir ese origen para `GET`.
- **Refresco:** el frontend pide `resumen` y `alertas` cada 30 s y `alertas/{id}` al abrir una alerta
  (y de nuevo en cada refresco mientras está abierta). Las respuestas deben ser baratas.

## Endpoints

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/api/dashboard/resumen` | `ResumenGerencial` |
| GET | `/api/dashboard/alertas` | `ListaAlertas` |
| GET | `/api/dashboard/alertas/{id}` | `DetalleAlerta` (`404` si la alerta no existe) |

`{id}` es el `_id` de TheHive (por ejemplo `~4513920`); el frontend lo codifica como segmento de URL.

---

## 1. `GET /api/dashboard/resumen` → `ResumenGerencial`

Datos ya agregados para la Vista gerencial.

```ts
interface ResumenGerencial {
  generadoEn: number;            // instante en que se calculó
  datosDeLaboratorio: boolean;   // true si hay alertas o casos con el tag "simulacion"
  alertas: ResumenAlertas;
  casos: ResumenCasos;
}

interface ResumenAlertas {
  recibidas: number;                        // total de alertas
  sinAtender: number;                       // status = "New"
  criticasYAltas: number;                   // severidad 3 o 4
  masAntiguaSinAtenderMs: number | null;    // solo entre las "New"; null si no hay
  antiguedadPromedioSinAtenderMs: number | null;
  fueraDeSla: number;                       // "New" con antigüedad > SLA de su severidad (estrictamente mayor)
  porSeveridad: { severidad: 1|2|3|4; cantidad: number }[];   // siempre 4 elementos: 4, 3, 2, 1
  porTipoAmenaza: { tipo: string; cantidad: number }[];       // etiqueta "escenario:<tipo>"; de mayor a menor; SIN las sin clasificar
  sinClasificar: number;                    // alertas sin etiqueta "escenario:"
  porOrigen: { origen: string; cantidad: number }[];          // por "source"; de mayor a menor
  porDia: { dia: string; cantidad: number }[];                // últimos 30 días Bogotá, del más antiguo a hoy, con ceros
}

interface ResumenCasos {
  reportados: number;
  abiertos: number;      // stage = "New"
  enProgreso: number;    // stage = "InProgress"
  cerrados: number;      // stage = "Closed"
  alertasConvertidas: { convertidas: number; total: number; porcentaje: number | null }; // porcentaje 0–100 sin redondear; null si total = 0
  contencionesHechas: number;       // tareas del grupo "Contención" con status "Completed"
  confirmadosYCerrados: number;     // casos Closed con status "TruePositive"
  tiempoPromedioCierreMs: number | null;   // promedio (endDate − _createdAt) de los cerrados con endDate; null si no hay
}
```

Notas:

- **SLA** (minutos): crítica 15, alta 30, media 120, baja 240. Va en la configuración del backend.
- **Tipo de amenaza:** solo la etiqueta `escenario:<tipo>`. Nunca se deduce del título ni del `source`.
  Si hay varias etiquetas `escenario:`, se usa la primera con valor.
- **Empates** en `porTipoAmenaza` y `porOrigen`: por nombre ascendente.
- Los nombres `Contención` y `TruePositive` están **PENDIENTES** de confirmar con el grupo de TheHive
  (constantes de configuración).

---

## 2. `GET /api/dashboard/alertas` → `ListaAlertas`

Alertas de los **últimos 30 días** (hoy y los 29 días anteriores, en Bogotá), de la más reciente a
la más antigua, con un **tope de 1000**. No recibe parámetros: el filtrado, el orden y la
paginación (de 25 en 25) los hace el frontend.

```ts
interface ListaAlertas {
  generadoEn: number;
  total: number;               // alertas dentro de la ventana, ANTES del tope
  truncado: boolean;           // true si total > 1000 y solo vienen las 1000 más recientes
  datosDeLaboratorio: boolean; // true si hay alertas de la lista o casos con el tag "simulacion"
  alertas: AlertaFila[];
}

interface AlertaFila {
  id: string;                  // _id de TheHive
  creadaEn: number;            // _createdAt
  titulo: string;
  severidad: 1 | 2 | 3 | 4;    // 1 baja, 2 media, 3 alta, 4 crítica
  estado: "New" | "InProgress" | "Imported" | "Ignored";   // status
  origen: string;              // source
  tipo: string | null;         // clave del escenario ("fuerza-bruta"); null = sin clasificar
  antiguedadMs: number;        // max(0, generadoEn − creadaEn)
  sla: {
    estado: "dentro" | "fuera" | null;  // null = no aplica (la alerta no está "New")
    limiteMin: number;                  // SLA de su severidad, siempre presente
    excesoMs: number | null;            // antiguedadMs − limite, solo si estado = "fuera"
  };
  caso: CasoResumen | null;
}

interface CasoResumen {
  id: string;                  // caseId de la alerta
  numero: number | null;       // number del caso
  etapa: "New" | "InProgress" | "Closed" | null;   // stage del caso
  estado: string | null;       // status del caso ("TruePositive", "FalsePositive"…)
}
```

Reglas:

- **SLA:** solo se evalúa para alertas con `status = "New"`. `fuera` si `antiguedadMs > limiteMin × 60 000`
  (estrictamente mayor: justo en el límite todavía está a tiempo).
- **Caso:** `caso` es `null` solo si la alerta no tiene `caseId`. Si tiene `caseId` pero el caso no
  está disponible, `caso` viene con `id` y los demás campos en `null` (la alerta **sí** tiene caso).
  Las alertas convertidas están en estado `Imported`.
- **Ventana:** una alerta entra si su día en Bogotá es ≥ el primer día de los últimos 30
  (el mismo criterio que la serie `porDia` del resumen).
- **Tope:** si hay más de 1000, se conservan las 1000 más recientes y `truncado = true`.

Ejemplo (recortado):

```json
{
  "generadoEn": 1793520000000,
  "total": 40,
  "truncado": false,
  "datosDeLaboratorio": true,
  "alertas": [
    {
      "id": "~4513920",
      "creadaEn": 1793519400000,
      "titulo": "Múltiples intentos fallidos de inicio de sesión SSH desde 203.0.113.45",
      "severidad": 3,
      "estado": "New",
      "origen": "wazuh",
      "tipo": "fuerza-bruta",
      "antiguedadMs": 600000,
      "sla": { "estado": "dentro", "limiteMin": 30, "excesoMs": null },
      "caso": null
    },
    {
      "id": "~4518024",
      "creadaEn": 1792900000000,
      "titulo": "Troyano detectado en una descarga desde un equipo de la biblioteca",
      "severidad": 2,
      "estado": "Imported",
      "origen": "wazuh",
      "tipo": "malware",
      "antiguedadMs": 620000000,
      "sla": { "estado": null, "limiteMin": 120, "excesoMs": null },
      "caso": { "id": "~8196096", "numero": 1, "etapa": "Closed", "estado": "TruePositive" }
    }
  ]
}
```

---

## 3. `GET /api/dashboard/alertas/{id}` → `DetalleAlerta`

Todos los campos de la alerta, su fila calculada y su caso con las tareas.

```ts
interface DetalleAlerta {
  generadoEn: number;
  alerta: Alerta;              // la alerta tal como la da TheHive (ver abajo)
  fila: AlertaFila;            // la misma fila que en la lista, calculada en generadoEn
  caso: CasoDetalle | null;    // null si no tiene caso o no está disponible
}

interface CasoDetalle extends Caso { tareas: Tarea[] }   // solo las tareas de ese caso
```

`404` si la alerta no existe. Para una alerta con `caseId` cuyo caso no está disponible, `caso` es
`null` y `fila.caso` trae los campos en `null`.

### `Alerta` (forma real de TheHive, `listAlert`)

```ts
interface Alerta {
  _id: string; _type: "Alert"; _createdBy: string; _createdAt: number;
  type: string; source: string; sourceRef: string;
  title: string; description: string;
  severity: 1|2|3|4; severityLabel: "LOW"|"MEDIUM"|"HIGH"|"CRITICAL";
  date: number; tags: string[];
  tlp: number; tlpLabel: string; pap: number; papLabel: string;
  follow: boolean; customFields: unknown[]; observableCount: number;
  status: "New"|"InProgress"|"Imported"|"Ignored"; stage: "New"|"InProgress"|"Imported"|"Ignored";
  extraData: Record<string, unknown>; newDate: number; timeToDetect: number;
  caseId?: string;             // solo si ya se convirtió en caso
}
```

### `Caso` y `Tarea`

> **PENDIENTE: confirmar con datos reales.** TheHive todavía tiene 0 casos; estos campos salen de la
> API v1 de TheHive 5/6 que conocemos, no de una respuesta real. Verificar nombres, tipos y valores
> de `status` y `stage`.

```ts
interface Caso {
  _id: string; _type: "case"; _createdAt: number;
  number: number; title: string; description?: string;
  severity: 1|2|3|4;
  status: string;                       // p. ej. "New", "InProgress", "TruePositive", "FalsePositive"
  stage: "New" | "InProgress" | "Closed";
  assignee?: string;
  endDate?: number;                     // solo si está cerrado
  tags: string[];
}

interface Tarea {
  _id: string; _type: "task"; _createdAt: number;
  title: string;
  group: string;                        // las contenciones son las del grupo "Contención"
  status: "Waiting" | "InProgress" | "Completed" | "Cancel";
  endDate?: number;                     // solo si está completada
  caseId?: string;
}
```

---

## Pendientes de confirmar

- Nombres `Contención` (grupo de tareas) y `TruePositive` (estado de caso confirmado) con el grupo de TheHive.
- Forma real de casos y tareas (hoy hay 0 casos en TheHive).
- Si TheHive guarda la fecha exacta en que una alerta se convirtió en caso. Mientras no, la línea de
  tiempo del frontend usa `_createdAt` del caso como fecha de la conversión.
- Formato exacto de las rutas de los enlaces "Abrir en TheHive" (`frontend/src/config/index.ts`).
