const $=id=>document.getElementById(id), main=$("main"), nav=$("nav");
let sub=null;                 // Timofey's answers file
let review=null;              // {items:{id:{score,comment}}, general}
let current="Vocabulary";
const DRAFT="timofey-review.";

function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
function button(text,fn,cls){const b=el("button","btn"+(cls?" "+cls:""),text);b.type="button";b.onclick=fn;return b;}
function toast(s){const t=$("toast");t.textContent=s;t.classList.remove("hidden");clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.add("hidden"),6000);}
function pickFile(fn){const i=$("fileInput");i.value="";i.onchange=()=>fn(i.files[0]);i.click();}
function ans(t){return sub&&typeof sub.answers[t.id]==="string"?sub.answers[t.id]:"";}

function suggested(t){
  const r=checkAnswer(t.id,ans(t));
  return r===null?null:(r?t.max:0);
}
function startReview(s){
  sub=s;review={items:{},general:""};
  let saved=null;try{saved=JSON.parse(localStorage.getItem(DRAFT+s.submissionId)||"null");}catch(e){}
  TASKS.forEach(t=>{
    const old=saved&&saved.items&&saved.items[t.id];
    const sg=suggested(t);
    review.items[t.id]={score:old?old.score:(sg===null?"":sg),comment:old?old.comment:"",manual:!!(old&&old.manual)};
  });
  if(saved&&typeof saved.general==="string")review.general=saved.general;
}
function saveDraft(){
  if(!sub)return;
  try{localStorage.setItem(DRAFT+sub.submissionId,JSON.stringify(review));}catch(e){}
  updateTotals();
}
function total(sec){
  return TASKS.filter(t=>!sec||t.section===sec).reduce((n,t)=>n+(Number(review.items[t.id].score)||0),0);
}
function maxOf(sec){return TASKS.filter(t=>!sec||t.section===sec).reduce((n,t)=>n+t.max,0);}
function emptyScores(){return TASKS.filter(t=>review.items[t.id].score===""||review.items[t.id].score===null).length;}

