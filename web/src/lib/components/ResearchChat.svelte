<script>
  // Research chat — FRONT-END MOCK ONLY. A greeting, suggestion chips built from
  // the user's holdings, and an input bar. Clicking a chip drops its text into the
  // input. Nothing is submitted; there is no backend and no network call.
  import { holdings } from '$lib/stores.js';

  let draft = $state('');

  // Suggestion bubbles seeded from real holdings (largest position + biggest mover).
  const suggestions = $derived.by(() => {
    const h = $holdings ?? [];
    const byWeight = [...h].sort((a, b) => (b.position_pct ?? 0) - (a.position_pct ?? 0));
    const byMove = [...h].sort((a, b) => Math.abs(b.day_pct ?? 0) - Math.abs(a.day_pct ?? 0));
    const chips = [];
    if (byWeight[0]) chips.push(`How is ${byWeight[0].ticker} doing?`);
    if (byMove[0]) chips.push(`Why is ${byMove[0].ticker} ${(byMove[0].day_pct ?? 0) >= 0 ? 'up' : 'down'} today?`);
    if (byWeight[1]) chips.push(`${byWeight[0].ticker} vs ${byWeight[1].ticker} — which is stronger?`);
    chips.push('Is my portfolio too concentrated?');
    chips.push('What should I research today?');
    return chips.slice(0, 5);
  });
</script>

<div class="glass-card chat">
  <div class="chat-h">research</div>
  <div class="chat-greet">Ask anything about your portfolio or the market.</div>

  <div class="chat-body">
    <div class="chat-suggest-k">Try asking</div>
    <div class="chat-chips">
      {#each suggestions as s (s)}
        <button class="chip" type="button" onclick={() => (draft = s)}>{s}</button>
      {/each}
    </div>
  </div>

  <!-- mock only: submitting is a no-op -->
  <form class="chat-bar" onsubmit={(e) => e.preventDefault()}>
    <input class="chat-input" bind:value={draft} placeholder="Ask a question…"
      autocomplete="off" autocorrect="off" spellcheck="false" />
    <button class="chat-send" type="submit" aria-label="Send" disabled={!draft.trim()}>↑</button>
  </form>
</div>

<style>
  .chat { display: flex; flex-direction: column; gap: 12px; padding: 13px 15px 14px;
    min-height: var(--stage-h, 600px); box-sizing: border-box; }
  .chat-h { font-family: var(--sans); font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .12em; color: var(--muted); }
  .chat-greet { font-family: var(--sans); font-size: 13px; font-weight: 600; color: var(--ink); line-height: 1.35; }

  /* body grows to push the input bar to the bottom; chips live at the top */
  .chat-body { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 9px; }
  .chat-suggest-k { font-family: var(--sans); font-size: 9px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .12em; color: var(--muted); }
  .chat-chips { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
  /* suggestion bubble — outlined pill, ink on hover (the system's btn-line state) */
  .chip { max-width: 100%; text-align: left; cursor: pointer; font-family: var(--sans); font-size: 12.5px;
    font-weight: 600; color: var(--ink); padding: 7px 13px; background: transparent;
    border: var(--bw) solid var(--hairline); border-radius: 999px; line-height: 1.25;
    transition: border-color .12s ease, background .12s ease; }
  .chip:hover { border-color: var(--ink); background: var(--hover); }

  /* input bar pinned to the bottom */
  .chat-bar { flex: 0 0 auto; display: flex; align-items: center; gap: 8px; }
  .chat-input { flex: 1 1 auto; min-width: 0; font-family: var(--sans); font-size: 13px; font-weight: 600;
    color: var(--ink); padding: 8px 14px; background: transparent;
    border: var(--bw) solid var(--ink); border-radius: 999px; outline: none; }
  .chat-input::placeholder { color: var(--muted); font-weight: 500; }
  .chat-send { flex: 0 0 auto; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;
    cursor: pointer; font-size: 16px; font-weight: 700; color: var(--paper); background: var(--ink);
    border: var(--bw) solid var(--ink); border-radius: 999px; transition: opacity .12s ease; }
  .chat-send:disabled { opacity: .35; cursor: default; }
</style>
