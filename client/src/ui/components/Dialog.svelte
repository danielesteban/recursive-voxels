<script lang="ts">
  import { type Snippet } from 'svelte';

  let { children, enabled = $bindable(), isModal = false, ondismiss }: {
    children: Snippet;
    enabled: boolean;
    isModal?: boolean;
    ondismiss?: () => void;
  } = $props();

  const dismiss = (e: MouseEvent) => {
    if (e.currentTarget === e.target) {
      enabled = false;
      ondismiss?.();
    }
  };
</script>

{#if enabled}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="overlay" onmousedown={!isModal ? dismiss : null}>
    <div class="dialog">
      {@render children?.()}
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(0.5rem);
    display: grid;
    place-items: center;
    overflow-y: auto;
    z-index: 10;
  }

  .dialog {
    backdrop-filter: blur(2rem);
    background: rgba(0, 0, 0, 0.2);
    border-radius: 1rem;
  }
</style>
