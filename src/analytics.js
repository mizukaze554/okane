import { calculateAccountSummaries } from "./finance.js";

export function buildAnalytics(state, month, filters = {}) {
  const transactions = state.transactions
    .filter((item) => item.date.startsWith(month))
    .filter((item) => !filters.accountId || filters.accountId === "all" || item.accountId === filters.accountId)
    .filter((item) => !filters.categoryId || filters.categoryId === "all" || item.categoryId === filters.categoryId);
  const income = sum(transactions.filter((item) => item.type === "income"));
  const outcomeItems = transactions.filter((item) => item.type === "outcome");
  const outcome = sum(outcomeItems);
  const categoryRows = state.categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      amount: sum(outcomeItems.filter((item) => item.categoryId === category.id))
    }))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .map((item) => ({ ...item, percentage: outcome ? item.amount / outcome * 100 : 0 }));
  const activeDays = new Set(outcomeItems.map((item) => item.date)).size;
  const dailyRows = [...new Set(outcomeItems.map((item) => item.date))]
    .sort()
    .map((date) => ({ date, amount: sum(outcomeItems.filter((item) => item.date === date)) }));
  return {
    income,
    outcome,
    net: income - outcome,
    averageDaily: activeDays ? outcome / activeDays : 0,
    categoryRows,
    dailyRows,
    accountRows: calculateAccountSummaries(state),
    transport: sum(outcomeItems.filter((item) => item.sourceType === "transport" ||
      state.categories.find((category) => category.id === item.categoryId)?.name.toLowerCase().includes("transport")))
  };
}

export function buildMonthlyTrend(state, endMonth, count = 6) {
  const [year, month] = endMonth.split("-").map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(year, month - count + index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const items = state.transactions.filter((item) => item.date.startsWith(key));
    return {
      month: key,
      income: sum(items.filter((item) => item.type === "income")),
      outcome: sum(items.filter((item) => item.type === "outcome"))
    };
  });
}

function sum(items) {
  return items.reduce((total, item) => total + Number(item.amount || 0), 0);
}
