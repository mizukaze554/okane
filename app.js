import { buildAnalytics, buildMonthlyTrend } from "./src/analytics.js";
import { createTransportTransaction, generateDueRecurring, transportTotal } from "./src/automation.js";
import { APP_VERSION, THEME_KEY, VIEW_TITLES } from "./src/config.js";
import { calculateAccountSummaries, calculateTotals, categorySpending, filterTransactions, sortTransactions } from "./src/finance.js";
import { accountManagementRow, accountSummaryCard, emptyState, transactionCard } from "./src/render.js";
import { createDefaultState, sanitizeState, StateStore, validateImport } from "./src/state.js";
import { capitalize, createId, escapeHtml, formatMoney, isValidDate, todayString } from "./src/utils.js";

const store = new StateStore();
let state = store.load();
let editingTransactionId = null;
let deletedTransaction = null;
let toastTimer = null;
const els = {};

applyStoredTheme();

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  bindEvents();
  setDefaults();
  runRecurringAutomation();
  updateNetworkStatus();
  renderAll();
  registerServiceWorker();
});

function cacheElements() {
  document.querySelectorAll("[id]").forEach((element) => { els[element.id] = element; });
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.view));
  });
  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    button.addEventListener("click", () => setThemePreference(button.dataset.themeChoice));
  });
  els.quickAddButton.addEventListener("click", () => showView("add"));
  els.transactionForm.addEventListener("submit", saveTransaction);
  els.transactionCancelEdit.addEventListener("click", resetTransactionForm);
  document.querySelectorAll("input[name='transactionType']").forEach((input) => {
    input.addEventListener("change", renderTransactionCategoryOptions);
  });
  els.categoryForm.addEventListener("submit", addCategory);
  els.accountForm.addEventListener("submit", addAccount);
  els.transportForm.addEventListener("submit", addTransportRule);
  [els.transportGoFare, els.transportReturnFare, els.transportDays].forEach((input) => {
    input.addEventListener("input", renderTransportPreview);
  });
  els.recurringForm.addEventListener("submit", addRecurringRule);
  els.recurringType.addEventListener("change", renderRecurringCategoryOptions);
  els.budgetForm.addEventListener("submit", saveBudget);
  els.savingsForm.addEventListener("submit", addSavingsGoal);
  [els.analyticsMonth, els.analyticsAccount, els.analyticsCategory].forEach((input) => input.addEventListener("change", renderAnalytics));
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

function saveTransaction(event) {
  event.preventDefault();
  const type = document.querySelector("input[name='transactionType']:checked").value;
  const amount = Number(els.transactionAmount.value);
  const categoryId = els.transactionCategory.value;
  const accountId = els.transactionAccount.value;
  const date = els.transactionDate.value;
  if (!positiveAmount(amount)) return showToast("Amount must be greater than 0.");
  if (!state.categories.some(({ id }) => id === categoryId)) return showToast("Category is required.");
  if (!state.accounts.some(({ id }) => id === accountId)) return showToast("Account is required.");
  if (!isValidDate(date)) return showToast("Enter a valid date.");

  const existing = state.transactions.find(({ id }) => id === editingTransactionId);
  const transaction = {
    ...(existing || {}),
    id: existing?.id || createId(),
    type,
    amount,
    categoryId,
    accountId,
    note: els.transactionNote.value.trim(),
    date,
    sourceType: existing?.sourceType || "manual",
    sourceId: existing?.sourceId || "",
    sourcePeriod: existing?.sourcePeriod || "",
    createdAt: existing?.createdAt || new Date().toISOString()
  };
  if (existing) state.transactions[state.transactions.indexOf(existing)] = transaction;
  else state.transactions.unshift(transaction);
  const message = existing ? "Transaction updated." : "Transaction saved.";
  resetTransactionForm();
  commit(message);
}

function editTransaction(id) {
  const item = state.transactions.find((transaction) => transaction.id === id);
  if (!item) return;
  editingTransactionId = id;
  document.querySelector(`input[name='transactionType'][value='${item.type}']`).checked = true;
  renderTransactionCategoryOptions();
  els.transactionAmount.value = item.amount;
  els.transactionCategory.value = item.categoryId;
  els.transactionAccount.value = item.accountId;
  els.transactionNote.value = item.note;
  els.transactionDate.value = item.date;
  els.transactionSubmit.textContent = "Update transaction";
  els.transactionCancelEdit.hidden = false;
  showView("add");
  els.transactionAmount.focus();
}

