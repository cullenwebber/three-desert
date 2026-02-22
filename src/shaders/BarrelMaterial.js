import * as THREE from "three";

export default class BarrelMaterial extends THREE.ShaderMaterial {
	constructor(options = {}) {
		const {
			color = 0x4a5d7a,
			fresnelColor = 0xc5c3e7,
			fresnelPower = 3.0,
			fresnelIntensity = 0.8,
		} = options;

		super({
			uniforms: {
				uColor: { value: new THREE.Color(color) },
				uFresnelColor: { value: new THREE.Color(fresnelColor) },
				uFresnelPower: { value: fresnelPower },
				uFresnelIntensity: { value: fresnelIntensity },
			},
			vertexShader: /* glsl */ `
				varying vec3 vNormal;
				varying vec3 vWorldPosition;
				varying vec2 vUv;

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
				uniform vec3 uFresnelColor;
				uniform float uFresnelPower;
				uniform float uFresnelIntensity;
				

				varying vec3 vNormal;
				varying vec3 vWorldPosition;
				varying vec2 vUv;

				void main() {
					vec3 normal = vNormal;

					vec3 baseColor = uColor;

					// Basic diffuse lighting
					vec3 lightDir = normalize(vec3(1.0, 2.0, 1.0));
					float diff = max(dot(normal, lightDir), 0.0) * 0.6 + 0.4;
					vec3 diffuse = baseColor * diff;

					// Fresnel
					vec3 viewDir = normalize(cameraPosition - vWorldPosition);
					float fresnel = 1.0 - max(dot(viewDir, normal), 0.0);
					fresnel = pow(fresnel, uFresnelPower) * uFresnelIntensity;

					vec3 finalColor = diffuse + uFresnelColor * pow(fresnel, 2.0);
					finalColor = min(finalColor, vec3(1.0));
					gl_FragColor = vec4(finalColor, 1.0);
					#include <tonemapping_fragment>
					#include <colorspace_fragment>
				}
			`,
		});
	}
}
