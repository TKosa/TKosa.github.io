// rect = [x, y, width, height]
export function doRectsOverlap(rect1, rect2){
  // Check if rect1 is strictly to the left, right, above, or below rect2. If not, they overlap.
  if (rect1[0] + rect1[2] < rect2[0]) { return false; }
  if (rect1[0] > rect2[0] + rect2[2]) { return false; }
  if (rect1[1] + rect1[3] < rect2[1]) { return false; }
  if (rect1[1] > rect2[1] + rect2[3]) { return false; }
  return true;
};

export function getImageFromURL(url, id){
  var img = document.getElementById(id);
  // If image isn't saved locally, try getting it by URL. This is basically an excuse to have the URL somewhere in the code, giving credit to img authors.
  if (img == null){
    img = document.createElement("img");
    img.setAttribute('id', id);
    img.setAttribute('src', url);
    img.setAttribute('style', 'display:none');
    document.body.appendChild(img);
  }
  return img;
}

export function removeElementFromArray(element, array){
  if (!array || !Array.isArray(array)) { return; }
  const idx = array.indexOf(element);
  if (idx >= 0) {
    array.splice(idx, 1);
  }
}

export function shuffle(array){
  var tmp=[];
  var src = array.slice();
  while(src.length>0){
    var rnd=Math.floor(Math.random()*src.length);
    tmp.push(src[rnd]);
    src.splice(rnd,1);
  }
  return tmp;
}
