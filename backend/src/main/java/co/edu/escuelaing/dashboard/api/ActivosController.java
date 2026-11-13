package co.edu.escuelaing.dashboard.api;

import co.edu.escuelaing.dashboard.activos.ActivosAtacados;
import co.edu.escuelaing.dashboard.activos.CalculoActivos;
import co.edu.escuelaing.dashboard.activos.ConfiguracionActivos;
import co.edu.escuelaing.dashboard.wazuh.MetricasWazuh;
import co.edu.escuelaing.dashboard.wazuh.SincronizacionWazuh;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code GET /api/dashboard/activos}: activos y componentes atacados en la ventana de Wazuh. Se calcula desde la caché en
 * memoria (no consulta TheHive). Sin filtros: son pocos activos y el frontend filtra.
 */
@RestController
@RequestMapping("/api/dashboard")
public class ActivosController {

    private final SincronizacionWazuh sincronizacion;
    private final ConfiguracionActivos configuracion;

    public ActivosController(SincronizacionWazuh sincronizacion, ConfiguracionActivos configuracion) {
        this.sincronizacion = sincronizacion;
        this.configuracion = configuracion;
    }

    @GetMapping("/activos")
    public ActivosAtacados activos() {
        MetricasWazuh estado = sincronizacion.actual();
        if (!MetricasWazuh.LISTO.equals(estado.estado())) {
            return new ActivosAtacados(estado.generadoEn(), estado.estado(), estado.progreso(), estado.dias(), estado.desde(),
                    estado.thehive(), null, null, null);
        }
        CalculoActivos.Resultado r = CalculoActivos.calcular(sincronizacion.instantanea(), configuracion);
        return new ActivosAtacados(estado.generadoEn(), estado.estado(), estado.progreso(), estado.dias(), estado.desde(),
                estado.thehive(), r.activos(), r.alertasSinActivo(), r.ataquesRecientes());
    }
}
