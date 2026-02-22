import * as THREE from "three";

export default class Lights {
	constructor(scene) {
		this.scene = scene;
		this.#init();
	}

	#init() {
		this.#addKeyLight();
		this.#addBackLight();
	}

	#addKeyLight() {
		const key = new THREE.SpotLight(0xc5c3e7, 0.5);
		key.position.set(0, 2, 10);
		key.target.position.set(0, 2, 0);
		key.distance = 30;
		key.decay = 0.1;
		key.angle = Math.PI / 4;
		key.penumbra = 0.5;
		key.castShadow = true;
		key.shadow.mapSize.set(2048, 2048);
		key.shadow.camera.near = 0.5;
		key.shadow.camera.far = 30;
		key.shadow.bias = -0.005;
		this.scene.add(key);
		this.scene.add(key.target);
	}

	#addBackLight() {
		const back = new THREE.SpotLight(0xc5c3e7, 0.8);
		back.position.set(0, 1, -10);
		back.target.position.set(0, 2, 0);
		back.distance = 25;
		back.decay = 0.1;
		back.penumbra = 0.4;
		this.scene.add(back);
		this.scene.add(back.target);
	}
}
