<script lang="ts">
  import { Status } from 'ui/state/Status.svelte';
</script>

{#if Status.error || Status.isConnecting || Status.isLoading}
  <div class="status" class:error={Status.error}>
    {#if Status.error}
      Error: {Status.error}
    {:else if Status.isConnecting}
      Connecting...
    {:else}
      Loading...
    {/if}
  </div>
{/if}

<style>
  .status {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 1;
  }

  .error {
    color: #e99;
  }
</style>
