import { buildAnalytics, buildMonthlyTrend } from "./src/analytics.js";
import { createTransportTransaction, generateDueRecurring, transportTotal } from "./src/automation.js";
import { APP_VERSION, CURRENCY_DETECTION_URL, LAST_EXPORT_KEY, THEME_KEY, VIEW_TITLES } from "./src/config.js";
import { calculateAssetBalance, calculateDebtSummaries, calculateDebtTotal, calculateTotals, categorySpending, filterTransactions, roastTransaction, sortTransactions } from "./src/finance.js";
import { emptyState, transactionCard } from "./src/render.js";
import { createDefaultState, sanitizeState, StateStore, validateImport } from "./src/state.js";
import { capitalize, createId, escapeHtml, formatMoney, getCurrency, isValidCurrency, isValidDate, normalizeMoney, setCurrency, todayString } from "./src/utils.js";

const store = new StateStore();
let state = store.load();
setCurrency(state.preferences.currency);
store.save(state);
let editingTransactionId = null;
let deletedTransaction = null;
let toastTimer = null;
let amountDialogAction = null;
let installPromptEvent = null;
let onboardingStep = 1;
const els = {};
const REGION_CURRENCY = Object.freeze({
  JP: "JPY", US: "USD", GB: "GBP", MM: "MMK", CN: "CNY", KR: "KRW", IN: "INR",
  TH: "THB", SG: "SGD", AU: "AUD", NZ: "NZD", CA: "CAD", CH: "CHF", BR: "BRL",
  MX: "MXN", ID: "IDR", MY: "MYR", PH: "PHP", VN: "VND", HK: "HKD", TW: "TWD",
  BD: "BDT", PK: "PKR", LK: "LKR", NP: "NPR", AE: "AED", SA: "SAR", TR: "TRY",
  ZA: "ZAR", NG: "NGN", EG: "EGP", RU: "RUB", UA: "UAH", PL: "PLN", CZ: "CZK",
  HU: "HUF", SE: "SEK", NO: "NOK", DK: "DKK", IS: "ISK", IL: "ILS",
  AT: "EUR", BE: "EUR", CY: "EUR", DE: "EUR", EE: "EUR", ES: "EUR", FI: "EUR",
  FR: "EUR", GR: "EUR", HR: "EUR", IE: "EUR", IT: "EUR", LT: "EUR", LU: "EUR",
  LV: "EUR", MT: "EUR", NL: "EUR", PT: "EUR", SI: "EUR", SK: "EUR"
});

applyStoredTheme();

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  bindEvents();
  setDefaults();
  runRecurringAutomation();
  updateNetworkStatus();
  renderAll();
  void initializeFirstRun();
  const requestedView = new URLSearchParams(location.search).get("view");
  if (requestedView && VIEW_TITLES[requestedView]) showView(requestedView);
  registerServiceWorker();
});

function cacheElements() {
  document.querySelectorAll("[id]").forEach((element) => { els[element.id] = element; });
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.view, { focus: true }));
  });
  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    button.addEventListener("click", () => setThemePreference(button.dataset.themeChoice));
  });
  els.quickAddButton.addEventListener("click", () => showView("add", { focus: true }));
  els.transactionForm.addEventListener("submit", saveTransaction);
  els.transactionCancelEdit.addEventListener("click", resetTransactionForm);
  document.querySelectorAll("input[name='transactionType']").forEach((input) => {
    input.addEventListener("change", renderTransactionCategoryOptions);
  });
  els.categoryForm.addEventListener("submit", addCategory);
  els.assetForm.addEventListener("submit", updateAsset);
  els.debtForm.addEventListener("submit", addDebt);
  els.transportForm.addEventListener("submit", addTransportRule);
  [els.transportGoFare, els.transportReturnFare, els.transportDays].forEach((input) => {
    input.addEventListener("input", renderTransportPreview);
  });
  els.recurringForm.addEventListener("submit", addRecurringRule);
  els.recurringType.addEventListener("change", renderRecurringCategoryOptions);
  els.budgetForm.addEventListener("submit", saveBudget);
  els.savingsForm.addEventListener("submit", addSavingsGoal);
  [els.analyticsMonth, els.analyticsCategory].forEach((input) => input.addEventListener("change", renderAnalytics));
  [els.searchInput, els.filterType, els.filterCategory, els.filterMonth].forEach((input) => {
    input.addEventListener("input", renderTransactions);
    input.addEventListener("change", renderTransactions);
  });
  els.clearFilters.addEventListener("click", clearFilters);
  els.exportButton.addEventListener("click", exportData);
  els.importFile.addEventListener("change", importData);
  els.resetButton.addEventListener("click", resetData);
  els.clearSnapshotsButton.addEventListener("click", clearSnapshots);
  els.currencyForm.addEventListener("submit", saveCurrencyPreference);
  els.currencySelect.addEventListener("change", renderCurrencyPreview);
  els.detectCurrencyButton.addEventListener("click", () => void detectCurrency(true));
  els.installButton.addEventListener("click", installApp);
  els.onboardingNextButton.addEventListener("click", advanceOnboarding);
  els.onboardingBackButton.addEventListener("click", goBackOnboarding);
  els.onboardingSkipButton.addEventListener("click", skipOnboarding);
  els.onboardingDemoButton.addEventListener("click", enableDemoMode);
  els.onboardingDialog.addEventListener("cancel", (event) => event.preventDefault());
  els.clearDemoButton.addEventListener("click", clearDemoMode);
  els.amountDialogForm.addEventListener("submit", submitAmountDialog);
  els.amountDialogCancel.addEventListener("click", closeAmountDialog);
  els.amountDialogClose.addEventListener("click", closeAmountDialog);
  els.amountDialog.addEventListener("click", (event) => {
    if (event.target === els.amountDialog) closeAmountDialog();
  });
  window.addEventListener("online", updateNetworkStatus);
  window.addEventListener("offline", updateNetworkStatus);
  store.subscribe(syncStateFromStorage, window);
  window.addEventListener("storage", syncPreferencesFromStorage);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") syncStateFromStorage(store.load());
  });
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPromptEvent = event;
    els.installCard.hidden = false;
  });
  window.addEventListener("appinstalled", () => {
    installPromptEvent = null;
    els.installCard.hidden = true;
    showToast("Okane installed.");
  });
}

