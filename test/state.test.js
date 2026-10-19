import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeState, validateImport } from "../src/state.js";
import { isValidDate, todayString } from "../src/utils.js";

test("migrates legacy accesses and accessId fields", () => {
  const migrated = sanitizeState({
    version: "1.0.0",
    categories: [{ id: "food", name: "Food", type: "outcome" }],
    accesses: [{ id: "cash", name: "Cash", initialBalance: 100 }, { id: "debt", name: "Debt", initialBalance: -200 }],
    transactions: [{ id: "tx", type: "outcome", amount: 25, categoryId: "food", accessId: "cash", date: "2026-10-19" }]
  });
  assert.equal(migrated.asset.initialBalance, 100);
  assert.equal(migrated.debts[0].originalAmount, 200);
  assert.equal("accountId" in migrated.transactions[0], false);
  assert.equal("accesses" in migrated, false);
});

test("accepts old and new backup shapes", () => {
  assert.doesNotThrow(() => validateImport({ categories: [], accesses: [], transactions: [] }));
  assert.doesNotThrow(() => validateImport({ categories: [], accounts: [], transactions: [] }));
});

test("rejects malformed feature collections", () => {
  assert.throws(() => validateImport({ categories: [], accounts: [], transactions: [], budgets: {} }), /budgets/);
});

test("formats a local calendar date and rejects rollover dates", () => {
  assert.equal(todayString(new Date(2026, 9, 19, 0, 30)), "2026-10-19");
  assert.equal(isValidDate("2026-02-29"), false);
  assert.equal(isValidDate("2024-02-29"), true);
});

test("new users start with one asset and no accounts", () => {
  const state = sanitizeState({ categories: [], accounts: [], transactions: [] });
  assert.equal(state.asset.initialBalance, 0);
  assert.deepEqual(state.debts, []);
  assert.equal("accounts" in state, false);
});

