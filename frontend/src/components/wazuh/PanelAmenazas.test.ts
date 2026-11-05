import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { crearFuenteMock } from "../../api/mock";
import { ErrorApi } from "../../api/tipos";
import type { ResultadoWazuh } from "../../hooks/useWazuh";
import { generarMetricasWazuh } from "../../mocks/wazuh";
import type { MetricasWazuh } from "../../types/wazuh";
import { PanelAmenazas } from "./PanelAmenazas";

const AHORA = Date.UTC(2026, 10, 3, 20, 42); // 15:42 en Bogotá

function html(resultado: Partial<ResultadoWazuh>): string {
  const completo: ResultadoWazuh = {
    datos: null,
    cargando: false,
    error: null,
    actualizadoEn: AHORA,
    reintentar: () => {},
    ...resultado,
  };
  return renderToStaticMarkup(createElement(PanelAmenazas, { resultado: completo }));
}

const texto = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const listo = (): MetricasWazuh => generarMetricasWazuh(AHORA);

describe("PanelAmenazas: estados", () => {
  it("primera carga: 'Cargando datos de Wazuh…' sin porcentaje", () => {
    const h = html({ cargando: true });
    expect(texto(h)).toContain("Cargando datos de Wazuh…");
    expect(texto(h)).not.toContain("%");
    expect(h).toContain('role="status"');
    expect(h).not.toContain("<progress");
  });

  it("el backend cargando: 'Cargando datos de Wazuh… N %' con barra, y ninguna cifra", () => {
    const h = html({ datos: generarMetricasWazuh(AHORA, { cargando: true }) });
    expect(texto(h)).toContain("Cargando datos de Wazuh… 40 %");
    expect(h).toContain('<progress class="carga-wazuh__barra" value="40" max="100"');
    expect(h).not.toContain("tacticas");
    expect(h).not.toContain("tarjeta");
    expect(h).not.toMatch(/\b0 alertas\b/);
  });

  it("cargando sin progreso aún: nunca '0 %'", () => {
    for (const progreso of [null, 0, 0.4]) {
      const h = html({ datos: { ...generarMetricasWazuh(AHORA, { cargando: true }), progreso } });
      expect(texto(h)).toContain("Cargando datos de Wazuh…");
      expect(texto(h)).not.toContain("%");
      expect(h).not.toContain("<progress");
    }
  });

  it("nunca muestra 100 % mientras carga", () => {
    const h = html({ datos: { ...generarMetricasWazuh(AHORA, { cargando: true }), progreso: 100 } });
    expect(texto(h)).toContain("99 %");
  });

  it("error sin datos: mensaje claro con 'Reintentar'", () => {
    const h = html({ error: new ErrorApi("No se pudo conectar con el servidor.") });
    expect(texto(h)).toContain("No se pudieron cargar los datos");
    expect(texto(h)).toContain("Reintentar");
  });

  it("error con datos previos: los datos siguen visibles con un aviso", () => {
    const h = html({ datos: listo(), error: new ErrorApi("sin red"), actualizadoEn: AHORA });
    expect(texto(h)).toContain("No se pudo actualizar. Mostrando datos de las 15:42");
    expect(texto(h)).toContain("Acceso a credenciales");
  });

  it("listo pero sin ninguna alerta: frase que explica, sin tarjetas", () => {
    const h = html({ datos: { ...listo(), alertasAnalizadas: 0 } });
    expect(texto(h)).toContain("Aún no hay alertas de Wazuh con detalle en los últimos 7 días");
    expect(h).not.toContain("tacticas");
  });

  it("TheHive no respondió en la última actualización: lo dice con la hora de los datos", () => {
    const h = html({ datos: { ...listo(), thehive: { respondio: false, consultadoEn: AHORA + 60_000 } } });
    expect(texto(h)).toContain("TheHive no respondió en la última actualización: se muestran los datos de las 15:42");
  });
});

