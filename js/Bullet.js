
class Bullet{


	constructor(tank,direction,x,y,radius=1){
		this.tank=tank;

		//array len-2 with x-velocity and y-velocity 
		this.direction=direction;

		//x,y are center of circle
		this.x=x;
		this.y=y;

		this.radius=radius;
		this.bounces=0;
	}

	main() {
		this.handleMovement();
		this.handleTankCollisions();
		this.handlePowerupCollisions();
		this.draw();
	}


	draw(){

	ctx.beginPath();
	ctx.fillStyle = "black";
	ctx.strokeStyle = this.tank.colour;
	ctx.lineWidth = 1;

    ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);	
    ctx.fill();  
    ctx.stroke(); 

	}

	handleMovement(){
		//Check if bullet collides with the maze i.e. the walls (first in x then y direction)
		if(!this.tank.maze.doesRectCollide([this.x-this.radius + this.direction[0],this.y-this.radius, this.radius,this.radius])){
			this.x+=this.direction[0];
		}
		else{
			this.direction[0]*=-1;
			this.bounces+=1;
		}

		if(!this.tank.maze.doesRectCollide([this.x-this.radius,this.y-this.radius + this.direction[1], this.radius,this.radius])){
			this.y+=this.direction[1];
		}
		else{
			this.direction[1]*=-1;
			this.bounces+=1;
		}
		if(this.bounces>=BOUNCE_LIMIT){this.tank.bullets.splice(this,1);}
	}

	handleTankCollisions(){
		this.tank.maze.tanks.forEach(function(tank)
			{
			if(tank.is_dead==false && (tank!=this.tank || tank.maze.game.friendly_fire==true))
				{
				var bullet_rect=[this.x-this.radius,this.y-this.radius,this.radius*2,this.radius*2];
				var tank_rect=[tank.x,tank.y,tank.width,tank.height];
				if(doRectsOverlap(tank_rect,bullet_rect))
					{
						tank.onBulletHit();
					}
				}
			}.bind(this));
	}

	handlePowerupCollisions(){
		this.tank.maze.powerups.forEach(function(powerup)
			{
				var bullet_rect=[this.x-this.radius,this.y-this.radius,this.radius*2,this.radius*2];
				var powerup_rect=[powerup.x,powerup.y,powerup.width,powerup.height];
				if(doRectsOverlap(powerup_rect,bullet_rect))
						{
							powerup.onBulletHit(this.tank);
						}
			}.bind(this)
		);
	}
}
