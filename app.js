const KEY = "sissy_random_v2";

const defaults = {
  chastityProbability: 60,
  cages: [],
  content: [],
  games: [],
  roulette: {
    base: 1,
    cumTax: 0,
    entries: []
  },
  taskTags: [],
  outfitTags: [],
  reward: {
    name: "",
    target: 0,
    progress: 0,
    locked: false,
    preset: null
  },
  lastRollDate: null,
  rewardGrantedDate: null,
  todayResults: null
};

let data = load();

function load(){
  const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
  return merge(defaults, saved);
}
function merge(base, saved){
  if(Array.isArray(base)) return Array.isArray(saved) ? saved : base;
  if(typeof base === "object" && base !== null){
    const out = {...base};
    for(const k in saved || {}) out[k] = merge(base[k], saved[k]);
    return out;
  }
  return saved ?? base;
}
function save(){
  localStorage.setItem(KEY, JSON.stringify(data));
}
function today(){
  return new Date().toISOString().slice(0,10);
}
function uid(){
  return Math.random().toString(36).slice(2,10);
}
function clamp(n,min,max){
  return Math.max(min, Math.min(max, Number(n)||0));
}
function weightedRoll(items){
  const valid = items.filter(x => Number(x.weight) > 0);
  const total = valid.reduce((s,x)=>s+Number(x.weight),0);
  if(!total) return null;
  let r = Math.random() * total;
  for(const item of valid){
    r -= Number(item.weight);
    if(r <= 0) return item;
  }
  return valid[valid.length-1] || null;
}
function chance(prob){
  return Math.random() * 100 < Number(prob);
}
function esc(s){
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

/* Tabs */
document.querySelectorAll(".tab").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".panel").forEach(p=>p.classList.add("hidden"));
    document.getElementById(btn.dataset.tab).classList.remove("hidden");
  });
});

/* Reward controls */
document.getElementById("presetRewardBtn").onclick = () => {
  if(data.reward.locked) return alert("Reward is locked until claimed.");
  data.reward.name = "Chastity Decrease";
  data.reward.target = 15;
  data.reward.progress = 0;
  data.reward.preset = "chastityDecrease";
  save(); render();
};
document.getElementById("lockRewardBtn").onclick = () => {
  if(data.reward.locked) return;
  const name = document.getElementById("rewardNameInput").value.trim() || data.reward.name;
  const target = Number(document.getElementById("rewardTargetInput").value || data.reward.target);
  if(!name || !target || target < 1) return alert("Set a reward name and target days first.");
  data.reward.name = name;
  data.reward.target = Math.floor(target);
  data.reward.progress = 0;
  data.reward.locked = true;
  if(data.reward.name !== "Chastity Decrease") data.reward.preset = null;
  save(); render();
};
document.getElementById("claimRewardBtn").onclick = () => {
  if(data.reward.progress < data.reward.target) return;
  if(data.reward.preset === "chastityDecrease"){
    data.chastityProbability = Math.max(0, data.chastityProbability - 20);
  }
  data.reward = {name:"",target:0,progress:0,locked:false,preset:null};
  save(); render();
};

/* Simple list adders */
document.getElementById("addCage").onclick = () => addWeighted("cages","cageName","cageWeight");
document.getElementById("addContent").onclick = () => addWeighted("content","contentName","contentWeight");
document.getElementById("addGame").onclick = () => addWeighted("games","gameName","gameWeight");
function addWeighted(collection, nameId, weightId){
  const nameEl = document.getElementById(nameId), weightEl = document.getElementById(weightId);
  const name = nameEl.value.trim();
  const weight = Math.max(1, Number(weightEl.value)||1);
  if(!name) return alert("Enter a name.");
  data[collection].push({id:uid(), name, weight});
  nameEl.value = ""; weightEl.value = "";
  save(); render();
}

/* Roulette */
document.getElementById("cumTaxBtn").onclick = () => {
  data.roulette.cumTax += 1;
  save(); render();
};
document.getElementById("addRoulette").onclick = () => {
  const name = rouletteName.value.trim();
  const url = rouletteUrl.value.trim();
  const weight = Math.max(1, Number(rouletteWeight.value)||1);
  if(!name || !url) return alert("Enter a name and URL.");
  data.roulette.entries.push({id:uid(), name, url, weight});
  rouletteName.value = ""; rouletteUrl.value = ""; rouletteWeight.value = "";
  save(); render();
};

