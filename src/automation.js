import { createId, isValidDate, todayString } from "./utils.js";

export function transportTotal(rule) {
  return (Number(rule.goFare) + Number(rule.returnFare)) * Number(rule.days);
}

export function createTransportTransaction(rule, date = todayString()) {
  if (rule.month > date.slice(0, 7)) throw new Error("Future transport plans cannot be recorded yet.");
  return {
    id: createId(),
    type: "outcome",
    amount: transportTotal(rule),
    categoryId: rule.categoryId,
    note: `${rule.name}: ${rule.days} days × ¥${Number(rule.goFare) + Number(rule.returnFare)}`,
    date: rule.month === date.slice(0, 7) ? date : lastDayOfMonth(rule.month),
    sourceType: "transport",
    sourceId: rule.id,
    sourcePeriod: rule.month,
    createdAt: new Date().toISOString()
  };
}

export function generateDueRecurring(state, today = todayString()) {
  const created = [];
  const currentMonth = today.slice(0, 7);
  state.recurringRules.filter((rule) => rule.active).forEach((rule) => {
    for (const month of monthsBetween(rule.startMonth, currentMonth)) {
      const dueDate = dateForMonthDay(month, rule.day);
      if (dueDate > today) continue;
      const exists = state.transactions.some((item) =>
        item.sourceType === "recurring" && item.sourceId === rule.id && item.sourcePeriod === month
      );
      if (!exists) created.push({
        id: createId(),
        type: rule.type,
        amount: rule.amount,
        categoryId: rule.categoryId,
        note: rule.name,
        date: dueDate,
        sourceType: "recurring",
        sourceId: rule.id,
        sourcePeriod: month,
        createdAt: new Date().toISOString()
      });
    }
  });
  return created;
}

export function monthsBetween(startMonth, endMonth) {
  if (!/^\d{4}-\d{2}$/.test(startMonth) || startMonth > endMonth) return [];
  const [startYear, startValue] = startMonth.split("-").map(Number);
  const [endYear, endValue] = endMonth.split("-").map(Number);
  const months = [];
  let cursor = new Date(startYear, startValue - 1, 1);
  const end = new Date(endYear, endValue - 1, 1);
  while (cursor <= end && months.length < 240) {
    months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return months;
}

function dateForMonthDay(month, day) {
  const last = Number(lastDayOfMonth(month).slice(8));
  return `${month}-${String(Math.min(Number(day), last)).padStart(2, "0")}`;
}

function lastDayOfMonth(month) {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(year, value, 0);
  const result = `${year}-${String(value).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return isValidDate(result) ? result : todayString();
}

