class Square{
	constructor(maze,row,col){
		this.maze=maze;
		this.row=row;
		this.col=col;
		this.north=true;
		this.east=true;
		this.south=true;
		this.west=true;
		this.colour="black";
		
	
		this.width=maze.width/maze.num_of_columns;
		this.height=maze.height/maze.num_of_rows;
		this.wall_thiccness=maze.wall_thiccness;

		//top left corner
		this.x=this.col*this.width;
		this.y=this.row*this.height;
	}


	draw(){
		//local aliases for legibility
		ctx.fillStyle=this.colour;
		this.getWalls().forEach(function(e){
			ctx.fillRect(e[0],e[1],e[2],e[3]);
		});
	}


	removeBorder(square){

		if(this.row==square.row){
			if(this.col==square.col-1){
				this.east=false;
				square.west=false;
			}
			if(this.col==square.col+1){
				this.west=false;
				square.east=false;
			}
		}

		if(this.col==square.col){	
			if(this.row==square.row-1){
				this.south=false;
				square.north=false;
			}
			if(this.row==square.row+1){
				this.north=false;
				square.south=false;
			}
		}
	}


	//Returns neighbouring squares
	getNeighbours(){	
		var neighbours=[]
		if(this.col>0){neighbours.push(this.maze.squares[this.row][this.col-1]);}
		if(this.col<this.maze.num_of_columns-1){neighbours.push(this.maze.squares[this.row][this.col+1]);}
		if(this.row>0){neighbours.push(this.maze.squares[this.row-1][this.col]);}
		if(this.row<this.maze.num_of_rows-1){neighbours.push(this.maze.squares[this.row+1][this.col]);}

		return neighbours;
	}


	//returns [x,y]
	getCenter(){
		return [ (this.col+1/2)*this.width , (this.row+1/2)*this.height ]
	}


	//returns list of walls (rectangles [x,y,width,height])
	getWalls(){
		var w=this.width;
		var h=this.height;
		var wt=this.wall_thiccness;

		var walls=[];
		if (this.north)walls.push([this.x,this.y,this.width,this.wall_thiccness]);
		if (this.west) walls.push([this.x,this.y,wt,h]);
		if(this.east)  walls.push([this.x+w,this.y,wt,h]);
		if(this.south) walls.push([this.x,this.y+h,w+wt,wt]);

		return walls;
	}
	
}

//Helper Fns
var shuffle=function(array){

	var tmp=[];
	while(array.length>0){
		var rnd=Math.floor(Math.random()*array.length);
		tmp.push(array[rnd]);
		array.splice(rnd,1);			
	}
	return tmp;
}


