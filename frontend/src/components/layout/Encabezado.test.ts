import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Encabezado } from "./Encabezado";

const DATOS_DE = Date.UTC(2026, 10, 3, 20, 42); // 15:42 en Bogotá
const texto = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

function html(props: Partial<Parameters<typeof Encabezado>[0]>): string {
  return renderToStaticMarkup(
    createElement(Encabezado, { actualizadoEn: DATOS_DE, hayError: false, modoMock: false, thehive: null, datosDe: DATOS_DE, ...props }),
  );
}

describe("Encabezado", () => {
  it("TheHive conectado, completo", () => {
    const h = html({ thehive: { respondio: true, consultadoEn: DATOS_DE } });
    expect(texto(h)).toContain("TheHive conectado");
    expect(h).toContain("estado__conexion--conectado");
  });

  it("el backend no responde: 'Sin conexión con el servidor'", () => {
    const h = html({ hayError: true });
    expect(texto(h)).toContain("Sin conexión con el servidor");
    expect(h).toContain("estado__conexion--error");
  });

  it("TheHive no responde: la hora de los datos va en el mismo texto", () => {
    const h = html({ thehive: { respondio: false, consultadoEn: DATOS_DE + 60_000 } });
    expect(texto(h)).toContain("TheHive no responde · datos de las 15:42");
    expect(h).toContain("estado__conexion--sin-thehive");
    expect(texto(h)).not.toContain("Sin conexión con el servidor");
  });

  it("sigue mostrando la hora de actualización de Bogotá y 'cada 30 s'", () => {
    const t = texto(html({}));
    expect(t).toContain("Actualizado 15:42 (Bogotá)");
    expect(t).toContain("cada 30 s");
  });
});
