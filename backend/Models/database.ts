// models/database.ts
import { Client } from "../dependencias.ts";
import { load } from "../dependencias.ts";

const env = await load({ envPath: "./.env" });

const client = new Client();

export async function conectarDB() {
  await client.connect({
    hostname: env.DB_HOST || "localhost",
    port: Number(env.DB_PORT) || 3306,
    username: env.DB_USER || "root",
    password: env.DB_PASSWORD || "",
    db: env.DB_NAME || "servicio_tecnico",
  });
  console.log("✅ Conexión a MySQL establecida");
}

export { client };