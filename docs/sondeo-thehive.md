# Hallazgos del sondeo de TheHive (paso 0 del backend)

Resultado del sondeo de solo lectura contra el TheHive del laboratorio (`backend/scripts/sondeo-thehive.ps1`,
4–5 nov. 2026). Son decisiones de implementación del backend; cada una tiene que quedar cubierta por un test.

## Conclusiones que el backend debe aplicar

1. **`_has case` NO sirve:** devuelve todas las alertas aunque no haya casos. "Alertas convertidas" =
   `count` con `status = Imported`. Un test lo documenta y un comentario en el código impide volver a usarlo.
2. **Agregaciones por campo:** sin `_size` TheHive devuelve solo 100 valores. Se manda SIEMPRE un `_size`
   explícito (1000). Si la respuesta llega al tope, se registra una advertencia en el log y se marca en la
   respuesta: no se trunca en silencio. Vale para toda agregación por campo (`tags`, `source`, …).
3. **`getAlert` / `getCase` con un id inexistente responden HTTP 200** (no 404): el 404 del detalle se decide por
   resultado vacío.
4. **`avg` funciona:** antigüedad promedio = `ahora − avg(_createdAt)` de las alertas `New`, con el filtro de
   simulaciones aplicado.
5. **`_between`:** `_from` inclusivo y `_to` exclusivo. Se usa `_gte` + `_lt` para los días de Bogotá.
6. **`slaStates` no está configurado** en este TheHive: se ignora; se usa nuestro SLA (`/configuracion`).
7. **Simulaciones:** se excluyen con `_ne type simulacion`. Las pruebas manuales (`type = external`) no se
   filtran por código: se borran a mano antes de la presentación.
8. **Una sola página de 1000 alertas** tarda ≈ 0,9 s: la lista puede pedirla en una sola consulta.

## Cifras reales esperadas en la prueba de humo (sin simulaciones)

| Campo | Valor esperado |
|---|---|
| recibidas | 23148 |
| sin atender | 23148 |
| críticas y altas | 1613 |
| fuera de SLA (crítica / alta / media / baja) | 25 / 1588 / 501 / 19920 |
| sin atender más antigua | ≈ 5,06 días |
| casos | 0 |

Las cifras cambian con el tiempo (llegan alertas nuevas y el fuera de SLA crece); sirven para comprobar el orden de
magnitud y que no falte nada.
