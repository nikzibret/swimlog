import { forwardRef } from "react";

type Format = "MMSS" | "HHMMSS";

interface Props
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "value" | "onChange" | "type" | "inputMode" | "placeholder"
  > {
  format: Format;
  value: string;
  onValueChange: (next: string) => void;
  placeholder?: string;
}

function formatDigits(digits: string, fmt: Format): string {
  const max = fmt === "MMSS" ? 4 : 6;
  const d = digits.replace(/\D/g, "").slice(0, max);
  if (fmt === "MMSS") {
    if (d.length <= 2) return d;
    return `${d.slice(0, 2)}:${d.slice(2)}`;
  }
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}:${d.slice(2)}`;
  return `${d.slice(0, 2)}:${d.slice(2, 4)}:${d.slice(4)}`;
}

export const TimeInput = forwardRef<HTMLInputElement, Props>(function TimeInput(
  { format, value, onValueChange, placeholder, ...rest },
  ref,
) {
  const display = formatDigits(value.replace(/\D/g, ""), format);
  const ph = placeholder ?? (format === "MMSS" ? "MM:SS" : "HH:MM:SS");

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={ph}
      value={display}
      onChange={(e) => {
        // Strip non-digits from the new raw value and reformat.
        // This makes backspace naturally remove the auto-inserted colon.
        const next = formatDigits(e.target.value, format);
        onValueChange(next);
      }}
      {...rest}
    />
  );
});