function resetTransactionForm() {
  editingTransactionId = null;
  els.transactionForm.reset();
  document.querySelector("input[name='transactionType'][value='income']").checked = true;
  els.transactionSubmit.textContent = "Save transaction";
  els.transactionCancelEdit.hidden = true;
  els.transactionDate.value = todayString();
  renderTransactionCategoryOptions();
  renderAccountOptions();
}

function deleteTransaction(id) {
  const index = state.transactions.findIndex((item) => item.id === id);
  if (index < 0) return;
  deletedTransaction = { item: state.transactions[index], index };
  state.transactions.splice(index, 1);
  store.save(state);
  renderAll();
  showToast("Transaction deleted.", "Undo", undoDelete);
}

function undoDelete() {
  if (!deletedTransaction) return;
  state.transactions.splice(deletedTransaction.index, 0, deletedTransaction.item);
  deletedTransaction = null;
  commit("Transaction restored.");
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
  const used = state.transactions.some((item) => item.categoryId === id) ||
    state.transportRules.some((item) => item.categoryId === id) ||
    state.recurringRules.some((item) => item.categoryId === id) ||
    state.budgets.some((item) => item.categoryId === id);
  if (used) return showToast("Category is in use and cannot be deleted.");
  state.categories = state.categories.filter((item) => item.id !== id);
  commit("Category deleted.");
}

function addAccount(event) {
  event.preventDefault();
  const name = els.accountName.value.trim();
  const amountOwed = Number(els.accountInitialBalance.value);
  if (!name) return showToast("Debt name cannot be empty.");
  if (!positiveAmount(amountOwed)) return showToast("Amount owed must be greater than 0.");
  if (state.accounts.some((item) => item.name.toLowerCase() === name.toLowerCase())) return showToast("That name already exists.");
  state.accounts.push({ id: createId(), name, initialBalance: -amountOwed, kind: "debt", createdAt: new Date().toISOString() });
  els.accountForm.reset();
  commit("Debt added.");
}

function deleteAccount(id) {
  const account = state.accounts.find((item) => item.id === id);
  if (account?.kind === "asset") return showToast("The main asset cannot be deleted.");
  const used = state.transactions.some((item) => item.accountId === id) ||
    state.transportRules.some((item) => item.accountId === id) || state.recurringRules.some((item) => item.accountId === id);
  if (used) return showToast("Account is in use and cannot be deleted.");
  state.accounts = state.accounts.filter((item) => item.id !== id);
  commit("Debt deleted.");
}

function addTransportRule(event) {
  event.preventDefault();
  const rule = {
    id: createId(),
    name: els.transportName.value.trim(),
    goFare: Number(els.transportGoFare.value),
    returnFare: Number(els.transportReturnFare.value),
    days: Number(els.transportDays.value),
    month: els.transportMonth.value,
    accountId: els.transportAccount.value,
    categoryId: els.transportCategory.value,
    createdAt: new Date().toISOString()
  };
  if (!rule.name || rule.goFare < 0 || rule.returnFare < 0 || !positiveAmount(rule.days) || !rule.month) return showToast("Complete the transport plan.");
  if (!positiveAmount(transportTotal(rule))) return showToast("Transport total must be greater than 0.");
  if (!state.accounts.some(({ id }) => id === rule.accountId)) return showToast("Choose an account.");
  if (!state.categories.some(({ id }) => id === rule.categoryId)) return showToast("Choose a category.");
  state.transportRules.unshift(rule);
  els.transportForm.reset();
  setFeatureDefaults();
  commit("Transport plan saved.");
}

function recordTransport(id) {
  const rule = state.transportRules.find((item) => item.id === id);
  if (!rule) return;
  if (state.transactions.some((item) => item.sourceType === "transport" && item.sourceId === id && item.sourcePeriod === rule.month)) {
    return showToast("This transport plan is already recorded.");
  }
  try {
    state.transactions.unshift(createTransportTransaction(rule));
    commit("Transport expense recorded.");
  } catch (error) {
    showToast(error.message);
  }
}

function deleteTransport(id) {
  state.transportRules = state.transportRules.filter((item) => item.id !== id);
  commit("Transport plan deleted. Existing expense remains.");
}

