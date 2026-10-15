/* Текст задания помещается без прокрутки: шрифт уменьшается, пока всё не влезет (не меньше 11px). */
(function(){
  var SEL=".source,.qlist,.wrcard,.sample:not(.hidden)";
  function fit(e){
    e.style.fontSize="";e.style.lineHeight="";
    if(e.scrollHeight<=e.clientHeight+1)return;
    var fs=parseFloat(getComputedStyle(e).fontSize),n=0;
    e.style.lineHeight="1.38";
    while(e.scrollHeight>e.clientHeight+1&&fs>11&&n<60){fs-=0.5;e.style.fontSize=fs+"px";n++;}
  }
  function all(){var l=document.querySelectorAll(SEL);for(var i=0;i<l.length;i++){var e=l[i];if(e.offsetParent&&e.clientHeight>40)fit(e);}}
  var t=0;function later(){cancelAnimationFrame(t);t=requestAnimationFrame(all);}
  new MutationObserver(later).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  addEventListener("resize",later);addEventListener("load",later);
})();
