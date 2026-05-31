
/* V12 cache killer: removes old service workers/caches that may keep stale broken JS/CSS alive. */
(function(){
  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(reg => reg.unregister()));
    }
    if ('caches' in window) {
      caches.keys().then(keys => keys.forEach(key => caches.delete(key)));
    }
  } catch(e) { console.warn('Cache cleanup failed', e); }
})();

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
  todayResults: null,
  points: 0,
  lifetimePoints: 0,
  upgrades: {},
  punishmentBar: 0,
  activePunishments: [],
  punishmentCostMultiplier: 1,
  punishmentBurdenMult: 1,
  theEndCostBonus: 0,
  theEndUnlocked: false,
  lastSeenDate: null,
  rsbdYears: {},
  forceRSBDToday: false,
  adjudicatedDates: {}
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
  data.outfitTags.push({id:uid(), name, probability, requiredTags:"", incompatibleTags:"", items:[]});
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
  const rolledTags = [];

  // First pass: roll each tag normally.
  for(const tag of data.outfitTags){
    if(chance(tag.probability) && tag.items.length){
      rolledTags.push(tag.id);
    }
  }

  // Build complete bundles for every rolled tag.
  // Example: Skirt requires Top, so Skirt becomes bundle [Skirt, Top].
  let bundles = rolledTags.map(tagId => buildOutfitBundle(tagId));

  // Remove empty bundles.
  bundles = bundles.filter(bundle => bundle.length > 0);

  // Resolve incompatibilities between complete bundles.
  // Example: Dress incompatible with Skirt. Since Skirt bundle includes Top,
  // Dress conflicts with the whole Skirt+Top bundle. Winner is 50/50.
  bundles = resolveOutfitBundleConflicts(bundles);

  // Flatten winning bundles into final unique tag IDs.
  const finalTagIds = [];
  for(const bundle of bundles){
    for(const tagId of bundle){
      if(!finalTagIds.includes(tagId)) finalTagIds.push(tagId);
    }
  }

  // Pick one item from each final tag.
  const results = [];
  for(const tagId of finalTagIds){
    const tag = getOutfitTagById(tagId);
    if(!tag || !tag.items.length) continue;
    const item = tag.items[Math.floor(Math.random()*tag.items.length)];
    results.push({tag: tag.name, name: item.name});
  }

  return results;
}

function normalizeRuleList(value){
  return String(value || "")
    .split(",")
    .map(x => x.trim().toLowerCase())
    .filter(Boolean);
}

function findOutfitTagByName(name){
  const target = String(name || "").trim().toLowerCase();
  return data.outfitTags.find(tag => tag.name.trim().toLowerCase() === target);
}

function getOutfitTagById(id){
  return data.outfitTags.find(tag => tag.id === id);
}

function buildOutfitBundle(rootTagId, visited = new Set()){
  if(visited.has(rootTagId)) return [];
  visited.add(rootTagId);

  const tag = getOutfitTagById(rootTagId);
  if(!tag || !tag.items.length) return [];

  const bundle = [rootTagId];
  const requiredNames = normalizeRuleList(tag.requiredTags);

  for(const reqName of requiredNames){
    const requiredTag = findOutfitTagByName(reqName);
    if(!requiredTag || !requiredTag.items.length) continue;

    const requiredBundle = buildOutfitBundle(requiredTag.id, visited);
    for(const id of requiredBundle){
      if(!bundle.includes(id)) bundle.push(id);
    }
  }

  return bundle;
}

function tagsDirectlyConflict(tagA, tagB){
  const aBlocks = normalizeRuleList(tagA.incompatibleTags);
  const bBlocks = normalizeRuleList(tagB.incompatibleTags);
  const aName = tagA.name.trim().toLowerCase();
  const bName = tagB.name.trim().toLowerCase();
  return aBlocks.includes(bName) || bBlocks.includes(aName);
}

function bundlesConflict(bundleA, bundleB){
  for(const idA of bundleA){
    for(const idB of bundleB){
      const tagA = getOutfitTagById(idA);
      const tagB = getOutfitTagById(idB);
      if(!tagA || !tagB) continue;
      if(tagsDirectlyConflict(tagA, tagB)) return true;
    }
  }
  return false;
}

