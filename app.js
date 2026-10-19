import { APP_VERSION, THEME_KEY, VIEW_TITLES } from "./src/config.js";
import { calculateAccountSummaries, calculateTotals, filterTransactions, sortTransactions } from "./src/finance.js";
import { accountManagementRow, accountSummaryCard, emptyState, transactionCard } from "./src/render.js";
import { createDefaultState, sanitizeState, StateStore, validateImport } from "./src/state.js";
import { capitalize, createId, escapeHtml, formatMoney, isValidDate, todayString } from "./src/utils.js";

const store = new StateStore();
let state = store.load();
let toastTimer = null;
const els = {};

applyStoredTheme();

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
    "transactionCount", "monthIncome", "monthOutcome", "dashboardAccountSummary",
    "dashboardRecentTransactions", "quickAddButton", "incomeBar", "outcomeBar", "incomeBarValue", "outcomeBarValue",
    "transactionForm", "transactionAmount", "transactionCategory", "transactionAccount",
    "transactionNote", "transactionDate", "transactionList", "categoryForm",
    "categoryName", "categoryType", "categoryList", "accountForm", "accountName",
    "accountInitialBalance", "accountList", "searchInput", "filterType",
    "filterCategory", "filterAccount", "filterMonth", "clearFilters",
    "exportButton", "importFile", "resetButton", "backupStatus", "toast"
  ].forEach((id) => { els[id] = document.getElementById(id); });
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.view));
  });
  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    button.addEventListener("click", () => setThemePreference(button.dataset.themeChoice));
  });
  els.quickAddButton.addEventListener("click", () => showView("add"));
  els.transactionForm.addEventListener("submit", addTransaction);
  document.querySelectorAll("input[name='transactionType']").forEach((input) => {
    input.addEventListener("change", renderTransactionCategoryOptions);
  });
  els.categoryForm.addEventListener("submit", addCategory);
  els.accountForm.addEventListener("submit", addAccount);
  [els.searchInput, els.filterType, els.filterCategory, els.filterAccount, els.filterMonth].forEach((input) => {
    input.addEventListener("input", renderTransactions);
    input.addEventListener("change", renderTransactions);
  });
  els.clearFilters.addEventListener("click", clearFilters);
  els.exportButton.addEventListener("click", exportData);
  els.importFile.addEventListener("change", importData);
  els.resetButton.addEventListener("click", resetData);
  window.addEventListener("online", updateNetworkStatus);
  window.addEventListener("offline", updateNetworkStatus);
}

function commit(message) {
  store.save(state);
  renderAll();
  showToast(message);
}

function addTransaction(event) {
  event.preventDefault();
  const type = document.querySelector("input[name='transactionType']:checked").value;
  const amount = Number(els.transactionAmount.value);
  const categoryId = els.transactionCategory.value;
  const accountId = els.transactionAccount.value;
  const date = els.transactionDate.value;

  if (!Number.isFinite(amount) || amount <= 0) return showToast("Amount must be greater than 0.");
  if (!state.categories.some(({ id }) => id === categoryId)) return showToast("Category is required.");
  if (!state.accounts.some(({ id }) => id === accountId)) return showToast("Account is required.");
  if (!isValidDate(date)) return showToast("Enter a valid date.");

  state.transactions.unshift({
    id: createId(), type, amount, categoryId, accountId,
    note: els.transactionNote.value.trim(), date, createdAt: new Date().toISOString()
  });
  els.transactionAmount.value = "";
  els.transactionNote.value = "";
  setDefaultDate();
  commit("Transaction saved.");
  els.transactionAccount.value = accountId;
}

function deleteTransaction(id) {
  state.transactions = state.transactions.filter((item) => item.id !== id);
  commit("Transaction deleted.");
}

function addCategory(event) {
  event.preventDefault();
  const name = els.categoryName.value.trim();
  const type = els.categoryType.value;
  if (!name) return showToast("Category name cannot be empty.");
  if (state.categories.some((item) => item.name.toLowerCase() === name.toLowerCase() && item.type === type)) {
    return showToast("That category already exists for this type.");
  }
  state.categories.push({ id: createId(), name, type, createdAt: new Date().toISOString() });
  els.categoryForm.reset();
  commit("Category added.");
}

