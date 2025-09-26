import UiNode from './UiNode.js';
import { PREGAME_BORDER_WIDTH } from './constants.js';
import { canvas } from '../render/context.js';

export class Panel extends UiNode {
  constructor(colour){
    super({ x: 0, y: 0, width: canvas.width/5, height: canvas.height });
    this.colour = colour;
    this.buttons = [];
    this.north_border = PREGAME_BORDER_WIDTH;
    this.east_border = PREGAME_BORDER_WIDTH/2;
    this.south_border = PREGAME_BORDER_WIDTH;
    this.west_border = PREGAME_BORDER_WIDTH/2;
  }

  addButton(button){
    this.buttons.push(button);
    this.addChild(button);
  }

}

export default Panel;
