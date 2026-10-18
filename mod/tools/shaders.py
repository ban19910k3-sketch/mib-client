#!/usr/bin/env python3
# Efekty pełnoekranowe MiB (Color saturation, Motion blur) w formatach kolejnych wersji gry -> mod/fabric/shaders/<rodzina>.
# fabric.gradle dokłada do zasobów tylko katalog rodziny budowanej wersji, więc pliki różnych formatów się nie mieszają.
# Użycie: python3 mod/tools/shaders.py
import json, os, shutil

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'fabric', 'shaders')
SAT = {0: 1.0, 1: 0.0, 2: 0.5, 3: 1.6, 4: 2.3}   # brak, szarość, słabe, mocne, bardzo mocne
BLUR = {0: 0.0, 1: 0.45, 2: 0.65, 3: 0.82}        # brak, słabe, średnie, mocne
# rodzina: (od wersji, motion blur działa)
FAMILIES = {'f1': True, 'f2': True, 'f3': True, 'f4': True, 'f5': True, 'f6': True}
# 1.21.2–1.21.5: efekty gry nie mają celów trwałych między klatkami — poprzednią klatkę trzyma mod (PostChainMixin)
# i podaje ją efektowi jako cel z zewnątrz o tej nazwie
EXTERNAL_PREV = ('f2', 'f3')

MAIN_COLOR = '''
void main() {
    vec3 c = texture(InSampler, texCoord).rgb;
    float l = dot(c, vec3(0.3, 0.59, 0.11));
    fragColor = vec4(mix(vec3(l), c, Saturation), 1.0);
}
'''
MAIN_BLUR = '''
void main() {
    vec3 c = mix(texture(InSampler, texCoord).rgb, texture(PrevSampler, texCoord).rgb, Strength);
    float l = dot(c, vec3(0.3, 0.59, 0.11));
    fragColor = vec4(mix(vec3(l), c, Saturation), 1.0);
}
'''
MAIN_COPY = '''
void main() {
    fragColor = vec4(texture(InSampler, texCoord).rgb, 1.0);
}
'''


def glsl(fam, kind):
    """Shader fragmentu: kind = color | blur | copy."""
    blur = kind == 'blur'
    if fam in ('f5', 'f6'):
        head = '#version 330\n' + ('#extension GL_ARB_separate_shader_objects : require\n' if fam == 'f6' else '')
    else:
        head = '#version 150\n'
    s = head + '\nuniform sampler2D InSampler;\n' + ('uniform sampler2D PrevSampler;\n' if blur else '')
    if kind != 'copy':
        if fam in ('f4', 'f5', 'f6'):
            s += '\nlayout(std140) uniform MibConfig {\n    float Saturation;\n' + ('    float Strength;\n' if blur else '') + '};\n'
        else:
            s += '\nuniform float Saturation;\n' + ('uniform float Strength;\n' if blur else '')
    loc = 'layout(location = 0) ' if fam == 'f6' else ''
    s += '\n' + loc + 'in vec2 texCoord;\n\n' + loc + 'out vec4 fragColor;\n'
    s += {'color': MAIN_COLOR, 'blur': MAIN_BLUR, 'copy': MAIN_COPY}[kind]
    if fam == 'f1':  # stary format: sampler wejścia nazywa się DiffuseSampler
        s = s.replace('InSampler', 'DiffuseSampler')
    return s


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text if isinstance(text, str) else json.dumps(text, indent=2) + '\n')


def old_program(frag, samplers, extra):
    u = [{"name": "ProjMat", "type": "matrix4x4", "count": 16, "values": [1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0]},
         {"name": "InSize", "type": "float", "count": 2, "values": [1.0, 1.0]},
         {"name": "OutSize", "type": "float", "count": 2, "values": [1.0, 1.0]}]
    u += [{"name": n, "type": "float", "count": 1, "values": [v]} for n, v in extra]
    return {"blend": {"func": "add", "srcrgb": "one", "dstrgb": "zero"}, "vertex": "sobel", "fragment": frag, "attributes": ["Position"],
            "samplers": [{"name": s} for s in samplers], "uniforms": u}


