import * as THREE from "three";
import Stats from "stats-gl";
import WebGLContext from "./WebGLContext";
import Scene from "../scenes/Scene";
import PostProcessing from "./PostProcessing";

class Three {
	constructor(container) {
		this.container = container;
		this.context = null;
		this.clock = new THREE.Clock();
	}

	run() {
		this.context = new WebGLContext(this.container);
		this.context.init();
		this.scene = new Scene();
		this.postProcessing = new PostProcessing(
			this.context.renderer,
			this.scene.scene,
			this.scene.camera,
		);
		this.stats = new Stats({ trackGPU: true });
		document.body.appendChild(this.stats.dom);
		this.stats.init(this.context.renderer);
		this.#animate();
		this.#addResizeListener();
	}

	#animate() {
		this.stats.begin();
		const delta = this.clock.getDelta();
		const elapsed = this.clock.elapsedTime;

		this.scene.animate(delta, elapsed);
		this.#render();
		this.stats.end();
		this.stats.update();
		requestAnimationFrame(() => this.#animate());
	}

	#render() {
		this.postProcessing && this.postProcessing.render();
	}

	#addResizeListener() {
		window.addEventListener("resize", () => this.#onResize());
	}

	#onResize() {
		const { width, height } = this.context.getFullScreenDimensions();
		this.context?.onResize(width, height);
		this.scene?.onResize(width, height);
		this.postProcessing?.onResize(width, height);
	}
}

export default Three;
