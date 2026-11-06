import vi from '../i18n/vi.json' with { type: 'json' };

const t = vi as Record<string, string>;
const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const STRING_KEYS = Object.keys(t).filter((k) => k.startsWith('studio.') || k === 'error.network');

// Script ngoài (CSP không cho inline). Chỉ dùng textContent/createElement: tên do người dùng nhập không bao giờ thành HTML.
const SCRIPT = (strings: string): string => `(function(){
var S=${strings};
var root=document.getElementById('studio');if(!root)return;
var cur=null,curPageId=null;
function el(tag,text,attrs){var e=document.createElement(tag);if(text!=null)e.textContent=text;
for(var k in(attrs||{}))e.setAttribute(k,attrs[k]);return e;}
function btn(label,fn,cls){var b=el('button',label,{type:'button','class':cls||'btn btn-secondary btn-sm'});b.addEventListener('click',fn);return b;}
function api(method,url,body,signal){var o={method:method,credentials:'same-origin',signal:signal};
if(body){o.headers={'Content-Type':'application/json'};o.body=JSON.stringify(body);}
return fetch(url,o)
.then(function(r){return r.text().then(function(x){var j={};try{j=x?JSON.parse(x):{};}catch(e){}return {ok:r.ok,status:r.status,j:j,retry:parseInt(r.headers.get('Retry-After'),10)||0};});},
function(e){return {ok:false,status:0,j:{},net:true,aborted:!!(e&&e.name==='AbortError')};});}
var msg=el('div',null,{role:'alert',tabindex:'-1','class':'alert'});msg.hidden=true;
function err(x){msg.textContent=(x&&x.j&&x.j.error&&x.j.error.message)||S['error.network'];msg.hidden=false;msg.focus();}
function ok(){msg.hidden=true;msg.textContent='';}
function ask(name,initial,cb){var v=window.prompt(name,initial||'');if(v!==null)cb(v);}
function loadSpaces(){api('GET','/api/spaces').then(function(x){if(!x.ok)return err(x);ok();renderSpaces(x.j.spaces);});}
function renderSpaces(list){var box=document.getElementById('spaces');box.textContent='';
document.getElementById('new-space').textContent=list.length?S['studio.space.new']:S['studio.space.first'];
if(!list.length)box.appendChild(el('p',S['studio.space.empty'],{'class':'empty'}));
var ul=el('ul',null,{'class':'list-reset space-list'});list.forEach(function(s){var li=el('li',null,{'class':'space-item'});li.appendChild(el('strong',s.title,{'class':'name'}));li.appendChild(el('span',' ('+s.slug+') ',{'class':'muted'}));
var ia=el('div',null,{'class':'item-actions'});
ia.appendChild(btn(S['studio.space.open'],function(){cur=s;loadTree();}));
ia.appendChild(btn(S['studio.space.rename'],function(){ask(S['studio.space.name'],s.title,function(v){
api('PATCH','/api/spaces/'+s.id,{title:v}).then(function(x){if(!x.ok)return err(x);if(cur&&cur.id===s.id)cur=x.j.space;loadSpaces();if(cur)loadTree();});});},'btn btn-ghost btn-sm'));
li.appendChild(ia);ul.appendChild(li);});box.appendChild(ul);}
function flat(nodes,parent,out){nodes.forEach(function(n,i){out.push({n:n,parent:parent,i:i,sibs:nodes});flat(n.children,n,out);});return out;}
function loadTree(){if(!cur)return;api('GET','/api/spaces/'+cur.id+'/tree').then(function(x){if(!x.ok)return err(x);ok();renderTree(x.j.tree);});}
function move(id,parentId,pos){api('POST','/api/pages/'+id+'/move',{parentId:parentId,position:pos}).then(function(x){if(!x.ok)return err(x);ok();renderTree(x.j.tree);});}
function addPage(parentId){var title=window.prompt(S['studio.page.title'],'');if(title===null)return;
var slug=window.prompt(S['studio.page.slug'],'');if(slug===null)return;var b={title:title,parentId:parentId};if(slug)b.slug=slug;
api('POST','/api/spaces/'+cur.id+'/pages',b).then(function(x){if(!x.ok)return err(x);loadTree();});}
function del(n){var count=0;(function c(a){a.forEach(function(k){count++;c(k.children);});})(n.children);
var text=count?S['studio.delete.tree'].replace('{name}',n.title).replace('{n}',String(count)):S['studio.delete.leaf'].replace('{name}',n.title);
if(!window.confirm(text))return;
api('DELETE','/api/pages/'+n.id+(count?'?confirm=1':'')).then(function(x){if(!x.ok)return err(x);loadTree();});}
function renderTree(tree){var box=document.getElementById('tree');box.textContent='';
document.getElementById('tree-title').textContent=cur.title;document.getElementById('tree-panel').hidden=false;
if(!tree.length)box.appendChild(el('p',S['studio.page.empty'],{'class':'empty'}));
(function build(nodes,parent,host,parentNode){var ul=el('ul',null,{'class':'tree'});
nodes.forEach(function(n,i){var li=el('li',null,{'data-id':String(n.id)});var row=el('div',null,{'class':'tree-row'});
if(curPageId===n.id){li.className='tree-current';row.setAttribute('aria-current','page');}
var nm=el('span',n.title,{'class':'tree-name'});nm.appendChild(el('span',' ('+n.slug+') ',{'class':'tree-slug'}));row.appendChild(nm);
var ra=el('div',null,{'class':'row-actions'});row.appendChild(ra);li.appendChild(row);
var g1=el('span',null,{'class':'ra-group'}),g2=el('span',null,{'class':'ra-group'}),g3=el('span',null,{'class':'ra-group'});
ra.appendChild(g1);ra.appendChild(g2);ra.appendChild(g3);
g1.appendChild(btn(S['studio.edit.open'],function(){openEd(n);}));
g3.appendChild(btn(S['studio.page.child'],function(){addPage(n.id);},'btn btn-ghost btn-sm'));
g3.appendChild(btn(S['studio.space.rename'],function(){ask(S['studio.page.title'],n.title,function(v){
api('PATCH','/api/pages/'+n.id,{title:v}).then(function(x){if(!x.ok)return err(x);loadTree();});});},'btn btn-ghost btn-sm'));
var pid=parentNode?parentNode.id:null;
if(i>0)g2.appendChild(btn(S['studio.page.up'],function(){move(n.id,pid,i-1);},'btn btn-ghost btn-sm'));
if(i<nodes.length-1)g2.appendChild(btn(S['studio.page.down'],function(){move(n.id,pid,i+1);},'btn btn-ghost btn-sm'));
if(i>0)g2.appendChild(btn(S['studio.page.indent'],function(){var p=nodes[i-1];move(n.id,p.id,p.children.length);},'btn btn-ghost btn-sm'));
if(parentNode)g2.appendChild(btn(S['studio.page.outdent'],function(){var g=parent;var gp=g?g.id:null;
move(n.id,gp,pos(parentNode)+1);},'btn btn-ghost btn-sm'));
if(!g2.firstChild)ra.removeChild(g2);
g3.appendChild(btn(S['studio.page.delete'],function(){del(n);},'btn btn-ghost btn-sm btn-ghost-danger'));
if(n.children.length)build(n.children,parentNode,li,n);ul.appendChild(li);});host.appendChild(ul);})(tree,null,box,null);
function pos(node){return node.position;}}

var ed=null,dirty=false,pvTimer=null,pvSeq=0;
var ta=document.getElementById('ed-body'),ti=document.getElementById('ed-title'),st=document.getElementById('ed-status'),
sv=document.getElementById('ed-save'),fr=document.getElementById('ed-preview');
function stat(text,saved){st.textContent=text;st.className=saved?'status-text status-saved':'status-text';}
function markCurrent(){var box=document.getElementById('tree');
Array.prototype.forEach.call(box.querySelectorAll('.tree-current'),function(x){x.classList.remove('tree-current');});
Array.prototype.forEach.call(box.querySelectorAll('[aria-current]'),function(x){x.removeAttribute('aria-current');});
if(curPageId==null)return;var li=box.querySelector('li[data-id="'+curPageId+'"]');
if(li){li.classList.add('tree-current');li.firstChild.setAttribute('aria-current','page');}}
function setDirty(d){dirty=d;sv.disabled=!d;if(d)stat(S['studio.edit.dirty'],false);}
function hhmm(){var d=new Date();return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);}
// Xem trước: HTML đã được server làm sạch, đặt vào iframe sandbox (không allow-scripts/same-origin) qua srcdoc, không chèn HTML vào DOM trang chính.
function showPreview(html){fr.srcdoc='<!doctype html><meta charset="utf-8"><base target="_blank"><link rel="stylesheet" href="/assets/tokens.css"><link rel="stylesheet" href="/assets/app.css"><body class="prose">'+html;}
// Lỗi xem trước chỉ hiện thông báo nhẹ (aria-live), không alert, không cướp focus khỏi ô soạn thảo.
var pn=el('div',null,{id:'pv-note',role:'status','aria-live':'polite','class':'alert-warning'});pn.hidden=true;
var slot=el('div',null,{'class':'pv-slot'});slot.appendChild(pn);fr.parentNode.appendChild(slot);
var pvCtl=null,pvRetry=null;function pvNote(t){pn.textContent=t||'';pn.hidden=!t;}
// Debounce 800 ms, hủy request cũ khi gõ tiếp, tự thử lại sau Retry-After khi bị 429.
// FND-014: debounce tăng theo kích thước (800 ms + 20 ms/KB) để nội dung lớn không đốt ngân sách byte của server.
function pvDelay(){return 800+Math.ceil(ta.value.length/1024)*20;}
function preview(){clearTimeout(pvTimer);clearTimeout(pvRetry);pvTimer=setTimeout(runPv,pvDelay());}
function runPv(){var n=++pvSeq;if(pvCtl)pvCtl.abort();pvCtl=null;
if(!ta.value.trim()){pvNote('');showPreview('<p class="prose-empty">'+S['studio.edit.preview_empty']+'</p>');return;}
if(window.AbortController)pvCtl=new AbortController();
api('POST','/api/preview',{bodyMd:ta.value},pvCtl?pvCtl.signal:undefined).then(function(x){if(n!==pvSeq||x.aborted)return;
if(x.ok){pvNote('');showPreview(x.j.html);return;}
if(x.status===429){pvNote(S['studio.edit.preview_wait']);pvRetry=setTimeout(runPv,Math.max(1,x.retry||5)*1000+250);return;}
pvNote(S['studio.edit.preview_failed']);});}
function wrap(a,b,ph){var s=ta.selectionStart,e=ta.selectionEnd,v=ta.value,sel=v.slice(s,e)||ph;
ta.value=v.slice(0,s)+a+sel+b+v.slice(e);ta.focus();ta.setSelectionRange(s+a.length,s+a.length+sel.length);onEdit();}
function lines(prefix,ph){var s=ta.selectionStart,e=ta.selectionEnd,v=ta.value,ls=v.lastIndexOf('\\n',s-1)+1,sel=v.slice(ls,e)||ph;
var out=sel.split('\\n').map(function(l){return prefix+l;}).join('\\n');ta.value=v.slice(0,ls)+out+v.slice(e);ta.focus();onEdit();}
function onEdit(){setDirty(true);preview();}
function tool(id,fn){document.getElementById(id).addEventListener('click',fn);}
tool('tb-bold',function(){wrap('**','**','đậm');});
tool('tb-italic',function(){wrap('*','*','nghiêng');});
tool('tb-heading',function(){lines('## ','Tiêu đề');});
tool('tb-list',function(){lines('- ','Mục');});
tool('tb-code',function(){wrap('\\n\`\`\`\\n','\\n\`\`\`\\n','code');});
tool('tb-table',function(){wrap('\\n| Cột 1 | Cột 2 |\\n|---|---|\\n| ','',' |  |\\n');});
tool('tb-image',function(){var u=window.prompt(S['studio.edit.image_url'],'https://');if(u===null)return;u=u.trim();
if(!/^https?:\\/\\/[^\\s()<>]+$/i.test(u)){msg.textContent=S['studio.edit.image_bad'];msg.hidden=false;msg.focus();return;}ok();wrap('![','](' +u+ ')','mô tả ảnh');});
ta.addEventListener('input',onEdit);ti.addEventListener('input',function(){setDirty(true);});
function save(){if(!ed||!dirty)return;sv.disabled=true;stat(S['studio.edit.saving'],false);var id=ed.id,b={title:ti.value,bodyMd:ta.value};
api('PATCH','/api/pages/'+id,b).then(function(x){if(!x.ok){stat(S['studio.edit.save_failed'],false);sv.disabled=false;return err(x);}
ok();if(ta.value===b.bodyMd&&ti.value===b.title){dirty=false;sv.disabled=true;}else{sv.disabled=false;}
stat(S['studio.edit.saved'].replace('{time}',hhmm()),true);loadTree();});}
sv.addEventListener('click',save);
function closeEd(){if(dirty&&!window.confirm(S['studio.edit.leave']))return;clearTimeout(pvTimer);clearTimeout(pvRetry);if(pvCtl)pvCtl.abort();pvCtl=null;++pvSeq;pvNote('');ed=null;curPageId=null;markCurrent();dirty=false;document.getElementById('ed-panel').hidden=true;}
document.getElementById('ed-close').addEventListener('click',closeEd);
window.addEventListener('beforeunload',function(e){if(dirty){e.preventDefault();e.returnValue=S['studio.edit.leave'];return S['studio.edit.leave'];}});
function openEd(n){if(dirty&&!window.confirm(S['studio.edit.leave']))return;
api('GET','/api/pages/'+n.id).then(function(x){if(!x.ok)return err(x);ok();ed=x.j.page;ti.value=ed.title;ta.value=ed.bodyMd;dirty=false;
sv.disabled=true;stat('',false);document.getElementById('ed-panel').hidden=false;clearTimeout(pvTimer);clearTimeout(pvRetry);runPv();
curPageId=ed.id;markCurrent();ta.setSelectionRange(0,0);ta.focus();ta.scrollTop=0;});}
document.getElementById('new-space').addEventListener('click',function(){ask(S['studio.space.name'],'',function(v){
api('POST','/api/spaces',{title:v}).then(function(x){if(!x.ok)return err(x);loadSpaces();});});});
document.getElementById('new-page').addEventListener('click',function(){addPage(null);});
root.insertBefore(msg,root.firstChild);loadSpaces();
})();`;

