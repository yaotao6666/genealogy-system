/* 智慧族谱 · H5 应用（API 驱动） */
(function(){
'use strict';
/* ================= 工具 ================= */
var $=function(s){ return document.querySelector(s); };
var $$=function(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); };
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
var store={
  get:function(k,d){ try{ var v=localStorage.getItem(k); return v==null?d:JSON.parse(v); }catch(e){ return d; } },
  set:function(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} },
  del:function(k){ try{ localStorage.removeItem(k); }catch(e){} }
};
var GEN_CN=['零','一','二','三','四','五','六','七','八','九','十'];
function cnGen(g){ if(g<=10) return '第'+GEN_CN[g]+'世'; if(g<20) return '第十'+GEN_CN[g-10]+'世'; if(g===20) return '第二十世'; if(g<30) return '第二十'+GEN_CN[g-20]+'世'; return '第三十世'; }
var CNUM=['零','一','二','三','四','五','六','七','八','九','十'];
function cnum(n){ if(n<=10) return CNUM[n]; if(n<20) return '十'+CNUM[n-10]; if(n===20) return '二十'; if(n<30) return '二十'+CNUM[n-20]; if(n===30) return '三十'; return String(n); }
function today(){ var d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
var REDUCED=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ================= 图标 ================= */
var P={
 back:'<path d="m15 18-6-6 6-6"/>', chev:'<path d="m9 18 6-6-6-6"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
 home:'<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
 tree:'<rect x="9" y="2" width="6" height="5" rx="1"/><rect x="2" y="16" width="6" height="5" rx="1"/><rect x="16" y="16" width="6" height="5" rx="1"/><path d="M12 7v4M5 16v-3a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"/>',
 book:'<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
 users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
 camera:'<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3.5"/>',
 clip:'<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
 check:'<path d="M20 6 9 17l-5-5"/>', x:'<path d="M18 6 6 18M6 6l12 12"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
 pen:'<path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
 docadd:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 12v6M9 15h6"/>',
 img:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
 logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
 layers:'<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
 alert:'<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
 eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
 user:'<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
 menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
 screen:'<rect x="2" y="3" width="20" height="13" rx="2"/><path d="M8 21h8M12 16v5"/>',
 trash:'<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2">',
 eyeoff:'<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 8 10 8a9.74 9.74 0 0 0 5.39-1.61"/><path d="m2 2 20 20"/>'
};
function ic(n,s){ s=s||20; return '<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(P[n]||'')+'</svg>'; }

/* ================= API ================= */
var TOKEN=store.get('gz_token',null);
function api(path,opts){
  opts=opts||{};
  var headers={};
  if(TOKEN) headers['Authorization']='Bearer '+TOKEN;
  var init={method:opts.method||'GET',headers:headers};
  if(opts.body instanceof FormData){ init.body=opts.body; }
  else if(opts.body!==undefined){ headers['Content-Type']='application/json'; init.body=JSON.stringify(opts.body); }
  return fetch('/api'+path,init).then(function(r){
    return r.json().catch(function(){ return {}; }).then(function(data){
      if(r.status===401&&!/\/login/.test(path)){
        if(TOKEN){ TOKEN=null; store.del('gz_token'); S.loggedIn=false; }
        var err=new Error(data.error||'请先登录'); err.status=401; throw err;
      }
      if(!r.ok){ var e=new Error(data.error||('请求失败('+r.status+')')); e.status=r.status; throw e; }
      return data;
    });
  });
}

/* ================= 状态 ================= */
var S={
 loggedIn:!!TOKEN, fs:store.get('gz_fs','0'),
 stack:[], cur:'', params:{},
 dirQ:'', dirGen:0, dirPage:1,
 mQ:'', mPage:1,
 revTab:'pending', revPage:1,
 bookVol:0, bookPage:1,
 tocVol:0, tocPage:1,
 readerPage:1, zoom:1, navBusy:false,
 capStep:1, cap:null,
 evApply:[],
 medFather:null,
 anim:false, busy:false, seq:0
};

/* ================= 小构件 ================= */
function stat(v,l){ return '<div class="g-stat"><b>'+v+'</b><span>'+l+'</span></div>'; }
function entry(goId,icn,name,sub){ return '<button class="g-entry" data-go="'+goId+'"><span class="g-eicon">'+ic(icn,22)+'</span><span><b>'+name+'</b><span>'+sub+'</span></span></button>'; }
function chipM(m){ return '<button class="g-chip g-chipred" data-go="member" data-id="'+m.id+'">'+esc(m.name)+'</button>'; }
function avatar(name){ return '<div class="g-avatar">'+esc(String(name||'').slice(1)||name)+'</div>'; }
function lk(m){ return '<button class="g-lk" data-go="member" data-id="'+m.id+'">'+esc(m.name)+'</button>'; }
function th(n,title){ return '<div class="g-thumb" data-go="reader" data-page="'+n+'"><div class="g-thumbpaper"><i class="g-thside"></i></div><span>'+cnum(n)+'　'+esc(title||'')+'</span></div>'; }
function rcard(name,sub,on){ return '<label class="g-rcard'+(on?' g-on':'')+'"><input type="radio" name="gz-appt" value="'+name+'"'+(on?' checked':'')+'><span class="g-rcname">'+name+'</span><span class="g-rcsub">'+sub+'</span></label>'; }
function field(fid,label,inner,err){ return '<div class="g-field" id="'+fid+'"><label class="g-flabel">'+label+'</label>'+inner+'<div class="g-err">'+(err||'请填写完整')+'</div></div>'; }
function confBadge(c){
  if(c==null) return '';
  var cls=c>=0.85?'g-conf-hi':(c>=0.7?'g-conf-mid':'g-conf-lo');
  var t=c>=0.85?'高':(c>=0.7?'中':'低');
  return '<em class="g-conf '+cls+'">识别置信 '+t+' '+Math.round(c*100)+'%</em>';
}
function pager(total,page,size,act){
  var last=Math.max(1,Math.ceil(total/size));
  return '<div class="g-pg">'
   +'<button class="g-btn g-line" data-act="'+act+'" data-v="prev"'+(page<=1?' disabled':'')+'>‹ 上一页</button>'
   +'<span class="g-pginfo">'+page+' / '+last+' 页 · 共 '+total+' 条</span>'
   +'<button class="g-btn g-line" data-act="'+act+'" data-v="next"'+(page>=last?' disabled':'')+'>下一页 ›</button></div>';
}
var statsCache={members:0,gens:30,pages:0,linked_pages:0};
function setBadge(n){ var bd=$('#gz-revbadge'); if(bd){ bd.textContent=n; bd.style.display=n?'':'none'; } }
function qs(params){ var a=[]; for(var k in params){ if(params[k]!==''&&params[k]!=null) a.push(encodeURIComponent(k)+'='+encodeURIComponent(params[k])); } return a.length?'?'+a.join('&'):''; }

/* ---- 模拟谱页（竖排） ---- */
var FILL=['盖闻木有本而枝繁，水有源而流远，人之有祖，亦犹是焉。','谱牒之作，所以敬宗收族，明世系，辨昭穆，而垂无穷者也。','王氏出自太原，其先晋公族之后，世为著姓。','自唐季离乱，子孙散处四方，至宋南渡，遂家于桐川之阳。','族之人尚其鉴兹，勉之慎之，毋忘乃祖之训。','岁在重光赤奋若，仲秋之月，合族谨识。'];
function shortDate(s){ return String(s||'').split('（')[0]; }
function simPage(p){
 var mem=p.members||[];
 var inner='<div class="g-ptitle">'+esc(p.page.title)+'</div>';
 if(mem.length){
  inner+=mem.map(function(m){
   return '<div>'+cnGen(m.gen)+'　讳'+lk(m)
    +(m.zi?'　字'+esc(m.zi):'')+(m.hao?'　号'+esc(m.hao):'')
    +(m.birth?'　生于'+esc(shortDate(m.birth)):'')+(m.death?'　卒于'+esc(shortDate(m.death)):'')
    +(m.spouse?'　配'+esc(m.spouse):'')+'</div>';
  }).join('');
  inner+='<div>'+FILL[p.page.page_no%FILL.length]+'</div>';
 }else{
  inner+='<div>'+FILL[(p.page.page_no*2)%FILL.length]+'</div><div>'+FILL[(p.page.page_no*2+1)%FILL.length]+'</div><div>'+FILL[(p.page.page_no*2+3)%FILL.length]+'</div>';
  if(/^总世系图/.test(p.page.title)) inner+='<div style="color:#9c3a32">（总图人物关联，待录入标注）</div>';
 }
 return '<div class="g-simpage"><div class="g-simframe"></div><div class="g-stitch"></div><div class="g-simbody">'+inner+'</div><div class="g-simfoot">王氏宗谱 · '+esc(p.volume.title.split(' ·')[0])+' · '+cnum(p.page.page_no)+'</div></div>';
}

/* ================= 屏幕渲染 ================= */
var R={};

R.home=function(){
 return Promise.all([api('/stats'),api('/notices')]).then(function(rs){
  var st=rs[0], notices=rs[1].items;
  var nh=notices.map(function(n){
   return '<div class="g-nrow"><span class="g-ndot">·</span><p>'+esc(n.content)+'</p><span class="g-ndate">'+esc(n.date||'')+'</span></div>';
  }).join('');
  return '<div class="g-pad">'
  +'<div class="g-hero"><div class="g-seal" style="width:64px;height:64px;font-size:19px">王氏<br>宗谱</div>'
  +'<h1>太原堂王氏宗谱</h1><div class="g-herosub">桐川王氏 · 智慧谱馆</div>'
  +'<div class="g-herorow"><span class="g-chip">公开浏览 · 无需登录</span></div></div>'
  +'<div class="g-searchbar" data-go="directory">'+ic('search',19)+'<span>搜索族人姓名、字号…</span></div>'
  +'<div class="g-egrid">'
  +entry('tree','tree','世系图',st.members+' 位族人 · '+st.gens+' 代')
  +entry('catalog','book','原谱阅览','线装原谱 '+st.pages+' 页')
  +entry('directory','users','族人名录','按世代查阅')
  +entry('apply','docadd','申请变更','纠错 · 补录')
  +'</div>'
  +'<a class="g-entry" style="grid-column:1/-1;margin-top:12px" href="/screen" target="_blank" rel="noopener">'
  +'<span class="g-eicon" style="background:var(--goldbg);color:var(--gold)">'+ic('screen',22)+'</span>'
  +'<span><b>大屏驾驶舱</b><span>祠堂/会议投屏展示 · 可折叠世系树 · 族人明细</span></span>'
  +'<span class="g-chev" style="margin-left:auto">'+ic('chev',18)+'</span></a>'
  +'<div class="g-sec">谱馆公告</div><div class="g-card">'+nh+'</div>'
  +'<div class="g-sec">谱馆概况</div><div class="g-stats">'
  +stat(st.members,'位族人')+stat(st.pages,'页原谱')+stat(st.linked_pages,'页已关联')
  +'</div>'
  +'<div class="g-footnote">数据来源：桐川王氏宗谱扫描件<br>内容由谱馆管理员维护 · 访客可提交变更申请</div>'
  +'</div>';
 });
};

/* ---- 世系树（懒加载，可展开可收起） ---- */
function treeNode(m){
 var kids=m.children||0;
 return '<li><div class="g-tnode">'
  +'<b data-go="member" data-id="'+m.id+'">'+esc(m.name)+'</b>'
  +'<span class="g-tsub">'+(m.zi?'字'+esc(m.zi):'&nbsp;')+'</span>'
  +'<span class="g-tsp">'+(m.spouse?'配 '+esc(m.spouse):'')+'</span>'
  +(kids?'<button class="g-tx" data-act="tree-x" data-id="'+m.id+'" data-n="'+kids+'">▾ '+kids+' 子</button>':'<span class="g-tx" style="opacity:.5">无后嗣</span>')
  +'</div><ul class="g-kids" data-kids="'+m.id+'" hidden></ul></li>';
}
function setPill(btn,open){
 if(!btn) return;
 btn.textContent=(open?'▾ ':'▸ ')+btn.dataset.n+' 子';
}
R.tree=function(){
 return Promise.all([api('/tree/roots'),api('/stats')]).then(function(rs){
  statsCache=rs[1];
  return '<div class="g-pad">'
  +'<div class="g-treezoom"><span class="g-hint" style="margin:0 auto 0 4px">逐支展开 · 点人名看详情</span>'
  +'<button class="g-zbtn" data-act="zoom" data-v="-" aria-label="缩小">−</button>'
  +'<button class="g-zbtn" data-act="zoom" data-v="+" aria-label="放大">＋</button></div>'
  +'<div class="g-treewrap" id="gz-treewrap"><div class="g-tree" id="gz-tree"><ul>'
  +rs[0].items.map(treeNode).join('')
  +'</ul></div></div>'
  +'<div class="g-tips">'+ic('alert',17)+'<span>全谱 '+statsCache.members+' 位族人、'+statsCache.gens+' 代世系，按支逐级展开；配偶记于各人名下。</span></div>'
  +'</div>';
 });
};
function loadKids(id, btn){
 var ul=document.querySelector('.g-kids[data-kids="'+id+'"]');
 if(!ul) return;
 if(ul.dataset.loaded==='1'){
  ul.hidden=!ul.hidden;
  setPill(btn, !ul.hidden);
  return;
 }
 api('/tree/children/'+id).then(function(r){
  ul.innerHTML=r.items.map(treeNode).join('');
  ul.hidden=false;
  ul.dataset.loaded='1';
  setPill(btn, true);
 }).catch(function(e){ toast(e.message,'warn'); });
}

/* ---- 原谱目录 ---- */
R.catalog=function(){
 return api('/volumes').then(function(r){
  return '<div class="g-pad">'
  +'<div class="g-intro">纸质原谱已逐页拍摄归档。绿色刻度表示该页已录入并关联族人，点击卷册进入翻书阅览。</div>'
  +r.items.map(function(v){
    var dots='';
    return '<div class="g-card g-vol" data-go="reader" data-page="'+(v.first_page||1)+'">'
     +'<div class="g-voltop"><div class="g-seal g-seal-sm">'+esc(v.title.split(' ·')[0])+'</div>'
     +'<div class="g-volinfo"><b>'+esc(v.title)+'</b><span>'+v.pages_total+' 页 · 已关联 '+v.pages_linked+' 页</span></div>'
     +'<span class="g-chev">'+ic('chev',18)+'</span></div>'
     +'<div class="g-dots">'+dots+'</div></div>';
   }).join('')
  +'</div>';
 });
};

/* ---- 族人名录 ---- */
function memberRow(m){
 return '<div class="g-row" data-go="member" data-id="'+m.id+'">'+avatar(m.name)
 +'<div class="g-rowmain"><b>'+esc(m.name)+'</b><div class="g-sub">'+cnGen(m.gen)+(m.zi?' · 字'+esc(m.zi):'')+(m.birth?' · '+esc(shortDate(m.birth)):'')+'</div></div>'
 +'<div class="g-rowr">'+((m.pages_n||0)>0?'<span class="g-minichip">谱 '+m.pages_n+' 页</span>':'')+'<span class="g-chev">'+ic('chev',17)+'</span></div></div>';
}
function dirListHTML(data){
 var items=data.items;
 if(!items.length) return '<div class="g-empty">'+(S.dirQ?'未找到「'+esc(S.dirQ)+'」相关的族人':'该世代暂无记录')+'</div>';
 return items.map(memberRow).join('');
}
R.directory=function(){
 var gq=S.dirGen?{gen:S.dirGen}:{};
 var q=Object.assign({q:S.dirQ,page:S.dirPage,size:20},gq);
 return Promise.all([api('/stats'),api('/members'+qs(q))]).then(function(rs){
  var st=rs[0], data=rs[1];
  var chips='<button class="g-genchip'+(S.dirGen===0?' g-on':'')+'" data-act="dir-gen" data-v="0">全部<i>'+st.members+'</i></button>';
  for(var g=1;g<=st.gens;g++){
   chips+='<button class="g-genchip'+(S.dirGen===g?' g-on':'')+'" data-act="dir-gen" data-v="'+g+'">'+cnGen(g).replace('第','').replace('世','')+'世<i>'+(st.gen_counts[g-1]||0)+'</i></button>';
  }
  return '<div class="g-pad">'
  +'<div class="g-searchbar small">'+ic('search',18)+'<input id="gz-dq" type="search" placeholder="搜索姓名、字号、生平…" value="'+esc(S.dirQ)+'" aria-label="搜索族人"></div>'
  +'<div class="g-genrow">'+chips+'</div>'
  +'<div id="gz-dlist">'+dirListHTML(data)+'</div>'
  +'<div id="gz-dpg">'+pager(data.total,data.page,data.size,'dir-pg')+'</div>'
  +'</div>';
 });
};
function refreshDir(){
 var q=Object.assign({q:S.dirQ,page:S.dirPage,size:20},S.dirGen?{gen:S.dirGen}:{});
 api('/members'+qs(q)).then(function(data){
  var el=$('#gz-dlist'); if(el) el.innerHTML=dirListHTML(data);
  var pg=$('#gz-dpg'); if(pg) pg.innerHTML=pager(data.total,data.page,data.size,'dir-pg');
 }).catch(function(){});
}

/* ---- 族人详情 ---- */
R.member=function(p){
 return api('/members/'+p.id).then(function(d){
  var m=d.member;
  var pages=d.pages||[];
  return '<div class="g-pad">'
  +'<div class="g-card g-mcard"><div class="g-mctop"><div class="g-avatar g-avatar-lg">'+esc(m.name.slice(1)||m.name)+'</div>'
  +'<div class="g-mcinfo"><h2>'+esc(m.name)+'</h2><div class="g-mchips"><span class="g-chip g-chipred">'+cnGen(m.gen)+'</span>'
  +(m.zi?'<span class="g-chip">字 '+esc(m.zi)+'</span>':'')+(m.hao?'<span class="g-chip">号 '+esc(m.hao)+'</span>':'')+'</div></div></div>'
  +'<div class="g-kvs">'+kv('生于',m.birth)+kv('卒于',m.death)+kv('配偶',m.spouse)+kv('记录页数',pages.length?pages.length+' 页':'暂无')+'</div></div>'
  +'<div class="g-sec">亲属关系</div><div class="g-card g-relcard">'
  +(d.father?'<div class="g-relrow"><span class="g-relk">父亲</span><div class="g-relv">'+chipM(d.father)+'</div></div>':'')
  +(d.children.length?'<div class="g-relrow"><span class="g-relk">子女</span><div class="g-relv">'+d.children.map(chipM).join('')+'</div></div>':'')
  +(m.spouse?'<div class="g-relrow"><span class="g-relk">配偶</span><div class="g-relv"><b>'+esc(m.spouse)+'</b></div></div>':'')
  +(d.father||d.children.length||m.spouse?'':'<div class="g-relrow"><span class="g-relk">暂无</span></div>')
  +'</div>'
  +'<div class="g-sec">生平</div><div class="g-card g-bio">'+esc(m.intro||'暂无记载')+'</div>'
  +'<div class="g-sec">关联原谱<span class="g-secx">'+(pages.length?pages.length+' 页 · 点击查看原页':'')+'</span></div>'
  +(pages.length?'<div class="g-thumbs">'+pages.map(function(pg){ return th(pg.page_no,pg.vol_title.split(' ·')[0]); }).join('')+'</div>'
    :'<div class="g-hint" style="margin:0 2px">暂无关联原谱页。</div>')
  +'<div class="g-src">资料来源：'+(pages.length?pages.map(function(pg){ return '《'+esc(pg.vol_title)+'》第 '+pg.page_no+' 页'; }).join('、'):'后台录入')+' · 更新于 '+esc((m.updated_at||'').slice(0,10))+'</div>'
  +'<div class="g-stickyfoot">'
  +(S.loggedIn
    ?'<div class="g-pager" style="margin-top:0"><button class="g-btn g-line" data-act="member-del" data-id="'+m.id+'" data-name="'+esc(m.name)+'">'+ic('trash',18)+'删除</button><button class="g-btn" data-go="medit" data-id="'+m.id+'">'+ic('pen',19)+'编辑资料</button></div>'
    :'<button class="g-btn" data-act="apply-for" data-id="'+m.id+'">'+ic('pen',19)+'申请变更</button>')
  +'</div></div>';
 });
};
function kv(k,v){ return '<div class="g-kv"><span>'+k+'</span><b>'+esc(v||'—')+'</b></div>'; }

/* ---- 翻书阅览 ---- */
R.reader=function(p){
 if(p&&p.page) S.readerPage=p.page;
 var n=S.readerPage;
 return api('/pages/'+n).then(function(d){
  readerTotal=d.total_pages||0;
  var mem=d.members||[];
  return '<div class="g-reader">'
  +'<div class="g-bookwrap"><div class="g-book" id="gz-book" data-act="booktap"><div class="g-pageabs" id="gz-pagec">'+simPage(d)+'</div></div></div>'
  +'<div class="g-pageind">'+esc(d.volume.title)+' · 第 '+d.page.page_no+' 页 / 共 '+d.total_pages+' 页</div>'
  +(mem.length
    ?'<div class="g-linkrow"><span class="g-linklab">本页关联</span>'+mem.map(chipM).join('')+'</div>'
    :'<div class="g-linkrow g-none">本页尚未关联族人'+(S.loggedIn?' —— <button class="g-linkgo" data-act="cap-this" data-page="'+n+'">去录入关联</button>':'，可在管理员录入流程中标注')+'</div>')
  +(d.page.photo_path?'<div class="g-linkrow"><button class="g-linkgo" data-act="photo-view" data-src="'+esc(d.page.photo_path)+'" data-page="'+n+'">'+ic('img',15)+' 查看本页拍摄原图</button></div>':'')
  +'<div class="g-pager"><button class="g-btn g-line" data-act="flip" data-v="prev">‹ 上一页</button><button class="g-btn" data-act="flip" data-v="next">下一页 ›</button></div>'
  +'<div class="g-fliphint">提示：左右滑动书页、或点按书页左右两侧翻页</div>'
  +'</div>';
 });
};
function flip(dir){
 if(S.anim) return;
 var total=readerTotal||0;
 var np=S.readerPage+(dir==='next'?1:-1);
 if(np<1||(total&&np>total)){ toast(dir==='next'?'已经是最后一页了':'已经是第一页了','warn'); return; }
 var cur=$('#gz-pagec');
 if(!cur||REDUCED){ S.readerPage=np; go('reader',{page:np},false); return; }
 S.anim=true;
 api('/pages/'+np).then(function(d){
  var oldHTML=cur.innerHTML, newHTML=simPage(d);
  var clone=document.createElement('div'); clone.className='g-flip';
  if(dir==='next'){ clone.innerHTML=oldHTML; cur.innerHTML=newHTML; }
  else{ clone.innerHTML=newHTML; }
  cur.parentNode.appendChild(clone);
  var kf=dir==='next'
   ?[{transform:'rotateY(0deg)',opacity:1},{transform:'rotateY(-108deg)',opacity:.15}]
   :[{transform:'rotateY(-108deg)',opacity:.15},{transform:'rotateY(0deg)',opacity:1}];
  clone.animate(kf,{duration:dir==='next'?320:290,easing:dir==='next'?'ease-in':'ease-out'}).onfinish=function(){
   clone.remove();
   if(dir!=='next') cur.innerHTML=newHTML;
   S.anim=false; S.readerPage=np; paint();
  };
 }).catch(function(e){ S.anim=false; toast(e.message,'warn'); });
}
var readerTotal=0;

/* ---- 目录抽屉 ---- */
function openToc(){
 var el=$('#gz-toc');
 el.innerHTML='<div class="g-tocbg" data-act="toc-close"></div><div class="g-tocp"><div class="g-shtitle">谱书目录<button class="g-shx" data-act="toc-close">'+ic('x',20)+'</button></div><div id="gz-tocbody"><div class="g-loading">加载中…</div></div></div>';
 el.classList.add('g-show');
 if(!S.tocVol) S.tocVol=1;
 renderTocBody();
}
function renderTocBody(){
 api('/volumes').then(function(vr){
  var cur=null;
  vr.items.forEach(function(v){ if(v.id===S.tocVol) cur=v; });
  if(!cur&&vr.items.length){ S.tocVol=vr.items[0].id; cur=vr.items[0]; }
  var volChips=vr.items.map(function(v){
   return '<button class="g-genchip'+(v.id===S.tocVol?' g-on':'')+'" data-act="toc-vol" data-v="'+v.id+'">'+esc(v.title.split(' ·')[0])+'<i>'+v.pages_total+'页</i></button>';
  }).join('');
  return api('/volumes/'+S.tocVol+'/pages?page='+S.tocPage+'&size=40').then(function(pr){
   var items=pr.items.map(function(pg){
    return '<div class="g-tocp-item'+(pg.page_no===S.readerPage?' g-cur':'')+'" data-go="reader" data-page="'+pg.page_no+'">'
     +'<i class="g-tdot'+(pg.linked?' g-on':'')+(pg.page_no===S.readerPage?' g-cur':'')+'"></i>'
     +'<span style="width:44px">'+pg.page_no+'</span><span class="g-toct">'+esc(pg.title)+'</span>'
     +(pg.linked?'<span class="g-tocn">'+pg.linked+' 人</span>':'')+'</div>';
   }).join('');
   $('#gz-tocbody').innerHTML=
    '<div class="g-genrow">'+volChips+'</div>'
    +items
    +pager(pr.total,pr.page,pr.size,'toc-pg')
    +'<div class="g-hint" style="text-align:center">绿点 = 已录入关联 · 直接输入页码快速跳转</div>'
    +'<div class="g-field" style="margin-top:8px"><div style="display:flex;gap:10px"><input class="g-input" id="gz-jump" type="number" min="1" placeholder="输入页码（1—'+readerTotal+'）" style="flex:1"><button class="g-btn" style="width:auto;min-height:48px;padding:8px 18px" data-act="toc-jump">跳转</button></div></div>';
  });
 }).catch(function(e){ $('#gz-tocbody').innerHTML='<div class="g-empty">'+esc(e.message)+'</div>'; });
}

/* ---- 申请变更 ---- */
R.apply=function(p){
 var pre=Promise.resolve(p.target?api('/members/'+p.target):null);
 return pre.then(function(t){
  var m=t?t.member:null;
  var type=p.type||'修改信息';
  var evSlotsH='';
  for(var i=0;i<2;i++){
   evSlotsH+=S.evApply[i]
    ?'<button class="g-evslot" data-act="ev-del-apply" data-i="'+i+'"><img src="'+S.evApply[i]+'" alt="佐证图片"><span style="position:absolute;bottom:6px;left:0;right:0;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.7);font-size:12px">点击移除</span></button>'
    :'<button class="g-evslot" data-act="ev-add-apply">'+ic('img',26)+'<span>添加图片</span></button>';
  }
  return '<div class="g-pad">'
  +'<div class="g-intro">任何访客都可以提交变更申请，由谱馆管理员审核后才会生效，原资料不受影响。</div>'
  +(m?'<div class="g-card g-tcard"><span class="g-relk" style="min-width:auto">变更对象</span><b>'+esc(m.name)+'</b><span class="g-chip">'+cnGen(m.gen)+'</span></div>':'')
  +'<div class="g-sec">变更类型</div><div class="g-rcards" id="gz-apptype">'
  +rcard('修改信息','更正现有资料',type==='修改信息')
  +rcard('新增族人','补录漏载族人',type==='新增族人')
  +rcard('纠正关联','页面与人对位',type==='纠正关联')
  +'</div>'
  +'<div class="g-sec">变更内容<span class="g-secx">必填</span></div>'
  +field('gz-af','说明','<textarea class="g-textarea" id="gz-adesc" placeholder="请写明需要更正或补充的内容与依据…&#10;如：族中老谱记载生于正月初九…"></textarea>','请填写变更内容，便于管理员核对')
  +'<div class="g-sec">佐证图片<span class="g-secx">选填 · 最多 2 张</span></div>'
  +'<div class="g-evgrid">'+evSlotsH+'</div>'
  +'<div class="g-field" style="margin-top:18px"><label class="g-flabel">您的称呼</label>'
  +'<input class="g-input" id="gz-aapp" placeholder="如：王克明（承志公后裔），可匿名"></div>'
  +'<div class="g-tips">'+ic('alert',17)+'<span>提交后生成申请编号，管理员将在 7 日内审核；无论通过与否，现有资料都不会被直接改动。</span></div>'
  +'<div style="height:18px"></div>'
  +'<button class="g-btn" data-act="apply-submit">'+ic('check',19)+'提交申请</button>'
  +'</div>';
 });
};

/* ---- 登录 ---- */
R.login=function(){
 return Promise.resolve('<div class="g-pad g-login">'
 +'<div class="g-seal" style="width:76px;height:76px;font-size:22px;margin:30px auto 16px">王氏<br>谱馆</div>'
 +'<h2 class="g-lgt">智慧谱馆 · 管理端</h2>'
 +'<p class="g-lgs">仅限谱馆管理员登录维护<br>演示账号 admin / admin123</p>'
 +field('gz-lf1','管理员账号','<input class="g-input" id="gz-lu" value="admin" autocomplete="off">')
 +field('gz-lf2','登录密码','<input class="g-input" id="gz-lp" type="password" value="">')
 +'<button class="g-btn" data-act="login" style="margin-top:12px">登　录</button>'
 +'<button class="g-btn g-ghost" data-act="login-back" style="margin-top:12px">返回浏览端</button>'
 +'</div>');
};

/* ---- 工作台 ---- */
R.dashboard=function(){
 return api('/stats').then(function(st){
  setBadge(st.pending||0);
  var now=new Date();
  var wk=['日','一','二','三','四','五','六'][now.getDay()];
  var pend=st.pending||0;
  return '<div class="g-pad">'
  +'<div class="g-greet"><b>欢迎回来，'+esc(meName)+'</b><span>'+now.getFullYear()+' 年 '+(now.getMonth()+1)+' 月 '+now.getDate()+' 日 · 星期'+wk+'</span></div>'
  +(pend
    ?'<div class="g-alert" data-go="review">'+ic('bell',20)+'<b>有 '+pend+' 条变更申请待审核</b><span class="g-chev">'+ic('chev',18)+'</span></div>'
    :'<div class="g-alert g-okalert">'+ic('check',20)+'<b>暂无待办事项</b></div>')
  +'<div class="g-sec">谱馆概览</div><div class="g-stats">'
  +stat(st.members,'位族人')+stat(st.pages,'页原谱')+stat(st.linked_pages+'/'+st.pages,'原谱关联')
  +'</div>'
  +'<div class="g-sec">待录入提示</div><div class="g-card g-pad-s" style="font-size:14.5px;color:var(--ink2);line-height:1.7">'
  +'尚有 <b style="color:var(--red2)">'+(st.truth_records||0)+'</b> 条残页识别记录待录入（分布于 '+(st.truth_pages||0)+' 页），可在「拍照录入」中拍照自动识别。</div>'
  +'<div class="g-sec">快捷操作</div><div class="g-egrid">'
  +entry('capture','camera','拍照录入','拍照识别 · 简化录入')
  +entry('members','users','族人维护','编辑族人资料')
  +entry('review','clip','变更审核','处理族人申请')
  +entry('book','layers','原谱管理','卷页与关联状态')
  +'</div>'
  +'<div class="g-sec">适老显示</div><div class="g-card g-pad-s"><div class="g-fsrow">'
  +'<div><b>字号大小</b><span>根据视力情况选择，全站即时生效</span></div>'
  +'<div class="g-seg">'+segFs()+'</div></div></div>'
  +'<div style="height:22px"></div>'
  +'<button class="g-btn g-ghost" data-act="logout">'+ic('logout',18)+'退出登录</button>'
  +'</div>';
 });
};
function segFs(){ var n=['标准','大字','特大'],h='';
 for(var i=0;i<3;i++) h+='<button class="g-seg-i'+(S.fs===String(i)?' g-on':'')+'" data-act="fs" data-v="'+i+'">'+n[i]+'</button>';
 return h; }

/* ---- 拍照录入向导 ---- */
function capInit(p){
 if(p&&p.page){
  S.cap={photo:'example',img:null,imgBlob:null,vol:0,page:p.page,autoPage:false,autoTitle:'',
   records:[],recIdx:0,links:[],linkQ:'',picked:{},ocr:false,done:false,ocrMsg:''};
  S.capStep=2;
 }else if(!S.cap||S.cap.done){
  S.cap={photo:null,img:null,imgBlob:null,vol:0,page:0,autoPage:true,autoTitle:'',
   records:[],recIdx:0,links:[],linkQ:'',picked:{},ocr:false,done:false,ocrMsg:''};
  S.capStep=1;
 }
}
function examplePhoto(){
 return new Promise(function(res){
  var cv=document.createElement('canvas'); cv.width=640; cv.height=860;
  var g=cv.getContext('2d');
  g.fillStyle='#f2e8d2'; g.fillRect(0,0,640,860);
  g.strokeStyle='#6e6049'; g.lineWidth=4; g.strokeRect(28,28,584,804);
  g.lineWidth=1.5; g.strokeRect(38,38,564,784);
  g.fillStyle='#4a4234'; g.textAlign='center'; g.font='44px "Songti SC",serif';
  var t='王氏宗谱齿录';
  for(var i=0;i<t.length;i++) g.fillText(t[i],320,150+i*76);
  g.font='26px serif'; g.fillStyle='#8a7c5e';
  g.fillText('示例拍摄图 · 用于演示识别',320,810);
  cv.toBlob(function(b){ res(b); },'image/jpeg',0.85);
 });
}
R.capture=function(){
 if(!S.cap) capInit({});
 var st=S.capStep, cap=S.cap;
 var steps=['拍摄谱页','选择卷页','识别核对','确认关联'];
 var h='<div class="g-pad">'
 +'<div class="g-steps">'+[1,2,3,4].map(function(i){ return '<span class="g-dot'+(i<=st?' g-on':'')+'"></span>'; }).join('')
 +'<span class="g-steplabel">第 '+['一','二','三','四'][st-1]+' 步 · 共四步</span></div>'
 +'<div class="g-steptitle">'+steps[st-1]+'</div>';
 if(st===1){
  h+='<div class="g-camera" data-act="cap-pick">'
   +(cap.img?'<img src="'+cap.img+'" alt="谱页照片">'
     :ic('camera',36)+'<b>点击拍摄或从相册选择</b><span>谱页平铺、光线充足、文字清晰</span>')
   +'</div>'
  +'<div class="g-tips">'+ic('alert',17)+'<span>操作提示：将谱页平铺拍摄，确保四角完整、文字清晰；拍完不满意可以重拍。</span></div>'
  +'<div style="height:16px"></div>'
  +'<button class="g-btn g-line" data-act="cap-example">'+ic('img',18)+'使用示例谱页（演示）</button>'
  +'<div style="height:10px"></div>'
  +'<button class="g-btn" data-act="cap-next">下一步：选择卷页</button>';
 }else if(st===2){
  return Promise.all([api('/volumes'),api('/stats')]).then(function(rs){
   var vr=rs[0]; statsCache=rs[1];
   if(!cap.vol){ cap.vol=vr.items.length>2?vr.items[2].id:(vr.items[0]?vr.items[0].id:0); }
   var pre=cap.autoPage
     ?api('/pages/next-unlinked'+qs({volume_id:cap.vol})).then(function(nu){ cap.page=nu.page_no; cap.autoTitle=nu.title; })
     :Promise.resolve();
   return pre.then(function(){
    var vols=vr.items.map(function(v){
     return '<label class="g-rcard'+(cap.vol===v.id?' g-on':'')+'" data-act="vol" data-id="'+v.id+'"><span class="g-rcname">'+esc(v.title)+'</span><span class="g-rcsub">'+v.pages_total+' 页</span></label>';
    }).join('');
    var sub=cap.autoPage?cap.autoTitle:'手动指定页码';
    return '<div class="g-pad">'
    +'<div class="g-steps">'+[1,2,3,4].map(function(i){ return '<span class="g-dot'+(i<=2?' g-on':'')+'"></span>'; }).join('')+'<span class="g-steplabel">第 二 步 · 共四步</span></div>'
    +'<div class="g-steptitle">选择卷页</div>'
    +'<div class="g-sec">选择卷册</div><div class="g-rcards">'+vols+'</div>'
    +'<div class="g-sec">页码</div>'
    +'<div class="g-stepper"><button class="g-stp" data-act="page-dn" aria-label="上一页">−</button>'
    +'<div class="g-stpv"><b>'+cap.page+'</b><span>'+esc(sub)+'</span></div>'
    +'<button class="g-stp" data-act="page-up" aria-label="下一页">＋</button></div>'
    +'<div class="g-hint">'+(cap.autoPage?'已自动定位到第一个未录入的页面，也可手动调整。':'已切换为手动页码，± 可微调。')+'</div>'
    +'<div style="height:12px"></div><div class="g-pager">'
    +'<button class="g-btn g-line" data-act="cap-back">上一步</button>'
    +'<button class="g-btn" data-act="cap-ocr">识别本页 →</button></div>'
    +'</div>';
   });
  });
 }else if(st===3){
  var rec=cap.records[cap.recIdx]||{};
  var cf=rec.confidence||{};
  function fl(fid,label,key,val,ph){
   var c=cf[key];
   return '<div class="g-field" id="'+fid+'"><label class="g-flabel">'+label+confBadge(c)+(c!=null&&c<0.7?'<span class="g-lodot">⚠ 建议核对</span>':'')+'</label>'
    +'<input class="g-input" data-capf="'+key+'" value="'+esc(val||'')+'" placeholder="'+esc(ph||'')+'"></div>';
  }
  var tabs=cap.records.length>1?'<div class="g-rectabs">'+cap.records.map(function(r,i){
    return '<button class="g-rectab'+(i===cap.recIdx?' g-on':'')+'" data-act="cap-rec" data-v="'+i+'">记录 '+(i+1)+' · '+esc(r.name||'?')+'</button>';
  }).join('')+'</div>':'';
  h+=tabs
  +'<div class="g-ocr">'+ic('eye',17)+'<span>'+esc(cap.ocrMsg||'识别完成，请逐项核对修改。')+'</span></div>'
  +fl('gz-cnf','姓名 <span class="g-lodot">*</span>','name',rec.name,'如：王承烈')
  +'<div class="g-2col">'
  +fl('gz-cgf','世代','gen',rec.gen,'')
  +fl('gz-czf','字 / 号','zi',rec.zi,'如：仲远')
  +'</div>'
  +'<div class="g-2col">'
  +fl('gz-cbf','生于','birth',rec.birth,'如：明成化二十年（1484）')
  +fl('gz-cdf','卒于','death',rec.death,'')
  +'</div>'
  +'<div class="g-2col">'
  +fl('gz-csf','配偶','spouse',rec.spouse,'如：徐氏')
  +fl('gz-cff','父亲（按名匹配）','father_name',rec.father_name,'上一世族人名')
  +'</div>'
  +'<div class="g-field" id="gz-cif"><label class="g-flabel">生平</label>'
  +'<textarea class="g-textarea" style="min-height:80px" data-capf="intro">'+esc(rec.intro||'')+'</textarea></div>'
  +'<div style="height:8px"></div><div class="g-pager">'
  +'<button class="g-btn g-line" data-act="cap-back">上一步</button>'
  +(cap.records.length>1?'<button class="g-btn g-line" data-act="cap-save-rec">保存本条</button>':'')
  +'<button class="g-btn" data-act="cap-next2">下一步</button></div>';
 }else if(st===4){
  var meta=cap.pageMeta||{};
  var checks=cap.records.map(function(r,i){
   return '<label class="g-check'+(cap.picked[i]!==false?' g-on':'')+'"><input type="checkbox" data-rindex="'+i+'"'+(cap.picked[i]!==false?' checked':'')+'><div><b>'+esc(r.name||'（未命名）')+'</b><span>'+cnGen(r.gen||4)+(r.zi?' · 字'+esc(r.zi):'')+'</span></div></label>';
  }).join('');
  var chips=cap.links.map(function(l,i){
   return '<span class="g-chip g-chipred">'+esc(l.name)+'<button class="g-chipx" data-act="link-del" data-i="'+i+'" aria-label="移除">✕</button></span>';
  }).join('');
  h+='<div class="g-card g-pad-s g-sumbox">'
   +'<div class="g-sumrow"><span>谱页</span><b>'+esc(meta.volume||'')+' · 第 '+cap.page+' 页</b></div>'
   +'<div class="g-sumrow"><span>识别</span><b>'+cap.records.length+' 条记录 · 照片'+(cap.img?'已存':'未存')+'</b></div>'
   +'</div>'
  +'<div class="g-sec">本页新增族人</div>'
  +'<div class="g-hint" style="margin:0 2px 10px">勾选要保存的识别记录，保存后自动与本页建立关联。</div>'
  +checks
  +'<div class="g-sec">关联已有族人<span class="g-secx">选填</span></div>'
  +'<div class="g-searchbar small">'+ic('search',17)+'<input id="gz-lkq" type="search" placeholder="输入姓名搜索已有族人…"></div>'
  +'<div id="gz-lkres"></div>'
  +(chips?'<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">'+chips+'</div>':'<div class="g-hint" id="gz-lkempty" style="display:'+(cap.links.length?'none':'block')+'">尚未选择，搜索后点击即可关联（本页展示其原谱页）。</div>')
  +'<div style="height:14px"></div><div class="g-pager">'
  +'<button class="g-btn g-line" data-act="cap-back">上一步</button>'
  +'<button class="g-btn g-green" data-act="cap-finish">'+ic('check',18)+'完成录入</button></div>';
 }else if(st===5){
  h+='<div class="g-done"><div class="g-doneseal">'+ic('check',42)+'</div>'
   +'<h2>录入成功</h2><p>'+esc(S.cap.doneMsg||'')+'<br>识别结果已保存并与原谱第 '+S.cap.page+' 页建立双向关联</p>'
  +'<button class="g-btn" data-act="cap-again">'+ic('camera',18)+'继续录入下一页</button>'
  +'<div style="height:10px"></div>'
  +'<button class="g-btn g-line" data-act="done-dash">返回工作台</button></div>';
 }
 h+='</div>';
 return Promise.resolve(h);
};
function capReadFields(){
 var cap=S.cap; if(!cap) return;
 $$('[data-capf]').forEach(function(inp){
  var k=inp.dataset.capf, v=inp.value.trim();
  if(cap.records[cap.recIdx]){
   if(k==='gen'){ cap.records[cap.recIdx].gen=parseInt(v,10)||cap.records[cap.recIdx].gen||4; }
   else cap.records[cap.recIdx][k]=v;
  }
 });
}

/* ---- 族人维护 ---- */
R.members=function(){
 var q=Object.assign({q:S.mQ,page:S.mPage,size:20},{});
 return api('/members'+qs(q)).then(function(data){
  return '<div class="g-pad">'
  +'<div class="g-listtop"><div class="g-searchbar small" style="flex:1;margin:0">'+ic('search',18)
  +'<input id="gz-mq" type="search" placeholder="搜索族人" value="'+esc(S.mQ)+'" aria-label="搜索族人"></div>'
  +'<button class="g-btn" style="width:auto;min-height:44px;font-size:15px;padding:8px 14px;border-radius:12px" data-go="medit" data-id="">'+ic('plus',17)+'新增</button></div>'
  +'<div id="gz-mlist">'+(data.items.length?data.items.map(function(m){
    return '<div class="g-row" data-go="medit" data-id="'+m.id+'">'+avatar(m.name)
     +'<div class="g-rowmain"><b>'+esc(m.name)+'</b><div class="g-sub">'+cnGen(m.gen)+(m.zi?' · 字'+esc(m.zi):'')+'</div></div>'
     +'<div class="g-rowr"><span class="g-minichip">'+((m.pages_n||0)?'谱 '+m.pages_n+' 页':'未关联')+'</span><span class="g-chev">'+ic('pen',16)+'</span></div></div>';
   }).join(''):'<div class="g-empty">未找到相关族人</div>')+'</div>'
  +'<div id="gz-mpg">'+pager(data.total,data.page,data.size,'m-pg')+'</div></div>';
 });
};
function refreshMembers(){
 api('/members'+qs({q:S.mQ,page:S.mPage,size:20})).then(function(data){
  var l=$('#gz-mlist'); if(l) l.innerHTML=data.items.length?data.items.map(function(m){
    return '<div class="g-row" data-go="medit" data-id="'+m.id+'">'+avatar(m.name)
     +'<div class="g-rowmain"><b>'+esc(m.name)+'</b><div class="g-sub">'+cnGen(m.gen)+(m.zi?' · 字'+esc(m.zi):'')+'</div></div>'
     +'<div class="g-rowr"><span class="g-minichip">'+((m.pages_n||0)?'谱 '+m.pages_n+' 页':'未关联')+'</span><span class="g-chev">'+ic('pen',16)+'</span></div></div>';
   }).join(''):'<div class="g-empty">未找到相关族人</div>';
  var pg=$('#gz-mpg'); if(pg) pg.innerHTML=pager(data.total,data.page,data.size,'m-pg');
 }).catch(function(){});
}

/* ---- 编辑/新增 ---- */
R.medit=function(p){
 var pre=p.id?api('/members/'+p.id):Promise.resolve(null);
 return pre.then(function(d){
  var m=d?d.member:null;
  var medFor=p.id?('id'+p.id):'new';
  if(S.medFor!==medFor){
   S.medFather=m&&m.father_id?{id:m.father_id,name:(d.father?d.father.name:''),gen:m.gen-1}:null;
   S.medFor=medFor;
  }
  var v=function(x){ return esc(m?(m[x]||''):''); };
  var fatherGen=S.medFather?S.medFather.gen:(m?m.gen:4)-1;
  var fatherField='<div class="g-field" id="gz-eff"><label class="g-flabel">父亲（'+cnGen(Math.max(1,fatherGen))+'）</label>'
   +(S.medFather?'<button class="g-chip g-chipred" data-act="father-clear">'+esc(S.medFather.name)+' ✕</button>'
     :'<input class="g-input" id="gz-fq" placeholder="输入上一世族人姓名搜索…">')
   +'<div id="gz-fres"></div><div class="g-hint">按名字与上一世代自动匹配；找不到可留空。</div></div>';
  return '<div class="g-pad">'
  +'<div class="g-intro">'+(m?'修改保存后立即生效，访客端同步更新。':'新增族人后，可在「拍照录入」流程中建立与原谱页的关联。')+'</div>'
  +field('gz-ef1','姓名 <em>*</em>','<input class="g-input" id="gz-en" value="'+v('name')+'" placeholder="如：王承烈">','请填写姓名')
  +field('gz-ef2','世代','<select class="g-select" id="gz-eg">'+[1,2,3,4,5,6,7,8,9,10].map(function(g){ return '<option value="'+g+'"'+((m?m.gen:4)===g?' selected':'')+'>'+cnGen(g)+'</option>'; }).join('')+'</select>')
  +'<div class="g-2col">'
  +field('gz-ef3','字','<input class="g-input" id="gz-ez" value="'+v('zi')+'">')
  +field('gz-ef4','号','<input class="g-input" id="gz-eh" value="'+v('hao')+'">')
  +'</div>'
  +'<div class="g-2col">'
  +field('gz-ef5','生于','<input class="g-input" id="gz-eb" value="'+v('birth')+'" placeholder="如：明成化二十年（1484）">')
  +field('gz-ef6','卒于','<input class="g-input" id="gz-ed" value="'+v('death')+'">')
  +'</div>'
  +fatherField
  +field('gz-ef8','配偶','<input class="g-input" id="gz-es" value="'+v('spouse')+'" placeholder="如：徐氏">')
  +field('gz-ef9','生平','<textarea class="g-textarea" id="gz-ei">'+v('intro')+'</textarea>')
  +'<div style="height:10px"></div>'
  +'<button class="g-btn" data-act="medit-save">'+ic('check',19)+'保　存</button>'
  +(m?'<div style="height:10px"></div><button class="g-btn g-danger-line" data-act="member-del" data-id="'+m.id+'" data-name="'+esc(m.name)+'">'+ic('trash',18)+'删除该族人</button>':'')
  +'</div>';
 });
};

/* ---- 变更审核 ---- */
R.review=function(){
 return Promise.all([api('/requests'+qs({status:S.revTab,page:S.revPage,size:20})),api('/stats')]).then(function(rs){
  var data=rs[0];
  setBadge(rs[1].pending||0);
  var TC={'修改信息':['修','g-av-blue'],'新增族人':['增','g-av-green'],'纠正关联':['纠','g-av-gold']};
  var rows=data.items.map(function(r){
   var tn=r.target_name||'';
   var tc=TC[r.type]||['申',''];
   var chipHtml=r.status==='pending'?'<span class="g-minichip g-pend">待审核</span>'
    :(r.status==='approved'?'<span class="g-minichip g-okchip">已通过</span>':'<span class="g-minichip g-nochip">已驳回</span>');
   return '<div class="g-row" data-go="revdetail" data-id="'+r.id+'">'
    +'<div class="g-avatar g-avsq '+tc[1]+'">'+tc[0]+'</div>'
    +'<div class="g-rowmain"><b>'+esc(r.type)+(tn?' · '+esc(tn):'')+'</b><div class="g-sub">'+esc(r.applicant)+' · '+esc((r.created_at||'').slice(0,10))+'</div></div>'
    +'<div class="g-rowr">'+chipHtml+'<span class="g-chev">'+ic('chev',17)+'</span></div></div>';
  }).join('');
  return '<div class="g-pad">'
  +'<div class="g-seg" style="margin-bottom:14px">'
  +'<button class="g-seg-i'+(S.revTab==='pending'?' g-on':'')+'" data-act="revtab" data-v="pending">待处理</button>'
  +'<button class="g-seg-i'+(S.revTab==='done'?' g-on':'')+'" data-act="revtab" data-v="done">已处理</button></div>'
  +'<div id="gz-rlist">'+(rows||'<div class="g-empty g-card">暂无记录</div>')+'</div>'
  +pager(data.total,data.page,data.size,'rev-pg')
  +'</div>';
 });
};

R.revdetail=function(p){
 return api('/requests/'+p.id).then(function(r){
  var d=r.payload_obj||{};
  var h='<div class="g-pad">'
  +'<div class="g-card g-pad-s">'
  +'<div class="g-sumrow" style="display:flex;gap:12px;padding:4px 2px"><span style="color:var(--ink3);font-size:14px;flex:none">类型</span><b style="font-weight:600">'+esc(r.type)+'</b></div>'
  +(r.target_name?'<div class="g-sumrow" style="display:flex;gap:12px;padding:8px 2px 4px;border-top:1px solid var(--line)"><span style="color:var(--ink3);font-size:14px;flex:none">对象</span><b style="font-weight:600">'+esc(r.target_name)+'（'+cnGen(r.target_gen||1)+'）</b></div>':'')
  +'</div>';
  var buildDiff;
  if(r.type==='修改信息'&&d.field){
   buildDiff=api('/members/'+(d.member_id||r.target_id)).then(function(md){
    var labels={name:'姓名',zi:'字',hao:'号',birth:'生辰',death:'卒年',spouse:'配偶',intro:'生平',gen:'世代'};
    var old=md.member[d.field];
    return '<div class="g-sec">信息对比<span class="g-secx">原信息 → 申请变更</span></div><div class="g-diff">'
     +'<div class="g-diffr"><div class="g-dfk">'+esc(labels[d.field]||d.field)+'</div><div class="g-dfold">'+esc(old||'（空）')+'</div><div class="g-dfnew">'+esc(d.value||'（空）')+'</div></div></div>';
   });
  }else if(r.type==='新增族人'&&d.member){
   var nm=d.member;
   buildDiff=Promise.resolve('<div class="g-sec">拟新增族人</div><div class="g-card"><div class="g-kvs" style="padding:14px">'
    +kv('姓名',nm.name)+kv('世代',cnGen(nm.gen||4))+kv('字',nm.zi)+kv('生于',nm.birth)+kv('配偶',nm.spouse)
    +'</div><div style="padding:0 14px 14px;font-size:14px;color:var(--ink2)">生平：'+esc(nm.intro||'（未填）')+'</div></div>');
  }else if(r.type==='纠正关联'&&r.target_id){
   buildDiff=api('/members/'+r.target_id).then(function(md){
    var olds=(md.pages||[]).map(function(pg){ return '第 '+pg.page_no+' 页'; }).join('、')||'（未关联）';
    return '<div class="g-sec">信息对比<span class="g-secx">原关联 → 申请改为</span></div><div class="g-diff">'
     +'<div class="g-diffr"><div class="g-dfk">关联原谱页</div><div class="g-dfold">'+esc(olds)+'</div><div class="g-dfnew">'+esc(d.to_page?'第 '+d.to_page+' 页':'（未指定）')+'</div></div></div>';
   });
  }else{
   buildDiff=Promise.resolve('');
  }
  return buildDiff.then(function(diffHtml){
   h+=diffHtml
   +'<div class="g-sec">申请说明</div><div class="g-card g-bio">'+esc(r.content||'（未填写）')+'</div>'
   +'<div class="g-sec">申请人</div><div class="g-card g-applicant"><div class="g-avatar">'+esc((r.applicant||'访').charAt(0))+'</div>'
   +'<div><b>'+esc(r.applicant)+'</b><span>提交于 '+esc((r.created_at||'').slice(0,10))+'</span></div></div>'
   +(r.evidence?'<div class="g-sec">佐证材料</div><div class="g-evcard">'+ic('img',24)+'<span>'+esc(r.evidence)+'</span></div>':'');
   if(r.status==='pending'){
    h+='<div class="g-stickyfoot"><div class="g-pager" style="margin-top:0">'
     +'<button class="g-btn g-danger-line" data-act="rev-reject">'+ic('x',18)+'驳　回</button>'
     +'<button class="g-btn g-green" data-act="rev-approve">'+ic('check',18)+'通过并生效</button></div></div>';
   }else{
    h+='<div style="height:18px"></div><div class="g-result '+(r.status==='approved'?'g-result-ok':'g-result-no')+'">'+esc(r.result)+'</div>';
   }
   h+='</div>';
   return h;
  });
 });
};

/* ---- 原谱管理 ---- */
R.book=function(){
 return api('/volumes').then(function(vr){
  if(!S.bookVol&&vr.items.length) S.bookVol=vr.items[0].id;
  var cur=vr.items.filter(function(v){ return v.id===S.bookVol; })[0]||vr.items[0];
  S.bookVol=cur.id;
  return api('/volumes/'+cur.id+'/pages?page='+S.bookPage+'&size=60').then(function(pr){
   var cells=pr.items.map(function(pg){
    return '<button class="g-pcell'+(pg.linked?' g-on':'')+'" data-act="pcell" data-n="'+pg.page_no+'"><b>'+pg.page_no+'</b><span>'+(pg.linked?pg.linked+' 人':'未关联')+'</span></button>';
   }).join('');
   var volChips=vr.items.map(function(v){
    return '<button class="g-genchip'+(v.id===cur.id?' g-on':'')+'" data-act="book-vol" data-v="'+v.id+'">'+esc(v.title.split(' ·')[0])+'<i>'+v.pages_total+'页</i></button>';
   }).join('');
   return '<div class="g-pad">'
   +'<div class="g-stats">'+stat(cur.pages_linked,'本卷已关联')+stat(cur.pages_total-cur.pages_linked,'本卷未关联')+stat(pr.total,'本卷页数')+'</div>'
   +'<div class="g-intro" style="margin-top:14px">绿色为已录入并关联族人的页面。点击任意页码可查看、替换照片或去录入关联。</div>'
   +'<div class="g-genrow" style="padding-bottom:14px">'+volChips+'</div>'
   +'<div class="g-pgrid">'+cells+'</div>'
   +pager(pr.total,pr.page,pr.size,'book-pg')
   +'</div>';
  });
 });
};
function openPageSheet(n){
 api('/pages/'+n).then(function(d){
  var mem=d.members||[];
  var h='<p class="g-shtext">状态：'+(mem.length?'已录入 · 关联 '+mem.length+' 位族人':(d.page.photo_path?'已拍摄照片 · 未录入关联':'未拍摄 · 未录入关联'))+'</p>'
   +(mem.length?'<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">'+mem.map(chipM).join('')+'</div>':'')
   +(d.page.photo_path?'<img class="g-photo" style="margin-top:12px" src="'+esc(d.page.photo_path)+'" alt="谱页照片">':'');
  var acts=[{t:'查看原谱页',fn:function(){ go('reader',{page:n}); }}];
  acts.push({t:'替换/上传照片',cls:'g-line',fn:function(){
    var f=$('#gz-file'); f.dataset.for='photo'; f.dataset.page=n; f.click();
  }});
  if(!mem.length) acts.push({t:'去录入关联',cls:'g-green',fn:function(){ go('capture',{page:n}); }});
  openSheet({title:'第 '+n+' 页 · '+esc(d.page.title),html:h,acts:acts});
 }).catch(function(e){ toast(e.message,'warn'); });
}

/* ================= 屏幕表 ================= */
var SCREENS={
 home:{t:'谱馆首页',area:'v',root:1,r:R.home},
 tree:{t:'世系图',area:'v',root:1,r:R.tree},
 catalog:{t:'原谱阅览',area:'v',root:1,r:R.catalog},
 directory:{t:'族人名录',area:'v',root:1,r:R.directory},
 member:{t:'族人详情',area:'v',r:R.member},
 reader:{t:'原谱翻阅',area:'v',r:R.reader,right:function(){ return '<button class="g-hrbtn" data-act="toc-open">'+ic('menu',17)+'目录</button>'; }},
 apply:{t:'申请变更',area:'v',r:R.apply,init:function(){ S.evApply=[]; }},
 login:{t:'管理员登录',area:'a',r:R.login},
 dashboard:{t:'工作台',area:'a',root:1,r:R.dashboard},
 capture:{t:'拍照录入',area:'a',root:1,r:R.capture,init:capInit,guard:function(){ return S.capStep>1&&S.capStep<5; }},
 members:{t:'族人维护',area:'a',root:1,r:R.members},
 medit:{t:'编辑族人',area:'a',r:R.medit},
 review:{t:'变更审核',area:'a',root:1,r:R.review},
 revdetail:{t:'审核详情',area:'a',r:R.revdetail},
 book:{t:'原谱管理',area:'a',root:1,r:R.book}
};
SCREENS.home.right=function(){ return S.loggedIn?'':'<button class="g-hrbtn" data-go="login">'+ic('user',16)+'管理员</button>'; };

/* ================= 导航 ================= */
var meName='管理员';
function go(id,params,push){
 var s=SCREENS[id]; if(!s) return;
 params=params||{};
 if(push===undefined) push=true;
 if(s.area==='a'&&!S.loggedIn){ toast('请先登录管理端','warn'); id='login'; s=SCREENS[id]; params={}; }
 if(id==='reader'&&params&&params.page){ S.readerPage=params.page; delete params.page; }
 if(push&&S.cur&&S.cur!==id) S.stack.push({id:S.cur,params:S.params});
 S.cur=id; S.params=params;
 if(s.init) s.init(params);
 paint();
}
function back(){
 var prev=S.stack.pop()||{id:S.loggedIn?'dashboard':'home',params:{}};
 S.cur=prev.id; S.params=prev.params; paint();
}
function tabTo(id){
 var s=SCREENS[id]; if(!s) return;
 if(s.area==='a'&&!S.loggedIn){ S.stack=[]; S.cur='login'; S.params={}; paint(); return; }
 if(S.cur!==id&&S.cur==='capture'&&SCREENS.capture.guard&&SCREENS.capture.guard()){
  confirmSheet('录入尚未完成','切换页面将丢弃本页已填的内容，确定退出吗？','确定退出','g-danger-line',function(){
   S.capStep=1; tabTo(id);
  });
  return;
 }
 S.stack=[]; S.cur=id; S.params={};
 if(s.init) s.init({});
 paint();
}
var ACTIVE_MAP={member:'directory',reader:'catalog',revdetail:'review',medit:'members',apply:'home',login:'home'};
function paint(){
 var s=SCREENS[S.cur]; if(!s) return;
 var app=$('#gz-proto');
 app.classList.remove('g-fs1','g-fs2');
 if(S.fs==='1') app.classList.add('g-fs1');
 if(S.fs==='2') app.classList.add('g-fs2');
 var title=s.t;
 if(S.cur==='member'&&S.params.id) title='族人详情';
 if(S.cur==='medit') title=S.params.id?'编辑族人':'新增族人';
 $('#gz-head').innerHTML=(s.root?'':'<button class="g-hback" data-act="back">'+ic('back',19)+'返回</button>')
  +'<div class="g-htitle">'+esc(title)+'</div>'
  +'<div class="g-hright">'+(s.right?s.right():'')+'</div>';
 var b=$('#gz-body');
 var seq=++S.seq;
 b.innerHTML='<div class="g-loading">加载中…</div>';
 Promise.resolve(s.r(S.params)).then(function(html){
  if(seq!==S.seq) return;
  b.innerHTML=html;
  b.scrollTop=0;
  if(S.cur==='tree'){ var tw=document.getElementById('gz-treewrap'); if(tw) tw.scrollLeft=Math.max(0,(tw.scrollWidth-tw.clientWidth)/2); }
 }).catch(function(e){
  if(seq!==S.seq) return;
  b.innerHTML='<div class="g-empty">'+esc(e.message||'加载失败')+(e.status===401?'<br><br><button class="g-btn g-line" style="width:auto;display:inline-flex" data-go="login">去登录</button>':'')+'</div>';
 });
 var adminArea=s.area==='a'&&S.loggedIn;
 $('#gz-tabs-v').classList.toggle('g-hidden',adminArea);
 $('#gz-tabs-a').classList.toggle('g-hidden',!adminArea);
 var actRoot=ACTIVE_MAP[S.cur]||S.cur;
 $$('#gz-tabs-v .g-tab,#gz-tabs-a .g-tab').forEach(function(t){ t.classList.toggle('g-on',t.dataset.tab===actRoot); });
 $('#gz-clock').textContent=new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});
 closeToc(); closeSheet();
}

