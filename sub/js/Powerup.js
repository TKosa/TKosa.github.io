class Powerup{

	constructor(maze,x,y){
		this.x=x;
		this.y=y;
		this.width=10;
		this.height=10;
		this.maze=maze;
	}

	getMessage(){
		return this.name;
	}

	draw(){
		ctx.lineWidth=1;
		ctx.strokeStyle=this.color;
		ctx.strokeRect(this.x,this.y,this.width,this.width);
	}

	onBulletHit(tank){
		
		this.maze.removePowerup(this);
		this.tank=tank;
		tank.removeAllPowerups();
		tank.addPowerup(this);

		//Set the timer
		this.timeout=setTimeout(function(){
			this.tank.removePowerup(this); 
		}.bind(this),game.powerup_duration*1000);

		
	}
}

class TrippyPowerup extends Powerup {
	constructor(maze,x,y){
		super(maze,x,y);
		this.name = "trippy";
		this.color = "green";
	}

	effect(tank){
			{
				draw = function()
				{	
					game.main();
 					requestAnimationFrame(draw);
				};
			}
	}

	undo(tank){
		draw = function()
					{
						ctx.clearRect(0, 0, canvas.width, canvas.height);
						game.main();
 						requestAnimationFrame(draw);
					};
	}	
}

class RemoveBulletLimitPowerup extends Powerup {
	constructor(maze,x,y){
		super(maze,x,y);
		this.name = "remove bullet limit";
		this.color = "blue";
	}

	effect(tank){
		tank.shouldFire = function() 
		{
			if (this.shooting) {return true;}
			else {return false;}
		}		
	}

	undo(tank){
		tank.shouldFire=function(){
			if (this.shooting && this.bullets.length<this.bullet_limit) {return true;}
			else {return false;}
		}
	}
}

class TripleShotPowerup extends Powerup {
	constructor(maze,x,y){
		super(maze,x,y);
		this.name = "triple shot";
		this.color = "red";
	}

	effect(tank){
		//setting tank.old_fire=tank.fire caused an inf_recursion bug, so I just copied the defn
		tank.old_fire = function(rotation,speed)
		{
			var x_vel = speed*Math.sin(rotation);
			var y_vel = speed*-Math.cos(rotation);			//x,y _pos are at tip of the cannon
			var x_pos = this.x+this.width/2 + Math.sin(this.rotation)*this.height;
			var y_pos = this.y+this.height/2 + Math.cos(this.rotation)*-this.height;
			var new_bullet = new Bullet(this,[x_vel,y_vel],x_pos,y_pos);			
			this.bullets.push(new_bullet);
		}

		tank.fire = function(rotation, speed){
			this.old_fire(rotation, speed);
			this.old_fire(rotation-Math.PI/12, speed);
			this.old_fire(rotation+Math.PI/12, speed);
		}

		tank.bullet_limit=3*game.bullet_limit;		
	}

	undo(tank){
		{
			tank.fire = tank.old_fire; 
			tank.bullet_limit=game.bullet_limit;
		}	
	}
}

class MoveThroughWallsPowerup extends Powerup {
	constructor(maze,x,y){
		super(maze,x,y);
		this.name = "move through walls";
		this.color = "blue";
	}

	effect(tank){
		tank.tryMovingTo=function(pos){
			var x = pos[0];
			var y = pos[1];

			if(!this.maze.isOutOfBounds([x,y])){
				this.x=x;
				this.y=y;
			}
		}		
	}

	undo(tank){
		tank.tryMovingTo=function(pos){
				var x = pos[0];
				var y = pos[1];

				if(!this.maze.doesRectCollide([x,y,this.width,this.height])){
					this.x=x;
					this.y=y;
				}
		}

		//Place at center of current square (so tanks don't get stuck in walls)
		var square = tank.maze.getSquareAtXY([tank.x,tank.y]);
		tank.x=square.getCenter()[0];
		tank.y=square.getCenter()[1];
	}
}

function generatePowerup(maze){

		powerup_no = Math.floor(4 * Math.random());
		switch(powerup_no){
			case 0:
				return new TrippyPowerup(maze,0,0);
			break;
			case 1:
				return new RemoveBulletLimitPowerup(maze,0,0);
			break;
			case 2:
				return new TripleShotPowerup(maze,0,0);
			break;
			case 3:
				return new MoveThroughWallsPowerup(maze,0,0);
			break;
		}
}

		