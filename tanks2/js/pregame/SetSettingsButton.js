import SetControlsButton from './SetControlsButton.js';

export class SetSettingsButton extends SetControlsButton {
  constructor(panel,x,y,text,default_value="",attribute_name){
    super(panel,x,y,text,default_value);
    this.attribute_name=attribute_name;
    var g = this.panel.pregame.game;
    var s = g.maze && g.maze.settings ? g.maze.settings : {};
    this.value = (attribute_name in s ? s[attribute_name] : '').toString();
  }
  keyDownHandler(key){
    if(key=="Backspace"){this.value=this.value.slice(0,-1);return;}
    if(key=="Enter"){this.panel.pregame.focus = this.panel.back;return;}
    this.value+=key;
  }
  onclick(){ this.panel.pregame.focus = this; this.value=""; }
}
export default SetSettingsButton;
