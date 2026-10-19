import {STORAGE_KEY,VERSION,uid,localDate,parseDate,moneyAmount,escapeHtml as e,initialState,loadState,saveState,sanitizeState,downloadBackup} from "./storage.js";
import {balance,totals,categoriesByAmount,monthlyTrend,spendingByDay,addTransaction,updateTransaction,transportEstimate,produceAutomations} from "./finance.js";

const fmt = value => new Intl.NumberFormat("ja-JP",{style:"currency",currency:"JPY",maximumFractionDigits:0}).format(value);
const views=["dashboard","transactions","analytics","transport","recurring","budgets","goals","settings"];
const names={dashboard:"Dashboard",transactions:"Transactions",analytics:"Analytics",transport:"Transport",recurring:"Recurring",budgets:"Budgets",goals:"Savings goals",settings:"Settings"};
let state,view="dashboard",editing=null,toastTimer;
let ui={month:localDate().slice(0,7),query:"",type:"all"};
const $=id=>document.getElementById(id);
try {state=loadState();} catch(error) {
  // Preserve malformed backup instead of silently resetting.
  state=initialState();
  alert("Your saved data could not be loaded. The original browser data has not been changed. Export/copy your old localStorage entry before saving new changes. "+error.message);
}
try {if(produceAutomations(state))saveState(state);}catch(err){console.error(err);}
const persist=()=>{saveState(state);render()};
const categorySelect=(type, selected="")=>state.categories.filter(c=>c.type===type||c.type==="both")
  .map(c=>'<option value="'+e(c.id)+'" '+(c.id===selected?"selected":"")+'>'+e(c.name)+'</option>').join("");
