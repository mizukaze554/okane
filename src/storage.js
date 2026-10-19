export const STORAGE_KEY = "minimalFinanceControlState";
export const VERSION = "2.0.0";

export function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function localDate(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

export function parseDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parts = value.split("-").map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2], 12);
  return date.getFullYear() === parts[0] && date.getMonth() === parts[1] - 1 && date.getDate() === parts[2] ? date : null;
}

export function moneyAmount(value, allowZero = false) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < (allowZero ? 0 : 1) || number > 1000000000000) return null;
  return number;
}

export function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function safeText(value, length = 120) {
  return String(value ?? "").slice(0, length);
}

function safeId(value) {
  const string = safeText(value, 100);
  return string || uid();
}

export function initialState() {
  const category = (name, type) => ({ id: uid(), name, type });
  return {
    version: VERSION,
    settings: { openingBalance: 0 },
    categories: [
      ...["Salary", "Gift", "Bonus", "Other Income"].map(name => category(name, "income")),
      ...["Food", "Transport", "Shopping", "Bills", "Health", "Entertainment", "Other Expense"].map(name => category(name, "outcome"))
    ],
    transactions: [],
    transportRules: [],
    recurringRules: [],
    budgets: [],
    goals: [],
    generatedKeys: []
  };
}

export function sanitizeState(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid backup structure");
  if (input.version && !["1.0.0", VERSION].includes(input.version)) {
    throw new Error("Unsupported backup version: " + input.version);
  }
  if (!Array.isArray(input.transactions) || !Array.isArray(input.categories)) {
    throw new Error("Backup requires transactions and categories arrays");
  }
  const defaults = initialState();
  // v1 stored separate access sources. Collapse them into exactly one opening balance.
  const previousOpening = Array.isArray(input.accesses)
    ? input.accesses.reduce((sum, item) => sum + (moneyAmount(item.initialBalance, true) ?? 0), 0)
    : 0;
  const openingBalance = moneyAmount(input.settings?.openingBalance, true)
    ?? moneyAmount(previousOpening, true) ?? 0;
  const categories = input.categories.filter(x => x && x.id && x.name &&
    ["income", "outcome", "both"].includes(x.type)).map(x => ({
      id: safeId(x.id), name: safeText(x.name, 60), type: x.type
    }));
  const categoryList = categories.length ? categories : defaults.categories;
  const transactions = input.transactions.filter(x => x && x.id &&
    ["income", "outcome"].includes(x.type) && moneyAmount(x.amount) !== null).map(x => ({
      id: safeId(x.id),
      type: x.type,
      amount: moneyAmount(x.amount),
      categoryId: safeText(x.categoryId, 100),
      note: safeText(x.note, 160),
      date: parseDate(x.date) ? x.date : localDate(),
      origin: ["manual", "transport", "recurring"].includes(x.origin) ? x.origin : "manual",
      originKey: safeText(x.originKey, 200),
      createdAt: safeText(x.createdAt, 40) || new Date().toISOString()
    }));
  const validDates = x => parseDate(x.startDate);
  const transportRules = (Array.isArray(input.transportRules) ? input.transportRules : [])
    .filter(x => x && x.name && validDates(x) && moneyAmount(x.outboundFare, true) !== null &&
      moneyAmount(x.returnFare, true) !== null && (Number(x.outboundFare) + Number(x.returnFare) > 0))
    .map(x => ({
      id: safeId(x.id), name: safeText(x.name, 60), outboundFare: moneyAmount(x.outboundFare, true),
      returnFare: moneyAmount(x.returnFare, true), workDays: Math.min(31, Math.max(1, Math.trunc(Number(x.workDays) || 20))),
      mode: x.mode === "daily" ? "daily" : "monthly", weekdays: Array.isArray(x.weekdays)
        ? [...new Set(x.weekdays.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6))]
        : [1, 2, 3, 4, 5],
      startDate: x.startDate, active: x.active !== false,
      excludedDates: Array.isArray(x.excludedDates) ? x.excludedDates.filter(d => parseDate(d)).slice(0, 150) : [],
      categoryId: safeText(x.categoryId, 100)
    }));
  const recurringRules = (Array.isArray(input.recurringRules) ? input.recurringRules : [])
    .filter(x => x && x.name && validDates(x) && moneyAmount(x.amount) !== null &&
      ["income", "outcome"].includes(x.type) && ["daily", "weekly", "monthly"].includes(x.frequency))
    .map(x => ({
      id: safeId(x.id), name: safeText(x.name, 60), type: x.type, amount: moneyAmount(x.amount),
      categoryId: safeText(x.categoryId, 100), startDate: x.startDate, frequency: x.frequency,
      active: x.active !== false
    }));
  const budgets = (Array.isArray(input.budgets) ? input.budgets : [])
    .filter(x => x && x.categoryId && moneyAmount(x.limit) !== null)
    .map(x => ({ id: safeId(x.id), categoryId: safeText(x.categoryId, 100), limit: moneyAmount(x.limit) }));
  const goals = (Array.isArray(input.goals) ? input.goals : [])
    .filter(x => x && x.name && moneyAmount(x.target) !== null)
    .map(x => ({
      id: safeId(x.id), name: safeText(x.name, 60), target: moneyAmount(x.target),
      progress: Math.min(moneyAmount(x.progress, true) ?? 0, moneyAmount(x.target)),
      deadline: parseDate(x.deadline) ? x.deadline : ""
    }));
  const generatedKeys = (Array.isArray(input.generatedKeys) ? input.generatedKeys : [])
    .filter(x => typeof x === "string").map(x => x.slice(0, 200));
  return {
    version: VERSION, settings: { openingBalance }, categories: categoryList, transactions,
    transportRules, recurringRules, budgets, goals, generatedKeys: [...new Set(generatedKeys)]
  };
}

export function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return initialState();
  return sanitizeState(JSON.parse(raw));
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function downloadBackup(state) {
  const blob = new Blob([JSON.stringify({ ...state, version: VERSION, exportedAt: new Date().toISOString() }, null, 2)],
    { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "okane-" + localDate() + ".json";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
