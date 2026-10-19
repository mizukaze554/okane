import { getCurrency, todayString } from "./utils.js";

const EXPENSE_ROASTS = Object.freeze({
  food: { amount: 10_000, messages: [
    "¥10,000 FOR FOOD?! BRO, DID YOU EAT THE RESTAURANT? 💀",
    "THAT MEAL COST MORE THAN YOUR WEEK'S GOOD DECISIONS. 🍜",
    "MICHELIN CALLED. EVEN THEY SAID CALM DOWN. ⭐",
    "YOUR STOMACH ATE WELL. YOUR WALLET ATE NOTHING. 😭",
    "WAS DESSERT SERVED WITH A PAYMENT PLAN? 🍰",
    "THAT RECEIPT HAS MORE COURSES THAN THE MEAL. 🧾",
    "YOU ORDERED DINNER AND A SMALL FINANCIAL CRISIS. 🍽️",
    "THE FOOD IS GONE, BUT THAT PRICE WILL STAY WITH YOU. 💸"
  ] },
  transport: { amount: 15_000, messages: [
    "¥15,000 ON TRANSPORT?! DID THE TRAIN TAKE YOU TO MARS? 🚀",
    "FOR THAT PRICE, THE TAXI SHOULD TUCK YOU INTO BED. 🚕",
    "YOUR COMMUTE JUST UPGRADED ITSELF TO A LUXURY TOUR. 🚆",
    "DID YOU BUY A TICKET OR SPONSOR THE WHOLE TRAIN? 🎫",
    "THAT RIDE TOOK YOUR WALLET FOR A RIDE TOO. 💸",
    "NEXT STOP: FINANCIAL REGRET STATION. 🚉",
    "AT THAT PRICE, THE VEHICLE BETTER REMEMBER YOUR BIRTHDAY. 🚌"
  ] },
  shopping: { amount: 20_000, messages: [
    "THAT SHOPPING BAG BETTER HAVE A RETIREMENT PLAN. 🛍️😭",
    "YOU DIDN'T CHECK OUT. YOUR BUDGET CHECKED OUT. 💀",
    "ADD TO CART? MORE LIKE SUBTRACT FROM FUTURE. 🛒",
    "THE SALE SAVED 20%. YOU SPENT THE OTHER 80%. 🤡",
    "RETAIL THERAPY JUST SENT YOUR WALLET TO THE ICU. 🛍️",
    "THAT RECEIPT IS LONG ENOUGH TO BE A SCARF. 🧾",
    "YOUR CART WAS FULL. YOUR FINANCIAL PLAN WAS EMPTY. 😭"
  ] },
  bills: { amount: 30_000, messages: [
    "THAT BILL DIDN'T ARRIVE—IT KICKED THE DOOR DOWN. 💸",
    "THE UTILITY COMPANY SAID THANKS FOR THE DONATION. 💡",
    "YOUR MONEY CLOCKED IN AND IMMEDIATELY CLOCKED OUT. 🧾",
    "THAT BILL CAME WITH BOSS-MUSIC ENERGY. 😭",
    "YOU PAID FOR THE WHOLE GRID THIS MONTH, HUH? ⚡",
    "THE DIRECT DEBIT WAS VERY DIRECT ABOUT IT. 💀",
    "YOUR WALLET JUST DEVELOPED A FEAR OF MAIL. 📬"
  ] },
  health: { amount: 20_000, messages: [
    "GET WELL SOON—YOUR WALLET NEEDS RECOVERY TOO. 🩹",
    "THE BILL NEEDS A SECOND OPINION. 🧾",
    "HEALTHCARE REALLY PRESCRIBED FINANCIAL DAMAGE. 💊",
    "YOUR BODY GOT TREATMENT. YOUR WALLET CAUGHT THE SYMPTOMS. 😭",
    "THE ONLY THING NOT COVERED WAS YOUR WALLET'S FEELINGS. 🏥",
    "TAKE CARE OF YOURSELF. THAT RECEIPT CLEARLY WON'T. 🩺"
  ] },
  entertainment: { amount: 15_000, messages: [
    "¥15,000 FOR ENTERTAINMENT?! YOUR BUDGET WAS NOT AMUSED. 🎭",
    "FUN WAS HAD. FINANCIAL STABILITY WAS NOT INVITED. 🎉",
    "THAT NIGHT OUT WILL BE LIVING RENT-FREE IN YOUR STATEMENT. 🌙",
    "THE GOOD TIMES ROLLED STRAIGHT OVER YOUR BUDGET. 🎳",
    "YOU BOUGHT MEMORIES. YOUR WALLET REMEMBERS EVERYTHING. 😭",
    "THE SHOW ENDED, BUT THIS EXPENSE GOT AN ENCORE. 🎟️",
    "YOUR BANK BALANCE DID NOT ENJOY THE PERFORMANCE. 🍿"
  ] },
  "debt payment": { amount: 30_000, messages: [
    "THAT DEBT JUST GOT AN EVICTION NOTICE. NICE. 🔥",
    "YOUR DEBT BALANCE FELT THAT ONE. KEEP SWINGING. 🥊",
    "BIG PAYMENT. BIG PAIN. EVEN BIGGER PROGRESS. 💪",
    "YOUR WALLET TOOK A HIT SO FUTURE YOU COULD BREATHE. 🫡",
    "THE DEBT COLLECTOR JUST HEARD BOSS MUSIC. 🎵",
    "EXPENSIVE TODAY, LESS INTEREST TOMORROW. SOLID MOVE. 📉"
  ] },
  "other expense": { amount: 20_000, messages: [
    "'OTHER' IS DOING A LOT OF WORK ON THAT RECEIPT. 👀",
    "MYSTERY EXPENSE UNLOCKED: FINANCIAL DAMAGE. 💀",
    "YOUR BUDGET WOULD LIKE A MORE DETAILED EXPLANATION. 🕵️",
    "THAT 'OTHER' EXPENSE LOOKS SUSPICIOUSLY EXPENSIVE. 💸",
    "CATEGORY: OTHER. CONSEQUENCE: VERY SPECIFIC. 😭",
    "YOUR WALLET KNOWS WHAT YOU DID, EVEN IF THE CATEGORY DOESN'T. 👛",
    "OTHER EXPENSE? MORE LIKE OTHER FINANCIAL EMERGENCY. 🚨"
  ] }
});

