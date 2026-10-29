<script lang="ts">
  import type { Snippet } from 'svelte'

  let {
    open,
    title,
    onclose,
    children
  }: { open: boolean; title: string; onclose: () => void; children: Snippet } = $props()

  let dialog = $state<HTMLDialogElement>()

  $effect(() => {
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      // Keep focus on the dialog, not its first control (which would show a focus ring).
      dialog.focus()
    } else if (!open && dialog.open) dialog.close()
  })
</script>

<!-- Esc is handled natively by <dialog>; a click on the backdrop lands on the dialog itself. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog
  bind:this={dialog}
  {onclose}
  onclick={(e) => e.target === dialog && onclose()}
  aria-label={title}
  tabindex={-1}
  class="m-auto max-h-[85vh] w-[min(44rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-line bg-canvas p-0 text-ink shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm open:flex focus:outline-none"
>
  <header class="flex items-center justify-between px-6 pt-5 pb-3">
    <h2 class="text-lg font-medium">{title}</h2>
    <button class="btn btn-ghost size-9 !p-0" aria-label="Close" onclick={onclose}>
      <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2"
        ><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" /></svg
      >
    </button>
  </header>
  <div class="overflow-y-auto px-6 pb-6">{@render children()}</div>
</dialog>
