package co.edu.escuelaing.dashboard.activos;

import static org.assertj.core.api.Assertions.assertThat;

import co.edu.escuelaing.dashboard.activos.ActivosAtacados.Activo;
import co.edu.escuelaing.dashboard.activos.ActivosAtacados.ConteoComponente;
import co.edu.escuelaing.dashboard.activos.ConfiguracionActivos.Componente;
import co.edu.escuelaing.dashboard.activos.ConfiguracionActivos.Entrada;
import co.edu.escuelaing.dashboard.dominio.FixturesTheHive;
import co.edu.escuelaing.dashboard.wazuh.AlertaWazuh;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

public class CalculoActivosTest {

    /** La misma tabla que application.yml (ActivosControllerTest comprueba que el archivo la trae igual). */
    public static final List<Componente> COMPONENTES = List.of(
            new Componente("base-de-datos", List.of("mariadb_lab", "mysql", "mssql", "postgresql"), null),
            new Componente("servidor-web", List.of("web_server_lab", "lab_webserver", "apache", "nginx", "web"), null),
            new Componente("ssh", List.of("sshd"), null),
            new Componente("inicio-sesion-windows", List.of("windows_security"), null),
            new Componente("procesos-windows", List.of("sysmon"), List.of("sysmon_")),
            new Componente("sistema-windows", List.of("windows_application", "windows_system", "WEF", "win_evt_channel"), null),
            new Componente("cuentas-permisos", List.of("pam", "sudo", "adduser"), null),
            new Componente("auditoria", List.of("audit", "audit_selinux", "audit_configuration", "apparmor"), null),
            new Componente("vulnerabilidades", List.of("vulnerability-detector", "dpkg"), null),
            new Componente("integridad", List.of("rootcheck", "syscheck"), null),
            new Componente("monitoreo-wazuh", List.of("ossec"), null));
    public static final List<String> GENERICOS = List.of("syslog", "authentication_failed", "invalid_login", "authentication_success",
            "authentication_failures", "config_changed", "access_control", "local", "system_error", "time_changed", "stats", "errors");

    static ConfiguracionActivos config(Entrada... inventario) {
        return new ConfiguracionActivos(List.of(inventario), COMPONENTES, GENERICOS);
    }

    private static AlertaWazuh alerta(String id, String agenteId, String agente, int severidad, String ubicacion, String... grupos) {
        return new AlertaWazuh(id, 1L, true, "1", 3, "x", List.of(), List.of(), Map.of(), "192.0.2.9", "usuario-09", agente,
                new AlertaWazuh.Activo("wazuh", agenteId, null, ubicacion, List.of(grupos), severidad));
    }

    private static Activo activo(CalculoActivos.Resultado r, String equipo) {
        return r.activos().stream().filter(a -> equipo.equals(a.equipo())).findFirst().orElseThrow();
    }

    // ---- componentes ----

    @Test
    void ganaElPrimerComponenteDeLaTablaNoElPrimerGrupoDeLaAlerta() {
        var c = config();
        assertThat(CalculoActivos.componenteDe(List.of("sshd", "mariadb_lab"), c)).isEqualTo("base-de-datos");
        assertThat(CalculoActivos.componenteDe(List.of("pam", "windows_security"), c)).isEqualTo("inicio-sesion-windows");
        assertThat(CalculoActivos.componenteDe(List.of("ossec", "syscheck"), c)).isEqualTo("integridad");
        assertThat(CalculoActivos.componenteDe(List.of("windows", "sysmon_event1"), c)).isEqualTo("procesos-windows");
        assertThat(CalculoActivos.componenteDe(List.of("windows", " WEF"), c)).isEqualTo("sistema-windows");
    }

    @Test
    void losGruposGenericosNoDefinenComponente() {
        var c = config();
        assertThat(CalculoActivos.componenteDe(List.of("syslog", "authentication_failed", "invalid_login"), c)).isEqualTo("otros");
        assertThat(CalculoActivos.componenteDe(List.of("syslog", "sshd", "authentication_failed"), c)).isEqualTo("ssh");
        assertThat(CalculoActivos.componenteDe(List.of(), c)).isEqualTo("otros");
        // aunque alguien ponga un genérico en la tabla, no cuenta
        var mal = new ConfiguracionActivos(List.of(), List.of(new Componente("x", List.of("syslog"), null)), GENERICOS);
        assertThat(CalculoActivos.componenteDe(List.of("syslog"), mal)).isEqualTo("otros");
    }

    // ---- activos ----

