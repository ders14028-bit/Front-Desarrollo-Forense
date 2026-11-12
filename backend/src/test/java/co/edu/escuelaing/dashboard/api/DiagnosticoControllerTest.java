package co.edu.escuelaing.dashboard.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import co.edu.escuelaing.dashboard.PruebaDeApi;
import co.edu.escuelaing.dashboard.wazuh.AlertaWazuh;
import co.edu.escuelaing.dashboard.wazuh.AlertaWazuh.Activo;
import co.edu.escuelaing.dashboard.wazuh.SincronizacionWazuh;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

class DiagnosticoControllerTest {

    private static RequestPostProcessor desde(String ip) {
        return peticion -> {
            peticion.setRemoteAddr(ip);
            return peticion;
        };
    }

    @Test
    void soloLoopbackCuentaComoLocal() {
        assertThat(DiagnosticoController.esLocal("127.0.0.1")).isTrue();
        assertThat(DiagnosticoController.esLocal("::1")).isTrue();
        assertThat(DiagnosticoController.esLocal("0:0:0:0:0:0:0:1")).isTrue();
        assertThat(DiagnosticoController.esLocal("10.0.0.5")).isFalse();
        assertThat(DiagnosticoController.esLocal("localhost")).isFalse();   // nunca se resuelve un nombre
        assertThat(DiagnosticoController.esLocal(null)).isFalse();
    }

    @Nested
    @PruebaDeApi
    class ApagadoPorDefecto {
        @Autowired
        MockMvc mvc;

        @Test
        void noExiste() throws Exception {
            mvc.perform(get("/diagnostico/wazuh/activos").with(desde("127.0.0.1"))).andExpect(status().isNotFound());
        }
    }

    @Nested
    @PruebaDeApi
    @TestPropertySource(properties = "dashboard.diagnostico=true")
    class Encendido {
        @Autowired
        MockMvc mvc;

        @MockitoBean
        SincronizacionWazuh sincronizacion;

        @Test
        void desdeLaMaquinaDevuelveNombresYConteos() throws Exception {
            when(sincronizacion.instantanea()).thenReturn(List.of(new AlertaWazuh("a", 1L, true, "1", 3, "x", List.of(), List.of(),
                    Map.of(), "192.0.2.9", "usuario-09", "srv-db", new Activo("sysmon", "007", "SRV-DB", "EventChannel", List.of("sysmon")))));
            when(sincronizacion.cargaInicialLista()).thenReturn(true);

            mvc.perform(get("/diagnostico/wazuh/activos").with(desde("127.0.0.1")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.alertasEnCache").value(1))
                    .andExpect(jsonPath("$.agentes[0].nombre").value("srv-db"))
                    .andExpect(jsonPath("$.equiposWindows[0].nombre").value("SRV-DB"))
                    .andExpect(jsonPath("$.porOrigen[0].origen").value("sysmon"))
                    .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
        }

        @Test
        void desdeOtraMaquinaNoExiste() throws Exception {
            mvc.perform(get("/diagnostico/wazuh/activos").with(desde("10.0.0.5"))).andExpect(status().isNotFound());
        }

        @Test
        void soloAceptaGet() throws Exception {
            mvc.perform(post("/diagnostico/wazuh/activos").with(desde("127.0.0.1"))).andExpect(status().isMethodNotAllowed());
        }
    }
}
