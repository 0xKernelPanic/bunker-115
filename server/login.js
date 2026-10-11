// The only page a visitor without the server password gets to see.
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function loginPage(message = '') {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Bunker 115</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rubik+Wet+Paint&family=Special+Elite&display=swap">
<style>
:root{--void:#070605;--ink:#d8d0bd;--dim:#8a8170;--blood:#8f1410;--blood-hi:#c8261c;--rule:#3a342b}
html,body{height:100%;margin:0;background:radial-gradient(ellipse at 50% 40%,#1b1813 0%,var(--void) 70%);color:var(--ink);font-family:'Special Elite',monospace}
main{min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px 16px;box-sizing:border-box;gap:28px}
h1{margin:0;font-family:'Rubik Wet Paint',serif;font-weight:400;font-size:clamp(56px,14vw,120px);line-height:1;color:var(--blood);text-shadow:0 4px 0 #000}
h1 span{color:var(--ink);font-size:.55em;vertical-align:super;margin-left:.15em}
form{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;width:min(420px,100%)}
input{flex:1 1 200px;font:inherit;font-size:20px;background:rgba(0,0,0,.5);color:var(--ink);border:1px solid var(--rule);padding:10px 12px;min-width:0}
input:focus{outline:2px solid var(--blood-hi);outline-offset:1px}
button{font:inherit;font-size:20px;letter-spacing:.1em;text-transform:uppercase;background:var(--ink);color:#111;border:0;padding:10px 20px;cursor:pointer}
button:focus-visible{outline:2px solid var(--blood-hi);outline-offset:2px}
p{margin:0;min-height:1.4em;color:var(--blood-hi)}
</style>
</head>
<body>
<main>
  <h1>Bunker<span>115</span></h1>
  <form method="post" action="/login">
    <input type="password" name="password" aria-label="Password" placeholder="Password" autocomplete="current-password" maxlength="128" required autofocus>
    <button type="submit">Enter</button>
  </form>
  <p role="alert">${esc(message)}</p>
</main>
</body>
</html>`;
}
