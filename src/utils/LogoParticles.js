import * as THREE from "three";
import { MeshSurfaceSampler } from "three/addons/math/MeshSurfaceSampler.js";
import { GPUComputationRenderer } from "three/addons/misc/GPUComputationRenderer.js";

const simplexNoise4d = /*glsl*/ `
// Simplex 4D noise (Stefan Gustavson)
vec4 mod289(vec4 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
float mod289(float x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x){ return mod289(((x*34.0)+10.0)*x); }
float permute(float x){ return mod289(((x*34.0)+10.0)*x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
float taylorInvSqrt(float r){ return 1.79284291400159 - 0.85373472095314 * r; }

vec4 grad4(float j, vec4 ip){
  const vec4 ones = vec4(1.0,1.0,1.0,-1.0);
  vec4 p,s;
  p.xyz = floor(fract(vec3(j)*ip.xyz)*7.0)*ip.z - 1.0;
  p.w = 1.5 - dot(abs(p.xyz), ones.xyz);
  s = vec4(lessThan(p, vec4(0.0)));
  p.xyz = p.xyz + (s.xyz*2.0 - 1.0) * s.www;
  return p;
}

#define F4 0.309016994374947451

float simplexNoise4d(vec4 v){
  const vec4 C = vec4(
    0.138196601125011,
    0.276393202250021,
    0.414589803375032,
   -0.447213595499958
  );
  vec4 i = floor(v + dot(v, vec4(F4)));
  vec4 x0 = v - i + dot(i, C.xxxx);
  vec4 i0;
  vec3 isX = step(x0.yzw, x0.xxx);
  vec3 isYZ = step(x0.zww, x0.yyz);
  i0.x = isX.x + isX.y + isX.z;
  i0.yzw = 1.0 - isX;
  i0.y += isYZ.x + isYZ.y;
  i0.zw += 1.0 - isYZ.xy;
  i0.z += isYZ.z;
  i0.w += 1.0 - isYZ.z;
  vec4 i3 = clamp(i0, 0.0, 1.0);
  vec4 i2 = clamp(i0 - 1.0, 0.0, 1.0);
  vec4 i1 = clamp(i0 - 2.0, 0.0, 1.0);
  vec4 x1 = x0 - i1 + C.xxxx;
  vec4 x2 = x0 - i2 + C.yyyy;
  vec4 x3 = x0 - i3 + C.zzzz;
  vec4 x4 = x0 + C.wwww;
  i = mod289(i);
  float j0 = permute(permute(permute(permute(i.w)+i.z)+i.y)+i.x);
  vec4 j1 = permute(permute(permute(permute(
    i.w + vec4(i1.w,i2.w,i3.w,1.0))
    + i.z + vec4(i1.z,i2.z,i3.z,1.0))
    + i.y + vec4(i1.y,i2.y,i3.y,1.0))
    + i.x + vec4(i1.x,i2.x,i3.x,1.0));
  vec4 ip = vec4(1.0/294.0, 1.0/49.0, 1.0/7.0, 0.0);
  vec4 p0 = grad4(j0, ip);
  vec4 p1 = grad4(j1.x, ip);
  vec4 p2 = grad4(j1.y, ip);
  vec4 p3 = grad4(j1.z, ip);
  vec4 p4 = grad4(j1.w, ip);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  p4 *= taylorInvSqrt(dot(p4,p4));
  vec3 m0 = max(0.6 - vec3(dot(x0,x0),dot(x1,x1),dot(x2,x2)), 0.0);
  vec2 m1 = max(0.6 - vec2(dot(x3,x3),dot(x4,x4)), 0.0);
  m0 = m0*m0; m1 = m1*m1;
  return 49.0 * (
    dot(m0*m0, vec3(dot(p0,x0),dot(p1,x1),dot(p2,x2)))
    + dot(m1*m1, vec2(dot(p3,x3),dot(p4,x4)))
  );
}
`;

const simulationShader = /*glsl*/ `
uniform float uTime;
uniform float uDeltaTime;
uniform sampler2D uBase;
uniform float uFlowFieldInfluence;
uniform float uFlowFieldStrength;
uniform float uFlowFieldFrequency;

${simplexNoise4d}

void main() {
  float time = uTime;
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 particle = texture2D(uParticles, uv);
  vec4 base = texture2D(uBase, uv);

  // Dead — respawn at base position
  if (particle.a >= 1.0) {
    particle.a = mod(particle.a, 1.0);
    particle.xyz = base.xyz;
  }
  // Alive — flow field
  else {
    float strength = simplexNoise4d(vec4(base.xyz * 2.0, time + 1.0));
    float influence = (uFlowFieldInfluence - 0.5) * (-2.0);
    strength = smoothstep(influence, 1.0, strength);

    vec3 flowField = vec3(
      simplexNoise4d(vec4(particle.xyz * uFlowFieldFrequency + 0.0, time)),
      simplexNoise4d(vec4(particle.xyz * uFlowFieldFrequency + 1.0, time)),
      simplexNoise4d(vec4(particle.xyz * uFlowFieldFrequency + 2.0, time))
    );
    flowField = normalize(flowField);
    particle.xyz += flowField * uDeltaTime * strength * uFlowFieldStrength;

    // Decay
    particle.a += uDeltaTime * 0.7;
  }

  gl_FragColor = particle;
}
`;

