import { expect, describe, it } from './test-harness.js';
import { Map } from '../src/Map.js';

describe('Player-Building Collision', () => {
  it('should reduce player health upon collision with a building', () => {
    // 1. Setup
    const map = new Map();
    const initialHealth = map.gameState.health;

    // 2. Find a building and move the player to it
    const building = map.buildingManager.buildingColliders[0];
    if (!building) {
      console.warn('No buildings found to test collision');
      return;
    }
    map.camera.position.copy(building.position);

    // 3. Trigger collision check
    map.checkCollisions();

    // 4. Assert health reduction
    const finalHealth = map.gameState.health;
    expect(finalHealth).to.be.lessThan(initialHealth);
    expect(finalHealth).to.equal(85);
  });
});
