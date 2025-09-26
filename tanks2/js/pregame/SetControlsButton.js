import Button from './Button.js';

export class SetControlsButton extends Button {
  constructor(panel,x,y,text,default_value=""){
    super(panel,x,y,text+": ");
    this.control=text+": ";
    this.value = default_value;
    this.panel.addButton(this);
  }
  keyDownHandler(key){
    this.value=key;
    if (this.panel && this.panel.pregame && typeof this.panel.pregame.emitTankConfig === 'function') {
      this.panel.pregame.emitTankConfig();
    }
  }
  onclick(){ this.panel.pregame.focus = this; }
}
export default SetControlsButton;
