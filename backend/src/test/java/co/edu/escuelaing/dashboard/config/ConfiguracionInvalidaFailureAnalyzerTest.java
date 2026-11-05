package co.edu.escuelaing.dashboard.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.diagnostics.FailureAnalysis;

class ConfiguracionInvalidaFailureAnalyzerTest {

    @Test
    void explicaQueFaltaYComoArreglarloSinMostrarLaTraza() {
        var causa = new ConfiguracionInvalidaException("Falta la variable de entorno THEHIVE_API_KEY.", "Defínela antes de arrancar.");
        Throwable fallo = new IllegalStateException("Error al crear el bean", causa);

        FailureAnalysis analisis = new ConfiguracionInvalidaFailureAnalyzer().analyze(fallo);

        assertThat(analisis).isNotNull();
        assertThat(analisis.getDescription()).isEqualTo("Falta la variable de entorno THEHIVE_API_KEY.");
        assertThat(analisis.getAction()).isEqualTo("Defínela antes de arrancar.");
    }

    @Test
    void ignoraLosDemasErrores() {
        assertThat(new ConfiguracionInvalidaFailureAnalyzer().analyze(new IllegalStateException("otro error"))).isNull();
    }
}