function syncStateFromStorage(nextState) {
  if (JSON.stringify(nextState) === JSON.stringify(state)) return;
  state = nextState;
  if (editingTransactionId) resetTransactionForm();
  renderAll();
  showToast("Updated with changes from another tab.");
}

function syncPreferencesFromStorage(event) {
  if (event.key !== THEME_KEY && event.key !== null) return;
  applyStoredTheme();
  renderThemeControls();
}

function commit(message) {
  store.save(state, { snapshot: true });
  renderAll();
  showToast(message);
}

function saveTransaction(event) {
  event.preventDefault();
  const type = document.querySelector("input[name='transactionType']:checked").value;
  const amount = normalizeMoney(els.transactionAmount.value);
  const categoryId = els.transactionCategory.value;
  const date = els.transactionDate.value;
  if (!positiveAmount(amount)) return showToast("Amount must be greater than 0.");
  if (!state.categories.some(({ id }) => id === categoryId)) return showToast("Category is required.");
  if (!isValidDate(date)) return showToast("Enter a valid date.");

  const existing = state.transactions.find(({ id }) => id === editingTransactionId);
  const transaction = {
    ...(existing || {}),
    id: existing?.id || createId(),
    type,
    amount,
    categoryId,
    note: els.transactionNote.value.trim(),
    date,
    sourceType: existing?.sourceType || "manual",
    sourceId: existing?.sourceId || "",
    sourcePeriod: existing?.sourcePeriod || "",
    createdAt: existing?.createdAt || new Date().toISOString()
  };
  if (existing) state.transactions[state.transactions.indexOf(existing)] = transaction;
  else state.transactions.unshift(transaction);
  const message = roastTransaction(transaction, state) || (existing ? "Transaction updated." : "Transaction saved.");
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
  const category = state.categories.find((item) => item.id === id);
  if (category?.name.toLowerCase() === "debt payment") return showToast("Debt Payment is a required category.");
  const used = state.transactions.some((item) => item.categoryId === id) ||
    state.transportRules.some((item) => item.categoryId === id) ||
    state.recurringRules.some((item) => item.categoryId === id) ||
    state.budgets.some((item) => item.categoryId === id);
  if (used) return showToast("Category is in use and cannot be deleted.");
  state.categories = state.categories.filter((item) => item.id !== id);
  commit("Category deleted.");
}

function updateAsset(event) {
  event.preventDefault();
  const initialBalance = normalizeMoney(els.assetInitialBalance.value);
  if (!Number.isFinite(initialBalance)) return showToast("Enter a valid asset balance.");
  const previousBalance = Number(state.asset.initialBalance) || 0;
  if (initialBalance === previousBalance) return showToast("Opening balance is unchanged.");
  const createdAt = new Date().toISOString();
  state.asset = {
    initialBalance,
    updatedAt: createdAt,
    history: [{
      id: createId(), previousBalance, newBalance: initialBalance,
      note: els.assetChangeNote.value.trim() || "Opening balance updated", createdAt
    }, ...(state.asset.history || [])].slice(0, 50)
  };
  els.assetChangeNote.value = "";
  commit("Asset balance updated.");
}

function addDebt(event) {
  event.preventDefault();
  const name = els.debtName.value.trim();
  const originalAmount = normalizeMoney(els.debtAmount.value);
  if (!name || !positiveAmount(originalAmount)) return showToast("Enter a debt name and amount.");
  if (state.debts.some((item) => item.name.toLowerCase() === name.toLowerCase())) return showToast("That debt already exists.");
  state.debts.unshift({ id: createId(), name, originalAmount, createdAt: new Date().toISOString() });
  els.debtForm.reset();
  commit("Debt added.");
}

