<script>
  // Full-screen unlock overlay, shown by the layout when any API call hits the
  // server's password gate (401). Posts /api/auth/login; on success the server
  // sets the session cookie and a reload refetches everything cleanly.
  import { api } from '$lib/api.js';

  let pw = $state('');
  let err = $state(false);
  let busy = $state(false);
  let inEl;

  async function unlock() {
    if (busy || !pw) return;
    busy = true;
    err = false;
    try {
      const r = await api.login(pw);
      if (r?.ok) { location.reload(); return; }
      err = true;
    } catch {
      err = true;
    } finally {
      busy = false;
    }
  }

  $effect(() => { inEl?.focus(); });
</script>

<div class="gate" role="dialog" aria-modal="true" aria-label="Unlock Sprout">
  <div class="gate-card" class:bad={err}>
    <div class="gate-brand">Sprout</div>
    <div class="gate-sub">private — enter password</div>
    <input class="gate-in" type="password" placeholder="password" bind:value={pw} bind:this={inEl}
      autocomplete="current-password" aria-label="Password"
      oninput={() => (err = false)}
      onkeydown={(e) => { if (e.key === 'Enter') unlock(); }} />
    <button class="btn btn-line gate-btn" onclick={unlock} disabled={busy || !pw}>unlock</button>
    <div class="gate-err" role="alert">{err ? 'wrong password' : ' '}</div>
  </div>
</div>

<style>
  /* Opaque on purpose — nothing underneath should be readable while locked. */
  .gate { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center;
    background: var(--surface); padding: 24px; }
  .gate-card { display: flex; flex-direction: column; gap: 10px; width: min(320px, 100%);
    padding: 28px 24px; border: var(--bw) solid var(--ink); border-radius: var(--r); }
  .gate-card.bad { border-color: var(--loss); }
  .gate-brand { font-family: var(--sans); font-size: 22px; font-weight: 800; color: var(--ink); }
  .gate-sub { font-family: var(--mono); font-size: 11px; color: var(--muted);
    text-transform: uppercase; letter-spacing: .1em; margin-bottom: 8px; }
  .gate-in { box-sizing: border-box; width: 100%; height: 38px; padding: 0 12px;
    border: var(--bw) solid var(--ink); border-radius: var(--r); background: transparent;
    outline: none; font-family: var(--mono); font-size: 16px; font-weight: 700; color: var(--text); }
  .gate-in::placeholder { color: var(--muted); opacity: .6; }
  .gate-btn { height: 34px; }
  .gate-btn:disabled { opacity: .4; cursor: default; }
  .gate-err { font-family: var(--mono); font-size: 11px; font-weight: 700; color: var(--loss); }
</style>
