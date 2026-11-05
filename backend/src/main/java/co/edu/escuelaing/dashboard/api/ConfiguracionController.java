package co.edu.escuelaing.dashboard.api;

import co.edu.escuelaing.dashboard.config.SlaMinutos;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Configuración que el frontend necesita conocer. No consulta TheHive. */
@RestController
@RequestMapping("/api/dashboard")
public class ConfiguracionController {

    private final SlaMinutos sla;

    public ConfiguracionController(SlaMinutos sla) {
        this.sla = sla;
    }

    @GetMapping("/configuracion")
    public ConfiguracionDto configuracion() {
        return new ConfiguracionDto(sla.comoMapa());
    }
}
