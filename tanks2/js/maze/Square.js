import { shuffle } from '../helper_fns.js';

export class Square{
    constructor(maze,row,col){
        this.maze=maze;
        this.row=row;
        this.col=col;
        this.north=null;
        this.east=null;
        this.south=null;
        this.west=null;
        
        var rect = this.maze.getCellRect(row, col);
        this.width = rect.width;
        this.height = rect.height;
        this.wall_thiccness=maze.wall_thiccness;

        //top left corner from integer-aligned grid
        this.x = rect.x;
        this.y = rect.y;

        this.visited = false;
    }

    draw() { /* no-op; background prerendered */ }

    // drawBackground removed; handled during Maze.prerenderBackground()

    removeBorder(square){

        if(this.row==square.row){
            if(this.col==square.col-1){
                if (this.east) this.east.isActive = false;
                if (square.west) square.west.isActive = false;
            }
            if(this.col==square.col+1){
                if (this.west) this.west.isActive = false;
                if (square.east) square.east.isActive = false;
            }
        }

        if(this.col==square.col){    
            if(this.row==square.row-1){
                if (this.south) this.south.isActive = false;
                if (square.north) square.north.isActive = false;
            }
            if(this.row==square.row+1){
                if (this.north) this.north.isActive = false;
                if (square.south) square.south.isActive = false;
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
        return [ this.x + this.width/2, this.y + this.height/2 ]
    }


    // Return active wall rects for collision (canonical: east/south and borders)
    getWalls(){
        var rects = [];
        if (this.row === 0 && this.north && this.north.isActive) rects.push(this.north.getRect());
        if (this.col === 0 && this.west && this.west.isActive) rects.push(this.west.getRect());
        if (this.east && this.east.isActive) rects.push(this.east.getRect());
        if (this.south && this.south.isActive) rects.push(this.south.getRect());
        return rects;
    }

    hasActiveBorderWith(square){
        
        if(this.row==square.row){
            if(this.col==square.col+1) {return this.west;}
            if(this.col==square.col-1) {return this.east;}
        }
        if(this.col==square.col){
            if(this.row==square.row+1){return this.north}
            if(this.row==square.row-1){return this.south}
        }
        return false;
    }
    
}

// no local helpers; uses imported shuffle
