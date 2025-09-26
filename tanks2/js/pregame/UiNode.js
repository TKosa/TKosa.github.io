export class UiNode {
  constructor({ x = 0, y = 0, width = 0, height = 0, visible = true } = {}) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.visible = visible;
    this.children = [];
    this.parent = null;
  }

  addChild(node) {
    if (!node) { return null; }
    if (node.parent) { node.parent.removeChild(node); }
    node.parent = this;
    this.children.push(node);
    return node;
  }

  removeChild(node) {
    const index = this.children.indexOf(node);
    if (index === -1) { return; }
    node.parent = null;
    this.children.splice(index, 1);
  }

  setChildren(children) {
    this.children.slice().forEach((child) => this.removeChild(child));
    (children || []).forEach((child) => this.addChild(child));
  }

  containsPoint(x, y) {
    return this.visible && x >= this.x && y >= this.y && x <= this.x + this.width && y <= this.y + this.height;
  }

  draw(ctx) {
    if (!this.visible) { return; }
    this.drawSelf(ctx);
    this.children.forEach((child) => child.draw(ctx));
  }

  drawSelf(ctx) {}

  dispatchClick(x, y) {
    if (!this.containsPoint(x, y)) { return false; }
    for (let i = this.children.length - 1; i >= 0; i--) {
      if (this.children[i].dispatchClick(x, y)) { return true; }
    }
    return this.handleClick(x, y);
  }

  handleClick() { return false; }
}

export default UiNode;
