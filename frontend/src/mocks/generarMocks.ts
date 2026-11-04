import { ESTADO_CONFIRMADO, ESTADO_FALSO_POSITIVO, GRUPO_CONTENCION, SLA_MINUTOS } from "../config";
import type { Alerta, EstadoAlerta, EtiquetaSeveridad, Severidad } from "../types/alerta";
import type { Caso } from "../types/caso";
import type { EstadoTarea, Tarea } from "../types/tarea";
import { ultimosDias } from "../utils/fechas";
import { barajar, elegir, entero, mulberry32, uuid, type Aleatorio } from "./aleatorio";
import { CATALOGO } from "./catalogo";

/**
 * DATOS FICTICIOS. Se generan al cargar la app: con la misma semilla y el mismo `ahora`
 * el resultado es siempre idéntico; las fechas son relativas a `ahora`.
 */
export interface DatosMock {
  alertas: Alerta[];
  casos: Caso[];
  tareas: Tarea[];
}

const MIN = 60_000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

const ETIQUETA_SEVERIDAD: Record<Severidad, EtiquetaSeveridad> = {
  1: "LOW",
  2: "MEDIUM",
  3: "HIGH",
  4: "CRITICAL",
};
const ETIQUETA_TLP = ["WHITE", "GREEN", "AMBER", "RED"] as const;
const ANALISTAS = ["analista1@escuelaing.local", "analista2@escuelaing.local"] as const;

interface Plan {
  severidad: Severidad;
  estado: EstadoAlerta;
  edadMs: number;
  /** Alerta que debe crearse a las 23:30 hora de Bogotá. */
  a2330?: boolean;
}

/**
 * Reparte 40 alertas: 6 New dentro de SLA (una o más por severidad), 20 New fuera de SLA,
 * 5 InProgress, 6 Imported y 3 Ignored. Severidades: 5 críticas, 14 altas, 15 medias, 6 bajas.
 */
function planificar(rng: Aleatorio): Plan[] {
  const planes: Plan[] = [];

  const dentroDeSla: Severidad[] = [4, 3, 3, 2, 2, 1];
  for (const s of dentroDeSla) {
    planes.push({ severidad: s, estado: "New", edadMs: SLA_MINUTOS[s] * MIN * (0.2 + rng() * 0.6) });
  }

  const fueraDeSla = barajar<Severidad>(rng, [4, 4, 4, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1]);
  fueraDeSla.forEach((s, i) => {
    // Una de cada cuatro está apenas fuera de SLA; el resto lleva horas o días sin atender.
    const edadMs = i % 4 === 0 ? SLA_MINUTOS[s] * MIN * (1.2 + rng() * 1.8) : DIA * (1 + rng() * 28);
    planes.push({ severidad: s, estado: "New", edadMs });
  });
  // Una de las alertas sin atender se crea a las 23:30 de Bogotá.
  planes.find((p, i) => i >= dentroDeSla.length && p.severidad === 3)!.a2330 = true;

  const resto = barajar<Severidad>(rng, [4, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 1, 1]);
  const estados: EstadoAlerta[] = [
    ...Array<EstadoAlerta>(5).fill("InProgress"),
    ...Array<EstadoAlerta>(6).fill("Imported"),
    ...Array<EstadoAlerta>(3).fill("Ignored"),
  ];
  resto.forEach((s, i) => {
    const estado = estados[i];
    const edadMs =
      estado === "InProgress" ? HORA * (1 + rng() * 239) : estado === "Imported" ? DIA * (6 + rng() * 22) : DIA * (1 + rng() * 27);
    planes.push({ severidad: s, estado, edadMs });
  });

  return planes;
}

/** Instante (ms) de las 23:30 de Bogotá de hace 3 días. Date.UTC normaliza las horas > 23. */
function las2330Bogota(ahora: number): number {
  const [a, m, d] = ultimosDias(4, ahora)[0].split("-").map(Number);
  return Date.UTC(a, m - 1, d, 23 + 5, 30);
}

