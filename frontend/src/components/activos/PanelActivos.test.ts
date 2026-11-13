import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { crearFuenteHttp } from "../../api/http";
import { crearFuenteMock } from "../../api/mock";
import { ErrorApi } from "../../api/tipos";
import type { ResultadoActivos } from "../../hooks/useActivos";
import { generarActivos } from "../../mocks/activos";
import type { FiltroActivos } from "../../utils/activos";
import { PanelActivos } from "./PanelActivos";

const AHORA = Date.UTC(2026, 10, 3, 20, 42); // 15:42 en Bogotá

function html(resultado: Partial<ResultadoActivos>, filtroInicial?: FiltroActivos): string {
  const completo: ResultadoActivos = {
    datos: null,
    cargando: false,
    error: null,
    actualizadoEn: AHORA,
    reintentar: () => {},
    ...resultado,
  };
  return renderToStaticMarkup(createElement(PanelActivos, { resultado: completo, filtroInicial }));
}

const texto = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

describe("PanelActivos: estados", () => {
  it("primera carga: título y 'Cargando…' sin porcentaje", () => {
    const h = html({ cargando: true });
    // sin respuesta aún no se sabe la ventana: el título va solo, sin inventar el número
    expect(texto(h)).toContain("Activos atacados");
    expect(texto(h)).not.toContain("últimos");
    expect(texto(h)).toContain("Cargando datos de Wazuh…");
    expect(texto(h)).not.toContain("%");
  });

  it("el backend cargando: progreso real y ninguna cifra; nunca '0 %'", () => {
    const h = html({ datos: generarActivos(AHORA, { cargando: true }) });
    expect(texto(h)).toContain("Cargando datos de Wazuh… 40 %");
    expect(h).not.toContain("activos-tipo");
    for (const progreso of [null, 0]) {
      expect(texto(html({ datos: { ...generarActivos(AHORA, { cargando: true }), progreso } }))).not.toContain("%");
    }
  });

  it("error sin datos: mensaje y 'Reintentar'; error con datos: los datos siguen con aviso", () => {
    const sin = html({ error: new ErrorApi("No se pudo conectar") });
    expect(texto(sin)).toContain("No se pudieron cargar los datos");
    expect(texto(sin)).toContain("Reintentar");

    const con = html({ datos: generarActivos(AHORA), error: new ErrorApi("No se pudo conectar") });
    expect(texto(con)).toContain("No se pudo actualizar. Mostrando datos de las");
    expect(texto(con)).toContain("Activos más atacados");
  });

  it("sin activos: frase que explica por qué, sin tabla", () => {
    const h = html({ datos: { ...generarActivos(AHORA), activos: [] } });
    expect(texto(h)).toContain("Aún no hay activos con alertas de Wazuh en los últimos 14 días");
    expect(h).not.toContain("<table");
  });

  it("filtro sin resultados: 'Limpiar filtro'", () => {
    const h = html({ datos: generarActivos(AHORA) }, { tipo: null, equipo: "no-existe" });
    expect(texto(h)).toContain("Ningún activo coincide con el filtro.");
    expect(texto(h)).toContain("Limpiar filtro");
    expect(h).not.toContain("<table");
  });
});

