import './main.css';
import { vec3 } from 'gl-matrix';
import { HDR } from 'compute/HDR';
import { Input } from 'compute/Input';
import { Raycaster } from 'compute/Raycaster';
import { BlockType } from 'compute/WorldConstants';
import { World } from 'objects/World';
import { Renderer } from 'render/Renderer';
import Environment from 'textures/citrus_orchard_road_puresky_2k.jpg';
import { FPS } from 'ui/FPS';

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
  const input = new Input(renderer);
  const raycaster = new Raycaster();
  const world = new World(renderer);

  renderer
    .addObject(world);

  const normalToLightBrush = [
    { normal: vec3.fromValues(0, 0, 1), brush: BlockType.lightS },
    { normal: vec3.fromValues(-1, 0, 0), brush: BlockType.lightW },
    { normal: vec3.fromValues(1, 0, 0), brush: BlockType.lightE },
    { normal: vec3.fromValues(0, 0, -1), brush: BlockType.lightN },
    { normal: vec3.fromValues(0, 1, 0), brush: BlockType.lightT },
    { normal: vec3.fromValues(0, -1, 0), brush: BlockType.lightB },
  ];

  const onFrame = () => {
    frame = requestAnimationFrame(onFrame);

    const time = performance.now() / 1000;
    const delta = Math.min(time - clock, 1 / 30);
    clock = time;
    fps.update(time);

    input.update(delta, world.getPlayer(), world.getSize());
    world.setPlayerMovement(input.getMovement());

    const pointer = input.getPointer();
    if (pointer.primaryDown || pointer.secondaryDown) {
      raycaster
        .setFromCamera(renderer.getCamera())
        .intersect(world.getChunks())
        .then((hit) => {
          if (!hit) {
            return;
          }
          vec3.scaleAndAdd(hit.position, hit.position, hit.normal, pointer.primaryDown ? 0.9 : -0.1);
          vec3.floor(hit.position, hit.position);
          let brush: BlockType;
          if (pointer.primaryDown) {
            switch(input.getTool()) {
              default:
                brush = BlockType.block;
                break;
              case 1:
                brush = BlockType.light;
                break;
              case 2: {
                const b = normalToLightBrush.find((b) => vec3.equals(b.normal, hit.normal));
                if (!b) return;
                brush = b.brush;
                break;
              }
            }
          } else {
            brush = BlockType.air;
          }
          world.update(hit.position, brush);
          renderer.getSFX().playAt(
            'build',
            hit.position,
            1,
            (Math.random() - 0.5) * 1000,
            { type: pointer.primaryDown ? 'lowpass': 'highpass', frequency: 1000 + Math.random() * 1000 }
          );
        });
    }
    if (pointer.tertiaryDown) {
      const { position, direction } = renderer.getCamera();
      const origin = vec3.scaleAndAdd(vec3.create(), position, direction, 0.5);
      world.shootBall(
        origin,
        vec3.scale(vec3.create(), direction, 10000.0)
      );
      renderer.getSFX().playAt(
        'shot',
        origin,
        1,
        (Math.random() - 0.5) * 500,
      );
    }

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
