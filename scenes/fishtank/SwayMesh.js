// A decoration that sways: a vertical plane mesh whose vertices move sideways, tops more than bases
// (tech design 3.3). Rocks never use this.
import { MeshPlane } from 'pixi.js';
import { visual } from './visualConfig.js';

export class SwayMesh {
  /**
   * @param {import('pixi.js').Texture} texture
   * @param {{amplitude:number, speed:number}} sway  amplitude is a fraction of the height
   * @param {number} phase
   */
  constructor(texture, sway, phase) {
    this.sway = sway;
    this.phase = phase;
    this.mesh = new MeshPlane({ texture, verticesX: 2, verticesY: visual.sway.verticesY });
    this.mesh.eventMode = 'none';
    // Origin at the bottom centre, so the base stays planted.
    this.mesh.pivot.set(texture.width / 2, texture.height);
    this.buffer = this.mesh.geometry.getBuffer('aPosition');
    this.base = Float32Array.from(this.buffer.data);
    this.height = texture.height;
    this.rows = visual.sway.verticesY;
  }

  update(time) {
    const data = this.buffer.data;
    const { amplitude, speed } = this.sway;
    const verticesX = 2;
    for (let row = 0; row < this.rows; row++) {
      const t = row / (this.rows - 1); // 0 at the top, 1 at the base
      const weight = (1 - t) * (1 - t);
      const dx =
        Math.sin(time * speed + this.phase + (1 - t) * 1.6) * amplitude * this.height * weight;
      for (let col = 0; col < verticesX; col++) {
        const index = (row * verticesX + col) * 2;
        data[index] = this.base[index] + dx;
      }
    }
    this.buffer.update();
  }
}
