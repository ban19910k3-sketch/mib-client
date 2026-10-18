#version 330
#extension GL_ARB_separate_shader_objects : require

uniform sampler2D InSampler;

layout(std140) uniform MibConfig {
    float Saturation;
};

layout(location = 0) in vec2 texCoord;

layout(location = 0) out vec4 fragColor;

void main() {
    vec3 c = texture(InSampler, texCoord).rgb;
    float l = dot(c, vec3(0.3, 0.59, 0.11));
    fragColor = vec4(mix(vec3(l), c, Saturation), 1.0);
}
