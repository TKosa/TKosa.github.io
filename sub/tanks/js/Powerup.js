class Powerup{

	constructor(maze,x=0,y=0){
		this.x=x;
		this.y=y;
		this.width=20;
		this.height=20;
		this.maze=maze;
	}

	getMessage(){
		return this.name;
	}

	draw(){

		if(this.hasOwnProperty("img")){
			ctx.drawImage(this.img,this.x,this.y,this.width,this.height);
		}

		else{
			ctx.lineWidth=1;
			ctx.strokeStyle=this.color;
			ctx.strokeRect(this.x,this.y,this.width,this.width);
		}
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
		this.name = "Trippy";
		this.color = "green";
		var url = "https://image.flaticon.com/icons/svg/1685/1685844.svg";
		this.img = getImageFromURL(url,this.name);
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
		this.name = "Remove Bullet Limit";
		this.color = "orange";
		var url = "https://image.flaticon.com/icons/svg/875/875089.svg";
		this.img = getImageFromURL(url,this.name);
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
		this.name = "Triple-Shot";
		this.color = "red";
		var url = "https://image.flaticon.com/icons/svg/60/60704.svg";
		this.img = getImageFromURL(url,this.name);
	}

	effect(tank){
		//setting tank.old_fire=tank.fire caused an inf_recursion bug, so I just copied the defn

		tank.fire = function(){
			this.fire_helper(this.rotation, game.bullet_speed);
			this.fire_helper(this.rotation-Math.PI/12,  game.bullet_speed);
			this.fire_helper(this.rotation+Math.PI/12,  game.bullet_speed);
		}

		tank.bullet_limit=3*game.bullet_limit;		
	}

	undo(tank){
		{
			tank.fire = function(){this.fire_helper(this.rotation, game.bullet_speed);}
			tank.bullet_limit=game.bullet_limit;
		}	
	}
}

