import test from "node:test";
import assert from "node:assert/strict";
import { calculateAssetBalance, calculateDebtSummaries, calculateDebtTotal, calculateTotals, filterTransactions } from "../src/finance.js";

const state = {
  asset: { initialBalance: 1500 },
  debts: [{ id: "card", name: "Card debt", originalAmount: 1000 }],
  categories: [
    { id: "salary", name: "Salary" },
    { id: "food", name: "Food" }
  ],
  transactions: [
    { id: "1", type: "income", amount: 2000, categoryId: "salary", note: "October salary", date: "2026-10-01", createdAt: "2026-10-01T00:00:00Z" },
    { id: "2", type: "outcome", amount: 300, categoryId: "food", note: "Lunch", date: "2026-10-02", createdAt: "2026-10-02T00:00:00Z" },
    { id: "3", type: "outcome", amount: 100, categoryId: "food", note: "Snack", date: "2026-09-30", createdAt: "2026-09-30T00:00:00Z" },
    { id: "4", type: "outcome", amount: 250, categoryId: "debt", debtId: "card", note: "Card payment", date: "2026-10-03", createdAt: "2026-10-03T00:00:00Z" }
  ]
};

test("calculates all-time and current-month totals", () => {
  assert.deepEqual(calculateTotals(state, "2026-10-19"), {
    totalIncome: 2000,
    totalOutcome: 650,
    monthIncome: 2000,
    monthOutcome: 550,
    transactionCount: 4
  });
});

test("calculates the single asset and remaining debts", () => {
  assert.equal(calculateAssetBalance(state), 2850);
  assert.deepEqual(calculateDebtSummaries(state).map(({ paid, remaining }) => ({ paid, remaining })), [{ paid: 250, remaining: 750 }]);
  assert.equal(calculateDebtTotal(state), 750);
});

test("filters using type and free text", () => {
  const result = filterTransactions(state, {
    search: "lunch",
    type: "outcome",
    categoryId: "all",
    month: "2026-10"
  });
  assert.deepEqual(result.map(({ id }) => id), ["2"]);
});

