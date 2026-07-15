type DispositionPanelProps = {
  selectedDisposition: string | null;
  notes: string;
  onDispositionChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
};

const dispositionOptions = [
  "Conversation",
  "Meeting Booked",
  "Voicemail",
  "No Answer",
  "Bad Number",
  "Wrong Contact",
];

export function DispositionPanel({
  selectedDisposition,
  notes,
  onDispositionChange,
  onNotesChange,
  onSave,
  onCancel,
}: DispositionPanelProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-2 sm:grid-cols-2">
        {dispositionOptions.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onDispositionChange(option)}
            className={`rounded-xl border px-3 py-2 text-left text-sm font-medium transition ${
              selectedDisposition === option
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="outcome-notes">
        Notes
      </label>
      <textarea
        id="outcome-notes"
        rows={3}
        value={notes}
        onChange={(event) => onNotesChange(event.target.value)}
        placeholder="Add a short note"
        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:bg-white"
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={!selectedDisposition}
          className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Save Outcome
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition duration-200 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
