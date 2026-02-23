import * as THREE from "three";

export default class VolumetricLight extends THREE.Mesh {
	constructor(options = {}) {
		const {
			color = 0xc5c3e7,
			height = 8,
			radiusBottom = 0.3,
			radiusTop = 2.5,
			segments = 64,
			position = new THREE.Vector3(0, 0, 0),
			opacity = 0.4,
		} = options;

		const geometry = new THREE.CylinderGeometry(
			radiusTop,
			radiusBottom,
			height,
			segments,
			1,
			true,
		);

		// Shift geometry so bottom is at y=0
		geometry.translate(0, height / 2, 0);

		const material = new THREE.ShaderMaterial({
			uniforms: {
				uColor: { value: new THREE.Color(color) },
				uTime: { value: 0 },
				uOpacity: { value: opacity },
				uHeight: { value: height },
			},
			vertexShader: /* glsl */ `
				varying vec3 vPosition;
				varying vec3 vWorldPosition;
				varying vec3 vNormal;

				void main() {
					vPosition = position;
					vNormal = normalize(normalMatrix * normal);
					vec4 worldPos = modelMatrix * vec4(position, 1.0);
					vWorldPosition = worldPos.xyz;
					gl_Position = projectionMatrix * viewMatrix * worldPos;
				}
			`,
			fragmentShader: /* glsl */ `
				uniform vec3 uColor;
				uniform float uTime;
				uniform float uOpacity;
				uniform float uHeight;

				varying vec3 vPosition;
				varying vec3 vWorldPosition;
				varying vec3 vNormal;

				float hash(vec2 p) {
					return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
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
					float v = 0.0;
					float a = 0.5;
					vec2 shift = vec2(100.0);
					mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
					for (int i = 0; i < 5; i++) {
						v += a * noise(p);
						p = rot * p * 2.0 + shift;
						a *= 0.5;
					}
					return v;
				}

				void main() {
					float ny = vPosition.y / uHeight;

					// Height falloff
					float fade = pow(1.0 - ny, 2.0);

					// Edge softness
					vec3 viewDir = normalize(cameraPosition - vWorldPosition);
					float edge = pow(abs(dot(viewDir, vNormal)), 0.4);

					float angle = atan(vPosition.x, vPosition.z);
					vec2 noiseUV = vec2(angle , vPosition.y - uTime * 0.3);
					float n =  pow(fbm(noiseUV * 2.0), 2.0);

					float alpha = fade * uOpacity * n;

					vec3 finalColor = min(uColor * alpha, vec3(0.4));
					gl_FragColor = vec4(finalColor, 1.0);
				}
			`,
			transparent: true,
			blending: THREE.AdditiveBlending,
			side: THREE.DoubleSide,
			depthWrite: false,
			toneMapped: false,
		});

		super(geometry, material);

		this.position.copy(position);
		this.rotation.y = -Math.PI / 2;
	}

	update(elapsed) {
		this.material.uniforms.uTime.value = elapsed;
	}
}
