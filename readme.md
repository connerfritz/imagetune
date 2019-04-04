# Image Tune
Image Tune takes image files and handles resize and conversion in the browser prior to upload, saving server processing time and storage space while reducing upload times.

Now you're users can upload large images from modern smartphones or DSLR cameras quickly and efficiently as the client handles the conversion of the image to a web-appropriate size. Perfect for user profiles, social media images and more.

Example: https://connerfritz.github.io/imagetune/

## Installation
For npm
```
npm install -s imagetune
```
For Yarn
```
yarn add imagetune
```


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

## Options
| Name    | Description                                    | Default |
|---------|------------------------------------------------|---------|
| width   | Desired width of result image in pixels        | 200     |
| height  | Desired height of result image in pixels       | 200     |
| quality | Image quality value, changes file size (1-100) | 100     |
| type    | Image format type (png, jpg, gif)              | jpg     |
| mode    | Scale mode (crop or scale)                     | scale   |
