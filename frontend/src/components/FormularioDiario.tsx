import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, fetcher } from '../api';
import { Plus, Trash2, Save, FileDown, Calendar, User, Briefcase, RefreshCw, AlertTriangle } from 'lucide-react';

export function FormularioDiario({ idEdicion, alTerminar }: { idEdicion: number | null, alTerminar: () => void }) {
  const [ultimoId, setUltimoId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { register, control, handleSubmit, reset, watch } = useForm({
    defaultValues: {
      fecha: new Date().toISOString().split('T')[0],
      ordenCompra: '',
      turno: 'DIA',
      contratistaId: '',
      proyectoId: '',
      sectorId: '', 
      supervisorId: '',
      observaciones: '',
      detalles: [{ operarioId: '', actividadId: '', horas: 12 }]
    }
  });

  const fechaActual = watch('fecha');
  const sectorActual = watch('sectorId'); 
  const { fields, append, remove, replace } = useFieldArray({ control, name: "detalles" });

  const qOperarios = useQuery({ 
    queryKey: ['operarios', sectorActual], 
    queryFn: () => sectorActual ? fetcher(`/operarios?sectorId=${sectorActual}`) : [],
    enabled: !!sectorActual 
  });

  const qSectores = useQuery({ queryKey: ['sectores'], queryFn: () => fetcher('/sectores') });
  const qContratistas = useQuery({ queryKey: ['contratistas'], queryFn: () => fetcher('/contratistas') });
  const qProyectos = useQuery({ queryKey: ['proyectos'], queryFn: () => fetcher('/proyectos') });
  const qSupervisores = useQuery({ queryKey: ['supervisores'], queryFn: () => fetcher('/supervisores') });
  const qActividades = useQuery({ queryKey: ['actividades'], queryFn: () => fetcher('/actividades') });

  useEffect(() => {
    if (idEdicion) {
      api.get(`/formularios/${idEdicion}`).then((res) => {
        const data = res.data;
        reset({
          fecha: data.fecha.split('T')[0],
          ordenCompra: data.ordenCompra,
          turno: data.turno,
          contratistaId: data.contratistaId,
          proyectoId: data.proyectoId,
          sectorId: data.sectorId,
          supervisorId: data.supervisorId,
          observaciones: data.observaciones,
          detalles: []
        });
        setTimeout(() => {
            replace(data.detalles.map((d: any) => ({
              operarioId: d.operarioId,
              actividadId: d.actividadId,
              horas: d.horas
            })));
        }, 500);
      });
    } else {
      reset({ fecha: new Date().toISOString().split('T')[0], ordenCompra: '', turno: 'DIA', detalles: [{ operarioId: '', actividadId: '', horas: 12 }] });
    }
  }, [idEdicion, reset, replace]);

  const mutation = useMutation({
    mutationFn: (data: any) => {
      if (idEdicion) return api.put(`/formularios/${idEdicion}`, data);
      return api.post('/formularios', data);
    },
    onSuccess: (respuesta) => {
      setUltimoId(respuesta.data.id || idEdicion); // Guardamos el ID editado o creado
      queryClient.invalidateQueries({ queryKey: ['historial'] });
      alert(idEdicion ? '¡Modificación guardada!' : '¡Parte Diario Creado!');
      if (!idEdicion) reset({ fecha: fechaActual, ordenCompra: '', turno: 'DIA', detalles: [{ operarioId: '', actividadId: '', horas: 12 }] });
    },
    onError: (err: any) => alert('Error al guardar: ' + (err.response?.data?.error || 'Desconocido'))
  });

  const onSubmit = (data: any) => { setUltimoId(null); mutation.mutate(data); };

  // CORRECCIÓN: Botón PDF funciona con ID recién creado O con ID que estamos editando
  const idParaPDF = ultimoId || idEdicion;
  const descargarPDF = () => idParaPDF && window.open(`/api/reportes/pdf/${idParaPDF}`, '_blank');

  if (qSectores.isLoading) return <div className="text-gray-400 p-10">Cargando...</div>;

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-800 pb-6">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            {idEdicion ? ( <span className="text-orange-400 flex items-center gap-2"><RefreshCw/> Editando Parte #{idEdicion}</span> ) : "Nuevo Parte Diario"}
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            {idEdicion ? "Modifique los datos necesarios y guarde los cambios." : "Complete la información del turno y actividades."}
          </p>
        </div>
        
        {idEdicion && ( <button onClick={alTerminar} className="text-sm text-gray-400 hover:text-white underline">Cancelar edición</button> )}
        
        {/* Botón PDF visible siempre que tengamos un ID válido */}
        {idParaPDF && ( 
            <button onClick={descargarPDF} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium border border-green-500 flex items-center gap-2 animate-pulse">
                <FileDown size={16} /> Descargar PDF #{idParaPDF}
            </button> 
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4 text-blue-400"><Briefcase size={20} /> <h3 className="font-semibold text-white">Información</h3></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <InputGroup label="Fecha" icon={<Calendar size={14}/>}><input type="date" {...register("fecha")} className="input-pro" /></InputGroup>
            <InputGroup label="Orden de Compra"><input {...register("ordenCompra")} className="input-pro" placeholder="Nro Orden..." /></InputGroup>
            <InputGroup label="Turno"><select {...register("turno")} className="input-pro"><option value="DIA">DIA</option><option value="NOCHE">NOCHE</option></select></InputGroup>
            <InputGroup label="Supervisor"><select {...register("supervisorId", { required: true })} className="input-pro"><option value="">Seleccionar...</option>{qSupervisores.data?.map((i: any) => <option key={i.id} value={i.id}>{i.nombre}</option>)}</select></InputGroup>
            <div className="md:col-span-2">
                <label className="text-xs font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">Sector (Filtra Operarios)</label>
                <select {...register("sectorId", { required: true })} className="input-pro border-blue-500/30">
                    <option value="">Seleccionar Sector...</option>
                    {qSectores.data?.map((i: any) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
                </select>
            </div>
            <InputGroup label="Contratista"><select {...register("contratistaId", { required: true })} className="input-pro"><option value="">Seleccionar...</option>{qContratistas.data?.map((i: any) => <option key={i.id} value={i.id}>{i.nombre}</option>)}</select></InputGroup>
            <InputGroup label="Proyecto" fullWidth><select {...register("proyectoId", { required: true })} className="input-pro"><option value="">Seleccionar...</option>{qProyectos.data?.map((i: any) => <option key={i.id} value={i.id}>{i.nombre}</option>)}</select></InputGroup>
          </div>
        </div>

        <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2 text-blue-400"><User size={20} /><h3 className="font-semibold text-white">Detalle de Personal</h3></div>
            <button type="button" onClick={() => append({ operarioId: '', actividadId: '', horas: 12 })} className="btn-secondary text-xs"><Plus size={16} /> Agregar Fila</button>
          </div>
          {!sectorActual && <div className="bg-yellow-900/20 border border-yellow-700/50 text-yellow-200 p-4 rounded-lg mb-4 flex items-center gap-3 text-sm"><AlertTriangle size={20}/> Primero selecciona un Sector arriba.</div>}
          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="w-full text-left text-sm text-gray-400">
              <thead className="bg-[#0d1117] text-gray-200 uppercase text-xs font-semibold"><tr><th className="px-4 py-3">Operario</th><th className="px-4 py-3">Actividad</th><th className="px-4 py-3 w-24 text-center">Horas</th><th className="px-4 py-3 w-16"></th></tr></thead>
              <tbody className="divide-y divide-gray-800">
                {fields.map((field, index) => (
                  <tr key={field.id} className="hover:bg-gray-800/50">
                    <td className="p-2"><select {...register(`detalles.${index}.operarioId` as const, { required: true })} className="input-table" disabled={!sectorActual}><option value="">{sectorActual ? "Seleccionar..." : "Sin Sector"}</option>{qOperarios.data?.map((i: any) => <option key={i.id} value={i.id}>{i.nombre}</option>)}</select></td>
                    <td className="p-2"><select {...register(`detalles.${index}.actividadId` as const)} className="input-table"><option value="">Actividad...</option>{qActividades.data?.map((i: any) => <option key={i.id} value={i.id}>{i.nombre}</option>)}</select></td>
                    <td className="p-2"><input type="number" {...register(`detalles.${index}.horas` as const)} className="input-table text-center" /></td>
                    <td className="p-2 text-center"><button type="button" onClick={() => remove(index)} className="text-gray-500 hover:text-red-400"><Trash2 size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button type="submit" disabled={mutation.isPending} className={`px-8 py-3 rounded-xl font-bold text-lg shadow-lg flex items-center gap-3 transition-all transform hover:-translate-y-0.5 text-white ${idEdicion ? 'bg-orange-600 hover:bg-orange-500' : 'bg-blue-600 hover:bg-blue-500'}`}>
            {mutation.isPending ? 'Procesando...' : <><Save size={20}/> {idEdicion ? 'GUARDAR CAMBIOS' : 'GUARDAR PARTE'}</>}
          </button>
        </div>
      </form>
      <style>{`.input-pro { width: 100%; background: #0d1117; border: 1px solid #30363d; border-radius: 0.5rem; padding: 0.6rem 1rem; color: white; transition: all 0.2s; } .input-pro:focus { border-color: #3b82f6; outline: none; } .input-table { width: 100%; background: transparent; padding: 0.5rem; color: #e5e7eb; border-radius: 0.375rem; } .input-table:focus { background: #161b22; outline: none; box-shadow: 0 0 0 1px #3b82f6; } .btn-secondary { background: #30363d; color: white; padding: 0.4rem 0.8rem; border-radius: 0.5rem; display: flex; align-items: center; gap: 0.5rem; } .btn-secondary:hover { background: #4b5563; }`}</style>
    </div>
  );
}

function InputGroup({ label, children, fullWidth, icon }: any) {
  return ( <div className={`space-y-1.5 ${fullWidth ? 'md:col-span-2' : ''}`}><label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">{icon} {label}</label>{children}</div> );
}