export function studioPage(kind: 'page' | 'script'): string {
  if (kind === 'script') {
    const o: Record<string, string> = {};
    for (const k of STRING_KEYS) o[k] = t[k];
    return SCRIPT(JSON.stringify(o).replace(/</g, '\\u003c'));
  }
  return `<!doctype html>
<html lang="vi">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(t['studio.title'])} - ${esc(t['app.name'])}</title>
<link rel="stylesheet" href="/assets/tokens.css">
<link rel="stylesheet" href="/assets/app.css"></head>
<body><a class="skip-link" href="#studio">${esc(t['app.skip'])}</a>
<header class="topbar"><span class="brand">${esc(t['app.name'])}</span></header>
<main id="studio" class="studio" tabindex="-1"><h1>${esc(t['studio.title'])}</h1>
<div class="studio-layout">
<div class="sidebar">
<section class="panel"><div class="panel-head"><button type="button" id="new-space" class="btn btn-primary">${esc(t['studio.space.new'])}</button></div>
<div id="spaces"></div></section>
<section id="tree-panel" class="panel" hidden><div class="panel-head"><h2 id="tree-title"></h2><button type="button" id="new-page" class="btn btn-secondary btn-sm">${esc(t['studio.page.add'])}</button></div><nav id="tree" aria-label="${esc(t['studio.tree.nav'])}"></nav></section>
</div>
<div class="content">
<section id="ed-panel" class="editor" hidden><h2>${esc(t['studio.edit.open'])}</h2>
<label for="ed-title">${esc(t['studio.page.title'])}</label> <input id="ed-title" type="text" maxlength="200">
<div role="toolbar" class="toolbar" aria-label="${esc(t['studio.edit.toolbar'])}">
<button type="button" id="tb-bold">${esc(t['studio.edit.bold'])}</button><button type="button" id="tb-italic">${esc(t['studio.edit.italic'])}</button><button type="button" id="tb-heading">${esc(t['studio.edit.heading'])}</button><button type="button" id="tb-list">${esc(t['studio.edit.list'])}</button><button type="button" id="tb-code">${esc(t['studio.edit.code'])}</button><button type="button" id="tb-table">${esc(t['studio.edit.table'])}</button><button type="button" id="tb-image">${esc(t['studio.edit.image'])}</button></div>
<div class="cols"><div><label for="ed-body">${esc(t['studio.edit.body'])}</label><textarea id="ed-body" placeholder="${esc(t['studio.edit.placeholder'])}"></textarea></div>
<div><span id="pv-label" class="pane-label">${esc(t['studio.edit.preview'])}</span><iframe id="ed-preview" tabindex="-1" sandbox="" title="${esc(t['studio.edit.preview'])}" aria-labelledby="pv-label"></iframe></div></div>
<div class="editor-footer"><button type="button" id="ed-save" class="btn btn-primary" disabled>${esc(t['studio.save'])}</button><button type="button" id="ed-close" class="btn btn-secondary">${esc(t['studio.edit.close'])}</button><span id="ed-status" class="status-text" role="status" aria-live="polite"></span></div>
</section>
</div>
</div>
</main><script src="/assets/studio.js" defer></script></body>
</html>`;
}
