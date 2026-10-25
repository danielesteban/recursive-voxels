import './main.css';
import { mat3, mat4, quat, vec3 } from 'gl-matrix';
import { HDR } from 'compute/HDR';
import { ButtonState, Input } from 'compute/Input';
import { Raycaster } from 'compute/Raycaster';
import { BlockType } from 'compute/WorldConstants';
import { Chunk } from 'objects/Chunk';
import { Palette } from 'objects/Palette';
import { World } from 'objects/World';
import { Camera } from 'render/Camera';
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
  const palette = new Palette(renderer);
  const world = new World(renderer);

  renderer
    .addObject(world)
    .addObject(palette);

  // @dani @incomplete
  // Move all this input processing code
  // Into it's own file

  enum BrushTool {
    block,
    blockLight,
    light,
  }
  const brush = {
    tool: BrushTool.block,
    color: 46,
  };
  const normalToLightBrush = [
    { normal: vec3.fromValues(0, 0, 1), value: BlockType.lightS },
    { normal: vec3.fromValues(-1, 0, 0), value: BlockType.lightW },
    { normal: vec3.fromValues(1, 0, 0), value: BlockType.lightE },
    { normal: vec3.fromValues(0, 0, -1), value: BlockType.lightN },
    { normal: vec3.fromValues(0, 1, 0), value: BlockType.lightT },
    { normal: vec3.fromValues(0, -1, 0), value: BlockType.lightB },
  ];

  const onClick = (buttons: ReturnType<Input['getButtons']>) => {
    const hit = raycaster
      .setFromCamera(renderer.getCamera())
      .intersect([
        ...world.getChunks(),
        ...(palette.visible ? [palette] : []),
      ]);
    if (!hit) {
      return;
    }
    if (hit.obj instanceof Palette) {
      brush.color = Math.floor((1.0 - hit.uv[1]) * 8.0) * 8 + Math.floor(hit.uv[0] * 8.0);
      palette.visible = false;
      return;
    }
    if ((buttons.modifier & ButtonState.pressed) && hit.obj instanceof Chunk) {
      const info = hit.obj.getInfo(hit.triangle);
      switch (info.blockType) {
        case BlockType.light:
          brush.tool = 1;
          break;
        case BlockType.lightS:
        case BlockType.lightW:
        case BlockType.lightE:
        case BlockType.lightN:
        case BlockType.lightT:
        case BlockType.lightB:
          brush.tool = 2;
          break;
        default:
          brush.tool = 0;
      }
      brush.color = info.color;
      return;
    }
    vec3.scaleAndAdd(hit.position, hit.position, hit.normal, (buttons.primary & ButtonState.down) ? 0.9 : -0.1);
    vec3.floor(hit.position, hit.position);
    let value: BlockType;
    if (buttons.primary & ButtonState.down) {
      switch(brush.tool) {
        case BrushTool.block:
          value = BlockType.block + brush.color;
          break;
        case BrushTool.blockLight:
          value = BlockType.light;
          break;
        case BrushTool.light: {
          const b = normalToLightBrush.find((b) => vec3.equals(b.normal, hit.normal));
          if (!b) return;
          value = b.value;
          break;
        }
      }
    } else {
      value = BlockType.air;
    }
    world.update(hit.position, value);
    renderer.getSFX().playAt(
      'build',
      hit.position,
      1,
      (Math.random() - 0.5) * 1000,
      { type: (buttons.primary & ButtonState.down) ? 'lowpass': 'highpass', frequency: 1000 + Math.random() * 1000 }
    );
  };

  const onShoot = () => {
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
  };

  const showPalette = () => {
    const { position, direction } = renderer.getCamera();
    palette.position = vec3.scaleAndAdd(vec3.create(), position, direction, 1.5);
    const transform = mat4.targetTo(mat4.create(), position, palette.position, Camera.up);
    palette.rotation = quat.fromMat3(quat.create(), mat3.fromMat4(mat3.create(), transform));
    palette.visible = true;
  };

  const processInput = () => {
    const buttons = input.getButtons();
    if ((buttons.primary & ButtonState.down) || (buttons.secondary & ButtonState.down)) {
      onClick(buttons);
    }
    if (buttons.tertiary & ButtonState.down) {
      onShoot();
    }
    if (buttons.palette & ButtonState.down) {
      showPalette();
    }
    if (buttons.tool1 & ButtonState.down) {
      brush.tool = BrushTool.block;
    }
    if (buttons.tool2 & ButtonState.down) {
      brush.tool = BrushTool.blockLight;
    }
    if (buttons.tool3 & ButtonState.down) {
      brush.tool = BrushTool.light;
    }

    const movement = input.getMovement();
    if (movement[0] || movement[1] || movement[2]) {
      palette.visible = false;
    }
    world.setPlayerMovement(movement);
  };

  const onFrame = () => {
    frame = requestAnimationFrame(onFrame);

    const time = performance.now() / 1000;
    const delta = Math.min(time - clock, 1 / 30);
    clock = time;
    fps.update(time);

    input.update(delta, world.getPlayer(), world.getSize());
    processInput();

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
