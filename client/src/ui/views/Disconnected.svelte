<script lang="ts">
  import Dialog from 'ui/components/Dialog.svelte';
  import { Dialogs } from 'ui/state/Dialogs.svelte';
  import { Welcome } from 'ui/state/Welcome.svelte';

  const dismiss = () => {
    Welcome.isShowingWorlds = true;
    Dialogs.hide('disconnected');
    Dialogs.show('welcome');
  };
</script>

<Dialog id="disconnected" isModal>
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
