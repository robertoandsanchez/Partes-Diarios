// frontend/src/api.ts
import axios from 'axios';

// Creamos una conexión directa a tu servidor en el puerto 3000
export const api = axios.create({
  baseURL: 'http://localhost:3000/api',
});

// Esta función ayuda a que, si se cae internet, no explote todo
export const fetcher = (url: string) => api.get(url).then((res) => res.data);