<script lang="ts" module>
  export type Entries = { description: string; inputs: (string[][] | keyof typeof Icons)[] }[];

  const Icons = {
    leftClick: 'M181.563,0C120.762,0,59.215,30.525,59.215,88.873V237.5c0,65.658,53.412,119.071,119.071,119.071 c65.658,0,119.07-53.413,119.07-119.071V88.873C297.356,27.809,237.336,0,181.563,0z M274.945,237.5 c0,53.303-43.362,96.657-96.659,96.657c-53.299,0-96.657-43.354-96.657-96.657v-69.513c20.014,6.055,57.685,15.215,102.221,15.215 c28.515,0,59.831-3.809,91.095-14.567V237.5z M274.945,144.794c-81.683,31.233-168.353,7.716-193.316-0.364V88.873 c0-43.168,51.489-66.46,99.934-66.46c46.481,0,93.382,20.547,93.382,66.46V144.794z M190.893,48.389v81.248 c0,6.187-5.023,11.208-11.206,11.208c-6.185,0-11.207-5.021-11.207-11.208V48.389c0-6.186,5.021-11.207,11.207-11.207 C185.869,37.182,190.893,42.203,190.893,48.389z M154.938,40.068V143.73c-15.879,2.802-62.566-10.271-62.566-10.271 C80.233,41.004,154.938,40.068,154.938,40.068z',
    middleClick: 'M181.563,0C120.762,0,59.215,30.525,59.215,88.873V237.5c0,65.658,53.412,119.071,119.071,119.071 c65.658,0,119.07-53.413,119.07-119.071V88.873C297.356,27.809,237.336,0,181.563,0z M274.945,237.5 c0,53.303-43.362,96.657-96.659,96.657c-53.299,0-96.657-43.354-96.657-96.657v-69.513c20.014,6.055,57.685,15.215,102.221,15.215 c28.515,0,59.831-3.809,91.095-14.567V237.5z M274.945,144.794c-81.683,31.233-168.353,7.716-193.316-0.364V88.873 c0-43.168,51.489-66.46,99.934-66.46c46.481,0,93.382,20.547,93.382,66.46V144.794z M190.893,48.389v81.248 c0,6.187-5.023,11.208-11.206,11.208c-6.185,0-11.207-5.021-11.207-11.208V48.389c0-6.186,5.021-11.207,11.207-11.207 C185.869,37.182,190.893,42.203,190.893,48.389z',
    rightClick: 'M181.563,0C120.762,0,59.215,30.525,59.215,88.873V237.5c0,65.658,53.412,119.071,119.071,119.071 c65.658,0,119.07-53.413,119.07-119.071V88.873C297.356,27.809,237.336,0,181.563,0z M274.945,237.5 c0,53.303-43.362,96.657-96.659,96.657c-53.299,0-96.657-43.354-96.657-96.657v-69.513c20.014,6.055,57.685,15.215,102.221,15.215 c28.515,0,59.831-3.809,91.095-14.567V237.5z M274.945,144.794c-81.683,31.233-168.353,7.716-193.316-0.364V88.873 c0-43.168,51.489-66.46,99.934-66.46c46.481,0,93.382,20.547,93.382,66.46V144.794z M190.893,48.389v81.248 c0,6.187-5.023,11.208-11.206,11.208c-6.185,0-11.207-5.021-11.207-11.208V48.389c0-6.186,5.021-11.207,11.207-11.207 C185.869,37.182,190.893,42.203,190.893,48.389z M264.272,130.378c0,0-46.687,13.072-62.566,10.271V36.988 C201.706,36.988,276.412,37.923,264.272,130.378z',
  };
</script>
<script lang="ts">
  let { entries }: {
    entries: Entries;
  } = $props();
</script>

<div class="controls">
  {#each entries as { description, inputs }}
    <div class="entry">
      <div class:combo={inputs.length > 1}>
        {#each inputs as input, i}
          {#if i > 0}
            <div class="combinator">+</div>
          {/if}
          {#if typeof input === 'string'}
            <div class="icon">
              <svg viewBox="0 0 356.572 356.572">
                <path d={Icons[input]} />
              </svg>
            </div>
          {:else}
            <div class="keys">
              {#each input as row}
                <div class="row">
                  {#each row as key}
                    <div
                      class="key"
                      class:shift={key === 'Ctrl' || key === 'Shift' || key === 'Tab'}
                      class:spacebar={key === 'Space'}
                    >
                      {key}
                    </div>  
                  {/each}
                </div>
              {/each}
            </div>
          {/if}
        {/each}
      </div>
      <div class="description">
        {description}
      </div>
    </div>
  {/each}
</div>

<style>
  .controls {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
    border-left: 2px solid rgba(255, 255, 255, 0.05);
  }

  .entry {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .keys, .icon {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    height: 3rem;
  }

  .keys .row {
    display: flex;
    gap: 0.25rem;
  }

  .key {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1rem;
    height: 1rem;
    border: 2px solid #eee;
    border-radius: 0.25rem;
  }

  .key.shift {
    width: 3rem;
  }

  .key.spacebar {
    width: 4.25rem;
  }

  .icon > svg {
    width: 2.5rem;
    height: 2.5rem;
    fill: currentColor;
  }

  .combo {
    display: grid;
    align-items: center;
    grid-template-columns: 1fr auto 1fr;
  }

  .combo .keys:first-child, .combo .icon:first-child {
    align-items: end;
  }

  .combo .keys:last-child, .combo .icon:last-child {
    align-items: start;
  }

  .combinator {
    color: #aaa;
    padding: 0 0.5rem;
  }

  .combo .icon {
    margin-left: -0.375rem;
  }

  .description {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 3rem;
    color: #aaa;
  }
</style>
