@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<uniform> transform: Transform;
@group(1) @binding(0) var paletteTexture: texture_2d_array<f32>;
@group(1) @binding(1) var textureSampler: sampler;
@group(1) @binding(2) var brdfTexture: texture_2d<f32>;
@group(1) @binding(3) var irradianceTexture: texture_cube<f32>;
@group(1) @binding(4) var prefilteredTexture: texture_cube<f32>;
@group(1) @binding(5) var lightingSampler: sampler;

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) normal: vec3f,
  @location(2) worldPos: vec3f,
}

struct FragmentInput {
  @location(0) uv: vec2f,
  @location(1) normal: vec3f,
  @location(2) worldPos: vec3f,
}

struct FragmentOutput {
  @location(0) color: vec4f,
  @location(1) data: vec4f,
}

@vertex
fn vert_main(vertex: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.worldPos = (transform.matrix * vec4f(vertex.position, 1.0)).xyz;
  output.position = camera.projection * camera.view * vec4f(output.worldPos, 1.0);
  output.normal = transform.normal * vertex.normal;
  output.uv = vertex.uv;
  return output;
}

@fragment
fn frag_main(fragment: FragmentInput) -> FragmentOutput {
  let normal = normalize(fragment.normal);
  let light = getLight(
    textureSample(paletteTexture, textureSampler, fragment.uv, u32(floor((1.0 - fragment.uv.y) * 8.0) * 8.0 + floor(fragment.uv.x * 8.0))).rgb,
    0.5,
    0.02,
    normal,
    fragment.worldPos
  );
  let depth = distance(camera.position, fragment.worldPos);
  let alpha = 1.0 - clamp(depth / 512.0, 0.0, 1.0);
  var output: FragmentOutput;
  output.color = vec4f(light * alpha, alpha);
  output.data = vec4f(normal, depth);
  return output;
}
