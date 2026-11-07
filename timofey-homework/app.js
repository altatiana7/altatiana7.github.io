const TEACHER=/[?&]teacher=1\b/.test(location.search); // режим учителя: ничего не отправляется
const KEY=TEACHER?SETKEY+".teacher":SETKEY;
let state={answers:{},lastSubmission:null,feedback:null,audioName:null};
let storageOK=true;
try{const s=JSON.parse(localStorage.getItem(KEY)||"null");if(s&&s.answers&&typeof s.answers==="object")state=Object.assign(state,s);}catch(e){storageOK=false;}

const $=id=>document.getElementById(id), main=$("main"), nav=$("nav");
const pos={};
let current=null, media=null, stream=null, chunks=[], recordURL=null, tick=null, speakToken=0;

function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
function button(text,fn,cls){const b=el("button","btn"+(cls?" "+cls:""),text);b.type="button";b.onclick=fn;return b;}
function toast(s){const t=$("toast");t.textContent=s;t.classList.remove("hidden");clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.add("hidden"),6000);}
function heard(c){const v=state.answers["sp"+(c+1)];return typeof v==="string"&&v?v.split(",").map(Number):[];}
function done(t){
  const v=state.answers[t.id];if(typeof v!=="string")return false;
  if(/^sp\d$/.test(t.id))return heard(Number(t.id[2])-1).length>=6;
  return v.trim().length>0;
}
function count(sec){return TASKS.filter(t=>(!sec||t.section===sec)&&done(t)).length;}
function save(){
  try{localStorage.setItem(KEY,JSON.stringify(state));storageOK=true;}catch(e){storageOK=false;}
  updateProgress();
  clearTimeout(save.t);save.t=setTimeout(sendHW,1500);
}
/* ---------- ответы сразу уходят Татьяне (та же база, что у заданий ОГЭ) ---------- */
const DB_URL="https://lzxcmrlubhjfdhtqvqzt.supabase.co",DB_KEY="sb_publishable_PmyZRwzWne8lqprej4XJQA_XiujtjEI";
let lastSent=state.sentSig||"";
async function sendHW(){
  const st=$("saveStatus");
  if(TEACHER){st.textContent="Режим учителя: ответы не отправляются";return false;}
  const det=TASKS.filter(t=>t.section!=="Speaking"&&typeof state.answers[t.id]==="string"&&state.answers[t.id].trim())
    .map(t=>({id:t.id,question:t.section+" · "+(t.prompt||"").replace(/___/g,"…")+(t.word?" ["+t.word+"]":""),chosen:state.answers[t.id],correct:"",is_correct:true}));
  if(!det.length){st.textContent="Сначала выполни хотя бы одно задание";return false;}
  const sig=det.map(d=>d.id+"="+d.chosen).join("~");if(sig===lastSent){st.textContent="Ответы у Татьяны ✓";return true;}
  try{
    const r=await fetch(DB_URL+"/rest/v1/rpc/submit_arina_homework",{method:"POST",headers:{apikey:DB_KEY,Authorization:"Bearer "+DB_KEY,"Content-Type":"application/json"},
      body:JSON.stringify({p_test_id:"timofey-oge-hw-"+QUEST,p_test_title:"Тимофей · On Screen · Домашка · "+TITLE,p_score:0,p_max_score:0,p_answers:{student:"Тимофей",heard:Object.fromEntries(Object.entries(state.answers).filter(([k])=>/^sp\d$/.test(k)))},p_details:det})});
    if(!r.ok)throw Error("send");
    lastSent=sig;state.sentSig=sig;try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){}
    st.textContent="Ответы у Татьяны ✓";return true;
  }catch(e){st.textContent="Не удалось отправить Татьяне — повторится позже";return false;}
}
window.addEventListener("online",()=>sendHW());
window.addEventListener("load",()=>setTimeout(sendHW,1200));
function updateProgress(){
  $("progress").textContent=count()+"/"+TASKS.length+" · "+count()*10+" XP";
  nav.querySelectorAll("button[data-sec]").forEach(b=>{
    const s=b.dataset.sec;b.lastChild.textContent=count(s)+"/"+TASKS.filter(t=>t.section===s).length;
  });
}
function stopSpeech(){speakToken++;if(window.speechSynthesis)speechSynthesis.cancel();clearInterval(tick);tick=null;}

