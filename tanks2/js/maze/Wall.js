// Wall and Intersection primitives for maze seams

export class Wall {
  constructor(x, y, width, height, orientation) {
    this.x = x | 0;
    this.y = y | 0;
    this.width = width | 0;
    this.height = height | 0;
    this.orientation = orientation; // 'vertical' | 'horizontal'
    this.isActive = true;
    // Intersection references
    this.N = null; // for vertical: top
    this.S = null; // for vertical: bottom
    this.W = null; // for horizontal: left
    this.E = null; // for horizontal: right
  }

  getRect() {
    return [this.x, this.y, this.width, this.height];
  }
}

export class Intersection {
  constructor(x, y) {
    this.x = x | 0;
    this.y = y | 0;
    // Touching walls (may be null)
    this.north = null; // horizontal above
    this.south = null; // horizontal below
    this.west = null;  // vertical to left
    this.east = null;  // vertical to right
  }
}