const renderVertex = /*glsl*/ `
uniform vec2 uResolution;
uniform float uSize;
uniform sampler2D uParticlesTexture;

attribute vec2 aParticlesUv;
attribute vec3 aColor;
attribute float aSize;

varying vec3 vColor;
varying float vFogDepth;

void main() {
  vec4 particle = texture2D(uParticlesTexture, aParticlesUv);

  vec4 modelPosition = modelMatrix * vec4(particle.xyz, 1.0);
  vec4 viewPosition = viewMatrix * modelPosition;
  vec4 projectedPosition = projectionMatrix * viewPosition;
  gl_Position = projectedPosition;

  // Size in/out based on lifetime
  float sizeIn = smoothstep(0.0, 0.6, particle.a);
  float sizeOut = 1.0 - smoothstep(0.6, 1.0, particle.a);
  float size = min(sizeIn, sizeOut);

  gl_PointSize = size * aSize * uSize * uResolution.y;
  gl_PointSize *= (1.0 / -viewPosition.z);

  vColor = aColor;
  vFogDepth = -viewPosition.z;
}
`;

const renderFragment = /*glsl*/ `
varying vec3 vColor;

void main() {
  vec2 coord = gl_PointCoord * 2.0 - 1.0;
  if (dot(coord, coord) > 1.0) discard;
  gl_FragColor = vec4(vColor, 1.0);
}
`;

