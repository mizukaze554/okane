import test from "node:test";
import assert from "node:assert/strict";
import { buildAnalytics, buildMonthlyTrend } from "../src/analytics.js";

const state = {
  accounts: [{ id: "bank", name: "Bank", initialBalance: 0 }],
  categories: [{ id: "food", name: "Food" }, { id: "transport", name: "Transport" }],
  transactions: [
    { type: "income", amount: 10000, accountId: "bank", categoryId: "salary", date: "2026-10-01" },
    { type: "outcome", amount: 1000, accountId: "bank", categoryId: "food", date: "2026-10-02" },
    { type: "outcome", amount: 500, accountId: "bank", categoryId: "transport", date: "2026-10-02", sourceType: "transport" },
    { type: "transfer", amount: 3000, fromAccountId: "bank", toAccountId: "cash", date: "2026-10-03" }
  ]
};

test("builds analytics while excluding account transfers", () => {
  const result = buildAnalytics(state, "2026-10");
  assert.equal(result.income, 10000);
  assert.equal(result.outcome, 1500);
  assert.equal(result.net, 8500);
  assert.equal(result.averageDaily, 1500);
  assert.equal(result.transport, 500);
  assert.equal(result.categoryRows[0].name, "Food");
  assert.deepEqual(result.dailyRows, [{ date: "2026-10-02", amount: 1500 }]);
});

test("filters analytics by account and category", () => {
  const result = buildAnalytics(state, "2026-10", { accountId: "bank", categoryId: "food" });
  assert.equal(result.income, 0);
  assert.equal(result.outcome, 1000);
  assert.equal(result.categoryRows.length, 1);
});

test("builds a six-month trend ending at the chosen month", () => {
  const trend = buildMonthlyTrend(state, "2026-10");
  assert.equal(trend.length, 6);
  assert.equal(trend.at(-1).month, "2026-10");
  assert.equal(trend.at(-1).outcome, 1500);
});