const categoryName=id=>state.categories.find(c=>c.id===id)?.name||"Deleted category";
const formInput=(name,label,type="text",value="",attrs="")=>'<label>'+e(label)+'<input name="'+name+'" type="'+type+'" value="'+e(value)+'" '+attrs+'></label>';
const button=(name,title,extra="")=>'<button type="button" class="button ghost" data-action="'+name+'" '+extra+'>'+title+'</button>';
function notify(message) {
 const el=$("toast");el.textContent=message;el.classList.add("show");
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),3200);
}
function navigate(next){view=next;editing=null;render();}
function shellNav(){
 $("desktopNav").innerHTML=views.map(v=>'<button type="button" data-view="'+v+'" class="nav-link '+(view===v?"active":"")+'">'+names[v]+'</button>').join("");
 $("mobileNav").innerHTML=["dashboard","transactions","analytics","transport","settings"].map(v=>'<button type="button" data-view="'+v+'" class="nav-link '+(view===v?"active":"")+'">'+names[v]+'</button>').join("");
 $("viewTitle").textContent=names[view];
 $("networkStatus").textContent=navigator.onLine?"Offline ready":"Offline";
}
function dashboard(){
 const t=totals(state,ui.month);
 const recent=[...state.transactions].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
 return '<section class="balance-hero"><p class="hero-label">Your single balance</p><strong>'+fmt(balance(state))+'</strong><span>JPY · one asset</span><div class="month-chips"><div class="month-chip"><span>Income this month</span><strong>'+fmt(t.income)+'</strong></div><div class="month-chip"><span>Expenses this month</span><strong>'+fmt(t.expenses)+'</strong></div></div></section>'+
 '<div class="toolbar">'+button("new-transaction","+ Add transaction")+button("new-transport","+ Transport rule")+'</div>'+
 '<section class="quiet-section"><h2>Recent transactions</h2>'+transactionList(recent)+'</section>'+
 '<section class="quiet-section"><h2>Monthly summary</h2><div class="finance-row">Net cash flow <strong>'+fmt(t.net)+'</strong></div></section>';
}
function transactionList(records) {
 if(!records.length)return '<div class="empty">No transactions yet.</div>';
 return '<div class="finance-list">'+records.map(t=>'<article class="finance-row"><div class="row-main"><p class="row-title">'+e(categoryName(t.categoryId))+'</p><p class="row-sub">'+e(t.note)+' · '+e(t.date)+(t.origin!=="manual"?' · '+e(t.origin):'')+'</p></div><div class="row-side"><strong class="amount '+e(t.type)+'">'+(t.type==="income"?"+":"−")+fmt(t.amount)+'</strong><div class="toolbar">'+(t.origin==="manual"?button("edit-transaction","Edit",'data-id="'+e(t.id)+'"'):"")+button("delete-transaction","Delete",'data-id="'+e(t.id)+'"')+'</div></div></article>').join("")+'</div>';
}
function transactionForm(){
 const t=editing?state.transactions.find(t=>t.id===editing):null;
 const type=t?.type||"outcome";
 return '<form id="transactionForm" class="transaction-panel"><h3>'+(t?"Edit":"New")+' transaction</h3><div class="form-grid">'+
 '<label>Type<select name="type" id="entryType"><option value="outcome" '+(type==="outcome"?"selected":"")+'>Expense</option><option value="income" '+(type==="income"?"selected":"")+'>Income</option></select></label>'+
 formInput("amount","Amount (¥)","number",t?.amount||"",'min="1" step="1" required')+
 '<label>Category<select name="categoryId" id="entryCategory">'+categorySelect(type,t?.categoryId)+'</select></label>'+
 formInput("date","Date","date",t?.date||localDate(),'required')+
 formInput("note","Note","text",t?.note||"",'maxlength="160"')+
 '</div><div class="toolbar"><button class="button primary" type="submit">Save</button>'+button("cancel-edit","Cancel")+'</div></form>';
}
function transactions(){
 const rows=state.transactions.filter(t=>(ui.type==="all"||t.type===ui.type)&&
 [t.note,categoryName(t.categoryId),t.date,t.origin].join(" ").toLowerCase().includes(ui.query.toLowerCase()))
 .sort((a,b)=>b.date.localeCompare(a.date));
 return '<div class="toolbar">'+button("new-transaction","+ Transaction")+'</div>'+
 (editing!==null?transactionForm():"")+
 '<div class="filter-panel"><label>Search<input id="searchTransactions" type="search" value="'+e(ui.query)+'" placeholder="Search transactions"></label>'+
 '<label>Type<select id="typeFilter"><option value="all">All</option><option value="income" '+(ui.type==="income"?"selected":"")+'>Income</option><option value="outcome" '+(ui.type==="outcome"?"selected":"")+'>Expenses</option></select></label></div>'+transactionList(rows);
}
function chartRows(data,max){
 if(!data.length)return '<div class="empty">No data yet.</div>';
 return data.map(([label,value])=>'<div class="chart-row"><span>'+e(label)+'</span><div class="bar-track"><div class="bar-fill" style="width:'+Math.round(100*value/Math.max(1,max))+'%"></div></div><strong>'+fmt(value)+'</strong></div>').join("");
}
function analytics(){
 const t=totals(state,ui.month),cats=categoriesByAmount(state,ui.month);
 const trends=monthlyTrend(state,6),daily=spendingByDay(state,ui.month);
 return '<div class="filter-panel"><label>Month<input id="analyticsMonth" type="month" value="'+e(ui.month)+'"></label></div>'+
 '<div class="stats-grid"><article><span>Income</span><strong>'+fmt(t.income)+'</strong></article><article><span>Expenses</span><strong>'+fmt(t.expenses)+'</strong></article><article><span>Net cash flow</span><strong>'+fmt(t.net)+'</strong></article><article><span>Avg. daily spending</span><strong>'+fmt(Math.round(t.expenses / Math.max(1,Number(ui.month.split("-")[1])===new Date().getMonth()+1?new Date().getDate():new Date(Number(ui.month.slice(0,4)),Number(ui.month.slice(5,7)),0).getDate())))+'</strong></article></div>'+
 '<section class="quiet-section"><h2>Expenses by category</h2>'+chartRows(cats.map(c=>[c.name,c.amount]),Math.max(1,...cats.map(c=>c.amount)))+'</section>'+
 '<section class="quiet-section"><h2>Monthly spending (last six months)</h2>'+chartRows(trends.map(t=>[t.month,t.expenses]),Math.max(1,...trends.map(t=>t.expenses)))+'</section>'+
 '<section class="quiet-section"><h2>Daily expenses</h2>'+chartRows(daily,Math.max(1,...daily.map(d=>d[1])))+'</section>';
}
function transport(){
 return '<section class="quiet-section"><h2>Add commute</h2><p class="row-sub">Plan monthly fare or automatically record return trips on selected weekdays whenever Okane opens.</p>'+
 '<form id="transportForm" class="management-form">'+formInput("name","Route name","text","Work commute",'required maxlength="60"')+
 formInput("outboundFare","Going fare (¥)","number","250",'min="0" step="1" required')+
 formInput("returnFare","Return fare (¥)","number","250",'min="0" step="1" required')+
 formInput("workDays","Working days / month","number","20",'min="1" max="31" required')+
 '<label>Mode<select name="mode"><option value="monthly">Monthly estimate only</option><option value="daily">Automatically log commuting days</option></select></label>'+
 '<label>Weekdays <small>(used for auto logging)</small><select name="weekdays" multiple size="7">'+["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d,i)=>'<option value="'+i+'" '+([1,2,3,4,5].includes(i)?"selected":"")+'>'+d+'</option>').join("")+'</select></label>'+
 formInput("startDate","Start date","date",localDate(),'required')+
 '<label>Expense category<select name="categoryId">'+categorySelect("outcome",state.categories.find(c=>c.name==="Transport")?.id)+'</select></label>'+
 '<button type="submit" class="button primary">Save commute</button></form></section>'+
 '<section class="quiet-section"><h2>Transport rules</h2>'+cards(state.transportRules,r=>'<strong>'+e(r.name)+'</strong><p class="row-sub">'+fmt(r.outboundFare)+' going + '+fmt(r.returnFare)+' return · '+fmt(transportEstimate(r))+'/month estimated · '+e(r.mode)+'</p>',"delete-transport")+'</section>';
}
function recurring(){
 return '<section class="quiet-section"><h2>Recurring income and expenses</h2><form id="recurringForm" class="management-form">'+
 formInput("name","Name","text","",'required maxlength="60"')+
 '<label>Type<select name="type" id="recurringType"><option value="outcome">Expense</option><option value="income">Income</option></select></label>'+
 formInput("amount","Amount (¥)","number","",'min="1" step="1" required')+
 '<label>Category<select name="categoryId" id="recurringCategory">'+categorySelect("outcome")+'</select></label>'+
 '<label>Frequency<select name="frequency"><option value="monthly">Monthly</option><option value="weekly">Weekly</option><option value="daily">Daily</option></select></label>'+
 formInput("startDate","Starts on","date",localDate(),'required')+
 '<button class="button primary" type="submit">Add recurring rule</button></form></section>'+
 '<section class="quiet-section"><h2>Rules</h2>'+cards(state.recurringRules,r=>'<strong>'+e(r.name)+'</strong><p class="row-sub">'+fmt(r.amount)+' · '+e(r.frequency)+' · '+e(r.type)+'</p>',"delete-recurring")+'</section>';
}
function cards(rows,body,action){
 return rows.length?'<div class="finance-list">'+rows.map(r=>'<article class="finance-row"><div>'+body(r)+'</div>'+button(action,"Delete",'data-id="'+e(r.id)+'"')+'</article>').join("")+'</div>':'<div class="empty">Nothing here yet.</div>';
}
function budgets(){
 const spent=categoriesByAmount(state,ui.month);
 return '<section class="quiet-section"><h2>Monthly budgets</h2><form id="budgetForm" class="management-form"><label>Category<select name="categoryId">'+categorySelect("outcome")+'</select></label>'+
 formInput("limit","Monthly budget (¥)","number","",'min="1" required')+
 '<button class="button primary" type="submit">Save budget</button></form></section>'+
 '<section class="quiet-section">'+cards(state.budgets,r=>{
 const amount=spent.find(x=>x.id===r.categoryId)?.amount||0;
 return '<strong>'+e(categoryName(r.categoryId))+'</strong><p class="row-sub">'+fmt(amount)+' of '+fmt(r.limit)+' · '+Math.round(100*amount/r.limit)+'%</p><div class="bar-track"><div class="bar-fill" style="width:'+Math.min(100,100*amount/r.limit)+'%"></div></div>';
 },"delete-budget")+'</section>';
}
function goals(){
 return '<section class="quiet-section"><h2>Savings goals</h2><p class="row-sub">Goals track progress; they do not deduct money from your single balance.</p><form id="goalForm" class="management-form">'+
 formInput("name","Goal","text","",'required maxlength="60"')+
 formInput("target","Target (¥)","number","",'min="1" required')+
 formInput("deadline","Deadline (optional)","date","")+
 '<button class="button primary" type="submit">Create goal</button></form></section><section class="quiet-section">'+
 cards(state.goals,r=>'<strong>'+e(r.name)+'</strong><p class="row-sub">'+fmt(r.progress)+' / '+fmt(r.target)+(r.deadline?" · "+e(r.deadline):"")+'</p><div class="bar-track"><div class="bar-fill" style="width:'+Math.min(100,100*r.progress/r.target)+'%"></div></div><form class="goalProgressForm" data-id="'+e(r.id)+'">'+formInput("progress","Saved so far (¥)","number",r.progress,'min="0" max="'+r.target+'"')+'<button type="submit" class="button ghost">Update</button></form>',"delete-goal")+'</section>';
}
function settings(){
 return '<section class="quiet-section"><h2>One balance</h2><p class="row-sub">There are no separate accounts or assets. Your balance is your opening amount plus all income minus expenses.</p>'+
 '<form id="openingForm" class="management-form">'+formInput("openingBalance","Opening balance (¥)","number",state.settings.openingBalance,'min="0" step="1" required')+
 '<button class="button primary" type="submit">Save opening balance</button></form></section>'+
 '<section class="quiet-section"><h2>Categories</h2><form id="categoryForm" class="management-form">'+formInput("name","Category","text","",'required maxlength="60"')+
 '<label>Type<select name="type"><option value="outcome">Expense</option><option value="income">Income</option><option value="both">Both</option></select></label><button class="button primary" type="submit">Add category</button></form>'+
 cards(state.categories,r=>'<strong>'+e(r.name)+'</strong><p class="row-sub">'+e(r.type)+'</p>',"delete-category")+'</section>'+
 '<section class="quiet-section"><h2>Backup and restore</h2><p class="row-sub">Local-only JSON backup. Export before clearing your browser data.</p>'+
 '<div class="toolbar">'+button("export","Export JSON")+button("import","Import JSON")+button("reset","Reset app")+'</div>'+
 '<input id="importFile" type="file" accept=".json,application/json" hidden></section>';
}
function render(){
 shellNav();
 const display={dashboard,transactions,analytics,transport,recurring,budgets,goals,settings};
 $("appContent").innerHTML=display[view]();
}
const fields=form=>Object.fromEntries(new FormData(form));
function safeRun(fn){
 try{fn();}catch(err){console.error(err);notify(err.message||"Could not complete action");}
}
function removeFrom(collection,id){
 const row=state[collection].find(x=>x.id===id);
 if(!row)throw Error("Item not found");
 if(!confirm("Delete this item?"))return;
 state[collection]=state[collection].filter(x=>x.id!==id);
 persist();
}
document.addEventListener("click",event=>safeRun(()=>{
 const nav=event.target.closest("[data-view]");
 if(nav){navigate(nav.dataset.view);return;}
 const node=event.target.closest("[data-action]");
 if(!node)return;
 const action=node.dataset.action,id=node.dataset.id;
 if(action==="new-transaction"){view="transactions";editing="new";render();return;}
 if(action==="new-transport"){navigate("transport");return;}
 if(action==="cancel-edit"){editing=null;render();return;}
 if(action==="edit-transaction"){editing=id;view="transactions";render();return;}
 if(action==="delete-transaction"){
  const tx=state.transactions.find(t=>t.id===id);
  if(!tx||!confirm("Delete transaction?"))return;
  if(tx.originKey){state.generatedKeys.push(tx.originKey);}
  state.transactions=state.transactions.filter(t=>t.id!==id);persist();return;
 }
 const collection={"delete-transport":"transportRules","delete-recurring":"recurringRules",
 "delete-budget":"budgets","delete-goal":"goals","delete-category":"categories"}[action];
 if(collection){
  if(collection==="categories"&&(state.transactions.some(t=>t.categoryId===id)||
    state.transportRules.some(t=>t.categoryId===id)||state.recurringRules.some(t=>t.categoryId===id)||
    state.budgets.some(t=>t.categoryId===id)))throw Error("Category is in use");
  removeFrom(collection,id);return;
 }
 if(action==="export"){downloadBackup(state);return;}
 if(action==="import"){$("importFile").click();return;}
 if(action==="reset"){
  if(prompt("Type RESET to erase all local finance data")!=="RESET")return;
  state=initialState();editing=null;persist();
 }
}));
document.addEventListener("change",event=>safeRun(()=>{
 if(event.target.id==="entryType"){$("entryCategory").innerHTML=categorySelect(event.target.value);return;}
 if(event.target.id==="recurringType"){$("recurringCategory").innerHTML=categorySelect(event.target.value);return;}
 if(event.target.id==="analyticsMonth"){ui.month=event.target.value;render();return;}
 if(event.target.id==="typeFilter"){ui.type=event.target.value;render();return;}
 if(event.target.id==="importFile"){
  const file=event.target.files?.[0];if(!file)return;
  file.text().then(raw=>safeRun(()=>{
   const loaded=sanitizeState(JSON.parse(raw));
   if(!confirm("Replace all current data with this backup?"))return;
   const old=state;state=loaded;
   try{saveState(state);produceAutomations(state);saveState(state);}catch(error){state=old;throw error;}
   render();notify("Backup imported");
  })).catch(err=>notify("Import failed: "+err.message));
 }
}));
document.addEventListener("input",event=>{
 if(event.target.id==="searchTransactions"){ui.query=event.target.value;const pos=event.target.selectionStart;render();$("searchTransactions").focus();$("searchTransactions").setSelectionRange(pos,pos);}
});
document.addEventListener("submit",event=>{
 if(!event.target.matches("form"))return;
 event.preventDefault();
 safeRun(()=>{
  const form=event.target,data=fields(form);
  switch(form.id){
  case "transactionForm":
   if(editing&&editing!=="new")updateTransaction(state,editing,data);
   else addTransaction(state,data);
   editing=null;break;
  case "transportForm":{
   const outboundFare=moneyAmount(data.outboundFare,true),returnFare=moneyAmount(data.returnFare,true);
   const workDays=Number(data.workDays);
   const weekdays=[...form.querySelector('[name="weekdays"]').selectedOptions].map(x=>Number(x.value));
   if(outboundFare===null||returnFare===null||!outboundFare&&!returnFare||!Number.isInteger(workDays)||workDays<1||workDays>31||
     !parseDate(data.startDate)||!weekdays.length)throw Error("Invalid transport settings");
   state.transportRules.push({id:uid(),name:data.name.slice(0,60),outboundFare,returnFare,workDays,
    mode:data.mode,weekdays,startDate:data.startDate,active:true,excludedDates:[],categoryId:data.categoryId});
   produceAutomations(state);break;
  }
  case "recurringForm":
   if(moneyAmount(data.amount)===null||!parseDate(data.startDate))throw Error("Invalid recurring rule");
   state.recurringRules.push({id:uid(),name:data.name.slice(0,60),type:data.type,amount:Number(data.amount),
    categoryId:data.categoryId,frequency:data.frequency,startDate:data.startDate,active:true});
   produceAutomations(state);break;
  case "budgetForm":
   if(moneyAmount(data.limit)===null)throw Error("Invalid budget");
   state.budgets=state.budgets.filter(b=>b.categoryId!==data.categoryId);
   state.budgets.push({id:uid(),categoryId:data.categoryId,limit:Number(data.limit)});break;
  case "goalForm":
   if(moneyAmount(data.target)===null||(data.deadline&&!parseDate(data.deadline)))throw Error("Invalid goal");
   state.goals.push({id:uid(),name:data.name.slice(0,60),target:Number(data.target),progress:0,deadline:data.deadline||""});break;
  case "openingForm":
   if(moneyAmount(data.openingBalance,true)===null)throw Error("Invalid opening balance");
   state.settings.openingBalance=Number(data.openingBalance);break;
  case "categoryForm":
   if(!data.name?.trim()||!["income","outcome","both"].includes(data.type))throw Error("Invalid category");
   state.categories.push({id:uid(),name:data.name.trim().slice(0,60),type:data.type});break;
  default:
   if(form.classList.contains("goalProgressForm")){
    const goal=state.goals.find(x=>x.id===form.dataset.id);
    const value=moneyAmount(data.progress,true);
    if(!goal||value===null||value>goal.target)throw Error("Invalid progress");
    goal.progress=value;
   }else return;
  }
  persist();notify("Saved");
 });
});
window.addEventListener("online",shellNav);
window.addEventListener("offline",shellNav);
render();
if("serviceWorker" in navigator && location.protocol!=="file:")navigator.serviceWorker.register("./service-worker.js").catch(console.error);
