import { getCapitalLevelsData } from "@/lib/intelligence/metrics";
import CapitalTargetPlanner from "@/components/intelligence/CapitalTargetPlanner.client";

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

export default async function CapitalLevelsTab() {
  const data = await getCapitalLevelsData();

  if (!data.authenticated) {
    return (
      <div className="premium-card">
        <h2 className="text-2xl font-bold text-gold mb-2">Capital Levels</h2>
        <p className="text-slate-300">Inicia sesion para ver tus metricas de capital.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="premium-card">
        <h2 className="text-2xl font-bold text-gold mb-2">Capital Levels</h2>
        <p className="text-slate-300">
          Vista consolidada de capital, balance y rendimiento cerrado en los ultimos 30 dias.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="premium-card">
          <p className="text-xs uppercase text-slate-400">Capital asignado</p>
          <p className="mt-2 text-2xl font-semibold text-white">${formatNumber(data.totalCapital)}</p>
          <p className="mt-1 text-xs text-slate-500">{data.totalAccounts} cuentas activas</p>
        </div>
        <div className="premium-card">
          <p className="text-xs uppercase text-slate-400">Balance actual</p>
          <p className="mt-2 text-2xl font-semibold text-white">${formatNumber(data.totalBalance)}</p>
          <p className="mt-1 text-xs text-slate-500">Snapshot consolidado de cuentas</p>
        </div>
        <div className="premium-card">
          <p className="text-xs uppercase text-slate-400">PnL neto 30d</p>
          <p
            className={`mt-2 text-2xl font-semibold ${
              data.netPnl30d >= 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            ${formatNumber(data.netPnl30d)}
          </p>
          <p className="mt-1 text-xs text-slate-500">{data.closedTrades30d} trades cerrados</p>
        </div>
        <div className="premium-card">
          <p className="text-xs uppercase text-slate-400">Win rate 30d</p>
          <p className="mt-2 text-2xl font-semibold text-white">{data.winRate30d.toFixed(1)}%</p>
          <p className="mt-1 text-xs text-slate-500">Solo operaciones cerradas</p>
        </div>
      </div>

      <CapitalTargetPlanner
        currentCapital={data.totalBalance}
        netPnl30d={data.netPnl30d}
        closedTrades30d={data.closedTrades30d}
        capitalByType={data.capitalByType}
      />

      <div className="premium-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-white">Top cuentas por balance</h3>
          <span className="text-xs text-slate-400">
            Reports 30d: {data.reports30d} | Evidence 30d: {data.evidence30d}
          </span>
        </div>

        {data.topAccounts.length === 0 ? (
          <p className="text-slate-400">No hay cuentas para mostrar.</p>
        ) : (
          <div className="max-w-full overflow-x-auto">
            <table className="table-mobile-cards w-full text-sm text-slate-200">
              <thead>
                <tr>
                  <th className="text-left py-2">Cuenta</th>
                  <th className="text-right py-2">Capital</th>
                  <th className="text-right py-2">Balance</th>
                  <th className="text-right py-2">PnL 30d</th>
                </tr>
              </thead>
              <tbody>
                {data.topAccounts.map((account) => (
                  <tr key={account.id} className="border-t border-slate-800/70">
                    <td data-label="Cuenta" className="py-2">{account.name}</td>
                    <td data-label="Capital" className="py-2 text-right">
                      {account.currency} {formatNumber(account.capital)}
                    </td>
                    <td data-label="Balance" className="py-2 text-right">
                      {account.currency} {formatNumber(account.balance)}
                    </td>
                    <td
                      data-label="PnL 30d"
                      className={`py-2 text-right ${
                        account.pnl30d >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {account.currency} {formatNumber(account.pnl30d)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
