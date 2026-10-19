import test from "node:test";
import assert from "node:assert/strict";
import { formatMoney, getCurrency, isValidCurrency, normalizeMoney, setCurrency } from "../src/utils.js";

test("changes global money formatting without changing the value", () => {
  setCurrency("USD");
  assert.equal(getCurrency(), "USD");
  assert.match(formatMoney(1234.56), /1,234\.56/);
  assert.equal(normalizeMoney("10.129"), 10.13);
  setCurrency("JPY");
  assert.equal(normalizeMoney("10.9"), 11);
});

test("validates ISO-style currency codes and safely falls back", () => {
  assert.equal(isValidCurrency("MMK"), true);
  assert.equal(isValidCurrency("not-money"), false);
  setCurrency("not-money");
  assert.equal(getCurrency(), "JPY");
});
