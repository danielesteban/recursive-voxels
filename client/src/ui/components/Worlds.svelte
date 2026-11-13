<script lang="ts">
  import { MaxPeers } from '@shared/WorldConstants';
  import { API } from 'ui/state/API';

  type World = { id: string; name: string; private: boolean; peers: number };

  let { onjoin, oncancel }: {
    onjoin: (server: string) => void;
    oncancel: () => void;
  } = $props();

  let selected = $state<World | null>(null);

  const canJoin = (world: World) => {
    return world.peers < MaxPeers;
  };

  const select = (world: World) => () => {
    selected = world;
  };

  const join = () => {
    if (!selected) {
      throw new Error('No world selected');
    }
    onjoin(selected.id);
  };
</script>

<div class="wrapper">
  {#await API<World[]>({ endpoint: 'worlds' })}
    <div class="loading">Loading...</div>
  {:then worlds}
    <div class="worlds">
      {#each worlds as world}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="world"
          class:selected={selected?.id === world.id}
          onclick={canJoin(world) ? select(world) : null}
          ondblclick={canJoin(world) ? join : null}
        >
          <div>{world.name}</div>
          <div>{world.peers}/{MaxPeers}</div>
        </div>
      {/each}
    </div>
  {/await}
  <div class="actions">
    <button class="join" disabled={!selected} onclick={join}>
      Join Server
    </button>
    <button onclick={oncancel}>
      Back
    </button>
  </div>
</div>

<style>
  .wrapper {
    display: grid;
    grid-template-rows: 1fr auto;
  }

  .loading {
    display: grid;
    align-items: center;
    justify-content: center;
  }

  .worlds {
    display: grid;
    align-content: start;
    box-sizing: border-box;
    height: 100%;
    overflow-y: scroll;
  }

  .world {
    display: grid;
    grid-template-columns: 1fr auto;
    padding: 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    cursor: pointer;
  }

  .world.selected {
    background: #393;
  }

  .actions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    border-top: 2px solid rgba(255, 255, 255, 0.05);
    padding: 1rem 0;
  }

  .actions > button {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: inherit;
    font-family: inherit;
    line-height: inherit;
    background: #2b2a33;
    color: inherit;
    border-radius: 0.25rem;
    margin: 0;
    padding: 0.5rem 1rem;
    border: 0;
  }

  .actions > button.join {
    background: #393;
  }

  .actions > button:disabled {
    background: #2b2a33;
    opacity: 0.5;
  }
</style>
