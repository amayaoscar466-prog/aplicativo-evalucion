// controllers/equipos.controller.ts
import { z } from "../dependencias.ts";
import type { Context, RouterContext } from "../dependencias.ts";
import { client } from "../Models/database.ts";

// ---------- Validaciones ----------
const _TIPOS_EQUIPO = [
  "Computador portátil",
  "Computador de escritorio",
  "Monitor",
  "Impresora",
  "Tablet",
  "Otro",
] as const;

const equipoSchema = z.object({
  id_cliente: z.number().int().positive("id_cliente inválido"),
  tipo_equipo: z.string().min(1, "El tipo de equipo es obligatorio"),
  marca: z.string().min(1, "La marca es obligatoria"),
  modelo: z.string().min(1, "El modelo es obligatorio"),
  numero_serie: z.string().min(1).optional().nullable(),
  descripcion_problema: z.string().min(3, "Describe el problema"),
});

const equipoUpdateSchema = equipoSchema.partial();

// ---------- Listar todos ----------
export async function listarEquipos(ctx: Context) {
  const equipos = await client.query(
    `SELECT e.id_equipo, e.id_cliente, c.nombre_completo AS cliente,
            e.tipo_equipo, e.marca, e.modelo, e.numero_serie,
            e.descripcion_problema, e.fecha_registro
     FROM equipos e
     JOIN clientes c ON e.id_cliente = c.id_cliente
     ORDER BY e.id_equipo DESC`
  );
  ctx.response.status = 200;
  ctx.response.body = equipos;
}

// ---------- Consultar uno ----------
export async function obtenerEquipo(ctx: RouterContext<"/api/equipos/:id">) {
  const id = ctx.params.id;

  const resultado = await client.query(
    `SELECT e.id_equipo, e.id_cliente, c.nombre_completo AS cliente,
            e.tipo_equipo, e.marca, e.modelo, e.numero_serie,
            e.descripcion_problema, e.fecha_registro
     FROM equipos e
     JOIN clientes c ON e.id_cliente = c.id_cliente
     WHERE e.id_equipo = ?`,
    [id]
  );

  if (resultado.length === 0) {
    ctx.response.status = 404;
    ctx.response.body = { error: "Equipo no encontrado" };
    return;
  }

  ctx.response.status = 200;
  ctx.response.body = resultado[0];
}

// ---------- Registrar (Regla 1: un cliente puede tener varios equipos) ----------
export async function crearEquipo(ctx: Context) {
  const body = await ctx.request.body.json();
  const parsed = equipoSchema.safeParse(body);

  if (!parsed.success) {
    ctx.response.status = 400;
    ctx.response.body = { error: parsed.error.errors[0].message };
    return;
  }

  const { id_cliente, tipo_equipo, marca, modelo, numero_serie, descripcion_problema } = parsed.data;

  // El cliente debe existir (Requerimiento 3)
  const cliente = await client.query(`SELECT id_cliente FROM clientes WHERE id_cliente = ?`, [id_cliente]);
  if (cliente.length === 0) {
    ctx.response.status = 400;
    ctx.response.body = { error: "El cliente indicado no existe" };
    return;
  }

  // numero_serie único, pero solo si se envió
  if (numero_serie) {
    const serieExistente = await client.query(
      `SELECT id_equipo FROM equipos WHERE numero_serie = ?`,
      [numero_serie]
    );
    if (serieExistente.length > 0) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Ya existe un equipo registrado con ese número de serie" };
      return;
    }
  }

  const resultado = await client.execute(
    `INSERT INTO equipos (id_cliente, tipo_equipo, marca, modelo, numero_serie, descripcion_problema)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id_cliente, tipo_equipo, marca, modelo, numero_serie ?? null, descripcion_problema]
  );

  ctx.response.status = 201;
  ctx.response.body = { mensaje: "Equipo registrado", id_equipo: resultado.lastInsertId };
}

// ---------- Actualizar ----------
export async function actualizarEquipo(ctx: RouterContext<"/api/equipos/:id">) {
  const id = ctx.params.id;
  const body = await ctx.request.body.json();
  const parsed = equipoUpdateSchema.safeParse(body);

  if (!parsed.success) {
    ctx.response.status = 400;
    ctx.response.body = { error: parsed.error.errors[0].message };
    return;
  }

  const existe = await client.query(`SELECT id_equipo FROM equipos WHERE id_equipo = ?`, [id]);
  if (existe.length === 0) {
    ctx.response.status = 404;
    ctx.response.body = { error: "Equipo no encontrado" };
    return;
  }

  const datos = parsed.data;

  if (datos.id_cliente) {
    const cliente = await client.query(`SELECT id_cliente FROM clientes WHERE id_cliente = ?`, [datos.id_cliente]);
    if (cliente.length === 0) {
      ctx.response.status = 400;
      ctx.response.body = { error: "El cliente indicado no existe" };
      return;
    }
  }

  if (datos.numero_serie) {
    const serieExistente = await client.query(
      `SELECT id_equipo FROM equipos WHERE numero_serie = ? AND id_equipo != ?`,
      [datos.numero_serie, id]
    );
    if (serieExistente.length > 0) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Ya existe otro equipo con ese número de serie" };
      return;
    }
  }

  const campos = Object.keys(datos);
  if (campos.length === 0) {
    ctx.response.status = 400;
    ctx.response.body = { error: "No se enviaron campos para actualizar" };
    return;
  }

  const sets = campos.map((c) => `${c} = ?`).join(", ");
  const valores = campos.map((c) => (datos as Record<string, unknown>)[c]);

  await client.execute(`UPDATE equipos SET ${sets} WHERE id_equipo = ?`, [...valores, id]);

  ctx.response.status = 200;
  ctx.response.body = { mensaje: "Equipo actualizado" };
}

// ---------- Eliminar ----------
export async function eliminarEquipo(ctx: RouterContext<"/api/equipos/:id">) {
  const id = ctx.params.id;

  const existe = await client.query(`SELECT id_equipo FROM equipos WHERE id_equipo = ?`, [id]);
  if (existe.length === 0) {
    ctx.response.status = 404;
    ctx.response.body = { error: "Equipo no encontrado" };
    return;
  }

  try {
    await client.execute(`DELETE FROM equipos WHERE id_equipo = ?`, [id]);
    ctx.response.status = 200;
    ctx.response.body = { mensaje: "Equipo eliminado" };
  } catch (_error) {
    // Si el equipo tiene órdenes asociadas, la FK de ordenes_servicio lo bloquea
    ctx.response.status = 400;
    ctx.response.body = {
      error: "No se puede eliminar: el equipo tiene órdenes de servicio asociadas.",
    };
  }
}