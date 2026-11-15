import { type mat4, vec2, vec3 } from 'gl-matrix';
import type { Sphere } from 'math/Sphere';
import type { Camera } from 'render/Camera';
import type { Geometry } from 'render/Geometry';

export type Intersection = {
  distance: number;
  triangle: number;
  position: vec3;
  normal: vec3;
  uv: vec2;
  obj: any;
};

export class Raycaster {
  readonly ray = new Ray();

  intersect(objects: { raycast: (ray: Ray, intersections: Intersection[]) => void }[]) {
    const { ray } = this;
    const intersections: Intersection[] = [];
    for (const obj of objects) {
      obj.raycast(ray, intersections);
    }
    intersections.sort((a, b) => a.distance - b.distance);
    return intersections[0];
  }

  setFromCamera(camera: Camera, position?: vec2) {
    const { ray } = this;
    vec3.copy(ray.origin, camera.position);
    vec3.set(ray.direction, position?.[0] || 0, position?.[1] || 0, 0.5);
    vec3.transformMat4(ray.direction, ray.direction, camera.getProjectionInverse());
    vec3.transformMat4(ray.direction, ray.direction, camera.getViewInverse());
    vec3.sub(ray.direction, ray.direction, ray.origin);
    vec3.normalize(ray.direction, ray.direction);
    return this;
  }
}

export class Ray {
  readonly origin = vec3.create();
  readonly direction = vec3.create();
  maxDistance = 128;

  private static readonly aux1 = vec3.create();
  private static readonly aux2 = vec3.create();
  private static readonly aux3 = vec3.create();
  private static readonly aux4 = vec3.create();
  private static getBarycoord(point: vec3, a: vec3, b: vec3, c: vec3) {
    const { aux1: v0, aux2: v1, aux3: v2, aux4: barycoord } = Ray;

    vec3.sub(v0, c, a);
    vec3.sub(v1, b, a);
    vec3.sub(v2, point, a);

    const dot00 = vec3.dot(v0, v0);
    const dot01 = vec3.dot(v0, v1);
    const dot02 = vec3.dot(v0, v2);
    const dot11 = vec3.dot(v1, v1);
    const dot12 = vec3.dot(v1, v2);

    const denom = (dot00 * dot11 - dot01 * dot01);
    if (denom === 0) {
      return null;
    }

    const invDenom = 1 / denom;
    const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
    const v = (dot00 * dot12 - dot01 * dot02) * invDenom;

    return vec3.set(barycoord, 1 - u - v, v, u);
  }

  private static readonly aux5 = vec3.create();
  private static readonly aux6 = vec3.create();
  private static readonly aux7 = vec3.create();
  intersectGeometry(bounds: Sphere, geometry: Geometry, transform: mat4) {
    const { origin, direction, maxDistance } = this;
    const { aux5: a, aux6: b, aux7: c } = Ray;
    if (!bounds.containsPoint(origin)) {
      const distanceToBounds = this.intersectSphere(bounds);
      if (!distanceToBounds || distanceToBounds > maxDistance) {
        return null;
      }
    }
    let triangleIndex = 0;
    let intersection: { distance: number; triangle: number; } | undefined;
    for (const triangle of geometry.getTriangles()) {
      vec3.transformMat4(a, triangle[0], transform);
      vec3.transformMat4(b, triangle[1], transform);
      vec3.transformMat4(c, triangle[2], transform);
      const distance = this.intersectTriangle(a, b, c);
      if (
        distance > 0 && distance <= maxDistance
        && (
          !intersection
          || distance < intersection.distance
        )
      ) {
        intersection = { distance, triangle: triangleIndex };
      }
      triangleIndex++;
    }
    if (intersection) {
      const position = vec3.scaleAndAdd(vec3.create(), origin, direction, intersection.distance);
      const triangle = geometry.getTriangle(intersection.triangle);
      vec3.transformMat4(a, triangle.position[0], transform);
      vec3.transformMat4(b, triangle.position[1], transform);
      vec3.transformMat4(c, triangle.position[2], transform);
      const normal = vec3.create();
      const uv = vec2.create();
      const barycoord = Ray.getBarycoord(position, a, b, c);
      if (barycoord) {
        vec3.scaleAndAdd(normal, normal, triangle.normal[0], barycoord[0]);
        vec3.scaleAndAdd(normal, normal, triangle.normal[1], barycoord[1]);
        vec3.scaleAndAdd(normal, normal, triangle.normal[2], barycoord[2]);
        if (vec3.dot(normal, direction) > 0) {
          vec3.scale(normal, normal, -1);
        }
        vec2.scaleAndAdd(uv, uv, triangle.uv[0], barycoord[0]);
        vec2.scaleAndAdd(uv, uv, triangle.uv[1], barycoord[1]);
        vec2.scaleAndAdd(uv, uv, triangle.uv[2], barycoord[2]);
      }
      return {
        distance: intersection.distance,
        triangle: intersection.triangle,
        position,
        normal,
        uv,
      } satisfies Omit<Intersection, 'obj'>;
    }
    return null;
  }

  private static readonly aux8 = vec3.create();
  intersectSphere(sphere: Sphere) {
    const { origin, direction } = this;
    const { aux8: vector } = Ray;
    if (sphere.radius < 0) return 0;
    vec3.sub(vector, sphere.center, origin);
    const tca = vec3.dot(vector, direction);
    const d2 = vec3.dot(vector, vector) - tca * tca;
    const radius2 = sphere.radius * sphere.radius;
    if (d2 > radius2) return 0;
    const thc = Math.sqrt(radius2 - d2);
    const t0 = tca - thc;
    const t1 = tca + thc;
    if (t1 < 0) return 0;
    if (t0 < 0) return t1;
    return t0;
  }

  private static readonly aux9 = vec3.create();
  private static readonly aux10 = vec3.create();
  private static readonly aux11 = vec3.create();
  private static readonly aux12 = vec3.create();
  intersectTriangle(a: vec3, b: vec3, c: vec3) {
    const { origin, direction } = this;
    const { aux9: edge1, aux10: edge2, aux11: diff, aux12: normal } = Ray;
    vec3.sub(edge1, b, a);
    vec3.sub(edge2, c, a);
    vec3.cross(normal, edge1, edge2);
    const DdN = -vec3.dot(direction, normal);
    if (DdN <= 0) return 0;
    vec3.sub(diff, origin, a);
    const DdQxE2 = -vec3.dot(direction, vec3.cross(edge2, diff, edge2));
    if (DdQxE2 < 0) return 0;
    const DdE1xQ = -vec3.dot(direction, vec3.cross(edge1, edge1, diff));
    if (DdE1xQ < 0 || (DdQxE2 + DdE1xQ) > DdN) return 0;
    const QdN = vec3.dot(diff, normal);
    if (QdN < 0) return 0;
    return QdN / DdN;
  }
}
