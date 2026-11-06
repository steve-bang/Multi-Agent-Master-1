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
function api(method,url,body){return fetch(url,{method:method,credentials:'same-origin',
headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined})
.then(function(r){return r.text().then(function(x){var j={};try{j=x?JSON.parse(x):{};}catch(e){}return {ok:r.ok,status:r.status,j:j};});});}
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
[role=alert]{color:#B91C1C;border:1px solid #B91C1C;padding:.5rem;margin:1rem 0}ul{padding-left:1.25rem}</style></head>
<body><main id="studio"><h1>${esc(t['studio.title'])}</h1>
<button type="button" id="new-space">${esc(t['studio.space.new'])}</button>
<div id="spaces"></div>
<section id="tree-panel" hidden><h2 id="tree-title"></h2><button type="button" id="new-page">${esc(t['studio.page.add'])}</button><div id="tree"></div></section>
</main><script src="/assets/studio.js" defer></script></body>
</html>`;
}