function deleteCategory(id) {
  if (state.transactions.some((item) => item.categoryId === id)) {
    return showToast("Category is in use and cannot be deleted.");
  }
  state.categories = state.categories.filter((item) => item.id !== id);
  commit("Category deleted.");
}

function addAccount(event) {
  event.preventDefault();
  const name = els.accountName.value.trim();
  const initialBalance = Number(els.accountInitialBalance.value);
  if (!name) return showToast("Account name cannot be empty.");
  if (!Number.isFinite(initialBalance)) return showToast("Enter a valid initial balance.");
  if (state.accounts.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
    return showToast("That account already exists.");
  }
  state.accounts.push({ id: createId(), name, initialBalance, createdAt: new Date().toISOString() });
  els.accountForm.reset();
  els.accountInitialBalance.value = "0";
  commit("Account added.");
}

function deleteAccount(id) {
  if (state.transactions.some((item) => item.accountId === id)) {
    return showToast("Account is in use and cannot be deleted.");
  }
  state.accounts = state.accounts.filter((item) => item.id !== id);
  commit("Account deleted.");
}

function clearFilters() {
  els.searchInput.value = "";
  els.filterType.value = "all";
  els.filterCategory.value = "all";
  els.filterAccount.value = "all";
  els.filterMonth.value = "";
  renderTransactions();
}

function renderAll() {
  renderThemeControls();
  renderDashboard();
  renderTransactionCategoryOptions();
  renderAccountOptions();
  renderFilterOptions();
  renderTransactions();
  renderCategories();
  renderAccounts();
}

function renderDashboard() {
  const totals = calculateTotals(state);
  const accounts = calculateAccountSummaries(state);
  els.totalBalance.textContent = formatMoney(accounts.reduce((sum, item) => sum + item.currentBalance, 0));
  els.totalIncome.textContent = formatMoney(totals.totalIncome);
  els.totalOutcome.textContent = formatMoney(totals.totalOutcome);
  els.transactionCount.textContent = String(totals.transactionCount);
  els.monthIncome.textContent = formatMoney(totals.monthIncome);
  els.monthOutcome.textContent = formatMoney(totals.monthOutcome);
  els.incomeBarValue.textContent = formatMoney(totals.monthIncome);
  els.outcomeBarValue.textContent = formatMoney(totals.monthOutcome);
  const maxMonthly = Math.max(totals.monthIncome, totals.monthOutcome, 1);
  els.incomeBar.style.width = `${totals.monthIncome / maxMonthly * 100}%`;
  els.outcomeBar.style.width = `${totals.monthOutcome / maxMonthly * 100}%`;
  els.dashboardAccountSummary.innerHTML = accounts.length
    ? accounts.map(accountSummaryCard).join("")
    : emptyState("No accounts yet", "Add an account to start tracking balances.");

  const recent = sortTransactions(state.transactions).slice(0, 5);
  els.dashboardRecentTransactions.innerHTML = recent.length
    ? recent.map((item) => transactionCard(item, state)).join("")
    : emptyState("No transactions yet", "Add your first income or outcome.");
  bindDeleteButtons(els.dashboardRecentTransactions, "transaction");
}

function renderTransactions() {
  const transactions = filterTransactions(state, {
    search: els.searchInput.value, type: els.filterType.value,
    categoryId: els.filterCategory.value, accountId: els.filterAccount.value,
    month: els.filterMonth.value
  });
  els.transactionList.innerHTML = transactions.length
    ? transactions.map((item) => transactionCard(item, state)).join("")
    : emptyState("No matching transactions", "Try changing the filters or add a transaction.");
  bindDeleteButtons(els.transactionList, "transaction");
}

function renderCategories() {
  els.categoryList.innerHTML = state.categories.length ? state.categories.map((category) => `
    <article class="finance-row">
      <div class="row-main">
        <p class="row-title">${escapeHtml(category.name)} <span class="pill">${category.type}</span></p>
        <p class="row-sub">${state.transactions.filter((item) => item.categoryId === category.id).length} transactions</p>
      </div>
      <button class="delete-link" type="button" data-delete-category="${escapeHtml(category.id)}">Delete</button>
    </article>`).join("") : emptyState("No categories yet", "Add an income or outcome category.");
  bindDeleteButtons(els.categoryList, "category");
}

