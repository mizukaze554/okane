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

  return { version: APP_VERSION, categories, accounts, transactions: [] };
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
    .filter((item) => item?.id && ["income", "outcome"].includes(item.type) && Number(item.amount) > 0)
    .map((item) => ({
      id: String(item.id),
      type: item.type,
      amount: Number(item.amount),
      categoryId: item.categoryId ? String(item.categoryId) : "",
      accountId: item.accountId ? String(item.accountId) : String(item.accessId || ""),
      note: item.note ? String(item.note).slice(0, 160) : "",
      date: isValidDate(item.date) ? item.date : todayString(),
      createdAt: item.createdAt || new Date().toISOString()
    }));

  return {
    version: APP_VERSION,
    categories: categories.length ? categories : defaults.categories,
    accounts: accounts.length ? accounts : defaults.accounts,
    transactions
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

