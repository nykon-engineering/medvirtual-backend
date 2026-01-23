export function formatTimestampToUSShort(timestamp: number | string): string {
  const ts = Number(timestamp);
  const d = new Date(timestamp);

  console.log('Formatting timestamp:', ts, 'to date:', d);

  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const year = String(d.getUTCFullYear()).slice(-2);

  return `${month}/${day}/${year}`;
}

export function dateToTimestamp(dateString) {
  if (!dateString || typeof dateString !== "string") {
    return null;
  }
  const [year, month, day] = dateString.split("-").map(Number);

  const timestamp = Date.UTC(year, month - 1, day, 0, 0, 0);

  return String(timestamp); // em milissegundos
}

export function timestampToUSDate(timestamp) {
  if (!timestamp) return null;

  const ts = Number(timestamp); 

  if (isNaN(ts)) {
    console.error("invalid Timestamp:", timestamp);
    return null;
  }
  const date = new Date(ts);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${month}/${day}/${year}`;
}

//This function formats a Date object to 'YYYY-MM-DD' format for CA locale considering the specified time zone.
//en-CA locale is used because it follows the 'YYYY-MM-DD' format.
export function formatDateForCA(
  date: Date,
  timeZone: string
): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find(p => p.type === 'year')!.value;
  const month = parts.find(p => p.type === 'month')!.value;
  const day = parts.find(p => p.type === 'day')!.value;

  return `${year}-${month}-${day}`;
}
