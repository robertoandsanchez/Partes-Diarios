import axios from 'axios';

// Conexión directa a tu servidor en el puerto 3000
export const api = axios.create({
  baseURL: 'http://localhost:3000/api',
});

// Función auxiliar para descargar datos
export const fetcher = (url: string) => api.get(url).then((res) => res.data);