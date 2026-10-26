import './main.css';
import { HDR } from 'compute/HDR';
import { Input } from 'compute/Input';
import { Gameplay } from 'objects/Gameplay';
import { Palette } from 'objects/Palette';
import { World } from 'objects/World';
import { Renderer } from 'render/Renderer';
import Environment from 'textures/citrus_orchard_road_puresky_2k.jpg';
import { FPS } from 'ui/FPS';
import { Toolbar } from 'ui/Toolbar';

const app = document.getElementById('app')!;
const canvas = document.createElement('canvas');

Promise.all([
  HDR(Environment),
  Renderer.create(canvas),
])
.then(([environment, renderer]) => {
  renderer.setEnvironment(environment);

  let clock: number;
  let frame: number;

  const fps = new FPS();
  const toolbar = new Toolbar();
  const input = new Input(renderer);
  const palette = new Palette(renderer);
  const world = new World(renderer);
  const gameplay = new Gameplay(renderer, input, palette, toolbar, world);

  renderer
    .addObject(world)
    .addObject(gameplay)
    .addObject(palette);

  const onFrame = () => {
    frame = requestAnimationFrame(onFrame);

    const time = performance.now() / 1000;
    const delta = Math.min(time - clock, 1 / 30);
    clock = time;
    fps.update(time);
    input.update(delta, world.getPlayer(), world.getSize());

    renderer
      .animate(delta, time)
      .compute()
      .render();
  };
  const onResize = () => {
    const rect = app.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height);
  };
  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      clock = performance.now() / 1000;
      frame = requestAnimationFrame(onFrame);
    } else {
      cancelAnimationFrame(frame);
    }
  };

  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVisibility);
  onResize();
  app.appendChild(canvas);

  clock = performance.now() / 1000;
  frame = requestAnimationFrame(onFrame);
}).catch((e: Error) => {
  const error = document.getElementById('error')!;
  error.textContent = `Error: "${e.message}"`;
  error.style.display = 'block';
}).finally(() => {
  document.getElementById('loading')!.style.display = 'none';
});
