import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { crearFuenteMock } from "../../api/mock";
import type { ListaAlertas } from "../../types/listaAlertas";
import { conFiltros, conOrden, conPagina, ESTADO_TABLA_INICIAL, FILTROS_VACIOS, type EstadoTabla } from "../../utils/tabla";
import { ListadoAlertas } from "./ListadoAlertas";

// Renderizado en servidor (sin navegador): comprueba el HTML de la primera página.

const AHORA = Date.UTC(2026, 10, 3, 15, 0);
const contar = (html: string, texto: string) => html.split(texto).length - 1;
const html = (lista: ListaAlertas, tabla: EstadoTabla = ESTADO_TABLA_INICIAL) =>
  renderToStaticMarkup(createElement(ListadoAlertas, { lista, tabla, dispatch: () => {} }));

async function listaMock(): Promise<ListaAlertas> {
  return crearFuenteMock({ ahora: () => AHORA, demoraMs: 0, falla: false }).listarAlertas();
}

describe("ListadoAlertas: con las 40 alertas del mock", () => {
  it("cabecera: 'N alertas · últimos 30 días'; el aviso de laboratorio ya no va en la lista (es uno general, en App)", async () => {
    const h = html(await listaMock());
    expect(h).toContain("40 alertas · últimos 30 días");
    expect(h).not.toContain("Datos de laboratorio");
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

describe("ListadoAlertas: barra de filtros (primer render)", () => {
  it("búsqueda con etiqueta, selector de orden con las 4 opciones y botón 'Filtros'", async () => {
    const h = html(await listaMock());
    expect(h).toContain('type="search"');
    expect(h).toContain("Buscar por título");
    for (const opcion of ["Prioridad (recomendado)", "Más recientes", "Más antiguas", "Severidad"]) {
      expect(h).toContain(`>${opcion}</option>`);
    }
    expect(h).toContain('aria-controls="');
    expect(contar(h, 'class="boton boton--secundario filtros__boton"')).toBe(1);
  });

  it("los cuatro selectores múltiples empiezan cerrados (aria-expanded=false, sin casillas)", async () => {
    const h = html(await listaMock());
    expect(contar(h, 'aria-expanded="false"')).toBeGreaterThanOrEqual(4);
    for (const titulo of ["Severidad", "Estado", "Herramienta", "Tipo de amenaza"]) {
      expect(h).toMatch(new RegExp(`selector-multiple__boton[^>]*>${titulo}`));
    }
    expect(h).not.toContain('type="checkbox"');
  });

  it("¿Tiene caso? y ¿Fuera de SLA? con Todos / Sí / No, y la fecha con sus 5 opciones, 'Todos' y '30 días' marcados", async () => {
    const h = html(await listaMock());
    expect(h).toContain("¿Tiene caso?");
    expect(h).toContain("¿Fuera de SLA?");
    expect(contar(h, 'type="radio"')).toBe(3 + 3 + 5);
    expect(contar(h, 'checked=""')).toBe(3); // Todos, Todos y 30 días
    for (const etiqueta of ["Hoy", "7 días", "14 días", "30 días", "Rango"]) {
      expect(h).toContain(`>${etiqueta}</span>`);
    }
    expect(h).not.toContain('type="date"'); // los calendarios solo aparecen con "Rango"
  });

  it("sin filtros no hay chips ni 'Limpiar filtros', y el botón es solo 'Filtros'", async () => {
    const h = html(await listaMock());
    expect(h).not.toContain("Filtros activos");
    expect(h).not.toContain("Limpiar filtros");
    expect(h).toMatch(/filtros__boton"[^>]*>Filtros</);
  });
});

describe("ListadoAlertas: se dibuja desde el estado que viene de App (así se conserva al cambiar de pestaña)", () => {
  it("con filtros y la página 2 ya aplicados, al montarse muestra exactamente eso", async () => {
    const lista = await listaMock();
    let tabla = conFiltros(ESTADO_TABLA_INICIAL, { ...FILTROS_VACIOS, estados: ["New"] }); // 26 sin atender
    tabla = conPagina(conOrden(tabla, "recientes"), 2);

    const h = html(lista, tabla);
    expect(h).toContain("26 de 40 alertas · últimos 30 días");
    expect(h).toContain("Mostrando 26 de 26");
    expect(h).toContain("Página 2 de 2");
    expect(h).toContain("Anterior");
    expect(h).not.toContain("Siguiente");
    expect(h).toContain("Estado: Sin atender"); // chip del filtro
    expect(h).toContain("Limpiar filtros");
    expect(h).toMatch(/<option value="recientes" selected="">Más recientes<\/option>/); // el orden elegido
    expect(contar(h, 'class="fila-alerta"')).toBe(1); // la única fila de la página 2
  });

  it("la búsqueda guardada reaparece en el cuadro de texto y como chip", async () => {
    const lista = await listaMock();
    const tabla = conFiltros(ESTADO_TABLA_INICIAL, { ...FILTROS_VACIOS, busqueda: "phishing" });
    const h = html(lista, tabla);
    expect(h).toContain('value="phishing"');
    expect(h).toContain("Título: “phishing”");
  });

  it("una página guardada que ya no existe se muestra como la última que sí existe", async () => {
    const lista = await listaMock();
    const h = html(lista, conPagina(ESTADO_TABLA_INICIAL, 9)); // solo hay 2 páginas
    expect(h).toContain("Página 2 de 2");
    expect(h).toContain("Mostrando 26–40 de 40");
  });
});

describe("ListadoAlertas: casos especiales", () => {
  const base: ListaAlertas = {
    generadoEn: AHORA,
    total: 0,
    truncado: false,
    composicion: { recientes: 0, criticasYAltasAdicionales: 0 },
    datosDeLaboratorio: false,
    alertas: [],
  };

  it("sin alertas en 30 días: mensaje claro y sin tabla ni paginación", () => {
    const h = html(base);
    expect(h).toContain("No hay alertas en los últimos 30 días");
    expect(h).toContain("0 alertas · últimos 30 días");
    expect(h).not.toContain("<table");
    expect(h).not.toContain("Mostrando");
  });

  it("si está truncada, avisa cuántas muestra y de cuántas", async () => {
    const lista = await listaMock();
    const h = html({
      ...lista,
      alertas: lista.alertas.slice(0, 3),
      total: 1500,
      truncado: true,
      composicion: { recientes: 3, criticasYAltasAdicionales: 0 },
    });
    expect(h).toContain("1.500 alertas · últimos 30 días");
    expect(h).toContain("Mostrando las 3 más recientes de 1.500 en los últimos 30 días");
  });

  it("si se añadieron críticas o altas sin atender más antiguas, el aviso lo dice", async () => {
    const lista = await listaMock();
    const h = html({
      ...lista,
      alertas: lista.alertas.slice(0, 5),
      total: 1500,
      truncado: true,
      composicion: { recientes: 3, criticasYAltasAdicionales: 2 },
    });
    expect(h).toContain("Mostrando las 3 alertas más recientes y, además, 2 críticas o altas sin atender más antiguas (de 1.500 en los últimos 30 días)");
  });

  it("si la lista está completa no hay aviso", async () => {
    const lista = await listaMock();
    expect(html(lista)).not.toContain("lista-aviso");
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
