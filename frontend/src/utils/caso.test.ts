import { describe, expect, it } from "vitest";
import { GRUPO_CONTENCION } from "../config";
import type { Tarea } from "../types/tarea";
import { separarTareas } from "./caso";

const tarea = (id: string, group: string): Tarea => ({
  _id: id,
  _type: "task",
  _createdAt: 1,
  title: id,
  group,
  status: "Waiting",
});

describe("separarTareas", () => {
  it("las de contención van aparte y el resto en 'otras', cada grupo en su orden", () => {
    const r = separarTareas([
      tarea("a", "Análisis"),
      tarea("b", GRUPO_CONTENCION),
      tarea("c", "Erradicación"),
      tarea("d", GRUPO_CONTENCION),
    ]);
    expect(r.contencion.map((t) => t._id)).toEqual(["b", "d"]);
    expect(r.otras.map((t) => t._id)).toEqual(["a", "c"]);
  });

  it("sin tareas, ambas listas vacías", () => {
    expect(separarTareas([])).toEqual({ contencion: [], otras: [] });
  });
});