/* ---- 底部导航 ---- */
function tbtn(id,t,icn,badge){
 return '<button class="g-tab" data-tab="'+id+'">'+ic(icn,21)+'<span>'+t+'</span>'
  +(badge?'<i class="g-badge" id="gz-revbadge">0</i>':'')+'</button>';
}
$('#gz-tabs-v').innerHTML=
 tbtn('home','首页','home')+tbtn('tree','世系图','tree')+tbtn('catalog','原谱','book')+tbtn('directory','名录','users');
$('#gz-tabs-a').innerHTML=
 tbtn('dashboard','工作台','home')+tbtn('capture','录入','camera')+tbtn('members','族人','users')+tbtn('review','审核','clip',true)+tbtn('book','原谱','layers');

/* ================= 弹层 / 提醒 ================= */
var SHEET_ACTS=[];
function openSheet(o){
 var el=$('#gz-sheet');
 el.innerHTML='<div class="g-mbg" data-act="sheet-close"></div><div class="g-mpanel">'
  +'<div class="g-shtitle">'+esc(o.title)+'<button class="g-shx" data-act="sheet-close">'+ic('x',20)+'</button></div>'
  +'<div class="g-shbody">'+o.html+'</div>'
  +'<div class="g-shacts">'+o.acts.map(function(a,i){
    return '<button class="g-btn '+(a.cls||'')+'" data-act="sheet-act" data-k="'+i+'">'+esc(a.t)+'</button>';
  }).join('')+'</div></div>';
 el.classList.add('g-show');
 SHEET_ACTS=o.acts||[];
}
function closeSheet(){ var el=$('#gz-sheet'); el.classList.remove('g-show'); el.innerHTML=''; SHEET_ACTS=[]; }
function confirmSheet(title,text,okT,okCls,fn){
 openSheet({title:title,html:'<p class="g-shtext">'+text+'</p>',acts:[
  {t:'取消',cls:'g-line'},
  {t:okT,cls:okCls||'',fn:fn}
 ]});
}
function closeToc(){ var el=$('#gz-toc'); el.classList.remove('g-show'); }
var toastTimer=null;
function toast(msg,type){
 var el=$('#gz-toast');
 el.innerHTML=ic(type==='warn'?'alert':'check',18)+'<span>'+esc(msg)+'</span>';
 el.classList.toggle('g-warn',type==='warn');
 el.classList.add('g-show');
 clearTimeout(toastTimer);
 toastTimer=setTimeout(function(){ el.classList.remove('g-show'); },2400);
}

