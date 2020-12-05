ebookjs
=====

A library for easy reading of ebook files. Currently only supports reading .epub files.

This library is solely focused on reading files and returning objects you can work with, there is no GUI reader functionality currently or planned. However, it is very simple to make your own with what ebookjs gives you; there is a simple VueJS example at the end of this readme.

Install
-----
```npm install ebookjs```

Usage
-----

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

**metadata** : Object with all metadata entries. Only *title*, *identifier*, and *language* are guaranteed to be non-null. Typically also includes information like *creator*, *publisher*, *date*, etc. Values are either Strings or arrays of Strings. Array of Strings happens when a metadata tag is specified multiple times, for example ```metadata.subject == ['Non-fiction', 'Biology']```

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

VueJS ebook reader implementation
-----
Below is a way you might use ebookjs and VueJS to create an online ebook reader. From there, it's up to you what other features to provide, how to lay it out, etc.
```html
<div class="reader">
    <!-- Basic chapter navigation; arrows and dropdown list -->
    <div class="chapter-nav" v-if="chapters && chapters[index]">
      <div class="arrow btn" :class="{'disabled': index == 0}" @click="index--">Previous Chapter</div>
      <select v-model="index" style="max-width:30%;margin: 0px 20px;">
        <option v-for="(ch,i) in chapters" :key="ch" :value="i">{{i+1}}. {{ch.name}}</option>
      </select>
      <div class="arrow btn" :class="{'disabled': index + 1 >= chapters.length}" @click="index++">Next Chapter</div>
    </div>
    <!-- v-html using the .html field shows properly formatted chapter content -->
    <div class="chapter-content" v-if="chapters && chapters[index]" v-html="chapters[index].html.documentElement.innerHTML" />
  </div>
  ```
