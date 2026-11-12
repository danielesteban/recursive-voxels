import './main.css';
import { HDR } from 'compute/HDR';
import { Input } from 'compute/Input';
import { Gameplay } from 'objects/Gameplay';
import { Palette } from 'objects/Palette';
import { World } from 'objects/World';
import { Renderer } from 'render/Renderer';
import Environment from 'textures/citrus_orchard_road_puresky_2k.jpg';
import { FPS } from 'ui/state/FPS.svelte';
import { Status } from 'ui/state/Status.svelte';
import { Welcome } from 'ui/state/Welcome.svelte';
import { mountUI } from 'ui/UI';

const app = document.getElementById('app')!;
const canvas = document.createElement('canvas');

mountUI(document.getElementById('ui')!);

Promise.all([
  HDR(Environment),
  Renderer.create(canvas),
])
.then(async ([environment, renderer]) => {
  renderer.setEnvironment(environment);

  let clock: number;
  let frame: number;

  const input = new Input(renderer);
  const palette = new Palette(renderer);
  const world = new World(renderer);
  const gameplay = new Gameplay(renderer, input, palette, world);

  renderer
    .addObject(world)
    .addObject(gameplay)
    .addObject(palette);

  const onFrame = () => {
    frame = requestAnimationFrame(onFrame);

    const time = performance.now() / 1000;
    const delta = Math.min(time - clock, 1 / 30);
    clock = time;
    FPS.update(time);
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
      FPS.reset();
      world.resumeSimulation();
    } else {
      cancelAnimationFrame(frame);
      world.pauseSimulation();
    }
  };

  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVisibility);
  onResize();
  app.appendChild(canvas);

  clock = performance.now() / 1000;
  frame = requestAnimationFrame(onFrame);
  FPS.reset();

  await world.init(
    location.hash.substring(1) === '/multiplayer' ? (
      '6af11800c420506757d047dd'
    ) : (
      undefined
    ));

  Welcome.onPlay = () => canvas.requestPointerLock();
  Welcome.isShowing = true;
}).catch((e: Error) => {
  Status.error = e.message;
  console.error(e);
}).finally(() => {
  Status.isLoading = false;
});