/* Tasks */
document.getElementById("addTaskTag").onclick = () => {
  const name = taskTagName.value.trim();
  if(!name) return alert("Enter a tag name.");
  data.taskTags.push({id:uid(), name, tasks:[]});
  taskTagName.value = "";
  save(); render();
};

/* Outfits */
document.getElementById("addOutfitTag").onclick = () => {
  const name = outfitTagName.value.trim();
  const probability = clamp(outfitTagProb.value,0,100);
  if(!name) return alert("Enter a tag name.");
  data.outfitTags.push({id:uid(), name, probability, items:[]});
  outfitTagName.value = ""; outfitTagProb.value = "";
  save(); render();
};

/* Roll All */
document.getElementById("rollAllBtn").onclick = () => {
  const t = today();
  if(data.lastRollDate === t) return alert("Today's Roll All has already been used.");

  const results = {};
  const chastityYes = chance(data.chastityProbability);
  results.chastity = {result: chastityYes ? "YES" : "NO", cage: null};
  if(chastityYes){
    const cage = weightedRoll(data.cages);
    results.chastity.cage = cage ? cage.name : "No cage configured";
  } else {
    data.chastityProbability += 1;
  }

  const content = weightedRoll(data.content);
  const game = weightedRoll(data.games);
  results.content = content ? content.name : "No content configured";
  results.game = game ? game.name : "No game configured";

  results.tasks = rollTasks();
  results.outfits = rollOutfits();
  results.roulette = rollRoulette();

  data.lastRollDate = t;
  data.rewardGrantedDate = null;
  data.todayResults = results;
  save();
  render();

  if(results.roulette.triggered && results.roulette.url){
    window.open(results.roulette.url, "_blank");
  }
};

function rollRoulette(){
  const effective = data.roulette.base + data.roulette.cumTax;
  if(chance(effective)){
    const picked = weightedRoll(data.roulette.entries);
    data.roulette.cumTax = 0;
    data.roulette.base = Math.round((data.roulette.base + 0.5) * 10) / 10;
    return {triggered:true, name:picked ? picked.name : "No roulette entry configured", url:picked ? picked.url : ""};
  }
  return {triggered:false};
}
function rollTasks(){
  const results = [];
  for(const tag of data.taskTags){
    const hits = tag.tasks.filter(task => chance(task.probability));
    if(hits.length){
      const picked = hits[Math.floor(Math.random()*hits.length)];
      results.push({id:uid(), tag:tag.name, name:picked.name, complete:false});
    }
  }
  if(!results.length){
    const all = data.taskTags.flatMap(tag => tag.tasks.map(task => ({tag:tag.name, name:task.name})));
    if(all.length){
      const picked = all[Math.floor(Math.random()*all.length)];
      results.push({id:uid(), tag:picked.tag, name:picked.name, complete:false, failsafe:true});
    }
  }
  return results;
}
function rollOutfits(){
  const results = [];
  for(const tag of data.outfitTags){
    if(chance(tag.probability) && tag.items.length){
      const item = tag.items[Math.floor(Math.random()*tag.items.length)];
      results.push({tag:tag.name, name:item.name});
    }
  }
  return results;
}