describe("PanelActivos: contenido", () => {
  const datos = generarActivos(AHORA);

  it("los días del título y de los textos salen de la respuesta", () => {
    expect(texto(html({ datos }))).toContain("Activos atacados (últimos 14 días)");
    expect(texto(html({ datos: { ...datos, ventanaDias: 30 } }))).toContain("Activos atacados (últimos 30 días)");
    expect(texto(html({ datos: { ...generarActivos(AHORA, { cargando: true }), ventanaDias: 21 } }))).toContain("(últimos 21 días)");
    const vacio = texto(html({ datos: { ...datos, ventanaDias: 30, activos: [] } }));
    expect(vacio).toContain("en los últimos 30 días");
    expect(vacio).not.toContain("14");
  });

  it("frase, tarjetas por tipo, tabla y componentes con los datos", () => {
    const t = texto(html({ datos }));
    expect(t).toContain("El activo con más alertas altas y críticas es Servidor web: 45 de 543. Lo más atacado es Servidor web: 412 alertas.");
    expect(t).toContain("Base de datos · 1");
    expect(t).toContain("Windows · 2");
    expect(t).toContain("2 servidores");
    expect(t).toContain("Activos más atacados");
    expect(t).toContain("Componentes atacados");
    expect(t).toContain("Acceso remoto (SSH)");
    expect(t).toContain("3 alertas no traen el equipo de origen");
  });

  it("los filtros son accesibles: aria-pressed y selector con etiqueta", () => {
    const h = html({ datos });
    expect(h).toMatch(/<button type="button" class="activos-filtro__boton" aria-pressed="false">/);
    const id = /<label for="([^"]+)" class="activos-filtro__etiqueta">Equipo<\/label>/.exec(h)?.[1];
    expect(id).toBeTruthy();
    expect(h).toContain(`<select id="${id}"`);
    expect(h).toMatch(/<button type="button" class="boton boton--secundario" disabled="">Limpiar<\/button>/);
  });

  it("con un tipo elegido: su botón y su tarjeta quedan marcados y solo salen sus activos", () => {
    const h = html({ datos }, { tipo: "windows", equipo: null });
    expect(h).toMatch(/aria-pressed="true">Windows · 2</);
    expect(h).toMatch(/class="activos-tipo" aria-pressed="true" aria-label="Windows:/);
    const t = texto(h);
    expect(t).toContain("El activo con más alertas altas y críticas es Servidor Windows 1:");
    expect(t).not.toContain("Servidor de base de datos 188");
    expect(h).not.toContain("srv-web-demo");
  });

  it("la fila muestra el nombre visible y debajo el técnico; el componente principal en español", () => {
    const h = html({ datos }, { tipo: null, equipo: "102" });
    expect(h).toContain("Servidor de base de datos</button><span class=\"activos-tecnico\">srv-datos-demo</span>");
    expect(texto(h)).toContain("Base de datos");
    expect(h).toContain("activos-fila--elegida");
  });

  it("'Otros' va al final de la gráfica y en gris", () => {
    const h = html({ datos });
    const otros = h.indexOf("activos-componente--otros");
    expect(otros).toBeGreaterThan(h.lastIndexOf("Monitoreo (Wazuh)"));
  });

  it("nunca muestra IPs ni usuarios", () => {
    expect(html({ datos })).not.toMatch(/\b\d{1,3}(\.\d{1,3}){3}\b/);
  });
});

