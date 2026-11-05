package co.edu.escuelaing.dashboard.api;

import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import co.edu.escuelaing.dashboard.PruebaDeApi;
import co.edu.escuelaing.dashboard.alertas.AlertasService;
import co.edu.escuelaing.dashboard.alertas.DetalleAlerta;
import co.edu.escuelaing.dashboard.alertas.ListaAlertas;
import co.edu.escuelaing.dashboard.alertas.ListaAlertas.AlertaFila;
import co.edu.escuelaing.dashboard.alertas.ListaAlertas.Composicion;
import co.edu.escuelaing.dashboard.dominio.EstadoSla;
import co.edu.escuelaing.dashboard.refresco.DatosNoDisponiblesException;
import co.edu.escuelaing.dashboard.refresco.TableroEnSegundoPlano;
import co.edu.escuelaing.dashboard.resumen.ResumenGerencial.EstadoTheHive;
import co.edu.escuelaing.dashboard.thehive.cliente.TheHiveNoRespondeException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@PruebaDeApi
class AlertasControllerTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @MockitoBean
    TableroEnSegundoPlano tablero;

    @MockitoBean
    AlertasService servicio;

    private static AlertaFila fila() {
        return new AlertaFila("~4513920", 1793519400000L, "Múltiples intentos fallidos", 3, "New", "wazuh", null, 600000L,
                new EstadoSla("dentro", 30, null), null);
    }

    @Test
    void laListaSeSirveDesdeElTableroConNullExplicitosYComposicion() throws Exception {
        when(tablero.lista()).thenReturn(new ListaAlertas(1793520000000L, 1011, true, false, new Composicion(1000, 2),
                new EstadoTheHive(true, 1793520000000L), List.of(fila())));

        mvc.perform(get("/api/dashboard/alertas"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1011))
                .andExpect(jsonPath("$.truncado").value(true))
                .andExpect(jsonPath("$.composicion.recientes").value(1000))
                .andExpect(jsonPath("$.composicion.criticasYAltasAdicionales").value(2))
                .andExpect(jsonPath("$.thehive.respondio").value(true))
                .andExpect(jsonPath("$.alertas[0].id").value("~4513920"))
                .andExpect(jsonPath("$.alertas[0].titulo").value("Múltiples intentos fallidos"))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("\"tipo\":null")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("\"caso\":null")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("\"excesoMs\":null")));
        verifyNoInteractions(servicio);   // la lista no consulta a TheHive al pedirla
    }

    @Test
    void laListaSinDatosDa503() throws Exception {
        when(tablero.lista()).thenThrow(new DatosNoDisponiblesException());

        mvc.perform(get("/api/dashboard/alertas")).andExpect(status().isServiceUnavailable()).andExpect(content().string(""));
    }

    @Test
    void elDetalleDeUnaAlertaQueExiste() throws Exception {
        var detalle = new DetalleAlerta(1793520000000L, json.readTree("{\"_id\":\"~4513920\",\"title\":\"Ejecución\"}"), fila(), null);
        when(servicio.detalle("~4513920")).thenReturn(Optional.of(detalle));

        mvc.perform(get("/api/dashboard/alertas/{id}", "~4513920"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.alerta._id").value("~4513920"))
                .andExpect(jsonPath("$.alerta.title").value("Ejecución"))
                .andExpect(jsonPath("$.fila.id").value("~4513920"))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("\"caso\":null")));
    }

    @Test
    void unaAlertaQueNoExisteDa404SinCuerpo() throws Exception {
        when(servicio.detalle("~999")).thenReturn(Optional.empty());

        mvc.perform(get("/api/dashboard/alertas/{id}", "~999")).andExpect(status().isNotFound()).andExpect(content().string(""));
    }

    @Test
    void siTheHiveFallaElDetalleDa503() throws Exception {
        when(servicio.detalle("~1")).thenThrow(new TheHiveNoRespondeException("TheHive no responde: error de red."));

        mvc.perform(get("/api/dashboard/alertas/{id}", "~1")).andExpect(status().isServiceUnavailable());
    }

    @Test
    void soloAceptaGet() throws Exception {
        for (String ruta : List.of("/api/dashboard/alertas", "/api/dashboard/alertas/~1")) {
            mvc.perform(post(ruta)).andExpect(status().isMethodNotAllowed());
            mvc.perform(put(ruta)).andExpect(status().isMethodNotAllowed());
            mvc.perform(delete(ruta)).andExpect(status().isMethodNotAllowed());
            mvc.perform(patch(ruta)).andExpect(status().isMethodNotAllowed());
        }
    }
}
