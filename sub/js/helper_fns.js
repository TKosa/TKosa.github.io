//rect=[x,y,width,height]
var doRectsOverlap = function(rect1,rect2){
	//check if rect1 is strictly to the left, to the right, above, or below rect2. If not, they overlap.
	if(rect1[0]+rect1[2]<rect2[0]){return false;}
	if(rect1[0]>rect2[0]+rect2[2]){return false;}
	if(rect1[1]+rect1[3]<rect2[1]){return false;}
	if(rect1[1]>rect2[1]+rect2[3]){return false;}
	return true;
}

/*
Takes a colour string and returns the next color. First Colour is #000000
Colors in specific precisions are equally spaced, and precision increases by a constant factor after iterating over all colours of lower precisions.

E.g. If this function was nextNumber, and returned a number in [0,1], the series would be 
0,0.5,  0.25,0.75,  0.125,0.375,0.625,0.875, ...
or 
0/2,1/2,  1/4,3/4, 1/8,3/8,5/8,7/8, 1/16,3/16... 
so getting calling nextNumber 16 times would result in 16 equally spaced numbers 
*/
function nextColor(color){

} 