/* Render */
function render(){
  renderReward();
  renderRollStatus();
  renderWeightedList("cageList", data.cages, "cages");
  renderWeightedList("contentList", data.content, "content");
  renderWeightedList("gameList", data.games, "games");
  renderRoulette();
  renderTasks();
  renderOutfits();
  renderResults();

  document.getElementById("chastityProb").textContent = Number(data.chastityProbability).toFixed(data.chastityProbability % 1 ? 1 : 0);
  save();
}
function renderReward(){
  const reward = data.reward;
  rewardTitle.textContent = reward.name || "No reward active";
  rewardBar.max = Math.max(reward.target, 1);
  rewardBar.value = reward.progress || 0;
  rewardProgress.textContent = `${reward.progress || 0} / ${reward.target || 0} days`;
  rewardLockBadge.textContent = reward.locked ? "Locked" : "Unlocked";
  rewardEditor.classList.toggle("hidden", reward.locked);
  lockRewardBtn.disabled = reward.locked;
  presetRewardBtn.disabled = reward.locked;
  claimRewardBtn.classList.toggle("hidden", !(reward.locked && reward.target > 0 && reward.progress >= reward.target));
  rewardNameInput.value = reward.locked ? "" : (reward.name || "");
  rewardTargetInput.value = reward.locked ? "" : (reward.target || "");
}
function renderRollStatus(){
  const t = today();
  if(data.lastRollDate === t){
    rollAllBtn.disabled = true;
    rollStatus.textContent = "Roll All used today. It unlocks automatically tomorrow.";
  } else {
    rollAllBtn.disabled = false;
    rollStatus.textContent = "Roll All is available today.";
  }
}
function renderWeightedList(id, arr, key){
  document.getElementById(id).innerHTML = arr.map(item => `
    <div class="item">
      <div><b>${esc(item.name)}</b><div class="muted">Weight: ${esc(item.weight)}</div></div>
      <div class="item-actions">
        <input type="number" min="1" value="${esc(item.weight)}" onchange="updateItem('${key}','${item.id}','weight',this.value)">
        <button class="delete" onclick="deleteItem('${key}','${item.id}')">Delete</button>
      </div>
    </div>
  `).join("") || `<div class="muted">No entries yet.</div>`;
}
function renderRoulette(){
  rouletteBase.textContent = data.roulette.base;
  rouletteTax.textContent = data.roulette.cumTax;
  rouletteEffective.textContent = data.roulette.base + data.roulette.cumTax;
  rouletteList.innerHTML = data.roulette.entries.map(item => `
    <div class="item">
      <div><b>${esc(item.name)}</b><div class="muted">${esc(item.url)}</div><div class="muted">Weight: ${esc(item.weight)}</div></div>
      <div class="item-actions">
        <input type="number" min="1" value="${esc(item.weight)}" onchange="updateRoulette('${item.id}','weight',this.value)">
        <button class="delete" onclick="deleteRoulette('${item.id}')">Delete</button>
      </div>
    </div>
  `).join("") || `<div class="muted">No roulette entries yet.</div>`;
}
function renderTasks(){
  todayTasks.innerHTML = renderTodayTasks();
  taskTags.innerHTML = data.taskTags.map(tag => `
    <div class="tag-card">
      <div class="item">
        <b>${esc(tag.name)}</b>
        <button class="delete" onclick="deleteTaskTag('${tag.id}')">Delete Tag</button>
      </div>
      <div class="inline-form">
        <input id="taskName-${tag.id}" placeholder="Task name">
        <input id="taskProb-${tag.id}" type="number" min="0" max="100" step="1" placeholder="Probability %">
        <button onclick="addTask('${tag.id}')">Add Task</button>
      </div>
      <div class="list">
        ${tag.tasks.map(task => `
          <div class="item">
            <div><b>${esc(task.name)}</b><div class="muted">${esc(task.probability)}%</div></div>
            <div class="item-actions">
              <input type="number" min="0" max="100" value="${esc(task.probability)}" onchange="updateTask('${tag.id}','${task.id}',this.value)">
              <button class="delete" onclick="deleteTask('${tag.id}','${task.id}')">Delete</button>
            </div>
          </div>
        `).join("") || `<div class="muted">No tasks in this tag.</div>`}
      </div>
    </div>
  `).join("") || `<div class="muted">No task tags yet.</div>`;
}
function renderTodayTasks(){
  const tasks = data.todayResults?.tasks || [];
  if(!tasks.length) return "No tasks rolled yet.";
  return tasks.map(task => `
    <label class="task-check">
      <input type="checkbox" ${task.complete ? "checked" : ""} onchange="toggleTodayTask('${task.id}',this.checked)">
      <span><b>${esc(task.tag)}</b> — ${esc(task.name)}${task.failsafe ? " <span class='muted'>(failsafe)</span>" : ""}</span>
    </label>
  `).join("");
}
function renderOutfits(){
  const outfit = data.todayResults?.outfits || [];
  todayOutfit.innerHTML = outfit.length ? outfit.map(o=>`<div class="item"><b>${esc(o.tag)}</b><span>${esc(o.name)}</span></div>`).join("") : "No outfit rolled yet.";
  outfitTags.innerHTML = data.outfitTags.map(tag => `
    <div class="tag-card">
      <div class="item">
        <div><b>${esc(tag.name)}</b><div class="muted">Probability: ${esc(tag.probability)}%</div></div>
        <div class="item-actions">
          <input type="number" min="0" max="100" value="${esc(tag.probability)}" onchange="updateOutfitTag('${tag.id}',this.value)">
          <button class="delete" onclick="deleteOutfitTag('${tag.id}')">Delete Tag</button>
        </div>
      </div>
      <div class="inline-form">
        <input id="outfitItem-${tag.id}" placeholder="Item name">
        <button onclick="addOutfitItem('${tag.id}')">Add Item</button>
      </div>
      <div class="list">
        ${tag.items.map(item => `
          <div class="item"><b>${esc(item.name)}</b><button class="delete" onclick="deleteOutfitItem('${tag.id}','${item.id}')">Delete</button></div>
        `).join("") || `<div class="muted">No items in this tag.</div>`}
      </div>
    </div>
  `).join("") || `<div class="muted">No outfit tags yet.</div>`;
}
function renderResults(){
  if(!data.todayResults){
    results.classList.add("hidden");
    return;
  }
  const r = data.todayResults;
  results.classList.remove("hidden");
  results.innerHTML = `
    <h2>Today's Results</h2>
    <div class="result-grid">
      <div class="result-box"><h4>Chastity</h4><p>${esc(r.chastity.result)}${r.chastity.cage ? " — " + esc(r.chastity.cage) : ""}</p></div>
      <div class="result-box"><h4>Content</h4><p>${esc(r.content)}</p></div>
      <div class="result-box"><h4>Game</h4><p>${esc(r.game)}</p></div>
      <div class="result-box"><h4>Tasks</h4><p>${(r.tasks||[]).map(t=>`${esc(t.tag)} — ${esc(t.name)}`).join("<br>") || "No tasks"}</p></div>
      <div class="result-box"><h4>Outfits</h4><p>${(r.outfits||[]).map(o=>`${esc(o.tag)} — ${esc(o.name)}`).join("<br>") || "No outfit items"}</p></div>
      <div class="result-box"><h4>Roulette</h4><p>${r.roulette.triggered ? "Triggered — " + esc(r.roulette.name) : "No trigger"}</p></div>
    </div>
  `;
}

