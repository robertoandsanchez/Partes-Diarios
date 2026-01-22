// frontend/src/api.ts
import axios from 'axios';

// CAMBIO IMPORTANTE: Usamos '/api' (ruta relativa).
// Esto le dice al sistema: "Busca la API en la misma dirección web donde estoy ahora".
// Funciona en tu PC y funciona en Railway automáticamente.
export const api = axios.create({
  baseURL: '/api',
});

export const fetcher = (url: string) => api.get(url).then((res) => res.data);