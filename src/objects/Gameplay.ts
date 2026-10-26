import { mat3, mat4, quat, vec3 } from 'gl-matrix';
import { type Input, ButtonState } from 'compute/Input';
import { Raycaster } from 'compute/Raycaster';
import { BlockType } from 'compute/WorldConstants';
import type { Palette } from 'objects/Palette';
import type { World } from 'objects/World';
import { Camera } from 'render/Camera';
import type { Renderer } from 'render/Renderer';
import type { Toolbar } from 'ui/Toolbar';

enum BrushTool {
  block,
  blockLight,
  light,
}

export class Gameplay {
  private static readonly normalToLightBrush = [
    { normal: vec3.fromValues(0, 0, 1), value: BlockType.lightS },
    { normal: vec3.fromValues(-1, 0, 0), value: BlockType.lightW },
    { normal: vec3.fromValues(1, 0, 0), value: BlockType.lightE },
    { normal: vec3.fromValues(0, 0, -1), value: BlockType.lightN },
    { normal: vec3.fromValues(0, 1, 0), value: BlockType.lightT },
    { normal: vec3.fromValues(0, -1, 0), value: BlockType.lightB },
  ];

  private readonly input: Input;
  private readonly palette: Palette;
  private readonly raycaster = new Raycaster();
  private readonly renderer: Renderer;
  private readonly toolbar: Toolbar;
  private readonly world: World;

  private readonly brush = {
    tool: BrushTool.block,
    color: 46,
  };

  constructor(
    renderer: Renderer,
    input: Input,
    palette: Palette,
    toolbar: Toolbar,
    world: World,
  ) {
    this.input = input;
    this.palette = palette;
    this.renderer = renderer;
    this.toolbar = toolbar;
    this.world = world;
    toolbar.setActiveColor(this.brush.color);
    toolbar.setActiveTool(this.brush.tool);
  }

  animate() {
    const { brush, input, palette, raycaster, renderer, toolbar, world } = this;
    const buttons = input.getButtons();

    if (buttons.tool1 & ButtonState.down) {
      brush.tool = BrushTool.block;
      toolbar.setActiveTool(brush.tool);
    }
    if (buttons.tool2 & ButtonState.down) {
      brush.tool = BrushTool.blockLight;
      toolbar.setActiveTool(brush.tool);
    }
    if (buttons.tool3 & ButtonState.down) {
      brush.tool = BrushTool.light;
      toolbar.setActiveTool(brush.tool);
    }
    if (buttons.palette & ButtonState.down) {
      this.showPalette();
    }
    if ((buttons.primary & ButtonState.down) || (buttons.secondary & ButtonState.down)) {
      raycaster.setFromCamera(renderer.getCamera());
      if (!palette.visible || !this.setColorFromPalette()) {
        if (buttons.modifier & ButtonState.pressed) {
          this.setBrushFromPointer();
        } else {
          this.build(!!(buttons.secondary & ButtonState.down));
        }
      }
    }
    if (buttons.tertiary & ButtonState.down) {
      this.shootBall();
    }

    const movement = input.getMovement();
    if (movement[0] || movement[1] || movement[2]) {
      palette.visible = false;
    }
    world.setPlayerMovement(movement);
  }

  private build(isRemoving: boolean) {
    const { brush, raycaster, renderer, world } = this;
    const { normalToLightBrush } = Gameplay;
    const hit = raycaster.intersect(world.getChunks());
    if (!hit) {
      return;
    }
    vec3.scaleAndAdd(hit.position, hit.position, hit.normal, !isRemoving ? 0.9 : -0.1);
    vec3.floor(hit.position, hit.position);
    let value: BlockType;
    if (isRemoving) {
      value = BlockType.air;
    } else {
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
    }
    world.update(hit.position, value);
    renderer.getSFX().playAt(
      'build',
      hit.position,
      1,
      (Math.random() - 0.5) * 1000,
      { type: !isRemoving ? 'lowpass': 'highpass', frequency: 1000 + Math.random() * 1000 }
    );
  }

  private static readonly aux1 = vec3.create();
  private static readonly aux2 = vec3.create();
  private shootBall() {
    const { renderer, world } = this;
    const { aux1: origin, aux2: impulse } = Gameplay;
    const { position, direction } = renderer.getCamera();
    vec3.scaleAndAdd(origin, position, direction, 0.5);
    vec3.scale(impulse, direction, 10000.0);
    world.shootBall(origin, impulse);
    renderer.getSFX().playAt(
      'shot',
      origin,
      1,
      (Math.random() - 0.5) * 500,
    );
  }

  private setBrushFromPointer() {
    const { brush, raycaster, toolbar, world } = this;
    const hit = raycaster.intersect(world.getChunks());
    if (!hit) {
      return;
    }
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
    toolbar.setActiveColor(brush.color);
    toolbar.setActiveTool(brush.tool);
  }

  private setColorFromPalette() {
    const { brush, palette, raycaster, toolbar } = this;
    const hit = raycaster.intersect([palette]);
    if (!hit) {
      return false;
    }
    brush.color = Math.floor((1.0 - hit.uv[1]) * 8.0) * 8 + Math.floor(hit.uv[0] * 8.0);
    toolbar.setActiveColor(brush.color);
    palette.visible = false;
    return true;
  }

  private static readonly aux3 = vec3.create();
  private static readonly aux4 = quat.create();
  private static readonly aux5 = mat3.create();
  private static readonly aux6 = mat4.create();
  private showPalette() {
    const { renderer, palette } = this;
    const { aux3: palettePosition, aux4: paletteRotation, aux5: transformMat3, aux6: transformMat4 } = Gameplay;
    const { position, direction } = renderer.getCamera();
    palette.position = vec3.scaleAndAdd(palettePosition, position, direction, 1.5);
    mat4.targetTo(transformMat4, position, palette.position, Camera.up);
    mat3.fromMat4(transformMat3, transformMat4);
    palette.rotation = quat.fromMat3(paletteRotation, transformMat3);
    palette.visible = true;
  }
}
