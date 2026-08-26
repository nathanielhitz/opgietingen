import { INPUT_CLASS } from "./types";

/**
 * Datumveld met iOS-Safari-fix: een <input type="date"> heeft daar een intrinsieke
 * minimumbreedte en centreert/klipt zijn waarde in een smalle gridkolom.
 */
export function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-medium text-ink-faint">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${INPUT_CLASS} appearance-none [&::-webkit-date-and-time-value]:text-left`}
      />
    </label>
  );
}
