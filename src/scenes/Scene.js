import * as THREE from "three";
import WebGLContext from "../core/WebGLContext";
import ImportGltf from "../utils/ImportGltf";
import { CameraRig } from "../utils/CameraRig";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import Lights from "../utils/Lights";
import PBRTextureLoader from "../utils/PBRTextureLoader";
import Water from "../utils/Water";
import ParticleSystem from "../utils/ParticleSystem";
import LogoParticles from "../utils/LogoParticles";
import DustParticles from "../utils/DustParticles";
import VolumetricLight from "../shaders/VolumetricLight";
import WirePulseMaterial from "../shaders/WirePulseMaterial";
import BarrelMaterial from "../shaders/BarrelMaterial";

export default class Scene {
	constructor() {
		this.context = null;
		this.camera = null;
		this.cameraRig = null;
		this.width = 0;
		this.height = 0;
		this.aspectRatio = 0;
		this.scene = null;
		this.envMap = null;
		this.barrels = [];
		this.bgColor = 0x05070f;
		this.sandColor = 0x4a5d7a;
		this.#init();
	}

	async #init() {
		this.#setContext();
		this.#setupScene();
		this.#setupCamera();
		this.#addLights();
		await this.#createMaterials();
		await this.#addObjects();
	}

	#setContext() {
		this.context = new WebGLContext();
	}

	#setupScene() {
		this.scene = new THREE.Scene();
		const environment = new RoomEnvironment();
		const pmremGenerator = new THREE.PMREMGenerator(this.context.renderer);
		this.envMap = pmremGenerator.fromScene(environment).texture;

		this.scene.background = new THREE.Color(this.bgColor);
		this.fog = new THREE.Fog(this.bgColor, 20, 30);
		this.scene.fog = this.fog;
	}

	#setupCamera() {
		this.#calculateAspectRatio();
		const isMobile = window.innerWidth < 768;
		this.camera = new THREE.PerspectiveCamera(45, this.aspectRatio, 0.1, 100);
		this.camera.position.z = isMobile ? 19 : 16;
		this.camera.position.y = 4;
		this.cameraRig = new CameraRig(this.camera, {
			target: new THREE.Vector3(0, 1.5, 0),
			xLimit: [-5, 5],
			yLimit: [3, 5],
		});
	}

	#addLights() {
		new Lights(this.scene);
	}

	async #createMaterials() {
		this.debugMaterials = new THREE.MeshStandardMaterial({
			color: 0x999999,
			metalness: 0.1,
			roughness: 0.5,
		});

		const sandTextures = new PBRTextureLoader(
			`${import.meta.env.BASE_URL}sand-dunes1-bl`,
			{ repeat: { x: 6, y: 6 } },
		);
		const textures = await sandTextures.loadTextures({
			normal: "sand-dunes1_normal-ogl.png",
			roughness: "sand-dunes1_roughness.png",
			ao: "sand-dunes1_ao.png",
		});

		this.sandMaterial = new THREE.MeshStandardMaterial({
			...textures,
			color: this.sandColor,
			roughness: 0.8,
			metalness: 0.0,
		});

		this.scratchedMetal = new THREE.MeshStandardMaterial({
			color: 0x0d1b2a,
			metalness: 1.0,
			roughness: 0.4,
			envMap: this.envMap,
			envMapIntensity: 0.6,
		});

		this.barrelMaterial = new BarrelMaterial({
			color: this.bgColor,
			fresnelColor: 0xc5c3e7,
			fresnelPower: 1.5,
			fresnelIntensity: 1.0,
		});

		this.emissionMaterial = new THREE.MeshStandardMaterial({
			color: 0xc5c3e7,
			emissive: 0xc5c3e7,
			emissiveIntensity: 1.2,
		});

		this.wirePulseMaterial = new WirePulseMaterial({
			color: 0xc5c3e7,
			baseColor: 0x1a1a2e,
			pulseSpeed: 1.0,
			pulseWidth: 1,
			emissiveIntensity: 2.5,
		});
	}

	async #addObjects() {
		new ImportGltf(`${import.meta.env.BASE_URL}model.glb`, {
			onLoad: (model) => {
				this.mesh = model;
				this.mesh.traverse((child) => {
					if (!child.isMesh) return;

					if (child.userData.name == "water") {
						child.visible = false;
						return;
					}

					if (child.userData.name == "teleporter_light") {
						child.material = this.emissionMaterial;
						return;
					}

					if (child.userData.name == "sand") {
						child.material = this.sandMaterial;
						return;
					}

					if (child.userData.name == "logo") {
						this.logo = child;
						child.visible = false;
						this.logoParticles = new LogoParticles(child, {
							renderer: this.context.renderer,
						});
						child.parent.add(this.logoParticles.points);
						return;
					}

					if (child.userData.name == "Teleporter") {
						child.material = this.scratchedMetal;
						return;
					}

					if (child.userData.name.startsWith("Wiresmall")) {
						child.material = this.wirePulseMaterial;
						return;
					}

					if (child.userData.name.startsWith("Barrel")) {
						child.material = this.barrelMaterial;
						child.userData.phase = Math.random() * Math.PI;
						child.userData.baseY = child.position.y;
						child.userData.baseRotationZ = child.rotation.z;
						child.userData.baseRotationY = child.rotation.y;
						this.barrels.push(child);
						return;
					}

					child.material = this.scratchedMetal;
				});

				this.scene.add(model);
			},
		});

		this.#addWater();
		this.#addParticles();
		this.#addDust();
		this.#addVolumetricLight();
	}

	#addWater() {
		const geometry = new THREE.PlaneGeometry(20, 20, 100, 100);
		const reflector = new Water(geometry, {
			clipBias: 0.003,
			textureWidth: window.innerWidth * 0.5,
			textureHeight: window.innerHeight * 0.5,
			color: 0x555555,
		});
		reflector.rotation.x = -Math.PI / 2;
		reflector.position.y = -0.1;
		this.water = reflector;
		this.scene.add(reflector);
	}

	#addParticles() {
		this.particles = new ParticleSystem({
			color: this.sandColor,
		});
		this.scene.add(this.particles.points);
	}

	#addDust() {
		this.dust = new DustParticles({
			color: 0x2f3e54,
			count: 20,
			spread: 20,
			windSpeed: 1.5,
		});
		this.scene.add(this.dust.points);
	}

	#addVolumetricLight() {
		this.volumetricLight = new VolumetricLight({
			color: 0xc5c3e7,
			height: 1.0,
			radiusBottom: 1.4,
			radiusTop: 2.0,
			position: new THREE.Vector3(0, 0, 0),
			pulseSpeed: 1.2,
			pulseMin: 0.9,
			pulseMax: 1.0,
			opacity: 1.0,
		});
		this.scene.add(this.volumetricLight);
	}

	#calculateAspectRatio() {
		const { width, height } = this.context.getFullScreenDimensions();
		this.width = width;
		this.height = height;
		this.aspectRatio = this.width / this.height;
	}

	animate(delta, elapsed) {
		this.cameraRig.update(delta);
		this.wirePulseMaterial && this.wirePulseMaterial.update(elapsed);
		this.water && this.water.update(elapsed);
		this.particles && this.particles.update(elapsed);
		this.volumetricLight && this.volumetricLight.update(elapsed);
		this.dust && this.dust.update(elapsed);

		this.logoParticles && this.logoParticles.update(delta, elapsed);

		for (const barrel of this.barrels) {
			if (!barrel?.position) continue;
			const t = elapsed * 1.7 + barrel.userData.phase;
			barrel.position.y = barrel.userData.baseY + Math.sin(t) * 0.1;
			barrel.rotation.z = Math.sin(t) * 0.1 + barrel.userData.baseRotationZ;
			barrel.rotation.y =
				Math.sin(t * 0.5) * 0.1 + barrel.userData.baseRotationY;
		}
	}

	onResize(width, height) {
		this.width = width;
		this.height = height;
		this.aspectRatio = width / height;

		this.camera.aspect = this.aspectRatio;
		this.camera.updateProjectionMatrix();
	}
}
