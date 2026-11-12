<script lang="ts">
  import { FPS } from 'ui/state/FPS.svelte';
</script>

<div class="info">
  recursive-voxels - <span id="fps">{FPS.text}</span><br>
  <a href="https://dani.gatunes.com" rel="noopener noreferrer" target="_blank">dani@gatunes</a> © 2026
</div>

<style>
  .info {
    position: absolute;
    bottom: 1rem;
    right: 1rem;
    text-align: right;
    z-index: 100;
  }

  :global(body.pointerlock) .info {
    display: none;
  }
</style>
