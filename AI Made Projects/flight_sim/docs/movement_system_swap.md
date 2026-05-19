# Movement System Swap Instructions

## How to swap between movement systems:

### In `src/plane.js` constructor (around line 105):

**System 1 (DEFAULT - airplane controls - pitch/yaw/roll):**
```javascript
import { MovementSystem1 } from './MovementSystem1.js';
// ... in constructor:
this.movementSystem = new MovementSystem1(this);
```

**System 2 (6DOF free-flying controls - WASD movement):**
```javascript
import { MovementSystem2 } from './MovementSystem2.js';
// ... in constructor:
this.movementSystem = new MovementSystem2(this);
```

**That's it! Just import the one you want and instantiate it.**

## Control Mappings:

### Movement System 1 (DEFAULT - Airplane):
- **W/Up**: Pitch down (nose down)
- **S/Down**: Pitch up (nose up)  
- **A/Left**: Turn left (yaw)
- **D/Right**: Turn right (yaw)
- **Space**: Throttle/accelerate forward

### Movement System 2 (Free Flying):
- **W/Up**: Move forward
- **S/Down**: Move backward
- **A/Left**: Move left (strafe)
- **D/Right**: Move right (strafe)
- **Space**: Move up

## Architecture:

Both movement systems are now separate classes:
- `MovementSystem1.js` - Original airplane-style controls
- `MovementSystem2.js` - New 6DOF free-flying controls

The `Plane` class delegates all movement logic to whichever system is active. This keeps the code clean and makes it easy to:
- Add new movement systems
- Compare/test different control schemes
- Maintain each system independently

## Notes:
- Both systems use velocity-based movement with acceleration/deceleration
- Minimum altitude is enforced in both systems
- Bullet firing and other systems work with both movement systems
- The swap requires changing 2 lines: the import and the instantiation

