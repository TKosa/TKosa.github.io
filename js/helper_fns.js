//rect=[x,y,width,height]
var doRectsOverlap = function(rect1,rect2){
	//check if rect1 is strictly to the left, to the right, above, or below rect2. If not, they overlap.
	if(rect1[0]+rect1[2]<rect2[0]){return false;}
	if(rect1[0]>rect2[0]+rect2[2]){return false;}
	if(rect1[1]+rect1[3]<rect2[1]){return false;}
	if(rect1[1]>rect2[1]+rect2[3]){return false;}
	return true;
}