/* Global edit helpers */
window.updateItem = (key,id,field,value) => {
  const item = data[key].find(x=>x.id===id);
  if(item) item[field] = field === "weight" ? Math.max(1, Number(value)||1) : value;
  save(); render();
};
window.deleteItem = (key,id) => {
  data[key] = data[key].filter(x=>x.id!==id);
  save(); render();
};
window.updateRoulette = (id,field,value) => {
  const item = data.roulette.entries.find(x=>x.id===id);
  if(item) item[field] = field === "weight" ? Math.max(1, Number(value)||1) : value;
  save(); render();
};
window.deleteRoulette = id => {
  data.roulette.entries = data.roulette.entries.filter(x=>x.id!==id);
  save(); render();
};
window.deleteTaskTag = id => {
  data.taskTags = data.taskTags.filter(x=>x.id!==id);
  save(); render();
};
window.addTask = tagId => {
  const tag = data.taskTags.find(x=>x.id===tagId);
  const nameEl = document.getElementById(`taskName-${tagId}`);
  const probEl = document.getElementById(`taskProb-${tagId}`);
  const name = nameEl.value.trim();
  if(!name) return alert("Enter a task name.");
  tag.tasks.push({id:uid(), name, probability:clamp(probEl.value,0,100)});
  save(); render();
};
window.updateTask = (tagId,taskId,value) => {
  const task = data.taskTags.find(t=>t.id===tagId)?.tasks.find(x=>x.id===taskId);
  if(task) task.probability = clamp(value,0,100);
  save(); render();
};
window.deleteTask = (tagId,taskId) => {
  const tag = data.taskTags.find(t=>t.id===tagId);
  if(tag) tag.tasks = tag.tasks.filter(x=>x.id!==taskId);
  save(); render();
};
window.updateOutfitTag = (tagId,value) => {
  const tag = data.outfitTags.find(x=>x.id===tagId);
  if(tag) tag.probability = clamp(value,0,100);
  save(); render();
};
window.deleteOutfitTag = id => {
  data.outfitTags = data.outfitTags.filter(x=>x.id!==id);
  save(); render();
};
window.addOutfitItem = tagId => {
  const tag = data.outfitTags.find(x=>x.id===tagId);
  const el = document.getElementById(`outfitItem-${tagId}`);
  const name = el.value.trim();
  if(!name) return alert("Enter an item name.");
  tag.items.push({id:uid(), name});
  save(); render();
};
window.deleteOutfitItem = (tagId,itemId) => {
  const tag = data.outfitTags.find(x=>x.id===tagId);
  if(tag) tag.items = tag.items.filter(x=>x.id!==itemId);
  save(); render();
};
window.toggleTodayTask = (taskId,checked) => {
  const tasks = data.todayResults?.tasks || [];
  const task = tasks.find(x=>x.id===taskId);
  if(task) task.complete = checked;
  const allDone = tasks.length && tasks.every(x=>x.complete);
  if(allDone && data.reward.locked && data.rewardGrantedDate !== today()){
    data.reward.progress = Math.min(data.reward.target, data.reward.progress + 1);
    data.rewardGrantedDate = today();
    alert("All tasks complete. Reward progress increased by 1.");
  }
  save(); render();
};

