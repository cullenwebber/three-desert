import * as THREE from "three";

export default class DustParticles {
	constructor(options = {}) {
		const count = options.count || 30;
		const color = options.color || 0x4a5d7a;
		const spread = options.spread || 20;

		const positions = new Float32Array(count * 3);
		const sizes = new Float32Array(count);
		const randoms = new Float32Array(count);
		const offsets = new Float32Array(count);

		for (let i = 0; i < count; i++) {
			positions[i * 3] = (Math.random() - 0.5) * spread;
			positions[i * 3 + 1] = Math.random() * 0.5;
			positions[i * 3 + 2] = (Math.random() - 0.5) * spread;

			sizes[i] = 30.0 + Math.random() * 40.0;
			randoms[i] = Math.random();
			offsets[i] = Math.random() * 200.0;
		}

		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
		geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
		geometry.setAttribute("aRandom", new THREE.BufferAttribute(randoms, 1));
		geometry.setAttribute("aOffset", new THREE.BufferAttribute(offsets, 1));

		const material = new THREE.ShaderMaterial({
			uniforms: {
				uColor: { value: new THREE.Color(color) },
				uTime: { value: 0 },
				uWindDirection: { value: new THREE.Vector2(1.0, 0.3) },
				uWindSpeed: { value: options.windSpeed || 1.5 },
				uSpread: { value: spread },
			},
			vertexShader: /*glsl*/ `
				attribute float aSize;
				attribute float aRandom;
				attribute float aOffset;

				uniform float uTime;
				uniform vec2 uWindDirection;
				uniform float uWindSpeed;
				uniform float uSpread;

				varying float vAlpha;
				varying float vRandom;

				float hash(vec2 p) {
					vec3 p3 = fract(vec3(p.xyx) * 0.1031);
					p3 += dot(p3, p3.yzx + 33.33);
					return fract((p3.x + p3.y) * p3.z);
				}

				float noise(vec2 p) {
					vec2 i = floor(p);
					vec2 f = fract(p);
					f = f * f * (3.0 - 2.0 * f);
					float a = hash(i);
					float b = hash(i + vec2(1.0, 0.0));
					float c = hash(i + vec2(0.0, 1.0));
					float d = hash(i + vec2(1.0, 1.0));
					return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
				}

				float fbm(vec2 p) {
					float value = 0.0;
					float amplitude = 0.5;
					for (int i = 0; i < 4; i++) {
						value += amplitude * noise(p);
						p *= 2.0;
						amplitude *= 0.5;
					}
					return value;
				}

				void main() {
					float t = uTime * uWindSpeed + aOffset;
					vec2 windDir = normalize(uWindDirection);

					vec3 pos = position;

					// Wind drift
					pos.x += windDir.x * t * 0.8;
					pos.z += windDir.y * t * 0.8;

					// Wrap and compute normalized progress along wind axis
					float halfSpread = uSpread * 0.5;
					float wrappedX = mod(pos.x + halfSpread, uSpread);
					float wrappedZ = mod(pos.z + halfSpread, uSpread);
					pos.x = wrappedX - halfSpread;
					pos.z = wrappedZ - halfSpread;

					// Fade in at upwind edge, fade out at downwind edge
					float progressX = wrappedX / uSpread;
					float progressZ = wrappedZ / uSpread;
					float edgeFadeX = smoothstep(0.0, 0.2, progressX) * (1.0 - smoothstep(0.8, 1.0, progressX));
					float edgeFadeZ = smoothstep(0.0, 0.2, progressZ) * (1.0 - smoothstep(0.8, 1.0, progressZ));
					float edgeFade = edgeFadeX * edgeFadeZ;

					// Gentle sway via FBM
					vec2 fbmIn = pos.xz * 0.1 + uTime * 0.15;
					pos.x += (fbm(fbmIn + vec2(0.0, 77.0)) - 0.5) * 2.0;
					pos.z += (fbm(fbmIn + vec2(77.0, 0.0)) - 0.5) * 2.0;
					pos.y += fbm(pos.xz * 0.08 + uTime * 0.2) * 0.6;

					// Fade with height
					float heightFade = 1.0 - smoothstep(0.0, 1.5, pos.y);
					vAlpha = heightFade * (0.3 + 0.2 * fbm(vec2(aRandom * 100.0, uTime * 0.5))) * edgeFade;
					vRandom = aRandom;

					vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
					gl_PointSize = aSize * (300.0 / -mvPosition.z);
					gl_Position = projectionMatrix * mvPosition;
				}
			`,
			fragmentShader: /*glsl*/ `
				uniform vec3 uColor;
				uniform float uTime;
				varying float vAlpha;
				varying float vRandom;

				float hash(vec2 p) {
					vec3 p3 = fract(vec3(p.xyx) * 0.1031);
					p3 += dot(p3, p3.yzx + 33.33);
					return fract((p3.x + p3.y) * p3.z);
				}

				float noise(vec2 p) {
					vec2 i = floor(p);
					vec2 f = fract(p);
					f = f * f * (3.0 - 2.0 * f);
					float a = hash(i);
					float b = hash(i + vec2(1.0, 0.0));
					float c = hash(i + vec2(0.0, 1.0));
					float d = hash(i + vec2(1.0, 1.0));
					return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
				}

				float fbm(vec2 p) {
					float value = 0.0;
					float amplitude = 0.5;
					for (int i = 0; i < 5; i++) {
						value += amplitude * noise(p);
						p *= 2.0;
						amplitude *= 0.5;
					}
					return value;
				}

				void main() {
					vec2 uv = gl_PointCoord;
					vec2 center = uv - 0.5;
					float dist = length(center);

					// Radial falloff
					float radial = 1.0 - smoothstep(0.0, 0.5, dist);

					// FBM wisp shape — unique per sprite via vRandom offset
					vec2 seed = uv * 3.0 + vRandom * 50.0;
					float dustShape = fbm(seed + uTime * 0.1);

					// Warp the FBM with itself for more organic look
					dustShape = fbm(seed + dustShape * 0.5 + uTime * 0.08);

					// Threshold to create wispy edges
					float wisp = smoothstep(0.2, 0.99, dustShape);

					float alpha = radial * wisp * vAlpha;
					if (alpha < 0.01) discard;

					gl_FragColor = vec4(uColor, alpha);
				}
			`,
			transparent: true,
			depthWrite: false,
			depthTest: false,
			blending: THREE.AdditiveBlending,
		});

		this.points = new THREE.Points(geometry, material);
	}

	update(elapsed) {
		this.points.material.uniforms.uTime.value = elapsed;
	}

	dispose() {
		this.points.geometry.dispose();
		this.points.material.dispose();
	}
}
