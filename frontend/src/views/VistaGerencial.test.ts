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

describe("AvisoLaboratorio", () => {
  it("es un solo aviso con el texto acordado", () => {
    const h = renderToStaticMarkup(createElement(AvisoLaboratorio));
    const texto = h.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    expect(texto).toBe("Datos de laboratorio: las cifras vienen de alertas simuladas");
    expect(h).toContain('role="note"');
    expect(contar(h, "Datos de laboratorio")).toBe(1);
  });
});
