package co.edu.escuelaing.dashboard.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import co.edu.escuelaing.dashboard.PruebaDeApi;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/** CORS: solo el origen del frontend (por defecto http://localhost:5173), solo GET y sin credenciales. */
class CorsTest {

    private static final String RUTA = "/api/dashboard/configuracion";

    @PruebaDeApi
    @Nested
    class ConElOrigenPorDefecto {
        @Autowired
        MockMvc mvc;

        @Test
        void permiteElOrigenDelFrontend() throws Exception {
            mvc.perform(options(RUTA)
                            .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                            .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"))
                    .andExpect(status().isOk())
                    .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:5173"));
        }

        @Test
        void unaPeticionRealDelFrontendLlevaLaCabeceraCors() throws Exception {
            mvc.perform(get(RUTA).header(HttpHeaders.ORIGIN, "http://localhost:5173"))
                    .andExpect(status().isOk())
                    .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:5173"))
                    .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS));
        }

        @Test
        void rechazaCualquierOtroOrigen() throws Exception {
            mvc.perform(options(RUTA)
                            .header(HttpHeaders.ORIGIN, "http://sitio-malo.example")
                            .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"))
                    .andExpect(status().isForbidden())
                    .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
            mvc.perform(get(RUTA).header(HttpHeaders.ORIGIN, "http://sitio-malo.example"))
                    .andExpect(status().isForbidden());
        }

        @Test
        void rechazaLosMetodosQueEscriben() throws Exception {
            for (String metodo : new String[] {"POST", "PUT", "DELETE", "PATCH"}) {
                mvc.perform(options(RUTA)
                                .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, metodo))
                        .andExpect(status().isForbidden());
            }
        }

        @Test
        void soloAnunciaElMetodoGet() throws Exception {
            mvc.perform(options(RUTA)
                            .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                            .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"))
                    .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_METHODS, "GET"));
        }
    }

    @PruebaDeApi
    @TestPropertySource(properties = "dashboard.cors.origenes=https://tablero.ejemplo.test, http://otro.ejemplo.test:3000/")
    @Nested
    class ConOrigenesConfigurados {
        @Autowired
        MockMvc mvc;

        @Test
        void permiteLosConfiguradosYYaNoElDeDesarrollo() throws Exception {
            for (String origen : new String[] {"https://tablero.ejemplo.test", "http://otro.ejemplo.test:3000"}) {
                mvc.perform(get(RUTA).header(HttpHeaders.ORIGIN, origen))
                        .andExpect(status().isOk())
                        .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, origen));
            }
            mvc.perform(get(RUTA).header(HttpHeaders.ORIGIN, "http://localhost:5173"))
                    .andExpect(status().isForbidden());
        }
    }
}
