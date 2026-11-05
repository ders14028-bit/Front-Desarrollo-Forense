package co.edu.escuelaing.dashboard.dominio;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

/**
 * Los días del dashboard son los de {@code America/Bogota} (UTC−5, sin horario de verano). Un día va de las 00:00
 * (incluida) a las 00:00 del siguiente (excluida): por eso las consultas usan {@code _gte} y {@code _lt}.
 */
public final class DiasBogota {

    public static final ZoneId ZONA = ZoneId.of("America/Bogota");

    private DiasBogota() {
    }

    public static LocalDate dia(long instanteMs) {
        return Instant.ofEpochMilli(instanteMs).atZone(ZONA).toLocalDate();
    }

    /** Primer instante (ms, inclusive) del día. */
    public static long inicio(LocalDate dia) {
        return dia.atStartOfDay(ZONA).toInstant().toEpochMilli();
    }

    /** Los últimos {@code cantidad} días terminando en el de {@code ahoraMs}, del más antiguo a hoy. */
    public static List<LocalDate> ultimos(long ahoraMs, int cantidad) {
        LocalDate hoy = dia(ahoraMs);
        List<LocalDate> dias = new ArrayList<>(cantidad);
        for (int i = cantidad - 1; i >= 0; i--) {
            dias.add(hoy.minusDays(i));
        }
        return dias;
    }
}
