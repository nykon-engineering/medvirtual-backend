export function formatTimestampToUSShort(timestamp: number | string): string {
  const ts = Number(timestamp);
  const d = new Date(ts);

  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const year = String(d.getUTCFullYear()).slice(-2);

  return `${month}/${day}/${year}`;
}
