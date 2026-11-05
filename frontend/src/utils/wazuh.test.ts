import { describe, expect, it } from "vitest";
import { crearFuenteHttp } from "../api/http";
import { ErrorApi } from "../api/tipos";
import { DESCRIPCION_MARCOS, FRASES_TACTICAS, NOMBRES_MARCOS, TRADUCCIONES_POR_TEXTO, TRADUCCIONES_REGLAS } from "../config/wazuh";
import { NOMBRES_LEGIBLES } from "../config";
import { describirRegla, filasTacticas, marcosOrdenados, nombreMarco, primeros, textoCargaWazuh } from "./wazuh";

// Las 14 tácticas de MITRE ATT&CK tal como las manda el backend (TacticasMitre.java): ASCII, en español.
const CLAVES_DEL_BACKEND = [
  "reconocimiento",
  "desarrollo-de-recursos",
  "acceso-inicial",
  "ejecucion",
  "persistencia",
  "escalada-de-privilegios",
  "evasion-de-defensas",
  "acceso-a-credenciales",
  "descubrimiento",
  "movimiento-lateral",
  "recoleccion",
  "comando-y-control",
  "exfiltracion",
  "impacto",
];

describe("config/wazuh", () => {
  it("las 14 tácticas tienen su frase de negocio y su nombre con tildes", () => {
    for (const clave of CLAVES_DEL_BACKEND) {
      expect(FRASES_TACTICAS[clave], clave).toBeTruthy();
      expect(NOMBRES_LEGIBLES[clave], clave).toBeTruthy();
    }
    expect(Object.keys(FRASES_TACTICAS).sort()).toEqual([...CLAVES_DEL_BACKEND].sort());
  });

  it("la frase de 'Acceso a credenciales' es la acordada", () => {
    expect(FRASES_TACTICAS["acceso-a-credenciales"]).toBe("Intentos de adivinar o robar contraseñas.");
  });

  it("los cinco marcos tienen nombre y descripción", () => {
    expect(Object.keys(NOMBRES_MARCOS)).toEqual(["pci_dss", "nist_800_53", "gdpr", "hipaa", "tsc"]);
    expect(Object.keys(DESCRIPCION_MARCOS)).toEqual(Object.keys(NOMBRES_MARCOS));
  });
});

describe("filasTacticas", () => {
  it("de mayor a menor, con nombre legible y frase", () => {
    const filas = filasTacticas([
      { clave: "persistencia", cantidad: 5 },
      { clave: "acceso-a-credenciales", cantidad: 90 },
      { clave: "evasion-de-defensas", cantidad: 5 },
    ]);

    expect(filas.map((f) => f.clave)).toEqual(["acceso-a-credenciales", "evasion-de-defensas", "persistencia"]);
    expect(filas[0]).toMatchObject({ etiqueta: "Acceso a credenciales", cantidad: 90 });
    expect(filas[0].frase).toBe("Intentos de adivinar o robar contraseñas.");
  });

  it("una táctica desconocida no lleva frase inventada", () => {
    expect(filasTacticas([{ clave: "otra-cosa", cantidad: 1 }])[0].frase).toBeUndefined();
  });

  it("no modifica la lista original", () => {
    const original = [{ clave: "b", cantidad: 1 }, { clave: "a", cantidad: 2 }];
    filasTacticas(original);
    expect(original[0].clave).toBe("b");
  });
});

describe("marcos y listas", () => {
  it("nombreMarco usa el de config y, si no lo conoce, el id en mayúsculas", () => {
    expect(nombreMarco("nist_800_53")).toBe("NIST 800-53");
    expect(nombreMarco("iso_27001")).toBe("ISO_27001");
  });

  it("los marcos sin alertas van al final y el resto conserva su orden", () => {
    const m = (marco: string, alertas: number) => ({ marco: marco as never, alertas, requisitos: [] });
    expect(marcosOrdenados([m("pci_dss", 0), m("nist_800_53", 5), m("gdpr", 0), m("hipaa", 2)]).map((x) => x.marco)).toEqual([
      "nist_800_53",
      "hipaa",
      "pci_dss",
      "gdpr",
    ]);
  });

  it("primeros recorta a 5 por defecto", () => {
    expect(primeros([1, 2, 3, 4, 5, 6, 7])).toEqual([1, 2, 3, 4, 5]);
    expect(primeros([1, 2])).toEqual([1, 2]);
  });
});

