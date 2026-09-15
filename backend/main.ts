// main.ts
import { Application, oakCors } from "./dependencias.ts";
import { conectarDB } from "./Models/database.ts";

import authRoutes from "./Routes/auth.routes.ts";
import clientesRoutes from "./Routes/clientes.routes.ts";
import equiposRoutes from "./Routes/equipos.routes.ts";
import tecnicosRoutes from "./Routes/ordenes.routes.ts";
import ordenesRoutes from "./Routes/tecnicos.routes.ts";

const app = new Application();

// Conexión a la base de datos antes de levantar el servidor
await conectarDB();

// Middlewares globales (SIEMPRE antes de app.listen)
app.use(oakCors());

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error : any ) {
    console.error(error );
    ctx.response.status = error.status || 500;
    ctx.response.body = { error: error.message || "Error interno del servidor" };
  }
});

// Rutas
app.use(authRoutes.routes());
app.use(authRoutes.allowedMethods());

app.use(clientesRoutes.routes());
app.use(clientesRoutes.allowedMethods());

app.use(equiposRoutes.routes());
app.use(equiposRoutes.allowedMethods());

app.use(tecnicosRoutes.routes());
app.use(tecnicosRoutes.allowedMethods());

app.use(ordenesRoutes.routes());
app.use(ordenesRoutes.allowedMethods());

const PORT = 8000;
console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
await app.listen({ port: PORT });