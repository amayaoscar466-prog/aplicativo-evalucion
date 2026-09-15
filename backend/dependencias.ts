// dependencias.ts

export { Application, Router, Context, Status } from "oak/mod.ts";
export type { RouterContext } from "oak/mod.ts";
export { oakCors } from "cors/mod.ts";
export { Client } from "mysql/mod.ts";
export {
  create,
  verify,
  decode,
  getNumericDate,
} from "djwt/mod.ts";
export type { Header, Payload } from "djwt/mod.ts";
export { z } from "zod";
export { load } from "dotenv/mod.ts";
// dependencias.ts (agregar a lo que ya tenías)

export { SMTPClient } from "denomailer/mod.ts";

// bcryptjs viene de npm, se importa distinto
import bcrypt from "bcryptjs";
export { bcrypt };