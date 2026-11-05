package co.edu.escuelaing.dashboard.api;

import co.edu.escuelaing.dashboard.refresco.TableroEnSegundoPlano;
import co.edu.escuelaing.dashboard.resumen.ResumenGerencial;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** {@code GET /api/dashboard/resumen}: métricas ya agregadas para la Vista gerencial. Se sirve desde memoria. */
@RestController
@RequestMapping("/api/dashboard")
public class ResumenController {

    private final TableroEnSegundoPlano tablero;

    public ResumenController(TableroEnSegundoPlano tablero) {
        this.tablero = tablero;
    }

    @GetMapping("/resumen")
    public ResumenGerencial resumen() {
        return tablero.resumen();
    }
}
