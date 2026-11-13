<script lang="ts">
  import Dialog from 'ui/components/Dialog.svelte';
  import { Disconnected } from 'ui/state/Disconnected.svelte';
  import { Welcome } from 'ui/state/Welcome.svelte';

  const dismiss = () => {
    Disconnected.isShowing = false;
    Welcome.isShowingWorlds = true;
    Welcome.isShowing = true;
  };
</script>

<Dialog bind:enabled={Disconnected.isShowing} isModal>
  <div class="wrapper">
    <div class="error">
      Connection lost
    </div>
    <div class="actions">
      <button onclick={dismiss}>
        Back to server list
      </button>
    </div>
  </div>
</Dialog>

<style>
  .wrapper {
    display: grid;
    gap: 1rem;
  }

  .error {
    display: grid;
    align-items: center;
    justify-content: center;
    color: #e99;
  }
</style>
