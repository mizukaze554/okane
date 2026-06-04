"use strict";

const STORAGE_KEY = "minimalFinanceControlState";
const APP_VERSION = "1.0.0";
const CURRENCY = "JPY";

let state = loadState();
let toastTimer = null;

const money = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: CURRENCY,
  maximumFractionDigits: 0
});

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  bindEvents();
  setDefaultDate();
  updateNetworkStatus();
  renderAll();
  registerServiceWorker();
});

function cacheElements() {
  [
    "viewTitle", "networkStatus", "totalBalance", "totalIncome", "totalOutcome",
    "transactionCount", "monthIncome", "monthOutcome", "dashboardAccessSummary",
    "dashboardRecentTransactions", "quickAddButton", "incomeBar", "outcomeBar", "incomeBarValue", "outcomeBarValue",
    "transactionForm", "transactionAmount", "transactionCategory", "transactionAccess",
    "transactionNote", "transactionDate", "transactionList", "categoryForm",
    "categoryName", "categoryType", "categoryList", "accessForm", "accessName",
    "accessInitialBalance", "accessList", "searchInput", "filterType",
    "filterCategory", "filterAccess", "filterMonth", "clearFilters",
    "exportButton", "importFile", "resetButton", "backupStatus", "toast"
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.view));
  });

  els.quickAddButton.addEventListener("click", () => showView("add"));

  els.transactionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addTransaction();
  });

  document.querySelectorAll("input[name='transactionType']").forEach((input) => {
    input.addEventListener("change", renderTransactionCategoryOptions);
  });

  els.categoryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addCategory();
  });

  els.accessForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addAccess();
  });

  [els.searchInput, els.filterType, els.filterCategory, els.filterAccess, els.filterMonth].forEach((input) => {
    input.addEventListener("input", renderTransactions);
    input.addEventListener("change", renderTransactions);
  });

  els.clearFilters.addEventListener("click", () => {
    els.searchInput.value = "";
    els.filterType.value = "all";
    els.filterCategory.value = "all";
    els.filterAccess.value = "all";
    els.filterMonth.value = "";
    renderTransactions();
  });

  els.exportButton.addEventListener("click", exportData);
  els.importFile.addEventListener("change", importData);
  els.resetButton.addEventListener("click", resetData);
  window.addEventListener("online", updateNetworkStatus);
  window.addEventListener("offline", updateNetworkStatus);
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return initializeDefaultData();
    }

    const parsed = JSON.parse(saved);
    return sanitizeState(parsed);
  } catch (error) {
    console.error(error);
    return initializeDefaultData();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function initializeDefaultData() {
  const now = new Date().toISOString();
  const income = ["Salary", "Gift", "Bonus", "Other Income"].map((name) => ({
    id: createId(),
    name,
    type: "income",
    createdAt: now
  }));
  const outcome = ["Food", "Transport", "Shopping", "Bills", "Health", "Entertainment", "Other Outcome"].map((name) => ({
    id: createId(),
    name,
    type: "outcome",
    createdAt: now
  }));
  const accesses = ["Cash", "Bank", "PayPay"].map((name) => ({
    id: createId(),
    name,
    initialBalance: 0,
    createdAt: now
  }));

  return {
    version: APP_VERSION,
    categories: [...income, ...outcome],
    accesses,
    transactions: []
  };
}

function sanitizeState(input) {
  const clean = {
    version: typeof input?.version === "string" ? input.version : APP_VERSION,
    categories: Array.isArray(input?.categories) ? input.categories : [],
    accesses: Array.isArray(input?.accesses) ? input.accesses : [],
    transactions: Array.isArray(input?.transactions) ? input.transactions : []
  };

  clean.categories = clean.categories
    .filter((item) => item && item.id && item.name)
    .map((item) => ({
      id: String(item.id),
      name: String(item.name),
      type: ["income", "outcome", "both"].includes(item.type) ? item.type : "both",
      createdAt: item.createdAt || new Date().toISOString()
    }));

  clean.accesses = clean.accesses
    .filter((item) => item && item.id && item.name)
    .map((item) => ({
      id: String(item.id),
      name: String(item.name),
      initialBalance: Number(item.initialBalance) || 0,
      createdAt: item.createdAt || new Date().toISOString()
    }));

  clean.transactions = clean.transactions
    .filter((item) => item && item.id && item.type && Number(item.amount) > 0)
    .map((item) => ({
      id: String(item.id),
      type: item.type === "income" ? "income" : "outcome",
      amount: Number(item.amount),
      categoryId: item.categoryId ? String(item.categoryId) : "",
      accessId: item.accessId ? String(item.accessId) : "",
      note: item.note ? String(item.note) : "",
      date: isValidDate(item.date) ? item.date : todayString(),
      createdAt: item.createdAt || new Date().toISOString()
    }));

  if (!clean.categories.length || !clean.accesses.length) {
    const defaults = initializeDefaultData();
    clean.categories = clean.categories.length ? clean.categories : defaults.categories;
    clean.accesses = clean.accesses.length ? clean.accesses : defaults.accesses;
  }

  return clean;
}

function addTransaction() {
  const type = getTransactionType();
  const amount = Number(els.transactionAmount.value);
  const categoryId = els.transactionCategory.value;
  const accessId = els.transactionAccess.value;
  const note = els.transactionNote.value.trim();
  const date = els.transactionDate.value;

  if (!amount || amount <= 0) return showToast("Amount must be greater than 0.");
  if (!categoryId) return showToast("Category is required.");
  if (!accessId) return showToast("Access is required.");
  if (!isValidDate(date)) return showToast("Date is required.");

  state.transactions.unshift({
    id: createId(),
    type,
    amount,
    categoryId,
    accessId,
    note,
    date,
    createdAt: new Date().toISOString()
  });

  saveState();
  const selectedType = type;
  els.transactionAmount.value = "";
  els.transactionNote.value = "";
  document.querySelector(`input[name='transactionType'][value='${selectedType}']`).checked = true;
  els.transactionAccess.value = accessId;
  setDefaultDate();
  renderAll();
  els.transactionAccess.value = accessId;
  showToast("Transaction saved.");
}

function deleteTransaction(id) {
  state.transactions = state.transactions.filter((transaction) => transaction.id !== id);
  saveState();
  renderAll();
  showToast("Transaction deleted.");
}

function addCategory() {
  const name = els.categoryName.value.trim();
  const type = els.categoryType.value;

  if (!name) return showToast("Category name cannot be empty.");
  if (state.categories.some((category) => category.name.toLowerCase() === name.toLowerCase() && category.type === type)) {
    return showToast("That category already exists for this type.");
  }

  state.categories.push({
    id: createId(),
    name,
    type,
    createdAt: new Date().toISOString()
  });

  saveState();
  els.categoryForm.reset();
  renderAll();
  showToast("Category added.");
}

function deleteCategory(id) {
  const used = state.transactions.some((transaction) => transaction.categoryId === id);
  if (used && !confirm("This category is used by transactions. Delete it anyway? Old transactions will show Deleted category.")) {
    return;
  }

  state.categories = state.categories.filter((category) => category.id !== id);
  saveState();
  renderAll();
  showToast("Category deleted.");
}

function addAccess() {
  const name = els.accessName.value.trim();
  const initialBalance = Number(els.accessInitialBalance.value) || 0;

  if (!name) return showToast("Access name cannot be empty.");
  if (state.accesses.some((access) => access.name.toLowerCase() === name.toLowerCase())) {
    return showToast("That access already exists.");
  }

  state.accesses.push({
    id: createId(),
    name,
    initialBalance,
    createdAt: new Date().toISOString()
  });

  saveState();
  els.accessForm.reset();
  els.accessInitialBalance.value = "0";
  renderAll();
  showToast("Access added.");
}

function deleteAccess(id) {
  const used = state.transactions.some((transaction) => transaction.accessId === id);
  if (used && !confirm("This access is used by transactions. Delete it anyway? Old transactions will show Deleted access.")) {
    return;
  }

  state.accesses = state.accesses.filter((access) => access.id !== id);
  saveState();
  renderAll();
  showToast("Access deleted.");
}

function calculateTotals() {
  const currentMonth = todayString().slice(0, 7);
  return state.transactions.reduce((totals, transaction) => {
    const isIncome = transaction.type === "income";
    const isCurrentMonth = transaction.date.slice(0, 7) === currentMonth;

    totals.totalIncome += isIncome ? transaction.amount : 0;
    totals.totalOutcome += isIncome ? 0 : transaction.amount;
    totals.monthIncome += isIncome && isCurrentMonth ? transaction.amount : 0;
    totals.monthOutcome += !isIncome && isCurrentMonth ? transaction.amount : 0;
    totals.transactionCount += 1;
    return totals;
  }, {
    totalIncome: 0,
    totalOutcome: 0,
    monthIncome: 0,
    monthOutcome: 0,
    transactionCount: 0,
    totalBalance: state.accesses.reduce((sum, access) => sum + (Number(access.initialBalance) || 0), 0)
  });
}

function calculateAccessSummaries() {
  return state.accesses.map((access) => {
    const accessTransactions = state.transactions.filter((transaction) => transaction.accessId === access.id);
    const totalIncome = accessTransactions
      .filter((transaction) => transaction.type === "income")
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const totalOutcome = accessTransactions
      .filter((transaction) => transaction.type === "outcome")
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const initialBalance = Number(access.initialBalance) || 0;

    return {
      ...access,
      initialBalance,
      totalIncome,
      totalOutcome,
      currentBalance: initialBalance + totalIncome - totalOutcome
    };
  });
}

function exportData() {
  const payload = {
    ...state,
    version: APP_VERSION,
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `minimal-finance-control-${todayString()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  setBackupStatus("Exported current local data.");
  showToast("Export ready.");
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      validateImport(parsed);
      if (!confirm("Importing will replace all current local data. Continue?")) {
        event.target.value = "";
        return;
      }

      state = sanitizeState(parsed);
      state.version = APP_VERSION;
      saveState();
      renderAll();
      setBackupStatus("Imported data successfully.");
      showToast("Import complete.");
    } catch (error) {
      setBackupStatus(`Import failed: ${error.message}`);
      showToast("Import failed.");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function resetData() {
  const message = "Type RESET to permanently clear all local finance data.";
  if (prompt(message) !== "RESET") {
    return;
  }

  state = initializeDefaultData();
  saveState();
  setDefaultDate();
  renderAll();
  setBackupStatus("All data reset and defaults restored.");
  showToast("Data reset.");
}

function validateImport(data) {
  if (!data || typeof data !== "object") throw new Error("File must contain a JSON object.");
  if (!Array.isArray(data.categories)) throw new Error("categories must be an array.");
  if (!Array.isArray(data.accesses)) throw new Error("accesses must be an array.");
  if (!Array.isArray(data.transactions)) throw new Error("transactions must be an array.");
}

function renderAll() {
  renderDashboard();
  renderTransactionCategoryOptions();
  renderAccessOptions();
  renderFilterOptions();
  renderTransactions();
  renderCategories();
  renderAccesses();
}

function renderDashboard() {
  const totals = calculateTotals();
  const accessSummaries = calculateAccessSummaries();
  const realTotalBalance = accessSummaries.reduce((sum, access) => sum + access.currentBalance, 0);

  els.totalBalance.textContent = formatMoney(realTotalBalance);
  if (els.totalIncome) els.totalIncome.textContent = formatMoney(totals.totalIncome);
  if (els.totalOutcome) els.totalOutcome.textContent = formatMoney(totals.totalOutcome);
  if (els.transactionCount) els.transactionCount.textContent = String(totals.transactionCount);
  els.monthIncome.textContent = formatMoney(totals.monthIncome);
  els.monthOutcome.textContent = formatMoney(totals.monthOutcome);
  if (els.incomeBarValue) els.incomeBarValue.textContent = formatMoney(totals.monthIncome);
  if (els.outcomeBarValue) els.outcomeBarValue.textContent = formatMoney(totals.monthOutcome);

  const maxMonthly = Math.max(totals.monthIncome, totals.monthOutcome, 1);
  if (els.incomeBar) els.incomeBar.style.width = `${(totals.monthIncome / maxMonthly) * 100}%`;
  if (els.outcomeBar) els.outcomeBar.style.width = `${(totals.monthOutcome / maxMonthly) * 100}%`;

  els.dashboardAccessSummary.innerHTML = accessSummaries.length
    ? accessSummaries.map(renderAccessSummaryCard).join("")
    : `<div class="empty"><strong>No access yet</strong>Add an access source to start tracking balances.</div>`;

  renderDashboardRecentTransactions();
}

function renderTransactions() {
  const transactions = getFilteredTransactions();

  els.transactionList.innerHTML = transactions.length
    ? transactions.map(renderTransactionCard).join("")
    : `<div class="empty"><strong>No transactions yet</strong>Add your first income or outcome.</div>`;

  els.transactionList.querySelectorAll("[data-delete-transaction]").forEach((button) => {
    button.addEventListener("click", () => deleteTransaction(button.dataset.deleteTransaction));
  });
}

function renderDashboardRecentTransactions() {
  const recent = getSortedTransactions().slice(0, 5);

  els.dashboardRecentTransactions.innerHTML = recent.length
    ? recent.map(renderTransactionCard).join("")
    : `<div class="empty"><strong>No transactions yet</strong>Add your first income or outcome.</div>`;

  els.dashboardRecentTransactions.querySelectorAll("[data-delete-transaction]").forEach((button) => {
    button.addEventListener("click", () => deleteTransaction(button.dataset.deleteTransaction));
  });
}

function renderCategories() {
  els.categoryList.innerHTML = state.categories.length
    ? state.categories.map((category) => `
        <article class="finance-row">
          <div class="row-main">
            <p class="row-title">${escapeHtml(category.name)} <span class="pill">${category.type}</span></p>
            <p class="row-sub">${countCategoryTransactions(category.id)} transactions</p>
          </div>
          <button class="delete-link" type="button" data-delete-category="${category.id}">Delete</button>
        </article>
      `).join("")
    : `<div class="empty"><strong>No categories yet</strong>Add a category for income or outcome.</div>`;

  els.categoryList.querySelectorAll("[data-delete-category]").forEach((button) => {
    button.addEventListener("click", () => deleteCategory(button.dataset.deleteCategory));
  });
}

function renderAccesses() {
  const summaries = calculateAccessSummaries();
  els.accessList.innerHTML = summaries.length
    ? summaries.map((access) => renderAccessManagementRow(access)).join("")
    : `<div class="empty"><strong>No access sources yet</strong>Add cash, bank, card, or wallet.</div>`;

  els.accessList.querySelectorAll("[data-delete-access]").forEach((button) => {
    button.addEventListener("click", () => deleteAccess(button.dataset.deleteAccess));
  });
}

function renderTransactionCategoryOptions() {
  const type = getTransactionType();
  const categories = state.categories.filter((category) => category.type === type || category.type === "both");

  els.transactionCategory.innerHTML = `<option value="">Choose category</option>${categories
    .map((category) => `<option value="${category.id}">${escapeHtml(category.name)}</option>`)
    .join("")}`;
}

function renderAccessOptions() {
  els.transactionAccess.innerHTML = `<option value="">Choose access</option>${state.accesses
    .map((access) => `<option value="${access.id}">${escapeHtml(access.name)}</option>`)
    .join("")}`;
}

function renderFilterOptions() {
  els.filterCategory.innerHTML = `<option value="all">All categories</option>${state.categories
    .map((category) => `<option value="${category.id}">${escapeHtml(category.name)}</option>`)
    .join("")}`;
  els.filterAccess.innerHTML = `<option value="all">All access</option>${state.accesses
    .map((access) => `<option value="${access.id}">${escapeHtml(access.name)}</option>`)
    .join("")}`;
}

function renderTransactionCard(transaction) {
  const category = state.categories.find((item) => item.id === transaction.categoryId);
  const access = state.accesses.find((item) => item.id === transaction.accessId);
  const sign = transaction.type === "income" ? "+" : "-";

  return `
    <article class="finance-row">
      <div class="row-main">
        <p class="row-title">${escapeHtml(category?.name || "Deleted category")}</p>
        <p class="row-sub">${transaction.note ? escapeHtml(transaction.note) : escapeHtml(access?.name || "Deleted access")}</p>
        <p class="row-detail">${formatDate(transaction.date)} · ${escapeHtml(access?.name || "Deleted access")}</p>
      </div>
      <div class="row-side">
        <div class="amount ${transaction.type}">${sign}${formatMoney(transaction.amount)}</div>
        <span class="pill ${transaction.type}">${transaction.type}</span>
        <button class="delete-link" type="button" data-delete-transaction="${transaction.id}" aria-label="Delete transaction">Delete</button>
      </div>
    </article>
  `;
}

function renderAccessSummaryCard(access) {
  const max = Math.max(access.totalIncome, access.totalOutcome, Math.abs(access.currentBalance), 1);
  const progress = Math.min(100, Math.max(8, (Math.abs(access.currentBalance) / max) * 100));

  return `
    <article class="finance-row">
      <div class="row-main">
        <p class="row-title">${escapeHtml(access.name)}</p>
        <p class="row-sub">Initial ${formatMoney(access.initialBalance)} · In ${formatMoney(access.totalIncome)} · Out ${formatMoney(access.totalOutcome)}</p>
      </div>
      <div class="row-side">
        <div class="amount">${formatMoney(access.currentBalance)}</div>
      </div>
      <div class="access-progress" aria-hidden="true" style="--progress: ${progress}%"><span></span></div>
    </article>
  `;
}

function renderAccessManagementRow(access) {
  return `
    ${renderAccessSummaryCard(access).replace("</article>", `
      <button class="delete-link" type="button" data-delete-access="${access.id}">Delete</button>
      <p class="row-detail">${countAccessTransactions(access.id)} transactions</p>
    </article>`)}
  `;
}

function getFilteredTransactions() {
  const search = els.searchInput.value.trim().toLowerCase();
  const type = els.filterType.value;
  const categoryId = els.filterCategory.value;
  const accessId = els.filterAccess.value;
  const month = els.filterMonth.value;

  return getSortedTransactions()
    .filter((transaction) => type === "all" || transaction.type === type)
    .filter((transaction) => categoryId === "all" || transaction.categoryId === categoryId)
    .filter((transaction) => accessId === "all" || transaction.accessId === accessId)
    .filter((transaction) => !month || transaction.date.slice(0, 7) === month)
    .filter((transaction) => {
      if (!search) return true;
      const category = state.categories.find((item) => item.id === transaction.categoryId)?.name || "Deleted category";
      const access = state.accesses.find((item) => item.id === transaction.accessId)?.name || "Deleted access";
      return [category, access, transaction.note, transaction.date].join(" ").toLowerCase().includes(search);
    });
}

function getSortedTransactions() {
  return [...state.transactions].sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`));
}

