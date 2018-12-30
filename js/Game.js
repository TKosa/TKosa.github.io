
//Settings
var num_of_rows = 6;
var num_of_columns = 7; 
var wall_thiccness=4;
var MOVE_SPEED=3;
var ROTATION_SPEED=9/100;
var BULLET_SPEED=3;
var PREGAME_BORDER_WIDTH = 5;
var SECONDS_BETWEEN_ROUNDS = 3;
var FRIENDLY_FIRE = false;
var BOUNCE_LIMIT = 7;
var POWERUP_INTERVAL = 10000;
var POWERUP_LIMIT = 7;



//Global variables
var canvas = document.getElementById("myCanvas");
var ctx = canvas.getContext("2d");
var pregame = new Pregame(canvas.height*3/4);
var main_object = pregame;





function draw()
{
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	main_object.draw();
 	requestAnimationFrame(draw);
};


function main()
{

canvas.addEventListener('click', function(event) 
	{
    var x = event.pageX - canvas.offsetLeft,
        y = event.pageY - canvas.offsetTop;

   	pregame.onclick(x,y);

	}, false);

addEventListener("keydown",function(event)
	{
		pregame.handleKeydown(event.key);
	},false);



draw();
};
main();
