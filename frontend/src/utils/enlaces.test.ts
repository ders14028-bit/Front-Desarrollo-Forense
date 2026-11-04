import { describe, expect, it } from "vitest";
import { urlAlertaTheHive, urlCasoTheHive } from "./enlaces";

describe("enlaces a TheHive", () => {
  it("arman la URL con la base y la ruta de la alerta o del caso", () => {
    expect(urlAlertaTheHive("~4513920", "https://thehive.local:8445")).toBe("https://thehive.local:8445/alerts/~4513920/details");
    expect(urlCasoTheHive("~8196096", "https://thehive.local:8445")).toBe("https://thehive.local:8445/cases/~8196096/details");
  });

  it("ignoran las barras finales y los espacios de la base", () => {
    expect(urlAlertaTheHive("~1", "https://thehive.local/")).toBe("https://thehive.local/alerts/~1/details");
    expect(urlAlertaTheHive("~1", "https://thehive.local///")).toBe("https://thehive.local/alerts/~1/details");
    expect(urlAlertaTheHive("~1", "  https://thehive.local  ")).toBe("https://thehive.local/alerts/~1/details");
  });

  it("codifican el id para que no rompa la ruta", () => {
    expect(urlAlertaTheHive("a/b c?d", "https://x")).toBe("https://x/alerts/a%2Fb%20c%3Fd/details");
  });

  it("sin base definida no hay enlace (null)", () => {
    expect(urlAlertaTheHive("~1", null)).toBeNull();
    expect(urlCasoTheHive("~1", null)).toBeNull();
    expect(urlAlertaTheHive("~1", "")).toBeNull();
    expect(urlAlertaTheHive("~1", "   ")).toBeNull();
  });

  it("una base que no es una URL http(s) válida tampoco da enlace", () => {
    expect(urlAlertaTheHive("~1", "no es una url")).toBeNull();
    expect(urlAlertaTheHive("~1", "javascript:alert(1)")).toBeNull();
    expect(urlCasoTheHive("~1", "ftp://thehive.local")).toBeNull();
  });
});
