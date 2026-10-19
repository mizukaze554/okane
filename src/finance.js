import { todayString } from "./utils.js";

export function calculateTotals(state, currentDate = todayString()) {
  const currentMonth = currentDate.slice(0, 7);
  return state.transactions.reduce((totals, transaction) => {
    if (transaction.type === "transfer") return totals;
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

export function calculateAccountSummaries(state) {
  const totalsByAccount = new Map(state.accounts.map((account) => [
    account.id,
    { totalIncome: 0, totalOutcome: 0 }
  ]));

  state.transactions.forEach((transaction) => {
    if (transaction.type === "transfer") {
      const from = totalsByAccount.get(transaction.fromAccountId);
      const to = totalsByAccount.get(transaction.toAccountId);
      if (from) from.totalOutcome += transaction.amount;
      if (to) to.totalIncome += transaction.amount;
      return;
    }
    const totals = totalsByAccount.get(transaction.accountId);
    if (!totals) return;
    totals[transaction.type === "income" ? "totalIncome" : "totalOutcome"] += transaction.amount;
  });

  return state.accounts.map((account) => {
    const initialBalance = Number(account.initialBalance) || 0;
    const totals = totalsByAccount.get(account.id);
    return {
      ...account,
      initialBalance,
      ...totals,
      currentBalance: initialBalance + totals.totalIncome - totals.totalOutcome
    };
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
    .filter((item) => filters.accountId === "all" || item.accountId === filters.accountId || item.fromAccountId === filters.accountId || item.toAccountId === filters.accountId)
    .filter((item) => !filters.month || item.date.slice(0, 7) === filters.month)
    .filter((item) => {
      if (!search) return true;
      const category = state.categories.find(({ id }) => id === item.categoryId)?.name || "";
      const account = state.accounts.find(({ id }) => id === item.accountId)?.name || "";
      const from = state.accounts.find(({ id }) => id === item.fromAccountId)?.name || "";
      const to = state.accounts.find(({ id }) => id === item.toAccountId)?.name || "";
      return [category, account, from, to, item.note, item.date].join(" ").toLowerCase().includes(search);
    });
}

export function categorySpending(state, month, categoryId) {
  return state.transactions
    .filter((item) => item.type === "outcome" && item.categoryId === categoryId && item.date.startsWith(month))
    .reduce((sum, item) => sum + item.amount, 0);
}

