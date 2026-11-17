<script lang="ts">
  import Dialog from 'ui/components/Dialog.svelte';
  import { Dialogs } from 'ui/state/Dialogs.svelte';
  import { FPS } from 'ui/state/FPS.svelte';
  import { Settings } from 'ui/state/Settings.svelte';

  const dismiss = () => {
    Dialogs.hide('settings');
  };
</script>

<Dialog id="settings">
  <div class="wrapper">
    <div class="title">
      Settings
      <div class="fps">
        {FPS.text}
      </div>
    </div>
    <div class="content">
      <div class="settings">
        <div class="setting">
          <label for="settings-fov">
            FOV
            <span>({Settings.fov}°)</span>
          </label>
          <input
            id="settings-fov"
            type="range"
            min={60}
            max={90}
            step={1}
            bind:value={Settings.fov}
          />
        </div>
        <div class="setting">
          <label for="settings-render-distance">
            Render Distance
            <span>({Settings.renderDistance}m)</span>
          </label>
          <input
            id="settings-render-distance"
            type="range"
            min={128}
            max={1024}
            step={128}
            bind:value={Settings.renderDistance}
          />
        </div>
        <div class="setting">
          <label for="settings-resolution">
            Resolution
            <span>({Math.round(Settings.resolution * 100)}%)</span>
          </label>
          <input
            id="settings-resolution"
            type="range"
            min={0.25}
            max={1}
            step={0.25}
            bind:value={Settings.resolution}
          />
        </div>
      </div>
      <div class="actions">
        <button onclick={dismiss}>
          Back
        </button>
      </div>
    </div>
  </div>
</Dialog>

<style>
  .wrapper {
    display: grid;
    grid-template-rows: auto 1fr;
    width: 640px;
  }

  .title {
    display: flex;
    justify-content: space-between;
    padding: 1rem;
    font-size: 1.375rem;
    line-height: 1em;
    border-bottom: 2px solid rgba(255, 255, 255, 0.05);
  }

  .fps {
    color: #aaa;
  }

  .content {
    display: grid;
    grid-template-rows: 1fr auto;
  }

  .settings {
    display: grid;
    align-content: start;
    gap: 1rem;
    padding: 1rem;
  }

  .setting {
    display: grid;
  }

  .setting > label > span {
    color: #aaa;
  }

  .actions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    border-top: 2px solid rgba(255, 255, 255, 0.05);
    padding: 1rem 0;
  }
</style>
