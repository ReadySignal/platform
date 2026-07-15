import { MorningPulse } from "./MorningPulse";

type HeaderProps = {
  opportunitiesRemaining?: number;
  callsCompleted?: number;
  conversations?: number;
  meetings?: number;
};

export function Header({
  opportunitiesRemaining = 0,
  callsCompleted = 0,
  conversations = 0,
  meetings = 0,
}: HeaderProps) {
  return (
    <header className="rounded-[28px] border border-slate-200/80 bg-white/80 px-6 py-8 shadow-[0_20px_80px_-35px_rgba(15,23,42,0.35)] backdrop-blur sm:px-8 lg:px-10 lg:py-10">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="mb-4 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-600">
            ReadySignal
          </div>

          <h1 className="text-4xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-5xl lg:text-6xl">
            Good Morning Alex
          </h1>

          <p className="mt-4 text-lg leading-8 text-slate-600">
            I analyzed 4,382 companies overnight.
          </p>

          <p className="mt-1 text-lg font-medium text-slate-700">
            I found {opportunitiesRemaining} opportunities still worth working today.
          </p>
        </div>

        <MorningPulse
          opportunitiesRemaining={opportunitiesRemaining}
          callsCompleted={callsCompleted}
          conversations={conversations}
          meetings={meetings}
        />
      </div>
    </header>
  );
}
