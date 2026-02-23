import * as THREE from "three";
import { damp3 } from "maath/easing";

export class CameraRig {
	/**
	 * @param {THREE.Camera} camera - The camera to rig
	 * @param {Object} options
	 * @param {THREE.Vector3} options.target - Point the camera looks at
	 * @param {Array} options.xLimit - [min, max] for camera x position
	 * @param {Array} options.yLimit - [min, max] for camera y position (optional)
	 * @param {number} options.smoothTime - Lower = faster movement
	 */
	constructor(camera, options = {}) {
		this.camera = camera;
		this.target = options.target || new THREE.Vector3(0, 0, 0);
		this.xLimit = options.xLimit || [-5, 5];
		this.yLimit = options.yLimit || null;
		this.smoothTime = options.smoothTime || 0.25;

		this._goalPosition = this.camera.position.clone();
		this._baseRadius = this.camera.position.length();
		this._baseY = this.camera.position.y;
		this._elapsed = 0;

		// normalized pointer (-1..1)
		this.pointer = { x: 0, y: 0 };

		this.isMobile = window.innerWidth < 768;
		this.orbitSpeed = options.orbitSpeed || 0.15;

		if (!this.isMobile) {
			this._bindEvents();
		}
	}

	_bindEvents() {
		window.addEventListener("mousemove", (event) => {
			this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
			this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
		});
	}

	/**
	 * Call every frame
	 * @param {number} delta - Time delta in seconds
	 */
	update(delta) {
		this._elapsed += delta;

		if (this.isMobile) {
			// Auto-orbit on mobile — gentle arc, not full rotation
			const angle = this._elapsed * this.orbitSpeed;
			const swayX = Math.sin(angle) * 9.0;
			this._goalPosition.x = swayX;
			this._goalPosition.z = Math.sin(this._elapsed * 0.3) * 0.9 + 18;
			this._goalPosition.y = this._baseY + Math.sin(this._elapsed * 0.3) * 1.5;
		} else {
			const targetX = THREE.MathUtils.mapLinear(
				this.pointer.x,
				-1,
				1,
				this.xLimit[0],
				this.xLimit[1],
			);
			this._goalPosition.x = targetX;

			if (this.yLimit) {
				const targetY = THREE.MathUtils.mapLinear(
					this.pointer.y,
					-1,
					1,
					this.yLimit[0],
					this.yLimit[1],
				);
				this._goalPosition.y = targetY;
			}
		}

		damp3(this.camera.position, this._goalPosition, this.smoothTime, delta);

		this.camera.lookAt(this.target);
	}
}