describe("PanelAmenazas: contenido", () => {
  const h = html({ datos: listo() });

  it("título con los días de la ventana", () => {
    expect(texto(h)).toContain("Amenazas y cumplimiento (últimos 7 días)");
  });

  it("1. tácticas con su nombre con tildes y la frase de negocio al lado", () => {
    expect(texto(h)).toContain("Acceso a credenciales");
    expect(texto(h)).toContain("Intentos de adivinar o robar contraseñas.");
    expect(texto(h)).toContain("Evasión de defensas");
    expect(texto(h)).toContain("Intentos de esconderse o apagar las protecciones para pasar desapercibido.");
    expect(h).toContain('class="tactica__frase"');
    expect(texto(h)).toContain("9.870"); // es-CO
  });

  it("2. cumplimiento: los cinco marcos, cuántas alertas tocan y 3 requisitos como máximo", () => {
    for (const marco of ["PCI DSS", "NIST 800-53", "GDPR", "HIPAA", "TSC"]) expect(texto(h)).toContain(marco);
    expect(texto(h)).toContain("14.960");
    expect(texto(h)).toContain("Requisitos más afectados");
    const pci = h.split('class="marco"')[1].split('class="marco"')[0];
    expect(pci.match(/class="marco__requisito"/g)).toHaveLength(3);
    expect(pci).toContain("10.2.4");
  });

  it("3. top 5 de IPs y de usuarios (aunque el backend mande 6)", () => {
    expect(texto(h)).toContain("Top 5 IPs de origen");
    expect(texto(h)).toContain("203.0.113.45");
    expect(texto(h)).not.toContain("192.0.2.12"); // la sexta
    expect(texto(h)).toContain("Top 5 usuarios intentados");
    expect(texto(h)).toContain("root");
    expect(texto(h)).not.toContain("postgres"); // el sexto
  });

  it("4. top 5 de reglas con descripción y nivel", () => {
    expect(texto(h)).toContain("Top 5 reglas de Wazuh");
    expect(texto(h)).toContain("Regla 5710");
    expect(texto(h)).toContain("Nivel 5");
    expect(texto(h)).not.toContain("Regla 67018"); // la sexta
  });

  it("las reglas del diccionario se muestran en español con el original en inglés como texto secundario", () => {
    expect(texto(h)).toContain("sshd: intento de inicio de sesión con un usuario que no existe");
    expect(texto(h)).toContain("Original: sshd: Attempt to login using a non-existent user");
    expect(h).toContain('<p class="regla__original" lang="en">Original: sshd: Attempt to login using a non-existent user</p>');
    expect(texto(h)).toContain("PAM: falló el inicio de sesión de un usuario");
  });

  it("una regla sin traducción se muestra en inglés, marcada como inglés y sin 'Original:'", () => {
    const m = listo();
    const salida = html({ datos: { ...m, topReglas: [{ id: "60106", descripcion: "Windows Logon Success", nivel: 3, cantidad: 415 }] } });
    expect(salida).toContain('<p class="regla__descripcion" lang="en">Windows Logon Success</p>');
    expect(salida).not.toContain("regla__original");
  });

  it("dice con cuántas alertas se calculó y cuántas no traían detalle", () => {
    expect(texto(h)).toContain("Basado en 18.420 alertas de Wazuh de los últimos 7 días · 37 sin detalle para analizar");
  });

  it("una táctica que no está en config/ se muestra sin inventarle una frase", () => {
    const m = listo();
    const raro = { ...m, mitre: { ...m.mitre!, tacticas: [{ clave: "tactica-nueva", cantidad: 5 }] } };
    const salida = html({ datos: raro });
    expect(texto(salida)).toContain("Tactica nueva");
    expect(salida).not.toContain("tactica__frase");
  });

  it("un marco sin alertas lo dice y va al final", () => {
    const m = listo();
    const sinNist = { ...m, cumplimiento: m.cumplimiento!.map((c) => (c.marco === "nist_800_53" ? { ...c, alertas: 0, requisitos: [] } : c)) };
    const salida = html({ datos: sinNist });
    expect(texto(salida)).toContain("Ninguna alerta toca este marco");
    const orden = [...salida.matchAll(/class="marco__nombre">([^<]+)</g)].map((x) => x[1]);
    expect(orden[orden.length - 1]).toBe("NIST 800-53");
  });

  it("listas vacías: frases que explican, no ceros", () => {
    const m = listo();
    const salida = html({ datos: { ...m, topIps: [], topUsuarios: [], topReglas: [], mitre: { tacticas: [], tecnicas: [] } } });
    expect(texto(salida)).toContain("Ninguna alerta trae IP de origen");
    expect(texto(salida)).toContain("Ninguna alerta trae usuario intentado");
    expect(texto(salida)).toContain("Ninguna alerta trae regla");
    expect(texto(salida)).toContain("Ninguna alerta trae una táctica MITRE");
  });

  it("las IP del mock son de documentación (nada real en el repo)", () => {
    const ips = listo().topIps!.map((i) => i.ip);
    for (const ip of ips) expect(ip).toMatch(/^(192\.0\.2|198\.51\.100|203\.0\.113)\./);
  });
});

describe("mock de Wazuh", () => {
  it("devuelve la forma del contrato", async () => {
    const fuente = crearFuenteMock({ ahora: () => AHORA, demoraMs: 0, falla: false });
    const m = await fuente.obtenerMetricasWazuh();

    expect(m.estado).toBe("listo");
    expect(m.dias).toBe(7);
    expect(m.desde).toBe("2026-10-28");
    expect(m.thehive).toEqual({ respondio: true, consultadoEn: AHORA });
    expect(m.cumplimiento!.map((c) => c.marco)).toEqual(["pci_dss", "nist_800_53", "gdpr", "hipaa", "tsc"]);
    expect(m.cumplimiento!.every((c) => c.requisitos.length <= 3)).toBe(true);
  });

  it("con wazuhCargando devuelve el estado cargando con las métricas en null", async () => {
    const fuente = crearFuenteMock({ ahora: () => AHORA, demoraMs: 0, falla: false, wazuhCargando: true });
    const m = await fuente.obtenerMetricasWazuh();

    expect(m.estado).toBe("cargando");
    expect(m.progreso).toBe(40);
    expect(m.mitre).toBeNull();
    expect(m.cumplimiento).toBeNull();
    expect(m.topIps).toBeNull();
    expect(m.topUsuarios).toBeNull();
    expect(m.topReglas).toBeNull();
    expect(m.alertasAnalizadas).toBeNull();
  });

  it("con falla=true rechaza con un ErrorApi", async () => {
    const fuente = crearFuenteMock({ demoraMs: 0, falla: true });
    await expect(fuente.obtenerMetricasWazuh()).rejects.toBeInstanceOf(ErrorApi);
  });
});
