const glsl = x => x[0].trim();

const backgroundShader = {};
const landscapeShader = {};

backgroundShader.vert = glsl`
varying vec2 vUv;
void main()	{
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`;

backgroundShader.frag = glsl`
uniform float time;
uniform vec2 resolution;
varying vec2 vUv;

// cosine based palette, 4 vec3 params
vec3 palette( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d )
{
  return a + b * cos(6.28318 * (c * t + d));
}

vec3 pal1(in float t) {
  vec3 a = vec3(0.5, 0.5, 0.5);
  vec3 b = vec3(0.5, 0.5, 0.5);
  vec3 c = vec3(1.0, 1.0, 1.0);
  vec3 d = vec3(0.3, 0.2, 0.2);
  return palette(t, a, b, c, d);
}

vec3 pal2(in float t) {
  vec3 a = vec3(0.8, 0.5, 0.4);
  vec3 b = vec3(0.5, 0.5, 0.5);
  vec3 c = vec3(2.0, 1.0, 1.0);
  vec3 d = vec3(0.00, 0.25, 0.5);
  return palette(t, a, b, c, d);
}


// 2D Random
float random (in vec2 st) {
    return fract(sin(dot(st.xy,
                         vec2(12.9898,78.233)))
                 * 43758.5453123);
}

// 2D Noise based on Morgan McGuire @morgan3d
// https://www.shadertoy.com/view/4dS3Wd
float noise (in vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);

    // Four corners in 2D of a tile
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));

    // Smooth Interpolation

    // Cubic Hermine Curve.  Same as SmoothStep()
    vec2 u = f*f*(3.0-2.0*f);
    // u = smoothstep(0.,1.,f);

    // Mix 4 coorners percentages
    return mix(a, b, u.x) +
            (c - a)* u.y * (1.0 - u.x) +
            (d - b) * u.x * u.y;
}

void main() {
  // that shader is applied to a quadratic plane geometry
  // so we don't need to take care of aspect ratio
  // float aspect = resolution.x / resolution.y;
  vec2 p = (vUv * 1. - vec2(.5, .51)) * 8.; // * vec2(aspect, 1.);
  float l = length(p);
  float a = atan(p.y, p.x);
  vec2 p1 = vec2(cos(a) * l, sin(a) * l);
  float mt = time * .1;
  float v = mt + (noise(p1) + sin(mt + a * 5. + l * 3.) + cos(mt + a * 3. + l * 3.)) * l;
  float v1 = 5. * (a + 0.1 * sin(mt * 7. + p.x * 11. + p.y * 13.));
  vec3 color = mix(pal1(v), pal2(1. + v), clamp(3. * cos(v1 + time) * sin(v1 + time), 0., 1.));
  float lightness = clamp(.4 + gl_FragCoord.y / resolution.y, 0., 1.);
  gl_FragColor = vec4(color * lightness, 1.);
}
`;

landscapeShader.vert = glsl`
varying vec2 vUv;
varying vec3 vPos;
uniform float time;
void main()	{
  vUv = uv;
  vPos = position;
  float s = sin(position.x + time * .4);
  float c = cos(position.y + time * .8);
  vec3 p = position + vec3(0, 0, s * c * .5);
  gl_Position = projectionMatrix * modelViewMatrix * vec4( p, 1.0 );
}
`;

landscapeShader.frag = glsl`
uniform float time;
varying vec2 vUv;
varying vec3 vPos;
void main() {
  float u = .7 * sin(vUv.x * 40.) * cos(vUv.y * 20. + time * 2.);
  float v = .6 + .4 * clamp(2. * u * u, 0., 1.);
  float z = 1. - clamp(vPos.y * .1, 0., 1.);
  gl_FragColor = vec4(vec3(.1 * v,.4 * v,v) * z, 1.); 
}
`;




const container = document.querySelector('#container');

let camera, scene, renderer, uniforms, clock, frame;

const dispose = init();

function init() {
  renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);
  clock = new THREE.Clock();
  // camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
  camera.position.z = 5;
  scene = new THREE.Scene();

  const geometry = new THREE.PlaneBufferGeometry(240, 240);

  const landscapeGeometry = new THREE.PlaneBufferGeometry(64, 16, 160, 40);

  
  uniforms = {
    time: { type: 'f', value: 1.0 },
    resolution: { type: 'v2', value: new THREE.Vector2() },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: backgroundShader.vert,
    fragmentShader: backgroundShader.frag,
  });
  const landscapeMaterial = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: landscapeShader.vert,
    fragmentShader: landscapeShader.frag,
  });
  
  
  
  const landscapeMesh = new THREE.Mesh(landscapeGeometry, landscapeMaterial);
  
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0,-1,-10);
  landscapeMesh.position.y = -2;
  landscapeMesh.rotation.x = -33;
  scene.add(landscapeMesh);
  scene.add(mesh);
  
  onResize();
  window.addEventListener('resize', onResize, false);
  frame = requestAnimationFrame(animate);
  
  // tis just a reminder for you to always clean up all the 
  // things after use.
  // It's not needed in this pen but useful as soon there is the need to
  // unmount/remount this component
  const cleanup = function () {
    cancelAnimationFrame(frame);
    geometry.dispose();
    material.dispose();
    landscapeGeometry.dispose();
    landscapeMaterial.dispose();
    scene.remove(mesh);
    scene.dispose();
    renderer.dispose();
    window.removeEventListener('resize', onResize, false);
  }
  return cleanup;
}

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  const canvas = renderer.domElement;
  camera.aspect = canvas.clientWidth / canvas.clientHeight;
  camera.updateProjectionMatrix();
  uniforms.resolution.value.x = renderer.domElement.width;
  uniforms.resolution.value.y = renderer.domElement.height;
}

function animate(timestamp) {
  frame = requestAnimationFrame(animate);
  uniforms.time.value = clock.getElapsedTime();
  renderer.render(scene, camera);
}