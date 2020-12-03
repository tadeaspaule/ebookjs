ebookjs
=====

A library for easy reading of ebook files. Currently only supports reading .epub files.

This library is solely focused on reading files and returning objects you can work with, there is no GUI reader functionality currently or planned.

Below is a simple example

```html
<input id="upload" type="file" accept=".epub" size="1">
<script>
import ebookjs from 'ebookjs'
function handleFileSelect (evt) {
  ebookjs.fileToContent(evt.target.files[0]).then(content => {
    processChapters(content.chapters) // do whatever you want
  })
}

document.getElementById('upload').addEventListener('change', handleFileSelect, false);
</script>
```

fileToContent
-----
fileToContent returns an object of type EbookContent, which has the following fields:

**chapters** : List of chapters. Structure of chapters described below

**stylesheets** : Object where keys are stylesheet filenames, values are text contents

**images** : Object where keys are image filenames, values are dataURLs (so you can use ```<img :src="data.images[filename]"```)

**metadata** : Object with the following self-explanatory fields: *author, name, publisher, description, language*. Only *name* and *language* are guaranteed to be non-null

Chapters
-----
Note that a chapter can also represent files like the Table of Contents, Preface, Introduction etc (it's all ```.html``` and ```.xhtml``` files packaged in the epub)

Type is EbookChapter. Chapters have the following fields:

**name** : Name of the chapter

**filename** : Name of file containing the chapter

**html** : [HTMLDocument](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDocument) object of the original file's html. You can do look-ups like ```chapter.html.getElementsByTagName("p")```

**text**: Text content of the file. Note that right now this is recieved by reading ```innerText``` of the ```<body>``` tag, so whitespace might be messy in some cases

To-do list
-----
1. Support for other filetypes, especially ```.mobi```
2. Fixing bugs and edge/cases if any arise

Please do open pull requests if you improve this, I can't say how much time I will have for maintaining and improving this
