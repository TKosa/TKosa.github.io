import { Campfire } from './Campfire.js';
import { Turret } from './Turret.js';
import { Bomb } from './Bomb.js';
import { Shield } from './Shield.js';
import { Shield2 } from './Shield2.js';
import { Shield3 } from './Shield3.js';
import { AcceleratorRing } from './AcceleratorRing.js';
import { LaserTurret } from './LaserTurret.js';
import { SpeedBoost } from './SpeedBoost.js';

export const ItemRegistry = {
    shield: {
        id: 'shield',
        name: 'Shield Generator',
        icon: 'shield',
        cooldown: 0,
        once: true,
        class: Shield
    },
    shield2: {
        id: 'shield2',
        name: 'Shield Generator 2',
        icon: 'assets/item_icon/shield2.png',
        cooldown: 10,
        once: false,
        class: Shield2
    },
    shield3: {
        id: 'shield3',
        name: 'Shield Generator 3',
        icon: 'assets/item_icon/shield3.png',
        cooldown: 1,
        once: false,
        class: Shield3
    },
    bomb: {
        id: 'bomb',
        name: 'High-Impact Bomb',
        icon: 'bomb',
        cooldown: 0,
        once: true,
        class: Bomb
    },
    campfire: {
        id: 'campfire',
        name: 'Campfire',
        icon: 'campfire',
        cooldown: 0,
        once: true,
        class: Campfire
    },
    turret: {
        id: 'turret',
        name: 'Turret',
        icon: 'turret',
        cooldown: 0,
        once: true,
        class: Turret
    },
    'laser-turret': {
        id: 'laser-turret',
        name: 'Laser Turret',
        icon: 'laserTurret',
        cooldown: 0,
        once: true,
        class: LaserTurret
    },
    accelerator: {
        id: 'accelerator',
        name: 'Accelerator Ring',
        icon: 'accelerator',
        cooldown: 0,
        once: true,
        class: AcceleratorRing
    },
    speedBoost: {
        id: 'speedBoost',
        name: 'Speed Boost',
        icon: 'speedBoost',
        cooldown: 5,
        once: true,
        class: SpeedBoost
    }
};

export const tier1Items = ['bomb', 'shield', 'speedBoost'];

export const getItemDefinition = (id) => ItemRegistry[id];
export const getAllItemDefinitions = () => Object.values(ItemRegistry);
