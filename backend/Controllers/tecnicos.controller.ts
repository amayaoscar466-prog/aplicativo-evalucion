// controllers/tecnicos.controller.ts
import { z } from "../dependencias.ts";
import type { Context, RouterContext } from "../dependencias.ts";
import { client } from "../Models/database.ts";

// ---------- Validaciones ----------
const tecnicoSchema = z.object({
  nombre: z.string().min(3, "El nombre es obligatorio"),
  documento: z.string().min(5, "Documento inválido"),
  especialidad: z.string().min(2, "La especialidad es obligatoria"),
  telefono: z.string().min(7, "Teléfono inválido"),
  estado: z.enum(["Activo", "Inactivo"]).optional(), // por defecto Activo en la BD
});

const tecnicoUpdateSchema = tecnicoSchema.partial();

// ---------- Listar todos ----------
export async function listarTecnicos(ctx: Context) {
  const tecnicos = await client.query(
    `SELECT id_tecnico, nombre, documento, especialidad, telefono, estado, fecha_registro
     FROM tecnicos ORDER BY id_tecnico DESC`
  );
  ctx.response.status = 200;
  ctx.response.body = tecnicos;
}

// ---------- Consultar uno ----------
export async function obtenerTecnico(ctx: RouterContext<"/api/tecnicos/:id">) {
  const id = ctx.params.id;

  const resultado = await client.query(
    `SELECT id_tecnico, nombre, documento, especialidad, telefono, estado, fecha_registro
     FROM tecnicos WHERE id_tecnico = ?`,
    [id]
  );

  if (resultado.length === 0) {
    ctx.response.status = 404;
    ctx.response.body = { error: "Técnico no encontrado" };
    return;
  }

  ctx.response.status = 200;
  ctx.response.body = resultado[0];
}

// ---------- Registrar ----------
export async function crearTecnico(ctx: Context) {
  const body = await ctx.request.body.json();
  const parsed = tecnicoSchema.safeParse(body);

  if (!parsed.success) {
    ctx.response.status = 400;
    ctx.response.body = { error: parsed.error.errors[0].message };
    return;
  }

  const { nombre, documento, especialidad, telefono, estado } = parsed.data;

  const existente = await client.query(`SELECT id_tecnico FROM tecnicos WHERE documento = ?`, [documento]);
  if (existente.length > 0) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Ya existe un técnico con ese documento" };
    return;
  }

  const resultado = await client.execute(
    `INSERT INTO tecnicos (nombre, documento, especialidad, telefono, estado)
     VALUES (?, ?, ?, ?, ?)`,
    [nombre, documento, especialidad, telefono, estado ?? "Activo"]
  );

  ctx.response.status = 201;
  ctx.response.body = { mensaje: "Técnico registrado", id_tecnico: resultado.lastInsertId };
}

// ---------- Actualizar (incluye cambiar Activo/Inactivo) ----------
export async function actualizarTecnico(ctx: RouterContext<"/api/tecnicos/:id">) {
  const id = ctx.params.id;
  const body = await ctx.request.body.json();
  const parsed = tecnicoUpdateSchema.safeParse(body);

  if (!parsed.success) {
    ctx.response.status = 400;
    ctx.response.body = { error: parsed.error.errors[0].message };
    return;
  }

  const existe = await client.query(`SELECT id_tecnico FROM tecnicos WHERE id_tecnico = ?`, [id]);
  if (existe.length === 0) {
    ctx.response.status = 404;
    ctx.response.body = { error: "Técnico no encontrado" };
    return;
  }

  const datos = parsed.data;

  if (datos.documento) {
    const duplicado = await client.query(
      `SELECT id_tecnico FROM tecnicos WHERE documento = ? AND id_tecnico != ?`,
      [datos.documento, id]
    );
    if (duplicado.length > 0) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Ese documento ya pertenece a otro técnico" };
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

  await client.execute(`UPDATE tecnicos SET ${sets} WHERE id_tecnico = ?`, [...valores, id]);

  ctx.response.status = 200;
  ctx.response.body = { mensaje: "Técnico actualizado" };
}

// ---------- Eliminar ----------
export async function eliminarTecnico(ctx: RouterContext<"/api/tecnicos/:id">) {
  const id = ctx.params.id;

  const existe = await client.query(`SELECT id_tecnico FROM tecnicos WHERE id_tecnico = ?`, [id]);
  if (existe.length === 0) {
    ctx.response.status = 404;
    ctx.response.body = { error: "Técnico no encontrado" };
    return;
  }

  try {
    await client.execute(`DELETE FROM tecnicos WHERE id_tecnico = ?`, [id]);
    ctx.response.status = 200;
    ctx.response.body = { mensaje: "Técnico eliminado" };
  } catch (_error) {
    // Si tiene órdenes asociadas, la FK de ordenes_servicio lo bloquea
    ctx.response.status = 400;
    ctx.response.body = {
      error: "No se puede eliminar: el técnico tiene órdenes de servicio asociadas. Desactívalo en su lugar.",
    };
  }
}