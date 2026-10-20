fn fresnelSchlickRoughness(cosTheta: f32, f0: vec3f, roughness: f32) -> vec3f {
  return f0 + (max(vec3(1.0 - roughness), f0) - f0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

fn getLight(color: vec3f, metalness: f32, roughness: f32, normal: vec3f, position: vec3f) -> vec3f {
  let n = normalize(normal);
  let v = normalize(camera.position - position);
  let r = reflect(-v, n);
  let f0 = mix(vec3f(0.04), color, metalness);

  let f = fresnelSchlickRoughness(max(dot(n, v), 0.00001), f0, roughness);
  let kS = f;
  var kD = vec3f(1.0) - kS;
  kD *= 1.0 - metalness;

  let irradiance = textureSampleLevel(irradianceTexture, lightingSampler, n, 0).rgb;
  let diffuse = irradiance * color;

  const MAX_REFLECTION_LOD: f32 = 4.0;
  let prefilteredColor = textureSampleLevel(prefilteredTexture, lightingSampler, r, roughness * MAX_REFLECTION_LOD).rgb;
  let brdf = textureSampleLevel(brdfTexture, lightingSampler, vec2f(max(dot(n, v), 0.0), roughness), 0).rg;
  let specular = prefilteredColor * (f * brdf.x + brdf.y);

  return kD * diffuse + specular;
}
