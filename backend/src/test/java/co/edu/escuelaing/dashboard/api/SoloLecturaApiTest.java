package co.edu.escuelaing.dashboard.api;

import static org.assertj.core.api.Assertions.assertThat;

import co.edu.escuelaing.dashboard.PruebaDeApi;
import java.util.Set;
import java.util.TreeSet;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

/**
 * La API que expone el backend es de SOLO LECTURA: toda ruta de /api responde únicamente a GET. Si alguien agrega
 * un POST, PUT, DELETE o PATCH (o un mapeo sin método, que aceptaría cualquiera), este test falla.
 */
@PruebaDeApi
class SoloLecturaApiTest {

    @Autowired
    @Qualifier("requestMappingHandlerMapping")
    RequestMappingHandlerMapping mapeos;

    @Test
    void todasLasRutasDeLaApiSonSoloGet() {
        var rutasDeLaApi = mapeos.getHandlerMethods().keySet().stream().filter(SoloLecturaApiTest::esDeLaApi).toList();

        assertThat(rutasDeLaApi).as("hay rutas de /api registradas").isNotEmpty();
        for (RequestMappingInfo ruta : rutasDeLaApi) {
            assertThat(ruta.getMethodsCondition().getMethods())
                    .as("métodos permitidos en %s", ruta.getPathPatternsCondition())
                    .containsExactly(RequestMethod.GET);
        }
    }

    @Test
    void fueraDeApiSoloExisteElManejadorDeErroresDeSpring() {
        Set<String> otras = new TreeSet<>();
        mapeos.getHandlerMethods().keySet().stream()
                .filter(info -> !esDeLaApi(info))
                .forEach(info -> otras.addAll(info.getPathPatternsCondition().getPatternValues()));

        assertThat(otras).containsOnly("/error");
    }

    private static boolean esDeLaApi(RequestMappingInfo info) {
        return info.getPathPatternsCondition().getPatternValues().stream().anyMatch(p -> p.startsWith("/api"));
    }
}
