<script lang="ts">
  import { onMount } from 'svelte'
  import Home from './components/Home.svelte'
  import { app } from './lib/state.svelte'

  onMount(() => void app.init())
</script>

<main>
  <header>
    <h1>Flared</h1>
  </header>
  <Home />
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
    margin-bottom: 16px;
  }
  h1 {
    margin: 0;
    font-size: 20px;
    letter-spacing: -0.01em;
  }
</style>