const GENERAL_EXPENSE_ROASTS = Object.freeze([
  "YOUR WALLET JUST FILED A MISSING PERSON REPORT. 😭",
  "THAT PURCHASE JUST PUT YOUR BUDGET INTO WITNESS PROTECTION. 🕶️",
  "YOUR BANK BALANCE LEFT THE CHAT. 💸",
  "FINANCIALLY, THAT WAS A JUMP SCARE. 👻",
  "THE RECEIPT SAID THANK YOU. YOUR WALLET SAID NOTHING. 💀",
  "BIG SPEND DETECTED. COMMON SENSE SIGNAL LOST. 📡",
  "YOUR MONEY DIDN'T WALK AWAY—IT SPRINTED. 🏃",
  "THAT EXPENSE CAME WITH ITS OWN GRAVITATIONAL PULL. 🌌"
]);

export function roastTransaction(transaction, state) {
  if (transaction.type !== "outcome" || getCurrency() !== "JPY") return null;

  const category = state.categories.find(({ id }) => id === transaction.categoryId)?.name.trim().toLowerCase();
  const roast = EXPENSE_ROASTS[category];
  if (roast && transaction.amount >= roast.amount) return pickRoast(roast.messages, transaction);
  if (transaction.amount >= 30_000) return pickRoast(GENERAL_EXPENSE_ROASTS, transaction);
  return null;
}

function pickRoast(messages, transaction) {
  const seed = `${transaction.id || ""}${transaction.note || ""}`;
  if (!seed) return messages[0];
  let hash = 0;
  for (const character of seed) hash = ((hash * 31) + character.codePointAt(0)) >>> 0;
  return messages[hash % messages.length];
}

export function calculateTotals(state, currentDate = todayString()) {
  const currentMonth = currentDate.slice(0, 7);
  return state.transactions.reduce((totals, transaction) => {
    const isIncome = transaction.type === "income";
    const isCurrentMonth = transaction.date.slice(0, 7) === currentMonth;
    totals.totalIncome += isIncome ? transaction.amount : 0;
    totals.totalOutcome += isIncome ? 0 : transaction.amount;
    totals.monthIncome += isIncome && isCurrentMonth ? transaction.amount : 0;
    totals.monthOutcome += !isIncome && isCurrentMonth ? transaction.amount : 0;
    totals.transactionCount += 1;
    return totals;
  }, {
    totalIncome: 0,
    totalOutcome: 0,
    monthIncome: 0,
    monthOutcome: 0,
    transactionCount: 0
  });
}

export function calculateAssetBalance(state) {
  return state.transactions.reduce((balance, transaction) =>
    balance + (transaction.type === "income" ? transaction.amount : -transaction.amount),
  Number(state.asset?.initialBalance) || 0);
}

export function calculateDebtSummaries(state) {
  return state.debts.map((debt) => {
    const paid = state.transactions
      .filter((item) => item.type === "outcome" && item.debtId === debt.id)
      .reduce((sum, item) => sum + item.amount, 0);
    return { ...debt, paid, remaining: Math.max(0, debt.originalAmount - paid) };
  });
}

export function calculateDebtTotal(state) {
  return calculateDebtSummaries(state).reduce((total, debt) => total + debt.remaining, 0);
}

export function sortTransactions(transactions) {
  return [...transactions].sort((a, b) =>
    `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`)
  );
}

export function filterTransactions(state, filters) {
  const search = filters.search.trim().toLowerCase();
  return sortTransactions(state.transactions)
    .filter((item) => filters.type === "all" || item.type === filters.type)
    .filter((item) => filters.categoryId === "all" || item.categoryId === filters.categoryId)
    .filter((item) => !filters.month || item.date.slice(0, 7) === filters.month)
    .filter((item) => {
      if (!search) return true;
      const category = state.categories.find(({ id }) => id === item.categoryId)?.name || "";
      const debt = state.debts.find(({ id }) => id === item.debtId)?.name || "";
      return [category, debt, item.note, item.date].join(" ").toLowerCase().includes(search);
    });
}

export function categorySpending(state, month, categoryId) {
  return state.transactions
    .filter((item) => item.type === "outcome" && item.categoryId === categoryId && item.date.startsWith(month))
    .reduce((sum, item) => sum + item.amount, 0);
}

