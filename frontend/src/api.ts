import axios from 'axios';

// --- CORRECCIÓN FINAL ---
// Usamos solo '/api' para que funcione en la Nube y en el Celular.
// El sistema completará la dirección automáticamente.
export const api = axios.create({
  baseURL: '/api',
});

// Función auxiliar para descargar datos
export const fetcher = (url: string) => api.get(url).then((res) => res.data);