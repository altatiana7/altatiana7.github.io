"use strict";
/* ОГЭ practice: задания из открытого банка ФИПИ (материалы Татьяны). Проверка по ключам, прогресс в localStorage. */
const KEY="timofey-oge.v2";
let S={res:{},audio:[]};
let storageOK=true;
try{const s=JSON.parse(localStorage.getItem(KEY)||"null");if(s&&s.res&&typeof s.res==="object")S=Object.assign(S,s);}catch(e){storageOK=false;}

const $=id=>document.getElementById(id), main=$("main"), nav=$("nav");
let tick=null, speakToken=0, media=null, stream=null, chunks=[], recordURL=null, view={page:null,item:null};
const RING=2*Math.PI*46;

function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
function button(text,fn,cls){const b=el("button","btn"+(cls?" "+cls:""),text);b.type="button";b.onclick=fn;return b;}
function toast(s){const t=$("toast");t.textContent=s;t.classList.remove("hidden");clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.add("hidden"),6000);}
function stopAll(){speakToken++;if(window.speechSynthesis)speechSynthesis.cancel();clearInterval(tick);tick=null;}

/* ---------- pages ---------- */
const PAGES=[
  {id:"tf",grp:"Reading",label:"True/False/NS",data:OGE.TF,kind:"tf"},
  {id:"mt",grp:"Reading",label:"Matching",data:OGE.MATCH,kind:"mt"},
  {id:"gr",grp:"Grammar",label:"Задания 20–28",data:OGE.GR,kind:"gap"},
  {id:"wf",grp:"Word formation",label:"Задания 29–34",data:OGE.WF,kind:"gap"},
  {id:"s1",grp:"Speaking",label:"1 · Чтение вслух",data:OGE.SP1,kind:"s1"},
  {id:"s2",grp:"Speaking",label:"2 · Интервью",data:OGE.SP2,kind:"s2"},
  {id:"s3",grp:"Speaking",label:"3 · Монолог",data:OGE.SP3,kind:"s3"},
  {id:"lis",grp:"Listening",label:"скоро",soon:"Здесь будет аудирование. Для него нужны аудиозаписи, их ещё нет."},
  {id:"wr",grp:"Writing",label:"скоро",soon:"Здесь будет письмо. Материалов по нему пока нет."}
];
const ALIAS={reading:"tf",grammar:"gr","word formation":"wf",vocabulary:"wf",speaking:"s2",listening:"lis",writing:"wr"};
const byId=id=>PAGES.find(p=>p.id===id);
const rk=(p,it)=>p.id+":"+it.n;
const rec=(p,it)=>S.res[rk(p,it)]||(S.res[rk(p,it)]={a:[]});
function size(p,it){return p.kind==="tf"?it.stmts.length:p.kind==="mt"?it.texts.length:p.kind==="gap"?it.items.length:p.kind==="s2"?it.qa.length:1;}
const nz=s=>String(s).toLowerCase().replace(/[’`]/g,"'").replace(/\bcan't\b/g,"cannot").replace(/\bwon't\b/g,"will not")
  .replace(/n't\b/g," not").replace(/'m\b/g," am").replace(/'re\b/g," are").replace(/'ve\b/g," have").replace(/'ll\b/g," will").replace(/[^a-z]/g,"");
function okAt(p,it,i,v){
  if(v==null||v==="")return false;
  if(p.kind==="tf")return v===it.key[i];
  if(p.kind==="mt")return v===it.key[i];
  return it.items[i].k.some(k=>nz(k)===nz(v));
}
function isStepper(p){return p.kind==="tf"||p.kind==="mt"||p.kind==="gap";}
function answered(p,it){const r=S.res[rk(p,it)];return r?r.a.filter(v=>v!=null&&v!=="").length:0;}
function itemDone(p,it){
  if(isStepper(p))return answered(p,it)>=size(p,it);
  const r=S.res[rk(p,it)];if(!r)return false;
  if(p.kind==="s2")return (r.a||[]).filter(Boolean).length>=size(p,it);
  return !!r.done;
}
function itemScore(p,it){const r=S.res[rk(p,it)];if(!r)return 0;let n=0;for(let i=0;i<size(p,it);i++)if(okAt(p,it,i,r.a[i]))n++;return n;}
function save(){
  try{localStorage.setItem(KEY,JSON.stringify(S));storageOK=true;}catch(e){storageOK=false;}
  $("saveStatus").textContent=storageOK?"Прогресс сохраняется на этом устройстве":"Сохранение недоступно: скачай файл результатов";
  prog();
}
function prog(){
  let d=0;PAGES.forEach(p=>{if(p.data)d+=p.data.filter(it=>itemDone(p,it)).length;});
  $("progress").textContent=d+" выполнено";
  nav.querySelectorAll("button[data-page]").forEach(b=>{
    const p=byId(b.dataset.page);if(p&&p.data)b.lastChild.textContent=p.data.filter(it=>itemDone(p,it)).length+"/"+p.data.length;
  });
}

/* ---------- navigation ---------- */
let lastGrp=null;
PAGES.forEach(p=>{
  if(p.grp!==lastGrp){nav.append(el("div","grp",p.grp));lastGrp=p.grp;}
  const b=el("button",p.soon?"soon":"");b.type="button";b.dataset.page=p.id;
  b.append(el("b","",p.label),el("span","",p.data?"":""));
  b.onclick=()=>open(p.id);nav.append(b);
});
nav.append(el("hr"));
{const b=el("button");b.type="button";b.dataset.page="results";b.append(el("b","","Результаты"),el("span",""));b.onclick=()=>open("results");nav.append(b);}

function open(id,n){
  if(media&&media.state==="recording"){toast("Сначала останови запись.");return;}
  stopAll();view={page:id,item:n==null?null:n};
  nav.querySelectorAll("button").forEach(b=>b.classList.toggle("active",b.dataset.page===id));
  main.replaceChildren();
  try{history.replaceState(null,"","#"+id+(n==null?"":"/"+n));}catch(e){}
  const p=byId(id), i=PAGES.indexOf(p);
  if(id==="results"){$("tab").replaceChildren(el("b","","// "),document.createTextNode("результаты"));resultsPage();prog();return;}
  const sub=n==null?(p.soon?"скоро":"выбери задание"):(p.data.find(x=>x.n===n)||{}).title||"";
  $("tab").replaceChildren(el("b","","// "),document.createTextNode(p.grp.toLowerCase()+" · "+p.label+(p.soon?"":" — "+sub)));
  if(p.soon){main.append(el("div","box",p.soon));prog();return;}
  if(n==null)listPage(p);else{
    const it=p.data.find(x=>x.n===n);
    if(p.kind==="s1")s1Page(p,it);else if(p.kind==="s2")s2Page(p,it);else if(p.kind==="s3")s3Page(p,it);else stepperPage(p,it);
  }
  prog();
}

/* ---------- list ---------- */
function listPage(p){
  const box=el("div","list");let cards=null,lastTopic=null;
  p.data.forEach(it=>{
    if(it.topic!==undefined&&it.topic!==lastTopic){box.append(el("h4","",it.topic));cards=null;lastTopic=it.topic;}
    if(!cards){cards=el("div","cards");box.append(cards);}
    const a=answered(p,it),d=itemDone(p,it);
    const b=el("button","itm"+(d?" done":a?" part":""));b.type="button";b.title=it.title;
    b.append(el("i","",String(it.n).padStart(2,"0")),el("span","",it.title));
    if(isStepper(p)&&(d||a))b.append(el("em","",d?itemScore(p,it)+"/"+size(p,it):a+"…"));
    else if(d)b.append(el("em","","✓"));
    b.onclick=()=>open(p.id,it.n);cards.append(b);
  });
  if(!p.data.some(it=>it.topic!==undefined)){}
  main.append(box);
}
function head(p,it,extra){
  const h=el("div","ihead");
  h.append(button("← Список",()=>open(p.id)),el("span","ttl",String(it.n).padStart(2,"0")+" · "+it.title));
  if(extra)h.append(extra);
  main.append(h);return h;
}

/* ---------- steppers: True/False/NS, matching, gaps ---------- */
const TFN=["True","False","Not stated"];
function stepperPage(p,it){
  const r=rec(p,it),N=size(p,it);
  let i=Math.max(0,r.a.slice(0,N).findIndex(v=>v==null||v===""));
  if(answered(p,it)>=N)i=N; // summary
  const sc=el("span","sc");head(p,it,sc);
  const split=el("div","split"),left=el("div","col"),right=el("div","col");
  const src=el("div","source scroll");src.lang="en";src.style.flex="1";
  const strip=el("div","strip"),q=el("div","q"),foot=el("div","foot");
  const qbox=el("div","qlist scroll");qbox.lang="en";
  if(p.kind==="mt"){src.classList.add("mini");left.append(qbox);right.append(strip,src,q,foot);q.style.flex="0 0 auto";split.style.gridTemplateColumns="minmax(0,1fr) minmax(0,1fr)";}
  else{left.append(src);right.append(strip,q,foot);}
  split.append(left,right);main.append(split);
  const label=k=>p.kind==="mt"?"ABCDEF"[k]:p.kind==="tf"?String(13+k):String(k+1);
  function check(v){r.a[i]=v;save();draw();}
  function drawSource(){
    src.replaceChildren();src.scrollTop=0;
    if(p.kind==="tf")src.textContent=it.paras.join("\n\n");
    else if(p.kind==="mt"){
      const k=Math.min(i,N-1);src.append(document.createTextNode(it.texts[k]));
    }else{
      it.text.split(/‹(\d+)›/).forEach((part,j)=>{
        if(j%2===0){src.append(document.createTextNode(part));return;}
        const k=Number(part)-1,v=r.a[k],g=el("span","g");
        if(v!=null&&v!==""){
          if(okAt(p,it,k,v)){g.className="g ok";g.textContent=v.trim();}
          else{g.className="g no";g.textContent=v.trim();src.append(g);src.append(" ",el("span","fix",it.items[k].d));return;}
        }else{g.textContent="("+(k+1)+")";if(k===i)g.className="g cur";}
        g.id="g"+k;src.append(g);
      });
      const cur=src.querySelector(".g.cur");if(cur)cur.scrollIntoView({block:"center"});
    }
  }
  function drawQ(){
    if(p.kind!=="mt")return;
    const used=new Set();for(let k=0;k<N;k++)if(okAt(p,it,k,r.a[k]))used.add(r.a[k]);
    const v=r.a[i];
    qbox.replaceChildren(...it.qs.map((t,k)=>{
      const d=el("div","qr"+(used.has(k+1)?" used":"")+(v!=null&&v!==""&&(k+1===v)?(okAt(p,it,i,v)?" pick":" wrongpick"):""));
      d.append(el("b","",(k+1)+"."),document.createTextNode(" "+t));return d;}));
  }
  function draw(){
    stopAll();
    const done=answered(p,it)>=N;
    let s=itemScore(p,it);sc.textContent=answered(p,it)?s+" / "+N:"";
    strip.replaceChildren(...Array.from({length:N},(_,k)=>{
      const v=r.a[k],has=v!=null&&v!=="";
      const b=el("button","num"+(has?(okAt(p,it,k,v)?" done":" bad"):"")+(k===i?" cur":""),label(k));
      b.type="button";b.onclick=()=>{i=k;draw();};return b;}));
    q.replaceChildren();foot.replaceChildren();
    if(i>=N){qbox.replaceChildren();drawSummary();return;}
    drawSource();drawQ();
    const v=r.a[i],has=v!=null&&v!=="";
    if(p.kind==="tf"){
      const pr=el("div","prompt",(13+i)+". "+it.stmts[i]);pr.lang="en";q.append(pr);
      const box=el("div","opts");
      TFN.forEach((o,k)=>{
        const b=button(o,()=>check(k+1),"opt");b.lang="en";
        if(has){b.disabled=true;if(k+1===it.key[i])b.classList.add("ok");else if(k+1===v)b.classList.add("no");}
        box.append(b);});
      q.append(box);
    }else if(p.kind==="mt"){
      const box=el("div","opts nums");
      it.qs.forEach((o,k)=>{
        const b=button(String(k+1),()=>check(k+1),"opt");b.title=o;
        if(has){b.disabled=true;if(k+1===it.key[i])b.classList.add("ok");else if(k+1===v)b.classList.add("no");}
        box.append(b);});
      q.append(el("div","muted","Text "+"ABCDEF"[i]+" → номер вопроса"),box);
      if(has)q.append(el("div","verdict "+(okAt(p,it,i,v)?"ok":"no"),okAt(p,it,i,v)?"✓ Верно":"✗ Правильно: вопрос "+it.key[i]));
    }else{
      const row=el("div","row");row.style.alignItems="center";
      const inp=el("input","short");inp.type="text";inp.lang="en";inp.spellcheck=false;inp.autocomplete="off";inp.maxLength=60;
      inp.placeholder="type the answer";inp.value=has?v:"";inp.disabled=has;
      row.append(el("span","word",it.items[i].w),inp);q.append(row);
      const go=()=>{if(inp.value.trim())check(inp.value.trim());};
      if(!has){
        const b=button("Проверить",go,"primary");q.append(b);
        inp.onkeydown=e=>{if(e.key==="Enter")go();};setTimeout(()=>inp.focus(),0);
      }else{
        q.append(el("div","verdict "+(okAt(p,it,i,v)?"ok":"no"),okAt(p,it,i,v)?"✓ Верно":"✗ Правильно: "+it.items[i].d));
      }
    }
    const back=button("← Назад",()=>{i--;draw();});back.disabled=i===0;
    const last=i===N-1;
    foot.append(back,button(last?"Итог →":"Вперёд →",()=>{i=last?N:i+1;draw();},"primary"));
  }
  function drawSummary(){
    const s=itemScore(p,it);
    src.replaceChildren();
    if(p.kind==="gap"){i=N;drawSourceAll();}
    else if(p.kind==="tf")src.textContent=it.paras.join("\n\n");
    else{src.textContent=it.texts.map((t,k)=>"Text "+"ABCDEF"[k]+" → вопрос "+it.key[k]+"\n"+t).join("\n\n");qbox.replaceChildren(...it.qs.map((t,k)=>{const d=el("div","qr");d.append(el("b","",(k+1)+"."),document.createTextNode(" "+t));return d;}));}
    const box=el("div","sum");box.append(el("div","big",s+" / "+N));
    const wrong=[];
    for(let k=0;k<N;k++)if(!okAt(p,it,k,r.a[k])){
      if(p.kind==="tf")wrong.push((13+k)+". "+TFN[it.key[k]-1]+" (у тебя: "+TFN[r.a[k]-1]+")");
      else if(p.kind==="mt")wrong.push("Text "+"ABCDEF"[k]+": вопрос "+it.key[k]+" (у тебя: "+r.a[k]+")");
      else wrong.push((k+1)+". "+it.items[k].d+" (у тебя: "+r.a[k]+")");
    }
    box.append(el("div","",wrong.length?"Ошибки:":"Без ошибок."));
    wrong.forEach(w=>{const d=el("div","",w);d.lang="en";box.append(d);});
    q.append(box);
    const row=el("div","row");
    row.append(button("Пройти заново",()=>{S.res[rk(p,it)]={a:[]};save();open(p.id,it.n);}),button("К списку",()=>open(p.id),"primary"));
    foot.append(row);
  }
  function drawSourceAll(){
    it.text.split(/‹(\d+)›/).forEach((part,j)=>{
      if(j%2===0){src.append(document.createTextNode(part));return;}
      const k=Number(part)-1,v=r.a[k],g=el("span","g "+(okAt(p,it,k,v)?"ok":"no"),(v||"").trim());src.append(g);
      if(!okAt(p,it,k,v))src.append(" ",el("span","fix",it.items[k].d));
    });
  }
  draw();
}

/* ---------- recorder ---------- */
function recorder(tag,onDone){
  const bar=el("div","rec"), status=el("span","muted","Запись по желанию: скачай файл и отправь Татьяне.");
  const player=el("audio","hidden");player.controls=true;
  const dl=el("a","btn hidden","Скачать аудио");
  const stop=button("Остановить",()=>{if(media&&media.state==="recording")media.stop();});stop.disabled=true;
  const start=button("Начать запись",async()=>{
    try{
      if(!navigator.mediaDevices||!window.MediaRecorder)throw Error("Запись здесь недоступна. Запиши ответ на диктофон.");
      start.disabled=true;stream=await navigator.mediaDevices.getUserMedia({audio:true});
      media=new MediaRecorder(stream);chunks=[];
      media.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      media.onstop=()=>{
        stream.getTracks().forEach(t=>t.stop());if(recordURL)URL.revokeObjectURL(recordURL);
        recordURL=URL.createObjectURL(new Blob(chunks,{type:media.mimeType}));
        const ext=media.mimeType.includes("mp4")?"m4a":media.mimeType.includes("ogg")?"ogg":"webm";
        const name="Timofey-OGE-"+tag+"-"+Date.now()+"."+ext;
        S.audio=(S.audio||[]).concat(name);save();
        player.src=recordURL;player.classList.remove("hidden");dl.href=recordURL;dl.download=name;dl.classList.remove("hidden");
        status.textContent="Запись готова. Скачай файл.";start.disabled=false;stop.disabled=true;if(onDone)onDone();
      };
      media.start();stop.disabled=false;status.textContent="Идёт запись…";
    }catch(e){start.disabled=false;if(stream)stream.getTracks().forEach(t=>t.stop());toast(e.message||"Нет доступа к микрофону. Используй диктофон.");}
  });
  bar.append(start,stop,player,dl,status);return bar;
}

/* ---------- timer with phases ---------- */
function phaseTimer(phases){
  const box=el("div","tm");
  box.innerHTML='<svg class="ring" viewBox="0 0 112 112" aria-hidden="true"><circle class="bg" cx="56" cy="56" r="46"/><circle class="fg" cx="56" cy="56" r="46" stroke-dasharray="'+RING+'" stroke-dashoffset="0"/><text x="56" y="56">–</text></svg>';
  const fg=box.querySelector(".fg"),txt=box.querySelector("text"),side=el("div","side");
  side.style.cssText="display:flex;flex-direction:column;gap:8px";
  const status=el("div","muted",phases.map(p=>p.label+" "+fmt(p.sec)).join(" → "));
  function fmt(s){return Math.floor(s/60)+":"+String(s%60).padStart(2,"0");}
  const go=button("Старт",()=>{
    clearInterval(tick);let k=0,left=phases[0].sec;go.disabled=true;
    const paint=()=>{txt.textContent=fmt(left);fg.style.strokeDashoffset=RING*(1-left/phases[k].sec);status.textContent=phases[k].label;};
    paint();
    tick=setInterval(()=>{left--;
      if(left<0){k++;if(k>=phases.length){clearInterval(tick);tick=null;txt.textContent="0:00";status.textContent="Время вышло.";go.disabled=false;return;}left=phases[k].sec;}
      paint();},1000);
  },"primary");
  side.append(go,status);box.append(side);return box;
}
function markDone(p,it){S.res[rk(p,it)]=Object.assign(rec(p,it),{done:true});save();}

/* ---------- speaking 1: read aloud ---------- */
function s1Page(p,it){
  head(p,it);
  const split=el("div","split"),left=el("div","col"),right=el("div","col");
  const src=el("div","source read scroll",it.paras.join("\n\n"));src.lang="en";src.style.flex="1";left.append(src);
  right.append(el("p","muted","Задание 1: подготовка 1,5 минуты, потом читай текст вслух (до 1,5 минут)."),
    phaseTimer([{label:"Подготовка",sec:90},{label:"Читай вслух",sec:90}]),
    recorder("S1-"+it.n,()=>markDone(p,it)));
  const d=button(itemDone(p,it)?"Отмечено ✓":"Отметить выполненным",()=>{markDone(p,it);d.textContent="Отмечено ✓";});
  right.append(d);split.append(left,right);main.append(split);
}
/* ---------- speaking 3: monologue ---------- */
function s3Page(p,it){
  head(p,it);
  const split=el("div","split"),left=el("div","col"),right=el("div","col");
  const card=el("div","source scroll");card.style.flex="1";card.lang="en";
  card.append(el("b","",it.prompt));const ul=el("ul","bul");it.bul.forEach(b=>ul.append(el("li","",b)));card.append(ul);
  left.append(card);
  const sample=el("div","sample hidden");sample.lang="en";sample.textContent=it.sample.join("\n\n");
  const show=button("Показать образец",()=>{sample.classList.toggle("hidden");show.textContent=sample.classList.contains("hidden")?"Показать образец":"Скрыть образец";});
  right.append(el("p","muted","Задание 3: подготовка 1,5 минуты, монолог до 2 минут (не меньше 10–12 фраз)."),
    phaseTimer([{label:"Подготовка",sec:90},{label:"Говори",sec:120}]),
    recorder("S3-"+it.n,()=>markDone(p,it)));
  const row=el("div","row");
  const d=button(itemDone(p,it)?"Отмечено ✓":"Отметить выполненным",()=>{markDone(p,it);d.textContent="Отмечено ✓";});
  row.append(d,show);right.append(row,sample);
  sample.style.overflow="auto";sample.style.flex="1";sample.style.minHeight="0";
  split.append(left,right);main.append(split);
}
/* ---------- speaking 2: interview cards ---------- */
function s2Page(p,it){
  const r=rec(p,it);r.a=r.a||[];
  let qi=Math.max(0,Array.from({length:6},(_,k)=>r.a[k]).findIndex(v=>!v)),flipped=false,showSample=false;
  const sc=el("span","sc");head(p,it,sc);
  const strip=el("div","strip"),q=el("div","q"),foot=el("div","foot");
  main.append(strip,q,foot,recorder("S2-"+it.n));
  function go(n){stopAll();flipped=false;showSample=false;qi=n;draw();}
  function heardMark(){if(!r.a[qi]){r.a[qi]=true;save();paint();}}
  function paint(){
    sc.textContent=r.a.filter(Boolean).length+" / 6";
    strip.replaceChildren(...it.qa.map((_,k)=>{const b=el("button","num"+(r.a[k]?" done":"")+(k===qi?" cur":""),String(k+1).padStart(2,"0"));b.type="button";b.onclick=()=>go(k);return b;}));
  }
  function draw(){
    paint();q.replaceChildren(card());
    const back=button("← Назад",()=>go(qi-1));back.disabled=qi===0;
    const flip=button(flipped?"Скрыть текст":"Перевернуть карточку",()=>{flipped=!flipped;showSample=false;draw();});
    const last=qi===it.qa.length-1;
    const fwd=button(last?"К списку":"Вперёд →",()=>last?open(p.id):go(qi+1),"primary");
    foot.replaceChildren(back,flip,fwd);
  }
  function card(){
    const text=it.qa[qi].q;
    const c=el("div","card");
    c.innerHTML='<svg class="ring" viewBox="0 0 112 112" aria-hidden="true"><circle class="bg" cx="56" cy="56" r="46"/><circle class="fg" cx="56" cy="56" r="46" stroke-dasharray="'+RING+'" stroke-dashoffset="0"/><text x="56" y="56">40</text></svg>';
    const fg=c.querySelector(".fg"),txt=c.querySelector("text"),side=el("div","side");c.append(side);
    const status=el("p","muted","Нажми Play, послушай вопрос и отвечай вслух.");
    function timer(){
      clearInterval(tick);let left=40;txt.textContent=left;fg.style.strokeDashoffset=0;
      tick=setInterval(()=>{left--;txt.textContent=left;fg.style.strokeDashoffset=RING*(1-left/40);
        if(left<=0){clearInterval(tick);tick=null;status.textContent="Время вышло. Переходи к следующему вопросу.";}},1000);
    }
    function play(){
      stopAll();txt.textContent="40";fg.style.strokeDashoffset=0;heardMark();
      if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){status.textContent="Звук недоступен. Переверни карточку и прочитай вопрос.";timer();return;}
      const my=++speakToken,u=new SpeechSynthesisUtterance(text);u.lang="en-GB";u.rate=.92;
      const v=speechSynthesis.getVoices().find(v=>/^en[-_]GB/i.test(v.lang))||speechSynthesis.getVoices().find(v=>/^en/i.test(v.lang));if(v)u.voice=v;
      u.onend=()=>{if(my===speakToken){status.textContent="Отвечай. У тебя 40 секунд.";timer();}};
      u.onerror=()=>{if(my===speakToken)status.textContent="Не удалось озвучить. Переверни карточку и прочитай вопрос.";};
      status.textContent="Слушай вопрос…";speechSynthesis.speak(u);
    }
    if(!flipped){
      side.append(el("h3","","Question "+(qi+1)+" of "+it.qa.length));
      const row=el("div","row");
      row.append(button("Play",play,"primary"),button("Replay",play),button("Stop",()=>{stopAll();status.textContent="Остановлено.";}));
      side.append(row,status);
    }else{
      const bt=el("div","back-text",text);bt.lang="en";
      side.append(el("p","muted",it.title),bt);
      const sm=el("div","sample"+(showSample?"":" hidden"),it.qa[qi].a);sm.lang="en";
      const b=button(showSample?"Скрыть образец":"Показать образец",()=>{showSample=!showSample;draw();});
      side.append(b,sm);
    }
    return c;
  }
  draw();
}

/* ---------- results ---------- */
function summary(){
  return PAGES.filter(p=>p.data).map(p=>{
    const done=p.data.filter(it=>itemDone(p,it));
    const pts=isStepper(p)?done.reduce((n,it)=>n+itemScore(p,it),0):null;
    const max=isStepper(p)?done.reduce((n,it)=>n+size(p,it),0):null;
    return {page:p.id,name:p.grp+" · "+p.label,done:done.length,total:p.data.length,points:pts,max:max};
  });
}
function resultsPage(){
  const t=el("table","res");
  t.innerHTML="<tr><th>Раздел</th><th>Выполнено</th><th>Баллы</th></tr>";
  summary().forEach(s=>{const tr=el("tr");tr.append(el("td","",s.name),el("td","",s.done+" из "+s.total),el("td","",s.max?s.points+" / "+s.max:"—"));t.append(tr);});
  const wrap=el("div","scroll");wrap.style.flex="1";wrap.append(t);
  const row=el("div","row");
  row.append(button("Скачать результаты для Татьяны",exportResults,"primary"),button("Сбросить прогресс",resetAll));
  main.append(wrap,row,el("p","muted","Сайт ничего не отправляет сам: скачай файл и пришли его Татьяне вместе с аудиозаписями."));
}
function exportResults(){
  const snap={app:"timofey-oge",schema:2,student:"Тимофей",exportedAt:new Date().toISOString(),summary:summary(),details:S.res,audioFiles:S.audio||[]};
  const url=URL.createObjectURL(new Blob([JSON.stringify(snap,null,2)],{type:"application/json"}));
  const a=el("a");a.href=url;a.download="Timofey-OGE-results-"+Date.now()+".json";document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);toast("Файл результатов скачан.");
}
function resetAll(){
  const d=el("dialog"),f=el("div","foot");
  f.append(button("Отмена",()=>{d.close();d.remove();}),button("Сбросить",()=>{S={res:{},audio:[]};save();d.close();d.remove();open("results");},"primary"));
  d.append(el("h2","","Сбросить прогресс?"),el("p","","Все результаты на этом устройстве будут удалены."),f);
  document.body.append(d);d.showModal();
}

window.addEventListener("beforeunload",e=>{if(media&&media.state==="recording"){e.preventDefault();e.returnValue="";}});
{
  const h=decodeURIComponent(location.hash.slice(1)).toLowerCase();
  const [a,b]=h.split("/");
  const id=byId(a)?a:ALIAS[a]||"tf";
  const n=b&&Number(b)?Number(b):null;
  open(id,byId(id).data&&byId(id).data.some(x=>x.n===n)?n:null);
}
if(!storageOK)save();