/* ---------- navigation ---------- */
[...SECTIONS,"Submit","Feedback"].forEach((p,i)=>{
  if(p==="Submit")nav.append(el("hr"));
  const b=el("button");b.type="button";b.dataset.page=p;
  b.append(el("b","",{Submit:"Сдать работу",Feedback:"Проверка"}[p]||p));
  if(i<SECTIONS.length){b.dataset.sec=p;b.append(el("span","",""));}
  b.onclick=()=>open(p);nav.append(b);
});
function open(page){
  if(media&&media.state==="recording"){toast("Сначала останови запись.");return;}
  stopSpeech();current=page;
  nav.querySelectorAll("button").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  main.replaceChildren();
  const i=SECTIONS.indexOf(page);
  $("tab").replaceChildren(el("b","","// "),document.createTextNode(
    i>=0?String(i+1).padStart(2,"0")+" "+page.toLowerCase()+" — "+META[page]:page==="Submit"?"сдать работу":"проверка учителя"));
  if(page==="Submit")submitPage();else if(page==="Feedback")feedbackPage();else if(page==="Writing")writingPage();else if(page==="Speaking")speakingPage();else if(page===OGE_SEC)ogeReadingPage();else sectionPage(page);
  updateProgress();
}
function nextLabel(sec){const n=SECTIONS[SECTIONS.indexOf(sec)+1];return n?"Дальше: "+n:"К сдаче";}
function goNext(sec){open(SECTIONS[SECTIONS.indexOf(sec)+1]||"Submit");}

