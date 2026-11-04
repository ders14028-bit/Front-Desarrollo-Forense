/** Severidad de TheHive: 1 baja, 2 media, 3 alta, 4 crítica. */
export type Severidad = 1 | 2 | 3 | 4;

export type EtiquetaSeveridad = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/** `New` = sin atender. */
export type EstadoAlerta = "New" | "InProgress" | "Imported" | "Ignored";

/**
 * Alerta con la forma real de `POST /api/v1/query` (`listAlert`) de TheHive.
 * Las fechas son milisegundos desde epoch (instante UTC).
 */
export interface Alerta {
  _id: string;
  _type: "Alert";
  _createdBy: string;
  _createdAt: number;
  type: string;
  source: string;
  sourceRef: string;
  title: string;
  description: string;
  severity: Severidad;
  severityLabel: EtiquetaSeveridad;
  date: number;
  tags: string[];
  tlp: number;
  tlpLabel: string;
  pap: number;
  papLabel: string;
  follow: boolean;
  customFields: unknown[];
  observableCount: number;
  status: EstadoAlerta;
  stage: EstadoAlerta;
  extraData: Record<string, unknown>;
  newDate: number;
  timeToDetect: number;
  /** Solo presente si la alerta ya se convirtió en caso. */
  caseId?: string;
}
