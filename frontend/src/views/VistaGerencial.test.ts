import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { crearFuenteMock } from "../api/mock";
import { AvisoLaboratorio } from "../components/layout/AvisoLaboratorio";
import type { ResumenGerencial } from "../types/metricas";
import { SeccionAlertas, SeccionCasos } from "./VistaGerencial";

// Renderizado en servidor de la vista con datos del mock (sin navegador).

const AHORA = Date.UTC(2026, 10, 3, 15, 0);
const contar = (html: string, texto: string) => html.split(texto).length - 1;

// Se renderizan las secciones de tarjetas (las gráficas se prueban aparte, en graficas.test.ts).
function html(resumen: ResumenGerencial): string {
  return renderToStaticMarkup(
    createElement("div", null, createElement(SeccionAlertas, { resumen }), createElement(SeccionCasos, { resumen })),
  );
}

async function resumenMock(): Promise<ResumenGerencial> {
  return crearFuenteMock({ ahora: () => AHORA, demoraMs: 0, falla: false }).obtenerResumenGerencial();
}

describe("VistaGerencial", () => {
  it("'Alertas convertidas en caso' se muestra como 'X de N (P %)'", async () => {
    const r = await resumenMock();
    const { convertidas, total } = r.casos.alertasConvertidas;
    const pct = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format((convertidas / total) * 100);

    const h = html(r);
    expect(h).toContain(`${convertidas} de ${total}`);
    expect(h).toContain(`(${pct} %)`);
    // y en el mismo párrafo del valor, no en una línea aparte
    expect(h).toContain(
      `<p class="tarjeta__valor"><span class="tarjeta__cifra">${convertidas} de ${total}</span><span class="tarjeta__sufijo"> (${pct} %)</span></p>`,
    );
  });

  it("'Críticas y altas' con 0 explica por qué", async () => {
    const r = await resumenMock();
    const sinCriticas: ResumenGerencial = { ...r, alertas: { ...r.alertas, criticasYAltas: 0 } };
    expect(html(sinCriticas)).toContain("No hay alertas críticas ni altas");
    expect(html(r)).not.toContain("No hay alertas críticas ni altas");
  });

  it("sin alertas convertidas posibles (0 alertas): '—' con su frase", async () => {
    const r = await resumenMock();
    const vacio: ResumenGerencial = {
      ...r,
      casos: { ...r.casos, alertasConvertidas: { convertidas: 0, total: 0, porcentaje: null } },
    };
    const h = html(vacio);
    expect(h).toContain("Aún no hay alertas");
    expect(contar(h, "tarjeta__sufijo")).toBe(0);
  });

  it("ya no hay notas de laboratorio por tarjeta (el aviso es uno general, en App)", async () => {
    const r = await resumenMock();
    expect(r.datosDeLaboratorio).toBe(true);
    expect(html(r)).not.toContain("Datos de laboratorio");
  });
});

// Resumen con las cifras reales del humo: 23.261 alertas, casi todas sin atender.
async function resumenGrande(): Promise<ResumenGerencial> {
  const r = await resumenMock();
  return {
    ...r,
    alertas: {
      ...r.alertas,
      recibidas: 23261,
      sinAtender: 23148,
      criticasYAltas: 1615,
      fueraDeSla: 22000,
      porSeveridad: [
        { severidad: 4, cantidad: 27 },
        { severidad: 3, cantidad: 1588 },
        { severidad: 2, cantidad: 540 },
        { severidad: 1, cantidad: 21106 },
      ],
    },
  };
}

describe("VistaGerencial: cifras y porcentajes", () => {
  it("las cifras llevan separador de miles es-CO (23.261)", async () => {
    const h = html(await resumenGrande());
    expect(h).toContain(">23.261<");
    expect(h).toContain(">23.148<");
    expect(h).toContain(">1.615<");
    expect(h).not.toContain(">23261<");
  });

  it("'Sin atender' lleva debajo 'N % del total'", async () => {
    const h = html(await resumenGrande());
    expect(h).toContain("99,5 % del total"); // 23.148 / 23.261
  });

  it("'Fuera de SLA' lleva debajo 'N % del total' (sobre las alertas recibidas)", async () => {
    const h = html(await resumenGrande());
    expect(h).toContain("94,6 % del total"); // 22.000 / 23.261
    expect(contar(h, "% del total")).toBe(2);
  });

  it("'Críticas y altas' lleva debajo 'N críticas' (las de severidad 4)", async () => {
    const h = html(await resumenGrande());
    expect(h).toContain(">27 críticas<");
  });

  it("una sola crítica va en singular y sin críticas no se inventa la línea", async () => {
    const r = await resumenGrande();
    const una = { ...r, alertas: { ...r.alertas, porSeveridad: r.alertas.porSeveridad.map((s) => (s.severidad === 4 ? { ...s, cantidad: 1 } : s)) } };
    expect(html(una)).toContain(">1 crítica<");
    const cero = { ...r, alertas: { ...r.alertas, porSeveridad: r.alertas.porSeveridad.map((s) => (s.severidad === 4 ? { ...s, cantidad: 0 } : s)) } };
    expect(html(cero)).toContain(">0 críticas<");
  });

  it("nunca dice 100 % si falta alguna alerta ni 0 % si hay alguna", async () => {
    const r = await resumenGrande();
    const casi = { ...r, alertas: { ...r.alertas, sinAtender: 23260 } };
    expect(html(casi)).toContain("99,9 % del total");
    const todas = { ...r, alertas: { ...r.alertas, sinAtender: 23261 } };
    expect(html(todas)).toContain("100 % del total");
    const una = { ...r, alertas: { ...r.alertas, fueraDeSla: 1 } };
    expect(html(una)).toContain("menos de 0,1 % del total");
  });

  it("con 0 sigue la frase que explica, no el porcentaje", async () => {
    const r = await resumenGrande();
    const h = html({ ...r, alertas: { ...r.alertas, sinAtender: 0, fueraDeSla: 0 } });
    expect(h).toContain("No hay alertas sin atender");
    expect(h).toContain("Ninguna fuera de plazo");
    expect(contar(h, "% del total")).toBe(0);
  });

  it("'X de N (P %)' de las convertidas también agrupa los miles", async () => {
    const r = await resumenGrande();
    const h = html({ ...r, casos: { ...r.casos, alertasConvertidas: { convertidas: 1200, total: 23261, porcentaje: (1200 / 23261) * 100 } } });
    expect(h).toContain("1.200 de 23.261");
    expect(h).toContain("(5,2 %)");
  });
});

describe("AvisoLaboratorio", () => {
  it("va dentro del mismo ancho (.ancho) que el contenido, no de borde a borde", () => {
    const h = renderToStaticMarkup(createElement(AvisoLaboratorio));
    expect(h).toMatch(/^<div class="aviso-laboratorio ancho">/);
    expect(h).not.toMatch(/class="aviso-laboratorio__texto ancho"/);
  });

  it("es un solo aviso con el texto acordado", () => {
    const h = renderToStaticMarkup(createElement(AvisoLaboratorio));
    const texto = h.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    expect(texto).toBe("Datos de laboratorio: las cifras vienen de alertas simuladas");
    expect(h).toContain('role="note"');
    expect(contar(h, "Datos de laboratorio")).toBe(1);
  });
});
