<script lang="ts" module>
  import { type Entries } from 'ui/components/Controls.svelte';

  const moveControls: Entries = [
    { description: 'Move', inputs: [[['W'], ['A', 'S', 'D']]] },
    { description: 'Move Down', inputs: [[['Shift']]] },
    { description: 'Move Up', inputs: [[['Space']]] },
    { description: 'Set Speed', inputs: ['middleClick'] },
    { description: 'Toggle UI', inputs: [[['Tab']]] },
    { description: 'Palette', inputs: [[['E']]] },
  ];
  const buildControls: Entries = [
    { description: 'Build', inputs: ['leftClick'] },
    { description: 'Destroy', inputs: ['rightClick'] },
    { description: 'Shoot', inputs: ['middleClick'] },
    { description: 'Pick', inputs: [[['Ctrl']], 'leftClick'] },
    { description: 'Undo', inputs: [[['Ctrl']], [['Z']]] },
    { description: 'Redo', inputs: [[['Ctrl'], ['Shift']], [['Z']]] },
  ];
</script>
<script lang="ts">
  import Controls from 'ui/components/Controls.svelte';
  import Dialog from 'ui/components/Dialog.svelte';
  import Worlds from 'ui/components/Worlds.svelte';
  import { Welcome } from 'ui/state/Welcome.svelte';

  let isShowingWorlds = $state(false);

  const singleplayer = () => {
    Welcome.isShowing = false;
    Welcome.onPlay?.();
  };

  const multiplayer = () => {
    isShowingWorlds = true;
  };

  const onWorldsJoin = (server: string) => {
    Welcome.isShowing = false;
    Welcome.onPlay?.(server);
  };

  const onWorldsCancel = () => {
    isShowingWorlds = false;
  };
</script>

<Dialog bind:enabled={Welcome.isShowing} isModal={isShowingWorlds} ondismiss={singleplayer}>
  <div class="wrapper">
    <div class="title">
      recursive-voxels
    </div>
    {#if isShowingWorlds}
      <Worlds onjoin={onWorldsJoin} oncancel={onWorldsCancel} />
    {:else}
      <div class="content">
        <div class="info">
          <div>
            <div class="heading">
              Welcome!
            </div>
            <p>
              This idea came to me while dreaming about the 1953 piece by M.C. Escher: "Cubic Space Division".
            </p>
            <p>
              The physics are simulated with the stellar JoltPhysics library. Everything else has been carefully coded by hand, including the custom WebGPU engine/renderer.
            </p>
          </div>
          <div class="actions">
            <button onclick={singleplayer}>
              Singleplayer
            </button>
            <button onclick={multiplayer}>
              Multiplayer
            </button>
          </div>
        </div>
        <Controls entries={moveControls} />
        <Controls entries={buildControls} />
      </div>
    {/if}
  </div>
</Dialog>

<style>
  .wrapper {
    display: grid;
    grid-template-rows: auto 1fr;
    width: 940px;
    min-height: 420px;
  }

  .title {
    display: flex;
    justify-content: space-between;
    padding: 1rem;
    font-size: 1.375rem;
    line-height: 1em;
    border-bottom: 2px solid rgba(255, 255, 255, 0.05);
  }

  .content {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
  }

  .info {
    display: grid;
    gap: 2rem;
    grid-template-rows: 1fr auto;
    padding: 1rem;
  }

  .heading {
    font-size: 1rem;
    margin-bottom: 1rem;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .actions > button {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 2.5rem;
    font-size: 1rem;
    font-family: inherit;
    line-height: inherit;
    color: inherit;
    background: #393;
    border-radius: 0.25rem;
    margin: 0;
    padding: 0;
    border: 0;
  }
</style>
