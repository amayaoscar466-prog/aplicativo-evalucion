// middleware/roles.middleware.ts
import type { Context } from "../dependencias.ts";

export function verificarRol(rolesPermitidos: string[]) {
  return async (ctx: Context, next: () => Promise<unknown>) => {
    const usuario = ctx.state.usuario as { rol: string } | undefined;

    if (!usuario || !rolesPermitidos.includes(usuario.rol)) {
      ctx.response.status = 403;
      ctx.response.body = { error: "No tienes permisos para realizar esta acción" };
      return;
    }

    await next();
  };
}