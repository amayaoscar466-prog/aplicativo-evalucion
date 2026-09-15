// services/email.service.ts
import { SMTPClient, load } from "../dependencias.ts";

const env = await load({ envPath: "./.env" });

function crearCliente() {
  return new SMTPClient({
    connection: {
      hostname: env.SMTP_HOST,
      port: Number(env.SMTP_PORT),
      tls: true,
      auth: {
        username: env.SMTP_USER,
        password: env.SMTP_PASS,
      },
    },
  });
}

async function enviarCorreo(destino: string, asunto: string, html: string) {
  const client = crearCliente();
  try {
    await client.send({
      from: `${env.SMTP_FROM_NAME} <${env.SMTP_USER}>`,
      to: destino,
      subject: asunto,
      html,
    });
  } catch (error) {
    // Un fallo de correo NUNCA debe tumbar la operación principal (crear orden, etc.)
    console.error(`⚠️ Error enviando correo a ${destino}:`, error);
  } finally {
    await client.close();
  }
}

// 1. Verificación de cuenta creada
export function enviarCorreoVerificacionCuenta(destino: string, nombre: string) {
  return enviarCorreo(
    destino,
    "Tu cuenta ha sido creada",
    `<h2>¡Bienvenido(a), ${nombre}!</h2>
     <p>Tu cuenta en el sistema de Servicio Técnico fue creada correctamente.</p>
     <p>Ya puedes iniciar sesión con tu correo y contraseña.</p>`
  );
}

// 2. Nueva solicitud / orden creada
export function enviarCorreoNuevaSolicitud(
  destino: string,
  nombreCliente: string,
  numeroOrden: string,
  descripcion: string
) {
  return enviarCorreo(
    destino,
    `Recibimos tu solicitud ${numeroOrden}`,
    `<h2>Hola ${nombreCliente},</h2>
     <p>Registramos tu solicitud de servicio técnico con número <b>${numeroOrden}</b>.</p>
     <p><b>Problema reportado:</b> ${descripcion}</p>
     <p>Te iremos notificando por este medio cada vez que cambie el estado de tu equipo.</p>`
  );
}

// 3. Cambio de estado (incluye el cierre cuando llega a ENTREGADO)
const MENSAJES_ESTADO: Record<string, string> = {
  EN_DIAGNOSTICO: "Tu equipo ya está en proceso de diagnóstico.",
  COTIZADO: "Ya generamos la cotización de tu reparación.",
  EN_REPARACION: "Tu equipo está siendo reparado.",
  TERMINADO: "¡Tu equipo ya está listo! Puedes pasar a recogerlo.",
  ENTREGADO: "Tu equipo fue entregado. ¡Gracias por confiar en nosotros!",
  CANCELADO: "Tu solicitud de servicio fue cancelada.",
};

export function enviarCorreoCambioEstado(
  destino: string,
  nombreCliente: string,
  numeroOrden: string,
  estadoNuevo: string
) {
  const mensaje = MENSAJES_ESTADO[estadoNuevo] || `El estado de tu orden cambió a ${estadoNuevo}.`;
  const esFinal = estadoNuevo === "ENTREGADO";

  return enviarCorreo(
    destino,
    esFinal
      ? `Servicio finalizado - Orden ${numeroOrden}`
      : `Actualización de tu orden ${numeroOrden}`,
    `<h2>Hola ${nombreCliente},</h2>
     <p>${mensaje}</p>
     <p><b>Número de orden:</b> ${numeroOrden}</p>
     <p><b>Nuevo estado:</b> ${estadoNuevo}</p>`
  );
}