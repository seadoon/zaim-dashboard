export function formatCurrency(amount: number, showPlusSign = false): string {
  const sign = showPlusSign && amount > 0 ? "+" : "";
  return `${sign}${amount.toLocaleString("ja-JP")}円`;
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat("ja-JP").format(num);
}

export function formatPercent(value: number, decimals: number = 1): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}${Math.abs(value).toFixed(decimals)}%`;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split("-");
  return `${year}年${parseInt(month)}月`;
}

export function getShortMonth(monthStr: string): string {
  const month = monthStr.split("-")[1];
  return `${parseInt(month)}月`;
}

export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("ja-JP", {
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatLastUpdated(lastUpdated: string | null, includeYear = false): string | null {
  if (!lastUpdated) return null;
  const date = new Date(lastUpdated);
  if (Number.isNaN(date.getTime())) return null;

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");

  if (includeYear) {
    return `${date.getFullYear()}/${month}/${day} ${hours}:${minutes}`;
  }
  return `${month}/${day} ${hours}:${minutes}`;
}
