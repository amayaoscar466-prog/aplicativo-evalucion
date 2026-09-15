// routes/auth.routes.ts
import { Router } from "../dependencias.ts";
import { login, registrarCliente } from "../Controllers/auth.controller.ts";

const router = new Router();

router.post("/api/login", login);
router.post("/api/registro", registrarCliente);

export default router;