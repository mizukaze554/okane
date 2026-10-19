import { APP_VERSION, HISTORY_KEY, STORAGE_KEY } from "./config.js";
import { createId, isValidCurrency, isValidDate, todayString } from "./utils.js";

export function createDefaultState() {
  const createdAt = new Date().toISOString();
  const categories = [
    ...["Salary", "Gift", "Bonus", "Other Income"].map((name) => ({ name, type: "income" })),
    ...["Food", "Transport", "Shopping", "Bills", "Health", "Entertainment", "Debt Payment", "Other Expense"]
      .map((name) => ({ name, type: "outcome" }))
  ].map((category) => ({ id: createId(), ...category, createdAt }));

  return {
    version: APP_VERSION,
    preferences: { currency: "JPY", currencyInitialized: false, currencySource: "default", onboardingComplete: false, demoMode: false },
    categories,
    asset: { initialBalance: 0, updatedAt: createdAt, history: [] },
    debts: [],
    transactions: [],
    transportRules: [],
    recurringRules: [],
    budgets: [],
    savingsGoals: []
  };
}

export function sanitizeState(input) {
  const defaults = createDefaultState();
  const sourceCategories = Array.isArray(input?.categories) ? input.categories : [];
  const sourceAccounts = Array.isArray(input?.accounts)
    ? input.accounts
    : Array.isArray(input?.accesses) ? input.accesses : [];
  const sourceTransactions = Array.isArray(input?.transactions) ? input.transactions : [];
  const hasExistingFinanceData = sourceTransactions.length > 0 || sourceAccounts.length > 0 ||
    (Array.isArray(input?.debts) && input.debts.length > 0) || (Number(input?.asset?.initialBalance) || 0) !== 0;
  const requestedCurrency = String(input?.preferences?.currency || "JPY").toUpperCase();
  const preferences = {
    currency: isValidCurrency(requestedCurrency) ? requestedCurrency : "JPY",
    currencyInitialized: typeof input?.preferences?.currencyInitialized === "boolean"
      ? input.preferences.currencyInitialized
      : hasExistingFinanceData,
    currencySource: ["ip", "locale", "manual", "default"].includes(input?.preferences?.currencySource)
      ? input.preferences.currencySource
      : "default",
    onboardingComplete: typeof input?.preferences?.onboardingComplete === "boolean"
      ? input.preferences.onboardingComplete
      : hasExistingFinanceData,
    demoMode: input?.preferences?.demoMode === true
  };

  const categories = sourceCategories
    .filter((item) => item?.id && item?.name)
    .map((item) => ({
      id: String(item.id),
      name: String(item.name).toLowerCase() === "other outcome" ? "Other Expense" : String(item.name).slice(0, 60),
      type: ["income", "outcome", "both"].includes(item.type) ? item.type : "both",
      createdAt: item.createdAt || new Date().toISOString()
    }));

  const legacyDebtAccounts = sourceAccounts.filter((item) => item?.kind === "debt" || Number(item?.initialBalance) < 0);
  const asset = {
    initialBalance: input?.asset && Number.isFinite(Number(input.asset.initialBalance))
      ? Number(input.asset.initialBalance)
      : sourceAccounts.filter((item) => !legacyDebtAccounts.includes(item)).reduce((sum, item) => sum + (Number(item.initialBalance) || 0), 0),
    updatedAt: input?.asset?.updatedAt || new Date().toISOString(),
    history: sanitizeList(input?.asset?.history, (item) => ({
      id: String(item.id),
      previousBalance: finiteNumber(item.previousBalance),
      newBalance: finiteNumber(item.newBalance),
      note: item.note ? String(item.note).slice(0, 120) : "Opening balance updated",
      createdAt: item.createdAt || new Date().toISOString()
    })).slice(0, 50)
  };

  const debts = Array.isArray(input?.debts)
    ? sanitizeList(input.debts, sanitizeDebt).filter((item) => item.name && item.originalAmount > 0)
    : legacyDebtAccounts.map((item) => ({
      id: String(item.id),
      name: String(item.name).slice(0, 60),
      originalAmount: Math.abs(Number(item.initialBalance) || 0),
      createdAt: item.createdAt || new Date().toISOString()
    }));

  const transactions = sourceTransactions
    .filter((item) => item?.id && ["income", "outcome"].includes(item.type) && Number(item.amount) > 0)
    .map((item) => sanitizeTransaction(item));

  const transportRules = sanitizeList(input?.transportRules, (item) => ({
    id: String(item.id),
    name: String(item.name).slice(0, 60),
    goFare: positiveNumber(item.goFare),
    returnFare: positiveNumber(item.returnFare),
    days: Math.max(1, Math.min(31, Math.trunc(Number(item.days) || 1))),
    month: /^\d{4}-\d{2}$/.test(item.month) ? item.month : todayString().slice(0, 7),
    categoryId: String(item.categoryId || ""),
    createdAt: item.createdAt || new Date().toISOString()
  })).filter((item) => item.goFare + item.returnFare > 0 && item.categoryId);

  const recurringRules = sanitizeList(input?.recurringRules, (item) => ({
    id: String(item.id),
    name: String(item.name).slice(0, 60),
    type: item.type === "income" ? "income" : "outcome",
    amount: positiveNumber(item.amount),
    day: Math.max(1, Math.min(31, Math.trunc(Number(item.day) || 1))),
    startMonth: /^\d{4}-\d{2}$/.test(item.startMonth) ? item.startMonth : todayString().slice(0, 7),
    categoryId: String(item.categoryId || ""),
    active: item.active !== false,
    createdAt: item.createdAt || new Date().toISOString()
  })).filter((item) => item.amount > 0 && item.categoryId);

  const budgets = sanitizeList(input?.budgets, (item) => ({
    id: String(item.id),
    month: /^\d{4}-\d{2}$/.test(item.month) ? item.month : todayString().slice(0, 7),
    categoryId: String(item.categoryId || ""),
    limit: positiveNumber(item.limit),
    createdAt: item.createdAt || new Date().toISOString()
  })).filter((item) => item.limit > 0 && item.categoryId);

  const savingsGoals = sanitizeList(input?.savingsGoals, (item) => ({
    id: String(item.id),
    name: String(item.name).slice(0, 60),
    targetAmount: positiveNumber(item.targetAmount),
    savedAmount: Math.max(0, Number(item.savedAmount) || 0),
    targetDate: isValidDate(item.targetDate) ? item.targetDate : "",
    createdAt: item.createdAt || new Date().toISOString()
  })).filter((item) => item.name && item.targetAmount > 0);

  return {
    version: APP_VERSION,
    preferences,
    categories: ensureDebtCategory(categories.length ? categories : defaults.categories),
    asset,
    debts,
    transactions,
    transportRules,
    recurringRules,
    budgets,
    savingsGoals
  };
}

