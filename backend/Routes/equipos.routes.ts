// routes/equipos.routes.ts
import { Router } from "../dependencias.ts";
import { verificarToken } from "../Middlewares/auth.middleware.ts";
import { verificarRol } from "../Middlewares/roles.middleware.ts";
import {
  listarEquipos,
  obtenerEquipo,
  crearEquipo,
  actualizarEquipo,
  eliminarEquipo,
} from "../Controllers/equipos.controller.ts";

const router = new Router();

const soloGestion = verificarRol(["SuperAdmin", "Administrador"]);

router.get("/api/equipos", verificarToken, listarEquipos);
router.get("/api/equipos/:id", verificarToken, obtenerEquipo);
router.post("/api/equipos", verificarToken, soloGestion, crearEquipo);
router.put("/api/equipos/:id", verificarToken, soloGestion, actualizarEquipo);
router.delete("/api/equipos/:id", verificarToken, soloGestion, eliminarEquipo);

export default router;