/* ---------- stepper sections ---------- */
function promptNode(t){
  const p=el("div","prompt");p.lang="en";
  t.prompt.split("___").forEach((part,k,a)=>{p.append(part);if(k<a.length-1)p.append(el("span","gap"," "));});
  return p;
}
function clozePage(sec){
  const tasks=TASKS.filter(t=>t.section===sec);
  const container=el("div","cloze-work");
  const heading=el("h2","",sec==="Grammar"?"Grammar · Connected text":"Word Formation · Connected text");
  const intro=el("p","", "Read the complete text. Transform each word in CAPITALS to complete the gaps.");
  const text=el("div","cloze-text");text.lang="en";
  const results=el("div","cloze-results");
  const controls=el("div","cloze-controls");
  const check=button("Проверить ответы",()=>{
    let good=0;
    tasks.forEach(t=>{
      const field=text.querySelector('[data-answer="'+t.id+'"]');
      const expected=CLOZE_KEYS[t.id];
      const correct=String(state.answers[t.id]||"").trim().toLowerCase().replace(/[’]/g,"'")===expected.toLowerCase();
      if(correct)good++;
      field.classList.toggle("cloze-good",correct);
      field.classList.toggle("cloze-bad",!correct);
      const hint=field.nextElementSibling;
      if(hint&&hint.classList.contains("cloze-hint"))hint.textContent=correct?"✓":"→ "+expected;
    });
    results.textContent="Верно: "+good+" из "+tasks.length+".";
  },"primary");
  const forward=button(nextLabel(sec),()=>goNext(sec));
  controls.append(check,forward);
  const labelMap=Object.fromEntries(tasks.map((t,i)=>[t.id,{t,n:i+1}]));
  CLOZE_TEXTS[sec].forEach(par=>{
    const p=el("p");
    par.split(/\{([gf]\d+)\}/).forEach((part,j)=>{
      if(j%2===0){p.append(document.createTextNode(part));return;}
      const x=labelMap[part];if(!x){p.append(part);return;}
      const wrap=el("span","cloze-slot");
      const num=el("span","cloze-number",String(x.n)+".");
      const input=el("input","cloze-input");
      input.type="text";input.dataset.answer=part;input.autocomplete="off";input.spellcheck=false;
      input.value=state.answers[part]||"";
      input.setAttribute("aria-label","Задание "+x.n+"; исходное слово "+x.t.word);
      input.oninput=()=>{state.answers[part]=input.value;save();input.classList.remove("cloze-good","cloze-bad");input.nextElementSibling.textContent="";results.textContent="";};
      const hint=el("span","cloze-hint");
      const word=el("span","cloze-word",x.t.word);
      wrap.append(num,input,hint,word);p.append(wrap);
    });
    text.append(p);
  });
  container.append(heading,intro,text,results,controls);
  main.append(container);
  if(!document.getElementById("cloze-style")){
    const st=el("style");st.id="cloze-style";
    st.textContent=".cloze-work{width:100%;height:100%;overflow:auto;padding:18px 28px}.cloze-work h2{margin:0 0 8px;font-size:24px}.cloze-work>p{font-size:17px;color:#526272}.cloze-text{font-size:clamp(19px,1.8vw,25px);line-height:2.55;max-width:1250px}.cloze-text p{margin:12px 0 25px}.cloze-slot{white-space:nowrap;display:inline-flex;align-items:center;gap:5px;vertical-align:baseline}.cloze-number{font-weight:700;color:#53677a}.cloze-input{width:125px;max-width:21vw;font:inherit;font-size:19px;padding:5px 7px;border:1px solid #8c9ba9;border-radius:5px;background:#fff}.cloze-word{font:bold 13px Arial,sans-serif;color:#356b59;letter-spacing:.04em}.cloze-hint{font:14px Arial,sans-serif;color:#b13e3e}.cloze-good{border-color:#287c4b;background:#ebf9f0}.cloze-bad{border-color:#b13e3e;background:#fff0ee}.cloze-controls{display:flex;gap:12px;margin-top:20px;flex-wrap:wrap}.cloze-results{font-size:17px;font-weight:bold}@media(max-width:700px){.cloze-work{padding:12px}.cloze-text{line-height:2.8}.cloze-input{width:95px;font-size:17px}.cloze-word{font-size:11px}}";
    document.head.append(st);
  }
  updateProgress();
}
function sectionPage(sec){
  if(CLOZE_TEXTS[sec]){clozePage(sec);return;}
  const tasks=TASKS.filter(t=>t.section===sec);
  let i=Math.min(pos[sec]??Math.max(0,tasks.findIndex(t=>!done(t))),tasks.length-1), flipped=false;
  const strip=el("div","strip"), q=el("div","q"), foot=el("div","foot");
  const withSource=!!SOURCES[sec]||tasks.some(t=>t.src);
  let src=null;
  if(withSource){
    const split=el("div","split"), left=el("div","col"), right=el("div","col");
    src=el("div","source scroll");src.lang="en";src.style.flex="1";left.append(src);
    if(tasks.some(t=>t.src))split.style.gridTemplateColumns="minmax(0,1fr) minmax(0,1.3fr)";
    right.append(strip,q,foot);split.append(left,right);main.append(split);
  }else main.append(strip,q,foot);

  function go(n){stopSpeech();flipped=false;i=n;draw();}
  function draw(){
    pos[sec]=i;const t=tasks[i];
    strip.replaceChildren(...tasks.map((x,k)=>{
      const b=el("button","num"+(done(x)?" done":"")+(k===i?" cur":""),String(k+1).padStart(2,"0"));
      b.type="button";b.setAttribute("aria-label","Вопрос "+(k+1));b.onclick=()=>go(k);return b;}));
    q.replaceChildren();
    if(src){src.textContent=t.src||SOURCES[sec];src.scrollTop=0;}
    {
      q.append(promptNode(t));
      if(t.type==="choice"){
        const box=el("div","opts"+(t.options.length>4?" many":""));
        t.options.forEach(o=>{
          const b=button(o,()=>{
            const first=!done(t);state.answers[t.id]=o;save();draw();
            if(first&&i<tasks.length-1)setTimeout(()=>{if(current===sec&&pos[sec]===tasks.indexOf(t))go(i+1);},350);
          },"opt"+(state.answers[t.id]===o?" sel":""));
          b.lang="en";box.append(b);});
        q.append(box);
      }else{
        const row=el("div","row");row.style.alignItems="center";
        const inp=el("input","short");inp.type="text";inp.lang="en";inp.spellcheck=false;inp.autocomplete="off";inp.maxLength=150;
        inp.placeholder="type the answer";inp.value=state.answers[t.id]||"";
        inp.oninput=()=>{state.answers[t.id]=inp.value;save();strip.children[i].classList.toggle("done",done(t));};
        inp.onkeydown=e=>{if(e.key==="Enter"){if(i<tasks.length-1)go(i+1);else goNext(sec);}};
        row.append(el("span","word",t.word),inp);q.append(row);
        setTimeout(()=>inp.focus(),0);
      }
    }
    const back=button("← Назад",()=>go(i-1));back.disabled=i===0;
    const last=i===tasks.length-1;
    const fwd=button(last?nextLabel(sec):"Вперёд →",()=>last?goNext(sec):go(i+1),"primary");
    foot.replaceChildren(back);
    foot.append(fwd);
  }
  draw();
}

