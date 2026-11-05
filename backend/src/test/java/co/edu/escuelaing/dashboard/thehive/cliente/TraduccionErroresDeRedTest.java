package co.edu.escuelaing.dashboard.thehive.cliente;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.net.http.HttpTimeoutException;
import java.security.cert.CertPathBuilderException;
import javax.net.ssl.SSLHandshakeException;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.ResourceAccessException;

class TraduccionErroresDeRedTest {

    private static ResourceAccessException envolver(Throwable causa) {
        return new ResourceAccessException("I/O error", new java.io.IOException(causa));
    }

    @Test
    void certificadoNoConfiableDaUnMensajeClaro() {
        var pkix = new SSLHandshakeException("PKIX path building failed: unable to find valid certification path to requested target");
        pkix.initCause(new CertPathBuilderException("Algo"));

        TheHiveException traducida = TheHiveClient.traducirErrorDeRed(envolver(pkix));

        assertThat(traducida).isInstanceOf(TheHiveCertificadoException.class).isInstanceOf(TheHiveNoRespondeException.class);
        assertThat(traducida.getMessage())
                .contains("TheHive no es alcanzable")
                .contains("certificado no confiable")
                .contains("Let's Encrypt")
                .contains("Windows-ROOT")
                .contains("JDK 21")
                .doesNotContain("antivirus");
    }

    @Test
    void sePuedeReconocerPorElTextoDelErrorAunqueLaClaseCambie() {
        var raro = new RuntimeException("sun.security.validator.ValidatorException: PKIX path building failed");

        assertThat(TheHiveClient.traducirErrorDeRed(envolver(raro))).isInstanceOf(TheHiveCertificadoException.class);
    }

    @Test
    void otroFalloDeHandshakeNoSeConfundeConUnCertificado() {
        var handshake = new SSLHandshakeException("Remote host terminated the handshake");

        TheHiveException traducida = TheHiveClient.traducirErrorDeRed(envolver(handshake));

        assertThat(traducida.getMessage()).contains("handshake TLS");
    }

    @Test
    void tiemposAgotadosYConexionesFallidasSonTheHiveNoResponde() {
        assertThat(TheHiveClient.traducirErrorDeRed(envolver(new HttpTimeoutException("request timed out"))).getMessage())
                .isEqualTo("TheHive no responde: se agotó el tiempo de espera.");
        assertThat(TheHiveClient.traducirErrorDeRed(envolver(new SocketTimeoutException("Read timed out"))).getMessage())
                .isEqualTo("TheHive no responde: se agotó el tiempo de espera.");
        assertThat(TheHiveClient.traducirErrorDeRed(envolver(new ConnectException("Connection refused"))).getMessage())
                .contains("TheHive no responde").contains("Tailscale");
        assertThat(TheHiveClient.traducirErrorDeRed(envolver(new UnknownHostException("no.existe.invalid"))).getMessage())
                .contains("TheHive no responde");
        assertThat(TheHiveClient.traducirErrorDeRed(envolver(new java.io.IOException("algo raro"))))
                .isInstanceOf(TheHiveNoRespondeException.class)
                .hasMessage("TheHive no responde: error de red.");
    }

    @Test
    void elMensajeNuncaRepiteElTextoOriginalDelError() {
        var conSecreto = new ConnectException("Authorization: Bearer SECRETO host=interno.ts");

        TheHiveException traducida = TheHiveClient.traducirErrorDeRed(envolver(conSecreto));

        assertThat(traducida.getMessage()).doesNotContain("SECRETO").doesNotContain("Bearer");
        assertThat(traducida.getCause()).isNull(); // sin cadena de causas: nada sensible viaja
    }
}
