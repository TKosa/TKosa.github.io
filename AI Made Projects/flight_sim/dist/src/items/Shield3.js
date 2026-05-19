import * as THREE from 'three';

export class Shield3 {
    constructor(game, position) {
        this.game = game;
    }

    use() {
        if (this.game && this.game.playerHealthManager) {
            this.game.playerHealthManager.useShield();
            return true;
        }
        return false;
    }

    update(delta, context) {
        // Shield-specific logic will go here
    }

    dispose() {
        // No visual cleanup needed
    }
}
