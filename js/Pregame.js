class Pregame
	{

	constructor(height)
		{
		//List of TankPanels
		this.panels = [];
		this.height = canvas.height;
		this.width = canvas.width;
		this.focus = null;
		this.addStartPanel();
		this.addPanelToMakePanels();
		this.updatePanelHorizontals();
		this.colour_templates = ["Lime","cyan","darkorange","Red","Green","#0000FF"];
		this.controls_templates = [
		["ArrowUp","ArrowRight","ArrowDown","ArrowLeft","1","2"]
		,["w","d","s","a","f","g"]
		,["y","j",'h','g','k','l']
		];

		}

	draw(){this.panels.forEach(function(panel){panel.draw();});}


	addPanel(panel)
		{
		this.panels.push(panel);
		this.updatePanelHorizontals();
		}


	removePanel(panel)
		{
		this.panels.splice(this.panels.indexOf(panel),1);
		this.updatePanelHorizontals();
		}


	updatePanelHorizontals()
		{
		var len = this.panels.length;
		var width = canvas.width/(len-1); 
		for(var i=1;i<len;i++)
			{
			var panel = this.panels[i];
			panel.x=(i-1)*width;
			panel.width=width;
			panel.buttons.forEach(function(e){e.update()});
			}
		}

	//Look through all elements to see if any of them were at the click location
	onclick(x,y)
		{
		this.panels.forEach(function(panel)
			{
			panel.buttons.forEach(function(button)
				{
		
					if(doRectsOverlap([x,y,1,1],button.get_as_Rect()))
						{
						button.onclick();
						return;
						}
				});
			});
		}

	addPanelToMakePanels()
		{
		var panel = new Panel('red');
		var add_button = new Button(panel,0,0,"Add Tank");
		add_button.onclick = function(){
			var current_template = pregame.panels.length-2;
			pregame.addPanel(new TankPanel(pregame.colour_templates[current_template],pregame.controls_templates[current_template]));
			};
		add_button.y=add_button.panel.height/2-add_button.height/2;
		add_button.text="Add Tank";
		panel.buttons=[add_button];
		this.addPanel(panel);
		}

	addStartPanel()
		{
		var start_panel = new Panel("blue");
		start_panel.y=this.height*4/5;
		start_panel.height=this.height*1/5;
		start_panel.width = canvas.width;
		this.addPanel(start_panel);

		var start_button = new Button(start_panel,0,0,"Start");
		start_button.onclick = this.start.bind(this);
		start_button.center_horizontally();
		start_button.center_vertically();
		start_panel.addButton(start_button);
		}

	handleKeydown(key){
		if(this.focus==null){return;}
		this.focus.handleKeydown(key);
		}

	start()
		{
		var maze = new Maze(5,7,canvas.width,canvas.height*4/5,wall_thiccness);
	
		//Instantiate tanks from the input in the panels 
		for(var i=2;i<this.panels.length;i++)
			{
			var panel = this.panels[i];
			var cb = this.panels[i].buttons;
			var controls = [cb[1].key, cb[2].key, cb[3].key, cb[4].key, cb[5].key, cb[6].key];
			var rnd_pos = maze.getRandomSquare().getCenter();
		
			var tank = new Tank (0,0,maze,controls,panel.colour);
			maze.placeObject(tank);
			}

		
		main_object = maze;
		}
	}	


//Panel to change controls
class Panel
	{

	constructor(colour)
		{
		this.width = 0;
		this.height = canvas.height*4/5;
		this.x=0;
		this.y=0;
		this.colour = colour;
		this.lineWidth=PREGAME_BORDER_WIDTH;
		this.buttons=[];
		}

	addButton(button)
		{
		this.buttons.push(button);
		}

	draw()
		{
		ctx.fillStyle = this.colour;
		ctx.fillRect(this.x,this.y,this.width,this.height);

		ctx.strokeStyle = "black";
		ctx.lineWidth=this.lineWidth;
		ctx.strokeRect(this.x,this.y,this.width-3,this.height)
		this.buttons.forEach(function(b){b.draw()});	
		}
	
	}


class Button
	{
	constructor(panel,x,y,text="")
		{
		this.height = 20;
		this.y=y;
		this.text=text;
		this.panel=panel;
		}

	get_as_Rect()
		{
		return [this.x,this.y,this.width,this.height];
		}
	
	//Called when a new panel is added, and things need to get resized
	update()
		{
		this.width=this.panel.width/1.2;
		this.x=this.panel.x+this.panel.width/2-this.width/2;
		}
	
	draw()
		{
		ctx.fillStyle = "white";
		ctx.fillRect(this.x,this.y,this.width,this.height);
		ctx.fillStyle = "black";
		ctx.textAlign = "center";
		ctx.font = "10px Arial";
		ctx.fillText(this.text,this.x+this.width/2,this.y+this.height/1.5);
		}

	center_horizontally()
		{
		this.width=this.panel.width/2;
		this.x=this.panel.x+this.panel.width/2-this.width/2;
		}

	center_vertically()
		{
		this.height=this.panel.height/2;
		this.y=this.panel.y+this.panel.height/2-this.height/2;
		}
	}


class TankPanel extends Panel 
	{
	constructor(colour="green",assignment=undefined)
		{
		super(colour);
		var delete_button = new Button(this,0,this.height/12,"delete");
		delete_button.onclick = function(){
			var index = pregame.panels.indexOf(this);
			pregame.panels.splice(index,1);
			pregame.updatePanelHorizontals();
			}
		this.addButton(delete_button);
		delete_button.center_horizontally();


		var controls = ["up","right","down","left","attack","special"];
		for (var i=0;i<controls.length;i++)
			{
			var button = new setControlsButton(this,0,this.height*(3+i)/12,controls[i],assignment ? assignment[i] : undefined);
			button.center_horizontally();
			this.addButton(button);
			}
		}
	}


class setControlsButton extends Button 
	{
	constructor(panel,x,y,text,key=undefined)
		{
		super(panel,x,y,text+":");
		this.control=text+": "; //e.g. "attack"
		this.key = key; //e.g. spacebar	
		}

	handleKeydown(key)
		{
		 this.key=key;
		 this.text = this.control + key;
		}

	onclick()
		{
		pregame.focus = this;
		}
	
	draw()
		{
		if(pregame.focus == this)
			{
			ctx.fillStyle = "red";
			ctx.fillRect(this.x,this.y,this.width,this.height);	
			}

		else
			{
			ctx.fillStyle = "white";
			ctx.fillRect(this.x,this.y,this.width,this.height);	
			}

		ctx.fillStyle = "white";
		ctx.fillRect(this.x+2,this.y+2,this.width-4,this.height-4);
			
		ctx.fillStyle = "black";
		ctx.textAlign = "center";
		ctx.font = "10px Arial";
		ctx.fillText(this.key ? this.control + this.key : this.control ,this.x+this.width/2,this.y+this.height/1.5);	
		
		}
	}