/* ================= 录入流程动作 ================= */
function capOcr(){
 var cap=S.cap;
 if(!cap.imgBlob&&!cap.img){ toast('请先拍摄谱页','warn'); S.capStep=1; paint(); return; }
 var send=function(blob){
  var fd=new FormData();
  if(blob) fd.append('image',blob,'page.jpg');
  api('/pages/'+cap.page+'/recognize',{method:'POST',body:fd}).then(function(r){
   cap.records=(r.records&&r.records.length)?r.records:[{}];
   cap.recIdx=0;
   cap.ocrMsg=r.message||'识别完成，请逐项核对修改。';
   S.capStep=3;
   paint();
   if(!r.records||!r.records.length) toast('未识别到内容，请手动录入','warn');
   else toast('识别到 '+r.records.length+' 条记录');
  }).catch(function(e){ toast(e.message,'warn'); });
 };
 if(cap.imgBlob) send(cap.imgBlob);
 else examplePhoto().then(send);
}
function capFinish(){
 var cap=S.cap;
 capReadFields();
 var picked=cap.records.filter(function(r,i){ return cap.picked[i]!==false; });
 for(var i=0;i<picked.length;i++){
  if(!(picked[i].name||'').trim()){ toast('第 '+(i+1)+' 条记录缺少姓名，请回到上一步核对','warn'); return; }
 }
 if(!picked.length&&!cap.links.length){ toast('请至少勾选一条记录或关联一位族人','warn'); return; }
 confirmSheet('确认完成录入？','完成后将创建 '+picked.length+' 位族人并与原谱第 '+cap.page+' 页建立关联。','确认完成','g-green',function(){
  api('/pages/'+cap.page+'/confirm',{method:'POST',body:{
   records:picked.map(function(r){ return {truth_id:r.truth_id,name:r.name,zi:r.zi,gen:r.gen,birth:r.birth,death:r.death,father_name:r.father_name,spouse:r.spouse,intro:r.intro}; }),
   link_member_ids:cap.links.map(function(l){ return l.id; })
  }}).then(function(r){
   cap.done=true; S.capStep=5;
   cap.doneMsg=(r.created&&r.created.length?r.created.length+' 位族人已录入':'已关联 '+r.linked+' 位已有族人')+'，';
   paint();
   toast('录入成功');
  }).catch(function(e){ toast(e.message,'warn'); });
 });
}

