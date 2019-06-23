//ctx must be defined

class Tank{

	//controls = [up,right,down,left,fire,special] e.g. ['a',"ArrowRight"]
	constructor(x,y,maze,controls,colour="black"){
		this.x=x;
		this.y=y;
		this.controls=controls;
		this.colour=colour;
		this.maze=maze;
		maze.tanks.push(this);
		this.powerups = [];

		this.width=maze.width/maze.num_of_columns/3;
		this.height=maze.height/maze.num_of_rows/3;
		this.rotation=0; //pointing straight up
		this.bullets=[];
		this.bullet_limit=game.bullet_limit;
		this.bounce_limit=game.bounce_limit;
		this.score=0;
		this.is_dead=false;
		

		var o=this.maze.squares[0][0];
		this.move_speed=maze.game.move_speed*Math.min(o.width,o.height)/60;
		this.rotation_speed=game.rotation_speed;
		

		this.upPressed=false;
		this.rightPressed=false;
		this.downPressed=false;
		this.leftPressed=false;
		this.shooting=false;
		this.special = function(){};

		//this.img = document.getElementById('tank');


		document.addEventListener("keydown", this.keyDownHandler.bind(this), false);
		document.addEventListener("keyup", this.keyUpHandler.bind(this), false);
		

	}

	main() {
		if(this.is_dead){return;}

		if(this.shouldFire()){ this.fire(); }
		this.shooting=false;

		if(this.specialKeyPressed){
			this.special();
		}
		this.bullets.forEach(function(bullet){bullet.main();})

		this.handleMovement();

		this.draw();
	}

	draw(){
		this.bullets.forEach(function(e){e.draw();})
		
		//Drawing
		ctx.save();
		ctx.translate( this.x+this.width/2, this.y+this.height/2 );
		ctx.rotate(this.rotation);

		//drawing with img loaded instead of tank
		if(this.hasOwnProperty("img")){
			ctx.drawImage(this.img,-this.width/2,-this.height/2,this.width,this.height);
		}

		else{
			ctx.fillStyle=this.colour;
			ctx.fillRect(-this.width/2,-this.height/2,this.width,this.height);
			ctx.fillRect(-this.width/10,0,this.width/5,-this.height/1.2)
		}
		ctx.restore();
	}
	
	shouldFire(){
		if (this.shooting && this.bullets.length<this.bullet_limit) {return true;}
		else {return false;}
	}

	fire(){
		this.fire_helper(this.rotation, game.bullet_speed);
	}

	fire_helper(rotation, speed){

		var x_vel = speed*Math.sin(rotation);
		var y_vel = speed*-Math.cos(rotation);			//x,y _pos are at base of the cannon (i.e. not the tip)
		var x_pos = this.x+this.width/2 + Math.sin(this.rotation)*this.height/2;
		var y_pos = this.y+this.height/2 + Math.cos(this.rotation)*-this.height/2;
		
		var new_bullet = new Bullet(this,[x_vel,y_vel],x_pos,y_pos);			
		this.bullets.push(new_bullet);
			
	}
	
	//Called every iteration of draw. Checks to see if buttons are pressed and moves tank accordingly.
	handleMovement(){
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
	tryMovingTo(pos){
		
		//If we are currently in invalid position, move to valid one 
		if(this.maze.doesRectCollide([this.x,this.y,this.width,this.height])){
			var curpos = [this.x,this.y];
			var center = this.maze.getSquareAtXY(curpos).getCenter();
			this.x = center[0];
			this.y = center[1];
			return 
		}

		if(!this.maze.doesRectCollide([pos[0],pos[1],this.width,this.height])){
			this.x=pos[0];
			this.y=pos[1];
		}

		//If the position isn't valid try only moving in the x-component. If fail try y-component.
		else{

			if(!this.maze.doesRectCollide([pos[0],this.y,this.width,this.height])){
			this.x=pos[0];
			return;
			}

			if(!this.maze.doesRectCollide([this.x,pos[1],this.width,this.height])){
			this.y=pos[1];
			return;
			}
				
		}
	}

	
	keyDownHandler(e){

		if(e.key == this.controls[0]){this.upPressed=true;}
		if(e.key == this.controls[1]){this.rightPressed=true;}
		if(e.key == this.controls[2]){this.downPressed=true;}
		if(e.key == this.controls[3]){this.leftPressed=true;}
		if(e.key == this.controls[4]){this.shooting=true;}
		if(e.key == this.controls[5]){this.specialKeyPressed=true;}
	}
	
	keyUpHandler(e){

		if(e.key == this.controls[0]){this.upPressed=false;}
		if(e.key == this.controls[1]){this.rightPressed=false;}
		if(e.key == this.controls[2]){this.downPressed=false;}
		if(e.key == this.controls[3]){this.leftPressed=false;}
		if(e.key == this.controls[4]){this.shooting=false;}
		if(e.key == this.controls[5]){
			this.specialKeyPressed=false;
			//For single click powerups where holding the powerup key down would be problematic, using it locks it, and releasing the key unlocks it.
			this.poweruplock=false;
		}

	}
	
	loadImage(img_element){
		this.img=img_element;
	}
	//Legacy code, may be used for buffs/debuffs
	

	originalMovement(){
		var x=this.x;
		var y=this.y;
		var ms=this.move_speed;

		if(this.upPressed){this.tryMovingTo([this.x,this.y-this.move_speed]);}
		if(this.rightPressed){this.tryMovingTo([this.x+this.move_speed,this.y]);}
		if(this.downPressed){this.tryMovingTo([this.x,this.y+this.move_speed]);}
		if(this.leftPressed){this.tryMovingTo([this.x-this.move_speed,this.y]);}
	}
	
	onBulletHit(){
		this.destroy();
	}

	destroy(){
		this.is_dead=true;
		this.maze.tankDestroyed();
	}

	restart(){

		this.is_dead=false;
		var pos = this.maze.getRandomSquare().getCenter();
		this.x=pos[0];
		this.y=pos[1];
		this.bullets=[];
		this.shooting=false;

		this.removeAllPowerups();
	}

	addPowerup(powerup){
		this.powerups.push(powerup);
		powerup.effect(this);
	}

	removePowerup(powerup){
		var index = this.powerups.indexOf(powerup);
		if(index == -1){return;}
		powerup.undo(this);
		this.powerups.splice(this.powerups.indexOf(powerup),1);
	}

	removeAllPowerups(){
		this.powerups.forEach(function(powerup){
			powerup.tank.removePowerup(powerup);
		});
	}

	removeBullet(bullet){
		removeElementFromArray(bullet,this.bullets);
	}
}
