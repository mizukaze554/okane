import { todayString } from "./utils.js";

export function calculateTotals(state, currentDate = todayString()) {
  const currentMonth = currentDate.slice(0, 7);
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
    transactionCount: 0
  });
}

export function calculateAssetBalance(state) {
  return state.transactions.reduce((balance, transaction) =>
    balance + (transaction.type === "income" ? transaction.amount : -transaction.amount),
  Number(state.asset?.initialBalance) || 0);
}

export function calculateDebtSummaries(state) {
  return state.debts.map((debt) => {
    const paid = state.transactions
      .filter((item) => item.type === "outcome" && item.debtId === debt.id)
      .reduce((sum, item) => sum + item.amount, 0);
    return { ...debt, paid, remaining: Math.max(0, debt.originalAmount - paid) };
  });
}

export function sortTransactions(transactions) {
  return [...transactions].sort((a, b) =>
    `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`)
  );
}

export function filterTransactions(state, filters) {
  const search = filters.search.trim().toLowerCase();
  return sortTransactions(state.transactions)
    .filter((item) => filters.type === "all" || item.type === filters.type)
    .filter((item) => filters.categoryId === "all" || item.categoryId === filters.categoryId)
    .filter((item) => !filters.month || item.date.slice(0, 7) === filters.month)
    .filter((item) => {
      if (!search) return true;
      const category = state.categories.find(({ id }) => id === item.categoryId)?.name || "";
      const debt = state.debts.find(({ id }) => id === item.debtId)?.name || "";
      return [category, debt, item.note, item.date].join(" ").toLowerCase().includes(search);
    });
}

export function categorySpending(state, month, categoryId) {
  return state.transactions
    .filter((item) => item.type === "outcome" && item.categoryId === categoryId && item.date.startsWith(month))
    .reduce((sum, item) => sum + item.amount, 0);
}