def gen(fam):
    base = os.path.join(ROOT, fam, 'assets')
    vertex = 'minecraft:core/screenquad' if fam in ('f5', 'f6') else 'minecraft:post/sobel'
    if fam == 'f1':
        # 1.21–1.21.1: programy w przestrzeni minecraft (gra szuka ich po samej nazwie), łańcuchy w mibclient
        p = os.path.join(base, 'minecraft', 'shaders', 'program')
        write(os.path.join(p, 'mib_color.fsh'), glsl(fam, 'color'))
        write(os.path.join(p, 'mib_blur.fsh'), glsl(fam, 'blur'))
        write(os.path.join(p, 'mib_color.json'), old_program('mib_color', ['DiffuseSampler'], [('Saturation', 1.0)]))
        write(os.path.join(p, 'mib_blur.json'), old_program('mib_blur', ['DiffuseSampler', 'PrevSampler'], [('Saturation', 1.0), ('Strength', 0.5)]))
    elif fam == 'f2':
        p = os.path.join(base, 'mibclient', 'shaders', 'post')
        for k, samplers, vals in (('color', ['InSampler'], [('Saturation', 1.0)]),
                                  ('blur', ['InSampler', 'PrevSampler'], [('Saturation', 1.0), ('Strength', 0.5)])):
            write(os.path.join(p, 'mib_' + k + '.fsh'), glsl(fam, k))
            prog = old_program('mibclient:post/mib_' + k, samplers, vals)
            del prog['blend'], prog['attributes']
            prog['vertex'] = 'minecraft:post/sobel'
            write(os.path.join(p, 'mib_' + k + '.json'), prog)
    else:
        p = os.path.join(base, 'mibclient', 'shaders', 'post')
        for k in ('color', 'blur', 'copy'):
            if k == 'blur' and not FAMILIES[fam]:
                continue
            write(os.path.join(p, 'mib_' + k + '.fsh'), glsl(fam, k))

    def uniforms(vals):
        if fam == 'f1' or fam == 'f2':
            return [{"name": n, "values": [v]} for n, v in vals]
        if fam == 'f3':
            return [{"name": n, "type": "float", "values": [v]} for n, v in vals]
        return {"MibConfig": [{"name": n, "type": "float", "value": v} for n, v in vals]}

    def pass_(frag, inputs, out, vals=None):
        if fam == 'f1':
            d = {"name": frag, "intarget": inputs[0][1], "outtarget": out}
            if len(inputs) > 1:
                d["auxtargets"] = [{"name": "PrevSampler", "id": inputs[1][1]}]
        elif fam == 'f2':
            d = {"program": frag, "inputs": [{"sampler_name": n, "target": t} for n, t in inputs], "output": out}
        else:
            d = {"vertex_shader": vertex, "fragment_shader": frag, "inputs": [{"sampler_name": n, "target": t} for n, t in inputs], "output": out}
        if vals:
            d["uniforms"] = uniforms(vals)
        return d

    copy = 'blit' if fam == 'f1' else 'minecraft:post/blit' if fam == 'f2' else 'mibclient:post/mib_copy'
    color = 'mib_color' if fam == 'f1' else 'mibclient:post/mib_color'
    blur = 'mib_blur' if fam == 'f1' else 'mibclient:post/mib_blur'
    for s in SAT:
        for b in BLUR:
            if (s == 0 and b == 0) or (b and not FAMILIES[fam]):
                continue
            if b == 0:
                passes = [pass_(color, [("In", "minecraft:main")], "swap", [("Saturation", SAT[s])]),
                          pass_(copy, [("In", "swap")], "minecraft:main")]
                targets = ["swap"] if fam == 'f1' else {"swap": {}}
            else:
                prev = 'mibclient:previous' if fam in EXTERNAL_PREV else 'previous'
                passes = [pass_(blur, [("In", "minecraft:main"), ("Prev", prev)], "swap", [("Saturation", SAT[s]), ("Strength", BLUR[b])]),
                          pass_(copy, [("In", "swap")], prev),
                          pass_(copy, [("In", "swap")], "minecraft:main")]
                if fam == 'f1':
                    targets = ["swap", "previous"]
                elif fam in EXTERNAL_PREV:
                    targets = {"swap": {}}
                else:
                    targets = {"swap": {}, "previous": {"persistent": True}}
            chain = {"targets": targets, "passes": passes}
            name = 'mib_s%d_b%d.json' % (s, b)
            if fam == 'f1':
                write(os.path.join(base, 'mibclient', 'shaders', 'post', name), chain)
            else:
                write(os.path.join(base, 'mibclient', 'post_effect', name), chain)


if __name__ == '__main__':
    if os.path.isdir(ROOT):
        shutil.rmtree(ROOT)
    for fam in FAMILIES:
        gen(fam)
    print('ok')
