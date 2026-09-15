// routes/ordenes.routes.ts
import { Router } from "../dependencias.ts";
import { verificarToken } from "../Middlewares/auth.middleware.ts";
import { verificarRol } from "../Middlewares/roles.middleware.ts";
import {
  crearOrden,
  listarOrdenes,
  obtenerOrden,
  actualizarOrden,
} from "../Controllers/ordenes.controller.ts";

const router = new Router();

router.post(
  "/api/ordenes",
  verificarToken,
  verificarRol(["SuperAdmin", "Administrador", "Cliente"]),
  crearOrden
);

router.get("/api/ordenes", verificarToken, listarOrdenes);
router.get("/api/ordenes/:id", verificarToken, obtenerOrden);

router.put(
  "/api/ordenes/:id",
  verificarToken,
  verificarRol(["SuperAdmin", "Administrador", "Tecnico"]),
  actualizarOrden
);

export default router;