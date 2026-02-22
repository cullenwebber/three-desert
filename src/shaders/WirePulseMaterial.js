import * as THREE from "three";

export default class WirePulseMaterial extends THREE.ShaderMaterial {
	constructor(options = {}) {
		const {
			color = 0xc5c3e7,
			baseColor = 0x1a1a2e,
			pulseSpeed = 2.0,
			pulseWidth = 0.3,
			emissiveIntensity = 2.5,
		} = options;

		super({
			uniforms: {
				uColor: { value: new THREE.Color(color) },
				uBaseColor: { value: new THREE.Color(baseColor) },
				uTime: { value: 0 },
				uPulseSpeed: { value: pulseSpeed },
				uPulseWidth: { value: pulseWidth },
				uEmissiveIntensity: { value: emissiveIntensity },
			},
			vertexShader: /* glsl */ `
				varying vec2 vUv;
				varying vec3 vNormal;
				varying vec3 vWorldPosition;

				void main() {
					vUv = uv;
					vNormal = normalize(normalMatrix * normal);
					vec4 worldPos = modelMatrix * vec4(position, 1.0);
					vWorldPosition = worldPos.xyz;
					gl_Position = projectionMatrix * viewMatrix * worldPos;
				}
			`,
			fragmentShader: /* glsl */ `
				uniform vec3 uColor;
				uniform vec3 uBaseColor;
				uniform float uTime;
				uniform float uPulseSpeed;
				uniform float uPulseWidth;
				uniform float uEmissiveIntensity;

				varying vec2 vUv;
				varying vec3 vNormal;
				varying vec3 vWorldPosition;

				void main() {
					// Pulse travels along the wire using UV (length axis)
					float pos = vUv.x;
					float pulse = sin((pos - uTime * uPulseSpeed) * 6.2831 / uPulseWidth);
					pulse = smoothstep(0.3, 1.0, pulse);

					// Second pulse at different speed for variety
					float pulse2 = sin((pos - uTime * uPulseSpeed * 0.6) * 6.2831 / (uPulseWidth * 1.8));
					pulse2 = smoothstep(0.5, 1.0, pulse2) * 0.4;

					float combined = clamp(pulse + pulse2, 0.0, 1.0);

					// Fresnel rim glow
					vec3 viewDir = normalize(cameraPosition - vWorldPosition);
					float fresnel = 1.0 - abs(dot(viewDir, vNormal));
					fresnel = pow(fresnel, 2.0);

					vec3 emissive = uColor * combined * uEmissiveIntensity;
					vec3 rim = uColor * fresnel * 0.5;
					vec3 finalColor = uBaseColor + emissive + rim;

					gl_FragColor = vec4(finalColor, 1.0);
					#include <tonemapping_fragment>
					#include <colorspace_fragment>
				}
			`,
		});
	}

	update(elapsed) {
		this.uniforms.uTime.value = elapsed;
	}
}
