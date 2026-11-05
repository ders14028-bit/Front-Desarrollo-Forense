package co.edu.escuelaing.dashboard.api;

import co.edu.escuelaing.dashboard.resumen.ResumenGerencial;
import co.edu.escuelaing.dashboard.resumen.ResumenService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** {@code GET /api/dashboard/resumen}: métricas ya agregadas para la Vista gerencial. Solo lectura. */
@RestController
@RequestMapping("/api/dashboard")
public class ResumenController {

    private final ResumenService servicio;

    public ResumenController(ResumenService servicio) {
        this.servicio = servicio;
    }

    @GetMapping("/resumen")
    public ResumenGerencial resumen() {
        return servicio.obtener();
    }
}
