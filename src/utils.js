// Format an ISO date string for display (e.g. "20 Jun 2026, 09:00")
export function fmt(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Convert an ISO date string into the value a <input type="datetime-local">
// expects (YYYY-MM-DDTHH:mm) in local time.
export function toInputDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

// Convert a <input type="datetime-local"> value (local time, no timezone) into
// a full UTC ISO string before sending it to the API. Parsing happens in the
// browser, so the user's local timezone is applied correctly — the server then
// stores the right instant regardless of its own timezone (e.g. UTC on Render).
// Without this, saving shifts the displayed time by the local UTC offset.
// Returns null for an empty value.
export function fromInputDateTime(value) {
  if (!value) return null;
  const d = new Date(value); // interpreted in the browser's local timezone
  if (isNaN(d)) return null;
  return d.toISOString();
}
