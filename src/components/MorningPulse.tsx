export function MorningPulse() {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
      <div className="flex items-center justify-between text-sm font-medium text-slate-500">
        <span>Morning Pulse</span>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-600">
          Live
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-2xl font-semibold text-slate-950">25</p>
          <p className="mt-1 text-sm text-slate-500">Signals Remaining</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-2xl font-semibold text-slate-950">0</p>
          <p className="mt-1 text-sm text-slate-500">Calls Completed</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-2xl font-semibold text-slate-950">0</p>
          <p className="mt-1 text-sm text-slate-500">Conversations</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-2xl font-semibold text-slate-950">0</p>
          <p className="mt-1 text-sm text-slate-500">Meetings</p>
        </div>
      </div>
    </div>
  );
}
