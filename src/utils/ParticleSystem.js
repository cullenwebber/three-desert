import * as THREE from "three";

export default class ParticleSystem {
	constructor(options = {}) {
		const particleCount = options.particleCount || 50;
		const color = options.color || 0xffffff;
		const positions = new Float32Array(particleCount * 3);
		const sizes = new Float32Array(particleCount);
		const randoms = new Float32Array(particleCount);

		// Distribute particles in a cylindrical pattern
		for (let i = 0; i < particleCount; i++) {
			const radius = 4 + Math.random() * 6;
			const theta = Math.random() * Math.PI * 2;
			const y = (Math.random() - 0.5) * 6 + 4;

			positions[i * 3] = Math.cos(theta) * radius;
			positions[i * 3 + 1] = y;
			positions[i * 3 + 2] = Math.sin(theta) * radius;

			sizes[i] = 0.1 + Math.random() * 0.4;
			randoms[i] = Math.random();
		}

		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
		geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
		geometry.setAttribute("random", new THREE.BufferAttribute(randoms, 1));

		const material = new THREE.ShaderMaterial({
			uniforms: {
				color: { value: new THREE.Color(color) },
				time: { value: 0 },
				uOpacity: { value: 1.0 },
			},
			vertexShader: /*glsl*/ `
				attribute float size;
				attribute float random;
				uniform float time;
				varying float vAlphaFlicker;
				void main() {
					float phase = random * 6.2831;
					vec3 pos = position;
					pos.y += sin(time * 0.5 + phase) * 0.5;
					pos.x += cos(time * 0.3 + phase) * 0.5;
					pos.z += sin(time * 0.4 + phase * 1.3) * 0.9;
					vAlphaFlicker = 0.5 + 0.5 * sin(time * 1.5 + phase * 2.0);
					vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
					gl_PointSize = size * (300.0 / -mvPosition.z);
					gl_Position = projectionMatrix * mvPosition;
				}
			`,
			fragmentShader: /*glsl*/ `
				uniform vec3 color;
				uniform float uOpacity;
				varying float vAlphaFlicker;
				void main() {
					vec2 center = gl_PointCoord - 0.5;
					float dist = length(center);
					if (dist > 0.5) discard;
					float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
					gl_FragColor = vec4(color, alpha * uOpacity * vAlphaFlicker);
				}
			`,
			transparent: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
		});

		this.points = new THREE.Points(geometry, material);
		this.points.position.set(options.x || 0, options.y || 0.25, options.z || 0);
	}

	update(time) {
		this.points.material.uniforms.time.value = time;
		this.points.rotation.y += 0.001;
	}

	dispose() {
		this.points.geometry.dispose();
		this.points.material.dispose();
	}
}
