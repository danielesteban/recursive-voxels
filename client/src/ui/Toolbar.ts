import Colors from 'textures/Palette.txt?raw';

export class Toolbar {
  private static readonly colors = Colors.split('\n');

  private readonly dom: HTMLElement;
  private readonly tools: HTMLElement[] = [];

  constructor() {
    const dom = document.getElementById('toolbar')!;
    this.dom = dom;
    {
      const color = document.createElement('div');
      color.classList.add('color');
      const icon = document.createElement('div');
      icon.classList.add('icon');
      color.appendChild(icon);
      const shortcut = document.createElement('div');
      shortcut.classList.add('shortcut');
      shortcut.innerText = 'E';
      color.appendChild(shortcut);
      dom.appendChild(color);
    }
    const tools = [
      {
        key: '1',
        scale: [1, 1],
        isColored: true,
      },
      {
        key: '2',
        scale: [1, 1],
      },
      {
        key: '3',
        scale: [0.5, 1],
      }
    ];
    for (const { key, scale, isColored } of tools) {
      const tool = document.createElement('div');
      tool.classList.add('tool');
      const icon = document.createElement('div');
      icon.classList.add('icon');
      const texture = document.createElement('canvas');
      texture.width = Math.floor(8 * scale[0]);
      texture.height = Math.floor(8 * scale[1]);
      texture.style.width = `${texture.width * 4}px`;
      texture.style.height = `${texture.height * 4}px`;
      const pixels = new ImageData(texture.width, texture.height);
      for (let i = 0, y = 0; y < texture.height; y++) {
        for (let x = 0; x < texture.width; x++, i += 4) {
          let light: number;
          if (y === 0 || y === texture.height - 1 || x === 0 || x === texture.width - 1) {
            light = 255 - Math.floor(Math.random() * 16);
          } else {
            light = 255 - Math.floor(Math.random() * 32);
          }
          pixels.data.set([light, light, light, 255], i);
        }
      }
      const ctx = texture.getContext('2d')!;
      ctx.putImageData(pixels, 0, 0);
      icon.appendChild(texture);
      if (isColored) {
        const tint = document.createElement('div');
        tint.classList.add('tint');
        tint.style.width = texture.style.width;
        tint.style.height = texture.style.height;
        icon.appendChild(tint);
      }
      tool.appendChild(icon);
      const shortcut = document.createElement('div');
      shortcut.classList.add('shortcut');
      const active = document.createElement('div');
      active.classList.add('active');
      active.innerText = key;
      shortcut.appendChild(active);
      tool.appendChild(shortcut);
      dom.appendChild(tool);
      this.tools.push(tool);
    }

    this.setActiveColor(0);
    this.setActiveTool(0);
  }

  setActiveColor(value: number) {
    const { dom } = this;
    const { colors } = Toolbar;
    dom.style.setProperty('--color', `#${colors[value]}`);
  }

  setActiveTool(value: number) {
    const { tools } = this;
    for (const tool of tools) tool.classList.remove('active');
    tools[value].classList.add('active');
  }
}