/* ---------- ОГЭ Reading: два текста по 8 вопросов, проверка и подсветка ошибок ---------- */
const RD_OPTS=["True","False","Not stated"];
function ogeKey(it){try{return atob(it.key)}catch(e){return ""}}
function ogeTotals(){
  let ok=0,filled=0,total=0;
  OGE_READING.sets.forEach(s=>s.items.forEach(it=>{total++;const a=state.answers[it.id];
    if(a){filled++;if(a===ogeKey(it))ok++;}}));
  return {ok:ok,filled:filled,total:total};
}
function ogeReadingPage(){
  const checked=()=>!!state.readChecked;
  let si=Math.min(pos.ogeSet||0,OGE_READING.sets.length-1);
  const bar=el("div","ogebar"), tabs=el("div","ogetabs"), tools=el("div","ogetools");
  const scoreEl=el("b","ogescore","");
  const split=el("div","split"), left=el("div","col"), right=el("div","col");
  const src=el("div","source scroll"), list=el("div","qlist");
  const foot=el("div","foot");
  left.append(src); right.append(list); split.append(left,right);

  const checkBtn=button("Проверить ответы",()=>{
    const t=ogeTotals();
    if(!t.filled){toast("Сначала ответь хотя бы на один вопрос.");return;}
    state.readChecked=true; save(); draw();
    const n=ogeTotals();
    toast("Верно "+n.ok+" из "+n.total+". Баллов: "+n.ok+" из "+n.total+"."+(n.ok===n.total?" Отлично!":" Ошибки подсвечены."));
  },"primary");
  const resetBtn=button("Сбросить проверку",()=>{state.readChecked=false;save();draw();});
  tools.append(checkBtn,resetBtn,scoreEl);
  bar.append(tabs,tools);
  main.append(bar,split,foot);

  function drawTabs(){
    tabs.replaceChildren(...OGE_READING.sets.map((s,k)=>{
      const all=s.items.filter(it=>state.answers[it.id]).length;
      const b=button("",()=>{si=k;pos.ogeSet=k;draw();});
      b.type="button"; b.className="btn tab"+(k===si?" active":"");
      b.replaceChildren(el("b","",s.label+" · "+s.title),el("span","",all+" / "+s.items.length));
      return b;
    }));
  }
  function drawList(){
    const s=OGE_READING.sets[si];
    list.replaceChildren(...s.items.map((it,i)=>{
      const row=el("div","rq"), num=el("span","rqn",String(i+1).padStart(2,"0"));
      const tx=el("div","rqt"); const p=el("p"); p.lang="en"; p.textContent=it.prompt; tx.append(p);
      const btns=el("div","rbtns"), a=state.answers[it.id];
      (it.options||RD_OPTS).forEach(o=>{
        const b=button(o,()=>{state.answers[it.id]=o;save();draw();},"rbtn");
        if(a===o)b.classList.add("sel");
        if(checked()){
          if(o===ogeKey(it))b.classList.add("ok");
          else if(a===o)b.classList.add("bad");
        }
        btns.append(b);
      });
      if(checked()&&!a)tx.append(el("span","rmiss","нет ответа · ключ: "+ogeKey(it)));
      else if(checked()&&a!==ogeKey(it))tx.append(el("span","rmiss","верный ответ: "+ogeKey(it)));
      tx.append(btns); row.append(num,tx); return row;
    }));
  }
  function draw(){
    pos.ogeSet=si;
    drawTabs(); src.textContent=OGE_READING.sets[si].text; src.scrollTop=0; drawList();
    const t=ogeTotals();
    scoreEl.textContent=checked()
      ? "Результат: "+t.ok+" из "+t.total+" баллов"
      : "Заполнено "+t.filled+" из "+t.total;
    scoreEl.className="ogescore"+(checked()?(t.ok===t.total?" full":t.ok*2>=t.total?" half":" low"):"");
    checkBtn.textContent=checked()?"Проверить снова":"Проверить ответы";
    resetBtn.classList.toggle("hidden",!checked());
    const bi=SECTIONS.indexOf(OGE_SEC)-1;
    const back=bi>=0?button("← "+SECTIONS[bi],()=>open(SECTIONS[bi])):null;
    const next=button(nextLabel(OGE_SEC)+" →",()=>goNext(OGE_SEC),"primary");
    foot.replaceChildren(...[back,next].filter(Boolean));
  }
  draw();
}

