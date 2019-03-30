# Image Tune
Image Tune takes image files and handles resize and conversion in the browser prior to upload, saving server processing time and storage space while reducing upload times.

Now you're users can upload large images from modern smartphones or DSLR cameras quickly and efficiently as the client handles the conversion of the image to a web-appropriate size. Perfect for user profiles, social media images and more.

## Usage
```
var ImageTune = require('imagetune');
document.getElementById("image-file").addEventListener("change", function(evt) {
  var file = evt.target.files[0];
  var options = {
    type: 'png', 
    quality: 80, 
    height: 250, 
    width: 250
  };
  ImageTune.tune(file, options).then(function (imageData) {
    document.body.getElementById("image-data").setAttribute("value", imageData);
  });
});
```