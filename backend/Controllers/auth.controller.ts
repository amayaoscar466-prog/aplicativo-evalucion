// controllers/auth.controller.ts
import { z, create, getNumericDate, bcrypt } from "../dependencias.ts";
import type { Context } from "../dependencias.ts";
import { client } from "../Models/database.ts";
import { key } from "../Middlewares/auth.middleware.ts";
import { enviarCorreoVerificacionCuenta } from "../services/email.service.ts";

// ---------- Validaciones ----------
const loginSchema = z.object({
  correo: z.string().email("Correo inválido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});

const registroClienteSchema = z.object({
  nombre_completo: z.string().min(3, "El nombre es obligatorio"),
  documento: z.string().min(5, "Documento inválido"),
  telefono: z.string().min(7, "Teléfono inválido"),
  correo: z.string().email("Correo inválido"),
  password: z.string().min(6, "La contraseña debe tener mínimo 6 caracteres"),
});

// ---------- Login (Requerimiento 1) ----------
export async function login(ctx: Context) {
  const body = await ctx.request.body.json();
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    ctx.response.status = 400;
    ctx.response.body = { error: parsed.error.errors[0].message };
    return;
  }

  const { correo, password } = parsed.data;

  const resultado = await client.query(
    `SELECT u.id_usuario, u.nombre, u.correo, u.password_hash, u.estado,
            u.id_tecnico, u.id_cliente, r.nombre_rol
     FROM usuarios u
     JOIN roles r ON u.id_rol = r.id_rol
     WHERE u.correo = ?`,
    [correo]
  );

  if (resultado.length === 0) {
    ctx.response.status = 401;
    ctx.response.body = { error: "Credenciales incorrectas" };
    return;
  }

  const usuario = resultado[0];

  if (usuario.estado !== "Activo") {
    ctx.response.status = 401;
    ctx.response.body = { error: "El usuario se encuentra inactivo" };
    return;
  }

  const passwordValida = await bcrypt.compare(password, usuario.password_hash);
  if (!passwordValida) {
    ctx.response.status = 401;
    ctx.response.body = { error: "Credenciales incorrectas" };
    return;
  }

  const payload = {
    id_usuario: usuario.id_usuario,
    nombre: usuario.nombre,
    correo: usuario.correo,
    rol: usuario.nombre_rol,
    id_tecnico: usuario.id_tecnico,
    id_cliente: usuario.id_cliente,
    exp: getNumericDate(60 * 60), // 1 hora
  };

  const token = await create({ alg: "HS512", typ: "JWT" }, payload, key);

  ctx.response.status = 200;
  ctx.response.body = {
    mensaje: "Login exitoso",
    token,
    usuario: {
      id_usuario: usuario.id_usuario,
      nombre: usuario.nombre,
      correo: usuario.correo,
      rol: usuario.nombre_rol,
    },
  };
}

// ---------- Registro autoservicio de Cliente ----------
export async function registrarCliente(ctx: Context) {
  const body = await ctx.request.body.json();
  const parsed = registroClienteSchema.safeParse(body);

  if (!parsed.success) {
    ctx.response.status = 400;
    ctx.response.body = { error: parsed.error.errors[0].message };
    return;
  }

  const { nombre_completo, documento, telefono, correo, password } = parsed.data;

  // Documento y correo no deben repetirse (Requerimiento 2)
  const existente = await client.query(
    `SELECT id_cliente FROM clientes WHERE documento = ? OR correo = ?`,
    [documento, correo]
  );
  if (existente.length > 0) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Ya existe un cliente con ese documento o correo" };
    return;
  }

  const conn = await client.transaction(async (t) => {
    const clienteInsert = await t.execute(
      `INSERT INTO clientes (nombre_completo, documento, telefono, correo) VALUES (?, ?, ?, ?)`,
      [nombre_completo, documento, telefono, correo]
    );
    const idCliente = clienteInsert.lastInsertId!;

    const passwordHash = await bcrypt.hash(password);

    // id_rol = 4 -> Cliente (según los datos de prueba del script SQL)
    await t.execute(
      `INSERT INTO usuarios (nombre, correo, password_hash, id_rol, id_cliente)
       VALUES (?, ?, ?, 4, ?)`,
      [nombre_completo, correo, passwordHash, idCliente]
    );

    return idCliente;
  });

  // Fire-and-forget: no bloquea la respuesta al cliente
  enviarCorreoVerificacionCuenta(correo, nombre_completo);

  ctx.response.status = 201;
  ctx.response.body = { mensaje: "Cuenta creada correctamente", id_cliente: conn };
}