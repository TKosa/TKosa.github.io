# Turret Pooling System

## Overview
Turrets now use an instance pooling system for better performance and resource management.

## Architecture

### `TurretPoolManager.js`
- Loads the turret GLB model **once** at initialization
- Creates 25 pre-cloned instances of the model
- Hides unused turrets underground at position (0, -1000, 0)
- Manages slot acquisition and release

### `Turret.js` (Refactored)
- No longer loads the GLB model individually
- Uses static `Turret.initialize(pool)` to set up the pool reference
- Acquires a slot from the pool on construction
- Releases the slot (hides turret) on dispose
- Provides backwards-compatible `mesh` getter

### `Map.js` Integration
- Creates `TurretPoolManager` in constructor
- Initializes `Turret` class with the pool
- Pool is created alongside bullet pools

## Benefits

✅ **Performance**: GLB model loaded once instead of per-turret
✅ **No Loading Delays**: Turrets appear instantly (already loaded)
✅ **Memory Efficient**: Reuses same model data
✅ **No Disposal Overhead**: Just hides underground instead of destroying
✅ **Consistent Architecture**: Matches bullet and enemy pooling patterns

## Capacity

- **Default**: 25 turret instances
- **Can be increased**: Change `this.capacity` in `TurretPoolManager` constructor

## How It Works

1. **On Map Init**: TurretPoolManager loads the GLB and creates 25 clones hidden underground
2. **On Turret Deploy**: Turret.constructor() acquires a slot, pool moves that instance to the turret's position
3. **On Building Destroy**: Turret.dispose() releases the slot, pool moves instance back underground
4. **Slot Reuse**: Released slots go back into the free stack for next deployment

## Model Configuration

The turret model is configured in `TurretPoolManager.init()`:
- **Scale**: `(5, 5, 5)`
- **Rotation**: `(-0.71, -2.46, -0.42)` radians

These values are applied to the template before cloning, so all instances inherit them.
