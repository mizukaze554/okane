import { APP_VERSION, STORAGE_KEY } from "./config.js";
import { createId, isValidDate, todayString } from "./utils.js";

export function createDefaultState() {
  const createdAt = new Date().toISOString();
  const categories = [
    ...["Salary", "Gift", "Bonus", "Other Income"].map((name) => ({ name, type: "income" })),
    ...["Food", "Transport", "Shopping", "Bills", "Health", "Entertainment", "Other Outcome"]
      .map((name) => ({ name, type: "outcome" }))
  ].map((category) => ({ id: createId(), ...category, createdAt }));

  const accounts = ["Cash", "Bank", "PayPay"].map((name) => ({
    id: createId(),
    name,
    initialBalance: 0,
    createdAt
  }));

  return {
    version: APP_VERSION,
    categories,
    accounts,
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

  const categories = sourceCategories
    .filter((item) => item?.id && item?.name)
    .map((item) => ({
      id: String(item.id),
      name: String(item.name).slice(0, 60),
      type: ["income", "outcome", "both"].includes(item.type) ? item.type : "both",
      createdAt: item.createdAt || new Date().toISOString()
    }));

  const accounts = sourceAccounts
    .filter((item) => item?.id && item?.name)
    .map((item) => ({
      id: String(item.id),
      name: String(item.name).slice(0, 60),
      initialBalance: Number(item.initialBalance) || 0,
      createdAt: item.createdAt || new Date().toISOString()
    }));

  const transactions = sourceTransactions
    .filter((item) => item?.id && ["income", "outcome", "transfer"].includes(item.type) && Number(item.amount) > 0)
    .map((item) => sanitizeTransaction(item));

  const transportRules = sanitizeList(input?.transportRules, (item) => ({
    id: String(item.id),
    name: String(item.name).slice(0, 60),
    goFare: positiveNumber(item.goFare),
    returnFare: positiveNumber(item.returnFare),
    days: Math.max(1, Math.min(31, Math.trunc(Number(item.days) || 1))),
    month: /^\d{4}-\d{2}$/.test(item.month) ? item.month : todayString().slice(0, 7),
    accountId: String(item.accountId || ""),
    categoryId: String(item.categoryId || ""),
    createdAt: item.createdAt || new Date().toISOString()
  })).filter((item) => item.goFare + item.returnFare > 0 && item.accountId && item.categoryId);

  const recurringRules = sanitizeList(input?.recurringRules, (item) => ({
    id: String(item.id),
    name: String(item.name).slice(0, 60),
    type: item.type === "income" ? "income" : "outcome",
    amount: positiveNumber(item.amount),
    day: Math.max(1, Math.min(31, Math.trunc(Number(item.day) || 1))),
    startMonth: /^\d{4}-\d{2}$/.test(item.startMonth) ? item.startMonth : todayString().slice(0, 7),
    accountId: String(item.accountId || ""),
    categoryId: String(item.categoryId || ""),
    active: item.active !== false,
    createdAt: item.createdAt || new Date().toISOString()
  })).filter((item) => item.amount > 0 && item.accountId && item.categoryId);

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
    categories: categories.length ? categories : defaults.categories,
    accounts: accounts.length ? accounts : defaults.accounts,
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

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
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
  if (item.type === "transfer") {
    return {
      ...base,
      fromAccountId: String(item.fromAccountId || ""),
      toAccountId: String(item.toAccountId || "")
    };
  }
  return {
    ...base,
    categoryId: item.categoryId ? String(item.categoryId) : "",
    accountId: item.accountId ? String(item.accountId) : String(item.accessId || ""),
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
  if (!Array.isArray(data.accounts) && !Array.isArray(data.accesses)) {
    throw new Error("accounts must be an array.");
  }
  if (!Array.isArray(data.transactions)) throw new Error("transactions must be an array.");
  ["transportRules", "recurringRules", "budgets", "savingsGoals"].forEach((key) => {
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

  save(state) {
    this.storage.setItem(STORAGE_KEY, JSON.stringify({ ...state, version: APP_VERSION }));
  }
}

