import vi from '../i18n/vi.json' with { type: 'json' };

const t = vi as Record<string, string>;
const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const SCRIPT = `(function(){
var f=document.getElementById('auth-form');if(!f)return;
var sum=document.getElementById('error-summary');
var show=document.getElementById('toggle-password');var pw=document.getElementById('password');
show.addEventListener('click',function(){var h=pw.type==='password';pw.type=h?'text':'password';show.setAttribute('aria-pressed',String(h));show.textContent=h?show.dataset.hide:show.dataset.show;});
f.addEventListener('submit',function(e){e.preventDefault();sum.textContent='';sum.hidden=true;
fetch(f.dataset.action,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',
body:JSON.stringify({email:f.email.value,password:pw.value})})
.then(function(r){return r.json().catch(function(){return {};}).then(function(j){return {ok:r.ok,j:j};});})
.then(function(x){if(x.ok){location.href='/studio';return;}
sum.textContent=(x.j.error&&x.j.error.message)||f.dataset.network;sum.hidden=false;sum.focus();})
.catch(function(){sum.textContent=f.dataset.network;sum.hidden=false;sum.focus();});});
})();`;

export function authPage(kind: 'login' | 'register' | 'script'): string {
  if (kind === 'script') return SCRIPT;
  const reg = kind === 'register';
  const title = reg ? t['auth.register.title'] : t['auth.login.title'];
  const other = reg
    ? `${esc(t['auth.register.have_account'])} <a href="/dang-nhap">${esc(t['auth.login.title'])}</a>`
    : `${esc(t['auth.login.no_account'])} <a href="/dang-ky">${esc(t['auth.register.title'])}</a>`;
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} - ${esc(t['app.name'])}</title>
<link rel="stylesheet" href="/assets/tokens.css">
<link rel="stylesheet" href="/assets/app.css">
</head>
<body>
<a class="skip-link" href="#main">${esc(t['app.skip'])}</a>
<header class="topbar"><span class="brand">${esc(t['app.name'])}</span></header>
<main id="main" class="auth">
<div class="card">
<h1>${esc(title)}</h1>
<form id="auth-form" method="post" data-action="/api/auth/${reg ? 'register' : 'login'}" data-network="${esc(t['error.network'])}" novalidate>
<div id="error-summary" role="alert" tabindex="-1" hidden></div>
<label for="email">${esc(t['auth.field.email'])}</label>
<input id="email" name="email" type="email" autocomplete="email" required placeholder="ten@congty.vn">
<label for="password">${esc(t['auth.field.password'])}</label>
<div class="field-row">
<input id="password" name="password" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" required${reg ? ' minlength="8" aria-describedby="pw-hint"' : ''}>
<button type="button" id="toggle-password" class="btn btn-secondary" aria-pressed="false" data-show="${esc(t['auth.password.show'])}" data-hide="${esc(t['auth.password.hide'])}">${esc(t['auth.password.show'])}</button>
</div>
${reg ? `<p id="pw-hint" class="hint muted">${esc(t['auth.password.hint'])}</p>` : ''}
<div class="actions"><button type="submit" class="btn btn-primary btn-block">${esc(title)}</button></div>
</form>
</div>
<p class="muted">${other}</p>
</main>
<script src="/assets/auth.js" defer></script>
</body>
</html>`;
}
