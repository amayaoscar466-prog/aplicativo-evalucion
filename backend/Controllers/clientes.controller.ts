// controllers/clientes.controller.ts
import { z } from "../dependencias.ts";
import type { Context, RouterContext } from "../dependencias.ts";
import { client } from "../Models/database.ts";

// ---------- Validaciones ----------
const clienteSchema = z.object({
  nombre_completo: z.string().min(3, "El nombre es obligatorio"),
  documento: z.string().min(5, "Documento inválido"),
  telefono: z.string().min(7, "Teléfono inválido"),
  correo: z.string().email("Correo inválido"),
});

const clienteUpdateSchema = clienteSchema.partial(); // permite actualizar solo algunos campos

// ---------- Listar todos ----------
export async function listarClientes(ctx: Context) {
  const clientes = await client.query(
    `SELECT id_cliente, nombre_completo, documento, telefono, correo, fecha_registro
     FROM clientes ORDER BY id_cliente DESC`
  );
  ctx.response.status = 200;
  ctx.response.body = clientes;
}

// ---------- Consultar uno ----------
export async function obtenerCliente(ctx: RouterContext<"/api/clientes/:id">) {
  const id = ctx.params.id;

  const resultado = await client.query(
    `SELECT id_cliente, nombre_completo, documento, telefono, correo, fecha_registro
     FROM clientes WHERE id_cliente = ?`,
    [id]
  );

  if (resultado.length === 0) {
    ctx.response.status = 404;
    ctx.response.body = { error: "Cliente no encontrado" };
    return;
  }

  ctx.response.status = 200;
  ctx.response.body = resultado[0];
}

// ---------- Registrar ----------
export async function crearCliente(ctx: Context) {
  const body = await ctx.request.body.json();
  const parsed = clienteSchema.safeParse(body);

  if (!parsed.success) {
    ctx.response.status = 400;
    ctx.response.body = { error: parsed.error.errors[0].message };
    return;
  }

  const { nombre_completo, documento, telefono, correo } = parsed.data;

  const existente = await client.query(
    `SELECT id_cliente FROM clientes WHERE documento = ? OR correo = ?`,
    [documento, correo]
  );
  if (existente.length > 0) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Ya existe un cliente con ese documento o correo" };
    return;
  }

  const resultado = await client.execute(
    `INSERT INTO clientes (nombre_completo, documento, telefono, correo) VALUES (?, ?, ?, ?)`,
    [nombre_completo, documento, telefono, correo]
  );

  ctx.response.status = 201;
  ctx.response.body = { mensaje: "Cliente registrado", id_cliente: resultado.lastInsertId };
}

// ---------- Actualizar ----------
export async function actualizarCliente(ctx: RouterContext<"/api/clientes/:id">) {
  const id = ctx.params.id;
  const body = await ctx.request.body.json();
  const parsed = clienteUpdateSchema.safeParse(body);

  if (!parsed.success) {
    ctx.response.status = 400;
    ctx.response.body = { error: parsed.error.errors[0].message };
    return;
  }

  const existe = await client.query(`SELECT id_cliente FROM clientes WHERE id_cliente = ?`, [id]);
  if (existe.length === 0) {
    ctx.response.status = 404;
    ctx.response.body = { error: "Cliente no encontrado" };
    return;
  }

  const datos = parsed.data;
  const campos = Object.keys(datos);

  if (campos.length === 0) {
    ctx.response.status = 400;
    ctx.response.body = { error: "No se enviaron campos para actualizar" };
    return;
  }

  // Si actualiza documento o correo, valida que no choque con otro cliente
  if (datos.documento || datos.correo) {
    const duplicado = await client.query(
      `SELECT id_cliente FROM clientes
       WHERE (documento = ? OR correo = ?) AND id_cliente != ?`,
      [datos.documento ?? "", datos.correo ?? "", id]
    );
    if (duplicado.length > 0) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Ese documento o correo ya pertenece a otro cliente" };
      return;
    }
  }

  const sets = campos.map((c) => `${c} = ?`).join(", ");
  const valores = campos.map((c) => (datos as Record<string, string>)[c]);

  await client.execute(
    `UPDATE clientes SET ${sets} WHERE id_cliente = ?`,
    [...valores, id]
  );

  ctx.response.status = 200;
  ctx.response.body = { mensaje: "Cliente actualizado" };
}

// ---------- Eliminar ----------
export async function eliminarCliente(ctx: RouterContext<"/api/clientes/:id">) {
  const id = ctx.params.id;

  const existe = await client.query(`SELECT id_cliente FROM clientes WHERE id_cliente = ?`, [id]);
  if (existe.length === 0) {
    ctx.response.status = 404;
    ctx.response.body = { error: "Cliente no encontrado" };
    return;
  }

  try {
    await client.execute(`DELETE FROM clientes WHERE id_cliente = ?`, [id]);
    ctx.response.status = 200;
    ctx.response.body = { mensaje: "Cliente eliminado" };
  } catch (error) {
    // La FK de "equipos" tiene ON DELETE RESTRICT (Regla 8) — MySQL rechaza el DELETE
    ctx.response.status = 400;
    ctx.response.body = {
      error: "No se puede eliminar: el cliente tiene equipos asociados. Elimina o reasigna sus equipos primero.",
    };
  }
}