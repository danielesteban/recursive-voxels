import { vec3 } from 'gl-matrix';
import { LerpWrapped } from 'math/LerpWrapped';
import { Camera } from 'render/Camera';
import type { Renderer } from 'render/Renderer';

export enum ButtonState {
  pressed = (1 << 0),
  down = (1 << 1),
  up = (1 << 2),
}

export class Input {
  private isLocked = false;
  private canvas: HTMLCanvasElement;
  private camera: Camera;
  
  private static readonly sensibility = 0.003;
  private static readonly maxPhi = -0.001;
  private static readonly minPhi = 0.001 - Math.PI;
  private readonly look = {
    state: {
      phi: Math.PI * -0.5,
      theta: 0,
    },
    target: {
      phi: Math.PI * -0.5,
      theta: 0,
    },
  };
  private static minSpeed = Math.log(1);
  private static maxSpeed = Math.log(64);
  private static speedRange = Input.maxSpeed - Input.minSpeed;
  private speed = 8;
  private readonly movement: { x: number[]; y: number[]; z: number[] } = {
    x: [],
    y: [],
    z: [],
  };
  private readonly buttons = {
    primary: 0,
    secondary: 0,
    tertiary: 0,
    modifier: 0,
    palette: 0,
    undo: 0,
    redo: 0,
    tool1: 0,
    tool2: 0,
    tool3: 0,
  };

  constructor(renderer: Renderer) {
    this.canvas = renderer.getCanvas();
    this.camera = renderer.getCamera();
    this.updateDirection();

    this.onkeydown = this.onkeydown.bind(this);
    document.addEventListener('keydown', this.onkeydown);
    this.onkeyup = this.onkeyup.bind(this);
    document.addEventListener('keyup', this.onkeyup);
    this.onpointerlock = this.onpointerlock.bind(this);
    document.addEventListener('pointerlockchange', this.onpointerlock);
    this.onpointerdown = this.onpointerdown.bind(this);
    this.canvas.addEventListener('pointerdown', this.onpointerdown);
    this.onpointermove = this.onpointermove.bind(this);
    this.canvas.addEventListener('pointermove', this.onpointermove);
    this.onpointerup = this.onpointerup.bind(this);
    this.canvas.addEventListener('pointerup', this.onpointerup);
    this.onwheel = this.onwheel.bind(this);
    this.canvas.addEventListener('wheel', this.onwheel);
  }