/* ---------- nav ---------- */
[...SECTIONS,"General"].forEach(p=>{
  const b=el("button");b.type="button";b.dataset.page=p;
  b.append(el("b","",p==="General"?"Итог":p),el("span","",""));
  b.onclick=()=>open(p);nav.append(b);
});
const tot=el("div","total");tot.id="navTotal";nav.append(tot);
function updateTotals(){
  if(!review){$("sum").textContent="";return;}
  $("sum").textContent=total()+" / "+maxOf();
  nav.querySelectorAll("button[data-page]").forEach(b=>{
    const s=b.dataset.page;b.lastChild.textContent=s==="General"?"":total(s)+"/"+maxOf(s);
  });
  $("navTotal").textContent=emptyScores()?"Без балла: "+emptyScores():"Все баллы стоят";
}
function open(page){
  current=page;
  nav.querySelectorAll("button[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  main.replaceChildren();
  $("tab").replaceChildren(el("b","","// "),document.createTextNode(page==="General"?"итог и файл для Тимофея":page.toLowerCase()));
  if(!sub)emptyPage();else if(page==="General")generalPage();else if(page==="Writing")writingPage();else listPage(page);
  updateTotals();
}

/* ---------- pages ---------- */
function emptyPage(){
  main.append(el("p","prompt","Откройте файл ответов, который прислал Тимофей (Timofey-Homework-….json)."));
  main.append(button("Открыть файл ответов",()=>pickFile(load),"primary"));
  main.append(el("p","muted","Проверка сохраняется в этом браузере как черновик: можно закрыть страницу и вернуться."));
}
function scoreInput(t){
  const it=review.items[t.id];
  const sc=el("input","sc");sc.type="number";sc.min=0;sc.max=t.max;sc.step=1;sc.value=it.score;
  sc.setAttribute("aria-label","Балл, максимум "+t.max);
  sc.oninput=()=>{
    let v=sc.value===""?"":Math.max(0,Math.min(t.max,Math.round(Number(sc.value))));
    it.score=v;it.manual=true;saveDraft();
  };
  sc.onchange=()=>{sc.value=it.score;};
  return sc;
}
function commentInput(t){
  const it=review.items[t.id];
  const cm=el("input","cm");cm.type="text";cm.maxLength=500;cm.placeholder="комментарий";cm.value=it.comment;
  cm.oninput=()=>{it.comment=cm.value;saveDraft();};return cm;
}
function listPage(sec){
  const tasks=TASKS.filter(t=>t.section===sec);
  const head=el("div","sumline");
  head.append(el("b","",total(sec)+" / "+maxOf(sec)));
  if(sec==="Speaking"){
    head.append(el("span","muted",sub.audioFile?"Аудио: "+sub.audioFile+" (он присылает отдельно)":"Имя аудиофайла в ответах не указано."));
  }else{
    const auto=tasks.filter(t=>t.type!=="long");
    const right=auto.filter(t=>checkAnswer(t.id,ans(t))).length;
    head.append(el("span","muted","Автопроверка по ключу: верно "+right+" из "+auto.length+". Баллы можно менять."));
  }
  const rows=el("div","rows");
  tasks.forEach((t,i)=>{
    const r=el("div","r"), q=el("div","q"), a=ans(t), res=checkAnswer(t.id,a);
    const qb=el("div");qb.append(el("b","",String(i+1).padStart(2,"0")+" "),document.createTextNode(t.prompt+(t.word?" ["+t.word+"]":"")));qb.lang="en";
    q.append(qb);
    const shown=t.id.startsWith("sp")?(a?"прослушано вопросов: "+a.split(",").length+" из 6 ("+a+")":"не слушал"):(a||"нет ответа");
    const ae=el("div","a "+(t.type==="long"?"":res?"ok":"no")+(a?"":" empty"),shown);ae.lang="en";q.append(ae);
    if(res===false)q.append(el("div","k","ключ: "+KEYS[t.id].split("|").join(" / ")));
    if(t.id.startsWith("sp")){
      const c=Number(t.id[2])-1, lst=el("div","k");lst.lang="en";
      lst.innerHTML="";SPEAKING[c].questions.forEach((x,k)=>{const d=el("div","",(k+1)+". "+x);lst.append(d);});
      q.append(lst);
    }
    r.append(q,scoreInput(t),commentInput(t));rows.append(r);
  });
  main.append(head,rows);
}
function writingPage(){
  const t=TASKS.find(t=>t.id==="email"), a=ans(t);
  const split=el("div","split"), left=el("div","col"), right=el("div","col");
  const n=wordsIn(a);
  const info=el("div","sumline");
  info.append(el("span","muted",n+" слов (нужно "+WORDS[0]+"–"+WORDS[1]+")"+(n>=WORDS[0]&&n<=WORDS[1]?" — объём подходит":n?" — объём не подходит":"")));
  const essay=el("div","essay",a||"нет ответа");essay.lang="en";
  left.append(info,essay);
  const lab=el("p","prompt","Балл за письмо");
  const row=el("div","row");row.append(scoreInput(t),el("span","muted","из "+t.max));row.firstChild.style.width="90px";
  const cm=el("textarea");cm.maxLength=500;cm.placeholder="комментарий";cm.style.flex="1";cm.style.minHeight="0";
  cm.value=review.items[t.id].comment;cm.oninput=()=>{review.items[t.id].comment=cm.value;saveDraft();};
  const crit=el("p","muted","Подсказка: содержание, организация текста, лексика, грамматика, орфография и пунктуация.");
  right.append(lab,row,cm,crit);split.append(left,right);main.append(split);
}
function generalPage(){
  const missing=emptyScores();
  const head=el("div","sumline");head.append(el("b","",total()+" / "+maxOf()+" баллов"));
  if(missing)head.append(el("span","muted","Без балла осталось: "+missing+" (в файле они будут считаться нулём)"));
  const gt=el("textarea");gt.maxLength=2000;gt.placeholder="Общий комментарий для Тимофея";gt.style.flex="1";gt.style.minHeight="0";
  gt.value=review.general;gt.oninput=()=>{review.general=gt.value;saveDraft();};
  const row=el("div","row");
  row.append(button("Скачать файл проверки для Тимофея",exportReview,"primary"),button("Открыть другой файл ответов",()=>pickFile(load)));
  main.append(head,gt,row,el("p","muted","Тимофей откроет скачанный файл на своей странице в разделе «Проверка». Сайт файл сам не отправляет — перешлите его в вашем чате."));
}

/* ---------- files ---------- */
async function load(file){
  try{
    if(!file)throw Error("Выберите файл.");
    if(file.size>2000000)throw Error("Файл слишком большой.");
    const s=JSON.parse(await file.text());
    if(s.app!=="timofey-homework"||s.schema!==1||s.quest!==QUEST||typeof s.submissionId!=="string"||!s.answers||typeof s.answers!=="object"||Array.isArray(s.answers))
      throw Error("Это не файл ответов Тимофея.");
    if(!Object.entries(s.answers).every(([id,v])=>TASKS.some(t=>t.id===id)&&typeof v==="string"))
      throw Error("В файле есть неизвестные ответы.");
    startReview(s);
    $("who").textContent=(s.student||"Ученик")+" · "+s.submissionId+" · заполнено "+s.completed+"/"+s.total;
    open("Vocabulary");toast("Файл открыт.");
  }catch(e){toast(e instanceof SyntaxError?"Файл повреждён или это не .json.":e.message||"Не удалось открыть файл.");}
}
function exportReview(){
  const out={app:"timofey-feedback",schema:1,quest:QUEST,submissionId:sub.submissionId,reviewedAt:new Date().toISOString(),
    items:TASKS.map(t=>({id:t.id,score:Math.max(0,Math.min(t.max,Number(review.items[t.id].score)||0)),comment:review.items[t.id].comment||""})),
    general:review.general||""};
  const url=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:"application/json"}));
  const a=el("a");a.href=url;a.download="Timofey-Feedback-"+sub.submissionId+".json";document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
  toast("Файл проверки скачан. Перешлите его Тимофею.");
}
open("Vocabulary");

document.title="Timofey — Проверка · "+TITLE;$("hdr").textContent="teacher / "+TITLE;
