import vi from '../i18n/vi.json' with { type: 'json' };

const t = vi as Record<string, string>;
const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const STRING_KEYS = Object.keys(t).filter((k) => k.startsWith('studio.') || k === 'error.network');

// Script ngoài (CSP không cho inline). Chỉ dùng textContent/createElement: tên do người dùng nhập không bao giờ thành HTML.
const SCRIPT = (strings: string): string => `(function(){
var S=${strings};
var root=document.getElementById('studio');if(!root)return;
var cur=null;
function el(tag,text,attrs){var e=document.createElement(tag);if(text!=null)e.textContent=text;
for(var k in(attrs||{}))e.setAttribute(k,attrs[k]);return e;}
function btn(label,fn){var b=el('button',label,{type:'button'});b.addEventListener('click',fn);return b;}
function api(method,url,body,signal){var o={method:method,credentials:'same-origin',signal:signal};
if(body){o.headers={'Content-Type':'application/json'};o.body=JSON.stringify(body);}
return fetch(url,o)
.then(function(r){return r.text().then(function(x){var j={};try{j=x?JSON.parse(x):{};}catch(e){}return {ok:r.ok,status:r.status,j:j,retry:parseInt(r.headers.get('Retry-After'),10)||0};});},
function(e){return {ok:false,status:0,j:{},net:true,aborted:!!(e&&e.name==='AbortError')};});}
var msg=el('div',null,{role:'alert',tabindex:'-1'});msg.hidden=true;
function err(x){msg.textContent=(x&&x.j&&x.j.error&&x.j.error.message)||S['error.network'];msg.hidden=false;msg.focus();}
function ok(){msg.hidden=true;msg.textContent='';}
function ask(name,initial,cb){var v=window.prompt(name,initial||'');if(v!==null)cb(v);}
function loadSpaces(){api('GET','/api/spaces').then(function(x){if(!x.ok)return err(x);ok();renderSpaces(x.j.spaces);});}
function renderSpaces(list){var box=document.getElementById('spaces');box.textContent='';
if(!list.length)box.appendChild(el('p',S['studio.space.empty']));
var ul=el('ul');list.forEach(function(s){var li=el('li');li.appendChild(el('strong',s.title));li.appendChild(el('span',' ('+s.slug+') '));
li.appendChild(btn(S['studio.space.open'],function(){cur=s;loadTree();}));
li.appendChild(btn(S['studio.space.rename'],function(){ask(S['studio.space.name'],s.title,function(v){
api('PATCH','/api/spaces/'+s.id,{title:v}).then(function(x){if(!x.ok)return err(x);if(cur&&cur.id===s.id)cur=x.j.space;loadSpaces();if(cur)loadTree();});});}));
ul.appendChild(li);});box.appendChild(ul);}
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
if(!tree.length)box.appendChild(el('p',S['studio.page.empty']));
(function build(nodes,parent,host,parentNode){var ul=el('ul',null,parent?{role:'group'}:{role:'tree'});
nodes.forEach(function(n,i){var li=el('li',null,{role:'treeitem'});li.appendChild(el('span',n.title+' ('+n.slug+') '));
li.appendChild(btn(S['studio.edit.open'],function(){openEd(n);}));
li.appendChild(btn(S['studio.page.child'],function(){addPage(n.id);}));
li.appendChild(btn(S['studio.space.rename'],function(){ask(S['studio.page.title'],n.title,function(v){
api('PATCH','/api/pages/'+n.id,{title:v}).then(function(x){if(!x.ok)return err(x);loadTree();});});}));
var pid=parentNode?parentNode.id:null;
if(i>0)li.appendChild(btn(S['studio.page.up'],function(){move(n.id,pid,i-1);}));
if(i<nodes.length-1)li.appendChild(btn(S['studio.page.down'],function(){move(n.id,pid,i+1);}));
if(i>0)li.appendChild(btn(S['studio.page.indent'],function(){var p=nodes[i-1];move(n.id,p.id,p.children.length);}));
if(parentNode)li.appendChild(btn(S['studio.page.outdent'],function(){var g=parent;var gp=g?g.id:null;
move(n.id,gp,pos(parentNode)+1);}));
li.appendChild(btn(S['studio.page.delete'],function(){del(n);}));
if(n.children.length)build(n.children,parentNode,li,n);ul.appendChild(li);});host.appendChild(ul);})(tree,null,box,null);
function pos(node){return node.position;}}

var ed=null,dirty=false,pvTimer=null,pvSeq=0;
var ta=document.getElementById('ed-body'),ti=document.getElementById('ed-title'),st=document.getElementById('ed-status'),
sv=document.getElementById('ed-save'),fr=document.getElementById('ed-preview');
function setDirty(d){dirty=d;sv.disabled=!d;if(d)st.textContent=S['studio.edit.dirty'];}
function hhmm(){var d=new Date();return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);}
// Xem trước: HTML đã được server làm sạch, đặt vào iframe sandbox (không allow-scripts/same-origin) qua srcdoc, không chèn HTML vào DOM trang chính.
function showPreview(html){fr.srcdoc='<!doctype html><meta charset="utf-8"><base target="_blank"><style>body{font-family:system-ui,sans-serif;margin:.5rem;color:#111827}img{max-width:100%}table{border-collapse:collapse}td,th{border:1px solid #D1D5DB;padding:.25rem .5rem}pre{background:#F3F4F6;padding:.5rem;overflow:auto}</style>'+html;}
function preview(){clearTimeout(pvTimer);pvTimer=setTimeout(function(){var n=++pvSeq;
if(!ta.value.trim()){showPreview('<p>'+S['studio.edit.preview_empty']+'</p>');return;}
api('POST','/api/preview',{bodyMd:ta.value}).then(function(x){if(n!==pvSeq)return;if(!x.ok)return err(x);showPreview(x.j.html);});},300);}
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
function save(){if(!ed||!dirty)return;sv.disabled=true;st.textContent=S['studio.edit.saving'];var id=ed.id,b={title:ti.value,bodyMd:ta.value};
api('PATCH','/api/pages/'+id,b).then(function(x){if(!x.ok){st.textContent=S['studio.edit.save_failed'];sv.disabled=false;return err(x);}
ok();if(ta.value===b.bodyMd&&ti.value===b.title){dirty=false;sv.disabled=true;}else{sv.disabled=false;}
st.textContent=S['studio.edit.saved'].replace('{time}',hhmm());loadTree();});}
sv.addEventListener('click',save);
function closeEd(){if(dirty&&!window.confirm(S['studio.edit.leave']))return;ed=null;dirty=false;document.getElementById('ed-panel').hidden=true;}
document.getElementById('ed-close').addEventListener('click',closeEd);
window.addEventListener('beforeunload',function(e){if(dirty){e.preventDefault();e.returnValue=S['studio.edit.leave'];return S['studio.edit.leave'];}});
function openEd(n){if(dirty&&!window.confirm(S['studio.edit.leave']))return;
api('GET','/api/pages/'+n.id).then(function(x){if(!x.ok)return err(x);ok();ed=x.j.page;ti.value=ed.title;ta.value=ed.bodyMd;dirty=false;
sv.disabled=true;st.textContent='';document.getElementById('ed-panel').hidden=false;preview();ta.focus();});}
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
<style>body{font-family:system-ui,sans-serif;color:#111827;margin:0}main{max-width:70rem;margin:2rem auto;padding:0 1rem}
button{margin:0 .25rem;padding:.25rem .5rem}button:focus{outline:3px solid #2563EB;outline-offset:2px}
[role=alert]{color:#B91C1C;border:1px solid #B91C1C;padding:.5rem;margin:1rem 0}ul{padding-left:1.25rem}.cols{display:flex;gap:1rem;flex-wrap:wrap}.cols>div{flex:1 1 20rem}textarea,iframe{width:100%;height:24rem;box-sizing:border-box;border:1px solid #9CA3AF}textarea{font-family:ui-monospace,monospace}</style></head>
<body><main id="studio"><h1>${esc(t['studio.title'])}</h1>
<button type="button" id="new-space">${esc(t['studio.space.new'])}</button>
<div id="spaces"></div>
<section id="tree-panel" hidden><h2 id="tree-title"></h2><button type="button" id="new-page">${esc(t['studio.page.add'])}</button><div id="tree"></div></section>
<section id="ed-panel" hidden><h2>${esc(t['studio.edit.open'])}</h2>
<label for="ed-title">${esc(t['studio.page.title'])}</label> <input id="ed-title" type="text" maxlength="200">
<div role="toolbar" aria-label="${esc(t['studio.edit.toolbar'])}">
<button type="button" id="tb-bold">${esc(t['studio.edit.bold'])}</button><button type="button" id="tb-italic">${esc(t['studio.edit.italic'])}</button><button type="button" id="tb-heading">${esc(t['studio.edit.heading'])}</button><button type="button" id="tb-list">${esc(t['studio.edit.list'])}</button><button type="button" id="tb-code">${esc(t['studio.edit.code'])}</button><button type="button" id="tb-table">${esc(t['studio.edit.table'])}</button><button type="button" id="tb-image">${esc(t['studio.edit.image'])}</button></div>
<div class="cols"><div><label for="ed-body">${esc(t['studio.edit.body'])}</label><textarea id="ed-body" placeholder="${esc(t['studio.edit.placeholder'])}"></textarea></div>
<div><span id="pv-label">${esc(t['studio.edit.preview'])}</span><iframe id="ed-preview" sandbox="" title="${esc(t['studio.edit.preview'])}" aria-labelledby="pv-label"></iframe></div></div>
<button type="button" id="ed-save" disabled>${esc(t['studio.save'])}</button> <button type="button" id="ed-close">${esc(t['studio.edit.close'])}</button> <span id="ed-status" role="status" aria-live="polite"></span>
</section>
</main><script src="/assets/studio.js" defer></script></body>
</html>`;
}
