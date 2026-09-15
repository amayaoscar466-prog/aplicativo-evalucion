// routes/clientes.routes.ts
import { Router } from "../dependencias.ts";
import { verificarToken } from "../Middlewares/auth.middleware.ts";
import { verificarRol } from "../Middlewares/roles.middleware.ts";
import {
  listarClientes,
  obtenerCliente,
  crearCliente,
  actualizarCliente,
  eliminarCliente,
} from "../Controllers/clientes.controller.ts";

const router = new Router();

const soloGestion = verificarRol(["SuperAdmin", "Administrador"]);

router.get("/api/clientes", verificarToken, listarClientes);
router.get("/api/clientes/:id", verificarToken, obtenerCliente);
router.post("/api/clientes", verificarToken, soloGestion, crearCliente);
router.put("/api/clientes/:id", verificarToken, soloGestion, actualizarCliente);
router.delete("/api/clientes/:id", verificarToken, soloGestion, eliminarCliente);

export default router;