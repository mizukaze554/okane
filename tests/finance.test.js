import test from "node:test";
import assert from "node:assert/strict";
import {initialState,sanitizeState,localDate,moneyAmount,parseDate} from "../src/storage.js";
import {balance,addTransaction,updateTransaction,totals,transportEstimate,produceAutomations,categoriesByAmount} from "../src/finance.js";

test("migration collapses v1 access balances into exactly one opening balance",()=>{
 const v1={version:"1.0.0",categories:[{id:"food",name:"Food",type:"outcome"}],accesses:[
 {id:"bank",name:"Bank",initialBalance:4000},{id:"wallet",name:"PayPay",initialBalance:1000}],
 transactions:[{id:"txn",type:"outcome",amount:500,categoryId:"food",accessId:"bank",date:"2026-10-12"}]};
 const migrated=sanitizeState(v1);
 assert.equal(migrated.settings.openingBalance,5000);
 assert.equal(balance(migrated),4500);
 assert.equal("accesses" in migrated,false);
});
test("single balance changes only from income and expenses",()=>{
 const state=initialState();
 state.settings.openingBalance=1000;
 const income=state.categories.find(c=>c.type==="income").id;
 const outcome=state.categories.find(c=>c.type==="outcome").id;
 addTransaction(state,{type:"income",amount:900,categoryId:income,date:"2026-10-12"});
 addTransaction(state,{type:"outcome",amount:100,categoryId:outcome,date:"2026-10-13"});
 assert.equal(balance(state),1800);
 assert.equal(totals(state,"2026-10").net,800);
 updateTransaction(state,state.transactions[0].id,{amount:200});
 assert.equal(balance(state),1700);
 assert.equal(categoriesByAmount(state,"2026-10").reduce((sum,c)=>sum+c.amount,0),200);
});
test("transport estimates round-trip fare",()=>{
 assert.equal(transportEstimate({outboundFare:250,returnFare:300,workDays:18}),9900);
});
test("automation is idempotent and skips weekdays not selected",()=>{
 const state=initialState();
 const transport=state.categories.find(c=>c.name==="Transport").id;
 state.transportRules.push({id:"commute",name:"Work",outboundFare:200,returnFare:300,
 workDays:20,mode:"daily",weekdays:[1,2,3,4,5],startDate:"2026-10-12",active:true,excludedDates:["2026-10-13"],categoryId:transport});
 assert.equal(produceAutomations(state,"2026-10-19"),4);
 assert.equal(balance(state),-2000);
 assert.equal(produceAutomations(state,"2026-10-19"),0);
 assert.equal(state.transactions.length,4);
});
test("recurring entries are not duplicated, monthly handles shorter months",()=>{
 const state=initialState();
 const expense=state.categories.find(c=>c.type==="outcome").id;
 state.recurringRules.push({id:"rent",name:"Rent",type:"outcome",amount:100,
 categoryId:expense,frequency:"monthly",startDate:"2026-01-31",active:true});
 assert.equal(produceAutomations(state,"2026-03-01"),2);
 assert.deepEqual(state.transactions.map(t=>t.date).sort(),["2026-01-31","2026-02-28"]);
 assert.equal(produceAutomations(state,"2026-03-01"),0);
});
test("rejects bad calendar dates and invalid monetary amounts",()=>{
 assert.equal(parseDate("2026-02-30"),null);
 assert.equal(moneyAmount(-3),null);
 assert.equal(moneyAmount(1.2),null);
 assert.equal(moneyAmount(Infinity),null);
});
