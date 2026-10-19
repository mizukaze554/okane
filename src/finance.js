import {uid, localDate, parseDate, moneyAmount} from "./storage.js";

export function balance(state) {
  return state.settings.openingBalance + state.transactions.reduce((sum, t) => sum + (t.type === "income" ? t.amount : -t.amount), 0);
}
export function totals(state, month = localDate().slice(0, 7)) {
  const tx = state.transactions.filter(t => t.date.startsWith(month));
  const income = tx.filter(t => t.type === "income").reduce((s,t) => s+t.amount,0);
  const expenses = tx.filter(t => t.type === "outcome").reduce((s,t) => s+t.amount,0);
  return {income, expenses, net: income-expenses, balance: balance(state)};
}
export function categoriesByAmount(state, month = localDate().slice(0,7)) {
  const map = new Map();
  for (const t of state.transactions) if (t.type === "outcome" && t.date.startsWith(month)) {
    map.set(t.categoryId, (map.get(t.categoryId) || 0)+t.amount);
  }
  return [...map.entries()].map(([id,amount]) => ({
    id, name:state.categories.find(c=>c.id===id)?.name || "Deleted category", amount
  })).sort((a,b)=>b.amount-a.amount);
}
export function monthlyTrend(state, count = 6) {
  const today = parseDate(localDate());
  return Array.from({length: count},(_,index)=>{
    const date = new Date(today.getFullYear(),today.getMonth() - (count-1-index),1,12);
    const month = localDate(date).slice(0,7);
    return {month,...totals(state,month)};
  });
}
export function spendingByDay(state, month) {
  const map = new Map();
  state.transactions.filter(t=>t.type==="outcome" && t.date.startsWith(month)).forEach(t=>map.set(t.date,(map.get(t.date)||0)+t.amount));
  return [...map].sort((a,b)=>a[0].localeCompare(b[0]));
}
export function addTransaction(state, fields) {
  const amount = moneyAmount(fields.amount);
  if (!amount || !["income","outcome"].includes(fields.type) || !parseDate(fields.date)) throw Error("Invalid transaction");
  if (!state.categories.some(c=>c.id===fields.categoryId && (c.type===fields.type || c.type==="both"))) throw Error("Choose a valid category");
  const tx = {id:uid(),type:fields.type,amount,date:fields.date,categoryId:fields.categoryId,
    note:String(fields.note||"").slice(0,160),origin:"manual",originKey:"",createdAt:new Date().toISOString()};
  state.transactions.unshift(tx);
  return tx;
}
export function updateTransaction(state,id,fields) {
  const original = state.transactions.find(t=>t.id===id);
  if (!original) throw Error("Transaction not found");
  if (original.origin !== "manual") throw Error("Automated records must be changed through their rule");
  const draft={...original,...fields};
  const copy={...state,transactions:[]};
  const updated=addTransaction(copy,draft);
  Object.assign(original,{type:updated.type,amount:updated.amount,date:updated.date,
    categoryId:updated.categoryId,note:updated.note});
}
export function transportEstimate(rule) {
  return (Number(rule.outboundFare)+Number(rule.returnFare))*Number(rule.workDays);
}
export function produceAutomations(state, now = localDate()) {
  const end = parseDate(now);
  if (!end) throw Error("Invalid automation date");
  const existing = new Set([...state.generatedKeys,...state.transactions.map(t=>t.originKey).filter(Boolean)]);
  const added = [];
  const insert = (key,type,amount,categoryId,note,date,origin)=>{
    if(existing.has(key)) return;
    existing.add(key);
    state.generatedKeys.push(key);
    if (!amount || !state.categories.some(c=>c.id===categoryId && (c.type===type || c.type==="both"))) return;
    added.push({id:uid(),type,amount,categoryId,note,date,origin,originKey:key,createdAt:new Date().toISOString()});
  };
  for (const rule of state.transportRules.filter(r=>r.active && r.mode==="daily")) {
    const start=parseDate(rule.startDate);
    if(!start) continue;
    let cursor=new Date(Math.max(start.getTime(),end.getTime()-365*86400000));
    for(;cursor<=end;cursor.setDate(cursor.getDate()+1)) {
      const day=localDate(cursor);
      if(!rule.weekdays.includes(cursor.getDay()) || rule.excludedDates.includes(day)) continue;
      insert("transport:"+rule.id+":"+day,"outcome",rule.outboundFare+rule.returnFare,rule.categoryId,rule.name,day,"transport");
    }
  }
  for (const rule of state.recurringRules.filter(r=>r.active)) {
    const start=parseDate(rule.startDate);
    if(!start)continue;
    // Generate up to 12 months of due events on first run, without guessing skipped future expenses.
    const from=new Date(Math.max(start.getTime(),end.getTime()-365*86400000));
    for(let cursor=from;cursor<=end;cursor.setDate(cursor.getDate()+1)) {
      const days=Math.round((cursor-start)/86400000);
      const sameMonthlyDay=cursor.getDate()===Math.min(start.getDate(),new Date(cursor.getFullYear(),cursor.getMonth()+1,0).getDate());
      const due=rule.frequency==="daily" || (rule.frequency==="weekly" && days%7===0) ||
        (rule.frequency==="monthly" && (cursor.getFullYear()>start.getFullYear() ||
          (cursor.getFullYear()===start.getFullYear() && cursor.getMonth()>=start.getMonth())) && sameMonthlyDay);
      if(!due) continue;
      const day=localDate(cursor);
      insert("recurring:"+rule.id+":"+day,rule.type,rule.amount,rule.categoryId,rule.name,day,"recurring");
    }
  }
  state.transactions.unshift(...added);
  return added.length;
}
