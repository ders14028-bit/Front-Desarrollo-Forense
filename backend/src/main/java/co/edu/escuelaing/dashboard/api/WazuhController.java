package co.edu.escuelaing.dashboard.api;

import co.edu.escuelaing.dashboard.wazuh.MetricasWazuh;
import co.edu.escuelaing.dashboard.wazuh.SincronizacionWazuh;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** {@code GET /api/dashboard/wazuh}: métricas de las alertas de Wazuh de los últimos 7 días. Se sirve desde memoria. */
@RestController
@RequestMapping("/api/dashboard")
public class WazuhController {

    private final SincronizacionWazuh sincronizacion;

    public WazuhController(SincronizacionWazuh sincronizacion) {
        this.sincronizacion = sincronizacion;
    }

    @GetMapping("/wazuh")
    public MetricasWazuh wazuh() {
        return sincronizacion.actual();
    }
}
