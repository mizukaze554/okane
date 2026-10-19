import test from "node:test";
import assert from "node:assert/strict";
import { createTransportTransaction, generateDueRecurring, monthsBetween, transportTotal } from "../src/automation.js";

test("calculates and records a round-trip monthly transport plan", () => {
  const rule = { id: "commute", name: "Work", goFare: 250, returnFare: 300, days: 18, accountId: "paypay", categoryId: "transport", month: "2026-10" };
  assert.equal(transportTotal(rule), 9900);
  const transaction = createTransportTransaction(rule, "2026-10-19");
  assert.equal(transaction.amount, 9900);
  assert.equal(transaction.sourceType, "transport");
  assert.equal(transaction.date, "2026-10-19");
});

test("does not record future transport plans", () => {
  assert.throws(() => createTransportTransaction({ month: "2026-11", days: 1, goFare: 1, returnFare: 1 }, "2026-10-19"));
});

test("generates each due recurring period once", () => {
  const state = {
    recurringRules: [{ id: "rent", name: "Rent", type: "outcome", amount: 50000, day: 31, startMonth: "2026-09", accountId: "bank", categoryId: "bills", active: true }],
    transactions: [{ sourceType: "recurring", sourceId: "rent", sourcePeriod: "2026-09" }]
  };
  const generated = generateDueRecurring(state, "2026-10-31");
  assert.equal(generated.length, 1);
  assert.equal(generated[0].date, "2026-10-31");
  assert.deepEqual(monthsBetween("2026-09", "2026-11"), ["2026-09", "2026-10", "2026-11"]);
});