  private onkeydown(e: KeyboardEvent) {
    const { buttons, isLocked, movement } = this;
    if (!isLocked || e.repeat) return;
    switch (e.key.toUpperCase()) {
      case 'W':
        movement.z.unshift(1);
        break;
      case 'S':
        movement.z.unshift(-1);
        break;
      case 'A':
        movement.x.unshift(-1);
        break;
      case 'D':
        movement.x.unshift(1);
        break;
      case ' ':
        movement.y.unshift(1);
        break;
      case 'SHIFT':
        if (!e.ctrlKey && !e.metaKey) {
          movement.y.unshift(-1);
        }
        break;
      case 'CONTROL':
        buttons.modifier |= ButtonState.pressed | ButtonState.down;
        break;
      case 'E':
        buttons.palette |= ButtonState.pressed | ButtonState.down;
        break;
      case 'Z':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (e.shiftKey) {
            buttons.redo |= ButtonState.pressed | ButtonState.down;
          } else {
            buttons.undo |= ButtonState.pressed | ButtonState.down;
          }
        }
        break;
      case '1':
        buttons.tool1 |= ButtonState.pressed | ButtonState.down;
        break;
      case '2':
        buttons.tool2 |= ButtonState.pressed | ButtonState.down;
        break;
      case '3':
        buttons.tool3 |= ButtonState.pressed | ButtonState.down;
        break;
      case 'TAB':
        e.preventDefault();
        document.body.classList.toggle('hiddenUI');
        break;
    }
  }

  private onkeyup(e: KeyboardEvent) {
    const { buttons, movement } = this;
    if (e.repeat) return;
    switch (e.key.toUpperCase()) {
      case 'W': {
        const i = movement.z.indexOf(1);
        if (i !== -1) movement.z.splice(i, 1);
        break;
      }
      case 'S': {
        const i = movement.z.indexOf(-1);
        if (i !== -1) movement.z.splice(i, 1);
        break;
      }
      case 'A': {
        const i = movement.x.indexOf(-1);
        if (i !== -1) movement.x.splice(i, 1);
        break;
      }
      case 'D': {
        const i = movement.x.indexOf(1);
        if (i !== -1) movement.x.splice(i, 1);
        break;
      }
      case ' ': {
        const i = movement.y.indexOf(1);
        if (i !== -1) movement.y.splice(i, 1);
        break;
      }
      case 'SHIFT': {
        const i = movement.y.indexOf(-1);
        if (i !== -1) movement.y.splice(i, 1);
        break;
      }
      case 'CONTROL':
        buttons.modifier &= ~ButtonState.pressed;
        buttons.modifier |= ButtonState.up;
        break;
      case 'E':
        buttons.palette &= ~ButtonState.pressed;
        buttons.palette |= ButtonState.up;
        break;
      case 'Z':
        if (buttons.undo & ButtonState.pressed) {
          buttons.undo &= ~ButtonState.pressed;
          buttons.undo |= ButtonState.up;
        }
        if (buttons.redo & ButtonState.pressed) {
          buttons.redo &= ~ButtonState.pressed;
          buttons.redo |= ButtonState.up;
        }
        break;
      case '1':
        buttons.tool1 &= ~ButtonState.pressed;
        buttons.tool1 |= ButtonState.up;
        break;
      case '2':
        buttons.tool2 &= ~ButtonState.pressed;
        buttons.tool2 |= ButtonState.up;
        break;
      case '3':
        buttons.tool3 &= ~ButtonState.pressed;
        buttons.tool3 |= ButtonState.up;
        break;      
    }
  }

  private onpointerlock() {
    const { buttons, canvas, movement } = this;
    this.isLocked = document.pointerLockElement === canvas;
    document.body.classList[this.isLocked ? 'add' : 'remove']('pointerlock');
    if (!this.isLocked) {
      for (const key in buttons) {
        if (buttons[key as (keyof typeof buttons)] & ButtonState.pressed) {
          buttons[key as (keyof typeof buttons)] |= ButtonState.up;
        }
        buttons[key as (keyof typeof buttons)] &= ~(ButtonState.pressed | ButtonState.down);
      }
      movement.x.length = movement.y.length = movement.z.length = 0;
    }
  }

  private onpointerdown(e: PointerEvent) {
    const { buttons, canvas, isLocked } = this;
    if (!isLocked) {
      canvas.requestPointerLock();
    } else {
      switch (e.button) {
        case 0:
          buttons.primary |= ButtonState.pressed | ButtonState.down;
          break;
        case 1:
          buttons.tertiary |= ButtonState.pressed | ButtonState.down;
          break;
        case 2:
          buttons.secondary |= ButtonState.pressed | ButtonState.down;
          break;
      }
    }
  }

  private onpointermove(e: PointerEvent) {
    const { isLocked, look } = this;
    const { minPhi, maxPhi, sensibility } = Input;
    if (!isLocked) {
      return;
    }
    look.target.phi += -e.movementY * sensibility;
    look.target.phi = Math.min(Math.max(look.target.phi, minPhi), maxPhi);
    look.target.theta += -e.movementX * sensibility;
  }

  private onpointerup(e: PointerEvent) {
    const { buttons } = this;
    switch (e.button) {
      case 0:
        buttons.primary &= ~ButtonState.pressed;
        buttons.primary |= ButtonState.up;
        break;
      case 1:
        buttons.tertiary &= ~ButtonState.pressed;
        buttons.tertiary |= ButtonState.up;
        break;
      case 2:
        buttons.secondary &= ~ButtonState.pressed;
        buttons.secondary |= ButtonState.up;
        break;
    }
  }

  private onwheel({ deltaY }: WheelEvent) {
    const { speed, isLocked } = this;
    if (!isLocked) {
      return;
    }
    const { minSpeed, speedRange } = Input;
    const logSpeed = Math.min(
      Math.max(
        ((Math.log(speed) - minSpeed) / speedRange) - (-deltaY * 0.0003),
        0
      ),
      1
    );
    this.speed = Math.exp(minSpeed + logSpeed * speedRange);
  }

  private static readonly aux1 = vec3.create();
  private updateDirection() {
    const { camera, look } = this;
    const { aux1: direction } = Input;
    camera.direction = vec3.set(
      direction,
      Math.sin(look.state.phi) * Math.sin(look.state.theta),
      Math.cos(look.state.phi),
      Math.sin(look.state.phi) * Math.cos(look.state.theta)
    );
  }

  getDirection() {
    const { camera } = this;
    return camera.direction;
  }

  private static readonly aux2 = vec3.create();
  private static readonly aux3 = vec3.create();
  getMovement() {
    const { camera, movement, speed } = this;
    const { aux2: right, aux3: move } = Input;
    vec3.set(move, 0, 0, 0);
    if (movement.x.length || movement.y.length || movement.z.length) {
      vec3.cross(right, camera.direction, Camera.up);
      if (movement.x.length) {
        vec3.scaleAndAdd(move, move, right, movement.x[0]);
      }
      if (movement.y.length) {
        vec3.scaleAndAdd(move, move, Camera.up, movement.y[0]);
      }
      if (movement.z.length) {
        vec3.scaleAndAdd(move, move, camera.direction, movement.z[0]);
      }
      vec3.normalize(move, move);
      vec3.scale(move, move, speed);
    }
    return move;
  }

  getButtons() {
    const { buttons } = this;
    const data = { ...buttons };
    for (const key in buttons) {
      buttons[key as (keyof typeof buttons)] &= ~(ButtonState.down | ButtonState.up);
    }
    return data;
  }

  private static readonly aux4 = vec3.create();
  update(delta: number, player: vec3, size: vec3) {
    const { camera, look } = this;
    const { aux4: target } = Input;

    const damp = Math.exp(-20 * delta);
    let directionNeedsUpdate = false;
    for (const key of ['phi', 'theta'] as (keyof typeof look.state)[]) {
      if (look.state[key] !== look.target[key]) {
        const diff = look.target[key] - look.state[key];
        if (Math.abs(diff) > 0.001) {
          look.state[key] += diff * (1 - damp);
        } else {
          look.state[key] = look.target[key];
        }
        directionNeedsUpdate = true;
      }
    }
    if (directionNeedsUpdate) {
      this.updateDirection();
    }

    if (
      LerpWrapped(
        target,
        camera.position,
        player,
        size,
        delta
      )
    ) {
      camera.position = target;
    }
  }
}
