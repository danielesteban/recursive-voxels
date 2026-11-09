import { vec3 } from 'gl-matrix';
import { Sphere } from 'math/Sphere';
import type { Renderer } from 'render/Renderer';

export class RecursiveInstances {
  private readonly grid: { bounds: Sphere, position: vec3 }[] = [];
  private readonly instances: {
    count: number;
    cpu: Float32Array;
    gpu: GPUBuffer;
  };
  private readonly renderer: Renderer;

  constructor(renderer: Renderer, size: vec3) {
    const boundsOrigin = vec3.scale(vec3.create(), size, 0.5);
    const boundsRadius = vec3.len(boundsOrigin);
    const radius = Math.floor(512 / boundsRadius);
    for (let z = -radius; z <= radius; z++) {
      for (let y = -radius; y <= radius; y++) {
        for (let x = -radius; x <= radius; x++) {
          if (Math.sqrt(x ** 2 + z ** 2) < radius) {
            const position = vec3.fromValues(x, y, z);
            vec3.multiply(position, position, size);
            const bounds = new Sphere();
            vec3.add(bounds.center, boundsOrigin, position);
            bounds.radius = boundsRadius;
            this.grid.push({ bounds, position });
          }
        }
      }
    }
    this.grid.sort((a, b) => (
      vec3.length(a.position) - vec3.length(b.position)
    ));

    const device = renderer.getDevice();
    const maxInstances = Math.floor(this.grid.length / 2);
    this.instances = {
      count: 0,
      cpu: new Float32Array(maxInstances * 4),
      gpu: device.createBuffer({
        size: maxInstances * 4 * 4,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX,
      }),
    };
  
    this.renderer = renderer;
  }

  destroy() {
    const { instances } = this;
    instances.gpu.destroy();
  }

  getInstances() {
    return this.instances;
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
