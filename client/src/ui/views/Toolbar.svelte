<script lang="ts" module>
  import Palette from 'textures/Palette.txt?raw';
  import { Tool } from 'ui/state/Toolbar.svelte';

  const colors = Palette.split('\n');

  const getTexture = (width: number, height: number) => {
    const texture = document.createElement('canvas');
    texture.width = width;
    texture.height = height;
    const pixels = new ImageData(texture.width, texture.height);
    for (let i = 0, y = 0; y < texture.height; y++) {
      for (let x = 0; x < texture.width; x++, i += 4) {
        let light: number;
        if (y === 0 || y === texture.height - 1 || x === 0 || x === texture.width - 1) {
          light = 255 - Math.floor(Math.random() * 8);
        } else {
          light = 255 - Math.floor(Math.random() * 32);
        }
        pixels.data.set([light, light, light, 255], i);
      }
    }
    const ctx = texture.getContext('2d')!;
    ctx.putImageData(pixels, 0, 0);
    return texture;
  };

  const getIcon = (pos: [number, number], scale: [number, number]) => {
    const icon = document.createElement('canvas');
    icon.width = 128;
    icon.height = 128;
    const ctx = icon.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#fff';

    const cos30 = Math.cos(Math.PI / 6);
    const sin30 = Math.sin(Math.PI / 6);
    const centerX = icon.width * pos[0];
    const centerY = icon.height * pos[1];
    const width = icon.width / 2;
    const height = icon.height / 2;

    const textureTop = getTexture(8 * scale[0], 8 * scale[0]);
    const textureSide = getTexture(8 * scale[0], 8 * scale[1]);

    ctx.setTransform(
      -cos30, -sin30,
      cos30, -sin30,
      centerX, centerY
    );
    ctx.drawImage(textureTop, 0, 0, width * scale[0], height * scale[0]);
    ctx.strokeRect(0, 0, width * scale[0], height * scale[0]);
    ctx.setTransform(
      -cos30, -sin30,
      0, 1,
      centerX, centerY
    );
    ctx.drawImage(textureSide, 0, 0, width * scale[0], height * scale[1]);
    ctx.strokeRect(0, 0, width * scale[0], height * scale[1]);
    ctx.setTransform(
      cos30, -sin30,
      0, 1,
      centerX, centerY
    );
    ctx.drawImage(textureSide, 0, 0, width * scale[0], height * scale[1]);
    ctx.strokeRect(0, 0, width * scale[0], height * scale[1]);

    return icon.toDataURL();
  };

  const tools = [
    {
      id: Tool.block,
      icon: getIcon([0.5, 0.5], [1, 1]),
      isColored: true,
      shortcut: '1',
    },
    {
      id: Tool.blockLight,
      icon: getIcon([0.5, 0.5], [1, 1]),
      shortcut: '2',
    },
    {
      id: Tool.light,
      icon: getIcon([0.5, 0.25], [0.5, 1.5]),
      shortcut: '3',
    }
  ];
</script>
<script lang="ts">
  import { Toolbar } from 'ui/state/Toolbar.svelte';
</script>

<div class="toolbar" style="--color: #{colors[Toolbar.activeColor]}">
  <div class="color">
    <div class="swatch"></div>
    <div class="shortcut">
      E
    </div>
  </div>
  {#each tools as tool}
    <div class="tool" class:active={tool.id === Toolbar.activeTool}>
      <div class="icon">
        <img
          alt="icon"
          src={tool.icon} 
        />
        {#if tool.isColored}
          <div
            class="tint"
            style="mask-image: url({tool.icon})"
          ></div>
        {/if}
      </div>
      <div class="shortcut">
        <div class="badge">
          {tool.shortcut}
        </div>
      </div>
    </div>
  {/each}
</div>

<style>
  .toolbar {
    display: none;
    position: absolute;
    bottom: 0.5rem;
    left: 50%;
    transform: translate(-50%, 0);
    border: 0.25rem solid #000;
    border-radius: 0.25rem;
    box-shadow: 0 0 0.25rem rgba(0, 0, 0, 0.3);
    background: rgba(0, 0, 0, 0.8);
    z-index: 1;
  }

  .toolbar > div {
    border-left: 0.25rem solid #000;
  }

  .toolbar > div:first-child {
    border-left: 0;
  }

  .swatch {
    border: 0.25rem solid rgba(0, 0, 0, 0.5);
    border-radius: 1.5rem;
    width: 1.5rem;
    height: 1.5rem;
    margin: 0.5rem;
    background: var(--color);
  }

  .color .shortcut {
    padding-bottom: 0.0625rem;
  }

  .icon {
    margin: 0.5rem;
    width: 2rem;
    height: 2rem;
    display: grid;
    align-items: center;
    justify-items: center;
    position: relative;
  }

  .icon > img {
    width: 100%;
    height: 100%;
  }

  .icon .tint {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 100%;
    height: 100%;
    background: var(--color);
    mask-size: 100%;
    mix-blend-mode: multiply;
  }

  .shortcut {
    background: #000;
    text-align: center;
    padding-top: 0.25rem;
    line-height: 1rem;
  }

  .badge {
    border-radius: 0.125rem;
    padding-bottom: 0.0625rem;
  }

  .tool.active .badge {
    background: #393;
  }

  :global(body.pointerlock) .toolbar {
    display: flex;
  }

  :global(body.hiddenUI) .toolbar {
    display: none;
  }
</style>