/* ================= 动作表 ================= */
var ACT={
 'back':function(){
  var s=SCREENS[S.cur];
  if(s&&s.guard&&s.guard()){
   confirmSheet('录入尚未完成','退出后将丢弃本页已填的内容，确定退出吗？','确定退出','g-danger-line',function(){ S.capStep=1; back(); });
  }else back();
 },
 'sheet-close':function(){ closeSheet(); },
 'sheet-act':function(el){
  var a=SHEET_ACTS[+el.dataset.k];
  var keep=false;
  if(a&&a.fn) keep=(a.fn()===false);
  if(!keep) closeSheet();
 },
 'fs':function(el){ S.fs=el.dataset.v; store.set('gz_fs',S.fs); paint(); toast('字号已切换为「'+['标准','大字','特大'][+S.fs]+'」'); },
 'zoom':function(el){
  S.zoom=Math.min(1.45,Math.max(0.6,S.zoom+(el.dataset.v==='+'?0.15:-0.15)));
  var t=$('#gz-tree'); if(t){ t.style.transform='scale('+S.zoom+')'; t.style.transformOrigin='top center'; }
 },
 'tree-x':function(el){ loadKids(el.dataset.id,el); },
 'toc-open':function(){ S.tocPage=1; openToc(); },
 'toc-close':function(){ closeToc(); },
 'toc-vol':function(el){ S.tocVol=+el.dataset.v; S.tocPage=1; renderTocBody(); },
 'toc-pg':function(el){ S.tocPage+=el.dataset.v==='next'?1:-1; renderTocBody(); },
 'toc-jump':function(){
  var v=parseInt(($('#gz-jump')||{}).value,10);
  if(!v||v<1){ toast('请输入页码','warn'); return; }
  closeToc(); go('reader',{page:v},false);
 },
 'booktap':function(el,e){
  if(e.target.closest('.g-lk')) return;
  if(!e.clientX) return;
  var r=el.getBoundingClientRect();
  flip((e.clientX-r.left)<r.width/2?'prev':'next');
 },
 'flip':function(el){ flip(el.dataset.v); },
 'photo-view':function(el){
  openSheet({title:'第 '+el.dataset.page+' 页 · 拍摄原图',
   html:'<img class="g-photo" src="'+esc(el.dataset.src)+'" alt="谱页原图">',
   acts:[{t:'关闭',cls:'g-line'}]});
 },
 'dir-gen':function(el){ S.dirGen=+el.dataset.v; S.dirPage=1; paint(); },
 'dir-pg':function(el){ S.dirPage+=el.dataset.v==='next'?1:-1; refreshDir(); },
 'm-pg':function(el){ S.mPage+=el.dataset.v==='next'?1:-1; refreshMembers(); },
 'rev-pg':function(el){ S.revPage+=el.dataset.v==='next'?1:-1; paint(); },
 'book-vol':function(el){ S.bookVol=+el.dataset.v; S.bookPage=1; paint(); },
 'book-pg':function(el){ S.bookPage+=el.dataset.v==='next'?1:-1; paint(); },
 'pcell':function(el){ openPageSheet(+el.dataset.n); },
 'cap-this':function(el){ go('capture',{page:+el.dataset.page||S.readerPage}); },
 'login':function(){
  var u=$('#gz-lu'),p=$('#gz-lp');
  if(!u.value.trim()||!p.value.trim()){ toast('请输入账号和密码','warn'); return; }
  api('/login',{method:'POST',body:{username:u.value.trim(),password:p.value}}).then(function(r){
   TOKEN=r.token; store.set('gz_token',TOKEN);
   S.loggedIn=true; meName=r.username;
   toast('登录成功，欢迎回来');
   S.stack=[]; S.cur='dashboard'; S.params={}; paint();
  }).catch(function(e){ toast(e.message,'warn'); });
 },
 'login-back':function(){ S.stack=[]; S.cur='home'; S.params={}; paint(); },
 'logout':function(){
  confirmSheet('退出登录','退出后将返回访客浏览端，管理功能不可用。','退出登录','g-danger-line',function(){
   api('/logout',{method:'POST'}).catch(function(){});
   TOKEN=null; store.del('gz_token'); S.loggedIn=false;
   S.stack=[]; S.cur='home'; S.params={}; paint(); toast('已退出登录');
  });
 },
 'apply-for':function(el){ go('apply',{type:'修改信息',target:el.dataset.id}); },
 'ev-add-apply':function(){ var f=$('#gz-file'); f.dataset.for='apply'; f.click(); },
 'ev-del-apply':function(el){ S.evApply.splice(+el.dataset.i,1); paint(); },
 'apply-submit':function(){
  var desc=$('#gz-adesc');
  var fw=$('#gz-af');
  if(!desc.value.trim()){
   fw.classList.add('g-invalid'); desc.focus();
   toast('请先填写变更内容','warn'); return;
  }
  fw.classList.remove('g-invalid');
  var type=document.querySelector('input[name="gz-appt"]:checked');
  openSheet({title:'确认提交申请？',
   html:'<p class="g-shtext">提交后由谱馆管理员审核，审核期间现有资料保持不变。</p>',
   acts:[{t:'再看看',cls:'g-line'},{t:'确认提交',fn:function(){
    api('/requests',{method:'POST',body:{
     type:type?type.value:'修改信息', target_id:S.params.target||null,
     content:desc.value.trim(), applicant:$('#gz-aapp').value.trim(),
     evidence:S.evApply.length?S.evApply.length+' 张佐证图片':''
    }}).then(function(r){
     $('#gz-body').innerHTML='<div class="g-done"><div class="g-doneseal">'+ic('check',42)+'</div>'
      +'<h2>申请已提交</h2><p>申请编号 No.'+r.id+'<br>管理员将在 7 日内完成审核，<br>处理结果不影响现有资料</p>'
      +'<button class="g-btn" data-act="done-home">返回首页</button>'
      +'<div style="height:10px"></div>'
      +'<button class="g-btn g-line" data-act="done-back">返回上一页</button></div>';
     toast('提交成功，感谢您的贡献');
    }).catch(function(e){ toast(e.message,'warn'); });
   }}]});
 },
 'cap-pick':function(){ var f=$('#gz-file'); f.dataset.for='cap'; f.click(); },
 'cap-example':function(){
  examplePhoto().then(function(b){
   var rd=new FileReader();
   rd.onload=function(ev){ S.cap.img=ev.target.result; S.cap.photo='example'; paint(); toast('已载入示例谱页'); };
   rd.readAsDataURL(b);
   S.cap.imgBlob=b;
  });
 },
 'vol':function(el){ S.cap.vol=+el.dataset.id; S.cap.autoPage=true; S.cap.page=0; S.capStep=2; paint(); },
 'page-dn':function(){ S.cap.page=Math.max(1,S.cap.page-1); S.cap.autoPage=false; paint(); },
 'page-up':function(){ S.cap.page=Math.min((statsCache.pages||99999),S.cap.page+1); S.cap.autoPage=false; paint(); },
 'cap-next':function(){
  var cap=S.cap;
  if(!cap.imgBlob&&!cap.img){ toast('请先拍摄谱页，或使用示例谱页','warn'); return; }
  S.capStep=2; paint();
 },
 'cap-ocr':function(){ capOcr(); },
 'cap-rec':function(el){ capReadFields(); S.cap.recIdx=+el.dataset.v; paint(); },
 'cap-save-rec':function(){ capReadFields(); toast('已暂存本条修改'); },
 'cap-next2':function(){
  var cap=S.cap;
  capReadFields();
  var cur=cap.records[cap.recIdx];
  if(cur&&!(cur.name||'').trim()){
   $('#gz-cnf').classList.add('g-invalid');
   toast('请填写族人姓名','warn'); return;
  }
  cap.picked=cap.picked||{};
  S.capStep=4; paint();
 },
 'cap-back':function(){ if(S.capStep>1){ S.capStep--; paint(); } },
 'cap-finish':function(){ capFinish(); },
 'cap-again':function(){
  S.cap=null; S.capStep=1; capInit({}); paint(); toast('已定位到下一待录入页');
 },
 'done-dash':function(){ S.stack=[]; S.cur='dashboard'; S.params={}; paint(); },
 'done-back':function(){ back(); },
 'done-home':function(){ S.stack=[]; S.cur='home'; S.params={}; paint(); },
 'link-del':function(el,e){
  e.stopPropagation();
  S.cap.links.splice(+el.dataset.i,1); paint();
 },
 'link-add':function(el){
  var cap=S.cap; if(!cap) return;
  var id=+el.dataset.id;
  var exists=cap.links.some(function(l){ return l.id===id; });
  if(!exists) cap.links.push({id:id,name:el.dataset.name,gen:+el.dataset.gen});
  paint();
 },
 'father-pick':function(el){
  S.medFather={id:+el.dataset.id,name:el.dataset.name,gen:+el.dataset.gen};
  paint();
 },
 'medit-save':function(){
  var name=$('#gz-en');
  if(!name.value.trim()){ $('#gz-ef1').classList.add('g-invalid'); toast('请填写姓名','warn'); return; }
  confirmSheet('保存修改？','保存后访客端立即看到最新资料。','确认保存','g-green',function(){
   var body={name:name.value.trim(),gen:+$('#gz-eg').value,zi:$('#gz-ez').value.trim(),hao:$('#gz-eh').value.trim(),
    birth:$('#gz-eb').value.trim(),death:$('#gz-ed').value.trim(),father_id:S.medFather?S.medFather.id:null,
    spouse:$('#gz-es').value.trim(),intro:$('#gz-ei').value.trim()};
   var call=S.params.id
    ?api('/members/'+S.params.id,{method:'PUT',body:body})
    :api('/members',{method:'POST',body:body});
   call.then(function(){
    S.medFor=null; S.medFather=null;
    toast(S.params.id?'已保存修改':'新增族人成功');
    back();
   }).catch(function(e){ toast(e.message,'warn'); });
  });
 },
 'member-del':function(el){
  confirmSheet('删除族人','确定删除「'+esc(el.dataset.name)+'」吗？此操作不可恢复。','确认删除','g-danger-line',function(){
   api('/members/'+el.dataset.id,{method:'DELETE'}).then(function(){
    toast('已删除');
    back();
   }).catch(function(e){ toast(e.message,'warn'); });
  });
 },
 'father-clear':function(){ S.medFather=null; paint(); },
 'revtab':function(el){ S.revTab=el.dataset.v; S.revPage=1; paint(); },
 'rev-approve':function(){
  var rid=S.params.id;
  confirmSheet('确认通过该申请？','通过后族人信息将立即更新，并向申请人展示处理结果。','确认通过','g-green',function(){
   api('/requests/'+rid+'/approve',{method:'POST'}).then(function(){
    toast('已通过，族人信息已更新');
    back();
   }).catch(function(e){ toast(e.message,'warn'); });
  });
 },
 'rev-reject':function(){
  var rid=S.params.id;
  openSheet({title:'驳回申请',
   html:'<p class="g-shtext">请填写驳回理由，将反馈给申请人：</p><textarea class="g-textarea" id="gz-rj" style="min-height:84px" placeholder="如：所引资料与原谱不符…"></textarea>',
   acts:[{t:'取消',cls:'g-line'},{t:'确认驳回',cls:'g-danger-line',fn:function(){
    var rs=$('#gz-rj').value.trim();
    if(!rs){ toast('请填写驳回理由','warn'); return false; }
    api('/requests/'+rid+'/reject',{method:'POST',body:{reason:rs}}).then(function(){
     toast('已驳回并反馈申请人');
     back();
    }).catch(function(e){ toast(e.message,'warn'); });
   }}]});
 }
};

