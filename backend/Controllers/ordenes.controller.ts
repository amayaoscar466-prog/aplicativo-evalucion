// controllers/ordenes.controller.ts
import { z } from "../dependencias.ts";
import type { Context, RouterContext } from "../dependencias.ts";
import { client } from "../Models/database.ts";
import {
  enviarCorreoNuevaSolicitud,
  enviarCorreoCambioEstado,
} from "../services/email.service.ts";

// ---------- Validaciones ----------
const crearOrdenSchema = z.object({
  id_cliente: z.number().int().positive().optional(), // opcional si el que crea es un Cliente
  id_equipo: z.number().int().positive("id_equipo inválido"),
  id_tecnico: z.number().int().positive("id_tecnico inválido"),
  descripcion_problema: z.string().min(3, "Describe el problema"),
  valor_estimado: z.number().nonnegative("El valor estimado no puede ser negativo").optional(),
});

const actualizarOrdenSchema = z.object({
  estado: z.enum([
    "RECIBIDO", "EN_DIAGNOSTICO", "COTIZADO",
    "EN_REPARACION", "TERMINADO", "ENTREGADO", "CANCELADO",
  ]).optional(),
  observaciones: z.string().optional(),
  valor_final: z.number().nonnegative("El valor final no puede ser negativo").optional(),
});

// Traduce los SIGNAL de los triggers de MySQL a respuestas HTTP claras
function manejarErrorSQL(error: unknown, ctx: Context, mensajeGenerico: string) {
  const mensaje = error instanceof Error ? error.message : "";

  if (mensaje.includes("técnico no está activo")) {
    ctx.response.status = 400;
    ctx.response.body = { error: "No se puede asignar la orden: el técnico no está activo" };
    return;
  }
  if (mensaje.includes("estado final") || mensaje.includes("Transición de estado no permitida")) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Cambio de estado no permitido" };
    return;
  }

  console.error(error);
  ctx.response.status = 500;
  ctx.response.body = { error: mensajeGenerico };
}

// ---------- Crear orden (Requerimiento 5) ----------
export async function crearOrden(ctx: Context) {
  const usuario = ctx.state.usuario as {
    rol: string;
    id_cliente: number | null;
  };

  const body = await ctx.request.body.json();
  const parsed = crearOrdenSchema.safeParse(body);

  if (!parsed.success) {
    ctx.response.status = 400;
    ctx.response.body = { error: parsed.error.errors[0].message };
    return;
  }

  let { id_cliente, id_equipo, id_tecnico, descripcion_problema, valor_estimado } = parsed.data;

  // Si el que crea es un Cliente, el id_cliente sale del token, no del body
  if (usuario.rol === "Cliente") {
    id_cliente = usuario.id_cliente!;
  }

  if (!id_cliente) {
    ctx.response.status = 400;
    ctx.response.body = { error: "id_cliente es obligatorio" };
    return;
  }

  // El equipo debe existir y pertenecer al cliente indicado (Regla 2)
  const equipo = await client.query(
    `SELECT id_equipo, id_cliente FROM equipos WHERE id_equipo = ?`,
    [id_equipo]
  );
  if (equipo.length === 0) {
    ctx.response.status = 400;
    ctx.response.body = { error: "El equipo indicado no existe" };
    return;
  }
  if (equipo[0].id_cliente !== id_cliente) {
    ctx.response.status = 400;
    ctx.response.body = { error: "El equipo no pertenece al cliente indicado" };
    return;
  }

  try {
    const resultado = await client.execute(
      `INSERT INTO ordenes_servicio
        (id_cliente, id_equipo, id_tecnico, descripcion_problema, valor_estimado)
       VALUES (?, ?, ?, ?, ?)`,
      [id_cliente, id_equipo, id_tecnico, descripcion_problema, valor_estimado ?? 0]
    );

    const idOrden = resultado.lastInsertId;

    // El trigger ya generó el numero_orden, lo recuperamos junto al correo del cliente
    const orden = await client.query(
      `SELECT o.numero_orden, c.correo, c.nombre_completo
       FROM ordenes_servicio o
       JOIN clientes c ON o.id_cliente = c.id_cliente
       WHERE o.id_orden = ?`,
      [idOrden]
    );

    const { numero_orden, correo, nombre_completo } = orden[0];

    // Correo de nueva solicitud (fire-and-forget)
    enviarCorreoNuevaSolicitud(correo, nombre_completo, numero_orden, descripcion_problema);

    ctx.response.status = 201;
    ctx.response.body = { mensaje: "Orden creada", id_orden: idOrden, numero_orden };
  } catch (error) {
    manejarErrorSQL(error, ctx, "No se pudo crear la orden");
  }
}

