// frontend/src/components/Catalogos.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, fetcher } from '../api';
import { Trash2, Plus, Save, X } from 'lucide-react';

// Estas son las pestañas exactas de tu imagen
const CATALOGOS = [
  { id: 'sectores', label: 'Sectores' },
  { id: 'contratistas', label: 'Contratistas' },
  { id: 'proyectos', label: 'Proyectos' },
  { id: 'supervisores', label: 'Supervisores' },
  { id: 'operarios', label: 'Operarios' },
  { id: 'actividades', label: 'Actividades' },
];

export function AdministradorCatalogos() {
  const [tabActual, setTabActual] = useState('sectores');
  const [nuevoItem, setNuevoItem] = useState('');
  const queryClient = useQueryClient();

  // 1. Cargar datos del backend automáticamente
  const { data: items, isLoading } = useQuery({
    queryKey: [tabActual],
    queryFn: () => fetcher(`/${tabActual}`),
  });

  // 2. Función para GUARDAR nuevo
  const crearMutacion = useMutation({
    mutationFn: (nombre: string) => api.post(`/${tabActual}`, { nombre }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [tabActual] });
      setNuevoItem(''); // Limpiar input
    },
    onError: () => alert('Error: ¿Quizás ya existe ese nombre?')
  });

  // 3. Función para BORRAR
  const borrarMutacion = useMutation({
    mutationFn: (id: number) => api.delete(`/${tabActual}/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [tabActual] }),
  });

  return (
    <div className="p-6 max-w-4xl mx-auto bg-gray-900 text-white min-h-screen font-sans">
      <h1 className="text-2xl font-bold mb-6 text-gray-100">Administrador de Catálogos</h1>

      {/* PESTAÑAS */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-700 pb-4">
        {CATALOGOS.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setTabActual(cat.id)}
            className={`px-4 py-2 rounded-t-lg transition-colors ${
              tabActual === cat.id
                ? 'bg-blue-600 text-white font-bold'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* CONTENIDO */}
      <div className="bg-gray-800 rounded-lg p-6 shadow-xl border border-gray-700">
        <h2 className="text-xl font-semibold mb-4 capitalize text-blue-400">
          Gestionar {tabActual}
        </h2>

        {/* INPUT PARA AGREGAR */}
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={nuevoItem}
            onChange={(e) => setNuevoItem(e.target.value)}
            placeholder={`Nuevo ${tabActual.slice(0, -1)}...`}
            className="flex-1 p-3 rounded bg-gray-700 border border-gray-600 focus:border-blue-500 focus:outline-none text-white"
            onKeyDown={(e) => e.key === 'Enter' && nuevoItem && crearMutacion.mutate(nuevoItem)}
          />
          <button
            onClick={() => nuevoItem && crearMutacion.mutate(nuevoItem)}
            disabled={crearMutacion.isPending}
            className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded flex items-center gap-2 font-medium transition-all"
          >
            <Plus size={20} /> Agregar
          </button>
        </div>

        {/* LISTA DE ELEMENTOS */}
        {isLoading ? (
          <p className="text-gray-400 animate-pulse">Cargando datos...</p>
        ) : (
          <ul className="space-y-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
            {items?.length === 0 && <p className="text-gray-500 italic">La lista está vacía.</p>}
            
            {items?.map((item: any) => (
              <li key={item.id} className="flex justify-between items-center p-3 bg-gray-750 hover:bg-gray-700 rounded border border-gray-700 group">
                <span className="text-lg">{item.nombre}</span>
                <button
                  onClick={() => {
                    if(confirm('¿Eliminar este elemento?')) borrarMutacion.mutate(item.id);
                  }}
                  className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-2"
                  title="Eliminar"
                >
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}