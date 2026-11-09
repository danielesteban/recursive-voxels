@group(0) @binding(0) var colorTexture: texture_2d<f32>;
@group(0) @binding(1) var textureSampler: sampler;
@group(0) @binding(2) var<uniform> resolution: vec2f;

struct FragmentInput {
  @location(0) uv: vec2f,
}

struct FragmentOutput {
  @location(0) color: vec4f,
}

fn linearToSrgb(value: f32) -> f32 {
  if (value <= 0.0031308) {
    return value * 12.92;
  }
  return 1.055 * pow(value, 1.0 / 2.4) - 0.055;
}

fn linearToSrgb3(value: vec3f) -> vec3f {
  return vec3f(linearToSrgb(value.r), linearToSrgb(value.g), linearToSrgb(value.b));
}

fn tonemapACES(color: vec3f) -> vec3f {
  let x = max(color, vec3f(0.0));
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), vec3f(0.0), vec3f(1.0));
}

@fragment
fn frag_main(fragment: FragmentInput) -> FragmentOutput {
  var uv = fragment.uv - 0.5;
  let d = length(uv * 0.5 * uv * 0.5);
  uv = (uv * d + uv * 0.935) + 0.5;

  var color = linearToSrgb3(tonemapACES(textureSample(colorTexture, textureSampler, uv).rgb));

  let s = 1.0 - smoothstep(320.0, 1440.0, resolution.y) + 1.0;
  let j = cos(uv.y*resolution.y*s) * 0.1;
  color = color - color * j;
  color *= 1.0 - (0.01 + ceil((uv.x*resolution.x) % 3.0) * (0.995-1.01));

  var m = max(0.0, 1.0 - 2.0 * max(abs(uv.x - 0.5), abs(uv.y - 0.5)));
  m = min(m*200.0, 1.0);
  color *= m;

  var output: FragmentOutput;
  output.color = vec4f(color, 1.0);
  return output;
}
