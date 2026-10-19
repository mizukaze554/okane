import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeState, validateImport } from "../src/state.js";
import { isValidDate, todayString } from "../src/utils.js";

test("migrates legacy accesses and accessId fields", () => {
  const migrated = sanitizeState({
    version: "1.0.0",
    categories: [{ id: "food", name: "Food", type: "outcome" }],
    accesses: [{ id: "cash", name: "Cash", initialBalance: 100 }],
    transactions: [{ id: "tx", type: "outcome", amount: 25, categoryId: "food", accessId: "cash", date: "2026-10-19" }]
  });
  assert.equal(migrated.accounts[0].id, "cash");
  assert.equal(migrated.transactions[0].accountId, "cash");
  assert.equal("accesses" in migrated, false);
});

test("accepts old and new backup shapes", () => {
  assert.doesNotThrow(() => validateImport({ categories: [], accesses: [], transactions: [] }));
  assert.doesNotThrow(() => validateImport({ categories: [], accounts: [], transactions: [] }));
});

test("formats a local calendar date and rejects rollover dates", () => {
  assert.equal(todayString(new Date(2026, 9, 19, 0, 30)), "2026-10-19");
  assert.equal(isValidDate("2026-02-29"), false);
  assert.equal(isValidDate("2024-02-29"), true);
});

