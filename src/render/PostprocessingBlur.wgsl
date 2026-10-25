@group(0) @binding(0) var colorTexture: texture_2d<f32>;
@group(0) @binding(1) var textureSampler: sampler;
@group(0) @binding(2) var<uniform> direction: vec2f;
@group(0) @binding(3) var<uniform> resolution: vec2f;

struct FragmentInput {
  @location(0) uv: vec2f,
}

struct FragmentOutput {
  @location(0) color: vec4f,
}

fn getBlur(uv: vec2f) -> vec4f {
  let offset = vec2(2.0 / resolution) * direction;
  var color = vec4f(0.0);
  color += textureSample(colorTexture, textureSampler, uv - offset * 4.0);
  color += textureSample(colorTexture, textureSampler, uv - offset * 3.0);
  color += textureSample(colorTexture, textureSampler, uv - offset * 2.0);
  color += textureSample(colorTexture, textureSampler, uv - offset * 1.0);
  color += textureSample(colorTexture, textureSampler, uv);
  color += textureSample(colorTexture, textureSampler, uv + offset * 1.0);
  color += textureSample(colorTexture, textureSampler, uv + offset * 2.0);
  color += textureSample(colorTexture, textureSampler, uv + offset * 3.0);
  color += textureSample(colorTexture, textureSampler, uv + offset * 4.0);
  return color / 9.0;
}

@fragment
fn frag_main(fragment: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  output.color = getBlur(fragment.uv);
  return output;
}