function addRecurringRule(event) {
  event.preventDefault();
  const rule = {
    id: createId(), name: els.recurringName.value.trim(), type: els.recurringType.value,
    amount: Number(els.recurringAmount.value), day: Number(els.recurringDay.value),
    startMonth: els.recurringStartMonth.value, accountId: els.recurringAccount.value,
    categoryId: els.recurringCategory.value, active: true, createdAt: new Date().toISOString()
  };
  if (!rule.name || !positiveAmount(rule.amount) || rule.day < 1 || rule.day > 31 || !rule.startMonth) return showToast("Complete the recurring rule.");
  if (!state.accounts.some(({ id }) => id === rule.accountId)) return showToast("Choose an account.");
  if (!state.categories.some(({ id }) => id === rule.categoryId)) return showToast("Choose a category.");
  state.recurringRules.unshift(rule);
  els.recurringForm.reset();
  setFeatureDefaults();
  const generated = runRecurringAutomation();
  commit(generated ? `Recurring rule saved; ${generated} entry generated.` : "Recurring rule saved.");
}

function toggleRecurring(id) {
  const rule = state.recurringRules.find((item) => item.id === id);
  if (!rule) return;
  rule.active = !rule.active;
  const generated = rule.active ? runRecurringAutomation() : 0;
  commit(generated ? `Rule enabled; ${generated} entries generated.` : `Rule ${rule.active ? "enabled" : "paused"}.`);
}

function deleteRecurring(id) {
  state.recurringRules = state.recurringRules.filter((item) => item.id !== id);
  commit("Recurring rule deleted. Generated entries remain.");
}

function runRecurringAutomation() {
  const generated = generateDueRecurring(state);
  if (generated.length) {
    state.transactions.unshift(...generated);
    store.save(state);
  }
  return generated.length;
}

function saveBudget(event) {
  event.preventDefault();
  const month = els.budgetMonth.value;
  const categoryId = els.budgetCategory.value;
  const limit = Number(els.budgetLimit.value);
  if (!month || !categoryId || !positiveAmount(limit)) return showToast("Complete the budget.");
  const existing = state.budgets.find((item) => item.month === month && item.categoryId === categoryId);
  if (existing) existing.limit = limit;
  else state.budgets.unshift({ id: createId(), month, categoryId, limit, createdAt: new Date().toISOString() });
  els.budgetLimit.value = "";
  commit(existing ? "Budget updated." : "Budget added.");
}

function deleteBudget(id) {
  state.budgets = state.budgets.filter((item) => item.id !== id);
  commit("Budget deleted.");
}

function addSavingsGoal(event) {
  event.preventDefault();
  const goal = {
    id: createId(), name: els.savingsName.value.trim(), targetAmount: Number(els.savingsTarget.value),
    savedAmount: Number(els.savingsSaved.value), targetDate: els.savingsDate.value,
    createdAt: new Date().toISOString()
  };
  if (!goal.name || !positiveAmount(goal.targetAmount) || goal.savedAmount < 0) return showToast("Complete the savings goal.");
  if (goal.targetDate && !isValidDate(goal.targetDate)) return showToast("Enter a valid target date.");
  state.savingsGoals.unshift(goal);
  els.savingsForm.reset();
  els.savingsSaved.value = "0";
  commit("Savings goal added.");
}

function contributeToGoal(id) {
  const goal = state.savingsGoals.find((item) => item.id === id);
  if (!goal) return;
  const amount = Number(prompt("Amount to add (use a negative amount to correct the total):", "0"));
  if (!Number.isFinite(amount) || amount === 0) return;
  goal.savedAmount = Math.max(0, goal.savedAmount + amount);
  commit("Savings progress updated.");
}

function deleteSavingsGoal(id) {
  state.savingsGoals = state.savingsGoals.filter((item) => item.id !== id);
  commit("Savings goal deleted.");
}

function renderAll() {
  renderThemeControls();
  renderAccountOptions();
  renderTransactionCategoryOptions();
  renderRecurringCategoryOptions();
  renderCategoryOptions();
  renderAnalyticsFilterOptions();
  renderFilterOptions();
  renderDashboard();
  renderTransactions();
  renderCategories();
  renderAccounts();
  renderTransport();
  renderRecurring();
  renderAnalytics();
  renderPlanning();
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
  els.dashboardAccountSummary.innerHTML = accounts.length ? accounts.map(accountSummaryCard).join("") : emptyState("No accounts yet", "Add an account to start tracking balances.");
  const recent = sortTransactions(state.transactions).slice(0, 5);
  els.dashboardRecentTransactions.innerHTML = recent.length ? recent.map((item) => transactionCard(item, state)).join("") : emptyState("No transactions yet", "Add your first transaction.");
  bindTransactionActions(els.dashboardRecentTransactions);
}

