import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { Search, Edit, FileDown } from 'lucide-react';

// Función para formatear fecha visualmente
const formatearFechaVisual = (isoString: string) => {
  if (!isoString) return '-';
  // Tomamos la parte "YYYY-MM-DD" antes de la T, y la damos vuelta a "DD/MM/YYYY"
  return isoString.split('T')[0].split('-').reverse().join('/');
};

export function Historial({ alEditar }: { alEditar: (id: number) => void }) {
  const [busqueda, setBusqueda] = useState('');

  // Busca automáticamente cada vez que escribes
  const { data: formularios, isLoading } = useQuery({
    queryKey: ['historial', busqueda],
    queryFn: async () => {
      const res = await api.get(`/formularios/buscar?q=${busqueda}`);
      return res.data;
    }
  });

  // --- CORRECCIÓN CLAVE ---
  // Quitamos "http://localhost:3000" y dejamos solo la barra "/"
  // Esto hace que funcione tanto en tu PC como en el Celular/Nube
  const descargarPDF = (id: number) => window.open(`/api/reportes/pdf/${id}`, '_blank');

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-gray-800 pb-6">
        <h2 className="text-2xl font-bold text-white tracking-tight">Historial y Búsqueda</h2>
        
        {/* BUSCADOR */}
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-2.5 text-gray-500" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por ID #, Supervisor..." 
            className="w-full bg-[#161b22] border border-gray-700 rounded-xl py-2 pl-10 pr-4 text-white focus:border-blue-500 focus:outline-none"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-[#161b22] border border-gray-800 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm text-gray-400">
          <thead className="bg-[#0d1117] text-gray-200 uppercase text-xs font-semibold">
            <tr>
              <th className="px-6 py-4">ID #</th>
              <th className="px-6 py-4">Fecha</th>
              <th className="px-6 py-4">Supervisor</th>
              <th className="px-6 py-4">Sector</th>
              <th className="px-6 py-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {isLoading ? (
              <tr><td colSpan={5} className="p-8 text-center">Buscando...</td></tr>
            ) : formularios?.map((f: any) => (
              <tr key={f.id} className="hover:bg-gray-800/50 transition-colors">
                <td className="px-6 py-4 font-mono text-blue-400 font-bold">#{f.id}</td>
                
                <td className="px-6 py-4 text-gray-300">{formatearFechaVisual(f.fecha)}</td>
                
                <td className="px-6 py-4 text-white">{f.supervisor.nombre}</td>
                <td className="px-6 py-4">{f.sector.nombre}</td>
                <td className="px-6 py-4 flex justify-center gap-3">
                  <button 
                    onClick={() => alEditar(f.id)}
                    className="p-2 text-blue-400 hover:bg-blue-900/30 rounded-lg transition-colors"
                    title="Modificar"
                  >
                    <Edit size={18} />
                  </button>
                  <button 
                    onClick={() => descargarPDF(f.id)}
                    className="p-2 text-green-400 hover:bg-green-900/30 rounded-lg transition-colors"
                    title="Ver PDF"
                  >
                    <FileDown size={18} />
                  </button>
                </td>
              </tr>
            ))}
            {formularios?.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center italic">No se encontraron resultados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}