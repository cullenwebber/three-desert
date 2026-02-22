import { Reflector } from "three/addons/objects/Reflector.js";
import * as THREE from "three";
export default class Water extends Reflector {
	constructor(geometry, options = {}) {
		super(geometry, options);

		this.material.uniforms.uTime = { value: 0 };
		this.material.uniforms.uDistortionScale = {
			value: options.distortionScale ?? 0.07,
		};
		this.material.uniforms.uDistortionSpeed = {
			value: options.distortionSpeed ?? 10.0,
		};
		this.material.uniforms.uWashColor = {
			value: options.washColor ?? new THREE.Color(0xc5c3e7),
		};
		this.material.uniforms.uWashStrength = {
			value: options.washStrength ?? 0.1,
		};
		this.material.uniforms.uFoamRadius = {
			value: options.foamRadius ?? 6.7,
		};
		this.material.uniforms.uFoamWidth = {
			value: options.foamWidth ?? 2,
		};
		this.material.uniforms.uFoamColor = {
			value: options.foamColor ?? new THREE.Color(0x4a5d7a),
		};
		this.material.uniforms.uFoamStrength = {
			value: options.foamStrength ?? 0.4,
		};
		this.material.uniforms.uWaveHeight = {
			value: options.waveHeight ?? 0.5,
		};
		this.material.uniforms.uWaveSpeed = {
			value: options.waveSpeed ?? 0.4,
		};

		// Add world position varying to vertex shader
		this.material.vertexShader = this.material.vertexShader.replace(
			"uniform mat4 textureMatrix;",
			/*glsl*/ `uniform mat4 textureMatrix;
			uniform float uTime;
			uniform float uWaveHeight;
			uniform float uWaveSpeed;

			float hash(vec2 p) {
				return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
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
			}`,
		);
		this.material.vertexShader = this.material.vertexShader.replace(
			"varying vec4 vUv;",
			`varying vec4 vUv;
			varying vec3 vWorldPos;`,
		);
		this.material.vertexShader = this.material.vertexShader.replace(
			"vUv = textureMatrix * vec4( position, 1.0 );",
			/*glsl*/ `vec3 displaced = position;
			vec2 wp = (modelMatrix * vec4(position, 1.0)).xz;
			float t = uTime * uWaveSpeed;
			float wave = fbm(wp * 0.2 + t * 0.7) - 0.5;
			displaced.z += wave * uWaveHeight;

			vWorldPos = (modelMatrix * vec4(displaced, 1.0)).xyz;
			vUv = textureMatrix * vec4( displaced, 1.0 );`,
		);
		this.material.vertexShader = this.material.vertexShader.replace(
			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",
			"gl_Position = projectionMatrix * modelViewMatrix * vec4( displaced, 1.0 );",
		);

		// Inject uniforms, FBM, and wash into fragment shader
		this.material.fragmentShader = this.material.fragmentShader.replace(
			"uniform vec3 color;",
			/*glsl*/ `
            uniform vec3 color;
			uniform float uTime;
			uniform float uDistortionScale;
			uniform float uDistortionSpeed;
			uniform vec3 uWashColor;
			uniform float uWashStrength;
			uniform float uFoamRadius;
			uniform float uFoamWidth;
			uniform vec3 uFoamColor;
			uniform float uFoamStrength;
			varying vec3 vWorldPos;

			float hash(vec2 p) {
				return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
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

			float ridgeFbm(vec2 p) {
				float value = 0.0;
				float amplitude = 0.6;
				for (int i = 0; i < 4; i++) {
					float n = noise(p);
					n = 1.0 - abs(n * 2.0 - 1.0);
					n = n * n;
					value += amplitude * n;
					p *= 2.2;
					amplitude *= 0.45;
				}
				return value;
			}`,
		);

		// Distort UVs with FBM and add white wash
		this.material.fragmentShader = this.material.fragmentShader.replace(
			"vec4 base = texture2DProj( tDiffuse, vUv );",
			/*glsl*/ `
            float t = uTime * uDistortionSpeed;
			vec2 wp = vWorldPos.xz;

			float n1 = fbm(wp * 1.5 + vec2(t * 0.07, t * 0.06));
			float n2 = fbm(wp * 1.5 + vec2(-t * 0.05, t * 0.08) + 5.0);

			vec4 distortedUv = vUv;
			distortedUv.x += (n1 - 0.5) * uDistortionScale * distortedUv.w;
			distortedUv.y += (n2 - 0.5) * uDistortionScale * distortedUv.w;

			vec4 base = texture2DProj( tDiffuse, distortedUv );

			float w1 = ridgeFbm(wp * 2.0 + vec2(t * 0.08, t * 0.06));
			float w2 = ridgeFbm(wp * 2.5 + vec2(-t * 0.06, t * 0.09) + 3.0);
			float wash = min(w1, w2);
			wash = smoothstep(0.5, 0.99, wash);
			wash *= wash;
			base.rgb = mix(base.rgb, uWashColor, wash * uWashStrength);

			// Circular foam at shoreline
			float dist = length(wp);
			float foamNoise = fbm(wp * 3.0 + vec2(t * 0.05, -t * 0.04));
			float foamNoise2 = fbm(wp * 5.0 + vec2(-t * 0.03, t * 0.06) + 10.0);
			float noisyRadius = uFoamRadius + (foamNoise - 0.5) * uFoamWidth * 0.8;
			float foam = smoothstep(noisyRadius - uFoamWidth * 0.5, noisyRadius, dist);
			foam *= smoothstep(noisyRadius + uFoamWidth * 0.5, noisyRadius, dist);
			foam *= (0.6 + 0.4 * foamNoise2);
			foam = pow(foam, 0.8);
			base.rgb = mix(base.rgb, uFoamColor, foam * uFoamStrength);`,
		);

		this.material.needsUpdate = true;
	}

	update(elapsed) {
		this.material.uniforms.uTime.value = elapsed;
	}
}
