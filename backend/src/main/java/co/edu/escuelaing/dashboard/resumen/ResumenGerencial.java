package co.edu.escuelaing.dashboard.resumen;

import java.util.List;

/**
 * Respuesta de {@code GET /api/dashboard/resumen}. Tiene EXACTAMENTE la forma de {@code ResumenGerencial} de
 * {@code docs/contrato-api.md} (y de los mocks del frontend), más {@code thehive} (cambio B del contrato).
 * Los {@code null} van explícitos en el JSON ("sin datos" ≠ "campo ausente"). Fechas y duraciones en milisegundos.
 */
public record ResumenGerencial(long generadoEn, boolean datosDeLaboratorio, ResumenAlertas alertas, ResumenCasos casos,
                               EstadoTheHive thehive) {

    public record ResumenAlertas(long recibidas, long sinAtender, long criticasYAltas, Long masAntiguaSinAtenderMs,
                                 Long antiguedadPromedioSinAtenderMs, long fueraDeSla,
                                 List<ConteoPorSeveridad> porSeveridad, List<ConteoPorTipo> porTipoAmenaza,
                                 long sinClasificar, List<ConteoPorOrigen> porOrigen, List<ConteoPorDia> porDia) {
    }

    public record ConteoPorSeveridad(int severidad, long cantidad) {
    }

    public record ConteoPorTipo(String tipo, long cantidad) {
    }

    public record ConteoPorOrigen(String origen, long cantidad) {
    }

    public record ConteoPorDia(String dia, long cantidad) {
    }

    public record ResumenCasos(long reportados, long abiertos, long enProgreso, long cerrados,
                               AlertasConvertidas alertasConvertidas, long contencionesHechas,
                               long confirmadosYCerrados, Long tiempoPromedioCierreMs) {
    }

    /** {@code porcentaje}: de 0 a 100 sin redondear; null si no hay alertas. */
    public record AlertasConvertidas(long convertidas, long total, Double porcentaje) {
    }

    /** Si la última consulta del backend a TheHive terminó bien, y cuándo fue. */
    public record EstadoTheHive(boolean respondio, long consultadoEn) {
    }
}
