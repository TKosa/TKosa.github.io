export class SpeedBoost {
    constructor(game, position) {
        this.game = game;
        // If position is provided, it might be for a pickup (not implemented yet for this item type in this context, 
        // but following pattern). 
        // Actually, for inventory items, the constructor usually just takes game/plane context if needed.
        // But looking at other items, they seem to be instantiated by ItemFactory.
    }

    use() {
        if (!this.game || !this.game.plane) {
            return false;
        }

        const plane = this.game.plane;
        // Set speed to 3x max speed
        plane.speed = plane.maxSpeed * 3;

        return true; // Item consumed
    }
}
