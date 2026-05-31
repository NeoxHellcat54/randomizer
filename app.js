
const DEFAULTS={
chastityProbability:60,
reward:{name:"",target:0,progress:0},
lastRollDate:null
};

function load(){
 return {...DEFAULTS,...JSON.parse(localStorage.getItem("sr_v1")||"{}")};
}
function save(d){localStorage.setItem("sr_v1",JSON.stringify(d));}

let data=load();

function updateUI(){
 document.getElementById("chastityProb").textContent=data.chastityProbability;
 document.getElementById("rewardName").textContent=data.reward.name||"No Reward Selected";
 document.getElementById("rewardBar").max=Math.max(data.reward.target,1);
 document.getElementById("rewardBar").value=data.reward.progress;
 document.getElementById("rewardProgress").textContent=`${data.reward.progress} / ${data.reward.target}`;
}

document.querySelectorAll(".tab").forEach(btn=>{
 btn.onclick=()=>{
  document.querySelectorAll(".panel").forEach(p=>p.classList.add("hidden"));
  document.getElementById(btn.dataset.tab).classList.remove("hidden");
 };
});

document.getElementById("rollAllBtn").onclick=()=>{
 const today=new Date().toISOString().slice(0,10);
 if(data.lastRollDate===today){
   alert("Today's roll already used.");
   return;
 }
 data.lastRollDate=today;

 const chastity=Math.random()*100 < data.chastityProbability ? "YES":"NO";
 if(chastity==="NO") data.chastityProbability++;

 document.getElementById("results").innerHTML=`
 <h3>Today's Results</h3>
 <p>Chastity: ${chastity}</p>
 <p>(Placeholder for Content/Game/Tasks/Outfits/Roulette)</p>`;

 save(data);
 updateUI();
};

updateUI();

if("serviceWorker" in navigator){
 navigator.serviceWorker.register("./service-worker.js");
}