/* ---------- speaking: 4 interview cards x 6 questions, one at a time ---------- */
const RING=2*Math.PI*46;
let recCard=0;
function speakingPage(){
  let c=pos.spC??0, qi=pos.spQ??0, flipped=false;
  const strip=el("div","strip"), q=el("div","q"), foot=el("div","foot");
  main.append(strip,q,foot,recorder());
  function go(nc,nq){stopSpeech();flipped=false;c=nc;qi=nq;draw();}
  function mark(){
    const h=heard(c);if(!h.includes(qi+1)){h.push(qi+1);h.sort((a,b)=>a-b);state.answers["sp"+(c+1)]=h.join(",");save();}
    paintStrip();
  }
  function paintStrip(){
    const parts=[];
    SPEAKING.forEach((card,k)=>{
      const b=el("button","num vcard"+(heard(k).length>=6?" done":"")+(k===c?" cur":""),"Card "+(k+1));
      b.type="button";b.title=card.title;b.onclick=()=>go(k,0);parts.push(b);});
    parts.push(el("span","muted","·"));
    SPEAKING[c].questions.forEach((_,k)=>{
      const b=el("button","num"+(heard(c).includes(k+1)?" done":"")+(k===qi?" cur":""),String(k+1).padStart(2,"0"));
      b.type="button";b.setAttribute("aria-label","Вопрос "+(k+1));b.onclick=()=>go(c,k);parts.push(b);});
    strip.replaceChildren(...parts);
  }
  function draw(){
    pos.spC=c;pos.spQ=qi;recCard=c;paintStrip();
    q.replaceChildren(speakingCard(c,qi,flipped,mark));
    const isFirst=c===0&&qi===0, isLast=c===SPEAKING.length-1&&qi===SPEAKING[c].questions.length-1;
    const back=button("← Назад",()=>qi>0?go(c,qi-1):go(c-1,SPEAKING[c-1].questions.length-1));back.disabled=isFirst;
    const flip=button("Перевернуть карточку",()=>{flipped=!flipped;draw();});
    const fwd=button(isLast?nextLabel("Speaking"):"Вперёд →",()=>{
      if(isLast)goNext("Speaking");else if(qi<SPEAKING[c].questions.length-1)go(c,qi+1);else go(c+1,0);},"primary");
    foot.replaceChildren(back,flip,fwd);
  }
  draw();
}
function speakingCard(c,qi,flipped,onPlay){
  const text=SPEAKING[c].questions[qi];
  const card=el("div","card");
  card.innerHTML='<svg class="ring" viewBox="0 0 112 112" aria-hidden="true"><circle class="bg" cx="56" cy="56" r="46"/><circle class="fg" cx="56" cy="56" r="46" stroke-dasharray="'+RING+'" stroke-dashoffset="0"/><text x="56" y="56">40</text></svg>';
  const fg=card.querySelector(".fg"), txt=card.querySelector("text"), side=el("div","side");
  card.append(side);
  const status=el("p","muted","Нажми Play, послушай вопрос и отвечай вслух.");
  function timer(){
    clearInterval(tick);let left=40;txt.textContent=left;fg.style.strokeDashoffset=0;
    tick=setInterval(()=>{left--;txt.textContent=left;fg.style.strokeDashoffset=RING*(1-left/40);
      if(left<=0){clearInterval(tick);tick=null;status.textContent="Время вышло. Переходи к следующему вопросу.";}},1000);
  }
  function play(){
    stopSpeech();txt.textContent="40";fg.style.strokeDashoffset=0;onPlay();
    if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){status.textContent="Звук в этом браузере недоступен. Переверни карточку и прочитай вопрос.";timer();return;}
    const my=++speakToken, u=new SpeechSynthesisUtterance(text);u.lang="en-GB";u.rate=.92;
    const v=speechSynthesis.getVoices().find(v=>/^en[-_]GB/i.test(v.lang))||speechSynthesis.getVoices().find(v=>/^en/i.test(v.lang));if(v)u.voice=v;
    u.onend=()=>{if(my===speakToken){status.textContent="Отвечай. У тебя 40 секунд.";timer();}};
    u.onerror=()=>{if(my===speakToken)status.textContent="Не удалось озвучить. Переверни карточку и прочитай вопрос.";};
    status.textContent="Слушай вопрос…";speechSynthesis.speak(u);
  }
  if(!flipped){
    side.append(el("h3","","Card "+(c+1)+" · question "+(qi+1)+" of "+SPEAKING[c].questions.length));
    const row=el("div","row");
    row.append(button("Play",play,"primary"),button("Replay",play),button("Stop",()=>{stopSpeech();status.textContent="Остановлено.";}));
    side.append(row,status);
  }else{
    const t=el("p","muted","Card "+(c+1)+" · "+SPEAKING[c].title);
    const bt=el("div","back-text",text);bt.lang="en";
    side.append(t,bt);
  }
  return card;
}
function recorder(){
  const bar=el("div","rec"), status=el("span","muted","Запиши ответы на карточку, скачай файл и отправь Татьяне.");
  const player=el("audio","hidden");player.controls=true;
  const dl=el("a","btn hidden","Скачать аудио");
  const stop=button("Остановить",()=>{if(media&&media.state==="recording")media.stop();});stop.disabled=true;
  const start=button("Начать запись",async()=>{
    try{
      if(!navigator.mediaDevices||!window.MediaRecorder)throw Error("Запись здесь недоступна. Запиши ответы на диктофон и отправь Татьяне.");
      start.disabled=true;stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const cardNo=recCard+1;
      media=new MediaRecorder(stream);chunks=[];
      media.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      media.onstop=()=>{
        stream.getTracks().forEach(t=>t.stop());if(recordURL)URL.revokeObjectURL(recordURL);
        recordURL=URL.createObjectURL(new Blob(chunks,{type:media.mimeType}));
        const ext=media.mimeType.includes("mp4")?"m4a":media.mimeType.includes("ogg")?"ogg":"webm";
        state.audioName="Timofey-Card"+cardNo+"-"+Date.now()+"."+ext;
        state.audioNames=(state.audioNames||[]).concat(state.audioName);save();show();
        status.textContent="Запись готова. Скачай файл.";start.disabled=false;stop.disabled=true;
      };
      media.start();stop.disabled=false;status.textContent="Идёт запись карточки "+cardNo+"…";
    }catch(e){start.disabled=false;if(stream)stream.getTracks().forEach(t=>t.stop());toast(e.message||"Нет доступа к микрофону. Используй диктофон.");}
  });
  function show(){player.src=recordURL;player.classList.remove("hidden");dl.href=recordURL;dl.download=state.audioName;dl.classList.remove("hidden");}
  bar.append(start,stop,player,dl,status);if(recordURL)show();
  return bar;
}