describe("PanelActivos: último ataque y ataques recientes", () => {
  const datos = generarActivos(AHORA);
  const conTexto = (d = datos, filtro?: FiltroActivos) => texto(html({ datos: d }, filtro));

  it("la tabla tiene la columna 'Último ataque' con fecha de Bogotá y 'hace N'; '—' si no tiene", () => {
    const h = html({ datos });
    expect(h).toContain('<th scope="col">Último ataque</th>');
    // servidor web: su ataque más reciente fue hace 25 min = 15:17 en Bogotá
    expect(h).toContain('<span class="activos-ultimo__fecha">3 nov, 15:17</span><span class="activos-tecnico">hace 25 min</span>');
    // el servidor de monitoreo no tiene ataques altos o críticos
    expect(h).toContain('<span aria-hidden="true">—</span><span class="solo-lectores">Sin ataques altos o críticos</span>');
  });

  it("en la tarjeta del celular hay una línea más con el último ataque", () => {
    const t = conTexto();
    expect(t).toContain("Último ataque: 3 nov, 15:17 (hace 25 min)");
    expect(t).toContain("Último ataque: — Sin ataques altos o críticos");
  });

  it("'hace N' sale de la hora del resumen, no del reloj del navegador", () => {
    // el reloj real está años después del resumen simulado y aun así dice "hace 25 min"
    expect(conTexto()).toContain("hace 25 min");
    const ayer = generarActivos(AHORA + 86_400_000);
    expect(conTexto(ayer)).toContain("hace 1 día");
  });

  it("'Ataques recientes' va debajo de la tabla y antes de 'Componentes atacados'", () => {
    const h = html({ datos });
    const tabla = h.indexOf("Activos más atacados");
    const ataques = h.indexOf("Ataques recientes");
    const componentes = h.indexOf("Componentes atacados");
    expect(tabla).toBeGreaterThan(-1);
    expect(ataques).toBeGreaterThan(tabla);
    expect(componentes).toBeGreaterThan(ataques);
  });

  it("cada ataque trae fecha, activo, componente, severidad con texto, descripción y veces", () => {
    const t = conTexto();
    expect(t).toContain("3 nov, 15:17 hace 25 min Servidor web · Acceso remoto (SSH) Alta sshd: ataque de fuerza bruta para entrar al sistema (usuario que no existe) 6 veces desde 3 nov, 09:17");
    expect(t).toContain("Crítica"); // texto además del color
    expect(t).toContain("Archivo ejecutable creado en una carpeta que el malware suele usar"); // traducida por texto
    expect(t).toContain("MariaDB: multiple authentication failures."); // sin traducción: la original
  });

  it("muestra 10 y un botón 'Ver más' accesible con aria-expanded", () => {
    const h = html({ datos });
    expect(h.match(/class="ataque /g)).toHaveLength(10);
    expect(h).toMatch(/<button type="button" class="boton boton--secundario ataques__mas" aria-expanded="false" aria-controls="[^"]+">Ver más \(5 más\)<\/button>/);
  });

  it("con 10 o menos no hay botón 'Ver más'", () => {
    const pocos = { ...datos, ataquesRecientes: datos.ataquesRecientes!.slice(0, 6) };
    const h = html({ datos: pocos });
    expect(h.match(/class="ataque /g)).toHaveLength(6);
    expect(h).not.toContain("Ver más");
  });

  it("respeta el filtro de la sección (tipo y equipo)", () => {
    const tipo = html({ datos }, { tipo: "windows", equipo: null });
    expect(tipo.match(/class="ataque /g)).toHaveLength(4);
    expect(texto(tipo)).not.toContain("Servidor web ·");
    const equipo = html({ datos }, { tipo: null, equipo: "105" });
    expect(equipo.match(/class="ataque /g)).toHaveLength(1);
    expect(texto(equipo)).toContain("Estación de trabajo Linux · Vulnerabilidades y software");
  });

  it("vacío: mensaje con la ventana configurada, sin inventar ataques", () => {
    const sin = { ...datos, ataquesRecientes: [] };
    expect(conTexto(sin)).toContain("No hay ataques altos o críticos en los últimos 14 días");
    expect(conTexto({ ...sin, ventanaDias: 30 })).toContain("No hay ataques altos o críticos en los últimos 30 días");
    expect(html({ datos: sin })).not.toContain("ataques__mas");
  });

  it("filtro sin ataques pero con ataques en general: lo dice", () => {
    // la estación solo tiene uno; con otro equipo elegido sin ataques (monitoreo), el vacío es por el filtro
    const t = conTexto(datos, { tipo: null, equipo: "100" });
    expect(t).toContain("No hay ataques altos o críticos en los últimos 14 días con el filtro elegido");
  });

  it("mientras carga no hay bloque de ataques (null, no lista vacía)", () => {
    const t = conTexto(generarActivos(AHORA, { cargando: true }));
    expect(t).not.toContain("Ataques recientes");
    expect(t).not.toContain("No hay ataques");
  });

  it("nunca muestra IPs, ni la descripción con <ip> sin escapar", () => {
    const conIp = {
      ...datos,
      ataquesRecientes: [{ ...datos.ataquesRecientes![0], reglaId: "9999", descripcion: "Login from <ip> failed" }],
    };
    const h = html({ datos: conIp });
    expect(h).toContain("Login from &lt;ip&gt; failed");
    expect(h).not.toMatch(/\b\d{1,3}(\.\d{1,3}){3}\b/);
  });
});

describe("obtenerActivos", () => {
  it("el mock devuelve la misma forma; los componentes suman las alertas", async () => {
    const r = await crearFuenteMock({ ahora: () => AHORA, demoraMs: 0, falla: false }).obtenerActivos();
    expect(r.estado).toBe("listo");
    for (const a of r.activos!) {
      expect(a.componentes.reduce((s, c) => s + c.alertas, 0)).toBe(a.alertas);
    }
  });

  it("http pide /api/dashboard/activos y rechaza respuestas sin la forma esperada", async () => {
    const json = (cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status: 200 });
    const fetchFn = vi.fn().mockResolvedValue(json(generarActivos(AHORA)));
    await crearFuenteHttp("http://b/", { fetchFn }).obtenerActivos();
    expect(fetchFn.mock.calls[0][0]).toBe("http://b/api/dashboard/activos");

    const malo = crearFuenteHttp("http://b", { fetchFn: vi.fn().mockResolvedValue(json({ estado: "listo", activos: null })) });
    await expect(malo.obtenerActivos()).rejects.toThrow(/formato esperado/);
  });
});