export function generarMocks(ahora: number, semilla: number): DatosMock {
  const rng = mulberry32(semilla);

  // ---------- Alertas ----------
  const planes = planificar(rng);
  const entradas = barajar(rng, CATALOGO);

  const alertas: Alerta[] = planes.map((plan, i) => {
    const entrada = entradas[i];
    const creadoEn = plan.a2330 ? las2330Bogota(ahora) : Math.round(ahora - plan.edadMs);
    const tlp = elegir(rng, [1, 2, 2, 3]);
    const pap = elegir(rng, [1, 2, 2, 3]);
    const tags = ["simulacion"];
    if (entrada.escenario) tags.push(`escenario:${entrada.escenario}`);

    return {
      _id: `~${4_513_920 + i * 4104 + entero(rng, 0, 1000)}`,
      _type: "Alert",
      _createdBy: "integracion-soc@escuelaing.local",
      _createdAt: creadoEn,
      type: "simulacion",
      source: entrada.source,
      sourceRef: uuid(rng),
      title: entrada.title,
      description: `Alerta ficticia de laboratorio generada por ${entrada.source}. Datos de prueba.`,
      severity: plan.severidad,
      severityLabel: ETIQUETA_SEVERIDAD[plan.severidad],
      date: creadoEn - entero(rng, 15, 40),
      tags,
      tlp,
      tlpLabel: ETIQUETA_TLP[tlp],
      pap,
      papLabel: ETIQUETA_TLP[pap],
      follow: true,
      customFields: [],
      observableCount: entero(rng, 0, 6),
      status: plan.estado,
      stage: plan.estado,
      extraData: {},
      newDate: creadoEn - entero(rng, 5, 12),
      timeToDetect: entero(rng, 1, 60),
    };
  });

  // ---------- Casos (uno por alerta Imported, de la más antigua a la más reciente) ----------
  type Destino = Pick<Caso, "status" | "stage">;
  const destinos: Destino[] = [
    { status: ESTADO_CONFIRMADO, stage: "Closed" },
    { status: ESTADO_CONFIRMADO, stage: "Closed" },
    { status: ESTADO_FALSO_POSITIVO, stage: "Closed" },
    { status: "InProgress", stage: "InProgress" },
    { status: "InProgress", stage: "InProgress" },
    { status: "New", stage: "New" },
  ];

  const importadas = alertas.filter((a) => a.status === "Imported").sort((x, y) => x._createdAt - y._createdAt);

  const casos: Caso[] = importadas.map((alerta, i) => {
    const destino = destinos[i];
    const creadoEn = alerta._createdAt + entero(rng, 30, 150) * MIN;
    const caso: Caso = {
      _id: `~${8_192_000 + (i + 1) * 4096}`,
      _type: "case",
      _createdAt: creadoEn,
      number: i + 1,
      title: alerta.title,
      description: "Caso ficticio de laboratorio. Datos de prueba.",
      severity: alerta.severity,
      status: destino.status,
      stage: destino.stage,
      assignee: elegir(rng, ANALISTAS),
      tags: alerta.tags.filter((t) => t === "simulacion" || t.startsWith("escenario:")),
    };
    if (destino.stage === "Closed") caso.endDate = creadoEn + Math.round(HORA * (6 + rng() * 66));
    alerta.caseId = caso._id;
    return caso;
  });

  // ---------- Tareas ----------
  interface PlantillaTarea {
    grupo: string;
    titulo: string;
    estado: EstadoTarea;
  }
  const C = GRUPO_CONTENCION;
  const plantillas: PlantillaTarea[][] = [
    [
      { grupo: C, titulo: "Aislar el equipo comprometido de la red", estado: "Completed" },
      { grupo: C, titulo: "Bloquear la dirección IP en el firewall perimetral", estado: "Completed" },
      { grupo: "Análisis", titulo: "Análisis forense de la imagen de disco", estado: "Completed" },
    ],
    [
      { grupo: C, titulo: "Deshabilitar la cuenta de usuario comprometida", estado: "Completed" },
      { grupo: "Erradicación", titulo: "Eliminar el archivo malicioso de los equipos afectados", estado: "Completed" },
    ],
    [
      { grupo: "Análisis", titulo: "Revisión de registros de autenticación", estado: "Completed" },
      { grupo: C, titulo: "Aislar el segmento de red afectado", estado: "Cancel" },
    ],
    [
      { grupo: C, titulo: "Restablecer las credenciales de la cuenta afectada", estado: "Completed" },
      { grupo: C, titulo: "Bloquear el dominio malicioso en el DNS interno", estado: "InProgress" },
      { grupo: "Erradicación", titulo: "Aplicar parches en los servidores afectados", estado: "Waiting" },
    ],
    [
      { grupo: C, titulo: "Notificar y aislar la estación del usuario afectado", estado: "InProgress" },
      { grupo: "Análisis", titulo: "Correlacionar eventos del SIEM con la alerta original", estado: "Completed" },
    ],
    [
      { grupo: C, titulo: "Suspender el envío de correos desde la cuenta sospechosa", estado: "Waiting" },
      { grupo: "Análisis", titulo: "Determinar el alcance del incidente", estado: "Waiting" },
    ],
  ];

  let contador = 0;
  const tareas: Tarea[] = casos.flatMap((caso, i) =>
    (plantillas[i] ?? []).map((p) => {
      contador += 1;
      const creadoEn = caso._createdAt + entero(rng, 5, 30) * MIN;
      const tarea: Tarea = {
        _id: `~${12_288_000 + contador * 4096}`,
        _type: "task",
        _createdAt: creadoEn,
        title: p.titulo,
        group: p.grupo,
        status: p.estado,
        caseId: caso._id,
      };
      if (p.estado === "Completed") tarea.endDate = creadoEn + entero(rng, 30, 180) * MIN;
      return tarea;
    }),
  );

  alertas.sort((x, y) => y._createdAt - x._createdAt);
  return { alertas, casos, tareas };
}
