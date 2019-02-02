
//ctx must be defined 


class Maze {
	constructor(game){
		this.game=game;
		this.num_of_rows=game.num_of_rows;
		this.num_of_columns=game.num_of_columns;
		this.wall_thiccness=game.wall_thiccness;
		this.width=canvas.width-this.wall_thiccness;
		this.height=canvas.height*4/5-this.wall_thiccness;
		
		this.tanks=[];
		this.powerups=[];
		this.message = "Shoot the opposing tanks!"
		this.num_of_destroyed_tanks=0;

		//2d array
		var squares=[];
		for(var r=0;r<this.num_of_rows;r++){
			var row=[];
			for (var c=0;c<this.num_of_columns;c++){
				row.push(new Square(this,r,c));
			}
			squares.push(row);
		}
		this.squares=squares;

		this.randomize();
		setTimeout(this.addPowerupAndRepeat.bind(this),POWERUP_INTERVAL);
	}

	main(){
		this.tanks.forEach(function(tank){tank.main();});
		this.draw();
	}

	draw(){

	ctx.fillStyle="black";

	this.squares.forEach(function(row){row.forEach(function(square){square.draw();});});
	this.tanks.forEach(function(tank){if(!tank.is_dead) tank.draw();});
	this.powerups.forEach(function(powerup){powerup.draw();});

	//Draw bottom panel
	var x_padding = 5;
	var y_padding = 2;
	ctx.fillStyle = "#808080";
	ctx.fillRect(0,canvas.height*4/5,canvas.width,canvas.height*1/5);
	
	ctx.fillRect(x_padding,canvas.height*4/5+y_padding,canvas.width-2*x_padding,canvas.height*1/5-4*y_padding);
	ctx.font = "20px Verdana";
		
	for(var i=0; i<this.tanks.length;i++){
		var tank = this.tanks[i];
		var num_of_tanks = this.tanks.length;
		ctx.fillStyle=tank.colour;
		var x = i/Math.max(1,(num_of_tanks-1)) * (canvas.width-4*x_padding) + 2*x_padding  ;
		var y = canvas.height*4/5+y_padding+15;	
		
		ctx.fillText(tank.score.toString(),x,y);
	}

	ctx.font = "15px Verdana";
	ctx.fillStyle = "black";
	ctx.fillText(this.message, canvas.width/2, canvas.height-20);
		
	}
	

	keyDownHandler(event){
		this.tanks.forEach(function(tank){
			tank.keyDownHandler(event);
		});
	}

	randomize(){
		this.squares.forEach(function(element){
			element.forEach(function(e){
				e.visited=false;
			});
		});

		var entry_square=this.squares[0][0];
		this.visit(new Square(this,-1,-1),this.getRandomSquare());
	}

	//Used in randomize. Visiting square b from a means removing the border between a-b and visiting all unvisited neighbours (in a random order). 
	visit(old_square,new_square){
		old_square.removeBorder(new_square);
		new_square.visited=true;

		var neighbours=new_square.getNeighbours();
		neighbours=shuffle(neighbours);

		for(var i=0;i<neighbours.length;i++){
			if (neighbours[i].visited==false){
				this.visit(new_square,neighbours[i]);
			}
		}
	}

	
	getSquareAtXY(pos){
		var x=pos[0];
		var y=pos[1];
		//Check if position is in the maze
		if(this.isOutOfBounds(pos)){return false;}
		return this.squares[Math.floor(y/this.height * this.num_of_rows)][Math.floor(x/this.width * this.num_of_columns)]
	}


	getRandomSquare(){
		var rnd_row_num = Math.floor(Math.random()*this.squares.length);
		var row = this.squares[rnd_row_num];
		var rnd_square = row[Math.floor(Math.random()*row.length)];
		return rnd_square;
	}

	
	//Check if a rectangle collides with (a wall in) the maze
	doesRectCollide(rect){
		if(this.isOutOfBounds(rect[0],rect[1])){return true;}
		var square = this.getSquareAtXY([rect[0],rect[1]]);
		if(!square){return true;}
		var nearby_squares = square.getNeighbours().concat([square]);
		//We need to check walls of nearby squares because of the case where you're driving into top wall horizontally
		var nearby_walls = [];
		nearby_squares.forEach(function(e){
			e.getWalls().forEach(function(el){
				nearby_walls.push(el);
			});
		});
		var collides=false;
		nearby_walls.forEach(function(e){
			if(doRectsOverlap(rect,e)){collides=true;}
		});
		return collides;

	}
	

	isOutOfBounds(pos){
		if(pos[0]<=0 || pos[0]>=this.width || pos[1]<=0 || pos[1]>=this.height){return true;}
		return false;
	}

	
	tankDestroyed(){
		this.num_of_destroyed_tanks+=1;

		if (this.num_of_destroyed_tanks==this.tanks.length-1){
			for(var i=0;i<this.tanks.length;i++){
				var tank = this.tanks[i];
				if(tank.is_dead==false){
					tank.score+=1;
					this.restart_helper(SECONDS_BETWEEN_ROUNDS);
					return;
				}			
			}		
		}
	}

	restart_helper(sec){
		if(sec==0){this.restart();return;}
		this.message="Next round starting in time seconds".replace('time',sec);
		setTimeout(this.restart_helper.bind(this),1000,sec-1);	
	}

	restart(){
		this.message="restart";
		this.num_of_destroyed_tanks=0;
		for(var i=0;i<this.tanks.length;i++){
			this.tanks[i].restart();
		}
		this.powerups=[];
	}

	//Takes obj with x, y, width and height properties and sets x,y to place it in a valid position
	placeObject(object){
		var square = this.getRandomSquare();
		var min_x = square.x + square.wall_thiccness * square.west ; 
		var max_x = square.x + square.width - square.wall_thiccness * square.east - object.width ;
		var min_y = square.y + square.wall_thiccness * square.north ;
		var max_y = square.y + square.height - square.wall_thiccness * square.south - object.height;

		object.x = min_x + Math.random()*(max_x-min_x);
		object.y = min_y + Math.random()*(max_y-min_y);
	
	}

	addPowerupAndRepeat(){	
		if(this.powerups.length >= this.game.powerup_limit){
			this.powerups.shift();
		}	

		var powerup = new Powerup(this,0,0,0);
		powerup.randomize();
		this.placeObject(powerup);
		this.addPowerup(powerup);
		this.message = powerup.getMessage();	

		setTimeout(this.addPowerupAndRepeat.bind(this), this.game.powerup_interval*1000, this);
	}

	addPowerup(powerup){
		this.powerups.push(powerup);
	}
	
	removePowerup(powerup){
		this.powerups.splice(this.powerups.indexOf(powerup),1);
	}

	addTank(tank){
		this.tanks.push(tank)
	}

	onclick(x,y){}

}
	

	