/* ---------- writing ---------- */
function writingPage(){
  const t=TASKS.find(t=>t.id==="email");
  const split=el("div","split"), left=el("div","col"), right=el("div","col");
  const src=el("div","source scroll",EMAIL.slice(0,2).join("\n")+"\n\n"+EMAIL.slice(2).join(" "));src.lang="en";src.style.fontSize="15px";src.style.lineHeight="1.4";
  const hint=el("p","muted",t.prompt);hint.style.fontSize="15px";hint.style.lineHeight="1.3";left.append(src,hint);split.style.gridTemplateColumns="minmax(0,1.25fr) minmax(0,1fr)";
  const ta=el("textarea");ta.lang="en";ta.spellcheck=false;ta.maxLength=6000;ta.placeholder="Dear …,";ta.value=state.answers.email||"";
  const wc=el("span","muted");wc.style.whiteSpace="nowrap";
  const upd=()=>{const n=wordsIn(ta.value);wc.textContent=n+" слов · цель "+WORDS[0]+"–"+WORDS[1]+(n>=WORDS[0]&&n<=WORDS[1]?" ✓":"");};
  ta.oninput=()=>{state.answers.email=ta.value;save();upd();};upd();
  const foot=el("div","foot");foot.style.alignItems="center";
  foot.append(wc,button("Дальше →",()=>goNext("Writing"),"primary"));
  right.append(ta,foot);split.append(left,right);main.append(split);
}

