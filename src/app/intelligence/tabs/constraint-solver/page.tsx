import { getConstraintSolverData } from "@/lib/intelligence/metrics";

const statusStyles = {
  ok: "border-green-800/60 bg-green-950/20 text-green-300",
  warning: "border-amber-800/60 bg-amber-950/20 text-amber-300",
  critical: "border-red-800/60 bg-red-950/20 text-red-300",
} as const;

const statusLabel = {
  ok: "OK",
  warning: "Alerta",
  critical: "Critico",
} as const;

export default async function ConstraintSolverTab() {
  const data = await getConstraintSolverData();

  if (!data.authenticated) {
    return (
      <div className="premium-card">
        <h2 className="text-2xl font-bold text-cyan-400 mb-2">Constraint Solver for Growth</h2>
        <p className="text-slate-300">Inicia sesion para cargar el diagnostico de restricciones.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="premium-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-cyan-400 mb-1">Constraint Solver for Growth</h2>
            <p className="text-slate-300">
              Diagnostico operativo para detectar cuellos de botella de crecimiento.
            </p>
          </div>
          <div
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
              data.blockedCount > 0 ? "bg-red-950/50 text-red-300" : "bg-green-950/50 text-green-300"
            }`}
          >
            {data.blockedCount > 0
              ? `${data.blockedCount} bloqueos criticos`
              : "Sin bloqueos criticos"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {data.constraints.map((constraint) => (
          <div key={constraint.id} className="premium-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">{constraint.title}</h3>
                <p className="text-sm text-slate-400 mt-1">{constraint.metric}</p>
              </div>
              <span
                className={`rounded-full border px-2 py-1 text-xs font-semibold ${
                  statusStyles[constraint.status]
                }`}
              >
                {statusLabel[constraint.status]}
              </span>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <p className="text-slate-400">
                Objetivo: <span className="text-slate-200">{constraint.target}</span>
              </p>
              <p className="text-slate-400">
                Siguiente accion: <span className="text-slate-200">{constraint.suggestion}</span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
