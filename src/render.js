import { escapeHtml, formatDate, formatMoney } from "./utils.js";

export function emptyState(title, message) {
  return `<div class="empty"><strong>${escapeHtml(title)}</strong>${escapeHtml(message)}</div>`;
}

export function transactionCard(transaction, state) {
  const category = state.categories.find(({ id }) => id === transaction.categoryId);
  const account = state.accounts.find(({ id }) => id === transaction.accountId);
  const sign = transaction.type === "income" ? "+" : "-";
  const accountName = account?.name || "Deleted account";

  return `
    <article class="finance-row">
      <div class="row-main">
        <p class="row-title">${escapeHtml(category?.name || "Deleted category")}</p>
        <p class="row-sub">${escapeHtml(transaction.note || accountName)}</p>
        <p class="row-detail">${formatDate(transaction.date)} · ${escapeHtml(accountName)}</p>
      </div>
      <div class="row-side">
        <div class="amount ${transaction.type}">${sign}${formatMoney(transaction.amount)}</div>
        <span class="pill ${transaction.type}">${transaction.type}</span>
        <div class="row-actions">
          <button class="text-link" type="button" data-edit-transaction="${escapeHtml(transaction.id)}">Edit</button>
          <button class="delete-link" type="button" data-delete-transaction="${escapeHtml(transaction.id)}" aria-label="Delete transaction">Delete</button>
        </div>
      </div>
    </article>`;
}

export function accountSummaryCard(account) {
  const max = Math.max(account.totalIncome, account.totalOutcome, Math.abs(account.currentBalance), 1);
  const progress = Math.min(100, Math.max(8, Math.abs(account.currentBalance) / max * 100));
  return `
    <article class="finance-row">
      <div class="row-main">
        <p class="row-title">${escapeHtml(account.name)} <span class="pill">${account.kind === "debt" ? "debt" : "asset"}</span></p>
        <p class="row-sub">Initial ${formatMoney(account.initialBalance)} · In ${formatMoney(account.totalIncome)} · Out ${formatMoney(account.totalOutcome)}</p>
      </div>
      <div class="row-side"><div class="amount">${formatMoney(account.currentBalance)}</div></div>
      <div class="account-progress" aria-hidden="true" style="--progress: ${progress}%"><span></span></div>
    </article>`;
}

export function accountManagementRow(account, transactionCount) {
  return accountSummaryCard(account).replace("</article>", `
    <button class="delete-link" type="button" data-delete-account="${escapeHtml(account.id)}">Delete</button>
    <p class="row-detail">${transactionCount} transactions</p>
  </article>`);
}

