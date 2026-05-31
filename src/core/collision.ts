// src/core/collision.ts
import * as THREE from 'three';

export type CollisionBox = {
  min: THREE.Vector3;
  max: THREE.Vector3;
  isTrigger?: boolean;
  id?: string;
  type?: string;
};

export class CollisionSystem {
  boxes: CollisionBox[] = [];
  
  addBox(min: THREE.Vector3, max: THREE.Vector3, opts: { isTrigger?: boolean; id?: string; type?: string } = {}) {
    this.boxes.push({ min: min.clone(), max: max.clone(), ...opts });
    return this.boxes[this.boxes.length - 1];
  }
  
  removeBox(id: string) {
    this.boxes = this.boxes.filter(b => b.id !== id);
  }
  
  check(pos: THREE.Vector3, radius: number, height: number): boolean {
    const pMin = new THREE.Vector3(pos.x - radius, pos.y, pos.z - radius);
    const pMax = new THREE.Vector3(pos.x + radius, pos.y + height, pos.z + radius);
    
    for (const box of this.boxes) {
      if (pMin.x < box.max.x && pMax.x > box.min.x &&
          pMin.y < box.max.y && pMax.y > box.min.y &&
          pMin.z < box.max.z && pMax.z > box.min.z) {
        return !box.isTrigger;
      }
    }
    return false;
  }
  
  findInteractable(pos: THREE.Vector3, range = 2.5): CollisionBox | null {
    const query = {
      min: new THREE.Vector3(pos.x - range, pos.y - 1, pos.z - range),
      max: new THREE.Vector3(pos.x + range, pos.y + 2, pos.z + range)
    };
    for (const box of this.boxes) {
      if (box.type === 'interactable' &&
          query.min.x < box.max.x && query.max.x > box.min.x &&
          query.min.y < box.max.y && query.max.y > box.min.y &&
          query.min.z < box.max.z && query.max.z > box.min.z) {
        return box;
      }
    }
    return null;
  }
}
