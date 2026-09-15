// middleware/auth.middleware.ts
import { verify, load } from "../dependencias.ts";
import type { Context } from "../dependencias.ts";

const env = await load({ envPath: "./.env" });
const encoder = new TextEncoder();

const key = await crypto.subtle.importKey(
  "raw",
  encoder.encode(env.JWT_SECRET),
  { name: "HMAC", hash: "SHA-512" },
  false,
  ["sign", "verify"]
);

export async function verificarToken(ctx: Context, next: () => Promise<unknown>) {
  const authHeader = ctx.request.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    ctx.response.status = 401;
    ctx.response.body = { error: "Token no proporcionado" };
    return;
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const payload = await verify(token, key);
    ctx.state.usuario = payload; // disponible en los controladores como ctx.state.usuario
    await next();
  } catch (_error) {
    ctx.response.status = 401;
    ctx.response.body = { error: "Token inválido o expirado" };
  }
}

export { key }; // se reutiliza al firmar el token en el login