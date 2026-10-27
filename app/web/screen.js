/* 智慧族谱 · 大屏驾驶舱逻辑 */
(function(){
'use strict';
var $=function(s){ return document.querySelector(s); };
var $$=function(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); };
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
var GEN_CN=['零','一','二','三','四','五','六','七','八','九','十'];
function cnGen(g){ if(g<=10) return '第'+GEN_CN[g]+'世'; if(g<20) return '第十'+GEN_CN[g-10]+'世'; if(g===20) return '第二十世'; if(g<30) return '第二十'+GEN_CN[g-20]+'世'; return '第三十世'; }
function fmtN(n){ return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function shortDate(s){ return String(s||'').split('（')[0]; }

function api(path){
  return fetch('/api'+path).then(function(r){
    return r.json().then(function(d){
      if(!r.ok){ var e=new Error(d.error||('请求失败 '+r.status)); e.status=r.status; throw e; }
      return d;
    });
  });
}

/* ================= 状态 ================= */
var D=null;                    // /api/screen 数据
var treeRoot={id:null,name:'王德明',zi:'启蒙',spouse:'赵氏',gen:1,children:0,isRoot:true};
var childCache={};             // id -> children 数组
var nodeState={};              // id -> 'open' | 'closed'（显式覆盖默认层级）
var depthLimit=3;
var selectedId=null;

/* ================= 顶栏与左列 ================= */
function renderHeader(){
  $('#hd-stats').innerHTML=[
    ['members','族人总数'],['gens','世代'],['volumes','卷册'],['pages','谱页'],
    ['linked_pages','已关联页'],['truth_records','待录入']
  ].map(function(x){
    return '<div class="hstat"><b>'+fmtN(D[x[0]])+'</b><span>'+x[1]+'</span></div>';
  }).join('');
  var ys=D.year_span||[];
  $('#hd-span').textContent=ys.length===2?('公元 '+ys[0]+' — '+ys[1]+' 年'):'';
}

function renderDyn(){
  var dyn=D.dynasties||[];
  var max=Math.max.apply(null, dyn.map(function(d){ return d.n; }).concat([1]));
  $('#p-dyn').innerHTML=dyn.map(function(d){
    var w=Math.max(4, Math.round(d.n/max*100));
    return '<div class="dynrow"><span class="k">'+esc(d.d)+'</span>'
     +'<div class="bar"><i style="width:'+w+'%"></i></div>'
     +'<span class="v"><b>'+fmtN(d.n)+'</b> 人</span></div>';
  }).join('');
}

function renderGenBars(){
  var gc=D.gen_counts, max=Math.max.apply(null, gc.concat([1]));
  var bars='', axis='';
  for(var g=1; g<=gc.length; g++){
    var h=Math.max(3, Math.round(gc[g-1]/max*100));
    bars+='<div class="gbar" data-gen="'+g+'" title="'+cnGen(g)+' · '+fmtN(gc[g-1])+' 人"><i style="height:'+h+'%"></i></div>';
    axis+=(g%5===0||g===1)?'<div class="gbar axis"><span>'+cnGen(g).replace('第','').replace('世','')+'</span></div>':'<div class="gbar axis"><span>&nbsp;</span></div>';
  }
  var married=D.married||0;
  $('#p-gen').innerHTML='<div class="genbar-wrap"><div class="genbars">'+bars+'</div>'
   +'<div class="genside"><div><b>'+fmtN(gc[gc.length-1])+'</b> 人（第'+(gc.length)+'世）</div>'
   +'<div>婚配 <b>'+Math.round(married/D.members*100)+'%</b></div>'
   +'<div>无后嗣 <b>'+fmtN(D.childless)+'</b> 人</div>'
   +'<div style="color:#6b7382">柱形可点击</div></div></div>'
   +'<div style="display:flex;gap:3px;margin-top:6px">'+axis+'</div>';
}

function renderBranches(){
  var br=D.branches||[];
  var max=Math.max.apply(null, br.map(function(b){ return b.descendants; }).concat([1]));
  $('#p-branch').innerHTML=br.map(function(b){
    var w=Math.max(4, Math.round(b.descendants/max*100));
    return '<div class="br" data-act="reroot" data-id="'+b.id+'" data-name="'+esc(b.name)+'">'
     +'<div class="t"><b>'+esc(b.name)+'</b><span>'+cnGen(b.gen)+(b.zi?' · 字'+esc(b.zi):'')+'</span>'
     +'<span class="n">后嗣 '+fmtN(b.descendants)+' 人</span></div>'
     +'<div class="bar"><i style="width:'+w+'%"></i></div></div>';
  }).join('');
}

function renderProgress(){
  var pct=D.pages?Math.round(D.linked_pages/D.pages*100):0;
  var R=46, C=2*Math.PI*R;
  var req=D.requests||{};
  var pend=req.pending||0, app=req.approved||0, rej=req.rejected||0;
  $('#p-progress').innerHTML='<div class="prog">'
   +'<div class="donut"><svg width="110" height="110">'
   +'<circle cx="55" cy="55" r="'+R+'" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="9"/>'
   +'<circle cx="55" cy="55" r="'+R+'" fill="none" stroke="#6fae8f" stroke-width="9" stroke-linecap="round"'
   +' stroke-dasharray="'+(C*pct/100).toFixed(1)+' '+C.toFixed(1)+'"/>'
   +'</svg><div class="c"><div><b>'+pct+'%</b><span>页面关联率</span></div></div></div>'
   +'<div class="rows">'
   +'<div class="r"><span>已关联谱页</span><b class="jade">'+fmtN(D.linked_pages)+' / '+fmtN(D.pages)+'</b></div>'
   +'<div class="r"><span>待录入真值</span><b class="gold">'+fmtN(D.truth_records)+' 条</b></div>'
   +'<div class="r"><span>族人总数</span><b>'+fmtN(D.members)+'</b></div>'
   +'</div></div>'
   +'<div class="chiprow">'
   +'<span class="rchip p">待审申请 '+pend+'</span>'
   +'<span class="rchip a">已通过 '+app+'</span>'
   +'<span class="rchip r">已驳回 '+rej+'</span>'
   +'</div>';
}

/* ================= 世系树 ================= */
function isOpen(m, depth){
  var st=nodeState[m.id];
  if(st==='open') return true;
  if(st==='closed') return false;
  return depth<depthLimit;
}
function nodeHTML(m, open){
  var sel=m.id===selectedId?' sel':'';
  var pill='';
  if(m.children>0){
    pill='<button class="tpill" data-act="toggle" data-id="'+m.id+'" data-open="'+(open?1:0)+'">'
      +(open?'▾ '+m.children+' 子':'▸ '+m.children+' 子')+'</button>';
  }
  return '<div class="tnode'+sel+'" data-act="detail" data-id="'+m.id+'">'
   +'<b>'+esc(m.name)+'</b>'
   +'<span class="s">'+(m.zi?'字'+esc(m.zi):'&nbsp;')+'</span>'
   +'<span class="w">'+(m.spouse?'配 '+esc(m.spouse):'')+'</span>'
   +pill+'</div>';
}

function buildBranch(m, depth){
  var open=isOpen(m, depth);
  var kids='';
  if(open&&m.children>0){
    var kidsArr=childCache[m.id];
    if(kidsArr){
      kids='<ul>'+kidsArr.map(function(k){ return buildBranch(k, depth+1); }).join('')+'</ul>';
    }else{
      kids='<ul><li><div class="tmore">载入中…</div></li></ul>';
      if(!pending[m.id]){
        pending[m.id]=true;
        fetchKids(m.id);
      }
    }
  }
  return '<li>'+nodeHTML(m, open)+kids+'</li>';
}
var pending={};

function fetchKids(id){
  api('/tree/children/'+id).then(function(r){
    childCache[id]=r.items;
    delete pending[id];
    renderTree();
  }).catch(function(){ delete pending[id]; });
}

function renderTree(){
  $('#tree').innerHTML='<ul>'+buildBranch(treeRoot, 1)+'</ul>';
  // 定位选中节点
  if(selectedId){
    var el=document.querySelector('.tnode[data-id="'+selectedId+'"]');
    if(el) el.scrollIntoView({block:'nearest', inline:'nearest'});
  }
}

/* ================= 明细 ================= */
function showDetail(id){
  selectedId=id;
  renderTree();
  $('#d-title').textContent='族人明细';
  $('#d-back').hidden=true;
  $('#p-detail').innerHTML='<div class="hint">加载中…</div>';
  api('/members/'+id).then(function(d){
    var m=d.member;
    var pages=d.pages||[];
    $('#p-detail').innerHTML='<div class="dcard">'
     +'<div class="dname"><div class="dava">'+esc(m.name.slice(1)||m.name)+'</div>'
     +'<div><h4>'+esc(m.name)+'</h4><span class="g">'+cnGen(m.gen)+'</span></div></div>'
     +'<div class="kvs">'
     +kv('生于',m.birth)+kv('卒于',m.death)+kv('字',m.zi)+kv('号',m.hao)
     +kv('配偶',m.spouse)+kv('子女',d.children.length?d.children.length+' 人':'—')
     +'</div>'
     +(d.father?'<div class="kvs" style="grid-template-columns:1fr"><div class="kv"><span>父亲</span><b style="cursor:pointer;color:var(--gold)" data-act="detail" data-id="'+d.father.id+'">'+esc(d.father.name)+'（'+cnGen(d.father.gen)+'）</b></div></div>':'')
     +'<div class="dintro">'+esc(m.intro||'暂无记载')+'</div>'
     +(pages.length?'<div class="dpages">'+pages.map(function(p){ return '<span class="dpage" data-act="open-page" data-page="'+p.page_no+'">'+esc(p.vol_title.split(' ·')[0])+' · 第 '+p.page_no+' 页 ↗</span>'; }).join('')+'</div>':'')
     +'</div>';
  }).catch(function(e){ $('#p-detail').innerHTML='<div class="hint">'+esc(e.message)+'</div>'; });
}
function kv(k,v){ return '<div class="kv"><span>'+k+'</span><b>'+(v?esc(v):'—')+'</b></div>'; }

function showGenList(gen){
  $('#d-title').textContent=cnGen(gen)+' · 族人名录';
  $('#d-back').hidden=false;
  $('#p-detail').innerHTML='<div class="hint">加载中…</div>';
  api('/members?gen='+gen+'&size=100').then(function(r){
    $('#p-detail').innerHTML='<div class="dlist" style="max-height:44vh">'
     +(r.items.length?r.items.map(function(m){
        return '<div class="drow" data-act="detail" data-id="'+m.id+'"><b>'+esc(m.name)+'</b>'
         +'<span>'+(m.zi?'字'+esc(m.zi):'')+'</span><span>'+esc(shortDate(m.birth))+'</span>'
         +'<span style="margin-left:auto">'+((m.pages_n||0)?'谱 '+m.pages_n+' 页':'未关联')+'</span></div>';
      }).join(''):'<div class="hint">暂无记录</div>')
     +'</div>'
     +(r.total>100?'<div class="hint">仅显示前 100 人，可用中列搜索精确定位。</div>':'');
  }).catch(function(e){ $('#p-detail').innerHTML='<div class="hint">'+esc(e.message)+'</div>'; });
}

/* ================= 交互 ================= */
document.addEventListener('click',function(e){
  var t=e.target;
  var act=t.closest('[data-act]');
  if(!act) return;
  var kind=act.dataset.act;
  if(kind==='detail'){ showDetail(+act.dataset.id); return; }
  if(kind==='open-page'){ window.open('/#/page/'+act.dataset.page, '_blank'); return; }
  if(kind==='reroot'){
    var rid=+act.dataset.id;
    toast('正在定位支系：'+act.dataset.name);
    api('/members/'+rid).then(function(d){
      treeRoot={id:rid,name:d.member.name,zi:d.member.zi,spouse:d.member.spouse,
        gen:d.member.gen,children:d.children.length};
      selectedId=null;
      $('#btn-root0').hidden=false;
      nodeState={}; childCache={}; pending={};
      renderTree();
    }).catch(function(e){ toast(e.message); });
    return;
  }
  if(kind==='toggle'){
    var id=+act.dataset.id;
    var openNow=act.dataset.open==='1';
    nodeState[id]=openNow?'closed':'open';
    if(!openNow&&!childCache[id]&&!pending[id]){
      pending[id]=true;
      fetchKids(id);
    }else renderTree();
    return;
  }
});

$('#tree-depth').addEventListener('input',function(e){
  depthLimit=+e.target.value;
  $('#tree-depth-v').textContent=depthLimit+' 世';
  renderTree();
});
$('#btn-collapse').addEventListener('click',function(){
  depthLimit=1; $('#tree-depth').value=1; $('#tree-depth-v').textContent='1 世';
  nodeState={}; childCache={}; pending={}; renderTree();
});
$('#btn-root0').addEventListener('click',function(){
  treeRoot={id:null,name:'王德明',zi:'启蒙',spouse:'赵氏',gen:1,children:0,isRoot:true};
  this.hidden=true; nodeState={}; childCache={}; pending={}; renderTree();
});
$('#d-back').addEventListener('click',function(){ this.hidden=true; $('#d-title').textContent='族人明细'; $('#p-detail').innerHTML='<div class="hint">在世系树中点击任意族人，或搜索后选择，即可在此查看明细。</div>'; });

/* 搜索 */
var qTimer=null;
$('#tree-q').addEventListener('input',function(e){
  clearTimeout(qTimer);
  var q=e.target.value.trim();
  qTimer=setTimeout(function(){
    var box=$('#tree-qres');
    if(!q){ box.hidden=true; box.innerHTML=''; return; }
    api('/members?q='+encodeURIComponent(q)+'&size=8').then(function(r){
      box.hidden=false;
      box.innerHTML=r.items.length?r.items.map(function(m){
        return '<div class="qi" data-act="detail" data-id="'+m.id+'"><b>'+esc(m.name)+'</b><span>'+cnGen(m.gen)+(m.zi?' · 字'+esc(m.zi):'')+'</span></div>';
      }).join(''):'<div class="qi">未找到相关族人</div>';
    }).catch(function(){});
  },250);
});
document.addEventListener('click',function(e){
  if(!e.target.closest('.searchbox')){ var b=$('#tree-qres'); if(b) b.hidden=true; }
});

/* 世代柱 */
document.addEventListener('click',function(e){
  var b=e.target.closest('.gbar[data-gen]');
  if(b) showGenList(+b.dataset.gen);
});

/* 介绍浮层 */
function closeIntro(){ $('#intro').hidden=true; }
$('#btn-intro').addEventListener('click',function(){ $('#intro').hidden=false; });
$('#btn-intro2').addEventListener('click',function(){ $('#intro').hidden=false; });
$('#intro-close').addEventListener('click',closeIntro);
$('#intro').addEventListener('click',function(e){ if(e.target===this) closeIntro(); });

function toast(msg){
  var t=document.createElement('div');
  t.textContent=msg;
  t.style.cssText='position:fixed;top:74px;left:50%;transform:translateX(-50%);background:rgba(214,178,108,.92);color:#141414;padding:9px 20px;border-radius:10px;font-size:13px;z-index:200;box-shadow:0 8px 24px rgba(0,0,0,.4)';
  document.body.appendChild(t);
  setTimeout(function(){ t.remove(); },2200);
}

/* 时钟 */
function tick(){
  var d=new Date();
  $('#clk').textContent=d.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  $('#clk-date').textContent=d.getFullYear()+'.'+(d.getMonth()+1)+'.'+d.getDate();
}
setInterval(tick,1000);

/* ================= 启动 ================= */
api('/screen').then(function(d){
  D=d;
  renderHeader(); renderDyn(); renderGenBars(); renderBranches(); renderProgress();
  return api('/tree/roots');
}).then(function(r){
  if(r.items.length) treeRoot=Object.assign({isRoot:true}, r.items[0]);
  childCache={}; pending={};
  renderTree();
  tick();
}).catch(function(e){
  $('#tree').innerHTML='<div class="tmore">'+esc(e.message)+'</div>';
});
})();