/* ---------- submit ---------- */
function download(obj,name){
  const url=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:"application/json"}));
  const a=el("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function exportAnswers(){
  const missing=TASKS.length-count();
  const snap={app:"timofey-homework",schema:1,quest:QUEST,student:"Тимофей",
    submissionId:"TH-"+Date.now()+"-"+Math.random().toString(36).slice(2,8),exportedAt:new Date().toISOString(),
    answers:structuredClone(state.answers),audioFile:(state.audioNames||[]).join(", ")||null,completed:count(),total:TASKS.length};
  state.lastSubmission=snap;save();download(snap,"Timofey-Homework-"+snap.submissionId+".json");
  toast((missing?"Скачан черновик, пустых ответов: "+missing+". ":"Файл ответов скачан. ")+"Ответы и так уходят Татьяне автоматически.");
  open("Submit");
}
function pickFile(fn){const inp=$("fileInput");inp.value="";inp.onchange=()=>fn(inp.files[0]);inp.click();}
function submitPage(){
  main.append(el("p","prompt",count()+" из "+TASKS.length+" ответов заполнено"));
  const row=el("div","row");
  if(window.HWSent&&!TEACHER){
    const ds=el("div","");const drawDone=()=>{ds.innerHTML="";
      if(HWSent.isSent("timofey",QUEST)){ds.innerHTML=HWSent.badge("timofey",QUEST);return}
      ds.append(button("Я закончил · отправить Татьяне",async()=>{if(!confirm("Отправить домашку? Отправить можно один раз."))return;
        await HWSent.submit({student:"timofey",name:"Тимофей",page:QUEST,title:TITLE+" · готово",data:{done:true,answered:count(),total:TASKS.length}});drawDone();},"primary"))};
    drawDone();main.append(ds);}
  const sendNow=button("Отправить мои ответы учителю",async()=>{
     sendNow.disabled=true;
     const sent=await sendHW();
     toast(sent?"Ответы получены учителем. Можно продолжать домашку.":"Не удалось отправить. Проверь подключение и повтори.");
     sendNow.disabled=false;
   },"primary");
   row.append(sendNow,button("Скачать резервную копию ответов",exportAnswers),button("Восстановить ответы из файла",()=>pickFile(restore)));
  main.append(row);
  main.append(el("div","box",state.lastSubmission
    ?"Последний скачанный файл: "+state.lastSubmission.submissionId+". Если поменяешь ответы, скачай файл заново."
    :"Файл ответов ещё не скачан."));
  const ol=el("ol","steps");
  ["Ответы сохраняются и автоматически передаются Татьяне через интернет. Статус передачи показан сверху.","Аудиозаписи интервью (Speaking) скачай и отправь Татьяне в вашем чате.","Скачать резервную копию нужно только при проблемах с отправкой."].forEach(s=>ol.append(el("li","",s)));
  main.append(ol);
}
async function readFile(file){if(!file)throw Error("Выбери файл.");if(file.size>2000000)throw Error("Файл слишком большой.");return JSON.parse(await file.text());}
function validAnswers(a){if(!a||Array.isArray(a)||typeof a!=="object")return false;return Object.entries(a).every(([id,v])=>TASKS.some(t=>t.id===id)&&typeof v==="string"&&v.length<=6000);}
async function restore(file){
  try{
    const s=await readFile(file);
    if(s.app!=="timofey-homework"||s.schema!==1||s.quest!==QUEST||!validAnswers(s.answers))throw Error("Это не файл ответов этой домашки.");
    const d=el("dialog"), foot=el("div","foot");
    foot.append(button("Отмена",()=>{d.close();d.remove();}),
      button("Заменить",()=>{state.answers=s.answers;state.lastSubmission=s;state.feedback=null;save();d.close();d.remove();open("Submit");toast("Ответы восстановлены.");},"primary"));
    d.append(el("h2","","Восстановить ответы?"),el("p","","Ответы на этом устройстве будут заменены ответами из файла."),foot);
    document.body.append(d);d.showModal();
  }catch(e){toast(e instanceof SyntaxError?"Файл повреждён или это не .json.":e.message||"Не удалось открыть файл.");}
}