function showView(viewId) {
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.id === viewId);
  });
  document.querySelectorAll(".nav-link").forEach((link) => {
    const mobileMoreViews = ["more", "categories", "access", "backup"];
    const isActive = link.dataset.view === viewId || (link.dataset.view === "more" && mobileMoreViews.includes(viewId));
    link.classList.toggle("active", isActive);
  });
  els.viewTitle.textContent = {
    dashboard: "Dashboard",
    add: "Add Transaction",
    transactions: "Transactions",
    more: "More",
    categories: "Categories",
    access: "Access",
    backup: "Backup"
  }[viewId] || "Dashboard";
}

function getTransactionType() {
  return document.querySelector("input[name='transactionType']:checked").value;
}

function countCategoryTransactions(id) {
  return state.transactions.filter((transaction) => transaction.categoryId === id).length;
}

function countAccessTransactions(id) {
  return state.transactions.filter((transaction) => transaction.accessId === id).length;
}

function setDefaultDate() {
  els.transactionDate.value = todayString();
}

function setBackupStatus(message) {
  els.backupStatus.textContent = message;
  els.backupStatus.classList.add("active");
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2800);
}

function updateNetworkStatus() {
  if (!els.networkStatus) return;
  els.networkStatus.textContent = navigator.onLine ? "Online" : "Offline";
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.error("Service worker registration failed", error);
    });
  }
}

function createId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function isValidDate(value) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime()));
}

function formatMoney(value) {
  return money.format(Number(value) || 0);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
