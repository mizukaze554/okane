import { CURRENCY } from "./config.js";

let activeCurrency = CURRENCY;
const moneyFormatters = new Map();

const dateFormatter = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "short",
  day: "numeric"
});

export function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function todayString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function formatMoney(value) {
  if (!moneyFormatters.has(activeCurrency)) {
    moneyFormatters.set(activeCurrency, new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: activeCurrency,
      maximumFractionDigits: currencyFractionDigits(activeCurrency)
    }));
  }
  return moneyFormatters.get(activeCurrency).format(Number(value) || 0);
}

export function isValidCurrency(value) {
  const code = String(value || "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return false;
  if (typeof Intl.supportedValuesOf === "function" && !Intl.supportedValuesOf("currency").includes(code)) return false;
  try {
    new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function setCurrency(value) {
  activeCurrency = isValidCurrency(value) ? String(value).trim().toUpperCase() : CURRENCY;
  return activeCurrency;
}

export function getCurrency() {
  return activeCurrency;
}

export function normalizeMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return Number.NaN;
  const factor = 10 ** currencyFractionDigits(activeCurrency);
  return Math.round((number + Math.sign(number) * Number.EPSILON) * factor) / factor;
}

function currencyFractionDigits(currency) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency })
    .resolvedOptions().maximumFractionDigits;
}

export function formatDate(value) {
  return dateFormatter.format(new Date(`${value}T00:00:00`));
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

