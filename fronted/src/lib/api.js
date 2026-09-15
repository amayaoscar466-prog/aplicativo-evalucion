// src/lib/api.js
const API_URL = import.meta.env.API_URL || 'http://localhost:8000/api';

async function apiFetch(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    // tu backend responde los errores como { error: "mensaje" }
    throw new Error(data?.error || 'Error al conectar con el servidor');
  }
  return data;
}

export async function login(correo, password) {
  return apiFetch('/login', { method: 'POST', body: { correo, password } });
}

export async function registrarCliente({ nombre_completo, documento, telefono, correo, password }) {
  return apiFetch('/registro', {
    method: 'POST',
    body: { nombre_completo, documento, telefono, correo, password },
  });
}