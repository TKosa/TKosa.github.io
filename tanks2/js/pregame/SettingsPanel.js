import Panel from './Panel.js';
import Button from './Button.js';
import SetSettingsButton from './SetSettingsButton.js';
import { canvas } from '../render/context.js';

export class SettingsPanel extends Panel{
  constructor(pregame){
    super("Green");
    this.width=canvas.width;
    this.pregame=pregame;
    this.settings = [
      ["Number of Rows","num_of_rows"],
      ["Number of Columns","num_of_columns"],
      ["Movement Speed","move_speed"],
      ["Friendly Fire","friendly_fire"],
      ["Number of Bullets","bullet_limit"],
      ["Time Between Powerups (s)","powerup_interval"],
      ["Max powerups on screen","powerup_limit"],
      ["Duration of powerups (s)","powerup_duration"]
    ];
    this.settings.forEach(function(ar){this.make_button(ar)}.bind(this));
    this.addBackButton();
    var blen = this.buttons.length;
    for(var i=0;i<blen;i++){
      var button = this.buttons[i];
      button.y = canvas.height*4/5/(blen-1)*(i)+button.height;
      button.resize_horiontals();
    }
  }

  addBackButton(){
    var back = new Button(this,0,0,"Back");
    this.back=back;
    back.y=canvas.height*5/6;
    back.update();
    back.onclick = function(){
      var save_successful = this.save();
      if (!save_successful){return;}
      this.pregame.showMainPanels();
    }.bind(this);
    back.keyDownHandler = function(key){ if (key=="Enter" && this.panel.pregame.focus==this){this.onclick();} }
    this.addButton(back);
  }

  save(){
    var back_button = this.back;
    var buttons_that_must_be_posints=[0,1,4,6];
    var buttons_that_must_be_posnumbers=[2,5,7];
    for(var i=0;i<buttons_that_must_be_posints.length;i++){
      var button = this.buttons[buttons_that_must_be_posints[i]];
      if (!this.isPosInt(button.value)){
        back_button.text="x must be positive Integer".replace("x",button.text).replace(":","");
        return false;
      }
      // write through to settings only (no legacy fields)
      var game = button.panel.pregame.game;
      var name = button.attribute_name;
      var raw = button.value;
      var intNames = ['num_of_rows','num_of_columns','bullet_limit','powerup_limit','seconds_between_rounds'];
      var numNames = ['move_speed','rotation_speed','bullet_speed','powerup_interval','powerup_duration'];
      var val = raw;
      if (intNames.indexOf(name) !== -1) { val = parseInt(raw,10); }
      if (numNames.indexOf(name) !== -1) { val = parseFloat(raw); }
      game.maze.settings[name] = val;
    }
    for(var i=0;i<buttons_that_must_be_posnumbers.length;i++){
      var button = this.buttons[buttons_that_must_be_posnumbers[i]];
      if (!this.isPosNumber(button.value)){
        back_button.text="x must be positive Integer".replace("x",button.text).replace(":","");
        return false;
      }
      var numericGame = button.panel.pregame.game;
      var numericName = button.attribute_name;
      numericGame.maze.settings[numericName] = parseFloat(button.value);
    }
    var friendly_fire_button = this.buttons[3];
    this.pregame.game.maze.settings.friendly_fire = (friendly_fire_button.value=="true" ? true : false)
    back_button.text="Back";
    return true;
  }

  isPosInt(str){ if(isNaN(str)){return false;} var number = parseFloat(str); if(!Number.isInteger(number) || number<0){return false;} return true; }
  isPosNumber(str){ if(isNaN(str)){return false;} var number = parseFloat(str); if(number<=0){return false;} return true; }

  make_button(ar){
    var text = ar[0];
    var attribute_name = ar[1];
    this[attribute_name]=new SetSettingsButton(this,0,0,text,"",attribute_name);
    if(ar[0]=="Friendly Fire"){
      this[attribute_name].onclick = function(){
        this.panel.pregame.focus=this;
        this.value=="true" ? this.value="false":this.value="true"
      }
    }
  }
}
export default SettingsPanel;