function renderTransactions() {
  const transactions = filterTransactions(state, {
    search: els.searchInput.value, type: els.filterType.value, categoryId: els.filterCategory.value,
    accountId: els.filterAccount.value, month: els.filterMonth.value
  });
  els.transactionList.innerHTML = transactions.length ? transactions.map((item) => transactionCard(item, state)).join("") : emptyState("No matching transactions", "Try changing the filters or add a transaction.");
  bindTransactionActions(els.transactionList);
}

function bindTransactionActions(container) {
  bindDataAction(container, "delete-transaction", deleteTransaction);
  bindDataAction(container, "edit-transaction", editTransaction);
}

function renderCategories() {
  els.categoryList.innerHTML = state.categories.length ? state.categories.map((category) => `
    <article class="finance-row"><div class="row-main"><p class="row-title">${escapeHtml(category.name)} <span class="pill">${category.type}</span></p>
    <p class="row-sub">${state.transactions.filter((item) => item.categoryId === category.id).length} transactions</p></div>
    <button class="delete-link" type="button" data-delete-category="${escapeHtml(category.id)}">Delete</button></article>`).join("") : emptyState("No categories yet", "Add an income or outcome category.");
  bindDataAction(els.categoryList, "delete-category", deleteCategory);
}

function renderAccounts() {
  const accounts = calculateAccountSummaries(state);
  els.accountList.innerHTML = accounts.length ? accounts.map((account) => accountManagementRow(account,
    state.transactions.filter((item) => item.accountId === account.id).length
  )).join("") : emptyState("No asset yet", "Reset data to restore the default asset.");
  bindDataAction(els.accountList, "delete-account", deleteAccount);
}

function renderTransportPreview() {
  els.transportPreview.textContent = formatMoney((Number(els.transportGoFare.value) + Number(els.transportReturnFare.value)) * Number(els.transportDays.value));
}

function renderTransport() {
  renderTransportPreview();
  els.transportList.innerHTML = state.transportRules.length ? state.transportRules.map((rule) => {
    const recorded = state.transactions.some((item) => item.sourceType === "transport" && item.sourceId === rule.id && item.sourcePeriod === rule.month);
    return `<article class="finance-row"><div class="row-main"><p class="row-title">${escapeHtml(rule.name)} <span class="pill">${rule.month}</span></p>
      <p class="row-sub">Going ${formatMoney(rule.goFare)} + return ${formatMoney(rule.returnFare)} × ${rule.days} days</p></div>
      <div class="row-side"><div class="amount">${formatMoney(transportTotal(rule))}</div><div class="inline-actions">
      <button class="button ghost small-button" data-record-transport="${escapeHtml(rule.id)}" type="button" ${recorded ? "disabled" : ""}>${recorded ? "Recorded" : "Record"}</button>
      <button class="delete-link" data-delete-transport="${escapeHtml(rule.id)}" type="button">Delete</button></div></div></article>`;
  }).join("") : emptyState("No transport plans", "Add going fare, return fare, and travel days.");
  bindDataAction(els.transportList, "record-transport", recordTransport);
  bindDataAction(els.transportList, "delete-transport", deleteTransport);
}

function renderRecurring() {
  els.recurringList.innerHTML = state.recurringRules.length ? state.recurringRules.map((rule) => `
    <article class="finance-row"><div class="row-main"><p class="row-title">${escapeHtml(rule.name)} <span class="pill ${rule.type}">${rule.type}</span></p>
    <p class="row-sub">${formatMoney(rule.amount)} on day ${rule.day} · from ${rule.startMonth} · ${rule.active ? "Active" : "Paused"}</p></div>
    <div class="inline-actions"><button class="button ghost small-button" data-toggle-recurring="${escapeHtml(rule.id)}" type="button">${rule.active ? "Pause" : "Enable"}</button>
    <button class="delete-link" data-delete-recurring="${escapeHtml(rule.id)}" type="button">Delete</button></div></article>`).join("") : emptyState("No recurring rules", "Automate monthly income or expenses.");
  bindDataAction(els.recurringList, "toggle-recurring", toggleRecurring);
  bindDataAction(els.recurringList, "delete-recurring", deleteRecurring);
}

