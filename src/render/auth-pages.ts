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
<style>body{font-family:system-ui,sans-serif;color:#111827;margin:0}main{max-width:24rem;margin:3rem auto;padding:0 1rem}
label{display:block;margin-top:1rem;font-weight:600}input{width:100%;box-sizing:border-box;padding:.5rem;border:1px solid #6B7280;border-radius:4px;font-size:1rem}
input:focus,button:focus,a:focus{outline:3px solid #2563EB;outline-offset:2px}
button[type=submit]{margin-top:1.5rem;width:100%;padding:.6rem;background:#1D4ED8;color:#fff;border:0;border-radius:4px;font-size:1rem}
#error-summary{color:#B91C1C;border:1px solid #B91C1C;padding:.5rem;margin-top:1rem}.hint{color:#4B5563;font-size:.875rem}</style>
</head>
<body>
<main>
<h1>${esc(title)}</h1>
<form id="auth-form" method="post" data-action="/api/auth/${reg ? 'register' : 'login'}" data-network="${esc(t['error.network'])}" novalidate>
<div id="error-summary" role="alert" tabindex="-1" hidden></div>
<label for="email">${esc(t['auth.field.email'])}</label>
<input id="email" name="email" type="email" autocomplete="email" required placeholder="ten@congty.vn">
<label for="password">${esc(t['auth.field.password'])}</label>
<input id="password" name="password" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" required${reg ? ' minlength="8" aria-describedby="pw-hint"' : ''}>
${reg ? `<p id="pw-hint" class="hint">${esc(t['auth.password.hint'])}</p>` : ''}
<button type="button" id="toggle-password" aria-pressed="false" data-show="${esc(t['auth.password.show'])}" data-hide="${esc(t['auth.password.hide'])}">${esc(t['auth.password.show'])}</button>
<button type="submit">${esc(title)}</button>
</form>
<p>${other}</p>
</main>
<script src="/assets/auth.js" defer></script>
</body>
</html>`;
}
