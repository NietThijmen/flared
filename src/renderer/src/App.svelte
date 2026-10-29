<script lang="ts">
  import { onMount } from 'svelte'
  import QuickAdd from './components/QuickAdd.svelte'
  import History from './components/History.svelte'
  import Home from './components/Home.svelte'
  import Modal from './components/Modal.svelte'
  import Settings from './components/Settings.svelte'
  import { app } from './lib/state.svelte'

  type Panel = 'history' | 'settings'
  let panel = $state<Panel | null>(null)
  // The menu bar popover loads this same bundle with #quick.
  const quick = location.hash === '#quick'
  const settingsKey = /Mac/i.test(navigator.userAgent) ? '⌘,' : 'Ctrl+,'

  onMount(() => {
    if (quick) return
    void app.init()
    // Sent by the application menu's "Settings…" item (Cmd/Ctrl+,).
    return window.api.on('app:openSettings', () => (panel = 'settings'))
  })
</script>

{#if quick}
  <QuickAdd />
{:else}
  <main class="flex min-h-screen flex-col">
    <div class="flex flex-1 flex-col items-center px-6 pt-[18vh] pb-10">
      <Home />
    </div>

    <footer class="flex items-center gap-1 border-t border-line bg-surface-2/40 px-4 py-2.5">
      <button class="btn btn-ghost" onclick={() => (panel = 'history')}>
        History
        {#if app.history.length}<span class="text-xs text-muted">{app.history.length}</span>{/if}
      </button>
      <button class="btn btn-ghost" onclick={() => (panel = 'settings')}>
        Settings
        <kbd class="rounded border border-line px-1.5 font-sans text-xs text-muted"
          >{settingsKey}</kbd
        >
      </button>
    </footer>
  </main>

  <Modal open={panel === 'history'} title="History" onclose={() => (panel = null)}>
    <History />
  </Modal>
  <Modal open={panel === 'settings'} title="Settings" onclose={() => (panel = null)}>
    <Settings />
  </Modal>
{/if}
