import UiNode from './UiNode.js';

export class Button extends UiNode{
  constructor(panel,x=0,y=0,text=""){
    super({ x: 0, y: y, width: panel && panel.width ? panel.width/1.5 : 0, height: 28 });
    this.text=text;
    this.panel=panel;
  }

  get_as_Rect(){ return [this.x,this.y,this.width,this.height]; }

  update(){ /* layout handled by CSS */ }

  resize_horiontals(){ /* legacy no-op: layout performed by CSS */ }

  center_horizontally(){ /* legacy no-op: maintained for compatibility */ }

  center_vertically(){ /* legacy no-op: maintained for compatibility */ }

  handleClick(){ if(this.onclick){ this.onclick(); return true; } return false; }
}
export default Button;