function sanitizeList(value, mapper) {
  return (Array.isArray(value) ? value : [])
    .filter((item) => item?.id)
    .map(mapper);
}

function sanitizeDebt(item) {
  return {
    id: String(item.id),
    name: String(item.name || "").slice(0, 60),
    originalAmount: positiveNumber(item.originalAmount),
    createdAt: item.createdAt || new Date().toISOString()
  };
}

function ensureDebtCategory(categories) {
  if (categories.some((item) => item.name.toLowerCase() === "debt payment" && item.type !== "income")) return categories;
  return [...categories, { id: createId(), name: "Debt Payment", type: "outcome", createdAt: new Date().toISOString() }];
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function sanitizeTransaction(item) {
  const base = {
    id: String(item.id),
    type: item.type,
    amount: Number(item.amount),
    note: item.note ? String(item.note).slice(0, 160) : "",
    date: isValidDate(item.date) ? item.date : todayString(),
    createdAt: item.createdAt || new Date().toISOString()
  };
  return {
    ...base,
    categoryId: item.categoryId ? String(item.categoryId) : "",
    debtId: item.debtId ? String(item.debtId) : "",
    sourceType: item.sourceType ? String(item.sourceType) : "manual",
    sourceId: item.sourceId ? String(item.sourceId) : "",
    sourcePeriod: item.sourcePeriod ? String(item.sourcePeriod) : ""
  };
}

export function validateImport(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("File must contain a JSON object.");
  }
  if (!Array.isArray(data.categories)) throw new Error("categories must be an array.");
  if (!data.asset && !Array.isArray(data.accounts) && !Array.isArray(data.accesses)) {
    throw new Error("asset must be an object.");
  }
  if (!Array.isArray(data.transactions)) throw new Error("transactions must be an array.");
  ["debts", "transportRules", "recurringRules", "budgets", "savingsGoals"].forEach((key) => {
    if (key in data && !Array.isArray(data[key])) throw new Error(`${key} must be an array.`);
  });
}

export class StateStore {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
  }

  load() {
    try {
      const saved = this.storage.getItem(STORAGE_KEY);
      return saved ? sanitizeState(JSON.parse(saved)) : createDefaultState();
    } catch (error) {
      console.error("Unable to load saved data", error);
      return createDefaultState();
    }
  }

  save(state, { snapshot = false } = {}) {
    const next = JSON.stringify({ ...state, version: APP_VERSION });
    if (snapshot) this.snapshotCurrent(next);
    try {
      this.storage.setItem(STORAGE_KEY, next);
    } catch (error) {
      // Recovery copies should never prevent the primary finance data from saving.
      this.clearSnapshots();
      this.storage.setItem(STORAGE_KEY, next);
      console.warn("Local snapshots were cleared to make room for current data", error);
    }
  }

  getSnapshots() {
    try {
      const snapshots = JSON.parse(this.storage.getItem(HISTORY_KEY) || "[]");
      return Array.isArray(snapshots) ? snapshots : [];
    } catch {
      return [];
    }
  }

  restoreSnapshot(id) {
    const snapshot = this.getSnapshots().find((item) => item.id === id);
    if (!snapshot?.state) throw new Error("Local snapshot was not found.");
    return sanitizeState(snapshot.state);
  }

  clearSnapshots() {
    this.storage.removeItem?.(HISTORY_KEY);
  }

  snapshotCurrent(next) {
    try {
      const current = this.storage.getItem(STORAGE_KEY);
      if (!current || current === next) return;
      const snapshots = this.getSnapshots();
      snapshots.unshift({
        id: createId(),
        createdAt: new Date().toISOString(),
        state: JSON.parse(current)
      });
      let trimmed = snapshots.slice(0, 8);
      while (trimmed.length > 1 && JSON.stringify(trimmed).length > 1_000_000) trimmed.pop();
      this.storage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
    } catch (error) {
      console.warn("Unable to create local snapshot", error);
    }
  }
}

