import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { crearFuenteMock } from "../../../api/mock";
import type { DetalleAlerta } from "../../../types/listaAlertas";
import { formatoFechaHora } from "../../../utils/fechas";
import { DetalleCompleto } from "./ContenidoDetalle";

// Renderizado en servidor del contenido del panel (el cascarón modal necesita un navegador).

const AHORA = Date.UTC(2026, 10, 3, 15, 0);
const contar = (html: string, texto: string) => html.split(texto).length - 1;
const html = (detalle: DetalleAlerta) => renderToStaticMarkup(createElement(DetalleCompleto, { detalle }));

async function detalleDe(filtro: (f: Awaited<ReturnType<ReturnType<typeof crearFuenteMock>["listarAlertas"]>>["alertas"][number]) => boolean) {
  const fuente = crearFuenteMock({ ahora: () => AHORA, demoraMs: 0, falla: false });
  const fila = (await fuente.listarAlertas()).alertas.find(filtro)!;
  return fuente.obtenerDetalleAlerta(fila.id);
}

describe("DetalleCompleto: alerta con caso cerrado y confirmado", () => {
  it("muestra Resumen, Línea de tiempo, Caso y 'Todos los campos' (plegado)", async () => {
    const d = await detalleDe((f) => f.caso?.etapa === "Closed" && f.caso.estado === "TruePositive");
    const h = html(d);

    for (const titulo of ["Resumen", "Línea de tiempo", `Caso #${d.caso!.number}`, "Todos los campos"]) {
      expect(h).toContain(titulo);
    }
    expect(contar(h, "<details")).toBe(2); // "Otras tareas" y "Todos los campos"
    expect(h).not.toMatch(/<details[^>]* open/); // ambos plegados
  });

  it("resumen: tipo, antigüedad, SLA 'No aplica' y caso", async () => {
    const d = await detalleDe((f) => f.caso?.estado === "TruePositive");
    const h = html(d);
    expect(h).toContain("Tipo de amenaza");
    expect(h).toContain("Antigüedad");
    expect(h).toContain("No aplica (la alerta no está sin atender)");
    expect(h).toContain("Cerrado · Confirmado");
  });

  it("caso: estado, resolución, asignado y tareas de contención primero, con 'Otras tareas (N)' plegado", async () => {
    const d = await detalleDe((f) => f.caso?.estado === "TruePositive");
    const h = html(d);
    expect(h).toContain("Resolución");
    expect(h).toContain("Confirmado");
    expect(h).toContain("Asignado a");
    expect(h).toContain("Tareas de contención");
    expect(h).toMatch(/Otras tareas \(\d+\)/);
    expect(h.indexOf("Tareas de contención")).toBeLessThan(h.indexOf("Otras tareas"));
  });

  it("línea de tiempo: eventos con fecha real y el tiempo desde la alerta", async () => {
    const d = await detalleDe((f) => f.caso?.estado === "TruePositive");
    const h = html(d);
    expect(h).toContain("Alerta creada");
    expect(h).toContain(formatoFechaHora(d.alerta._createdAt));
    expect(h).toContain("Convertida en caso");
    expect(h).toContain("Caso #" + d.caso!.number + " cerrado");
    expect(h).toMatch(/\+[^<]* desde la alerta/);
    expect(h).not.toContain("<em>pendiente</em>"); // todas sus tareas están completadas
  });

  it("'Todos los campos': las fechas en hora de Bogotá y las etiquetas como chips", async () => {
    const d = await detalleDe((f) => f.caso?.estado === "TruePositive");
    const h = html(d);
    expect(h).toContain("_createdAt");
    expect(h).toContain(formatoFechaHora(d.alerta._createdAt));
    expect(h).toContain('<li class="etiqueta">simulacion</li>');
    expect(contar(h, "datos__clave")).toBe(26);
  });
});

describe("DetalleCompleto: otros casos", () => {
  it("caso abierto con tareas pendientes: aparecen como 'pendiente' sin hora", async () => {
    const d = await detalleDe((f) => f.caso?.etapa === "New");
    const h = html(d);
    expect(h).toContain("Tarea pendiente");
    expect(h).toContain("<em>pendiente</em>");
    expect(h).toContain("Aún sin resolver");
  });

  it("alerta sin caso: lo dice y no muestra tareas", async () => {
    const d = await detalleDe((f) => f.caso === null);
    const h = html(d);
    expect(h).toContain("Esta alerta no se ha convertido en caso.");
    expect(h).not.toContain("Tareas de contención");
    expect(contar(h, "<details")).toBe(1); // solo "Todos los campos"
  });

  it("alerta sin atender: el SLA muestra su estado, el límite y, si corresponde, el exceso", async () => {
    const dentro = await detalleDe((f) => f.sla.estado === "dentro");
    expect(html(dentro)).toMatch(/Dentro de SLA<\/span><span class="datos__secundario"> · límite/);

    const fuera = await detalleDe((f) => f.sla.estado === "fuera");
    const h = html(fuera);
    expect(h).toContain("Fuera de SLA");
    expect(h).toMatch(/excedido por/);
  });

  it("con caseId pero sin datos del caso: avisa que no está disponible", async () => {
    const d = await detalleDe((f) => f.caso !== null);
    const sinCaso: DetalleAlerta = { ...d, caso: null };
    expect(html(sinCaso)).toContain("El caso de esta alerta no está disponible.");
  });
});
