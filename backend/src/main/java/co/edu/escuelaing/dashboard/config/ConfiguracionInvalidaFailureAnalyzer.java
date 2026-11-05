package co.edu.escuelaing.dashboard.config;

import org.springframework.boot.diagnostics.AbstractFailureAnalyzer;
import org.springframework.boot.diagnostics.FailureAnalysis;

/** Muestra un error de arranque claro (sin la traza completa) cuando la configuración es inválida. */
public class ConfiguracionInvalidaFailureAnalyzer extends AbstractFailureAnalyzer<ConfiguracionInvalidaException> {

    @Override
    protected FailureAnalysis analyze(Throwable rootFailure, ConfiguracionInvalidaException causa) {
        return new FailureAnalysis(causa.getProblema(), causa.getAccion(), causa);
    }
}
