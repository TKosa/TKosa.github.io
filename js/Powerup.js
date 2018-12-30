class Powerup
{
	constructor(maze,x,y)
	{
		this.x=x;
		this.y=y;
		this.width=10;
		this.height=10;
		this.maze=maze;
		


	}

	effect(tank)
	{
		tank.maze.message="powerup";

	}

	draw()
	{
		ctx.strokeStyle="red";
		ctx.strokeRect(this.x,this.y,this.width,this.width);

	}
}