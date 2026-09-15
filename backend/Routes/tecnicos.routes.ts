// routes/tecnicos.routes.ts
import { Router } from "../dependencias.ts";
import { verificarToken } from "../Middlewares/auth.middleware.ts";
import { verificarRol } from "../Middlewares/roles.middleware.ts";
import {
  listarTecnicos,
  obtenerTecnico,
  crearTecnico,
  actualizarTecnico,
  eliminarTecnico,
} from "../Controllers/tecnicos.controller.ts";

const router = new Router();

const soloGestion = verificarRol(["SuperAdmin", "Administrador"]);

router.get("/api/tecnicos", verificarToken, listarTecnicos);
router.get("/api/tecnicos/:id", verificarToken, obtenerTecnico);
router.post("/api/tecnicos", verificarToken, soloGestion, crearTecnico);
router.put("/api/tecnicos/:id", verificarToken, soloGestion, actualizarTecnico);
router.delete("/api/tecnicos/:id", verificarToken, soloGestion, eliminarTecnico);

export default router;