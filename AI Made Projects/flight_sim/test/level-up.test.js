import { Map } from '../src/Map.js';
import { eventBus } from '../src/eventBus.js';

const expect = chai.expect;

describe('Level-Up System', () => {
    it('should emit a levelUp event when the star count reaches starsPerLevel', (done) => {
        const gameContainer = document.createElement('div');
        const map = new Map(gameContainer);

        let levelUpEmitted = false;
        const listener = () => {
            levelUpEmitted = true;
        };

        eventBus.on('levelUp', listener);

        for (let i = 0; i < map.starsPerLevel; i++) {
            map.incrementLevelProgress();
        }

        expect(levelUpEmitted).to.be.true;

        eventBus.off('levelUp', listener);
        map.dispose();
        done();
    });
});
