#version 150

uniform sampler2D InSampler;
uniform sampler2D PrevSampler;

uniform float Saturation;
uniform float Strength;

in vec2 texCoord;

out vec4 fragColor;

void main() {
    vec3 c = mix(texture(InSampler, texCoord).rgb, texture(PrevSampler, texCoord).rgb, Strength);
    float l = dot(c, vec3(0.3, 0.59, 0.11));
    fragColor = vec4(mix(vec3(l), c, Saturation), 1.0);
}