// ---------- Listar órdenes (filtrado por rol) ----------
export async function listarOrdenes(ctx: Context) {
  const usuario = ctx.state.usuario as {
    rol: string;
    id_cliente: number | null;
    id_tecnico: number | null;
  };

  let sql = `
    SELECT o.id_orden, o.numero_orden, o.fecha_recepcion, o.estado,
           o.valor_estimado, o.valor_final,
           c.nombre_completo AS cliente,
           e.tipo_equipo, e.marca, e.modelo,
           t.nombre AS tecnico
    FROM ordenes_servicio o
    JOIN clientes c ON o.id_cliente = c.id_cliente
    JOIN equipos e ON o.id_equipo = e.id_equipo
    JOIN tecnicos t ON o.id_tecnico = t.id_tecnico
  `;
  const params: (string | number)[] = [];

  if (usuario.rol === "Cliente") {
    sql += ` WHERE o.id_cliente = ?`;
    params.push(usuario.id_cliente!);
  } else if (usuario.rol === "Tecnico") {
    sql += ` WHERE o.id_tecnico = ?`;
    params.push(usuario.id_tecnico!);
  }
  // SuperAdmin y Administrador ven todo, sin filtro

  sql += ` ORDER BY o.id_orden DESC`;

  const ordenes = await client.query(sql, params);
  ctx.response.status = 200;
  ctx.response.body = ordenes;
}

// ---------- Consultar una orden (con control de acceso) ----------
export async function obtenerOrden(ctx: RouterContext<"/api/ordenes/:id">) {
  const id = ctx.params.id;
  const usuario = ctx.state.usuario as {
    rol: string;
    id_cliente: number | null;
    id_tecnico: number | null;
  };

  const resultado = await client.query(
    `SELECT o.*, c.nombre_completo AS cliente, e.tipo_equipo, e.marca, e.modelo,
            t.nombre AS tecnico
     FROM ordenes_servicio o
     JOIN clientes c ON o.id_cliente = c.id_cliente
     JOIN equipos e ON o.id_equipo = e.id_equipo
     JOIN tecnicos t ON o.id_tecnico = t.id_tecnico
     WHERE o.id_orden = ?`,
    [id]
  );

  if (resultado.length === 0) {
    ctx.response.status = 404;
    ctx.response.body = { error: "Orden no encontrada" };
    return;
  }

  const orden = resultado[0];

  const sinAcceso =
    (usuario.rol === "Cliente" && orden.id_cliente !== usuario.id_cliente) ||
    (usuario.rol === "Tecnico" && orden.id_tecnico !== usuario.id_tecnico);

  if (sinAcceso) {
    ctx.response.status = 403;
    ctx.response.body = { error: "No tienes acceso a esta orden" };
    return;
  }

  ctx.response.status = 200;
  ctx.response.body = orden;
}

// ---------- Actualizar orden / cambiar estado (Requerimiento 6) ----------
export async function actualizarOrden(ctx: RouterContext<"/api/ordenes/:id">) {
  const id = ctx.params.id;
  const usuario = ctx.state.usuario as { rol: string; id_tecnico: number | null };

  const body = await ctx.request.body.json();
  const parsed = actualizarOrdenSchema.safeParse(body);

  if (!parsed.success) {
    ctx.response.status = 400;
    ctx.response.body = { error: parsed.error.errors[0].message };
    return;
  }

  const existente = await client.query(
    `SELECT o.id_tecnico, o.estado, o.numero_orden, c.correo, c.nombre_completo
     FROM ordenes_servicio o
     JOIN clientes c ON o.id_cliente = c.id_cliente
     WHERE o.id_orden = ?`,
    [id]
  );

  if (existente.length === 0) {
    ctx.response.status = 404;
    ctx.response.body = { error: "Orden no encontrada" };
    return;
  }

  const ordenActual = existente[0];

  // Un Técnico solo puede modificar sus propias órdenes asignadas
  if (usuario.rol === "Tecnico" && ordenActual.id_tecnico !== usuario.id_tecnico) {
    ctx.response.status = 403;
    ctx.response.body = { error: "No puedes modificar una orden que no tienes asignada" };
    return;
  }

  const datos = parsed.data;
  const campos = Object.keys(datos);
  if (campos.length === 0) {
    ctx.response.status = 400;
    ctx.response.body = { error: "No se enviaron campos para actualizar" };
    return;
  }

  const sets = campos.map((c) => `${c} = ?`).join(", ");
  const valores = campos.map((c) => (datos as Record<string, unknown>)[c]);

  try {
    await client.execute(`UPDATE ordenes_servicio SET ${sets} WHERE id_orden = ?`, [...valores, id]);

    // Si cambió el estado, notifica por correo (el trigger ya registró el historial)
    if (datos.estado && datos.estado !== ordenActual.estado) {
      enviarCorreoCambioEstado(
        ordenActual.correo,
        ordenActual.nombre_completo,
        ordenActual.numero_orden,
        datos.estado
      );
    }

    ctx.response.status = 200;
    ctx.response.body = { mensaje: "Orden actualizada" };
  } catch (error) {
    manejarErrorSQL(error, ctx, "No se pudo actualizar la orden");
  }
}