    @Test
    void conLosFixturesAnonimizados() {
        List<AlertaWazuh> alertas = FixturesTheHive.alertas().stream()
                .filter(a -> "wazuh".equals(a.tipo())).map(AlertaWazuh::de).toList();
        var c = config(new Entrada("000", "equipo-03", "monitoreo", "Servidor de monitoreo (Wazuh)", "Linux"));

        var r = CalculoActivos.calcular(alertas, c);

        Activo monitoreo = activo(r, "equipo-03");
        assertThat(monitoreo.nombreVisible()).isEqualTo("Servidor de monitoreo (Wazuh)");
        assertThat(monitoreo.tipo()).isEqualTo("monitoreo");
        assertThat(monitoreo.componentes()).extracting(ConteoComponente::clave).contains("ssh", "cuentas-permisos");

        // 005 / equipo-02 no está en el inventario: sale igual, sin clasificar y con el sistema deducido (EventChannel)
        Activo desconocido = activo(r, "equipo-02");
        assertThat(desconocido.agenteId()).isEqualTo("005");
        assertThat(desconocido.tipo()).isEqualTo("sin-clasificar");
        assertThat(desconocido.nombreVisible()).isEqualTo("equipo-02");
        assertThat(desconocido.sistema()).isEqualTo("Windows");
        assertThat(desconocido.componentes()).extracting(ConteoComponente::clave)
                .contains("inicio-sesion-windows", "sistema-windows", "monitoreo-wazuh");

        int total = r.activos().stream().mapToInt(Activo::alertas).sum();
        assertThat(total + r.alertasSinActivo()).isEqualTo(alertas.size());
        for (Activo a : r.activos()) {
            assertThat(a.componentes().stream().mapToInt(ConteoComponente::alertas).sum()).isEqualTo(a.alertas());
            assertThat(a.componentes().stream().mapToInt(ConteoComponente::altasYCriticas).sum()).isEqualTo(a.altasYCriticas());
        }
    }

    @Test
    void sumaDeComponentesIgualALasAlertasYPrincipalElMayor() {
        var c = config(new Entrada("003", "srv-db", "base-de-datos", "Servidor de base de datos", "Linux"));
        var r = CalculoActivos.calcular(List.of(
                alerta("1", "003", "srv-db", 4, "journald", "mariadb_lab", "syslog"),
                alerta("2", "003", "srv-db", 3, "journald", "mariadb_lab"),
                alerta("3", "003", "srv-db", 2, "journald", "sshd", "authentication_failed"),
                alerta("4", "003", "srv-db", 1, "journald", "syslog")), c);

        Activo db = r.activos().get(0);
        assertThat(db.alertas()).isEqualTo(4);
        assertThat(db.altasYCriticas()).isEqualTo(2);
        assertThat(db.componentePrincipal()).isEqualTo("base-de-datos");
        assertThat(db.componentes()).containsExactly(
                new ConteoComponente("base-de-datos", 2, 2), new ConteoComponente("ssh", 1, 0), new ConteoComponente("otros", 1, 0));
    }

    @Test
    void reconocePorIdYComoRespaldoPorNombre() {
        var c = config(new Entrada("004", "Srv-Web", "web", "Servidor web", "Linux"));
        var r = CalculoActivos.calcular(List.of(
                alerta("1", "004", "otro-nombre", 2, "x", "web"),
                alerta("2", null, "srv-web", 2, "x", "web"),       // sin id: por nombre, sin distinguir mayúsculas
                alerta("3", "999", "SRV-WEB", 2, "x", "web")), c);  // id desconocido: por nombre

        assertThat(r.activos()).hasSize(1);
        Activo web = r.activos().get(0);
        assertThat(web.alertas()).isEqualTo(3);
        assertThat(web.agenteId()).isEqualTo("004");
        assertThat(web.equipo()).isEqualTo("Srv-Web");
        assertThat(web.nombreVisible()).isEqualTo("Servidor web");
    }

    @Test
    void agenteDesconocidoSinClasificarYSistemaDeducido() {
        var r = CalculoActivos.calcular(List.of(
                alerta("1", "010", "nuevo-linux", 3, "journald", "sshd"),
                alerta("2", "011", "NUEVO-WIN", 2, "x", "windows", "windows_security"),
                alerta("3", null, null, 4, "x", "sshd")), config());

        assertThat(r.alertasSinActivo()).isEqualTo(1);
        assertThat(activo(r, "nuevo-linux")).extracting(Activo::tipo, Activo::sistema, Activo::nombreVisible)
                .containsExactly("sin-clasificar", "Linux", "nuevo-linux");
        assertThat(activo(r, "NUEVO-WIN").sistema()).isEqualTo("Windows");
    }

    @Test
    void losDelInventarioSalenAunqueNoTenganAlertasYElOrdenEsPorAlertas() {
        var c = config(
                new Entrada("001", "cliente", "estacion", "Estación de trabajo Linux", "Linux"),
                new Entrada("004", "web", "web", "Servidor web", "Linux"));
        var r = CalculoActivos.calcular(List.of(alerta("1", "004", "web", 1, "x", "web")), c);

        assertThat(r.activos()).extracting(Activo::nombreVisible).containsExactly("Servidor web", "Estación de trabajo Linux");
        Activo vacio = r.activos().get(1);
        assertThat(vacio.alertas()).isZero();
        assertThat(vacio.componentePrincipal()).isNull();
        assertThat(vacio.componentes()).isEmpty();
    }
}