function payDebt(id) {
  const debt = calculateDebtSummaries(state).find((item) => item.id === id);
  if (!debt || debt.remaining <= 0) return;
  const available = calculateAssetBalance(state);
  if (available <= 0) return showToast("There is no available asset balance for a payment.");
  openAmountDialog({
    type: "debt", id, title: `Pay ${debt.name}`,
    description: `${formatMoney(debt.remaining)} remaining · ${formatMoney(available)} available`,
    label: "Payment amount", value: Math.min(debt.remaining, available), min: moneyInputStep(),
    max: Math.min(debt.remaining, available), showDate: true, submitLabel: "Record payment"
  });
}

function recordDebtPayment(id, amount, date) {
  const debt = calculateDebtSummaries(state).find((item) => item.id === id);
  const available = calculateAssetBalance(state);
  if (!debt || !positiveAmount(amount)) return;
  if (amount > debt.remaining) return showToast("Payment exceeds the remaining debt.");
  if (amount > available) return showToast("Not enough asset balance for this payment.");
  if (!isValidDate(date)) return showToast("Enter a valid payment date.");
  const category = state.categories.find((item) => item.name.toLowerCase() === "debt payment" && item.type !== "income");
  if (!category) return showToast("Debt Payment category is missing. Reload the app to restore it.");
  state.transactions.unshift({
    id: createId(), type: "outcome", amount, categoryId: category.id, debtId: debt.id,
    note: `Payment to ${debt.name}`, date, sourceType: "debt", sourceId: debt.id,
    sourcePeriod: "", createdAt: new Date().toISOString()
  });
  commit("Debt payment recorded.");
}

function deleteDebt(id) {
  if (state.transactions.some((item) => item.debtId === id)) return showToast("Debt with payments cannot be deleted.");
  state.debts = state.debts.filter((item) => item.id !== id);
  commit("Debt deleted.");
}

