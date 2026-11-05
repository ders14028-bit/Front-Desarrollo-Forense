package co.edu.escuelaing.dashboard.thehive;

import co.edu.escuelaing.dashboard.config.ReglasNegocio;
import co.edu.escuelaing.dashboard.thehive.cliente.ConsultaTheHive;
import co.edu.escuelaing.dashboard.thehive.cliente.Filtro;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Punto de partida de las consultas del dashboard. Todas las de alertas excluyen las simulaciones
 * ({@code _ne type simulacion}) salvo que la configuración diga otra cosa, así que ninguna cifra ni lista se olvida
 * del filtro.
 */
@Component
public class ConsultasDashboard {

    private final ReglasNegocio reglas;

    public ConsultasDashboard(ReglasNegocio reglas) {
        this.reglas = reglas;
    }

    /** Alertas, sin las simulaciones (salvo configuración) y con los filtros indicados. */
    public ConsultaTheHive alertas(Filtro... filtros) {
        List<Filtro> todos = new ArrayList<>();
        if (!reglas.incluirSimulaciones()) {
            todos.add(Filtro.ne("type", reglas.tipoSimulacion()));
        }
        todos.addAll(List.of(filtros));
        return conFiltros(ConsultaTheHive.listAlert(), todos);
    }

    /**
     * Cuántas alertas de la consulta son simulación ({@code type = tipoSimulacion}, el mismo criterio del filtro
     * {@code _ne}). Si las simulaciones están excluidas no puede haber ninguna: devuelve 0 sin consultar.
     */
    public ConsultaTheHive alertasSimuladas(Filtro... filtros) {
        List<Filtro> todos = new ArrayList<>(List.of(filtros));
        todos.add(Filtro.eq("type", reglas.tipoSimulacion()));
        return conFiltros(ConsultaTheHive.listAlert(), todos);
    }

    /** {@code true} si las simulaciones entran en las cifras (por configuración). */
    public boolean incluyeSimulaciones() {
        return reglas.incluirSimulaciones();
    }

    /** Casos con los filtros indicados (los casos no tienen {@code type}: no se filtran simulaciones). */
    public ConsultaTheHive casos(Filtro... filtros) {
        return conFiltros(ConsultaTheHive.listCase(), List.of(filtros));
    }

    private static ConsultaTheHive conFiltros(ConsultaTheHive consulta, List<Filtro> filtros) {
        if (filtros.isEmpty()) {
            return consulta;
        }
        return consulta.filter(filtros.size() == 1 ? filtros.get(0) : Filtro.and(filtros.toArray(new Filtro[0])));
    }
}