function renderAnalytics() {
  const month = els.analyticsMonth.value || todayString().slice(0, 7);
  const analytics = buildAnalytics(state, month, {
    accountId: els.analyticsAccount.value,
    categoryId: els.analyticsCategory.value
  });
  els.analyticsIncome.textContent = formatMoney(analytics.income);
  els.analyticsOutcome.textContent = formatMoney(analytics.outcome);
  els.analyticsNet.textContent = formatMoney(analytics.net);
  els.analyticsAverage.textContent = formatMoney(analytics.averageDaily);
  els.analyticsTransport.textContent = formatMoney(analytics.transport);
  els.analyticsCategories.innerHTML = renderChartRows(analytics.categoryRows.map((item) => ({ label: item.name, amount: item.amount, percent: item.percentage })));
  const maxDaily = Math.max(...analytics.dailyRows.map((item) => item.amount), 1);
  els.analyticsDaily.innerHTML = analytics.dailyRows.length ? analytics.dailyRows.map((item) => `<div class="chart-row"><span>${item.date.slice(5)}</span><div class="chart-bar"><span class="outcome-bar" style="--value:${item.amount / maxDaily * 100}%"></span></div><strong>${formatMoney(item.amount)}</strong></div>`).join("") : emptyState("No daily spending", "No expenses match these filters.");
  const trend = buildMonthlyTrend(state, month);
  const maxTrend = Math.max(...trend.map((item) => Math.max(item.income, item.outcome)), 1);
  els.analyticsTrend.innerHTML = trend.map((item) => `<div class="chart-row"><span>${item.month}</span><div class="chart-bar"><span class="outcome-bar" style="--value:${item.outcome / maxTrend * 100}%"></span></div><strong>${formatMoney(item.outcome)}</strong></div>`).join("");
  const maxAccount = Math.max(...analytics.accountRows.map((item) => Math.abs(item.currentBalance)), 1);
  els.analyticsAccounts.innerHTML = analytics.accountRows.length ? analytics.accountRows.map((item) => `<div class="chart-row"><span>${escapeHtml(item.name)}</span><div class="chart-bar"><span style="--value:${Math.abs(item.currentBalance) / maxAccount * 100}%"></span></div><strong>${formatMoney(item.currentBalance)}</strong></div>`).join("") : emptyState("No accounts", "Add an account to compare balances.");
}

function renderChartRows(rows) {
  return rows.length ? rows.map((item) => `<div class="chart-row"><span>${escapeHtml(item.label)}</span><div class="chart-bar"><span class="outcome-bar" style="--value:${item.percent}%"></span></div><strong>${formatMoney(item.amount)}</strong></div>`).join("") : emptyState("No spending", "No expenses for this month.");
}

function renderPlanning() {
  els.budgetList.innerHTML = state.budgets.length ? state.budgets.map((budget) => {
    const category = state.categories.find(({ id }) => id === budget.categoryId);
    const spent = categorySpending(state, budget.month, budget.categoryId);
    const percentage = Math.min(100, spent / budget.limit * 100);
    return `<article class="budget-row"><div class="budget-head"><p>${escapeHtml(category?.name || "Deleted category")} · ${budget.month}</p><button class="delete-link" data-delete-budget="${escapeHtml(budget.id)}" type="button">Delete</button></div>
      <div class="progress-track"><span class="${spent > budget.limit ? "over-budget" : ""}" style="--value:${percentage}%"></span></div>
      <p class="row-sub">${formatMoney(spent)} of ${formatMoney(budget.limit)} · ${formatMoney(Math.max(0, budget.limit - spent))} remaining</p></article>`;
  }).join("") : emptyState("No budgets", "Set a category limit for a month.");
  bindDataAction(els.budgetList, "delete-budget", deleteBudget);

  els.savingsList.innerHTML = state.savingsGoals.length ? state.savingsGoals.map((goal) => {
    const percentage = Math.min(100, goal.savedAmount / goal.targetAmount * 100);
    return `<article class="goal-row"><div class="goal-head"><p>${escapeHtml(goal.name)}</p><button class="delete-link" data-delete-goal="${escapeHtml(goal.id)}" type="button">Delete</button></div>
      <div class="progress-track"><span style="--value:${percentage}%"></span></div><p class="row-sub">${formatMoney(goal.savedAmount)} of ${formatMoney(goal.targetAmount)} · ${percentage.toFixed(0)}%${goal.targetDate ? ` · by ${goal.targetDate}` : ""}</p>
      <button class="button ghost small-button" data-contribute-goal="${escapeHtml(goal.id)}" type="button">Update saved amount</button></article>`;
  }).join("") : emptyState("No savings goals", "Add a target and track progress.");
  bindDataAction(els.savingsList, "contribute-goal", contributeToGoal);
  bindDataAction(els.savingsList, "delete-goal", deleteSavingsGoal);
}

