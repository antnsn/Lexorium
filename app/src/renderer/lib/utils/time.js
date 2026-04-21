export function formatTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} - ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function parseTimestamp(ts) {
  if (!ts) return new Date(0);
  if (ts.includes('T')) return new Date(ts);
  const [datePart, timePart] = ts.split(' - ');
  if (!datePart || !timePart) return new Date(0);
  const [day, month, year] = datePart.split('.');
  const [hours, minutes] = timePart.split(':');
  return new Date(year, month - 1, day, hours, minutes);
}

export function relativeTime(ts) {
  const date = typeof ts === 'string' ? parseTimestamp(ts) : ts;
  const now = new Date();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatTimestamp(date);
}
