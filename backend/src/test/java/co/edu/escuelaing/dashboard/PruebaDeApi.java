package co.edu.escuelaing.dashboard;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * Prueba con la aplicación completa y MockMvc. Los valores son ficticios: las pruebas NUNCA llaman al TheHive real
 * ni dependen de las variables de entorno del equipo (las propiedades de aquí tienen prioridad sobre ellas).
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@SpringBootTest(properties = {
        "dashboard.thehive.url=https://thehive.prueba.invalid",
        "dashboard.thehive.api-key=CLAVE-DE-PRUEBA-NO-REAL",
        "dashboard.thehive.organizacion=escuelaing-prueba",
        "dashboard.refresco.activo=false"
})
@AutoConfigureMockMvc
public @interface PruebaDeApi {
}
