import { getCurrency, todayString } from "./utils.js";

const EXPENSE_ROASTS = Object.freeze({
  food: { amount: 10_000, message: "¥10,000 FOR FOOD?! BRO, DID YOU EAT THE RESTAURANT? 💀" },
  transport: { amount: 15_000, message: "¥15,000 ON TRANSPORT?! DID THE TRAIN TAKE YOU TO MARS? 🚀" },
  shopping: { amount: 20_000, message: "THAT SHOPPING BAG BETTER HAVE A RETIREMENT PLAN. 🛍️😭" },
  entertainment: { amount: 15_000, message: "¥15,000 FOR ENTERTAINMENT?! YOUR BUDGET WAS NOT AMUSED. 🎭" },
  bills: { amount: 30_000, message: "THAT BILL DIDN'T ARRIVE—IT KICKED THE DOOR DOWN. 💸" }
});

export function roastTransaction(transaction, state) {
  if (transaction.type !== "outcome" || getCurrency() !== "JPY") return null;

  const category = state.categories.find(({ id }) => id === transaction.categoryId)?.name.trim().toLowerCase();
  if (["health", "debt payment"].includes(category)) return null;

  const roast = EXPENSE_ROASTS[category];
  if (roast && transaction.amount >= roast.amount) return roast.message;
  if (transaction.amount >= 30_000) return "YOUR WALLET JUST FILED A MISSING PERSON REPORT. 😭";
  return null;
}

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

export function calculateDebtTotal(state) {
  return calculateDebtSummaries(state).reduce((total, debt) => total + debt.remaining, 0);
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

