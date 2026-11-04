import { describe, expect, it } from "vitest";
import type { Alerta } from "../types/alerta";
import { camposDeAlerta } from "./camposAlerta";

// Alerta con la forma real de TheHive (la del ejemplo del proyecto).
const alerta: Alerta = {
  _id: "~4513920",
  _type: "Alert",
  _createdBy: "integracion-soc@escuelaing.local",
  _createdAt: Date.UTC(2026, 9, 31, 4, 30), // 30 oct 23:30 en Bogotá
  type: "simulacion",
  source: "sla-simulado",
  sourceRef: "b6a4044c-26e5-405a-a045-8ab001a7e7f0",
  title: "[SIMULACION SLA] Inicio de atencion",
  description: "Prueba del SLA de triaje para severidad alta.",
  severity: 3,
  severityLabel: "HIGH",
  date: Date.UTC(2026, 9, 31, 4, 29), // 30 oct 23:29
  tags: ["prueba-sla", "simulacion"],
  tlp: 2,
  tlpLabel: "AMBER",
  pap: 2,
  papLabel: "AMBER",
  follow: true,
  customFields: [],
  observableCount: 0,
  status: "New",
  stage: "New",
  extraData: {},
  newDate: Date.UTC(2026, 9, 31, 5, 0), // 31 oct 00:00
  timeToDetect: 5,
};

const por = (a: Alerta) => (clave: string) => camposDeAlerta(a).find((c) => c.clave === clave)!.valor;

describe("camposDeAlerta", () => {
  it("incluye todos los campos de la alerta de TheHive (26) sin repetir ninguno", () => {
    const campos = camposDeAlerta(alerta);
    expect(campos).toHaveLength(26);
    expect(new Set(campos.map((c) => c.clave)).size).toBe(26);
    // cada clave de la alerta aparece (caseId es opcional y también se lista)
    for (const clave of Object.keys(alerta)) expect(campos.some((c) => c.clave === clave)).toBe(true);
  });

  it("las fechas salen en hora de Bogotá, no en UTC", () => {
    const v = por(alerta);
    expect(v("_createdAt")).toEqual({ tipo: "texto", texto: "30 oct 2026, 23:30" });
    expect(v("date")).toEqual({ tipo: "texto", texto: "30 oct 2026, 23:29" });
    expect(v("newDate")).toEqual({ tipo: "texto", texto: "31 oct 2026, 00:00" });
  });

  it("las etiquetas son una lista (chips) y los booleanos se escriben en español", () => {
    const v = por(alerta);
    expect(v("tags")).toEqual({ tipo: "etiquetas", etiquetas: ["prueba-sla", "simulacion"] });
    expect(v("follow")).toEqual({ tipo: "texto", texto: "Sí" });
    expect(por({ ...alerta, follow: false })("follow")).toEqual({ tipo: "texto", texto: "No" });
  });

  it("los demás campos se muestran tal cual, con 0 como valor válido", () => {
    const v = por(alerta);
    expect(v("_id")).toEqual({ tipo: "texto", texto: "~4513920" });
    expect(v("severity")).toEqual({ tipo: "texto", texto: "3" });
    expect(v("severityLabel")).toEqual({ tipo: "texto", texto: "HIGH" });
    expect(v("observableCount")).toEqual({ tipo: "texto", texto: "0" });
    expect(v("timeToDetect")).toEqual({ tipo: "texto", texto: "5" });
    expect(v("description")).toEqual({ tipo: "texto", texto: "Prueba del SLA de triaje para severidad alta." });
  });

  it("lo que no tiene valor se muestra como '—': sin caseId, descripción vacía, listas y objetos vacíos", () => {
    const v = por({ ...alerta, description: "" });
    expect(v("caseId")).toEqual({ tipo: "texto", texto: "—" });
    expect(v("description")).toEqual({ tipo: "texto", texto: "—" });
    expect(v("customFields")).toEqual({ tipo: "texto", texto: "—" });
    expect(v("extraData")).toEqual({ tipo: "texto", texto: "—" });
  });

  it("el caseId, los campos personalizados y los datos adicionales se muestran cuando existen", () => {
    const v = por({
      ...alerta,
      caseId: "~8196096",
      customFields: [{ name: "equipo", value: "srv-01" }],
      extraData: { regla: 5710 },
    });
    expect(v("caseId")).toEqual({ tipo: "texto", texto: "~8196096" });
    expect(v("customFields")).toEqual({ tipo: "json", texto: JSON.stringify([{ name: "equipo", value: "srv-01" }], null, 2) });
    expect(v("extraData")).toEqual({ tipo: "json", texto: JSON.stringify({ regla: 5710 }, null, 2) });
  });

  it("alerta sin etiquetas: lista vacía (el componente muestra '—')", () => {
    expect(por({ ...alerta, tags: [] })("tags")).toEqual({ tipo: "etiquetas", etiquetas: [] });
  });
});
