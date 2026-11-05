package co.edu.escuelaing.dashboard.api;

import co.edu.escuelaing.dashboard.alertas.AlertasService;
import co.edu.escuelaing.dashboard.alertas.DetalleAlerta;
import co.edu.escuelaing.dashboard.alertas.ListaAlertas;
import co.edu.escuelaing.dashboard.refresco.TableroEnSegundoPlano;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** La lista (desde memoria) y el detalle (consulta a TheHive) de alertas. Solo lectura. */
@RestController
@RequestMapping("/api/dashboard/alertas")
public class AlertasController {

    private final TableroEnSegundoPlano tablero;
    private final AlertasService servicio;

    public AlertasController(TableroEnSegundoPlano tablero, AlertasService servicio) {
        this.tablero = tablero;
        this.servicio = servicio;
    }

    @GetMapping
    public ListaAlertas lista() {
        return tablero.lista();
    }

    /** 404 (sin cuerpo) si la alerta no existe: TheHive responde 200 con resultado vacío y eso decide el 404. */
    @GetMapping("/{id}")
    public ResponseEntity<DetalleAlerta> detalle(@PathVariable String id) {
        return servicio.detalle(id).map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }
}
