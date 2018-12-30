//ctx must be defined

class Tank
{


	//controls = [up,right,down,left,fire,special] e.g. ['a',"ArrowRight"]
	constructor(x,y,maze,controls,colour="black")
		{
		this.x=x;
		this.y=y;
		this.controls=controls;
		this.colour=colour;
		this.maze=maze;
		maze.tanks.push(this);

		this.width=maze.width/maze.num_of_columns/3;
		this.height=maze.height/maze.num_of_rows/3;
		this.rotation=0; //pointing straight up
		this.bullets=[];
		this.score=0;
		this.is_dead=false;

		var o=this.maze.squares[0][0];
		this.move_speed=MOVE_SPEED *Math.min(o.width,o.height)/60;
		this.rotation_speed=ROTATION_SPEED;
		

		this.upPressed=false;
		this.rightPressed=false;
		this.downPressed=false;
		this.leftPressed=false;
		this.shooting=false;


		document.addEventListener("keydown", this.keyDownHandler.bind(this), false);
		document.addEventListener("keyup", this.keyUpHandler.bind(this), false);
		document.addEventListener("keypress",this.keyPressHandler.bind(this),false);

		}


	draw()
		{
		//Draw and progress bullets. IF tank is alive THEN draw and progress tank.
		this.handleBullets();
		this.bullets.forEach(function(e){e.draw();})
		if(this.is_dead){return;}
		this.handleMovement();
		
		//Drawing
		ctx.save();
		ctx.translate( this.x+this.width/2, this.y+this.height/2 );
		ctx.rotate(this.rotation);

		//drawing with img loaded instead of tank
		if(this.hasOwnProperty("img"))
			{
			ctx.drawImage(this.img,-this.width/2,-this.height/2,this.width,this.height);
			}

		else{
			ctx.fillStyle=this.colour;
			ctx.fillRect(-this.width/2,-this.height/2,this.width,this.height);
			ctx.fillRect(-this.width/10,0,this.width/5,-this.height/1.2)
			}
			ctx.restore();
		
		}
	

	handleBullets()
		{
		if(this.shooting){
			this.shooting=false;
			var x_vel = BULLET_SPEED*Math.sin(this.rotation);
			var y_vel = BULLET_SPEED*-Math.cos(this.rotation);
			//x,y _pos are at tip of the cannon
			var x_pos = this.x+this.width/2 + Math.sin(this.rotation)*this.height;
			var y_pos = this.y+this.height/2 + Math.cos(this.rotation)*-this.height;
			var new_bullet = new Bullet(this,[x_vel,y_vel],x_pos,y_pos);
			this.bullets.push(new_bullet);
			}
		}
	

	//Called every iteration of draw. Checks to see if buttons are pressed and moves tank accordingly.
	handleMovement()
		{
		var x=this.x;
		var y=this.y;
		var ms=this.move_speed;

		//Attempts to move in x and y directions seperately. This means if tank is driving into wall at an angle, it will move parrallel to wall.
		if(this.upPressed)
			{
			this.tryMovingTo([this.x+this.move_speed*Math.sin(this.rotation),this.y]);
			this.tryMovingTo([this.x,this.y-this.move_speed*Math.cos(this.rotation)]);
			}
		if(this.rightPressed){this.rotation+=this.rotation_speed;}
		if(this.downPressed)
			{
			this.tryMovingTo([this.x-this.move_speed*Math.sin(this.rotation),this.y]);
			this.tryMovingTo([this.x,this.y+this.move_speed*Math.cos(this.rotation)]);
			}
		if(this.leftPressed){this.rotation-=this.rotation_speed;}
		}
	

	//Helper for handleMovement(). Tries to move the tank to x,y. Will fail if maze.doesRectCollide(tank) returns false.
	tryMovingTo(pos)
		{
		var x = pos[0];
		var y = pos[1];

		if(!this.maze.doesRectCollide([x,y,this.width,this.height]))
			{
			this.x=x;
			this.y=y;
			}
		}
	

	keyPressHandler(e)
		{
		if(e.key == this.controls[4]){this.shooting=true;}
		}
	

	keyDownHandler(e)
		{
	
		if(e.key == this.controls[0]){this.upPressed=true;}
		if(e.key == this.controls[1]){this.rightPressed=true;}
		if(e.key == this.controls[2]){this.downPressed=true;}
		if(e.key == this.controls[3]){this.leftPressed=true;}

		}
	

	keyUpHandler(e)
		{

		if(e.key == this.controls[0]){this.upPressed=false;}
		if(e.key == this.controls[1]){this.rightPressed=false;}
		if(e.key == this.controls[2]){this.downPressed=false;}
		if(e.key == this.controls[3]){this.leftPressed=false;}

		}
	

	loadImage(img_element)
		{
		this.img=img_element;
		}
	//Legacy code, may be used for buffs/debuffs
	

	originalMovement()
		{
		var x=this.x;
		var y=this.y;
		var ms=this.move_speed;

		if(this.upPressed){this.tryMovingTo([this.x,this.y-this.move_speed]);}
		if(this.rightPressed){this.tryMovingTo([this.x+this.move_speed,this.y]);}
		if(this.downPressed){this.tryMovingTo([this.x,this.y+this.move_speed]);}
		if(this.leftPressed){this.tryMovingTo([this.x-this.move_speed,this.y]);}
		}
	

	destroy()
		{
		this.is_dead=true;
		this.maze.tankDestroyed();
		}


}
