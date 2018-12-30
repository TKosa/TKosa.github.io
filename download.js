var download = function (url) {
	var a= document.createElement("a");
	a.href=url;
	a.download=url;
	a.click()
}
$$(".has_imageurl").forEach(function(ele){url=ele.getAttribute("data-imageurl");if(url.endsWith("jpg")||url.endsWith("png")){download(url)}});
