import { useState, useRef, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdministradorCatalogos } from './components/Catalogos';
import { FormularioDiario } from './components/FormularioDiario';
import { Historial } from './components/Historial'; // Importamos el nuevo componente
import { LayoutDashboard, FileText, FileSpreadsheet, X, Calendar, ChevronDown, Search } from 'lucide-react';

const queryClient = new QueryClient();

function App() {
  const [vista, setVista] = useState<'formulario' | 'catalogos' | 'historial'>('formulario');
  const [idEdicion, setIdEdicion] = useState<number | null>(null);

  // Función mágica: Cuando tocan "Editar" en el historial, vamos al formulario cargado
  const iniciarEdicion = (id: number) => {
    setIdEdicion(id);
    setVista('formulario');
  };

  const cancelarEdicion = () => {
    setIdEdicion(null); // Volvemos a modo "Nuevo"
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-[#0f111a] text-gray-100 font-sans relative">
        
        {/* HEADER */}
        <header className="bg-[#161b22] border-b border-gray-800 sticky top-0 z-40 shadow-xl">
          <div className="max-w-7xl mx-auto px-4 h-20 flex flex-col md:flex-row items-center justify-between gap-4 py-3 md:py-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-8 bg-blue-600 rounded-full"></div>
              <h1 className="text-xl font-extrabold bg-gradient-to-r from-blue-400 to-teal-300 bg-clip-text text-transparent tracking-wide">
                MINERÍA 360°
              </h1>
            </div>

            <nav className="flex items-center gap-3">
              <BotonTop 
                activo={vista === 'formulario'} 
                onClick={() => { setVista('formulario'); cancelarEdicion(); }} 
                icono={<FileText size={18} />} 
                texto={idEdicion ? "Editando..." : "Nuevo Parte"} 
              />
              <div className="w-px h-8 bg-gray-800 hidden md:block"></div>
              
              {/* BOTÓN HISTORIAL (NUEVO) */}
              <BotonTop 
                activo={vista === 'historial'} 
                onClick={() => setVista('historial')} 
                icono={<Search size={18} />} 
                texto="Historial" 
              />
              
              <div className="w-px h-8 bg-gray-800 hidden md:block"></div>
              
              <BotonTop 
                activo={vista === 'catalogos'} 
                onClick={() => setVista('catalogos')} 
                icono={<LayoutDashboard size={18} />} 
                texto="Catálogos" 
              />
              <div className="w-px h-8 bg-gray-800 hidden md:block"></div>
              <DropdownExcel />
            </nav>
          </div>
        </header>

        {/* CONTENIDO PRINCIPAL */}
        <main className="max-w-7xl mx-auto p-4 md:p-8">
          {vista === 'formulario' && <FormularioDiario idEdicion={idEdicion} alTerminar={cancelarEdicion} />}
          {vista === 'catalogos' && <AdministradorCatalogos />}
          {vista === 'historial' && <Historial alEditar={iniciarEdicion} />}
        </main>

      </div>
    </QueryClientProvider>
  );
}

// Botones y Dropdown (Misma lógica visual de antes)
function BotonTop({ activo, onClick, icono, texto }: any) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 font-medium text-sm ${activo ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-transparent text-gray-400 hover:text-white hover:bg-gray-800'}`}>
      {icono} <span>{texto}</span>
    </button>
  );
}

function DropdownExcel() {
  const [abierto, setAbierto] = useState(false);
  const [fechaDesde, setFechaDesde] = useState(new Date().toISOString().split('T')[0]);
  const [fechaHasta, setFechaHasta] = useState(new Date().toISOString().split('T')[0]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: any) { if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setAbierto(false); }
    document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownRef]);

  const descargarExcel = () => { window.open(`http://localhost:3000/api/reportes/excel?desde=${fechaDesde}&hasta=${fechaHasta}`, '_blank'); setAbierto(false); };

  return (
    <div className="relative" ref={dropdownRef}>
      <button onClick={() => setAbierto(!abierto)} className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-300 font-medium text-sm ${abierto ? 'bg-green-600 text-white border-green-500 shadow-lg' : 'bg-green-600/10 text-green-400 border-green-600/30 hover:bg-green-600 hover:text-white'}`}>
        <FileSpreadsheet size={18} /><span>Reportes</span><ChevronDown size={14} className={`transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`} />
      </button>
      {abierto && (
        <div className="absolute right-0 top-full mt-3 w-72 bg-[#161b22] border border-gray-700 rounded-xl shadow-2xl p-4 z-50">
          <div className="flex justify-between items-center mb-3 border-b border-gray-700 pb-2"><span className="text-xs font-bold text-gray-400 uppercase">Exportar Excel</span><button onClick={() => setAbierto(false)} className="text-gray-500 hover:text-white"><X size={16}/></button></div>
          <div className="space-y-3">
            <div className="space-y-1"><label className="text-xs text-gray-500 font-semibold ml-1">Desde:</label><div className="relative"><Calendar className="absolute left-3 top-2 text-gray-500" size={14} /><input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="w-full bg-[#0d1117] border border-gray-700 rounded-lg py-1.5 pl-9 pr-2 text-sm text-white focus:border-green-500 focus:outline-none" /></div></div>
            <div className="space-y-1"><label className="text-xs text-gray-500 font-semibold ml-1">Hasta:</label><div className="relative"><Calendar className="absolute left-3 top-2 text-gray-500" size={14} /><input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="w-full bg-[#0d1117] border border-gray-700 rounded-lg py-1.5 pl-9 pr-2 text-sm text-white focus:border-green-500 focus:outline-none" /></div></div>
            <button onClick={descargarExcel} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded-lg text-sm shadow-lg mt-2 flex justify-center items-center gap-2"><FileSpreadsheet size={16} /> Descargar</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;