function resolveOutfitBundleConflicts(bundles){
  let result = bundles.map(bundle => [...bundle]);
  let changed = true;
  let safety = 0;

  while(changed && safety < 50){
    changed = false;
    safety++;

    outer:
    for(let i = 0; i < result.length; i++){
      for(let j = i + 1; j < result.length; j++){
        if(bundlesConflict(result[i], result[j])){
          // 50/50: remove either full bundle.
          const removeIndex = Math.random() < 0.5 ? i : j;
          result.splice(removeIndex, 1);
          changed = true;
          break outer;
        }
      }
    }
  }

  return result;
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
      <div class="item outfit-tag-head">
        <div>
          <b>${esc(tag.name)}</b>
          <div class="muted">Probability: ${esc(tag.probability)}%</div>
        </div>
        <div class="item-actions">
          <input type="number" min="0" max="100" value="${esc(tag.probability)}" onchange="updateOutfitTag('${tag.id}',this.value)">
          <button class="delete" onclick="deleteOutfitTag('${tag.id}')">Delete Tag</button>
        </div>
      </div>

      <div class="rule-box">
        <label class="rule-label">Required Tags
          <input value="${esc(tag.requiredTags || "")}" placeholder="Top, Shoes" onchange="updateOutfitTagRule('${tag.id}','requiredTags',this.value)">
        </label>
        <label class="rule-label">Incompatible Tags
          <input value="${esc(tag.incompatibleTags || "")}" placeholder="Dress, Skirt" onchange="updateOutfitTagRule('${tag.id}','incompatibleTags',this.value)">
        </label>
      </div>

      <div class="form-grid outfit-add">
        <input id="outfitItem-${tag.id}" placeholder="Item name">
        <button onclick="addOutfitItem('${tag.id}')">Add Item</button>
      </div>

      <div class="list">
        ${tag.items.map(item => `
          <div class="item">
            <b>${esc(item.name)}</b>
            <button class="delete" onclick="deleteOutfitItem('${tag.id}','${item.id}')">Delete</button>
          </div>
        `).join("") || `<div class="muted">No items in this tag.</div>`}
      </div>
    </div>
  `).join("") || `<div class="muted">No outfit tags yet.</div>`;
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
  tag.items.push({id:uid(), name, requires:"", incompatible:""});
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
  navigator.serviceWorker.register("./service-worker.js?v=14").then(reg => {
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


const devDressSkirtBtn = document.getElementById("devForceDressSkirtTest");
if(devDressSkirtBtn){
  devDressSkirtBtn.onclick = () => {
    alert("Outfit rule test: create tags Dress, Skirt, Top. Set Dress incompatible with Skirt. Set Skirt required tags to Top. Then use Force Reroll All or high probabilities to test Dress vs Skirt+Top.");
  };
}


/* =========================
   V11 Integrated Systems Fix
========================= */

const UPGRADE_DEFS = [
  {id:"taxCut", name:"Tax Cut", max:99, desc:"Cum Tax increase amount -0.01% per level."},
  {id:"chastityControl", name:"Chastity Control", max:99, desc:"Chastity NO increase amount -0.01% per level."},
  {id:"contentDouble", name:"Content Double Roll", max:100, desc:"1% chance per level to roll Content twice."},
  {id:"gameDouble", name:"Game Double Roll", max:100, desc:"1% chance per level to roll Game twice."},
  {id:"taskOverflow", name:"Task Overflow", max:100, desc:"3% chance per level for extra minimum tasks. Overflow ignores tags. Daily cap remains 5."},
  {id:"pointMultiplier", name:"Point Multiplier", max:100, desc:"+1.5% points earned per level."}
];

const RARITY_WEIGHTS = {Common:50, Uncommon:30, Rare:12, Epic:6, Legendary:2};

const PUNISHMENTS = [
  {id:"pointDrain", rarity:"Common", name:"Point Drain", desc:"Lose 10% current points.", apply:()=>{data.points -= Math.ceil(Math.abs(data.points) * 0.10);}},
  {id:"rewardLoss", rarity:"Common", name:"Reward Loss", desc:"Lose 2 reward progress.", apply:()=>{data.reward.progress = Math.max(0,(data.reward.progress||0)-2);}},
  {id:"pointTax", rarity:"Common", name:"Point Tax", desc:"-25% points earned for 30 days.", apply:()=>addTempPunishment("pointTax", "Point Tax", 30, {pointGainMult:0.75})},
  {id:"taskSurge", rarity:"Common", name:"Task Surge", desc:"+2 minimum tasks for 10 days.", apply:()=>addTempPunishment("taskSurge", "Task Surge", 10, {minTasksAdd:2})},

  {id:"rewardFreeze", rarity:"Uncommon", name:"Reward Freeze", desc:"Reward progress cannot increase for 10 days.", apply:()=>addTempPunishment("rewardFreeze", "Reward Freeze", 10, {rewardFrozen:true})},
  {id:"upgradeLock", rarity:"Uncommon", name:"Upgrade Lock", desc:"Cannot purchase upgrades for 10 days.", apply:()=>addTempPunishment("upgradeLock", "Upgrade Lock", 10, {upgradesLocked:true})},
  {id:"cumTaxX3", rarity:"Uncommon", name:"Cum Tax Increase x3", desc:"Cum Tax increase amount x3 for 10 days.", apply:()=>addTempPunishment("cumTaxX3", "Cum Tax Increase x3", 10, {cumTaxMult:3})},
  {id:"chastityX3", rarity:"Uncommon", name:"Chastity Increase x3", desc:"Chastity NO increase amount x3 for 10 days.", apply:()=>addTempPunishment("chastityX3", "Chastity Increase x3", 10, {chastityIncMult:3})},

  {id:"disableMods", rarity:"Rare", name:"Disable Modifiers", desc:"All upgrade effects disabled for 10 days.", apply:()=>addTempPunishment("disableMods", "Disable Modifiers", 10, {disableModifiers:true})},
  {id:"severePointTax", rarity:"Rare", name:"Severe Point Tax", desc:"-75% points earned for 10 days.", apply:()=>addTempPunishment("severePointTax", "Severe Point Tax", 10, {pointGainMult:0.25})},
  {id:"rewardInflation", rarity:"Rare", name:"Reward Inflation", desc:"Current reward target +5 days.", apply:()=>{if(data.reward?.target) data.reward.target += 5;}},
  {id:"dailyDebt", rarity:"Rare", name:"Daily Debt", desc:"+1 punishment bar every day for 10 days.", apply:()=>addTempPunishment("dailyDebt", "Daily Debt", 10, {dailyPunishmentAdd:1})},

  {id:"chastityBase", rarity:"Epic", name:"Chastity Base +10%", desc:"Permanent +10% chastity probability.", apply:()=>{data.chastityProbability += 10;}},
  {id:"costIncrease", rarity:"Epic", name:"Upgrade Costs +2%", desc:"Permanent upgrade costs +2%.", apply:()=>{data.punishmentCostMultiplier = (data.punishmentCostMultiplier||1) * 1.02;}},
  {id:"rouletteBase", rarity:"Epic", name:"Roulette Base +1%", desc:"Permanent roulette base +1%.", apply:()=>{data.roulette.base = Number(data.roulette.base||0)+1;}},
  {id:"modifierCorruption", rarity:"Epic", name:"Modifier Corruption", desc:"Random upgrade loses 5 levels.", apply:()=>corruptRandomUpgrade()},

  {id:"falseFreedom", rarity:"Legendary", name:"False Freedom", desc:"The End ? cost +100,000.", apply:()=>{data.theEndCostBonus = (data.theEndCostBonus||0)+100000;}},
  {id:"regression", rarity:"Legendary", name:"Regression", desc:"Lose 5% of lifetime points earned. Can go negative.", apply:()=>{data.points -= Math.ceil((data.lifetimePoints||0)*0.05);}},
  {id:"debtSpiral", rarity:"Legendary", name:"Debt Spiral", desc:"Punishment bar +25 immediately.", apply:()=>{data.punishmentBar = (data.punishmentBar||0)+25;}},
  {id:"eternalBurden", rarity:"Legendary", name:"Eternal Burden", desc:"All future punishment bar gains increased by 25%.", apply:()=>{data.punishmentBurdenMult = (data.punishmentBurdenMult||1)*1.25;}}
];

function ensureSystemsData(){
  data.points ??= 0;
  data.lifetimePoints ??= 0;
  data.upgrades ??= {};
  data.punishmentBar ??= 0;
  data.activePunishments ??= [];
  data.punishmentCostMultiplier ??= 1;
  data.punishmentBurdenMult ??= 1;
  data.theEndCostBonus ??= 0;
  data.theEndUnlocked ??= false;
  data.rsbdYears ??= {};
  data.forceRSBDToday ??= false;
  data.adjudicatedDates ??= {};
  for(const u of UPGRADE_DEFS) data.upgrades[u.id] ??= 0;
}

function localDateString(dateObj = new Date()){
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth()+1).padStart(2,"0");
  const d = String(dateObj.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}
function parseLocalDate(dateStr){
  const [y,m,d] = dateStr.split("-").map(Number);
  return new Date(y, m-1, d);
}
function formatDate(dateObj){
  return localDateString(dateObj);
}
function seededRandom(seed){
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}
function generateRSBDDatesForYear(year){
  const start = new Date(year,0,1);
  const daysInYear = Math.floor((new Date(year,11,31)-start)/86400000)+1;
  const segmentSize = daysInYear / 8;
  const dates = [];
  for(let i=0;i<8;i++){
    const segStart = Math.floor(i*segmentSize);
    const segEnd = Math.floor(((i+1)*segmentSize)-1);
    const seed = (year*1000)+(i*97)+37+Math.floor(Math.random()*1000000);
    const offset = segStart + Math.floor(seededRandom(seed)*(segEnd-segStart+1));
    dates.push(formatDate(new Date(year,0,1+offset)));
  }
  return [...new Set(dates)].sort();
}
function ensureRSBDYear(year = new Date().getFullYear()){
  data.rsbdYears ??= {};
  if(!data.rsbdYears[year] || data.rsbdYears[year].length !== 8){
    data.rsbdYears[year] = generateRSBDDatesForYear(Number(year));
  }
  return data.rsbdYears[year];
}
function isRSBD(dateStr = localDateString()){
  ensureRSBDYear(parseLocalDate(dateStr).getFullYear());
  if(data.forceRSBDToday && dateStr === localDateString()) return true;
  return (data.rsbdYears?.[parseLocalDate(dateStr).getFullYear()] || []).includes(dateStr);
}

function activeEffect(key){
  for(const p of data.activePunishments || []){
    if(p.effects && p.effects[key]) return p.effects[key];
  }
  return null;
}
function combinedEffectMult(key, fallback=1){
  let mult = fallback;
  for(const p of data.activePunishments || []){
    if(p.effects && typeof p.effects[key] === "number") mult *= p.effects[key];
  }
  return mult;
}
function modifiersDisabled(){ return !!activeEffect("disableModifiers"); }
function upgradeLevel(id){ return modifiersDisabled() ? 0 : Number(data.upgrades?.[id] || 0); }
function upgradeCost(id){
  const lvl = Number(data.upgrades?.[id] || 0);
  return Math.ceil((100 + (4 * lvl)) * (data.punishmentCostMultiplier || 1));
}
function isUpgradeCapReached(){
  return UPGRADE_DEFS.every(u => (data.upgrades?.[u.id] || 0) >= u.max);
}
function theEndCost(){ return 1000000 + (data.theEndCostBonus || 0); }
function addTempPunishment(id, name, days, effects){
  const existing = data.activePunishments.find(p=>p.id===id);
  if(existing) existing.days += days;
  else data.activePunishments.push({id,name,days,effects});
}
function addPunishmentBar(amount){
  data.punishmentBar = (data.punishmentBar || 0) + (amount * (data.punishmentBurdenMult || 1));
}
function availablePunishmentRolls(){ return Math.floor((data.punishmentBar || 0) / 10); }
function corruptRandomUpgrade(){
  const possible = UPGRADE_DEFS.filter(u => (data.upgrades?.[u.id] || 0) > 0);
  if(!possible.length) return;
  const picked = possible[Math.floor(Math.random()*possible.length)];
  data.upgrades[picked.id] = Math.max(0, (data.upgrades[picked.id]||0)-5);
}
function rollRarity(){
  const entries = Object.entries(RARITY_WEIGHTS);
  const total = entries.reduce((s,[,w])=>s+w,0);
  let r = Math.random()*total;
  for(const [rarity, weight] of entries){
    r -= weight;
    if(r <= 0) return rarity;
  }
  return "Common";
}
function rollOnePunishment(){
  const rarity = rollRarity();
  const pool = PUNISHMENTS.filter(p=>p.rarity===rarity);
  const picked = pool[Math.floor(Math.random()*pool.length)];
  picked.apply();
  return picked;
}
function rollAvailablePunishments(){
  const rolls = availablePunishmentRolls();
  if(!rolls) return alert("No punishment rolls available yet.");
  const results = [];
  for(let i=0;i<rolls;i++) results.push(rollOnePunishment());
  data.punishmentBar = (data.punishmentBar || 0) % 10;
  save(); render();
  alert("Punishments rolled:\n" + results.map(p=>`${p.rarity}: ${p.name}`).join("\n"));
}
function decrementDailyEffects(){
  for(const p of data.activePunishments || []) p.days -= 1;
  data.activePunishments = (data.activePunishments || []).filter(p=>p.days > 0);
}

function taxIncreaseAmount(){
  const base = Math.max(0.01, 1 - (upgradeLevel("taxCut") * 0.01));
  return base * combinedEffectMult("cumTaxMult", 1);
}
function chastityIncreaseAmount(){
  const base = Math.max(0.01, 1 - (upgradeLevel("chastityControl") * 0.01));
  return base * combinedEffectMult("chastityIncMult", 1);
}
function taskOverflowMinimum(){
  const lvl = upgradeLevel("taskOverflow");
  const raw = lvl * 3;
  let extra = Math.floor(raw / 100);
  if(Math.random()*100 < (raw % 100)) extra += 1;
  return 1 + extra + Number(activeEffect("minTasksAdd") || 0);
}
function capTasks(tasks){
  const out = [...tasks];
  while(out.length > 5) out.splice(Math.floor(Math.random()*out.length), 1);
  return out;
}
function fillMinimumTasks(tasks){
  const minTasks = Math.min(5, taskOverflowMinimum());
  const out = [...tasks];
  const all = data.taskTags.flatMap(tag => tag.tasks.map(task => ({
    tag:tag.name, name:task.name, probability:Number(task.probability)||0
  })));
  while(out.length < minTasks && all.length){
    const picked = all[Math.floor(Math.random()*all.length)];
    out.push({id:uid(), tag:picked.tag, name:picked.name, complete:false, overflow:true, pointsBase:100-picked.probability});
  }
  return capTasks(out);
}
function calculateTaskPoints(tasks){
  const base = tasks.reduce((s,t)=>s + Number(t.pointsBase ?? 75), 0);
  const pointUpgradeMult = 1 + (upgradeLevel("pointMultiplier") * 0.015);
  const punishmentMult = combinedEffectMult("pointGainMult", 1);
  return Math.round(base * pointUpgradeMult * punishmentMult);
}

function rollTasks(){
  const results = [];
  for(const tag of data.taskTags){
    const hits = tag.tasks.filter(task => chance(task.probability));
    if(hits.length){
      const picked = hits[Math.floor(Math.random()*hits.length)];
      results.push({id:uid(), tag:tag.name, name:picked.name, complete:false, pointsBase:100-(Number(picked.probability)||0)});
    }
  }
  if(!results.length){
    const all = data.taskTags.flatMap(tag => tag.tasks.map(task => ({tag:tag.name, name:task.name, probability:Number(task.probability)||0})));
    if(all.length){
      const picked = all[Math.floor(Math.random()*all.length)];
      results.push({id:uid(), tag:picked.tag, name:picked.name, complete:false, failsafe:true, pointsBase:100-picked.probability});
    }
  }
  return fillMinimumTasks(results);
}
function rsbdFillExactlySevenTasks(){
  const all = data.taskTags.flatMap(tag => tag.tasks.map(task => ({
    key:tag.id+":"+task.id, tag:tag.name, name:task.name, probability:Number(task.probability)||0
  })));
  const results = [];
  const used = new Set();
  while(results.length < 7 && all.length){
    let pool = all.filter(x=>!used.has(x.key));
    if(!pool.length) pool = all;
    const picked = pool[Math.floor(Math.random()*pool.length)];
    used.add(picked.key);
    results.push({id:uid(), tag:picked.tag, name:picked.name, complete:false, rsbd:true, pointsBase:100-picked.probability});
  }
  return results;
}
function rollOutfits(forceAll=false){
  const rolledTags = [];
  for(const tag of data.outfitTags){
    if(tag.items.length && (forceAll || chance(tag.probability))) rolledTags.push(tag.id);
  }
  let bundles = rolledTags.map(tagId => buildOutfitBundle(tagId)).filter(bundle=>bundle.length>0);
  bundles = resolveOutfitBundleConflicts(bundles);
  const finalTagIds = [];
  for(const bundle of bundles){
    for(const tagId of bundle) if(!finalTagIds.includes(tagId)) finalTagIds.push(tagId);
  }
  const results = [];
  for(const tagId of finalTagIds){
    const tag = getOutfitTagById(tagId);
    if(!tag || !tag.items.length) continue;
    const item = tag.items[Math.floor(Math.random()*tag.items.length)];
    results.push({tag:tag.name, name:item.name});
  }
  return results;
}
function rollRoulette(force=false){
  const effective = data.roulette.base + data.roulette.cumTax;
  if(force || chance(effective)){
    const picked = weightedRoll(data.roulette.entries);
    data.roulette.cumTax = 0;
    data.roulette.base = Math.round((data.roulette.base + 0.5) * 10) / 10;
    return {triggered:true, name:picked ? picked.name : "No roulette entry configured", url:picked ? picked.url : ""};
  }
  return {triggered:false};
}

function adjudicatePreviousRolledDayIfNeeded(){
  data.adjudicatedDates ??= {};
  const r = data.todayResults;
  if(!r || !r.date || data.adjudicatedDates[r.date] || r.date === localDateString()) return;
  const incomplete = (r.tasks || []).filter(t=>!t.complete).length;
  if(incomplete > 0) addPunishmentBar(r.rsbd ? incomplete : 1);
  data.adjudicatedDates[r.date] = true;
}
function processSkippedDays(){
  const t = localDateString();
  if(!data.lastSeenDate){
    data.lastSeenDate = t;
    return;
  }
  const last = parseLocalDate(data.lastSeenDate);
  const now = parseLocalDate(t);
  const diff = Math.floor((now-last)/86400000);
  if(diff <= 0) return;
  for(let i=1;i<=diff;i++){
    const d = new Date(last);
    d.setDate(d.getDate()+i);
    const ds = formatDate(d);
    decrementDailyEffects();
    if(activeEffect("dailyPunishmentAdd")) addPunishmentBar(activeEffect("dailyPunishmentAdd"));
    addPunishmentBar(isRSBD(ds) ? 10 : 3);
  }
  data.lastSeenDate = t;
}

function rollAllSystems(){
  if(data.theEndUnlocked) return;
  const t = localDateString();
  if(data.lastRollDate === t) return alert("Today's Roll All has already been used.");

  adjudicatePreviousRolledDayIfNeeded();

  const rsbd = isRSBD(t);
  const results = {date:t, rsbd};

  const chastityYes = rsbd ? true : chance(data.chastityProbability);
  results.chastity = {result: chastityYes ? "YES" : "NO", cage: null};
  if(chastityYes){
    const cage = weightedRoll(data.cages);
    results.chastity.cage = cage ? cage.name : "No cage configured";
  } else {
    data.chastityProbability += chastityIncreaseAmount();
  }

  const contentRolls = chance(upgradeLevel("contentDouble")) ? 2 : 1;
  const gameRolls = chance(upgradeLevel("gameDouble")) ? 2 : 1;
  const contentResults = [];
  const gameResults = [];
  for(let i=0;i<contentRolls;i++){
    const c = weightedRoll(data.content);
    contentResults.push(c ? c.name : "No content configured");
  }
  for(let i=0;i<gameRolls;i++){
    const g = weightedRoll(data.games);
    gameResults.push(g ? g.name : "No game configured");
  }
  results.content = contentResults.join(" + ");
  results.game = gameResults.join(" + ");
  results.tasks = rsbd ? rsbdFillExactlySevenTasks() : rollTasks();
  results.outfits = rollOutfits(rsbd);
  results.roulette = rollRoulette(rsbd);

  data.lastRollDate = t;
  data.lastSeenDate = t;
  data.rewardGrantedDate = null;
  data.todayResults = results;
  save();
  render();

  if(rsbd) alert("✨ Random Sissy Bimbo Day ✨\nSpecial rules are active today.");
  if(results.roulette.triggered && results.roulette.url) window.open(results.roulette.url, "_blank");
}

function buyUpgrade(id){
  if(activeEffect("upgradesLocked")) return alert("Upgrades are locked by punishment.");
  const def = UPGRADE_DEFS.find(u=>u.id===id);
  if(!def) return;
  const lvl = data.upgrades[id] || 0;
  if(lvl >= def.max) return;
  const cost = upgradeCost(id);
  if(data.points < cost) return alert("Not enough points.");
  data.points -= cost;
  data.upgrades[id] = lvl + 1;
  save(); render();
}
window.buyUpgrade = buyUpgrade;

function buyTheEnd(){
  if(!isUpgradeCapReached()) return;
  const cost = theEndCost();
  if(data.points < cost) return alert("Not enough points.");
  data.points -= cost;
  data.theEndUnlocked = true;
  save(); render();
}
window.buyTheEnd = buyTheEnd;

window.toggleTodayTask = (taskId,checked) => {
  const tasks = data.todayResults?.tasks || [];
  const task = tasks.find(x=>x.id===taskId);
  if(task) task.complete = checked;
  const allDone = tasks.length && tasks.every(x=>x.complete);
  if(allDone && data.rewardGrantedDate !== localDateString()){
    if(data.todayResults?.rsbd){
      data.rewardGrantedDate = localDateString();
      alert("RSBD tasks complete. No points and no reward progress are gained today.");
    } else {
      const earned = calculateTaskPoints(tasks);
      data.points += earned;
      data.lifetimePoints += Math.max(0, earned);
      if(data.reward.locked && !activeEffect("rewardFrozen")){
        data.reward.progress = Math.min(data.reward.target, data.reward.progress + 1);
      }
      data.rewardGrantedDate = localDateString();
      alert(`All tasks complete. You earned ${earned} points.` + (activeEffect("rewardFrozen") ? "\nReward progress is frozen by punishment." : ""));
    }
  }
  save(); render();
};

function renderSystems(){
  ensureSystemsData();

  const pointsEl = document.getElementById("pointsText");
  const lifeEl = document.getElementById("lifetimePointsText");
  const upPoints = document.getElementById("upgradePointsText");
  if(pointsEl) pointsEl.textContent = Math.round(data.points).toLocaleString();
  if(lifeEl) lifeEl.textContent = Math.round(data.lifetimePoints).toLocaleString();
  if(upPoints) upPoints.textContent = Math.round(data.points).toLocaleString();

  const pbar = document.getElementById("punishmentBar");
  const ptext = document.getElementById("punishmentText");
  const ppanel = document.getElementById("punishmentPanelText");
  if(pbar){ pbar.max = 10; pbar.value = (data.punishmentBar || 0) % 10; }
  const rolls = availablePunishmentRolls();
  const pString = `${(data.punishmentBar||0).toFixed(1)} / 10 ${rolls ? `(${rolls} roll${rolls===1?"":"s"} available)` : ""}`;
  if(ptext) ptext.textContent = pString;
  if(ppanel) ppanel.textContent = pString;

  const upgradeList = document.getElementById("upgradeList");
  if(upgradeList){
    let html = UPGRADE_DEFS.map(u=>{
      const lvl = data.upgrades?.[u.id] || 0;
      const capped = lvl >= u.max;
      const cost = upgradeCost(u.id);
      return `<div class="upgrade-card">
        <div>
          <b>${esc(u.name)}</b>
          <div class="muted">Level ${lvl} / ${u.max}</div>
          <div class="muted">${esc(u.desc)}</div>
        </div>
        <button onclick="buyUpgrade('${u.id}')" ${capped || activeEffect("upgradesLocked") ? "disabled" : ""}>${capped ? "Maxed" : "Buy " + cost.toLocaleString()}</button>
      </div>`;
    }).join("");
    if(isUpgradeCapReached()){
      const cost = theEndCost();
      html += `<div class="upgrade-card legendary-end">
        <div><b>The End ?</b><div class="muted">Cost: ${cost.toLocaleString()} points</div></div>
        <button onclick="buyTheEnd()" ${data.theEndUnlocked ? "disabled" : ""}>${data.theEndUnlocked ? "Unlocked" : "Unlock"}</button>
      </div>`;
    }
    upgradeList.innerHTML = html;
  }

  const activeEl = document.getElementById("activePunishmentsList");
  if(activeEl){
    activeEl.innerHTML = (data.activePunishments||[]).length ? data.activePunishments.map(p=>`
      <div class="item"><div><b>${esc(p.name)}</b><div class="muted">${p.days} day${p.days===1?"":"s"} remaining</div></div></div>
    `).join("") : `<div class="muted">No active punishments.</div>`;
  }

  const wheel = document.getElementById("punishmentWheelList");
  if(wheel){
    wheel.innerHTML = ["Common","Uncommon","Rare","Epic","Legendary"].map(rarity=>`
      <div class="punish-rarity">
        <h3>${rarity} <span class="muted">${RARITY_WEIGHTS[rarity]}%</span></h3>
        ${PUNISHMENTS.filter(p=>p.rarity===rarity).map(p=>`
          <div class="item"><div><b>${esc(p.name)}</b><div class="muted">${esc(p.desc)}</div></div></div>
        `).join("")}
      </div>
    `).join("");
  }

  const banner = document.getElementById("rsbdBanner");
  if(banner) banner.classList.toggle("hidden", !isRSBD(localDateString()));

  const rollButton = document.getElementById("rollAllBtn");
  if(rollButton && data.theEndUnlocked){
    rollButton.disabled = true;
    rollButton.textContent = "This is the end, you are free, no more rolls for you";
  }
}

const originalRender = render;
render = function(){
  originalRender();
  renderSystems();
};

function bindSystemsButtons(){
  const rb = document.getElementById("rollAllBtn");
  if(rb) rb.onclick = rollAllSystems;
  const ct = document.getElementById("cumTaxBtn");
  if(ct) ct.onclick = () => {data.roulette.cumTax += taxIncreaseAmount(); save(); render();};
  const rp = document.getElementById("rollPunishmentsBtn");
  if(rp) rp.onclick = rollAvailablePunishments;

  const da = document.getElementById("devAddPoints");
  if(da) da.onclick = () => {data.points += 1000; data.lifetimePoints += 1000; save(); render();};
  const dpb = document.getElementById("devPunishBar");
  if(dpb) dpb.onclick = () => {data.punishmentBar += 10; save(); render();};
  const devForceRSBD = document.getElementById("devForceRSBD");
  if(devForceRSBD) devForceRSBD.onclick = () => {
    data.forceRSBDToday = !data.forceRSBDToday;
    save(); render();
    alert("Force RSBD Today: " + (data.forceRSBDToday ? "ON" : "OFF"));
  };
  const devShowRSBD = document.getElementById("devShowRSBD");
  if(devShowRSBD) devShowRSBD.onclick = () => {
    const year = new Date().getFullYear();
    const dates = ensureRSBDYear(year);
    alert(`RSBD dates for ${year}:\n` + dates.join("\n"));
  };
}

ensureSystemsData();
ensureRSBDYear(new Date().getFullYear());
adjudicatePreviousRolledDayIfNeeded();
processSkippedDays();
bindSystemsButtons();
save();
render();


/* V13 compatibility: missing base renderResults */
function renderResults(){
  const resultsEl = document.getElementById("results");
  if(!resultsEl) return;

  if(!data.todayResults){
    resultsEl.classList.add("hidden");
    resultsEl.innerHTML = "";
    return;
  }

  const r = data.todayResults;
  resultsEl.classList.remove("hidden");

  const taskLines = (r.tasks || []).map(t => `${esc(t.tag)} — ${esc(t.name)}${t.complete ? " ✓" : ""}`).join("<br>") || "No tasks";
  const outfitLines = (r.outfits || []).map(o => `${esc(o.tag)} — ${esc(o.name)}`).join("<br>") || "No outfit items";

  resultsEl.innerHTML = `
    <h2>Today's Results</h2>
    ${r.rsbd ? `<div class="rsbd-result-note">✨ Random Sissy Bimbo Day: 100% Chastity, 100% Roulette, all outfits forced, exactly 7 tasks, no points/reward.</div>` : ""}
    <div class="result-grid">
      <div class="result-box"><h4>Chastity</h4><p>${esc(r.chastity?.result || "")}${r.chastity?.cage ? " — " + esc(r.chastity.cage) : ""}</p></div>
      <div class="result-box"><h4>Content</h4><p>${esc(r.content || "No content configured")}</p></div>
      <div class="result-box"><h4>Game</h4><p>${esc(r.game || "No game configured")}</p></div>
      <div class="result-box"><h4>Tasks</h4><p>${taskLines}</p></div>
      <div class="result-box"><h4>Outfits</h4><p>${outfitLines}</p></div>
      <div class="result-box"><h4>Roulette</h4><p>${r.roulette?.triggered ? "Triggered — " + esc(r.roulette.name) : "No trigger"}</p></div>
    </div>
  `;
}


/* V14 Dev Tools patch */
function bindV14DevTools(){
  const minus = document.getElementById("devPunishMinus");
  if(minus){
    minus.onclick = () => {
      data.punishmentBar = Math.max(0, Number(data.punishmentBar || 0) - 1);
      save();
      render();
    };
  }

  const clear = document.getElementById("devClearPunishments");
  if(clear){
    clear.onclick = () => {
      if(confirm("Clear all active temporary punishments?")){
        data.activePunishments = [];
        save();
        render();
      }
    };
  }
}
bindV14DevTools();