function addTransportRule(event) {
  event.preventDefault();
  const rule = {
    id: createId(),
    name: els.transportName.value.trim(),
    goFare: normalizeMoney(els.transportGoFare.value),
    returnFare: normalizeMoney(els.transportReturnFare.value),
    days: Number(els.transportDays.value),
    month: els.transportMonth.value,
    categoryId: els.transportCategory.value,
    createdAt: new Date().toISOString()
  };
  if (!rule.name || rule.goFare < 0 || rule.returnFare < 0 || !positiveAmount(rule.days) || !rule.month) return showToast("Complete the transport plan.");
  if (!positiveAmount(transportTotal(rule))) return showToast("Transport total must be greater than 0.");
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

function copyTransportToNextMonth(id) {
  const rule = state.transportRules.find((item) => item.id === id);
  if (!rule) return;
  const nextMonth = shiftMonth(rule.month, 1);
  if (state.transportRules.some((item) => item.name.toLowerCase() === rule.name.toLowerCase() && item.month === nextMonth)) {
    return showToast("A matching plan already exists for next month.");
  }
  state.transportRules.unshift({ ...rule, id: createId(), month: nextMonth, createdAt: new Date().toISOString() });
  commit(`Transport plan copied to ${nextMonth}.`);
}

function addRecurringRule(event) {
  event.preventDefault();
  const rule = {
    id: createId(), name: els.recurringName.value.trim(), type: els.recurringType.value,
    amount: normalizeMoney(els.recurringAmount.value), day: Number(els.recurringDay.value),
    startMonth: els.recurringStartMonth.value,
    categoryId: els.recurringCategory.value, active: true, createdAt: new Date().toISOString()
  };
  if (!rule.name || !positiveAmount(rule.amount) || rule.day < 1 || rule.day > 31 || !rule.startMonth) return showToast("Complete the recurring rule.");
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
  const limit = normalizeMoney(els.budgetLimit.value);
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
    id: createId(), name: els.savingsName.value.trim(), targetAmount: normalizeMoney(els.savingsTarget.value),
    savedAmount: normalizeMoney(els.savingsSaved.value), targetDate: els.savingsDate.value,
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
  openAmountDialog({
    type: "savings", id, title: `Update ${goal.name}`,
    description: `${formatMoney(goal.savedAmount)} saved toward ${formatMoney(goal.targetAmount)}`,
    label: "Total saved amount", value: goal.savedAmount, min: 0,
    showDate: false, submitLabel: "Update progress"
  });
}

function updateSavingsProgress(id, amount) {
  const goal = state.savingsGoals.find((item) => item.id === id);
  if (!goal || !Number.isFinite(amount) || amount < 0) return showToast("Enter a valid saved amount.");
  goal.savedAmount = amount;
  commit("Savings progress updated.");
}

function deleteSavingsGoal(id) {
  state.savingsGoals = state.savingsGoals.filter((item) => item.id !== id);
  commit("Savings goal deleted.");
}

function renderAll() {
  setCurrency(state.preferences.currency);
  renderCurrencySettings();
  renderThemeControls();
  renderTransactionCategoryOptions();
  renderRecurringCategoryOptions();
  renderCategoryOptions();
  renderAnalyticsFilterOptions();
  renderFilterOptions();
  renderDashboard();
  renderTransactions();
  renderCategories();
  renderAssetAndDebts();
  renderTransport();
  renderRecurring();
  renderAnalytics();
  renderPlanning();
  renderSnapshots();
}

function renderDashboard() {
  const totals = calculateTotals(state);
  els.demoBanner.hidden = !state.preferences.demoMode;
  els.totalBalance.textContent = formatMoney(calculateAssetBalance(state));
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
  const recent = sortTransactions(state.transactions).slice(0, 5);
  els.dashboardRecentTransactions.innerHTML = recent.length ? recent.map((item) => transactionCard(item, state)).join("") : emptyState("No transactions yet", "Add your first transaction.");
  bindTransactionActions(els.dashboardRecentTransactions);
}

function renderTransactions() {
  const transactions = filterTransactions(state, {
    search: els.searchInput.value, type: els.filterType.value, categoryId: els.filterCategory.value,
    month: els.filterMonth.value
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
    <article class="finance-row"><div class="row-main"><p class="row-title">${escapeHtml(category.name)} <span class="pill">${category.type === "outcome" ? "expense" : category.type}</span></p>
    <p class="row-sub">${state.transactions.filter((item) => item.categoryId === category.id).length} transactions</p></div>
    <button class="delete-link" type="button" data-delete-category="${escapeHtml(category.id)}">Delete</button></article>`).join("") : emptyState("No categories yet", "Add an income or expense category.");
  bindDataAction(els.categoryList, "delete-category", deleteCategory);
}

function renderAssetAndDebts() {
  els.assetInitialBalance.value = state.asset.initialBalance;
  const debts = calculateDebtSummaries(state);
  const assetBalance = calculateAssetBalance(state);
  const debtTotal = calculateDebtTotal(state);
  els.assetCurrentBalance.textContent = formatMoney(assetBalance);
  els.assetDebtTotal.textContent = formatMoney(debtTotal);
  els.assetNetPosition.textContent = formatMoney(assetBalance - debtTotal);
  els.debtList.innerHTML = debts.length ? debts.map((debt) => {
    const percentage = Math.min(100, debt.paid / debt.originalAmount * 100);
    return `<article class="goal-row"><div class="goal-head"><p>${escapeHtml(debt.name)}</p><button class="delete-link" data-delete-debt="${escapeHtml(debt.id)}" type="button">Delete</button></div>
      <div class="progress-track"><span style="--value:${percentage}%"></span></div>
      <p class="row-sub">${formatMoney(debt.remaining)} remaining · ${formatMoney(debt.paid)} paid of ${formatMoney(debt.originalAmount)}</p>
      <button class="button ghost small-button" data-pay-debt="${escapeHtml(debt.id)}" type="button" ${debt.remaining <= 0 ? "disabled" : ""}>${debt.remaining <= 0 ? "Paid" : "Pay from asset"}</button></article>`;
  }).join("") : emptyState("No debts", "Add a debt when you need to track money owed.");
  bindDataAction(els.debtList, "pay-debt", payDebt);
  bindDataAction(els.debtList, "delete-debt", deleteDebt);
  const history = state.asset.history || [];
  els.assetHistoryList.innerHTML = history.length ? history.map((item) => `
    <article class="finance-row"><div class="row-main"><p class="row-title">${escapeHtml(item.note)}</p>
    <p class="row-sub">${formatMoney(item.previousBalance)} → ${formatMoney(item.newBalance)}</p></div>
    <time class="row-detail" datetime="${escapeHtml(item.createdAt)}">${formatDateTime(item.createdAt)}</time></article>`).join("") :
    emptyState("No balance changes", "Future opening-balance updates will appear here.");
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
      <button class="button ghost small-button" data-copy-transport="${escapeHtml(rule.id)}" type="button">Next month</button>
      <button class="delete-link" data-delete-transport="${escapeHtml(rule.id)}" type="button">Delete</button></div></div></article>`;
  }).join("") : emptyState("No transport plans", "Add going fare, return fare, and travel days.");
  bindDataAction(els.transportList, "record-transport", recordTransport);
  bindDataAction(els.transportList, "copy-transport", copyTransportToNextMonth);
  bindDataAction(els.transportList, "delete-transport", deleteTransport);
}

function renderRecurring() {
  els.recurringList.innerHTML = state.recurringRules.length ? state.recurringRules.map((rule) => `
    <article class="finance-row"><div class="row-main"><p class="row-title">${escapeHtml(rule.name)} <span class="pill ${rule.type}">${rule.type === "income" ? "income" : "expense"}</span></p>
    <p class="row-sub">${formatMoney(rule.amount)} on day ${rule.day} · from ${rule.startMonth} · ${rule.active ? "Active" : "Paused"}</p></div>
    <div class="inline-actions"><button class="button ghost small-button" data-toggle-recurring="${escapeHtml(rule.id)}" type="button">${rule.active ? "Pause" : "Enable"}</button>
    <button class="delete-link" data-delete-recurring="${escapeHtml(rule.id)}" type="button">Delete</button></div></article>`).join("") : emptyState("No recurring rules", "Automate monthly income or expenses.");
  bindDataAction(els.recurringList, "toggle-recurring", toggleRecurring);
  bindDataAction(els.recurringList, "delete-recurring", deleteRecurring);
}

function renderAnalytics() {
  const month = els.analyticsMonth.value || todayString().slice(0, 7);
  const analytics = buildAnalytics(state, month, { categoryId: els.analyticsCategory.value });
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
  els.analyticsTrend.innerHTML = trend.map((item) => `<div class="trend-row" aria-label="${item.month}: income ${formatMoney(item.income)}, expenses ${formatMoney(item.outcome)}"><span>${item.month.slice(5)}</span><div class="trend-bars"><span class="income-bar" style="--value:${item.income / maxTrend * 100}%"></span><span class="outcome-bar" style="--value:${item.outcome / maxTrend * 100}%"></span></div><strong>${formatMoney(item.net ?? item.income - item.outcome)}</strong></div>`).join("");
  renderAnalyticsInsights(month, analytics);
}

function renderAnalyticsInsights(month, analytics) {
  const previous = buildAnalytics(state, shiftMonth(month, -1), { categoryId: els.analyticsCategory.value });
  const expenseChange = previous.outcome ? (analytics.outcome - previous.outcome) / previous.outcome * 100 : null;
  const savingsRate = analytics.income ? analytics.net / analytics.income * 100 : null;
  const topCategory = analytics.categoryRows[0];
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const latestDay = analytics.dailyRows.length ? Math.max(...analytics.dailyRows.map((item) => Number(item.date.slice(8)))) : 0;
  const currentMonth = todayString().slice(0, 7);
  const projection = month === currentMonth && latestDay ? analytics.outcome / latestDay * daysInMonth : 0;
  const insights = [
    expenseChange === null ? "Add last month’s spending to see a comparison." :
      `Expenses are ${Math.abs(expenseChange).toFixed(0)}% ${expenseChange > 0 ? "higher" : expenseChange < 0 ? "lower" : "unchanged"} than last month.`,
    savingsRate === null ? "No income is recorded for this month." : `Savings rate is ${savingsRate.toFixed(0)}% of recorded income.`,
    topCategory ? `${topCategory.name} is the largest expense at ${topCategory.percentage.toFixed(0)}%.` : "No expense category leads this month.",
    month !== currentMonth ? `This month closed with ${formatMoney(analytics.outcome)} in recorded expenses.` :
      projection ? `At the current pace, projected monthly expenses are ${formatMoney(projection)}.` : "Record spending to see a monthly projection."
  ];
  els.analyticsInsights.innerHTML = insights.map((insight) => `<p>${escapeHtml(insight)}</p>`).join("");
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

function renderSnapshots() {
  const snapshots = store.getSnapshots();
  els.clearSnapshotsButton.disabled = snapshots.length === 0;
  els.snapshotList.innerHTML = snapshots.length ? snapshots.map((snapshot) => {
    const transactionCount = Array.isArray(snapshot.state?.transactions) ? snapshot.state.transactions.length : 0;
    return `<article class="finance-row"><div class="row-main"><p class="row-title">Automatic snapshot</p>
      <p class="row-sub">${transactionCount} transactions · ${formatDateTime(snapshot.createdAt)}</p></div>
      <button class="button ghost small-button" data-restore-snapshot="${escapeHtml(snapshot.id)}" type="button">Restore</button></article>`;
  }).join("") : emptyState("No local snapshots yet", "A snapshot is created before your next saved change.");
  bindDataAction(els.snapshotList, "restore-snapshot", restoreSnapshot);
  const lastExport = localStorage.getItem(LAST_EXPORT_KEY);
  if (lastExport && !els.backupStatus.classList.contains("active")) {
    setBackupStatus(`Last JSON export: ${formatDateTime(lastExport)}`);
  }
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

function renderFilterOptions() {
  setSelectOptions(els.filterCategory, state.categories, "All categories", els.filterCategory.value || "all", "all");
}

function renderAnalyticsFilterOptions() {
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
  localStorage.setItem(LAST_EXPORT_KEY, payload.exportedAt);
  setBackupStatus(`Exported current local data at ${formatDateTime(payload.exportedAt)}.`);
  showToast("Export ready.");
}

function restoreSnapshot(id) {
  if (!confirm("Restore this local snapshot? Your current data will be kept as a new recovery snapshot.")) return;
  try {
    state = store.restoreSnapshot(id);
    setDefaults();
    commit("Local snapshot restored.");
    setBackupStatus("Recovery snapshot restored successfully.");
    void initializeFirstRun();
  } catch (error) {
    setBackupStatus(`Restore failed: ${error.message}`);
    showToast("Snapshot restore failed.");
  }
}

function clearSnapshots() {
  if (!confirm("Clear all automatic local snapshots? Exported JSON files are not affected.")) return;
  store.clearSnapshots();
  renderSnapshots();
  showToast("Local snapshots cleared.");
}

async function installApp() {
  if (!installPromptEvent) return;
  installPromptEvent.prompt();
  await installPromptEvent.userChoice;
  installPromptEvent = null;
  els.installCard.hidden = true;
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
      void initializeFirstRun();
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
  void initializeFirstRun();
}

function showView(viewId, { focus = false } = {}) {
  if (!VIEW_TITLES[viewId]) return;
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === viewId));
  document.querySelectorAll(".nav-link").forEach((link) => {
    const moreViews = ["more", "categories", "asset", "backup", "transport", "recurring", "planning", "analytics"];
    const isActive = link.dataset.view === viewId || (link.dataset.view === "more" && moreViews.includes(viewId));
    link.classList.toggle("active", isActive);
    if (isActive) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  els.viewTitle.textContent = VIEW_TITLES[viewId];
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (focus) requestAnimationFrame(() => els.viewTitle.focus());
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
async function initializeFirstRun() {
  if (!state.preferences.onboardingComplete) showOnboarding();
  await initializeCurrency();
}
function showOnboarding() {
  onboardingStep = 1;
  const outcomes = state.categories.filter((item) => item.type === "outcome" || item.type === "both");
  setSelectOptions(els.onboardingExpenseCategory, outcomes, "Choose category", outcomes[0]?.id || "");
  updateMoneyInputPrecision();
  renderOnboardingStep();
  if (!els.onboardingDialog.open) els.onboardingDialog.showModal();
}
function renderOnboardingStep() {
  document.querySelectorAll("[data-onboarding-step]").forEach((section) => {
    section.classList.toggle("active", Number(section.dataset.onboardingStep) === onboardingStep);
  });
  els.onboardingProgressBar.style.width = `${onboardingStep / 5 * 100}%`;
  els.onboardingProgress.setAttribute("aria-valuenow", String(onboardingStep));
  els.onboardingBackButton.hidden = onboardingStep === 1 || onboardingStep === 5;
  els.onboardingSkipButton.hidden = onboardingStep === 5;
  els.onboardingNextButton.textContent = onboardingStep === 1 ? "Get started" :
    onboardingStep === 4 ? "Finish setup" : onboardingStep === 5 ? "Open dashboard" : "Continue";
  const heading = document.querySelector(`[data-onboarding-step="${onboardingStep}"] h2`);
  if (heading?.id) els.onboardingDialog.setAttribute("aria-labelledby", heading.id);
  heading?.setAttribute("tabindex", "-1");
  requestAnimationFrame(() => heading?.focus());
}
function advanceOnboarding() {
  if (onboardingStep === 5) {
    els.onboardingDialog.close();
    showView("dashboard", { focus: true });
    return;
  }
  if (onboardingStep === 2) {
    const value = normalizeMoney(els.onboardingBalance.value);
    if (!Number.isFinite(value) || value < 0) return showToast("Enter a valid starting balance.");
  }
  if (onboardingStep === 3) {
    const value = normalizeMoney(els.onboardingIncome.value);
    if (!Number.isFinite(value) || value < 0) return showToast("Enter a valid monthly income or zero.");
  }
  if (onboardingStep === 4) {
    const value = normalizeMoney(els.onboardingExpense.value);
    if (!Number.isFinite(value) || value < 0) return showToast("Enter a valid expense or zero.");
    if (value > 0 && !state.categories.some((item) => item.id === els.onboardingExpenseCategory.value)) {
      return showToast("Choose an expense category.");
    }
    completeOnboardingSetup();
    onboardingStep = 5;
    renderOnboardingStep();
    return;
  }
  onboardingStep += 1;
  renderOnboardingStep();
}
function goBackOnboarding() {
  if (onboardingStep > 1 && onboardingStep < 5) {
    onboardingStep -= 1;
    renderOnboardingStep();
  }
}
function skipOnboarding() {
  state.preferences = { ...state.preferences, onboardingComplete: true, demoMode: false };
  els.onboardingDialog.close();
  commit("Setup skipped. You can start adding transactions anytime.");
  showView("dashboard", { focus: true });
}
function completeOnboardingSetup() {
  const balance = normalizeMoney(els.onboardingBalance.value);
  const income = normalizeMoney(els.onboardingIncome.value);
  const expense = normalizeMoney(els.onboardingExpense.value);
  const now = new Date().toISOString();
  const today = todayString();
  const month = today.slice(0, 7);
  state.asset = { initialBalance: balance, updatedAt: now, history: [] };
  if (income > 0) {
    const category = state.categories.find((item) => item.type === "income" && item.name.toLowerCase() === "salary") ||
      state.categories.find((item) => item.type === "income" || item.type === "both");
    const ruleId = createId();
    state.recurringRules.unshift({
      id: ruleId, name: "Monthly income", type: "income", amount: income,
      day: new Date().getDate(), startMonth: month, categoryId: category.id, active: true, createdAt: now
    });
    state.transactions.unshift({
      id: createId(), type: "income", amount: income, categoryId: category.id, note: "Monthly income",
      date: today, sourceType: "recurring", sourceId: ruleId, sourcePeriod: month, createdAt: now
    });
  }
  if (expense > 0) {
    state.transactions.unshift({
      id: createId(), type: "outcome", amount: expense, categoryId: els.onboardingExpenseCategory.value,
      note: els.onboardingExpenseNote.value.trim(), date: today, sourceType: "manual", sourceId: "",
      sourcePeriod: "", createdAt: now
    });
  }
  state.preferences = { ...state.preferences, onboardingComplete: true, demoMode: false };
  store.save(state, { snapshot: true });
  renderAll();
  els.onboardingCompleteSummary.textContent = `Your available balance is ${formatMoney(calculateAssetBalance(state))}. Everything is saved on this device.`;
}
function enableDemoMode() {
  const preferences = { ...state.preferences, onboardingComplete: true, demoMode: true };
  state = createDefaultState();
  state.preferences = preferences;
  const amount = (value) => normalizeMoney(value);
  const now = new Date().toISOString();
  const today = todayString();
  const month = today.slice(0, 7);
  const category = (name) => state.categories.find((item) => item.name === name)?.id || "";
  state.asset = { initialBalance: amount(5000), updatedAt: now, history: [] };
  [
    ["income", 3000, "Salary", "Monthly salary", 0],
    ["outcome", 950, "Bills", "Rent and utilities", 14],
    ["outcome", 180, "Food", "Groceries", 10],
    ["outcome", 65, "Transport", "Commute", 7],
    ["outcome", 45, "Entertainment", "Weekend", 3],
    ["outcome", 28, "Food", "Lunch", 0]
  ].forEach(([type, value, categoryName, note, daysAgo]) => state.transactions.push({
    id: createId(), type, amount: amount(value), categoryId: category(categoryName), note,
    date: localDateOffset(-daysAgo), sourceType: "demo", sourceId: "", sourcePeriod: "", createdAt: now
  }));
  const salaryRuleId = createId();
  state.recurringRules.push({
    id: salaryRuleId, name: "Monthly salary", type: "income", amount: amount(3000), day: 3,
    startMonth: month, categoryId: category("Salary"), active: true, createdAt: now
  });
  const salaryTransaction = state.transactions.find((item) => item.type === "income");
  Object.assign(salaryTransaction, { sourceType: "recurring", sourceId: salaryRuleId, sourcePeriod: month });
  state.budgets.push({ id: createId(), month, categoryId: category("Food"), limit: amount(500), createdAt: now });
  state.savingsGoals.push({ id: createId(), name: "Emergency fund", targetAmount: amount(6000), savedAmount: amount(1800), targetDate: "", createdAt: now });
  state.debts.push({ id: createId(), name: "Example credit", originalAmount: amount(800), createdAt: now });
  els.onboardingDialog.close();
  commit("Demo mode ready. Explore every section.");
  showView("dashboard", { focus: true });
}
function clearDemoMode() {
  if (!state.preferences.demoMode || !confirm("Clear all demo data and start with an empty dashboard?")) return;
  const preferences = { ...state.preferences, onboardingComplete: true, demoMode: false };
  state = createDefaultState();
  state.preferences = preferences;
  setDefaults();
  commit("Demo data cleared.");
}
function localDateOffset(dayOffset) {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  return todayString(date);
}
async function initializeCurrency() {
  if (state.preferences.currencyInitialized) return;
  await detectCurrency(false);
}
async function detectCurrency(manual = false) {
  if (!navigator.onLine) {
    if (manual) return showToast("Connect to the internet to detect currency from IP.");
    return applyLocaleCurrencyFallback();
  }
  els.detectCurrencyButton.disabled = true;
  els.currencyStatus.textContent = "Detecting currency from network location…";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(CURRENCY_DETECTION_URL, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`Detection returned ${response.status}.`);
    const currency = (await response.text()).trim().toUpperCase();
    if (!isValidCurrency(currency)) throw new Error("Detection returned an invalid currency.");
    state.preferences = { ...state.preferences, currency, currencyInitialized: true, currencySource: "ip" };
    setCurrency(currency);
    if (manual) commit(`Currency detected as ${currency}.`);
    else {
      store.save(state);
      renderAll();
    }
  } catch (error) {
    console.warn("Unable to detect currency from IP", error);
    if (manual) showToast("Currency detection failed. Your current choice was kept.");
    else applyLocaleCurrencyFallback();
  } finally {
    clearTimeout(timeout);
    els.detectCurrencyButton.disabled = false;
  }
}
function applyLocaleCurrencyFallback() {
  let region = "";
  try { region = new Intl.Locale(navigator.language).maximize().region || ""; } catch { /* Use JPY below. */ }
  const currency = REGION_CURRENCY[region] || "JPY";
  state.preferences = { ...state.preferences, currency, currencyInitialized: false, currencySource: "locale" };
  setCurrency(currency);
  store.save(state);
  renderAll();
}
function saveCurrencyPreference(event) {
  event.preventDefault();
  const currency = els.currencySelect.value.toUpperCase();
  if (!isValidCurrency(currency)) return showToast("Choose a valid currency.");
  if (currency === state.preferences.currency && state.preferences.currencyInitialized) {
    return showToast(`${currency} is already selected.`);
  }
  state.preferences = { ...state.preferences, currency, currencyInitialized: true, currencySource: "manual" };
  setCurrency(currency);
  commit(`Currency changed to ${currency}. Stored amounts were not converted.`);
}
function renderCurrencySettings() {
  const selected = state.preferences.currency;
  if (!els.currencySelect.options.length) {
    const codes = typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("currency")
      : ["JPY", "USD", "EUR", "GBP", "MMK", "CNY", "KRW", "INR", "THB", "SGD", "AUD", "CAD"];
    if (!codes.includes(selected)) codes.push(selected);
    let names;
    try { names = new Intl.DisplayNames(navigator.languages, { type: "currency" }); } catch { names = null; }
    els.currencySelect.innerHTML = codes.sort().map((code) => {
      const name = names?.of(code);
      return `<option value="${code}">${code}${name && name !== code ? ` — ${escapeHtml(name)}` : ""}</option>`;
    }).join("");
  }
  els.currencySelect.value = selected;
  const sourceText = {
    ip: "Detected from your network location and saved on this device.",
    locale: "Estimated from browser language while IP detection is unavailable.",
    manual: "Selected manually and saved on this device.",
    default: "Using the default until automatic detection finishes."
  };
  els.currencyStatus.textContent = `${selected} · ${sourceText[state.preferences.currencySource] || sourceText.default}`;
  renderCurrencyPreview();
  updateMoneyInputPrecision();
}
function renderCurrencyPreview() {
  const current = getCurrency();
  setCurrency(els.currencySelect.value || state.preferences.currency);
  els.currencyPreview.textContent = formatMoney(1234.56);
  setCurrency(current);
}
function updateMoneyInputPrecision() {
  const step = String(moneyInputStep());
  ["transactionAmount", "assetInitialBalance", "debtAmount", "transportGoFare", "transportReturnFare",
    "recurringAmount", "budgetLimit", "savingsTarget", "savingsSaved", "amountDialogAmount",
    "onboardingBalance", "onboardingIncome", "onboardingExpense"]
    .forEach((id) => { els[id].step = step; });
  ["transactionAmount", "debtAmount", "recurringAmount", "budgetLimit", "savingsTarget"]
    .forEach((id) => { els[id].min = step; });
}
function moneyInputStep() {
  const digits = new Intl.NumberFormat(undefined, { style: "currency", currency: state.preferences.currency })
    .resolvedOptions().maximumFractionDigits;
  return digits ? 1 / (10 ** digits) : 1;
}
function openAmountDialog(options) {
  amountDialogAction = options;
  els.amountDialogTitle.textContent = options.title;
  els.amountDialogDescription.textContent = options.description;
  els.amountDialogField.firstChild.textContent = options.label;
  els.amountDialogAmount.value = String(options.value);
  els.amountDialogAmount.min = String(options.min ?? 0);
  if (Number.isFinite(options.max)) els.amountDialogAmount.max = String(options.max);
  else els.amountDialogAmount.removeAttribute("max");
  els.amountDialogDateField.hidden = !options.showDate;
  els.amountDialogDate.required = Boolean(options.showDate);
  els.amountDialogDate.value = todayString();
  els.amountDialogSubmit.textContent = options.submitLabel || "Save";
  els.amountDialog.showModal();
  requestAnimationFrame(() => els.amountDialogAmount.select());
}
function closeAmountDialog() {
  amountDialogAction = null;
  els.amountDialog.close();
}
function submitAmountDialog(event) {
  event.preventDefault();
  if (!amountDialogAction) return closeAmountDialog();
  const action = amountDialogAction;
  const amount = normalizeMoney(els.amountDialogAmount.value);
  if (!Number.isFinite(amount) || amount < Number(action.min ?? 0) || (Number.isFinite(action.max) && amount > action.max)) {
    return showToast("Enter an amount within the allowed range.");
  }
  closeAmountDialog();
  if (action.type === "debt") recordDebtPayment(action.id, amount, els.amountDialogDate.value);
  if (action.type === "savings") updateSavingsProgress(action.id, amount);
}
function shiftMonth(month, offset) {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(year, value - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown time" : new Intl.DateTimeFormat("en", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  }).format(date);
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
  const duration = action ? 6000 : message.length > 60 ? 5000 : 2800;
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), duration);
}
function updateNetworkStatus() {
  els.networkStatus.textContent = "Saved on this device";
  els.networkStatus.title = navigator.onLine ? "Online; finance data remains local" : "Offline; app and data remain available";
  els.networkStatus.classList.toggle("is-offline", !navigator.onLine);
}
function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").then((registration) => {
      registration.update().catch(() => {});
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            showToast("A new Okane version is ready.", "Reload", () => location.reload());
          }
        });
      });
    }).catch((error) => console.error("Service worker registration failed", error));
  }
}
