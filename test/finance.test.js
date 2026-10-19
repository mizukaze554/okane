import test from "node:test";
import assert from "node:assert/strict";
import { calculateAccountSummaries, calculateTotals, filterTransactions } from "../src/finance.js";

const state = {
  accounts: [
    { id: "bank", name: "Bank", initialBalance: 1000 },
    { id: "cash", name: "Cash", initialBalance: 500 }
  ],
  categories: [
    { id: "salary", name: "Salary" },
    { id: "food", name: "Food" }
  ],
  transactions: [
    { id: "1", type: "income", amount: 2000, categoryId: "salary", accountId: "bank", note: "October salary", date: "2026-10-01", createdAt: "2026-10-01T00:00:00Z" },
    { id: "2", type: "outcome", amount: 300, categoryId: "food", accountId: "bank", note: "Lunch", date: "2026-10-02", createdAt: "2026-10-02T00:00:00Z" },
    { id: "3", type: "outcome", amount: 100, categoryId: "food", accountId: "cash", note: "Snack", date: "2026-09-30", createdAt: "2026-09-30T00:00:00Z" }
  ]
};

test("calculates all-time and current-month totals", () => {
  assert.deepEqual(calculateTotals(state, "2026-10-19"), {
    totalIncome: 2000,
    totalOutcome: 400,
    monthIncome: 2000,
    monthOutcome: 300,
    transactionCount: 3
  });
});

test("calculates each account balance in a single pass", () => {
  const summaries = calculateAccountSummaries(state);
  assert.equal(summaries[0].currentBalance, 2700);
  assert.equal(summaries[1].currentBalance, 400);
});

test("filters using account and free text", () => {
  const result = filterTransactions(state, {
    search: "lunch",
    type: "outcome",
    categoryId: "all",
    accountId: "bank",
    month: "2026-10"
  });
  assert.deepEqual(result.map(({ id }) => id), ["2"]);
});

