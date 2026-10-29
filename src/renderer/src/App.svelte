<script lang="ts">
  import { onMount } from 'svelte'
  import History from './components/History.svelte'
  import Home from './components/Home.svelte'
  import Settings from './components/Settings.svelte'
  import { app } from './lib/state.svelte'

  type Tab = 'home' | 'history' | 'settings'
  const TABS: { id: Tab; label: string }[] = [
    { id: 'home', label: 'Download' },
    { id: 'history', label: 'History' },
    { id: 'settings', label: 'Settings' }
  ]
  let tab = $state<Tab>('home')

  onMount(() => void app.init())
</script>

<main>
  <header>
    <h1>Flared</h1>
    <nav>
      {#each TABS as t (t.id)}
        <button class="ghost" class:active={tab === t.id} onclick={() => (tab = t.id)}>
          {t.label}{#if t.id === 'home' && app.jobs.length}<span class="count"
              >{app.jobs.length}</span
            >{/if}
        </button>
      {/each}
    </nav>
  </header>
  {#if tab === 'home'}<Home />{:else if tab === 'history'}<History />{:else}<Settings />{/if}
</main>

<style>
  main {
    max-width: 760px;
    margin: 0 auto;
    padding: 20px 16px 40px;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }
  h1 {
    margin: 0;
    font-size: 20px;
    letter-spacing: -0.01em;
  }
  nav {
    display: flex;
    gap: 4px;
  }
  nav .active {
    background: var(--surface-2);
    border-color: var(--border);
  }
  nav button {
    border-color: transparent;
  }
  .count {
    margin-left: 6px;
    background: var(--accent);
    color: var(--accent-text);
    border-radius: 10px;
    padding: 0 6px;
    font-size: 11px;
  }
</style>
