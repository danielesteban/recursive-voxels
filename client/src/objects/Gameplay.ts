import { mat3, mat4, quat, vec3 } from 'gl-matrix';
import { BlockType } from '@shared/WorldConstants';
import { type Input, ButtonState } from 'compute/Input';
import { Raycaster } from 'compute/Raycaster';
import type { Palette } from 'objects/Palette';
import type { World } from 'objects/World';
import { Camera } from 'render/Camera';
import type { Renderer } from 'render/Renderer';
import { Tool, Toolbar } from 'ui/state/Toolbar.svelte';

export class Gameplay {
  private static readonly normalToLightBlock = [
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
  private readonly world: World;

  private historyTimers = {
    lastUndo: 0,
    undoDelay: 0.5,
    lastRedo: 0,
    redoDelay: 0.5,
  };

  constructor(
    renderer: Renderer,
    input: Input,
    palette: Palette,
    world: World,
  ) {
    this.input = input;
    this.palette = palette;
    this.renderer = renderer;
    this.world = world;
  }

  animate(_delta: number, time: number) {
    const { historyTimers, input, palette, raycaster, renderer, world } = this;
    const buttons = input.getButtons();

    if (buttons.palette & ButtonState.down) {
      this.showPalette();
    }
    if (buttons.tool1 & ButtonState.down) {
      Toolbar.activeTool = Tool.block;
    }
    if (buttons.tool2 & ButtonState.down) {
      Toolbar.activeTool = Tool.blockLight;
    }
    if (buttons.tool3 & ButtonState.down) {
      Toolbar.activeTool = Tool.light;
    }
    if ((buttons.primary & ButtonState.down) || (buttons.secondary & ButtonState.down)) {
      raycaster.setFromCamera(renderer.getCamera());
      if (!palette.visible || !this.setColorFromPalette()) {
        if (buttons.modifier & ButtonState.pressed) {
          this.setToolFromPointer();
        } else {
          this.build(!!(buttons.secondary & ButtonState.down));
        }
      }
    }
    if (buttons.tertiary & ButtonState.down) {
      this.shootBall();
    }
    if (
      (buttons.undo & ButtonState.down)
      || (
        (buttons.undo & ButtonState.pressed)
        && historyTimers.lastUndo < time - historyTimers.undoDelay
      )
    ) {
      world.undo();
      historyTimers.lastUndo = time;
      historyTimers.undoDelay = Math.max(historyTimers.undoDelay * 0.5, 0.1);
    }
    if (buttons.undo & ButtonState.up) {
      historyTimers.lastUndo = 0;
      historyTimers.undoDelay = 0.5;
    }
    if (
      (buttons.redo & ButtonState.down)
      || (
        (buttons.redo & ButtonState.pressed)
        && historyTimers.lastRedo < time - historyTimers.redoDelay
      )
    ) {
      world.redo();
      historyTimers.lastRedo = time;
      historyTimers.redoDelay = Math.max(historyTimers.redoDelay * 0.5, 0.1);
    }
    if (buttons.redo & ButtonState.up) {
      historyTimers.lastRedo = 0;
      historyTimers.redoDelay = 0.5;
    }

    const movement = input.getMovement();
    if (movement[0] || movement[1] || movement[2]) {
      palette.visible = false;
    }
    world.setPlayerMovement(input.getDirection(), movement);
  }

  private build(isRemoving: boolean) {
    const { raycaster, world } = this;
    const { normalToLightBlock } = Gameplay;
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
      switch(Toolbar.activeTool) {
        case Tool.block:
          value = BlockType.block + Toolbar.activeColor;
          break;
        case Tool.blockLight:
          value = BlockType.light;
          break;
        case Tool.light: {
          const b = normalToLightBlock.find((b) => vec3.equals(b.normal, hit.normal));
          if (!b) return;
          value = b.value;
          break;
        }
      }
    }
    world.update(hit.position, value);
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

  private setToolFromPointer() {
    const { raycaster, world } = this;
    const hit = raycaster.intersect(world.getChunks());
    if (!hit) {
      return;
    }
    const info = hit.obj.getInfo(hit.triangle);
    Toolbar.activeColor = info.color;
    switch (info.blockType) {
      case BlockType.light:
        Toolbar.activeTool = Tool.blockLight;
        break;
      case BlockType.lightS:
      case BlockType.lightW:
      case BlockType.lightE:
      case BlockType.lightN:
      case BlockType.lightT:
      case BlockType.lightB:
        Toolbar.activeTool = Tool.light;
        break;
      default:
        Toolbar.activeTool = Tool.block;
    }
  }

  private setColorFromPalette() {
    const { palette, raycaster } = this;
    const hit = raycaster.intersect([palette]);
    if (!hit) {
      return false;
    }
    palette.visible = false;
    Toolbar.activeColor = Math.floor((1.0 - hit.uv[1]) * 8.0) * 8 + Math.floor(hit.uv[0] * 8.0);
    Toolbar.activeTool = Tool.block;
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
