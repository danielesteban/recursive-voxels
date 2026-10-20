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
  var color = vec4f(0.0);
  let off1 = vec2(1.3846153846) * direction;
  let off2 = vec2(3.2307692308) * direction;
  color += textureSample(colorTexture, textureSampler, uv) * 0.2270270270;
  color += textureSample(colorTexture, textureSampler, uv + (off1 / resolution)) * 0.3162162162;
  color += textureSample(colorTexture, textureSampler, uv - (off1 / resolution)) * 0.3162162162;
  color += textureSample(colorTexture, textureSampler, uv + (off2 / resolution)) * 0.0702702703;
  color += textureSample(colorTexture, textureSampler, uv - (off2 / resolution)) * 0.0702702703;
  return color;
}

@fragment
fn frag_main(fragment: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  output.color = getBlur(fragment.uv);
  return output;
}