describe("textoCargaWazuh", () => {
  it("el porcentaje solo aparece cuando es real y nunca es 0 ni 100", () => {
    expect(textoCargaWazuh(41)).toBe("Cargando datos de Wazuh… 41 %");
    expect(textoCargaWazuh(41.9)).toBe("Cargando datos de Wazuh… 41 %");
    expect(textoCargaWazuh(100)).toBe("Cargando datos de Wazuh… 99 %");
    expect(textoCargaWazuh(null)).toBe("Cargando datos de Wazuh…");
    expect(textoCargaWazuh(0)).toBe("Cargando datos de Wazuh…");
    expect(textoCargaWazuh(0.9)).toBe("Cargando datos de Wazuh…");
  });
});

describe("cliente HTTP de Wazuh", () => {
  const respuesta = (cuerpo: unknown, status = 200) => async () => new Response(JSON.stringify(cuerpo), { status });

  it("pide /api/dashboard/wazuh y devuelve las métricas", async () => {
    let pedida = "";
    const fuente = crearFuenteHttp("http://localhost:8080/", {
      fetchFn: (async (url: string) => {
        pedida = url;
        return new Response(JSON.stringify({ estado: "cargando", progreso: 12, mitre: null }), { status: 200 });
      }) as unknown as typeof fetch,
    });

    const m = await fuente.obtenerMetricasWazuh();

    expect(pedida).toBe("http://localhost:8080/api/dashboard/wazuh");
    expect(m.estado).toBe("cargando");
    expect(m.mitre).toBeNull();
  });

  it("rechaza una respuesta sin el formato esperado", async () => {
    const fuente = crearFuenteHttp("", { fetchFn: respuesta({ hola: 1 }) as unknown as typeof fetch });
    await expect(fuente.obtenerMetricasWazuh()).rejects.toThrow(/formato esperado/);
  });

  it("un 503 se explica en español (el backend aún no tiene datos)", async () => {
    const fuente = crearFuenteHttp("", { fetchFn: respuesta({}, 503) as unknown as typeof fetch });
    await expect(fuente.obtenerMetricasWazuh()).rejects.toBeInstanceOf(ErrorApi);
    await expect(fuente.obtenerMetricasWazuh()).rejects.toThrow(/error interno \(503\)/);
  });
});

describe("describirRegla", () => {
  it("las ocho reglas pedidas por id y la del malware por su texto tienen traducción", () => {
    expect(Object.keys(TRADUCCIONES_REGLAS).sort()).toEqual(["5501", "5502", "5503", "5551", "5710", "5712", "5760", "5763"]);
    expect(Object.keys(TRADUCCIONES_POR_TEXTO)).toEqual(["executable file dropped in folder commonly used by malware"]);
  });

  it("con traducción: la traducción es lo principal y el original en inglés queda aparte", () => {
    const r = describirRegla("5710", "sshd: Attempt to login using a non-existent user");
    expect(r.texto).toBe("sshd: intento de inicio de sesión con un usuario que no existe");
    expect(r.original).toBe("sshd: Attempt to login using a non-existent user");
  });

  it("la traducción sale por el id aunque Wazuh cambie un poco el texto", () => {
    expect(describirRegla("5503", "PAM: User login failed. (otra versión)").texto).toBe("PAM: falló el inicio de sesión de un usuario");
  });

  it("la de malware se encuentra por su texto, sin importar mayúsculas, espacios ni el punto final", () => {
    for (const texto of ["Executable file dropped in folder commonly used by malware", "executable  file dropped in folder commonly used by malware.", " EXECUTABLE FILE DROPPED IN FOLDER COMMONLY USED BY MALWARE "]) {
      expect(describirRegla("92213", texto).texto).toBe("Archivo ejecutable creado en una carpeta que el malware suele usar");
      expect(describirRegla("92213", texto).original).toBe(texto.trim());
    }
  });

  it("una regla que no está en el diccionario se muestra en inglés, sin original aparte", () => {
    expect(describirRegla("60106", "Windows Logon Success")).toEqual({ texto: "Windows Logon Success", original: null });
  });

  it("sin descripción: 'Sin descripción'; con id traducido y sin texto original, solo la traducción", () => {
    expect(describirRegla("99999", null)).toEqual({ texto: "Sin descripción", original: null });
    expect(describirRegla("99999", "   ")).toEqual({ texto: "Sin descripción", original: null });
    expect(describirRegla("5760", null)).toEqual({ texto: "sshd: falló la autenticación", original: null });
  });
});