render();




/* V4 Dev Tools */
function forceRollAll(){
  data.lastRollDate = null;
  save();
  document.getElementById("rollAllBtn").disabled = false;
  document.getElementById("rollAllBtn").click();
}
function bindDevTools(){
  const panel = document.getElementById("devPanel");
  const toggle = document.getElementById("devToggle");
  if(!panel || !toggle) return;
  toggle.onclick = () => panel.classList.toggle("hidden");

  document.getElementById("devUnlockRoll").onclick = () => {
    data.lastRollDate = null;
    save(); render();
    alert("Today's roll has been unlocked.");
  };
  document.getElementById("devClearResults").onclick = () => {
    data.todayResults = null;
    data.rewardGrantedDate = null;
    save(); render();
  };
  document.getElementById("devResetAll").onclick = () => {
    if(confirm("Reset all local data?")){
      localStorage.removeItem(KEY);
      data = load();
      save(); render();
    }
  };
  document.getElementById("devRewardPlus").onclick = () => {
    data.reward.progress = Math.min(data.reward.target || 999, (data.reward.progress || 0) + 1);
    save(); render();
  };
  document.getElementById("devRewardMinus").onclick = () => {
    data.reward.progress = Math.max(0, (data.reward.progress || 0) - 1);
    save(); render();
  };
  document.getElementById("devChastityPlus").onclick = () => {
    data.chastityProbability = Math.min(100, Number(data.chastityProbability || 0) + 5);
    save(); render();
  };
  document.getElementById("devChastityMinus").onclick = () => {
    data.chastityProbability = Math.max(0, Number(data.chastityProbability || 0) - 5);
    save(); render();
  };
  document.getElementById("devTaxPlus").onclick = () => {
    data.roulette.cumTax = Number(data.roulette.cumTax || 0) + 5;
    save(); render();
  };
  document.getElementById("devTaxReset").onclick = () => {
    data.roulette.cumTax = 0;
    save(); render();
  };
  document.getElementById("devRouletteBasePlus").onclick = () => {
    data.roulette.base = Math.round((Number(data.roulette.base || 0) + 0.5) * 10) / 10;
    save(); render();
  };
  document.getElementById("devRouletteBaseMinus").onclick = () => {
    data.roulette.base = Math.max(0, Math.round((Number(data.roulette.base || 0) - 0.5) * 10) / 10);
    save(); render();
  };
  document.getElementById("devForceReroll").onclick = () => {
    forceRollAll();
  };
}
bindDevTools();


/* V5 PWA update handling */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js?v=5").then(reg => {
    reg.addEventListener("updatefound", () => {
      const worker = reg.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          worker.postMessage({type:"SKIP_WAITING"});
        }
      });
    });
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    const toast = document.getElementById("updateToast");
    if (toast) toast.classList.remove("hidden");
    setTimeout(() => window.location.reload(), 500);
  });
}
