/* Текст задания: как можно крупнее (до 21px), но так, чтобы помещался без прокрутки (не меньше 11px). */
(function(){
  var SEL=".source,.qlist,.wrcard,.sample:not(.hidden)";
  function fit(e){
    var grow=e.classList.contains("source")&&!e.classList.contains("mini");
    e.style.fontSize="";e.style.lineHeight="";
    var fs=parseFloat(getComputedStyle(e).fontSize),n=0;
    if(grow){fs=21;e.style.fontSize=fs+"px";e.style.lineHeight="1.45";}
    if(e.scrollHeight<=e.clientHeight+1)return;
    e.style.lineHeight="1.34";
    while(e.scrollHeight>e.clientHeight+1&&fs>11&&n<80){fs-=0.5;e.style.fontSize=fs+"px";n++;}
  }
  function all(){var l=document.querySelectorAll(SEL);for(var i=0;i<l.length;i++){var e=l[i];if(e.offsetParent&&e.clientHeight>40)fit(e);}}
  var t=0;function later(){cancelAnimationFrame(t);t=requestAnimationFrame(all);}
  new MutationObserver(later).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  addEventListener("resize",later);addEventListener("load",later);
})();