/* ================= 事件委托 ================= */
document.addEventListener('click',function(e){
 var t=e.target;
 var tabEl=t.closest('[data-tab]');
 if(tabEl){ tabTo(tabEl.dataset.tab); return; }
 var goEl=t.closest('[data-go]');
 if(goEl){
  var to=goEl.dataset.go;
  closeSheet(); closeToc();
  if(to==='member') go('member',{id:goEl.dataset.id});
  else if(to==='reader') go('reader',{page:+goEl.dataset.page});
  else if(to==='medit') go('medit',{id:goEl.dataset.id||''});
  else if(to==='revdetail') go('revdetail',{id:goEl.dataset.id});
  else go(to);
  return;
 }
 var actEl=t.closest('[data-act]');
 if(actEl){
  var fn=ACT[actEl.dataset.act];
  if(fn) fn(actEl,e);
  return;
 }
});
document.addEventListener('change',function(e){
 var t=e.target;
 if(t.name==='gz-appt'){
  $$('input[name="gz-appt"]').forEach(function(i){ i.closest('.g-rcard').classList.toggle('g-on',i.checked); });
 }
 if(t.dataset&&t.dataset.rindex!==undefined){
  var cap=S.cap; if(cap){ cap.picked=cap.picked||{}; cap.picked[+t.dataset.rindex]=t.checked; }
  t.closest('.g-check').classList.toggle('g-on',t.checked);
 }
});
var dirTimer=null, mTimer=null, lkTimer=null, fTimer=null;
document.addEventListener('input',function(e){
 var t=e.target;
 if(t.id==='gz-dq'){
  clearTimeout(dirTimer);
  dirTimer=setTimeout(function(){ S.dirQ=t.value; S.dirPage=1; refreshDir(); },250);
 }
 if(t.id==='gz-mq'){
  clearTimeout(mTimer);
  mTimer=setTimeout(function(){ S.mQ=t.value; S.mPage=1; refreshMembers(); },250);
 }
 if(t.id==='gz-lkq'){
  clearTimeout(lkTimer);
  var q=t.value.trim();
  lkTimer=setTimeout(function(){
   if(!q){ $('#gz-lkres').innerHTML=''; return; }
   api('/members'+qs({q:q,size:8})).then(function(r){
    var el=$('#gz-lkres'); if(!el) return;
    el.innerHTML=r.items.length
     ?'<div class="g-picklist">'+r.items.map(function(m){
       return '<div class="g-pickitem" data-act="link-add" data-id="'+m.id+'" data-name="'+esc(m.name)+'" data-gen="'+m.gen+'"><b>'+esc(m.name)+'</b><span>'+cnGen(m.gen)+(m.zi?' · 字'+esc(m.zi):'')+'</span></div>';
      }).join('')+'</div>'
     :'<div class="g-hint" style="text-align:center">未找到相关族人</div>';
   }).catch(function(){});
  },250);
 }
 if(t.id==='gz-fq'){
  clearTimeout(fTimer);
  var q2=t.value.trim();
  fTimer=setTimeout(function(){
   var gen=+(($('#gz-eg')||{}).value||4);
   api('/members'+qs({q:q2,gen:Math.max(1,gen-1),size:8})).then(function(r){
    var el=$('#gz-fres'); if(!el) return;
    el.innerHTML=r.items.length
     ?'<div class="g-picklist">'+r.items.map(function(m){
       return '<div class="g-pickitem" data-act="father-pick" data-id="'+m.id+'" data-name="'+esc(m.name)+'" data-gen="'+m.gen+'"><b>'+esc(m.name)+'</b><span>'+cnGen(m.gen)+(m.birth?' · '+shortDate(m.birth):'')+'</span></div>';
      }).join('')+'</div>'
     :'<div class="g-hint" style="text-align:center">'+cnGen(Math.max(1,gen-1))+'未找到，可留空</div>';
   }).catch(function(){});
  },250);
 }
});
function bindFile(){
 $('#gz-file').addEventListener('change',function(e){
  var f=e.target.files&&e.target.files[0]; if(!f) return;
  var use=e.target.dataset.for;
  if(use==='cap'){
   S.cap.imgBlob=f;
   var rd=new FileReader();
   rd.onload=function(ev){ S.cap.img=ev.target.result; paint(); toast('照片已添加'); };
   rd.readAsDataURL(f);
  }else if(use==='apply'){
   var rd2=new FileReader();
   rd2.onload=function(ev){
    if(S.evApply.length>=2){ toast('最多上传 2 张佐证图片','warn'); return; }
    S.evApply.push(ev.target.result); paint(); toast('图片已添加');
   };
   rd2.readAsDataURL(f);
  }else if(use==='photo'){
   var fd=new FormData();
   fd.append('image',f,f.name);
   api('/pages/'+e.target.dataset.page+'/photo',{method:'POST',body:fd}).then(function(r){
    toast('照片已保存');
    closeSheet();
    paint();
   }).catch(function(err){ toast(err.message,'warn'); });
  }
  e.target.value='';
 });
}
bindFile();

/* 触摸滑动翻页 */
var touchX=null;
document.addEventListener('touchstart',function(e){
 if(e.target.closest&&e.target.closest('#gz-book')) touchX=e.touches[0].clientX;
},{passive:true});
document.addEventListener('touchend',function(e){
 if(touchX!=null&&e.target.closest&&e.target.closest('#gz-book')){
  var dx=e.changedTouches[0].clientX-touchX;
  if(dx<-40) flip('next'); else if(dx>40) flip('prev');
 }
 touchX=null;
},{passive:true});

/* ================= 启动 ================= */
function boot(){
 // 深度链接：#/page/N 直达原谱页，#/member/ID 直达族人详情
 var mh=location.hash.match(/^#\/page\/(\d+)/);
 var mu=location.hash.match(/^#\/member\/(\d+)/);
 if(mh){
  S.cur='reader'; S.params={}; S.readerPage=+mh[1]; paint(); return;
 }
 if(mu){
  S.cur='member'; S.params={id:+mu[1]}; paint(); return;
 }
 if(TOKEN){
  api('/me').then(function(r){ meName=r.username; go('dashboard',{},false); })
   .catch(function(){ go('home',{},false); });
 }else go('home',{},false);
}
boot();
})();
