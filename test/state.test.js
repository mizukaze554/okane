import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeState, StateStore, validateImport } from "../src/state.js";
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

test("keeps and restores local recovery snapshots", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
  const store = new StateStore(storage);
  const first = sanitizeState({ categories: [], accounts: [], transactions: [] });
  first.asset.initialBalance = 100;
  store.save(first);
  const second = structuredClone(first);
  second.asset.initialBalance = 250;
  store.save(second, { snapshot: true });
  const snapshots = store.getSnapshots();
  assert.equal(snapshots.length, 1);
  assert.equal(store.restoreSnapshot(snapshots[0].id).asset.initialBalance, 100);
});

test("sanitizes asset balance history", () => {
  const state = sanitizeState({
    categories: [], asset: { initialBalance: 20, history: [{ id: "h", previousBalance: 0, newBalance: 20, note: "First count" }] }, transactions: []
  });
  assert.deepEqual(state.asset.history.map(({ previousBalance, newBalance, note }) => ({ previousBalance, newBalance, note })), [
    { previousBalance: 0, newBalance: 20, note: "First count" }
  ]);
});

