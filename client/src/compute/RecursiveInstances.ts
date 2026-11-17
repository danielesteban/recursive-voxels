import { vec3 } from 'gl-matrix';
import { Sphere } from 'math/Sphere';
import type { Renderer } from 'render/Renderer';

export class RecursiveInstances {
  private readonly grid: { bounds: Sphere, position: vec3 }[] = [];
  private readonly instances: {
    count: number;
    cpu: Float32Array;
    gpu: GPUBuffer;
  } = {
    count: 0,
    cpu: null!,
    gpu: null!,
  };
  private readonly renderer: Renderer;

  constructor(renderer: Renderer, radius: number, size: vec3) {
    this.renderer = renderer;
    this.setGrid(radius, size);
  }

  destroy() {
    const { instances } = this;
    instances.gpu.destroy();
  }

  getInstances() {
    return this.instances;
  }

  setGrid(radius: number, size: vec3) {
    const { grid, instances, renderer } = this;
    const boundsOrigin = vec3.scale(vec3.create(), size, 0.5);
    const boundsRadius = vec3.len(boundsOrigin);
    const instanceRadius = Math.floor(radius / boundsRadius);
    grid.length = 0;
    for (let z = -instanceRadius; z <= instanceRadius; z++) {
      for (let y = -instanceRadius; y <= instanceRadius; y++) {
        for (let x = -instanceRadius; x <= instanceRadius; x++) {
          if (Math.floor(Math.sqrt(x ** 2 + y ** 2 + z ** 2)) <= instanceRadius) {
            const position = vec3.fromValues(x, y, z);
            vec3.multiply(position, position, size);
            const bounds = new Sphere();
            vec3.add(bounds.center, boundsOrigin, position);
            bounds.radius = boundsRadius;
            grid.push({ bounds, position });
          }
        }
      }
    }
    grid.sort((a, b) => (
      vec3.sqrLen(a.position) - vec3.sqrLen(b.position)
    ));

    const device = renderer.getDevice();
    const maxInstances = Math.floor(grid.length / 3 * 2);
    instances.count = 0;
    instances.cpu = new Float32Array(maxInstances * 4);
    if (instances.gpu) {
      instances.gpu.destroy();
    }
    instances.gpu = device.createBuffer({
      size: maxInstances * 4 * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX,
    });
  }

  update() {
    const { grid, instances, renderer } = this;
    instances.count = 0;
    for (const instance of grid) {
      if (renderer.getCamera().getFrustum().intersects(instance.bounds)) {
        instances.cpu.set(instance.position, instances.count * 4);
        instances.count++;
      }
    }
    renderer.getDevice().queue.writeBuffer(
      instances.gpu, 0,
      instances.cpu.subarray(0, instances.count * 4)
    );
  }
}