export default class LogoParticles {
	constructor(mesh, options = {}) {
		const count = options.count || 10000;
		const color = options.color || 0xd6e4f7;
		const renderer = options.renderer;

		// GPGPU texture size
		const size = Math.ceil(Math.sqrt(count));
		this.gpuSize = size;

		const cylinderRatio = options.cylinderRatio || 0.1;
		const cylinderRadiusBottom = options.cylinderRadiusBottom || 0.8;
		const cylinderRadiusTop = options.cylinderRadiusTop || 1.0;
		const cylinderHeight = options.cylinderHeight || 0.4;

		// Top cylinder (mirrored above logo)
		const topCylinderRatio = options.topCylinderRatio || 0.1;
		const topCylinderRadiusBottom = options.topCylinderRadiusBottom || 1.0;
		const topCylinderRadiusTop = options.topCylinderRadiusTop || 0.8;
		const topCylinderHeight = options.topCylinderHeight || 0.4;

		const sampler = new MeshSurfaceSampler(mesh).build();
		const tempPosition = new THREE.Vector3();

		// Compute logo mesh bounding box center for cylinder placement
		mesh.geometry.computeBoundingBox();
		const bbox = mesh.geometry.boundingBox;
		const centerY = (bbox.min.y + bbox.max.y) * 0.5 - 2.15;

		this.gpuCompute = new GPUComputationRenderer(size, size, renderer);

		const baseTexture = this.gpuCompute.createTexture();
		const baseData = baseTexture.image.data;

		const totalPixels = size * size;
		const bottomCylCount = Math.floor(totalPixels * cylinderRatio);
		const topCylCount = Math.floor(totalPixels * topCylinderRatio);
		const logoCount = totalPixels - bottomCylCount - topCylCount;

		// Top cylinder is mirrored above — offset from centerY
		const topCenterY = -centerY + (bbox.min.y + bbox.max.y) * 0.5 * 2 - centerY;
		const topY = centerY + cylinderHeight + topCylinderHeight + 3.45;

		for (let i = 0; i < totalPixels; i++) {
			if (i < logoCount) {
				// Logo surface particles
				sampler.sample(tempPosition);
				baseData[i * 4 + 0] = tempPosition.x;
				baseData[i * 4 + 1] = tempPosition.y;
				baseData[i * 4 + 2] = tempPosition.z;
			} else if (i < logoCount + bottomCylCount) {
				// Bottom tapered cylinder
				const theta = Math.random() * Math.PI * 2;
				const t = Math.random();
				const y = (t - 0.5) * cylinderHeight + centerY;
				const radius =
					cylinderRadiusBottom + t * (cylinderRadiusTop - cylinderRadiusBottom);
				baseData[i * 4 + 0] = Math.cos(theta) * radius;
				baseData[i * 4 + 1] = y;
				baseData[i * 4 + 2] = Math.sin(theta) * radius;
			} else {
				// Top tapered cylinder (mirrored above logo)
				const theta = Math.random() * Math.PI * 2;
				const t = Math.random();
				const y = (t - 0.5) * topCylinderHeight + topY;
				const radius =
					topCylinderRadiusBottom +
					t * (topCylinderRadiusTop - topCylinderRadiusBottom);
				baseData[i * 4 + 0] = Math.cos(theta) * radius;
				baseData[i * 4 + 1] = y;
				baseData[i * 4 + 2] = Math.sin(theta) * radius;
			}
			baseData[i * 4 + 3] = Math.random();
		}

		this.particlesVariable = this.gpuCompute.addVariable(
			"uParticles",
			simulationShader,
			baseTexture,
		);

		this.gpuCompute.setVariableDependencies(this.particlesVariable, [
			this.particlesVariable,
		]);

		const simUniforms = this.particlesVariable.material.uniforms;
		simUniforms.uTime = { value: 0 };
		simUniforms.uDeltaTime = { value: 0 };
		simUniforms.uBase = { value: baseTexture };
		simUniforms.uFlowFieldInfluence = { value: 0.5 };
		simUniforms.uFlowFieldStrength = { value: 0.6 };
		simUniforms.uFlowFieldFrequency = { value: 1.5 };

		this.gpuCompute.init();

		// --- Render geometry ---
		const particlesUvs = new Float32Array(size * size * 2);
		const sizes = new Float32Array(size * size);
		const colors = new Float32Array(size * size * 3);
		const baseColor = new THREE.Color(color);

		for (let y = 0; y < size; y++) {
			for (let x = 0; x < size; x++) {
				const i = y * size + x;
				particlesUvs[i * 2 + 0] = (x + 0.5) / size;
				particlesUvs[i * 2 + 1] = (y + 0.5) / size;
				sizes[i] = 0.5 + Math.random() * 0.5;

				// Slight color variation
				const hsl = {};
				baseColor.getHSL(hsl);
				const c = new THREE.Color().setHSL(
					hsl.h + (Math.random() - 0.5) * 0.05,
					hsl.s,
					hsl.l + (Math.random() - 0.5) * 0.1,
				);
				colors[i * 3 + 0] = c.r;
				colors[i * 3 + 1] = c.g;
				colors[i * 3 + 2] = c.b;
			}
		}

		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute(
			"aParticlesUv",
			new THREE.BufferAttribute(particlesUvs, 2),
		);
		geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
		geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
		// Dummy position attribute
		geometry.setAttribute(
			"position",
			new THREE.BufferAttribute(new Float32Array(size * size * 3), 3),
		);

		const material = new THREE.ShaderMaterial({
			vertexShader: renderVertex,
			fragmentShader: renderFragment,
			uniforms: {
				uResolution: {
					value: new THREE.Vector2(
						window.innerWidth * window.devicePixelRatio,
						window.innerHeight * window.devicePixelRatio,
					),
				},
				uSize: { value: 0.05 },
				uParticlesTexture: { value: null },
			},
			transparent: false,
			depthWrite: true,
		});

		this.points = new THREE.Points(geometry, material);
		this.points.frustumCulled = false;

		// Copy transform from original mesh
		this.points.position.copy(mesh.position);
		this.points.scale.copy(mesh.scale).multiplyScalar(1.25);
		this.points.quaternion.copy(mesh.quaternion);
	}

	update(delta, elapsed) {
		const period = 8.0;
		const raw = Math.sin((elapsed * (Math.PI * 2.0)) / period);
		const burst = Math.pow(Math.max(0, raw), 8);
		const multiplier = 1.0 + burst * 2.0;

		// Update GPGPU simulation
		const simUniforms = this.particlesVariable.material.uniforms;
		simUniforms.uTime.value = elapsed;
		simUniforms.uDeltaTime.value = delta * multiplier;
		simUniforms.uFlowFieldInfluence.value = 0.65 + burst * 0.5;
		this.gpuCompute.compute();

		// Pass computed texture to render material
		this.points.material.uniforms.uParticlesTexture.value =
			this.gpuCompute.getCurrentRenderTarget(this.particlesVariable).texture;

		this.points.rotation.y += delta * (1.0 + burst * 4.0);
		this.points.position.y = Math.sin(elapsed * 1.5) * 0.1 + 2.8;
	}
}
