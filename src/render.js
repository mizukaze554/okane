import { escapeHtml, formatDate, formatMoney } from "./utils.js";

export function emptyState(title, message) {
  return `<div class="empty"><strong>${escapeHtml(title)}</strong>${escapeHtml(message)}</div>`;
}

export function transactionCard(transaction, state) {
  const category = state.categories.find(({ id }) => id === transaction.categoryId);
  const sign = transaction.type === "income" ? "+" : "-";
  const debtName = state.debts.find(({ id }) => id === transaction.debtId)?.name;

  return `
    <article class="finance-row">
      <div class="row-main">
        <p class="row-title">${escapeHtml(category?.name || "Deleted category")}</p>
        <p class="row-sub">${escapeHtml(transaction.note || debtName || "Single asset")}</p>
        <p class="row-detail">${formatDate(transaction.date)}${debtName ? ` · ${escapeHtml(debtName)}` : ""}</p>
      </div>
      <div class="row-side">
        <div class="amount ${transaction.type}">${sign}${formatMoney(transaction.amount)}</div>
        <span class="pill ${transaction.type}">${transaction.type}</span>
        <div class="row-actions">
          ${transaction.debtId ? "" : `<button class="text-link" type="button" data-edit-transaction="${escapeHtml(transaction.id)}">Edit</button>`}
          <button class="delete-link" type="button" data-delete-transaction="${escapeHtml(transaction.id)}" aria-label="Delete transaction">Delete</button>
        </div>
      </div>
    </article>`;
}

