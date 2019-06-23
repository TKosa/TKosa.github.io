//rect=[x,y,width,height]
var doRectsOverlap = function(rect1,rect2){
	//check if rect1 is strictly to the left, to the right, above, or below rect2. If not, they overlap.
	if(rect1[0]+rect1[2]<rect2[0]){return false;}
	if(rect1[0]>rect2[0]+rect2[2]){return false;}
	if(rect1[1]+rect1[3]<rect2[1]){return false;}
	if(rect1[1]>rect2[1]+rect2[3]){return false;}
	return true;
};

function getImageFromURL(url,id){
	var img = document.getElementById(id);

	//If image isn't saved locally, try getting it by url. This is basically an excuse to have the url somewhere in the code, giving credit to img authors.
	if( img == null){
		img = document.createElement("img");
		img.setAttribute('id',name);
		img.setAttribute('src',url);
		img.setAttribute('style','display:none');
		document.body.appendChild(img);
	}
	
	return img;
}

function removeElementFromArray(element, array){
	array.splice(array.indexOf(element),1);
}

