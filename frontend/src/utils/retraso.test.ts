import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crearRetraso } from "./retraso";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("crearRetraso (espera de 300 ms)", () => {
  it("avisa con el valor después de 300 ms, no antes", () => {
    const f = vi.fn();
    const r = crearRetraso<string>(300, f);

    r.programar("ab");
    vi.advanceTimersByTime(299);
    expect(f).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(f).toHaveBeenCalledTimes(1);
    expect(f).toHaveBeenCalledWith("ab");
  });

  it("cada llamada reinicia la espera y solo se avisa con el último valor, una vez", () => {
    const f = vi.fn();
    const r = crearRetraso<string>(300, f);

    r.programar("a");
    vi.advanceTimersByTime(200);
    r.programar("ab");
    vi.advanceTimersByTime(200);
    r.programar("abc");
    vi.advanceTimersByTime(299);
    expect(f).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(f).toHaveBeenCalledTimes(1);
    expect(f).toHaveBeenCalledWith("abc");
    vi.advanceTimersByTime(5000);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("ejecutarYa avisa de inmediato con lo pendiente y no vuelve a avisar después", () => {
    const f = vi.fn();
    const r = crearRetraso<string>(300, f);

    r.programar("hola");
    r.ejecutarYa();
    expect(f).toHaveBeenCalledTimes(1);
    expect(f).toHaveBeenCalledWith("hola");
    vi.advanceTimersByTime(1000);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("ejecutarYa sin nada pendiente no hace nada", () => {
    const f = vi.fn();
    const r = crearRetraso<string>(300, f);
    r.ejecutarYa();
    r.programar("x");
    vi.advanceTimersByTime(300);
    r.ejecutarYa(); // ya se avisó
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("cancelar descarta lo pendiente", () => {
    const f = vi.fn();
    const r = crearRetraso<string>(300, f);
    r.programar("x");
    r.cancelar();
    vi.advanceTimersByTime(1000);
    r.ejecutarYa();
    expect(f).not.toHaveBeenCalled();
  });

  it("se puede volver a usar después de avisar", () => {
    const f = vi.fn();
    const r = crearRetraso<number>(300, f);
    r.programar(1);
    vi.advanceTimersByTime(300);
    r.programar(2);
    vi.advanceTimersByTime(300);
    expect(f.mock.calls).toEqual([[1], [2]]);
  });
});
