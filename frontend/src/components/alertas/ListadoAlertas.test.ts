import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { crearFuenteMock } from "../../api/mock";
import type { ListaAlertas } from "../../types/listaAlertas";
import { ListadoAlertas } from "./ListadoAlertas";

// Renderizado en servidor (sin navegador): comprueba el HTML de la primera página.

const AHORA = Date.UTC(2026, 10, 3, 15, 0);
const contar = (html: string, texto: string) => html.split(texto).length - 1;
const html = (lista: ListaAlertas) => renderToStaticMarkup(createElement(ListadoAlertas, { lista }));

async function listaMock(): Promise<ListaAlertas> {
  return crearFuenteMock({ ahora: () => AHORA, demoraMs: 0, falla: false }).listarAlertas();
}

describe("ListadoAlertas: con las 40 alertas del mock", () => {
  it("cabecera: 'N alertas · últimos 30 días' y nota de laboratorio", async () => {
    const h = html(await listaMock());
    expect(h).toContain("40 alertas · últimos 30 días");
    expect(h).toContain("Datos de laboratorio");
    expect(h).not.toContain("Mostrando las"); // no está truncada
  });

  it("tabla accesible: caption oculto, 6 encabezados de columna y 25 filas con título como encabezado de fila", async () => {
    const h = html(await listaMock());
    expect(h).toContain('<caption class="solo-lectores">Alertas de los últimos 30 días. Página 1 de 2.</caption>');
    expect(contar(h, '<th scope="col">')).toBe(6);
    expect(contar(h, '<th scope="row"')).toBe(25);
    expect(contar(h, 'class="fila-boton"')).toBe(25); // un botón por fila, listo para el panel de detalle
  });

  it("las tarjetas de celular tienen los mismos 25 datos", async () => {
    const h = html(await listaMock());
    expect(contar(h, 'class="tarjeta-alerta sev-')).toBe(25);
  });

  it("paginación: 'Mostrando 1–25 de 40', sin 'Anterior' en la primera página, con 'Siguiente'", async () => {
    const h = html(await listaMock());
    expect(h).toContain("Mostrando 1–25 de 40");
    expect(h).toContain("Página 1 de 2");
    expect(h).toContain("Siguiente");
    expect(h).not.toContain("Anterior");
  });

  it("la primera fila es una sin atender fuera de SLA (orden por prioridad)", async () => {
    const lista = await listaMock();
    const h = html(lista);
    const primera = h.slice(h.indexOf("<tbody>"), h.indexOf("</tr>", h.indexOf("<tbody>")));
    expect(primera).toContain("Fuera de SLA");
    expect(primera).toContain("Sin atender");
  });
});

describe("ListadoAlertas: casos especiales", () => {
  const base: ListaAlertas = { generadoEn: AHORA, total: 0, truncado: false, datosDeLaboratorio: false, alertas: [] };

  it("sin alertas en 30 días: mensaje claro y sin tabla ni paginación", () => {
    const h = html(base);
    expect(h).toContain("No hay alertas en los últimos 30 días");
    expect(h).toContain("0 alertas · últimos 30 días");
    expect(h).not.toContain("<table");
    expect(h).not.toContain("Mostrando");
    expect(h).not.toContain("Datos de laboratorio");
  });

  it("si está truncada, avisa cuántas muestra", async () => {
    const lista = await listaMock();
    const h = html({ ...lista, alertas: lista.alertas.slice(0, 3), total: 1500, truncado: true });
    expect(h).toContain("1500 alertas · últimos 30 días");
    expect(h).toContain("Mostrando las 3 más recientes");
  });

  it("una sola alerta: singular y sin botones de página", async () => {
    const lista = await listaMock();
    const h = html({ ...lista, alertas: lista.alertas.slice(0, 1), total: 1 });
    expect(h).toContain("1 alerta · últimos 30 días");
    expect(h).toContain("Mostrando 1 de 1");
    expect(h).not.toContain("Siguiente");
    expect(h).not.toContain("Anterior");
  });
});
