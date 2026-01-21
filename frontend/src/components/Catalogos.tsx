import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, fetcher } from '../api';
import { Trash2, Plus, AlertCircle } from 'lucide-react';

export function AdministradorCatalogos() {
  const [catalogoActivo, setCatalogoActivo] = useState('sectores');

  const catalogos = [
    { id: 'sectores', label: 'Sectores' },
    { id: 'contratistas', label: 'Contratistas' },
    { id: 'proyectos', label: 'Proyectos' },
    { id: 'supervisores', label: 'Supervisores' },
    { id: 'operarios', label: 'Operarios' },
    { id: 'actividades', label: 'Actividades' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white mb-6">Administración de Catálogos</h2>
      
      {/* Pestañas */}
      <div className="flex flex-wrap gap-2 border-b border-gray-800 pb-4">
        {catalogos.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCatalogoActivo(cat.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              catalogoActivo === cat.id 
                ? 'bg-blue-600 text-white' 
                : 'bg-[#161b22] text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <CrudCatalogo endpoint={catalogoActivo} key={catalogoActivo} />
    </div>
  );
}

function CrudCatalogo({ endpoint }: { endpoint: string }) {
  const queryClient = useQueryClient();
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [sectorSeleccionado, setSectorSeleccionado] = useState(''); // Para operarios

  // Cargamos items
  const { data: items, isLoading } = useQuery({ 
    queryKey: [endpoint], 
    queryFn: () => fetcher(`/${endpoint}`) 
  });

  // Cargamos sectores EXTRA si estamos en operarios (para el dropdown)
  const qSectores = useQuery({
    queryKey: ['sectores'],
    queryFn: () => fetcher('/sectores'),
    enabled: endpoint === 'operarios' // Solo se carga si estamos en operarios
  });

  // Crear
  const crearMutation = useMutation({
    mutationFn: (data: any) => api.post(`/${endpoint}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [endpoint] });
      setNuevoNombre('');
      setSectorSeleccionado('');
    },
    onError: () => alert('Error al crear')
  });

  // Borrar
  const borrarMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/${endpoint}/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [endpoint] })
  });

  const handleCrear = (e: any) => {
    e.preventDefault();
    if (!nuevoNombre.trim()) return;
    
    const payload: any = { nombre: nuevoNombre };
    
    // Si es operario, exigimos sector
    if (endpoint === 'operarios') {
      if (!sectorSeleccionado) return alert("Debes seleccionar un Sector para el operario.");
      payload.sectorId = sectorSeleccionado;
    }

    crearMutation.mutate(payload);
  };

  if (isLoading) return <div className="text-gray-500">Cargando...</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
      
      {/* FORMULARIO DE CREACIÓN */}
      <div className="bg-[#161b22] p-6 rounded-xl border border-gray-800 h-fit">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Plus size={18} className="text-blue-400"/> Agregar Nuevo
        </h3>
        <form onSubmit={handleCrear} className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 uppercase font-bold">Nombre</label>
            <input 
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-2 text-white focus:border-blue-500 outline-none mt-1"
              placeholder="Escriba aquí..."
            />
          </div>

          {/* Selector de Sector (SOLO PARA OPERARIOS) */}
          {endpoint === 'operarios' && (
            <div>
              <label className="text-xs text-gray-500 uppercase font-bold">Pertenece al Sector</label>
              <select 
                value={sectorSeleccionado}
                onChange={(e) => setSectorSeleccionado(e.target.value)}
                className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-2 text-white focus:border-blue-500 outline-none mt-1"
              >
                <option value="">Seleccionar Sector...</option>
                {qSectores.data?.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
              <p className="text-xs text-orange-400 mt-2 flex items-center gap-1">
                <AlertCircle size={12}/> Importante: El operario solo aparecerá cuando se elija este sector.
              </p>
            </div>
          )}

          <button 
            type="submit" 
            disabled={crearMutation.isPending}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-lg transition-colors"
          >
            {crearMutation.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </form>
      </div>

      {/* LISTA */}
      <div className="bg-[#161b22] rounded-xl border border-gray-800 overflow-hidden">
        <div className="bg-[#0d1117] px-4 py-3 border-b border-gray-800">
          <h3 className="text-sm font-bold text-gray-400 uppercase">Listado Actual</h3>
        </div>
        <div className="divide-y divide-gray-800 max-h-[500px] overflow-y-auto">
          {items?.map((item: any) => (
            <div key={item.id} className="p-4 flex justify-between items-center hover:bg-gray-800/50">
              <span className="text-gray-200">{item.nombre}</span>
              <button 
                onClick={() => borrarMutation.mutate(item.id)}
                className="text-gray-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-900/20 transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
          {items?.length === 0 && <div className="p-8 text-center text-gray-600">Lista vacía.</div>}
        </div>
      </div>

    </div>
  );
}