/* ---------- teacher feedback ---------- */
function feedbackPage(){
  const row=el("div","row");row.style.alignItems="center";
  row.append(button("Открыть файл проверки",()=>pickFile(importFeedback),"primary"));
  const f=state.feedback;
  if(!f){main.append(row,el("div","box","Проверки пока нет. Татьяна пришлёт файл после того, как посмотрит ответы."));return;}
  const sum=f.items.reduce((n,x)=>n+x.score,0);
  row.append(el("span","prompt",sum+" / "+MAX_TOTAL+" баллов"));main.append(row);
  const list=el("div","scroll");list.style.flex="1";
  if(f.general)list.append(el("div","box",f.general));
  f.items.forEach(x=>{
    const t=TASKS.find(t=>t.id===x.id), q=el("div","fb"+(x.score<t.max?" bad":""));
    const head=el("p");head.append(el("b","",x.score+"/"+t.max+" "),t.section+" · "+t.prompt+(t.word?" ["+t.word+"]":""));
    q.append(head,el("p","ans",state.lastSubmission.answers[t.id]||"нет ответа"));
    if(x.comment)q.append(el("p","",x.comment));
    list.append(q);});
  main.append(list);
}
async function importFeedback(file){
  try{
    const f=await readFile(file);
    if(f.app!=="timofey-feedback"||f.schema!==1||f.quest!==QUEST||!Array.isArray(f.items)||f.items.length!==TASKS.length
      ||!f.items.every((x,i)=>x.id===TASKS[i].id&&Number.isFinite(x.score)&&x.score>=0&&x.score<=TASKS[i].max&&typeof x.comment==="string"&&x.comment.length<=6000)
      ||typeof f.general!=="string"||f.general.length>10000)throw Error("Это не файл проверки.");
    if(!state.lastSubmission||f.submissionId!==state.lastSubmission.submissionId)
      throw Error("Проверка относится к другой попытке. Сначала восстанови тот файл ответов в разделе «Сдать работу».");
    state.feedback=f;save();open("Feedback");toast("Проверка загружена.");
  }catch(e){toast(e instanceof SyntaxError?"Файл повреждён или это не .json.":e.message||"Ошибка загрузки.");}
}

window.addEventListener("beforeunload",e=>{if(media&&media.state==="recording"){e.preventDefault();e.returnValue="";}});
const wanted=decodeURIComponent(location.hash.slice(1));
open(SECTIONS.includes(wanted)?wanted:(TASKS.find(t=>!done(t))||{section:"Submit"}).section);
if(!storageOK)save();

document.title="Timofey — "+TITLE;$("hdr").textContent="homework / "+TITLE;