function renderTransactionCategoryOptions() {
  const selected = els.transactionCategory.value;
  const type = document.querySelector("input[name='transactionType']:checked").value;
  setSelectOptions(els.transactionCategory, state.categories.filter((item) => item.type === type || item.type === "both"), "Choose category", selected);
}

function renderRecurringCategoryOptions() {
  const selected = els.recurringCategory.value;
  const type = els.recurringType.value;
  setSelectOptions(els.recurringCategory, state.categories.filter((item) => item.type === type || item.type === "both"), "Choose category", selected);
}

function renderCategoryOptions() {
  const outcomes = state.categories.filter((item) => item.type === "outcome" || item.type === "both");
  setSelectOptions(els.transportCategory, outcomes, "Choose category", els.transportCategory.value);
  setSelectOptions(els.budgetCategory, outcomes, "Choose category", els.budgetCategory.value);
}

function renderAccountOptions() {
  [els.transactionAccount, els.transportAccount, els.recurringAccount].forEach((select) => setSelectOptions(select, state.accounts, "Choose account", select.value));
}

function renderFilterOptions() {
  setSelectOptions(els.filterCategory, state.categories, "All categories", els.filterCategory.value || "all", "all");
  setSelectOptions(els.filterAccount, state.accounts, "All accounts", els.filterAccount.value || "all", "all");
}

function renderAnalyticsFilterOptions() {
  setSelectOptions(els.analyticsAccount, state.accounts, "All accounts", els.analyticsAccount.value || "all", "all");
  setSelectOptions(els.analyticsCategory, state.categories, "All categories", els.analyticsCategory.value || "all", "all");
}

function setSelectOptions(select, items, placeholder, selected, placeholderValue = "") {
  select.innerHTML = `<option value="${placeholderValue}">${placeholder}</option>${items.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("")}`;
  if (selected === placeholderValue || items.some(({ id }) => id === selected)) select.value = selected;
}

function bindDataAction(container, name, action) {
  container.querySelectorAll(`[data-${name}]`).forEach((button) => button.addEventListener("click", () => action(button.dataset[name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())])));
}

function clearFilters() {
  els.searchInput.value = "";
  els.filterType.value = "all";
  els.filterCategory.value = "all";
  els.filterAccount.value = "all";
  els.filterMonth.value = "";
  renderTransactions();
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
  if (file.size > 5 * 1024 * 1024) {
    event.target.value = "";
    return showToast("Backup file is larger than 5 MB.");
  }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      validateImport(parsed);
      if (!confirm("Importing will replace all current local data. Continue?")) return;
      state = sanitizeState(parsed);
      runRecurringAutomation();
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
  setDefaults();
  commit("Data reset.");
  setBackupStatus("All data reset and defaults restored.");
}

function showView(viewId) {
  if (!VIEW_TITLES[viewId]) return;
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === viewId));
  document.querySelectorAll(".nav-link").forEach((link) => {
    const moreViews = ["more", "categories", "accounts", "backup", "transport", "recurring", "planning", "analytics"];
    link.classList.toggle("active", link.dataset.view === viewId || (link.dataset.view === "more" && moreViews.includes(viewId)));
  });
  els.viewTitle.textContent = VIEW_TITLES[viewId];
}

function setDefaults() {
  els.transactionDate.value = todayString();
  els.analyticsMonth.value = todayString().slice(0, 7);
  setFeatureDefaults();
}

function setFeatureDefaults() {
  const month = todayString().slice(0, 7);
  els.transportMonth.value = month;
  els.recurringStartMonth.value = month;
  els.recurringDay.value = String(new Date().getDate());
  els.budgetMonth.value = month;
  renderTransportPreview();
}

function positiveAmount(value) { return Number.isFinite(value) && value > 0; }
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
  document.querySelectorAll("[data-theme-choice]").forEach((button) => button.classList.toggle("active", button.dataset.themeChoice === theme));
}
function setBackupStatus(message) {
  els.backupStatus.textContent = message;
  els.backupStatus.classList.add("active");
}
function showToast(message, actionLabel = "", action = null) {
  els.toastMessage.textContent = message;
  els.toastAction.hidden = !action;
  els.toastAction.textContent = actionLabel;
  els.toastAction.onclick = action;
  els.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), action ? 6000 : 2800);
}
function updateNetworkStatus() { els.networkStatus.textContent = navigator.onLine ? "Online" : "Offline"; }
function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => console.error("Service worker registration failed", error));
  }
}
