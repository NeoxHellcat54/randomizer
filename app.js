
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
{ const el = document.getElementById("addGame"); if(el) el.onclick = () => addWeighted("games","gameName","gameWeight"); }
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

  /* V19.3: roulette URL is opened during the Roulette reveal stage, not immediately. */
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
          <input value="${esc(tag.incompatibleTags || "")}" placeholder="Dress, Skirt, all" onchange="updateOutfitTagRule('${tag.id}','incompatibleTags',this.value)">
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

/* V18.2 fix: restore tag-level outfit rule editor */
window.updateOutfitTagRule = (tagId, field, value) => {
  const tag = data.outfitTags.find(x => x.id === tagId);
  if(tag && (field === "requiredTags" || field === "incompatibleTags")){
    tag[field] = value;
  }
  save();
  render();
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
  navigator.serviceWorker.register("./service-worker.js?v=21").then(reg => {
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
  if(incomplete > 0) data.pointPenaltyDebt = Number(data.pointPenaltyDebt || 0) + incomplete * 2;
  data.adjudicatedDates[r.date] = true;
}
function processSkippedDays(){
  const t = localDateString();
  if(!data.lastSeenDate){ data.lastSeenDate = t; return; }
  const daysAbsent = Math.floor((parseLocalDate(t)-parseLocalDate(data.lastSeenDate))/86400000);
  if(daysAbsent >= 3){ addPunishmentBar(2 + Math.floor((daysAbsent-3)/2)); }
  for(let i=0;i<Math.max(0,daysAbsent);i++){
    decrementDailyEffects();
    if(activeEffect("dailyPunishmentAdd")) addPunishmentBar(activeEffect("dailyPunishmentAdd"));
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

  /* V19.2: RSBD uses fullscreen intro, no browser alert. */
  /* V19.4: delayed roulette open handled by animation stage */
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


/* V15 reward path + streaks */
var REWARD_PRESETS=[
{id:"chastityDecrease",name:"Chastity Decrease",target:15,text:"Chastity probability -20% permanently."},
{id:"taxRelief",name:"Tax Relief",target:15,text:"Cum Tax disabled for the next 5 completed days."},
{id:"chastityAmnesty",name:"Chastity Amnesty",target:20,text:"Chastity treated as 0% for the next 7 completed days."},
{id:"upgradeVoucher",name:"Upgrade Voucher",target:25,text:"Gain points equal to the cheapest available upgrade. The End ? is excluded."},
{id:"rewardMultiplier",name:"Reward Multiplier",target:20,text:"Double points for the next 10 completed tasks."},
{id:"rouletteProtection",name:"Roulette Protection",target:15,text:"Roulette cannot trigger for the next 5 completed days."},
{id:"luckyWeek",name:"Lucky Week",target:20,text:"Content Double Roll guaranteed for the next 7 completed days."},
{id:"shopping",name:"Shopping",target:25,text:"You get to buy a new item of clothing."},
{id:"highHeelsLover",name:"High Heels Lover",target:40,text:"You get to buy a new pair of heels.",special:true}
];
var STREAK_MILESTONES=[{days:7,points:100},{days:30,points:500},{days:100,points:2000},{days:200,points:5000},{days:365,points:10000},{days:730,points:25000}];

function ensureV15Data(){
 if(!Array.isArray(REWARD_PRESETS) || REWARD_PRESETS.length===0){
  data.rewardPath??={current:null,progress:0,recent:[],sinceHeels:[],claimedHistory:[]};
  return;
 }
 data.rewardPath??={current:null,progress:0,recent:[],sinceHeels:[],claimedHistory:[]};
 data.rewardEffects??=[];
 data.currentStreak??=0;
 data.longestStreak??=0;
 data.streakClaims??={};
 if(!data.rewardPath.current) rollNextRewardPath();
 syncRewardObjectToPath();
}
function rewardDef(id){return (REWARD_PRESETS||[]).find(r=>r.id===id)}
function currentRewardDef(){return rewardDef(data.rewardPath?.current)}
function nonSpecialRewardIds(){return (REWARD_PRESETS||[]).filter(r=>!r.special).map(r=>r.id)}
function highHeelsEligible(){return nonSpecialRewardIds().every(id=>(data.rewardPath.sinceHeels||[]).includes(id))}
function syncRewardObjectToPath(){
 const cur=currentRewardDef();
 data.reward??={};
 if(cur){data.reward.name=cur.name;data.reward.target=cur.target;data.reward.progress=data.rewardPath.progress||0;data.reward.locked=true;data.reward.preset=cur.id}
}
function rollNextRewardPath(){
 data.rewardPath??={current:null,progress:0,recent:[],sinceHeels:[],claimedHistory:[]};
 let pool=(REWARD_PRESETS||[]).filter(r=>!(data.rewardPath.recent||[]).includes(r.id));
 pool=pool.filter(r=>r.id!=="highHeelsLover"||highHeelsEligible());
 if(!pool.length) pool=(REWARD_PRESETS||[]).filter(r=>r.id!=="highHeelsLover");
 if(!pool.length) return;
 const picked=pool[Math.floor(Math.random()*pool.length)];
 if(!picked) return;
 data.rewardPath.current=picked.id; data.rewardPath.progress=0;
 if(picked.id==="highHeelsLover"){data.rewardPath.sinceHeels=[]}
 else if(!(data.rewardPath.sinceHeels||[]).includes(picked.id)){data.rewardPath.sinceHeels.push(picked.id)}
 syncRewardObjectToPath();
}
function addRewardEffect(id,name,effect){
 const existing=(data.rewardEffects||[]).find(e=>e.id===id);
 if(existing){if(effect.completedDays) existing.completedDays=(existing.completedDays||0)+effect.completedDays; if(effect.tasks) existing.tasks=(existing.tasks||0)+effect.tasks}
 else data.rewardEffects.push({id,name,...effect});
}
function rewardEffect(key){return (data.rewardEffects||[]).find(e=>e[key])?.[key]||null}
function cheapestUpgradeCostOnly(){
 if(typeof UPGRADE_DEFS==="undefined") return 0;
 const costs=UPGRADE_DEFS.filter(u=>(data.upgrades?.[u.id]||0)<u.max).map(u=>upgradeCost(u.id));
 return costs.length?Math.min(...costs):0;
}
function applyRewardPreset(id){
 if(id==="chastityDecrease") data.chastityProbability=Math.max(0,Number(data.chastityProbability||0)-20);
 if(id==="taxRelief") addRewardEffect("taxRelief","Tax Relief",{completedDays:5,disableCumTax:true});
 if(id==="chastityAmnesty") addRewardEffect("chastityAmnesty","Chastity Amnesty",{completedDays:7,chastityZero:true});
 if(id==="upgradeVoucher"){const c=cheapestUpgradeCostOnly(); data.points+=c; data.lifetimePoints+=Math.max(0,c)}
 if(id==="rewardMultiplier") addRewardEffect("rewardMultiplier","Reward Multiplier",{tasks:10,pointMult:2});
 if(id==="rouletteProtection") addRewardEffect("rouletteProtection","Roulette Protection",{completedDays:5,rouletteBlocked:true});
 if(id==="luckyWeek") addRewardEffect("luckyWeek","Lucky Week",{completedDays:7,contentDoubleGuaranteed:true});
 if(id==="shopping") alert("Shopping reward claimed: You get to buy a new item of clothing.");
 if(id==="highHeelsLover") alert("High Heels Lover claimed: You get to buy a new pair of heels.");
}
function claimCurrentRewardPath(){
 ensureV15Data();
 const cur=currentRewardDef(); if(!cur) return alert("No reward active yet.");
 if((data.rewardPath.progress||0)<cur.target) return alert("Reward is not ready yet.");
 applyRewardPreset(cur.id);
 data.rewardPath.claimedHistory.push(cur.id);
 data.rewardPath.recent.unshift(cur.id); data.rewardPath.recent=data.rewardPath.recent.slice(0,2);
 rollNextRewardPath(); save(); render();
}
window.claimCurrentRewardPath=claimCurrentRewardPath;
function advanceRewardPathProgress(){ensureV15Data(); const cur=currentRewardDef(); if(cur){data.rewardPath.progress=Math.min(cur.target,(data.rewardPath.progress||0)+1); syncRewardObjectToPath()}}
function consumeCompletedDayRewardEffects(){for(const e of data.rewardEffects||[]) if(e.completedDays) e.completedDays-=1; data.rewardEffects=(data.rewardEffects||[]).filter(e=>(!e.completedDays||e.completedDays>0)||(e.tasks&&e.tasks>0))}
function consumeTaskRewardMultiplier(taskCount){const e=(data.rewardEffects||[]).find(x=>x.id==="rewardMultiplier"&&x.tasks>0); if(!e) return 1; const boosted=Math.min(taskCount,e.tasks); e.tasks-=boosted; if(e.tasks<=0)data.rewardEffects=data.rewardEffects.filter(x=>x!==e); return 1+(boosted/Math.max(1,taskCount))}
function increaseStreakAndAward(){
 data.currentStreak=(data.currentStreak||0)+1; data.longestStreak=Math.max(data.longestStreak||0,data.currentStreak);
 for(const m of STREAK_MILESTONES){if(data.currentStreak===m.days){const prev=data.streakClaims[m.days]||0; const award=prev?Math.floor(m.points/2):m.points; data.points+=award; data.lifetimePoints+=award; data.streakClaims[m.days]=prev+1; setTimeout(()=>alert(`${m.days}-day streak reward: +${award} points`),60)}}
}
function breakStreak(){if((data.currentStreak||0)>0)data.lastBrokenStreak=data.currentStreak; data.currentStreak=0}

function renderReward(){
 if(!Array.isArray(REWARD_PRESETS) || REWARD_PRESETS.length===0) return;
 ensureV15Data(); const cur=currentRewardDef();
 const title=document.getElementById("rewardTitle"), bar=document.getElementById("rewardBar"), progress=document.getElementById("rewardProgress"), badge=document.getElementById("rewardLockBadge"), info=document.getElementById("rewardPathInfo"), details=document.getElementById("rewardDetails");
 if(details) details.classList.add("hidden");
 if(title) title.textContent=cur?cur.name:"No reward active";
 if(bar){bar.max=cur?cur.target:1; bar.value=data.rewardPath.progress||0}
 if(progress) progress.textContent=cur?`${data.rewardPath.progress||0} / ${cur.target} days`:"0 / 0 days";
 if(badge) badge.textContent="Reward Path";
 if(info&&cur){const ready=(data.rewardPath.progress||0)>=cur.target; const effects=(data.rewardEffects||[]).map(e=>e.completedDays?`${esc(e.name)}: ${e.completedDays} completed day${e.completedDays===1?"":"s"} left`:e.tasks?`${esc(e.name)}: ${e.tasks} task${e.tasks===1?"":"s"} left`:esc(e.name)).join("<br>"); info.innerHTML=`<div class="muted">${esc(cur.text)}</div>${ready?`<button onclick="claimCurrentRewardPath()" class="claim reward-claim">Claim Reward</button>`:""}${effects?`<div class="reward-effects"><b>Active Reward Effects</b><br>${effects}</div>`:""}`}
}
function rollRouletteV15(force=false){
 if(rewardEffect("rouletteBlocked")&&!force) return {triggered:false,blocked:true};
 return rollRoulette(force);
}
function rollAllV15(){
 if(data.theEndUnlocked) return; const t=typeof localDateString==="function"?localDateString():today();
 if(data.lastRollDate===t) return alert("Today's Roll All has already been used.");
 if(typeof adjudicatePreviousRolledDayIfNeeded==="function") adjudicatePreviousRolledDayIfNeeded();
 const rsbd=typeof isRSBD==="function"?isRSBD(t):false; const results={date:t,rsbd};
 const chastityChance=rewardEffect("chastityZero")?0:data.chastityProbability; const chastityYes=rsbd?true:chance(chastityChance);
 results.chastity={result:chastityYes?"YES":"NO",cage:null};
 if(chastityYes){const cage=weightedRoll(data.cages); results.chastity.cage=cage?cage.name:"No cage configured"} else data.chastityProbability+=typeof chastityIncreaseAmount==="function"?chastityIncreaseAmount():1;
 const contentRolls=(rewardEffect("contentDoubleGuaranteed")||chance(typeof upgradeLevel==="function"?upgradeLevel("contentDouble"):0))?2:1;
 const cr=[]; for(let i=0;i<contentRolls;i++){const c=weightedRoll(data.content); cr.push(c?c.name:"No content configured")}
 results.content=cr.join(" + "); results.game="";
 results.tasks=rsbd&&typeof rsbdFillExactlySevenTasks==="function"?rsbdFillExactlySevenTasks():rollTasks();
 results.outfits=typeof rollOutfits==="function"?rollOutfits(rsbd):[];
 results.roulette=rollRouletteV15(rsbd);
 data.lastRollDate=t; data.lastSeenDate=t; data.rewardGrantedDate=null; data.todayResults=results; save(); render();
 /* V19.2: RSBD uses fullscreen intro, no browser alert. */
 /* V19.4: delayed roulette open handled by animation stage */
}
window.toggleTodayTask=(taskId,checked)=>{
 const tasks=data.todayResults?.tasks||[]; const task=tasks.find(x=>x.id===taskId); if(task) task.complete=checked;
 const allDone=tasks.length&&tasks.every(x=>x.complete); const t=typeof localDateString==="function"?localDateString():today();
 if(allDone&&data.rewardGrantedDate!==t){
  if(data.todayResults?.rsbd){data.rewardGrantedDate=t; increaseStreakAndAward(); consumeCompletedDayRewardEffects(); alert("RSBD tasks complete. No points and no reward progress are gained today.")}
  else {let earned=calculateTaskPoints(tasks); earned=Math.round(earned*consumeTaskRewardMultiplier(tasks.length)); data.points+=earned; data.lifetimePoints+=Math.max(0,earned); if(!activeEffect("rewardFrozen")) advanceRewardPathProgress(); increaseStreakAndAward(); consumeCompletedDayRewardEffects(); data.rewardGrantedDate=t; alert(`All tasks complete. You earned ${earned} points.`)}
 }
 save(); render();
};
if(typeof renderResults==="function"){const oldRR=renderResults; renderResults=function(){oldRR(); const el=document.getElementById("results"); if(!el)return; el.querySelectorAll(".result-box").forEach(b=>{const h=b.querySelector("h4"); if(h&&h.textContent.trim().toLowerCase()==="game") b.remove()})}}
if(typeof adjudicatePreviousRolledDayIfNeeded==="function"){const oldAdj=adjudicatePreviousRolledDayIfNeeded; adjudicatePreviousRolledDayIfNeeded=function(){const r=data.todayResults; oldAdj(); if(r&&r.date&&r.date!==(typeof localDateString==="function"?localDateString():today())&&(r.tasks||[]).some(t=>!t.complete)) breakStreak()}}
if(typeof processSkippedDays==="function"){const oldPS=processSkippedDays; processSkippedDays=function(){const before=data.lastSeenDate; oldPS(); const t=typeof localDateString==="function"?localDateString():today(); if(before&&before!==t) breakStreak()}}
function renderV15(){ensureV15Data(); const cs=document.getElementById("currentStreakText"), ls=document.getElementById("longestStreakText"), sm=document.getElementById("streakMilestoneText"); if(cs)cs.textContent=data.currentStreak||0; if(ls)ls.textContent=data.longestStreak||0; if(sm){const next=STREAK_MILESTONES.find(m=>m.days>(data.currentStreak||0)); sm.textContent=next?`Next milestone: ${next.days} days`:"All streak milestones reached."} syncRewardObjectToPath()}
const oldRenderForV15=render; render=function(){oldRenderForV15(); renderV15()};
function bindV15(){const rb=document.getElementById("rollAllBtn"); if(rb)rb.onclick=rollAllV15; const tax=document.getElementById("cumTaxBtn"); if(tax)tax.onclick=()=>{if(rewardEffect("disableCumTax"))return alert("Tax Relief is active. Cum Tax did not increase."); data.roulette.cumTax+=typeof taxIncreaseAmount==="function"?taxIncreaseAmount():1; save(); render()}; const dr=document.getElementById("devRewardReroll"); if(dr)dr.onclick=()=>{const cur=data.rewardPath?.current; if(cur){data.rewardPath.recent.unshift(cur); data.rewardPath.recent=data.rewardPath.recent.slice(0,2)} rollNextRewardPath(); save(); render()}; const sp=document.getElementById("devStreakPlus"); if(sp)sp.onclick=()=>{increaseStreakAndAward(); save(); render()}; const sr=document.getElementById("devStreakReset"); if(sr)sr.onclick=()=>{data.currentStreak=0; save(); render()}}
ensureV15Data(); bindV15(); save(); render();


/* =========================
   V16 UI flow + animations
========================= */

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

  const tasks = r.tasks || [];
  const taskHtml = tasks.length ? tasks.map(t => `
    <label class="home-task-check ${t.complete ? "done" : ""}">
      <input type="checkbox" ${t.complete ? "checked" : ""} onchange="toggleTodayTask('${t.id}', this.checked)">
      <span>
        <b>${esc(t.name)}</b>
        <small>${esc(t.tag)}${t.failsafe ? " · failsafe" : ""}${t.overflow ? " · overflow" : ""}${t.rsbd ? " · RSBD" : ""}</small>
      </span>
    </label>
  `).join("") : `<div class="muted">No tasks rolled.</div>`;

  const outfitCount = (r.outfits || []).length;
  const rouletteText = r.roulette?.triggered ? `Triggered — ${esc(r.roulette.name)}` : (r.roulette?.blocked ? "Blocked by protection" : "No trigger");

  resultsEl.innerHTML = `
    <div class="today-card-main">
      <div class="today-card-head">
        <div>
          <span class="tiny">${r.rsbd ? "Special Event" : "Today"}</span>
          <h2>${r.rsbd ? "Random Sissy Bimbo Day" : "Today's Tasks"}</h2>
        </div>
        <span class="pill">${tasks.filter(t=>t.complete).length}/${tasks.length} done</span>
      </div>

      <div class="home-task-list">${taskHtml}</div>
    </div>

    <details class="daily-summary-card">
      <summary>Roll Summary</summary>
      <div class="summary-grid">
        <div class="summary-item"><b>Chastity</b><span>${esc(r.chastity?.result || "")}${r.chastity?.cage ? " — " + esc(r.chastity.cage) : ""}</span></div>
        <div class="summary-item"><b>Content</b><span>${esc(r.content || "No content configured")}</span></div>
        <div class="summary-item"><b>Outfit</b><span>${outfitCount} item${outfitCount === 1 ? "" : "s"}</span></div>
        <div class="summary-item"><b>Roulette</b><span>${rouletteText}</span></div>
      </div>
      ${(r.outfits || []).length ? `<div class="outfit-mini-list">${r.outfits.map(o=>`<span>${esc(o.tag)}: ${esc(o.name)}</span>`).join("")}</div>` : ""}
    </details>
  `;
}

function getRollAnimationStages(r){
  if(!r) return [];
  const tasks = r.tasks || [];
  const outfits = r.outfits || [];
  return [
    {
      icon:"♡",
      label:"Chastity",
      value:`${r.chastity?.result || ""}${r.chastity?.cage ? " — " + r.chastity.cage : ""}`
    },
    {
      icon:"✦",
      label:"Content",
      value:r.content || "No content configured"
    },
    {
      icon:"✓",
      label:"Tasks",
      value:`${tasks.length} task${tasks.length === 1 ? "" : "s"} for today`
    },
    {
      icon:"👗",
      label:"Outfit",
      value:outfits.length ? `${outfits.length} outfit item${outfits.length === 1 ? "" : "s"} selected` : "No outfit items today"
    },
    {
      icon:"🎰",
      label:"Roulette",
      value:r.roulette?.triggered ? `Triggered — ${r.roulette.name}` : (r.roulette?.blocked ? "Blocked by protection" : "No trigger")
    }
  ];
}

function playRollAnimation(){
  const overlay = document.getElementById("rollOverlay");
  const icon = document.getElementById("rollStageIcon");
  const label = document.getElementById("rollStageLabel");
  const value = document.getElementById("rollStageValue");
  if(!overlay || !icon || !label || !value || !data.todayResults) return;

  const stages = getRollAnimationStages(data.todayResults);
  overlay.classList.remove("hidden");
  overlay.classList.add("active");

  let i = 0;
  const showStage = () => {
    const s = stages[i];
    if(!s){
      overlay.classList.remove("active");
      overlay.classList.add("roll-fade-out");
      setTimeout(()=>{
        overlay.classList.add("hidden");
        overlay.classList.remove("roll-fade-out");
      }, 450);
      return;
    }

    icon.textContent = s.icon;
    label.textContent = s.label;
    value.textContent = s.value;

    const card = overlay.querySelector(".roll-stage-card");
    if(card){
      card.classList.remove("stage-pop");
      void card.offsetWidth;
      card.classList.add("stage-pop");
    }

    i++;
    setTimeout(showStage, 1450);
  };

  showStage();
}

function renderV16Dashboard(){
  const rollBox = document.querySelector(".roll-box");
  const rollButton = document.getElementById("rollAllBtn");
  const status = document.getElementById("rollStatus");
  const t = typeof localDateString === "function" ? localDateString() : today();

  if(rollBox && rollButton){
    const rolledToday = data.lastRollDate === t;
    rollBox.classList.toggle("rolled-state", rolledToday);

    if(rolledToday && !data.theEndUnlocked){
      rollButton.classList.add("hidden");
      if(status) status.innerHTML = `<span class="daily-complete">✓ Today's rolls completed</span><br><span>Come back tomorrow</span>`;
    } else {
      rollButton.classList.remove("hidden");
    }
  }

  const resultsEl = document.getElementById("results");
  if(resultsEl && data.todayResults){
    resultsEl.classList.add("home-results-priority");
  }
}

// Wrap existing V15 Roll All so animation plays after generation.
function bindV16RollAnimation(){
  const btn = document.getElementById("rollAllBtn");
  if(!btn) return;

  const previousHandler = btn.onclick;
  btn.onclick = () => {
    const before = data.lastRollDate;
    if(typeof previousHandler === "function"){
      previousHandler();
    }
    const after = data.lastRollDate;
    if(after && after !== before && data.todayResults){
      setTimeout(playRollAnimation, 120);
    }
  };
}

// Wrap render so the compact home state updates last.
const oldRenderV16 = render;
render = function(){
  oldRenderV16();
  renderV16Dashboard();
};

bindV16RollAnimation();
render();


/* V16.1 animation item lists + outfit summary list */

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

  const tasks = r.tasks || [];
  const outfits = r.outfits || [];

  const taskHtml = tasks.length ? tasks.map(t => `
    <label class="home-task-check ${t.complete ? "done" : ""}">
      <input type="checkbox" ${t.complete ? "checked" : ""} onchange="toggleTodayTask('${t.id}', this.checked)">
      <span>
        <b>${esc(t.name)}</b>
        <small>${esc(t.tag)}${t.failsafe ? " · failsafe" : ""}${t.overflow ? " · overflow" : ""}${t.rsbd ? " · RSBD" : ""}</small>
      </span>
    </label>
  `).join("") : `<div class="muted">No tasks rolled.</div>`;

  const outfitSummary = outfits.length
    ? outfits.map(o => `${esc(o.tag)} — ${esc(o.name)}`).join("<br>")
    : "No outfit items";

  const rouletteText = r.roulette?.triggered ? `Triggered — ${esc(r.roulette.name)}` : (r.roulette?.blocked ? "Blocked by protection" : "No trigger");

  resultsEl.innerHTML = `
    <div class="today-card-main">
      <div class="today-card-head">
        <div>
          <span class="tiny">${r.rsbd ? "Special Event" : "Today"}</span>
          <h2>${r.rsbd ? "Random Sissy Bimbo Day" : "Today's Tasks"}</h2>
        </div>
        <span class="pill">${tasks.filter(t=>t.complete).length}/${tasks.length} done</span>
      </div>

      <div class="home-task-list">${taskHtml}</div>
    </div>

    <details class="daily-summary-card" open>
      <summary>Roll Summary</summary>
      <div class="summary-grid">
        <div class="summary-item"><b>Chastity</b><span>${esc(r.chastity?.result || "")}${r.chastity?.cage ? " — " + esc(r.chastity.cage) : ""}</span></div>
        <div class="summary-item"><b>Content</b><span>${esc(r.content || "No content configured")}</span></div>
        <div class="summary-item"><b>Outfit</b><span>${outfitSummary}</span></div>
        <div class="summary-item"><b>Roulette</b><span>${rouletteText}</span></div>
      </div>
    </details>
  `;
}

function getRollAnimationStages(r){
  if(!r) return [];

  const stages = [];

  stages.push({
    icon:"♡",
    label:"Chastity",
    value:`${r.chastity?.result || ""}${r.chastity?.cage ? " — " + r.chastity.cage : ""}`,
    duration:1450
  });

  stages.push({
    icon:"✦",
    label:"Content",
    value:r.content || "No content configured",
    duration:1450
  });

  const tasks = r.tasks || [];
  if(tasks.length){
    tasks.forEach((task, idx) => {
      stages.push({
        icon:"✓",
        label:`Task ${idx + 1} / ${tasks.length}`,
        value:`${task.name} · ${task.tag}`,
        duration:4000
      });
    });
  } else {
    stages.push({
      icon:"✓",
      label:"Tasks",
      value:"No tasks rolled",
      duration:1800
    });
  }

  const outfits = r.outfits || [];
  if(outfits.length){
    outfits.forEach((outfit, idx) => {
      stages.push({
        icon:"👗",
        label:`Outfit ${idx + 1} / ${outfits.length}`,
        value:`${outfit.tag} · ${outfit.name}`,
        duration:4000
      });
    });
  } else {
    stages.push({
      icon:"👗",
      label:"Outfit",
      value:"No outfit items today",
      duration:1800
    });
  }

  stages.push({
    icon:"🎰",
    label:"Roulette",
    value:r.roulette?.triggered ? `Triggered — ${r.roulette.name}` : (r.roulette?.blocked ? "Blocked by protection" : "No trigger"),
    duration:1450
  });

  return stages;
}

function playRollAnimation(){
  const overlay = document.getElementById("rollOverlay");
  const icon = document.getElementById("rollStageIcon");
  const label = document.getElementById("rollStageLabel");
  const value = document.getElementById("rollStageValue");
  if(!overlay || !icon || !label || !value || !data.todayResults) return;

  const stages = getRollAnimationStages(data.todayResults);
  overlay.classList.remove("hidden");
  overlay.classList.add("active");

  let i = 0;
  const showStage = () => {
    const s = stages[i];
    if(!s){
      overlay.classList.remove("active");
      overlay.classList.add("roll-fade-out");
      setTimeout(()=>{
        overlay.classList.add("hidden");
        overlay.classList.remove("roll-fade-out");
      }, 450);
      return;
    }

    icon.textContent = s.icon;
    label.textContent = s.label;
    value.textContent = s.value;

    const card = overlay.querySelector(".roll-stage-card");
    if(card){
      card.classList.remove("stage-pop");
      void card.offsetWidth;
      card.classList.add("stage-pop");
    }

    i++;
    setTimeout(showStage, s.duration || 1450);
  };

  showStage();
}


/* V17 reward + punishment wheel animations */

let v17WheelBusy = false;

function showWheelOverlay({title, result, rarity, duration = 2600, callback}){
  const overlay = document.getElementById("wheelOverlay");
  const titleEl = document.getElementById("wheelTitle");
  const resultEl = document.getElementById("wheelResult");
  const wheel = document.getElementById("spinWheel");
  if(!overlay || !titleEl || !resultEl || !wheel){
    if(callback) callback();
    return;
  }

  v17WheelBusy = true;
  overlay.classList.remove("hidden");
  overlay.classList.add("active");
  overlay.dataset.rarity = rarity || "";

  titleEl.textContent = title || "Rolling...";
  resultEl.textContent = "Spinning...";
  wheel.classList.remove("wheel-spin");
  void wheel.offsetWidth;
  wheel.classList.add("wheel-spin");

  setTimeout(() => {
    resultEl.textContent = result || "Done";
    wheel.classList.remove("wheel-spin");
    wheel.classList.add("wheel-land");
  }, duration);

  setTimeout(() => {
    overlay.classList.add("wheel-fade-out");
    setTimeout(() => {
      overlay.classList.add("hidden");
      overlay.classList.remove("active","wheel-fade-out");
      wheel.classList.remove("wheel-land");
      v17WheelBusy = false;
      if(callback) callback();
    }, 420);
  }, duration + 1900);
}

function claimCurrentRewardPathAnimated(){
  ensureV15Data();
  const cur = currentRewardDef();
  if(!cur) return;
  if((data.rewardPath.progress || 0) < cur.target) return;

  const rewardName = cur.name;
  showWheelOverlay({
    title:"Reward Unlocked",
    result:rewardName,
    rarity: cur.id === "highHeelsLover" ? "legendary" : "reward",
    callback:() => {
      applyRewardPreset(cur.id);
      data.rewardPath.claimedHistory.push(cur.id);
      data.rewardPath.recent.unshift(cur.id);
      data.rewardPath.recent = data.rewardPath.recent.slice(0,2);
      rollNextRewardPath();
      save();
      render();
    }
  });
}

window.claimCurrentRewardPath = claimCurrentRewardPathAnimated;

function autoClaimRewardIfReady(){
  if(v17WheelBusy) return;
  if(!data.rewardPath || !data.rewardPath.current) return;
  const cur = currentRewardDef();
  if(!cur) return;
  if((data.rewardPath.progress || 0) >= cur.target && !data._rewardAutoClaimPending){
    data._rewardAutoClaimPending = true;
    save();
    setTimeout(() => {
      data._rewardAutoClaimPending = false;
      claimCurrentRewardPathAnimated();
    }, 650);
  }
}

function rollAvailablePunishmentsAnimated(){
  const rolls = availablePunishmentRolls();
  if(!rolls) return;

  const rolled = [];
  for(let i=0;i<rolls;i++){
    rolled.push(rollOnePunishment());
  }
  data.punishmentBar = (data.punishmentBar || 0) % 10;
  save();

  let i = 0;
  const next = () => {
    const p = rolled[i];
    if(!p){
      render();
      return;
    }
    showWheelOverlay({
      title:`Punishment Roll ${i+1} / ${rolled.length}`,
      result:`${p.rarity}: ${p.name}`,
      rarity:p.rarity.toLowerCase(),
      callback:() => {
        i++;
        next();
      }
    });
  };
  next();
}

window.rollAvailablePunishments = rollAvailablePunishmentsAnimated;

function autoRollPunishmentsIfAvailable(){
  if(v17WheelBusy) return;
  const rolls = availablePunishmentRolls();
  if(rolls > 0 && !data._punishmentAutoRollPending){
    data._punishmentAutoRollPending = true;
    save();
    setTimeout(() => {
      data._punishmentAutoRollPending = false;
      rollAvailablePunishmentsAnimated();
    }, 900);
  }
}

function bindV17Buttons(){
  const rp = document.getElementById("rollPunishmentsBtn");
  if(rp) rp.onclick = rollAvailablePunishmentsAnimated;

  const rewardPlus = document.getElementById("devRewardPlus");
  if(rewardPlus){
    rewardPlus.onclick = () => {
      ensureV15Data();
      const cur = currentRewardDef();
      if(cur){
        data.rewardPath.progress = Math.min(cur.target, (data.rewardPath.progress || 0) + 1);
        syncRewardObjectToPath();
      }
      save();
      render();
    };
  }
}

const oldRenderV17 = render;
render = function(){
  oldRenderV17();
  bindV17Buttons();
  autoClaimRewardIfReady();
  autoRollPunishmentsIfAvailable();
};

bindV17Buttons();
render();


/* =========================
   V18 Real Wheels + Skip Animation
========================= */

var v18SkipRoll = false;
var v18SkipWheel = false;
var v18WheelBusy = false;

var V18_RARITY_COLORS = {
  Common:"#ffffff",
  Uncommon:"#22C55E",
  Rare:"#3B82F6",
  Epic:"#A855F7",
  Legendary:"#FACC15"
};

var V18_RARITY_WEIGHTS = {Common:50, Uncommon:30, Rare:15, Epic:4, Legendary:1};

function v18BindSkipButtons(){
  const rollSkip = document.getElementById("skipRollAnimationBtn");
  if(rollSkip){
    rollSkip.onclick = () => {
      v18SkipRoll = true;
      const overlay = document.getElementById("rollOverlay");
      if(overlay){
        overlay.classList.add("hidden");
        overlay.classList.remove("active","roll-fade-out");
      }
    };
  }

  const wheelSkip = document.getElementById("skipWheelAnimationBtn");
  if(wheelSkip){
    wheelSkip.onclick = () => {
      v18SkipWheel = true;
    };
  }
}

function v18MakeConic(items){
  if(!items || !items.length) return "conic-gradient(#fff 0 100%)";
  const total = items.reduce((s,x)=>s+(Number(x.weight)||1),0);
  let acc = 0;
  const stops = [];
  items.forEach((item, idx)=>{
    const start = (acc/total)*360;
    acc += Number(item.weight)||1;
    const end = (acc/total)*360;
    stops.push(`${item.color || "#fff"} ${start}deg ${end}deg`);
  });
  return `conic-gradient(from -90deg, ${stops.join(", ")})`;
}

function v18TargetAngleForIndex(items, selectedIndex){
  const total = items.reduce((s,x)=>s+(Number(x.weight)||1),0);
  let before = 0;
  for(let i=0;i<selectedIndex;i++) before += Number(items[i].weight)||1;
  const selectedWeight = Number(items[selectedIndex].weight)||1;
  const centerFraction = (before + selectedWeight/2) / total;
  const centerDeg = centerFraction * 360;
  // pointer is at top, wheel starts from -90deg in CSS conic; rotate so selected center lands at top
  return 360 - centerDeg;
}

function v18PopulateWheel(items){
  const wheel = document.getElementById("realWheel");
  if(!wheel) return;
  wheel.innerHTML = "";
  wheel.style.background = v18MakeConic(items);
  wheel.className = "real-wheel";

  items.forEach((item, idx)=>{
    const label = document.createElement("div");
    label.className = "real-wheel-label";
    const total = items.reduce((s,x)=>s+(Number(x.weight)||1),0);
    let before = 0;
    for(let i=0;i<idx;i++) before += Number(items[i].weight)||1;
    const center = ((before + (Number(item.weight)||1)/2) / total) * 360;
    label.style.transform = `rotate(${center}deg) translateY(-78px) rotate(${-center}deg)`;
    label.textContent = item.short || item.name;
    wheel.appendChild(label);
  });
}

function v18SpinWheel({title, items, selectedIndex, resultText, rarity, duration=3600}){
  return new Promise(resolve=>{
    const overlay = document.getElementById("realWheelOverlay");
    const wheel = document.getElementById("realWheel");
    const titleEl = document.getElementById("realWheelTitle");
    const resultEl = document.getElementById("realWheelResult");

    if(!overlay || !wheel || !titleEl || !resultEl || !items || !items.length){
      resolve();
      return;
    }

    v18WheelBusy = true;
    v18SkipWheel = false;
    overlay.classList.remove("hidden","real-wheel-fade-out");
    overlay.dataset.rarity = rarity || "";
    titleEl.textContent = title || "Wheel";
    resultEl.textContent = "Spinning...";

    v18PopulateWheel(items);

    const target = v18TargetAngleForIndex(items, selectedIndex);
    const spins = 5 * 360;
    const finalDeg = spins + target;

    wheel.style.transition = "none";
    wheel.style.transform = "rotate(0deg)";
    void wheel.offsetWidth;

    if(v18SkipWheel){
      wheel.style.transform = `rotate(${target}deg)`;
      resultEl.textContent = resultText;
      resolve();
      return;
    }

    wheel.style.transition = `transform ${duration}ms cubic-bezier(.12,.78,.16,1)`;
    wheel.style.transform = `rotate(${finalDeg}deg)`;

    const finish = () => {
      resultEl.textContent = resultText;
      overlay.classList.add(`rarity-${(rarity||"reward").toLowerCase()}`);

      if((rarity||"").toLowerCase()==="epic"){
        overlay.classList.add("wheel-shake");
      }
      if((rarity||"").toLowerCase()==="legendary"){
        overlay.classList.add("legendary-flash");
        v18Confetti();
      }

      setTimeout(()=>{
        overlay.classList.add("real-wheel-fade-out");
        setTimeout(()=>{
          overlay.classList.add("hidden");
          overlay.classList.remove("wheel-shake","legendary-flash","real-wheel-fade-out","rarity-common","rarity-uncommon","rarity-rare","rarity-epic","rarity-legendary","rarity-reward");
          v18WheelBusy = false;
          resolve();
        }, 420);
      }, rarity === "Legendary" ? 1900 : 1350);
    };

    if(v18SkipWheel){
      finish();
      return;
    }

    const timer = setTimeout(finish, duration + 120);
    const skipCheck = setInterval(()=>{
      if(v18SkipWheel){
        clearInterval(skipCheck);
        clearTimeout(timer);
        wheel.style.transition = "transform .2s ease";
        wheel.style.transform = `rotate(${target}deg)`;
        setTimeout(finish, 220);
      }
    }, 80);
  });
}

function v18Confetti(){
  const overlay = document.getElementById("realWheelOverlay");
  if(!overlay) return;
  for(let i=0;i<26;i++){
    const p = document.createElement("span");
    p.className = "confetti-piece";
    p.textContent = "✦";
    p.style.left = `${Math.random()*100}%`;
    p.style.animationDelay = `${Math.random()*0.35}s`;
    p.style.color = i%2 ? "#FACC15" : "#fff";
    overlay.appendChild(p);
    setTimeout(()=>p.remove(), 1800);
  }
}

/* Daily roll skip override */
function playRollAnimation(){
  const overlay = document.getElementById("rollOverlay");
  const icon = document.getElementById("rollStageIcon");
  const label = document.getElementById("rollStageLabel");
  const value = document.getElementById("rollStageValue");
  if(!overlay || !icon || !label || !value || !data.todayResults) return;

  v18SkipRoll = false;
  const stages = getRollAnimationStages(data.todayResults);
  overlay.classList.remove("hidden");
  overlay.classList.add("active");

  let i = 0;
  const showStage = () => {
    if(v18SkipRoll){
      overlay.classList.add("hidden");
      overlay.classList.remove("active","roll-fade-out");
      return;
    }

    const s = stages[i];
    if(!s){
      overlay.classList.remove("active");
      overlay.classList.add("roll-fade-out");
      setTimeout(()=>{
        overlay.classList.add("hidden");
        overlay.classList.remove("roll-fade-out");
      }, 450);
      return;
    }

    icon.textContent = s.icon;
    label.textContent = s.label;
    value.textContent = s.value;

    const card = overlay.querySelector(".roll-stage-card");
    if(card){
      card.classList.remove("stage-pop");
      void card.offsetWidth;
      card.classList.add("stage-pop");
    }

    i++;
    setTimeout(showStage, s.duration || 1450);
  };

  showStage();
}

/* Reward wheel: eligible reward pool + selected reward */
function v18RewardPool(){
  ensureV15Data();
  let pool = REWARD_PRESETS.filter(r=>!(data.rewardPath.recent||[]).includes(r.id));
  pool = pool.filter(r=>r.id!=="highHeelsLover" || highHeelsEligible());
  if(!pool.length) pool = REWARD_PRESETS.filter(r=>r.id!=="highHeelsLover");
  return pool;
}

function rollNextRewardPathAnimated(){
  const pool = v18RewardPool();
  if(!pool.length) return;
  const selectedIndex = Math.floor(Math.random()*pool.length);
  const picked = pool[selectedIndex];

  const items = pool.map(r=>({
    name:r.name,
    short:r.name.split(" ").map(w=>w[0]).join("").slice(0,3),
    weight:1,
    color:r.id==="highHeelsLover" ? "#d8b4fe" : (r.id==="shopping" ? "#fbcfe8" : "#f9a8d4")
  }));

  return v18SpinWheel({
    title:"Next Reward",
    items,
    selectedIndex,
    resultText:picked.name,
    rarity:picked.id==="highHeelsLover" ? "Legendary" : "reward",
    duration:3400
  }).then(()=>{
    data.rewardPath.current = picked.id;
    data.rewardPath.progress = 0;

    if(picked.id==="highHeelsLover") data.rewardPath.sinceHeels = [];
    else if(!(data.rewardPath.sinceHeels||[]).includes(picked.id)) data.rewardPath.sinceHeels.push(picked.id);

    syncRewardObjectToPath();
    save();
    render();
  });
}

async function claimCurrentRewardPathAnimated(){
  ensureV15Data();
  const cur = currentRewardDef();
  if(!cur) return;
  if((data.rewardPath.progress || 0) < cur.target) return;

  await v18SpinWheel({
    title:"Reward Complete",
    items:[{name:cur.name, short:"♡", weight:1, color:"#f9a8d4"}],
    selectedIndex:0,
    resultText:cur.name,
    rarity:cur.id==="highHeelsLover" ? "Legendary" : "reward",
    duration:2400
  });

  applyRewardPreset(cur.id);
  data.rewardPath.claimedHistory.push(cur.id);
  data.rewardPath.recent.unshift(cur.id);
  data.rewardPath.recent = data.rewardPath.recent.slice(0,2);
  save();

  await rollNextRewardPathAnimated();
}

window.claimCurrentRewardPath = claimCurrentRewardPathAnimated;

/* Punishment wheel: rarity wheel then punishment wheel, then apply */
function v18RollRarityWeighted(){
  const entries = Object.entries(V18_RARITY_WEIGHTS);
  const total = entries.reduce((s,[,w])=>s+w,0);
  let r = Math.random()*total;
  for(let i=0;i<entries.length;i++){
    const [rarity, weight] = entries[i];
    r -= weight;
    if(r <= 0) return {rarity, index:i};
  }
  return {rarity:"Common", index:0};
}

async function v18RollOnePunishmentAnimated(){
  const rarityItems = Object.entries(V18_RARITY_WEIGHTS).map(([name, weight])=>({
    name,
    short:name[0],
    weight,
    color:V18_RARITY_COLORS[name]
  }));

  const rarityRoll = v18RollRarityWeighted();
  const rarityIndex = rarityItems.findIndex(x=>x.name===rarityRoll.rarity);

  await v18SpinWheel({
    title:"Punishment Rarity",
    items:rarityItems,
    selectedIndex:rarityIndex,
    resultText:rarityRoll.rarity,
    rarity:rarityRoll.rarity,
    duration:3800
  });

  const pool = PUNISHMENTS.filter(p=>p.rarity===rarityRoll.rarity);
  const selectedIndex = Math.floor(Math.random()*pool.length);
  const picked = pool[selectedIndex];

  const punishmentItems = pool.map(p=>({
    name:p.name,
    short:p.name.split(" ").map(w=>w[0]).join("").slice(0,3),
    weight:1,
    color:V18_RARITY_COLORS[p.rarity]
  }));

  await v18SpinWheel({
    title:`${rarityRoll.rarity} Punishment`,
    items:punishmentItems,
    selectedIndex,
    resultText:picked.name,
    rarity:picked.rarity,
    duration:3600
  });

  picked.apply();
  return picked;
}

async function rollAvailablePunishmentsAnimated(){
  const rolls = availablePunishmentRolls();
  if(!rolls) return;

  const remainder = (data.punishmentBar || 0) % 10;
  data.punishmentBar = remainder;
  save();
  render();

  for(let i=0;i<rolls;i++){
    await v18RollOnePunishmentAnimated();
    save();
    render();
  }
}

window.rollAvailablePunishments = rollAvailablePunishmentsAnimated;

function autoClaimRewardIfReady(){
  if(typeof v18WheelBusy === "undefined" || v18WheelBusy) return;
  if(!data.rewardPath || !data.rewardPath.current) return;
  const cur = currentRewardDef();
  if(!cur) return;
  if((data.rewardPath.progress || 0) >= cur.target && !data._rewardAutoClaimPending){
    data._rewardAutoClaimPending = true;
    save();
    setTimeout(async () => {
      data._rewardAutoClaimPending = false;
      await claimCurrentRewardPathAnimated();
    }, 650);
  }
}

function autoRollPunishmentsIfAvailable(){
  if(typeof v18WheelBusy === "undefined" || v18WheelBusy) return;
  const rolls = availablePunishmentRolls();
  if(rolls > 0 && !data._punishmentAutoRollPending){
    data._punishmentAutoRollPending = true;
    save();
    setTimeout(async () => {
      data._punishmentAutoRollPending = false;
      await rollAvailablePunishmentsAnimated();
    }, 900);
  }
}

function bindV18Buttons(){
  v18BindSkipButtons();

  const rp = document.getElementById("rollPunishmentsBtn");
  if(rp) rp.onclick = rollAvailablePunishmentsAnimated;

  const rewardPlus = document.getElementById("devRewardPlus");
  if(rewardPlus){
    rewardPlus.onclick = () => {
      ensureV15Data();
      const cur = currentRewardDef();
      if(cur){
        data.rewardPath.progress = Math.min(cur.target, (data.rewardPath.progress || 0) + 1);
        syncRewardObjectToPath();
      }
      save();
      render();
    };
  }

  const devReward = document.getElementById("devRewardReroll");
  if(devReward){
    devReward.onclick = async () => {
      const cur = data.rewardPath?.current;
      if(cur){
        data.rewardPath.recent.unshift(cur);
        data.rewardPath.recent = data.rewardPath.recent.slice(0,2);
      }
      await rollNextRewardPathAnimated();
      save();
      render();
    };
  }
}

const oldRenderV18 = render;
render = function(){
  oldRenderV18();
  bindV18Buttons();
  autoClaimRewardIfReady();
  autoRollPunishmentsIfAvailable();
};

bindV18Buttons();
render();


/* V18.3 punishment auto-spin fix */
var v183PunishmentSpinScheduled = false;

function v183ClearOldPendingFlags(){
  // Older V17/V18 builds persisted these flags in localStorage.
  // If they are stuck true, auto-spin never starts.
  if(data._punishmentAutoRollPending) data._punishmentAutoRollPending = false;
  if(data._rewardAutoClaimPending) data._rewardAutoClaimPending = false;
}

function autoRollPunishmentsIfAvailable(){
  v183ClearOldPendingFlags();

  if(typeof v18WheelBusy !== "undefined" && v18WheelBusy) return;
  if(v183PunishmentSpinScheduled) return;

  const rolls = typeof availablePunishmentRolls === "function" ? availablePunishmentRolls() : Math.floor((data.punishmentBar || 0) / 10);
  if(rolls <= 0) return;

  v183PunishmentSpinScheduled = true;

  setTimeout(async () => {
    v183PunishmentSpinScheduled = false;
    if(typeof v18WheelBusy !== "undefined" && v18WheelBusy) {
      autoRollPunishmentsIfAvailable();
      return;
    }
    if((typeof availablePunishmentRolls === "function" ? availablePunishmentRolls() : Math.floor((data.punishmentBar || 0) / 10)) > 0){
      await rollAvailablePunishmentsAnimated();
    }
  }, 500);
}

function v183BindPunishmentButtons(){
  const rp = document.getElementById("rollPunishmentsBtn");
  if(rp) rp.onclick = rollAvailablePunishmentsAnimated;

  const plus = document.getElementById("devPunishBar");
  if(plus){
    plus.onclick = () => {
      data.punishmentBar = Number(data.punishmentBar || 0) + 10;
      v183ClearOldPendingFlags();
      save();
      render();
      setTimeout(autoRollPunishmentsIfAvailable, 100);
    };
  }

  const minus = document.getElementById("devPunishMinus");
  if(minus){
    minus.onclick = () => {
      data.punishmentBar = Math.max(0, Number(data.punishmentBar || 0) - 1);
      v183ClearOldPendingFlags();
      save();
      render();
    };
  }
}

// Wrap render one final time so this checker runs after all older render wrappers.
const oldRenderV183 = render;
render = function(){
  oldRenderV183();
  v183BindPunishmentButtons();
  autoRollPunishmentsIfAvailable();
};

v183ClearOldPendingFlags();
v183BindPunishmentButtons();
save();
setTimeout(autoRollPunishmentsIfAvailable, 250);


/* V18.4 wheel alignment fix
   Previous builds could visually stop on the wrong color because the wheel's
   target angle did not account consistently for the CSS conic origin.
   This version uses a pointer-at-top coordinate system:
   - slice 0 starts at top
   - centers are measured clockwise from top
   - wheel rotates counter to selected center so selected center lands at top
*/

function v184SliceCenterDeg(items, selectedIndex){
  const total = items.reduce((s,x)=>s+(Number(x.weight)||1),0);
  let before = 0;
  for(let i=0;i<selectedIndex;i++) before += Number(items[i].weight)||1;
  const selectedWeight = Number(items[selectedIndex].weight)||1;
  return ((before + selectedWeight / 2) / total) * 360;
}

function v18TargetAngleForIndex(items, selectedIndex){
  const center = v184SliceCenterDeg(items, selectedIndex);
  // Negative rotation brings clockwise center back to top.
  return -center;
}

function v18MakeConic(items){
  if(!items || !items.length) return "conic-gradient(from -90deg, #fff 0deg 360deg)";
  const total = items.reduce((s,x)=>s+(Number(x.weight)||1),0);
  let acc = 0;
  const stops = [];
  items.forEach(item=>{
    const start = (acc/total)*360;
    acc += Number(item.weight)||1;
    const end = (acc/total)*360;
    stops.push(`${item.color || "#fff"} ${start}deg ${end}deg`);
  });
  // -90deg makes 0deg line up with the visual top pointer.
  return `conic-gradient(from -90deg, ${stops.join(", ")})`;
}

function v18PopulateWheel(items){
  const wheel = document.getElementById("realWheel");
  if(!wheel) return;
  wheel.innerHTML = "";
  wheel.style.background = v18MakeConic(items);
  wheel.className = "real-wheel";

  items.forEach((item, idx)=>{
    const label = document.createElement("div");
    label.className = "real-wheel-label";
    const center = v184SliceCenterDeg(items, idx);
    label.style.transform = `rotate(${center}deg) translateY(-78px) rotate(${-center}deg)`;
    label.textContent = item.short || item.name;
    wheel.appendChild(label);
  });
}

async function v18RollOnePunishmentAnimated(){
  const rarityItems = Object.entries(V18_RARITY_WEIGHTS).map(([name, weight])=>({
    name,
    short:name[0],
    weight,
    color:V18_RARITY_COLORS[name]
  }));

  const rarityRoll = v18RollRarityWeighted();
  const rarityIndex = rarityItems.findIndex(x=>x.name===rarityRoll.rarity);
  const selectedRarity = rarityItems[rarityIndex];

  await v18SpinWheel({
    title:"Punishment Rarity",
    items:rarityItems,
    selectedIndex:rarityIndex,
    resultText:selectedRarity.name,
    rarity:selectedRarity.name,
    duration:3800
  });

  const pool = PUNISHMENTS.filter(p=>p.rarity===selectedRarity.name);
  const selectedIndex = Math.floor(Math.random()*pool.length);
  const picked = pool[selectedIndex];

  const punishmentItems = pool.map(p=>({
    name:p.name,
    short:p.name.split(" ").map(w=>w[0]).join("").slice(0,3),
    weight:1,
    color:V18_RARITY_COLORS[p.rarity]
  }));

  await v18SpinWheel({
    title:`${selectedRarity.name} Punishment`,
    items:punishmentItems,
    selectedIndex,
    resultText:picked.name,
    rarity:picked.rarity,
    duration:3600
  });

  picked.apply();
  return picked;
}


/* V18.5 SVG wheel fix
   This replaces the conic-gradient wheel with a real SVG wheel.
   The selected slice is calculated first, drawn as a real segment, and the SVG disc rotates so
   that the selected slice's center is exactly under the top pointer.
*/

function v185Point(cx, cy, r, deg){
  const rad = deg * Math.PI / 180;
  return {
    x: cx + r * Math.sin(rad),
    y: cy - r * Math.cos(rad)
  };
}

function v185SlicePath(cx, cy, r, startDeg, endDeg){
  const start = v185Point(cx, cy, r, startDeg);
  const end = v185Point(cx, cy, r, endDeg);
  const largeArc = (endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

function v185BuildSlices(items){
  const total = items.reduce((s,x)=>s+(Number(x.weight)||1),0);
  let acc = 0;
  return items.map((item, index)=>{
    const weight = Number(item.weight)||1;
    const start = (acc / total) * 360;
    acc += weight;
    const end = (acc / total) * 360;
    return {
      ...item,
      index,
      start,
      end,
      center:(start + end) / 2
    };
  });
}

function v18PopulateWheel(items){
  const wheel = document.getElementById("realWheel");
  if(!wheel) return;

  const slices = v185BuildSlices(items);
  const cx = 125, cy = 125, r = 118;
  const labelR = 78;

  const paths = slices.map(s => {
    const label = v185Point(cx, cy, labelR, s.center);
    const textColor = s.name === "Common" ? "#4c4052" : "#ffffff";
    return `
      <path d="${v185SlicePath(cx, cy, r, s.start, s.end)}" fill="${s.color || "#fff"}" stroke="rgba(255,255,255,.85)" stroke-width="2"></path>
      <text x="${label.x}" y="${label.y}" text-anchor="middle" dominant-baseline="middle" fill="${textColor}" font-size="10" font-weight="900">${esc(s.short || s.name)}</text>
    `;
  }).join("");

  wheel.innerHTML = `
    <svg class="real-wheel-svg" viewBox="0 0 250 250" aria-hidden="true">
      <g id="realWheelDisc">
        ${paths}
        <circle cx="125" cy="125" r="43" fill="rgba(255,255,255,.88)" stroke="rgba(255,120,186,.28)" stroke-width="2"></circle>
        <text x="125" y="130" text-anchor="middle" fill="#ed4c97" font-size="24" font-weight="900">♡</text>
      </g>
    </svg>
  `;
  wheel.className = "real-wheel svg-mode";
  wheel.dataset.slices = JSON.stringify(slices.map(s=>({center:s.center,name:s.name})));
}

function v18TargetAngleForIndex(items, selectedIndex){
  const slices = v185BuildSlices(items);
  const center = slices[selectedIndex]?.center || 0;
  return -center;
}

function v18SpinWheel({title, items, selectedIndex, resultText, rarity, duration=3600}){
  return new Promise(resolve=>{
    const overlay = document.getElementById("realWheelOverlay");
    const wheel = document.getElementById("realWheel");
    const titleEl = document.getElementById("realWheelTitle");
    const resultEl = document.getElementById("realWheelResult");

    if(!overlay || !wheel || !titleEl || !resultEl || !items || !items.length){
      resolve();
      return;
    }

    v18WheelBusy = true;
    v18SkipWheel = false;
    overlay.classList.remove("hidden","real-wheel-fade-out","rarity-common","rarity-uncommon","rarity-rare","rarity-epic","rarity-legendary","rarity-reward");
    overlay.dataset.rarity = rarity || "";
    titleEl.textContent = title || "Wheel";
    resultEl.textContent = "Spinning...";

    v18PopulateWheel(items);

    const disc = wheel.querySelector("#realWheelDisc");
    const target = v18TargetAngleForIndex(items, selectedIndex);
    const finalDeg = (360 * 6) + target;

    if(!disc){
      resultEl.textContent = resultText;
      v18WheelBusy = false;
      resolve();
      return;
    }

    disc.style.transformOrigin = "125px 125px";
    disc.style.transition = "none";
    disc.style.transform = "rotate(0deg)";
    void disc.getBoundingClientRect();

    const finish = () => {
      disc.style.transition = "transform .22s ease";
      disc.style.transform = `rotate(${target}deg)`;
      resultEl.textContent = resultText;
      overlay.classList.add(`rarity-${(rarity||"reward").toLowerCase()}`);

      if((rarity||"").toLowerCase()==="epic") overlay.classList.add("wheel-shake");
      if((rarity||"").toLowerCase()==="legendary"){
        overlay.classList.add("legendary-flash");
        v18Confetti();
      }

      setTimeout(()=>{
        overlay.classList.add("real-wheel-fade-out");
        setTimeout(()=>{
          overlay.classList.add("hidden");
          overlay.classList.remove("wheel-shake","legendary-flash","real-wheel-fade-out","rarity-common","rarity-uncommon","rarity-rare","rarity-epic","rarity-legendary","rarity-reward");
          v18WheelBusy = false;
          resolve();
        }, 420);
      }, rarity === "Legendary" ? 1900 : 1350);
    };

    if(v18SkipWheel){
      finish();
      return;
    }

    disc.style.transition = `transform ${duration}ms cubic-bezier(.12,.78,.16,1)`;
    disc.style.transform = `rotate(${finalDeg}deg)`;

    const timer = setTimeout(finish, duration + 120);
    const skipCheck = setInterval(()=>{
      if(v18SkipWheel){
        clearInterval(skipCheck);
        clearTimeout(timer);
        finish();
      }
    }, 80);
  });
}


/* =========================
   V19 Polish: outfit cards, reward bar animation, RSBD intro
========================= */

var v19LastRewardProgress = null;
var v19RsbdIntroPlaying = false;

function outfitIconForTag(tag){
  const t = String(tag || "").toLowerCase();
  if(t.includes("heel") || t.includes("shoe") || t.includes("stiletto")) return "👠";
  if(t.includes("sock") || t.includes("stocking") || t.includes("thigh")) return "🧦";
  if(t.includes("dress")) return "👗";
  if(t.includes("skirt")) return "🎀";
  if(t.includes("top") || t.includes("shirt") || t.includes("blouse")) return "👚";
  if(t.includes("bra")) return "💕";
  if(t.includes("pant") || t.includes("brief") || t.includes("lingerie")) return "🩲";
  if(t.includes("corset")) return "🎗️";
  if(t.includes("jewel") || t.includes("necklace") || t.includes("ring")) return "💎";
  if(t.includes("makeup") || t.includes("lipstick")) return "💄";
  if(t.includes("access")) return "✨";
  if(t.includes("hair") || t.includes("wig")) return "💇‍♀️";
  return "🎀";
}

function renderOutfitCards(outfits){
  if(!outfits || !outfits.length) return `<div class="muted">No outfit items.</div>`;
  return `<div class="outfit-card-grid">` + outfits.map(o=>`
    <div class="outfit-display-card">
      <div class="outfit-icon">${outfitIconForTag(o.tag)}</div>
      <div>
        <b>${esc(o.name)}</b>
        <small>${esc(o.tag)}</small>
      </div>
    </div>
  `).join("") + `</div>`;
}

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

  const tasks = r.tasks || [];
  const outfits = r.outfits || [];

  const taskHtml = tasks.length ? tasks.map(t => `
    <label class="home-task-check ${t.complete ? "done" : ""}">
      <input type="checkbox" ${t.complete ? "checked" : ""} onchange="toggleTodayTask('${t.id}', this.checked)">
      <span>
        <b>${esc(t.name)}</b>
        <small>${esc(t.tag)}${t.failsafe ? " · failsafe" : ""}${t.overflow ? " · overflow" : ""}${t.rsbd ? " · RSBD" : ""}</small>
      </span>
    </label>
  `).join("") : `<div class="muted">No tasks rolled.</div>`;

  const rouletteText = r.roulette?.triggered ? `Triggered — ${esc(r.roulette.name)}` : (r.roulette?.blocked ? "Blocked by protection" : "No trigger");

  resultsEl.innerHTML = `
    <div class="today-card-main ${r.rsbd ? "rsbd-today-card" : ""}">
      ${r.rsbd ? `<div class="rsbd-inline-badge">✨ RANDOM SISSY BIMBO DAY ✨</div>` : ""}
      <div class="today-card-head">
        <div>
          <span class="tiny">${r.rsbd ? "Special Event" : "Today"}</span>
          <h2>${r.rsbd ? "Today's Special Tasks" : "Today's Tasks"}</h2>
        </div>
        <span class="pill">${tasks.filter(t=>t.complete).length}/${tasks.length} done</span>
      </div>

      <div class="home-task-list">${taskHtml}</div>
    </div>

    <details class="daily-summary-card" open>
      <summary>Roll Summary</summary>
      <div class="summary-grid">
        <div class="summary-item"><b>Chastity</b><span>${esc(r.chastity?.result || "")}${r.chastity?.cage ? " — " + esc(r.chastity.cage) : ""}</span></div>
        <div class="summary-item"><b>Content</b><span>${esc(r.content || "No content configured")}</span></div>
        <div class="summary-item"><b>Outfit</b><span>${renderOutfitCards(outfits)}</span></div>
        <div class="summary-item"><b>Roulette</b><span>${rouletteText}</span></div>
      </div>
    </details>
  `;
}

function renderReward(){
  if(!Array.isArray(REWARD_PRESETS) || REWARD_PRESETS.length===0) return;
  ensureV15Data();
  const cur = currentRewardDef();

  const title = document.getElementById("rewardTitle");
  const bar = document.getElementById("rewardBar");
  const progress = document.getElementById("rewardProgress");
  const badge = document.getElementById("rewardLockBadge");
  const info = document.getElementById("rewardPathInfo");
  const details = document.getElementById("rewardDetails");

  if(details) details.classList.add("hidden");
  if(title) title.textContent = cur ? cur.name : "No reward active";
  if(bar){
    bar.max = cur ? cur.target : 1;
    bar.value = data.rewardPath.progress || 0;
    const current = data.rewardPath.progress || 0;
    if(typeof v19LastRewardProgress !== "undefined" && v19LastRewardProgress !== null && current !== v19LastRewardProgress){
      bar.classList.remove("reward-bar-bump");
      void bar.offsetWidth;
      bar.classList.add("reward-bar-bump");
    }
    if(typeof v19LastRewardProgress !== "undefined") v19LastRewardProgress = current;
  }
  if(progress){
    const pct = cur ? Math.round(((data.rewardPath.progress || 0) / cur.target) * 100) : 0;
    progress.textContent = cur ? `${data.rewardPath.progress || 0} / ${cur.target} days · ${pct}%` : "0 / 0 days";
  }
  if(badge) badge.textContent = "Reward Path";

  if(info && cur){
    const ready = (data.rewardPath.progress || 0) >= cur.target;
    const effects = (data.rewardEffects || []).map(e=>{
      if(e.completedDays) return `${esc(e.name)}: ${e.completedDays} completed day${e.completedDays===1?"":"s"} left`;
      if(e.tasks) return `${esc(e.name)}: ${e.tasks} task${e.tasks===1?"":"s"} left`;
      return esc(e.name);
    }).join("<br>");

    info.innerHTML = `
      <div class="muted">${esc(cur.text)}</div>
      ${ready ? `<button onclick="claimCurrentRewardPath()" class="claim reward-claim">Claim Reward</button>` : ""}
      ${effects ? `<div class="reward-effects"><b>Active Reward Effects</b><br>${effects}</div>` : ""}
    `;
  }
}

function playRSBDIntro(){
  return new Promise(resolve=>{
    const overlay = document.getElementById("rsbdIntroOverlay");
    if(!overlay){
      resolve();
      return;
    }
    v19RsbdIntroPlaying = true;
    overlay.classList.remove("hidden","rsbd-intro-out");
    overlay.classList.add("active");
    setTimeout(()=>{
      overlay.classList.add("rsbd-intro-out");
      setTimeout(()=>{
        overlay.classList.add("hidden");
        overlay.classList.remove("active","rsbd-intro-out");
        v19RsbdIntroPlaying = false;
        resolve();
      }, 500);
    }, 2600);
  });
}

// Override the roll binding so RSBD intro plays before daily reveal.
function bindV19RollAnimation(){
  const btn = document.getElementById("rollAllBtn");
  if(!btn) return;
  const previous = btn.onclick;
  btn.onclick = async () => {
    const before = data.lastRollDate;
    if(typeof previous === "function") previous();
    const after = data.lastRollDate;
    if(after && after !== before && data.todayResults){
      if(data.todayResults.rsbd){
        await playRSBDIntro();
      }
      setTimeout(playRollAnimation, 120);
    }
  };
}

function renderV19(){
  const bar = document.getElementById("rewardBar");
  if(bar) bar.classList.add("animated-reward-bar");
}

const oldRenderV19 = render;
render = function(){
  oldRenderV19();
  renderV19();
};

bindV19RollAnimation();
render();


/* V19.2 app-style notice helper */
function showAppNotice(title, message){
  const overlay = document.getElementById("rsbdIntroOverlay");
  if(!overlay) return alert(`${title}\n${message}`);
  const h = overlay.querySelector("h1");
  const p = overlay.querySelector("p");
  const s = overlay.querySelector("strong");
  if(h) h.textContent = title;
  if(p) p.textContent = message;
  if(s) s.textContent = "Tap anywhere to continue.";
  overlay.classList.remove("hidden","rsbd-intro-out");
  const close = () => {
    overlay.classList.add("rsbd-intro-out");
    setTimeout(()=>{
      overlay.classList.add("hidden");
      overlay.classList.remove("rsbd-intro-out");
      overlay.removeEventListener("click", close);
    }, 350);
  };
  overlay.addEventListener("click", close);
}


/* V19.3 animation timing + delayed roulette URL open */
var v193RouletteOpenedForRollDate = null;

function v193OpenRouletteForCurrentRoll(){
  const r = data.todayResults;
  if(!r || !r.roulette || !r.roulette.triggered || !r.roulette.url) return;
  const rollKey = r.date || data.lastRollDate || today();
  if(v193RouletteOpenedForRollDate === rollKey) return;
  v193RouletteOpenedForRollDate = rollKey;
  window.open(r.roulette.url, "_blank");
}

function v193StageDuration(stage){
  return Number(stage && stage.duration) || 1450;
}

// More robust roll animation:
// - Uses an absolute deadline per stage.
// - If the browser throttles timers while alt-tabbed, it resumes by checking the actual elapsed time.
// - Roulette URL opens only when the Roulette stage is reached.
// - If skipped, roulette opens immediately if the current roll included a roulette URL.
function playRollAnimation(){
  const overlay = document.getElementById("rollOverlay");
  const icon = document.getElementById("rollStageIcon");
  const label = document.getElementById("rollStageLabel");
  const value = document.getElementById("rollStageValue");
  if(!overlay || !icon || !label || !value || !data.todayResults) return;

  v18SkipRoll = false;
  const stages = getRollAnimationStages(data.todayResults);
  overlay.classList.remove("hidden");
  overlay.classList.add("active");

  let index = 0;
  let deadline = 0;

  const showCurrentStage = () => {
    if(v18SkipRoll){
      overlay.classList.add("hidden");
      overlay.classList.remove("active","roll-fade-out");
      v193OpenRouletteForCurrentRoll();
      return;
    }

    const s = stages[index];
    if(!s){
      overlay.classList.remove("active");
      overlay.classList.add("roll-fade-out");
      setTimeout(()=>{
        overlay.classList.add("hidden");
        overlay.classList.remove("roll-fade-out");
      }, 450);
      return;
    }

    icon.textContent = s.icon;
    label.textContent = s.label;
    value.textContent = s.value;

    if(String(s.label || "").toLowerCase().includes("roulette")){
      v193OpenRouletteForCurrentRoll();
    }

    const card = overlay.querySelector(".roll-stage-card");
    if(card){
      card.classList.remove("stage-pop");
      void card.offsetWidth;
      card.classList.add("stage-pop");
    }

    deadline = performance.now() + v193StageDuration(s);
  };

  const tick = () => {
    if(v18SkipRoll){
      overlay.classList.add("hidden");
      overlay.classList.remove("active","roll-fade-out");
      v193OpenRouletteForCurrentRoll();
      return;
    }

    if(performance.now() >= deadline){
      index++;
      showCurrentStage();
    }

    if(!overlay.classList.contains("hidden")){
      setTimeout(tick, 120);
    }
  };

  showCurrentStage();
  setTimeout(tick, 120);
}

// Rebind Roll All one final time so the old immediate URL behavior cannot return.
function bindV193RollAnimation(){
  const btn = document.getElementById("rollAllBtn");
  if(!btn) return;

  const previous = btn.onclick;
  btn.onclick = async () => {
    const before = data.lastRollDate;
    if(typeof previous === "function") previous();
    const after = data.lastRollDate;

    if(after && after !== before && data.todayResults){
      // Reset per-roll roulette-open guard.
      v193RouletteOpenedForRollDate = null;

      if(data.todayResults.rsbd && typeof playRSBDIntro === "function"){
        await playRSBDIntro();
      }
      setTimeout(playRollAnimation, 120);
    }
  };
}

bindV193RollAnimation();


/* V19.4 clean Roll All binding: no stacked animation wrappers, no immediate roulette URL */

var v194RollAnimationRunning = false;
var v194RouletteOpenedKey = null;

function v194OpenRouletteWhenAllowed(){
  const r = data.todayResults;
  if(!r || !r.roulette || !r.roulette.triggered || !r.roulette.url) return;
  const key = r.date || data.lastRollDate || today();
  if(v194RouletteOpenedKey === key) return;
  v194RouletteOpenedKey = key;
  window.open(r.roulette.url, "_blank");
}

function v194RunCoreRoll(){
  const t = typeof localDateString === "function" ? localDateString() : today();
  if(data.theEndUnlocked) return false;
  if(data.lastRollDate === t){
    alert("Today's Roll All has already been used.");
    return false;
  }

  if(typeof adjudicatePreviousRolledDayIfNeeded === "function") adjudicatePreviousRolledDayIfNeeded();

  const rsbd = typeof isRSBD === "function" ? isRSBD(t) : false;
  const results = {date:t, rsbd};

  const chastityChance = (typeof rewardEffect === "function" && rewardEffect("chastityZero")) ? 0 : data.chastityProbability;
  const chastityYes = rsbd ? true : chance(chastityChance);
  results.chastity = {result: chastityYes ? "YES" : "NO", cage: null};

  if(chastityYes){
    const cage = weightedRoll(data.cages);
    results.chastity.cage = cage ? cage.name : "No cage configured";
  } else {
    data.chastityProbability += typeof chastityIncreaseAmount === "function" ? chastityIncreaseAmount() : 1;
  }

  const guaranteedContent = typeof rewardEffect === "function" && rewardEffect("contentDoubleGuaranteed");
  const contentRolls = (guaranteedContent || chance(typeof upgradeLevel === "function" ? upgradeLevel("contentDouble") : 0)) ? 2 : 1;
  const contentResults = [];
  for(let i=0;i<contentRolls;i++){
    const c = weightedRoll(data.content);
    contentResults.push(c ? c.name : "No content configured");
  }
  results.content = contentResults.join(" + ");
  results.game = "";

  results.tasks = rsbd && typeof rsbdFillExactlySevenTasks === "function" ? rsbdFillExactlySevenTasks() : rollTasks();
  results.outfits = typeof rollOutfits === "function" ? rollOutfits(rsbd) : [];
  results.roulette = typeof rollRouletteV15 === "function" ? rollRouletteV15(rsbd) : rollRoulette(rsbd);

  data.lastRollDate = t;
  data.lastSeenDate = t;
  data.rewardGrantedDate = null;
  data.todayResults = results;
  v194RouletteOpenedKey = null;

  save();
  render();
  return true;
}

function playRollAnimation(){
  if(v194RollAnimationRunning) return;

  const overlay = document.getElementById("rollOverlay");
  const icon = document.getElementById("rollStageIcon");
  const label = document.getElementById("rollStageLabel");
  const value = document.getElementById("rollStageValue");
  if(!overlay || !icon || !label || !value || !data.todayResults) return;

  v194RollAnimationRunning = true;
  v18SkipRoll = false;

  const stages = getRollAnimationStages(data.todayResults);
  overlay.classList.remove("hidden");
  overlay.classList.add("active");

  let index = 0;
  let stageToken = 0;

  const closeOverlay = () => {
    overlay.classList.add("hidden");
    overlay.classList.remove("active","roll-fade-out");
    v194RollAnimationRunning = false;
  };

  const showNext = () => {
    const myToken = ++stageToken;

    if(v18SkipRoll){
      v194OpenRouletteWhenAllowed();
      closeOverlay();
      return;
    }

    const s = stages[index++];
    if(!s){
      overlay.classList.remove("active");
      overlay.classList.add("roll-fade-out");
      setTimeout(closeOverlay, 450);
      return;
    }

    icon.textContent = s.icon;
    label.textContent = s.label;
    value.textContent = s.value;

    if(String(s.label || "").toLowerCase().includes("roulette")){
      v194OpenRouletteWhenAllowed();
    }

    const card = overlay.querySelector(".roll-stage-card");
    if(card){
      card.classList.remove("stage-pop");
      void card.offsetWidth;
      card.classList.add("stage-pop");
    }

    const duration = Number(s.duration) || 1450;
    setTimeout(() => {
      if(myToken === stageToken) showNext();
    }, duration);
  };

  showNext();
}

function bindV194RollButton(){
  const btn = document.getElementById("rollAllBtn");
  if(!btn) return;
  btn.onclick = async () => {
    if(v194RollAnimationRunning) return;

    const rolled = v194RunCoreRoll();
    if(!rolled) return;

    if(data.todayResults && data.todayResults.rsbd && typeof playRSBDIntro === "function"){
      await playRSBDIntro();
    }

    setTimeout(playRollAnimation, 120);
  };
}

function v194BindSkip(){
  const rollSkip = document.getElementById("skipRollAnimationBtn");
  if(rollSkip){
    rollSkip.onclick = () => {
      v18SkipRoll = true;
      v194OpenRouletteWhenAllowed();
      const overlay = document.getElementById("rollOverlay");
      if(overlay){
        overlay.classList.add("hidden");
        overlay.classList.remove("active","roll-fade-out");
      }
      v194RollAnimationRunning = false;
    };
  }
}

const oldRenderV194 = render;
render = function(){
  oldRenderV194();
  bindV194RollButton();
  v194BindSkip();
};

bindV194RollButton();
v194BindSkip();


/* V19.5 roulette popup blocker fix
   Browsers block window.open if it happens later during animation.
   So we reserve a blank popup immediately on the Roll All click, then navigate it at the Roulette reveal stage.
*/
var v195ReservedRouletteWindow = null;
var v195ReservedRouletteKey = null;

function v195ReserveRouletteWindowIfNeeded(){
  const r = data.todayResults;
  if(!r || !r.roulette || !r.roulette.triggered || !r.roulette.url) return;

  const key = r.date || data.lastRollDate || today();
  if(v195ReservedRouletteKey === key && v195ReservedRouletteWindow) return;

  v195ReservedRouletteKey = key;
  try {
    v195ReservedRouletteWindow = window.open("about:blank", "_blank");
    if(v195ReservedRouletteWindow && v195ReservedRouletteWindow.document){
      v195ReservedRouletteWindow.document.write("<!doctype html><title>Roulette loading...</title><body style='font-family:sans-serif;background:#fff3f9;color:#ed4c97;display:grid;place-items:center;height:100vh;text-align:center;'><h1>Roulette result loading...</h1><p>This tab will open when the Roulette reveal appears.</p></body>");
      v195ReservedRouletteWindow.document.close();
    }
  } catch(e) {
    v195ReservedRouletteWindow = null;
  }
}

function v194OpenRouletteWhenAllowed(){
  const r = data.todayResults;
  if(!r || !r.roulette || !r.roulette.triggered || !r.roulette.url) return;

  const key = r.date || data.lastRollDate || today();
  if(v194RouletteOpenedKey === key) return;
  v194RouletteOpenedKey = key;

  try {
    if(v195ReservedRouletteWindow && !v195ReservedRouletteWindow.closed){
      v195ReservedRouletteWindow.location.href = r.roulette.url;
      v195ReservedRouletteWindow = null;
      return;
    }
  } catch(e) {}

  // Fallback for cases where the blank popup could not be reserved.
  window.open(r.roulette.url, "_blank");
}

function bindV195RollButton(){
  const btn = document.getElementById("rollAllBtn");
  if(!btn) return;

  btn.onclick = async () => {
    if(v194RollAnimationRunning) return;

    const rolled = v194RunCoreRoll();
    if(!rolled) return;

    // Must happen in the same user click event to avoid popup blocking.
    v195ReserveRouletteWindowIfNeeded();

    if(data.todayResults && data.todayResults.rsbd && typeof playRSBDIntro === "function"){
      await playRSBDIntro();
    }

    setTimeout(playRollAnimation, 120);
  };
}

const oldRenderV195 = render;
render = function(){
  oldRenderV195();
  bindV195RollButton();
};

bindV195RollButton();


/* V19.6 outfit incompatibility: "all"
   Put "all" in a tag's incompatible tags field to make that tag conflict with every other tag.
   It never conflicts with itself.
*/
function tagsDirectlyConflict(tagA, tagB){
  if(!tagA || !tagB) return false;
  if(tagA.id && tagB.id && tagA.id === tagB.id) return false;

  const aBlocks = normalizeRuleList(tagA.incompatibleTags);
  const bBlocks = normalizeRuleList(tagB.incompatibleTags);
  const aName = tagA.name.trim().toLowerCase();
  const bName = tagB.name.trim().toLowerCase();

  if(aBlocks.includes("all") || bBlocks.includes("all")) return true;

  return aBlocks.includes(bName) || bBlocks.includes(aName);
}


/* =========================
   V20 Contract + Certificate
========================= */

function ensureV20Data(){
  data.contract ??= {
    signed:false,
    name:"",
    signedDate:null,
    completedDate:null,
    fulfilled:false
  };
  data.contractStats ??= {
    totalRolls:0,
    totalTasksGenerated:0,
    totalTasksCompleted:0,
    totalPointsEarned:0,
    totalPointsSpent:0,
    totalRewardsCompleted:0,
    totalPunishmentsReceived:0
  };

  // Track per-task completion so checking/unchecking doesn't inflate stats.
  data._contractCompletedTaskIds ??= [];
}

function contractStatus(){
  ensureV20Data();
  if(data.contract.fulfilled) return "Fulfilled";
  if(data.contract.signed) return "Active";
  return "Unsigned";
}

function contractDaysToFreedom(){
  ensureV20Data();
  if(!data.contract.signedDate) return 0;
  const start = parseLocalDate(data.contract.signedDate);
  const end = data.contract.completedDate ? parseLocalDate(data.contract.completedDate) : parseLocalDate(localDateString());
  return Math.max(0, Math.floor((end - start) / 86400000));
}

function renderContractText(name, date){
  const n = esc(name || "[NAME]");
  const d = esc(date || "[DATE]");
  return `
    <h3>THE SISSY RANDOM CONTRACT</h3>
    <p>I, <b>${n}</b>, voluntarily choose to participate in the Sissy Random challenge.</p>
    <p><b>${n}</b> understands that each day brings random tasks, random outfits, random punishments, and random rewards.</p>
    <p><b>${n}</b> understands that choices have consequences.</p>
    <p>If <b>${n}</b> completes assigned tasks, <b>${n}</b> will earn points, progress toward rewards, and move closer to freedom.</p>
    <p>If <b>${n}</b> neglects assigned tasks, <b>${n}</b> accepts the punishments that follow.</p>
    <p><b>${n}</b> understands that progress may be slow.</p>
    <p><b>${n}</b> understands that setbacks may occur.</p>
    <p><b>${n}</b> understands that discipline, consistency, and dedication are required to reach the end.</p>
    <p><b>${n}</b> agrees to follow the outcomes generated by the system to the best of <b>${n}</b>'s ability.</p>
    <p><b>${n}</b> understands that no reward, punishment, challenge, or requirement exists outside of voluntary participation.</p>
    <p>The goal is simple:</p>
    <p>To continue moving forward until <b>${n}</b> finally unlocks:</p>
    <h3>THE END?</h3>
    <p>And when that day arrives, the system will release <b>${n}</b> from all further rolls.</p>
    <div class="signature-box">
      <span>Signed</span>
      <b>${n}</b>
      <span>Date</span>
      <b>${d}</b>
    </div>
  `;
}

function keepConfigurationOnlyResetProgress(){
  const keep = {
    cages: data.cages || [],
    content: data.content || [],
    games: data.games || [],
    rouletteEntries: data.roulette?.entries || [],
    taskTags: data.taskTags || [],
    outfitTags: data.outfitTags || []
  };

  const contract = data.contract;
  const contractStats = data.contractStats;

  data.points = 0;
  data.lifetimePoints = 0;
  data.upgrades = {};
  data.punishmentBar = 0;
  data.activePunishments = [];
  data.punishmentCostMultiplier = 1;
  data.punishmentBurdenMult = 1;
  data.theEndCostBonus = 0;
  data.theEndUnlocked = false;
  data.lastSeenDate = localDateString();
  data.rsbdYears = {};
  data.forceRSBDToday = false;
  data.adjudicatedDates = {};
  data.lastRollDate = null;
  data.rewardGrantedDate = null;
  data.todayResults = null;
  data.rewardPath = {current:null, progress:0, recent:[], sinceHeels:[], claimedHistory:[]};
  data.rewardEffects = [];
  data.currentStreak = 0;
  data.longestStreak = 0;
  data.streakClaims = {};
  data._contractCompletedTaskIds = [];

  data.chastityProbability = 60;
  data.roulette = {base:1, cumTax:0, entries:keep.rouletteEntries};

  data.cages = keep.cages;
  data.content = keep.content;
  data.games = keep.games;
  data.taskTags = keep.taskTags;
  data.outfitTags = keep.outfitTags;

  data.contract = contract;
  data.contractStats = contractStats;

  if(typeof ensureSystemsData === "function") ensureSystemsData();
  if(typeof ensureV15Data === "function") ensureV15Data();
  if(typeof ensureRSBDYear === "function") ensureRSBDYear(new Date().getFullYear());
}

function signContract(){
  ensureV20Data();
  if(data.contract.signed) return;

  const input = document.getElementById("contractNameInput");
  const name = (input?.value || "").trim();
  if(!name) return alert("Enter a name before signing.");

  const warning = [
    "Signing the contract will:",
    "",
    "• Reset all progress",
    "• Keep your configured tasks, outfits, cages, content, and roulette entries",
    "• Generate a new RSBD calendar",
    "• Disable Dev Tools for this run",
    "• Begin the real challenge",
    "",
    "This action cannot be undone."
  ].join("\n");

  if(!confirm(warning)) return;

  data.contract = {
    signed:true,
    name,
    signedDate:localDateString(),
    completedDate:null,
    fulfilled:false
  };
  data.contractStats = {
    totalRolls:0,
    totalTasksGenerated:0,
    totalTasksCompleted:0,
    totalPointsEarned:0,
    totalPointsSpent:0,
    totalRewardsCompleted:0,
    totalPunishmentsReceived:0
  };

  keepConfigurationOnlyResetProgress();
  save();
  render();

  alert("Contract signed. The challenge has begun.");
}
window.signContract = signContract;

function renderCertificate(){
  ensureV20Data();
  const name = esc(data.contract.name || "[NAME]");
  const signed = esc(data.contract.signedDate || "[START DATE]");
  const completed = esc(data.contract.completedDate || "[END DATE]");
  const s = data.contractStats || {};
  return `
    <h3>CERTIFICATE OF COMPLETION</h3>
    <p>This certifies that</p>
    <h2>${name}</h2>
    <p>has successfully fulfilled the terms of the Sissy Random Contract.</p>
    <div class="certificate-grid">
      <span>Contract Signed</span><b>${signed}</b>
      <span>Contract Completed</span><b>${completed}</b>
      <span>Days To Freedom</span><b>${contractDaysToFreedom().toLocaleString()}</b>
      <span>Total Rolls</span><b>${Number(s.totalRolls||0).toLocaleString()}</b>
      <span>Total Tasks Generated</span><b>${Number(s.totalTasksGenerated||0).toLocaleString()}</b>
      <span>Total Tasks Completed</span><b>${Number(s.totalTasksCompleted||0).toLocaleString()}</b>
      <span>Total Points Earned</span><b>${Number(s.totalPointsEarned||0).toLocaleString()}</b>
      <span>Total Points Spent</span><b>${Number(s.totalPointsSpent||0).toLocaleString()}</b>
      <span>Rewards Completed</span><b>${Number(s.totalRewardsCompleted||0).toLocaleString()}</b>
      <span>Punishments Received</span><b>${Number(s.totalPunishmentsReceived||0).toLocaleString()}</b>
      <span>Highest Streak</span><b>${Number(data.longestStreak||0).toLocaleString()}</b>
    </div>
    <p>After completing the challenge and unlocking:</p>
    <h3>THE END?</h3>
    <p>the system has no further tasks to assign.</p>
    <h3>The contract is fulfilled.</h3>
    <p><b>${name}</b> is free.</p>
  `;
}

function renderContract(){
  ensureV20Data();

  const statusEl = document.getElementById("contractStatusText");
  const unsignedBox = document.getElementById("contractUnsignedBox");
  const activeBox = document.getElementById("contractActiveBox");
  const certBox = document.getElementById("certificateBox");
  const preview = document.getElementById("contractTextPreview");
  const signedText = document.getElementById("signedContractText");
  const statsBox = document.getElementById("contractStatsBox");
  const certText = document.getElementById("certificateText");

  if(statusEl) statusEl.textContent = contractStatus();

  const unsigned = !data.contract.signed;
  if(unsignedBox) unsignedBox.classList.toggle("hidden", !unsigned);
  if(activeBox) activeBox.classList.toggle("hidden", unsigned);
  if(certBox) certBox.classList.toggle("hidden", !data.contract.fulfilled);

  if(preview){
    const input = document.getElementById("contractNameInput");
    const name = input?.value?.trim() || "[NAME]";
    preview.innerHTML = renderContractText(name, localDateString());
    if(input && !input.dataset.boundContractPreview){
      input.dataset.boundContractPreview = "1";
      input.addEventListener("input", renderContract);
    }
  }

  if(signedText && data.contract.signed){
    signedText.innerHTML = renderContractText(data.contract.name, data.contract.signedDate);
  }

  if(statsBox){
    const s = data.contractStats || {};
    statsBox.innerHTML = `
      <div><span>Days Since Signing</span><b>${contractDaysToFreedom().toLocaleString()}</b></div>
      <div><span>Total Rolls</span><b>${Number(s.totalRolls||0).toLocaleString()}</b></div>
      <div><span>Total Tasks Generated</span><b>${Number(s.totalTasksGenerated||0).toLocaleString()}</b></div>
      <div><span>Total Tasks Completed</span><b>${Number(s.totalTasksCompleted||0).toLocaleString()}</b></div>
      <div><span>Total Points Earned</span><b>${Number(s.totalPointsEarned||0).toLocaleString()}</b></div>
      <div><span>Total Points Spent</span><b>${Number(s.totalPointsSpent||0).toLocaleString()}</b></div>
      <div><span>Rewards Completed</span><b>${Number(s.totalRewardsCompleted||0).toLocaleString()}</b></div>
      <div><span>Punishments Received</span><b>${Number(s.totalPunishmentsReceived||0).toLocaleString()}</b></div>
      <div><span>Highest Streak</span><b>${Number(data.longestStreak||0).toLocaleString()}</b></div>
    `;
  }

  if(certText && data.contract.fulfilled){
    certText.innerHTML = renderCertificate();
  }

  const signBtn = document.getElementById("signContractBtn");
  if(signBtn) signBtn.onclick = signContract;

  // Dev tools removed after signing.
  const devPanel = document.getElementById("devPanel");
  const devToggle = document.getElementById("devToggle");
  if(data.contract.signed){
    if(devPanel) devPanel.remove();
    if(devToggle) devToggle.remove();
  }
}

/* Contract stats wrappers */
function v20TrackRollStats(){
  if(!data.contract?.signed || data.contract?.fulfilled || !data.todayResults) return;
  data.contractStats.totalRolls += 1;
  data.contractStats.totalTasksGenerated += (data.todayResults.tasks || []).length;
}

function v20TrackPointsEarned(amount){
  if(data.contract?.signed && !data.contract?.fulfilled){
    data.contractStats.totalPointsEarned += Math.max(0, Number(amount)||0);
  }
}

function v20TrackPointsSpent(amount){
  if(data.contract?.signed && !data.contract?.fulfilled){
    data.contractStats.totalPointsSpent += Math.max(0, Number(amount)||0);
  }
}

function v20TrackTaskCompleted(taskId){
  if(!data.contract?.signed || data.contract?.fulfilled) return;
  data._contractCompletedTaskIds ??= [];
  if(taskId && !data._contractCompletedTaskIds.includes(taskId)){
    data._contractCompletedTaskIds.push(taskId);
    data.contractStats.totalTasksCompleted += 1;
  }
}

// Wrap core roll after V19.4 handler exists.
if(typeof v194RunCoreRoll === "function"){
  const oldV194RunCoreRollV20 = v194RunCoreRoll;
  v194RunCoreRoll = function(){
    const beforeDate = data.lastRollDate;
    const ok = oldV194RunCoreRollV20();
    if(ok && data.lastRollDate !== beforeDate) v20TrackRollStats();
    save();
    return ok;
  };
}

// Wrap task completion to track completed tasks and points from completed days.
const oldToggleTodayTaskV20 = window.toggleTodayTask;
window.toggleTodayTask = function(taskId, checked){
  const beforePoints = Number(data.points || 0);
  if(checked) v20TrackTaskCompleted(taskId);
  oldToggleTodayTaskV20(taskId, checked);
  const gained = Number(data.points || 0) - beforePoints;
  if(gained > 0) v20TrackPointsEarned(gained);
  save();
};

// Wrap rewards completed.
if(typeof applyRewardPreset === "function"){
  const oldApplyRewardPresetV20 = applyRewardPreset;
  applyRewardPreset = function(id){
    oldApplyRewardPresetV20(id);
    if(data.contract?.signed && !data.contract?.fulfilled){
      data.contractStats.totalRewardsCompleted += 1;
    }
  };
}

// Wrap punishments received.
if(typeof v18RollOnePunishmentAnimated === "function"){
  const oldV18RollOnePunishmentAnimatedV20 = v18RollOnePunishmentAnimated;
  v18RollOnePunishmentAnimated = async function(){
    const result = await oldV18RollOnePunishmentAnimatedV20();
    if(data.contract?.signed && !data.contract?.fulfilled){
      data.contractStats.totalPunishmentsReceived += 1;
      save();
    }
    return result;
  };
}

// Wrap upgrade spending.
if(typeof buyUpgrade === "function"){
  const oldBuyUpgradeV20 = buyUpgrade;
  buyUpgrade = function(id){
    const before = Number(data.points || 0);
    oldBuyUpgradeV20(id);
    const spent = before - Number(data.points || 0);
    if(spent > 0) v20TrackPointsSpent(spent);
    save();
  };
  window.buyUpgrade = buyUpgrade;
}

// Wrap The End purchase to complete contract and certificate.
if(typeof buyTheEnd === "function"){
  const oldBuyTheEndV20 = buyTheEnd;
  buyTheEnd = function(){
    const beforeUnlocked = !!data.theEndUnlocked;
    const before = Number(data.points || 0);
    oldBuyTheEndV20();
    const spent = before - Number(data.points || 0);
    if(spent > 0) v20TrackPointsSpent(spent);

    if(!beforeUnlocked && data.theEndUnlocked && data.contract?.signed){
      data.contract.fulfilled = true;
      data.contract.completedDate = localDateString();
      alert("The End? unlocked. The contract is fulfilled.");
    }
    save();
    render();
  };
  window.buyTheEnd = buyTheEnd;
}

const oldRenderV20 = render;
render = function(){
  oldRenderV20();
  renderContract();
};

ensureV20Data();
save();
render();


/* =========================
   V21 Engagement Redesign
========================= */
function ensureV21Data(){
  data.pointPenaltyDebt ??= 0;
  data.lastTaskSetId ??= null;
  data.currentTaskSetRewarded ??= false;
  data.rollMoreCountToday ??= 0;
  data.rouletteRewardUsedDate ??= null;
  data.rouletteRewardPending ??= null;
}
function v21NewTaskSet(tasks){
  ensureV21Data();
  data.lastTaskSetId = uid();
  data.currentTaskSetRewarded = false;
  return (tasks || []).map(t => ({...t, setId:data.lastTaskSetId, rewardCounted:false}));
}
function v21AllCurrentTasksComplete(){
  const tasks = data.todayResults?.tasks || [];
  return tasks.length > 0 && tasks.every(t=>t.complete);
}
function v21ApplyPointPenalty(basePoints, taskCount){
  let total=0, debt=Number(data.pointPenaltyDebt||0), per=taskCount?basePoints/taskCount:0;
  for(let i=0;i<taskCount;i++){ if(debt>0){ total += per*.75; debt--; } else total += per; }
  data.pointPenaltyDebt=Math.max(0,debt);
  return Math.round(total);
}
function calculateTaskPoints(tasks){
  const raw=tasks.reduce((s,t)=>s+Number(t.pointsBase??75),0);
  const base=v21ApplyPointPenalty(raw,tasks.length);
  return Math.round(base*(1+(upgradeLevel('pointMultiplier')*.015))*combinedEffectMult('pointGainMult',1));
}
function v21RouletteRewardAmount(entry){ return Math.round(10000/Math.max(1,Number(entry?.weight)||1)); }
function v21RollTaskSet(){ return v21NewTaskSet(rollTasks()); }

function v194RunCoreRoll(){
  ensureV21Data();
  const t=typeof localDateString==='function'?localDateString():today();
  if(data.theEndUnlocked) return false;
  if(data.lastRollDate===t){ alert("Today's Roll All has already been used."); return false; }
  if(typeof adjudicatePreviousRolledDayIfNeeded==='function') adjudicatePreviousRolledDayIfNeeded();
  const rsbd=typeof isRSBD==='function'?isRSBD(t):false;
  const results={date:t,rsbd};
  const chastityChance=(typeof rewardEffect==='function'&&rewardEffect('chastityZero'))?0:data.chastityProbability;
  const chastityYes=rsbd?true:chance(chastityChance);
  results.chastity={result:chastityYes?'YES':'NO',cage:null};
  if(chastityYes){ const cage=weightedRoll(data.cages); results.chastity.cage=cage?cage.name:'No cage configured'; }
  else data.chastityProbability += typeof chastityIncreaseAmount==='function'?chastityIncreaseAmount():1;
  const contentRolls=((typeof rewardEffect==='function'&&rewardEffect('contentDoubleGuaranteed'))||chance(typeof upgradeLevel==='function'?upgradeLevel('contentDouble'):0))?2:1;
  const cr=[]; for(let i=0;i<contentRolls;i++){ const c=weightedRoll(data.content); cr.push(c?c.name:'No content configured'); }
  results.content=cr.join(' + '); results.game='';
  results.tasks=rsbd&&typeof rsbdFillExactlySevenTasks==='function'?v21NewTaskSet(rsbdFillExactlySevenTasks()):v21RollTaskSet();
  results.outfits=typeof rollOutfits==='function'?rollOutfits(rsbd):[];
  results.roulette={triggered:false,optional:true};
  data.lastRollDate=t; data.lastSeenDate=t; data.rewardGrantedDate=null; data.rollMoreCountToday=0; data.rouletteRewardUsedDate=null; data.rouletteRewardPending=null; data.todayResults=results;
  if(data.contract?.signed&&!data.contract?.fulfilled){ data.contractStats.totalRolls+=1; data.contractStats.totalTasksGenerated+=(results.tasks||[]).length; }
  save(); render(); return true;
}
function v21RollMoreTasks(){
  ensureV21Data();
  if(!data.todayResults||data.lastRollDate!==localDateString()) return alert('Roll All first.');
  if(!v21AllCurrentTasksComplete()) return alert('Complete the current task set before rolling more tasks.');
  const tasks=v21RollTaskSet();
  data.todayResults.tasks=tasks; data.rollMoreCountToday=Number(data.rollMoreCountToday||0)+1; data.currentTaskSetRewarded=false;
  if(data.contract?.signed&&!data.contract?.fulfilled) data.contractStats.totalTasksGenerated += tasks.length;
  save(); render(); if(typeof playRollAnimation==='function') setTimeout(playRollAnimation,120);
}
window.v21RollMoreTasks=v21RollMoreTasks;
function v21RollRouletteReward(){
  ensureV21Data();
  if(!data.todayResults||data.lastRollDate!==localDateString()) return alert('Roll All first.');
  if(!v21AllCurrentTasksComplete()) return alert('Complete the current task set before rolling roulette.');
  if(data.rouletteRewardUsedDate===localDateString()) return alert('Roulette reward has already been used today.');
  if(!data.roulette.entries.length) return alert('No roulette entries configured.');
  const picked=weightedRoll(data.roulette.entries); if(!picked) return alert('No valid roulette entry configured.');
  const reward=v21RouletteRewardAmount(picked);
  data.rouletteRewardUsedDate=localDateString(); data.rouletteRewardPending={id:uid(),name:picked.name,url:picked.url,weight:Number(picked.weight)||1,reward,complete:false};
  try{ const w=window.open('about:blank','_blank'); if(w) w.location.href=picked.url; else window.open(picked.url,'_blank'); }catch(e){ window.open(picked.url,'_blank'); }
  save(); render();
}
window.v21RollRouletteReward=v21RollRouletteReward;
function v21CompleteRouletteReward(){
  ensureV21Data(); const r=data.rouletteRewardPending; if(!r||r.complete) return;
  r.complete=true; data.points+=Number(r.reward)||0; data.lifetimePoints+=Math.max(0,Number(r.reward)||0);
  if(data.contract?.signed&&!data.contract?.fulfilled) data.contractStats.totalPointsEarned+=Math.max(0,Number(r.reward)||0);
  save(); render(); alert(`Roulette completed. You earned ${Number(r.reward||0).toLocaleString()} points.`);
}
window.v21CompleteRouletteReward=v21CompleteRouletteReward;
window.toggleTodayTask=(taskId,checked)=>{
  ensureV21Data();
  const tasks=data.todayResults?.tasks||[]; const task=tasks.find(x=>x.id===taskId);
  if(task){ const was=!!task.complete; task.complete=checked; if(checked&&!was&&data.contract?.signed&&!data.contract?.fulfilled){ data._contractCompletedTaskIds??=[]; if(!data._contractCompletedTaskIds.includes(taskId)){ data._contractCompletedTaskIds.push(taskId); data.contractStats.totalTasksCompleted+=1; } } }
  const allDone=tasks.length&&tasks.every(x=>x.complete); const t=localDateString();
  if(allDone&&!data.currentTaskSetRewarded){
    if(data.todayResults?.rsbd){ data.currentTaskSetRewarded=true; increaseStreakAndAward(); consumeCompletedDayRewardEffects(); alert('RSBD task set complete. No points and no reward progress are gained today.'); }
    else { let earned=calculateTaskPoints(tasks); earned=Math.round(earned*consumeTaskRewardMultiplier(tasks.length)); data.points+=earned; data.lifetimePoints+=Math.max(0,earned); if(data.contract?.signed&&!data.contract?.fulfilled) data.contractStats.totalPointsEarned+=Math.max(0,earned); if(!activeEffect('rewardFrozen')) advanceRewardPathProgress(); if(data.rewardGrantedDate!==t){ increaseStreakAndAward(); consumeCompletedDayRewardEffects(); data.rewardGrantedDate=t; } data.currentTaskSetRewarded=true; alert(`Task set complete. You earned ${earned} points. Reward progress increased by 1.`); }
  }
  save(); render();
};
function v21NextRSBDInfo(){
  if(typeof ensureRSBDYear!=='function') return null;
  const ts=localDateString(), td=parseLocalDate(ts), years=[td.getFullYear(),td.getFullYear()+1];
  let c=[]; years.forEach(y=>c.push(...(ensureRSBDYear(y)||[]))); c=c.sort();
  const next=c.find(d=>parseLocalDate(d)>=td); if(!next) return null;
  return {date:next, days:Math.floor((parseLocalDate(next)-td)/86400000)};
}
function v21PrettyDate(s){ return parseLocalDate(s).toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'}); }
function renderRSBDCountdown(){
  const card=document.getElementById('rsbdCountdownCard'); if(!card) return; const info=v21NextRSBDInfo();
  if(!info||info.days===0){ card.classList.add('hidden'); return; }
  let label=`✨ NEXT RSBD IN ${info.days} DAYS ✨`, level='far';
  if(info.days===1){ label='✨ RSBD TOMORROW ✨'; level='tomorrow'; } else if(info.days<=3){ label=`⚠ RSBD IN ${info.days} DAYS ⚠`; level='urgent'; } else if(info.days<=7) level='soon'; else if(info.days<=30) level='near';
  card.className=`rsbd-countdown-card ${level}`; card.innerHTML=`<div class="rsbd-count-main">${label}</div><div class="rsbd-count-date">${v21PrettyDate(info.date)}</div>`;
}
function renderV21Buttons(){
  ensureV21Data();
  const el=document.getElementById('results');
  if(el&&data.todayResults){
    const old=el.querySelector('.v21-extra-controls'); if(old) old.remove();
    const can=v21AllCurrentTasksComplete()&&data.lastRollDate===localDateString();
    const rouletteDone=data.rouletteRewardUsedDate===localDateString(); const pending=data.rouletteRewardPending&&!data.rouletteRewardPending.complete;
    const controls=document.createElement('div'); controls.className='v21-extra-controls'; controls.innerHTML=`
      <button onclick="v21RollMoreTasks()" ${can?'':'disabled'}>Roll More Tasks</button>
      <button onclick="v21RollRouletteReward()" ${can&&!rouletteDone?'':'disabled'}>Roll Roulette Reward</button>
      ${pending?`<button class="claim" onclick="v21CompleteRouletteReward()">Complete Roulette: +${Number(data.rouletteRewardPending.reward||0).toLocaleString()} points</button>`:''}
      ${data.rouletteRewardPending?.complete?`<div class="v21-roulette-done">Roulette reward completed: +${Number(data.rouletteRewardPending.reward||0).toLocaleString()} points</div>`:''}
      ${data.pointPenaltyDebt?`<div class="v21-penalty-note">Point penalty debt: next ${data.pointPenaltyDebt} completed task${data.pointPenaltyDebt===1?'':'s'} worth 75%.</div>`:''}`;
    el.appendChild(controls);
  }
  renderRSBDCountdown();
}
function renderRoulette(){
  rouletteBase.textContent='Optional'; rouletteTax.textContent='Reward'; rouletteEffective.textContent='10000 / Weight';
  rouletteList.innerHTML=data.roulette.entries.map(item=>`<div class="item"><div><b>${esc(item.name)}</b><div class="muted">${esc(item.url)}</div><div class="muted">Weight: ${esc(item.weight)} · Reward: ${v21RouletteRewardAmount(item).toLocaleString()} points</div></div><div class="item-actions"><input type="number" min="1" value="${esc(item.weight)}" onchange="updateRoulette('${item.id}','weight',this.value)"><button class="delete" onclick="deleteRoulette('${item.id}')">Delete</button></div></div>`).join('')||`<div class="muted">No roulette entries yet.</div>`;
}
const oldRenderV21=render; render=function(){ oldRenderV21(); renderV21Buttons(); };
ensureV21Data(); save(); render();