class MoveThroughWallsPowerup extends Powerup {
	constructor(maze,x,y){
		super(maze,x,y);
		this.name = "ghost";
		this.color = "blue";
		var url = "https://image.flaticon.com/icons/svg/110/110361.svg";
		this.img = getImageFromURL(url,this.name);
		
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

class TeleportPowerup extends Powerup {

	constructor(maze,x,y){
		super(maze,x,y);
		this.name = "Teleport";
		this.color = "cyan";
		var url = "https://image.flaticon.com/icons/svg/1388/1388575.svg";
		this.img = getImageFromURL(url,this.name);
		
	}

	effect(tank){
		this.draw_mirror = function(){
			//Drawing
			ctx.save();
			ctx.translate( canvas.width-(this.x+this.width/2), canvas.height*4/5-(this.y+this.height/2) );
			ctx.rotate(this.rotation);

			//drawing with img loaded instead of tank
			if(this.hasOwnProperty("img")){
				ctx.drawImage(this.img,-this.width/2,-this.height/2,this.width,this.height);
			}

			else{
				ctx.fillStyle=this.colour;
				ctx.fillRect(0,0,5,5);
				
			}
			ctx.restore();
		}.bind(tank);
		
		tank.maze.extraFunctionsPerCycle.push(this.draw_mirror);

		tank.special = function(){
			if(this.poweruplock==true){return;}
			/*TrymovingTo is designed a bit awkwardly for this. If the position is invalid, it will try to move in just the horizontal and just the vertical components.
			This is to let tanks to slide up slowly against a wall theyre driving into at an upwards angle, instead of stopping completely. 
			For teleport, if the position is invalid it tries to only teleport its x-component, which contradicts the marker of where you will be teleported.
			My solution is to move the tank to a potentially invalid position, then call tryMovingTo, which centers it in the square if its currently in an invalid position.
			It looks hacky, but its bug-free and unnoticeable during gameplay.
			*/
			this.x = canvas.width-this.x;
			this.y = canvas.height*4/5-this.y;
			this.tryMovingTo([this.x,this.y]);

			this.poweruplock = true;
			
		}


	}

	undo(tank){
		removeElementFromArray(this.draw_mirror, tank.maze.extraFunctionsPerCycle);
		tank.special = function(){};
	}
}

class CannonballPowerup extends Powerup{

	constructor(maze,x,y){
		super(maze,x,y);
		this.name = "CannonBall";
		this.color = "grey";
		var url = "https://image.flaticon.com/icons/svg/1642/1642658.svg";
		this.img = getImageFromURL(url,this.name);	
	}

	//Override of Bullethit. Removed timer. Cannonball lasts until you use it or replace it.
	onBulletHit(tank){
		
		this.maze.removePowerup(this);
		this.tank=tank;
		tank.removeAllPowerups();
		tank.addPowerup(this);
	}

	effect(tank){

		tank.special = function(){
			this.fire();
			var cannonball = this.bullets[this.bullets.length-1];
			cannonball.radius=20;
			cannonball.handleMovement = function(){
				this.x+=this.direction[0];
				this.y+=this.direction[1];
	
				if(	this.x > canvas.width+this.radius
				||	this.x < 0 - this.radius
				|| 	this.y > canvas.height*4/5 + this.radius
				||	this.y < 0 - this.radius
				)
				this.tank.removeBullet(this);
				
			}

			this.special=function(){};
			this.removeAllPowerups();
		}


	}

	undo(tank){
		tank.special = function(){};
	}
}

class InvisibilityPowerup extends Powerup{

	constructor(maze,x,y){
		super(maze,x,y);
		this.name = "Invisibility";
		this.color = "grey";
		var url = "https://image.flaticon.com/icons/svg/1642/1642662.svg";
		this.img = getImageFromURL(url,this.name);
	}

	effect(tank){

			tank.old_draw = tank.draw; 
			tank.draw = function(){this.bullets.forEach(function(e){e.draw();})}
			tank.special = tank.old_draw;

	}

	undo(tank){
		tank.draw=tank.old_draw;
	}
}

class ShinraTenseiPowerup extends Powerup{

	constructor(maze,x,y){
		super(maze,x,y);
		this.name = "Shinra Tensei";
		this.color = "purple";
		var url = "https://image.flaticon.com/icons/svg/56/56205.svg";
		this.img = getImageFromURL(url,this.name);
		
	}

	effect(tank){
			tank.special = function(){
				this.maze.tanks.forEach(function(tank){
					ShinraTenseiPowerup.repelTank(this,tank)
					tank.bullets.forEach(function(bullet){
						ShinraTenseiPowerup.repelBullet(this,bullet);
					}.bind(this))
				}.bind(this));
			}
	}


	undo(tank){
		tank.special = function(){};
	}

	static repelTank(repeler, repelee){
		//A tank can't repel itself
		if(repeler == repelee){return} 

		var adjacent = repelee.x - repeler.x;
		var opposite = repeler.y - repelee.y;
		var hypoteneuse = Math.sqrt(adjacent**2 + opposite **2);
		var strength_of_push = 2;
		repelee.tryMovingTo([repelee.x+adjacent/hypoteneuse * strength_of_push, repelee.y-opposite/hypoteneuse * strength_of_push]);
	}

	static repelBullet(tank, bullet){
		var adjacent = bullet.x - tank.x;
		var opposite = tank.y - bullet.y;
		var hypoteneuse = Math.sqrt(adjacent**2 + opposite **2);
		var strength_of_push = 0.5;
		var new_x_speed = bullet.direction[0] + adjacent/hypoteneuse * strength_of_push;
		var new_y_speed = bullet.direction[1] - opposite/hypoteneuse * strength_of_push;
		if( (new_x_speed**2 + new_y_speed**2)> (game.bullet_speed_limit_squared) ){return;}
		bullet.direction[0]=new_x_speed;
		bullet.direction[1]=new_y_speed;
	}
}


function generatePowerup(maze){

		powerup_no = Math.floor(7 * Math.random());
		switch(powerup_no){
			case 0:
				return new TrippyPowerup(maze);
			break;
			case 1:
				return new RemoveBulletLimitPowerup(maze);
			break;
			case 2:
				return new TripleShotPowerup(maze);
			break;
			case 3:
				return new MoveThroughWallsPowerup(maze);
			case 4:
				return new TeleportPowerup(maze);
			case 5:
				return new CannonballPowerup(maze);
			case 6:
				return new ShinraTenseiPowerup(maze);
			break;
		}
} 

		