function renderAccounts() {
  const accounts = calculateAccountSummaries(state);
  els.accountList.innerHTML = accounts.length ? accounts.map((account) => accountManagementRow(
    account, state.transactions.filter((item) => item.accountId === account.id).length
  )).join("") : emptyState("No accounts yet", "Add cash, a bank, card, or wallet.");
  bindDeleteButtons(els.accountList, "account");
}

function bindDeleteButtons(container, type) {
  const actions = { transaction: deleteTransaction, category: deleteCategory, account: deleteAccount };
  container.querySelectorAll(`[data-delete-${type}]`).forEach((button) => {
    button.addEventListener("click", () => actions[type](button.dataset[`delete${capitalize(type)}`]));
  });
}

function renderTransactionCategoryOptions() {
  const selected = els.transactionCategory.value;
  const type = document.querySelector("input[name='transactionType']:checked").value;
  const categories = state.categories.filter((item) => item.type === type || item.type === "both");
  els.transactionCategory.innerHTML = `<option value="">Choose category</option>${categories.map((item) =>
    `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("")}`;
  if (categories.some(({ id }) => id === selected)) els.transactionCategory.value = selected;
}

function renderAccountOptions() {
  const selected = els.transactionAccount.value;
  els.transactionAccount.innerHTML = `<option value="">Choose account</option>${state.accounts.map((item) =>
    `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("")}`;
  if (state.accounts.some(({ id }) => id === selected)) els.transactionAccount.value = selected;
}

function renderFilterOptions() {
  const selectedCategory = els.filterCategory.value || "all";
  const selectedAccount = els.filterAccount.value || "all";
  els.filterCategory.innerHTML = `<option value="all">All categories</option>${state.categories.map((item) =>
    `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("")}`;
  els.filterAccount.innerHTML = `<option value="all">All accounts</option>${state.accounts.map((item) =>
    `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("")}`;
  els.filterCategory.value = state.categories.some(({ id }) => id === selectedCategory) ? selectedCategory : "all";
  els.filterAccount.value = state.accounts.some(({ id }) => id === selectedAccount) ? selectedAccount : "all";
}

function exportData() {
  const payload = { ...state, version: APP_VERSION, exportedAt: new Date().toISOString() };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `okane-${todayString()}.json`;
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
      if (!confirm("Importing will replace all current local data. Continue?")) return;
      state = sanitizeState(parsed);
      commit("Import complete.");
      setBackupStatus("Imported data successfully.");
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
  if (prompt("Type RESET to permanently clear all local finance data.") !== "RESET") return;
  state = createDefaultState();
  setDefaultDate();
  commit("Data reset.");
  setBackupStatus("All data reset and defaults restored.");
}

function showView(viewId) {
  if (!VIEW_TITLES[viewId]) return;
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === viewId));
  document.querySelectorAll(".nav-link").forEach((link) => {
    const moreViews = ["more", "categories", "accounts", "backup"];
    link.classList.toggle("active", link.dataset.view === viewId || (link.dataset.view === "more" && moreViews.includes(viewId)));
  });
  els.viewTitle.textContent = VIEW_TITLES[viewId];
}

function applyStoredTheme() { applyTheme(localStorage.getItem(THEME_KEY) || "auto"); }
function setThemePreference(theme) {
  if (!["auto", "light", "dark"].includes(theme)) return;
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
  renderThemeControls();
  showToast(theme === "auto" ? "Theme follows system." : `${capitalize(theme)} theme saved.`);
}
function applyTheme(theme) {
  if (theme === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.dataset.theme = theme;
}
function renderThemeControls() {
  const theme = localStorage.getItem(THEME_KEY) || "auto";
  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    button.classList.toggle("active", button.dataset.themeChoice === theme);
  });
}

function setDefaultDate() { els.transactionDate.value = todayString(); }
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
function updateNetworkStatus() { els.networkStatus.textContent = navigator.onLine ? "Online" : "Offline"; }
function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => console.error("Service worker registration failed", error));
  }
}
