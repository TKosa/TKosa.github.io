import Panel from './Panel.js';
import Button from './Button.js';
import SetControlsButton from './SetControlsButton.js';

export class TankPanel extends Panel {
  constructor(pregame,colour="green",assignment=undefined){
    super(colour);
    this.panelId = 'panel-' + Math.random().toString(36).slice(2,8);
    this.pregame=pregame;
    var delete_button = new Button(this,0,this.height*10/12,"delete");
    delete_button.onclick = function(){ this.pregame.removeTankPanel(this); }.bind(this);
    this.addButton(delete_button);
    delete_button.center_horizontally();

    var controls = ["up","right","down","left","attack","special"];
    for (var i=0;i<controls.length;i++){
      var button = new SetControlsButton(this,0,this.height*(3+i)/12,controls[i],assignment ? assignment[i] : undefined);
      button.center_horizontally();
    }
    if (this.pregame && typeof this.pregame.emitTankConfig === 'function') {
      this.pregame.emitTankConfig();
    }
  }
}
export default TankPanel;
