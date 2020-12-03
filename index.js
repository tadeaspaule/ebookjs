import JSZip from 'jszip'


var supportedFilesRegex = /(.html|.xhtml|.css|.png|.jpg|.jpeg)$/i
var imageRegex = /(.png|.jpg|.jpeg)$/i
var htmlRegex = /(.html|.xhtml)$/i
var stylesheetRegex = /.css$/i

function pFileReader(file, mode){
  return new Promise((resolve, reject) => {
    var fr = new FileReader();  
    fr.onload = resolve;
    fr.onerror = reject;
    if (mode == 'text') fr.readAsText(file);
    else if (mode == 'image') fr.readAsDataURL(file)
  });
}

class EbookContent {
  /**
   * @param  {EbookChapter[]} chapters - List of chapters. May contain things like Table of Contents, Preface, etc
   * @param  {Object} stylesheets - key: stylesheet filename, value: text content of stylesheet
   * @param  {Object} images - key: image filename, value: dataURL of image
   * @param  {Object} metadata - fields: author, name, publisher, description, language
   */
  constructor(chapters, stylesheets, images, metadata) {
    this.chapters = chapters
    this.stylesheets = stylesheets
    this.images = images
    this.metadata = metadata
  }
}

class EbookChapter {
  /**
   * @param  {String} name - Name of chapter. May be null if not provided
   * @param  {String} filename - Filename of chapter's html/xhtml file
   * @param  {HTMLDocument} html - content of chapter's html/xhtml file. Can query with methods like getElementsByTagName
   * @param  {String} text - text content of chapter (.innerText field of chapter's <body> tag)
   */
  constructor(name, filename, html, text) {
    this.name = name
    this.filename = filename
    this.html = html
    this.text = text
  }
}

/**
 * @param  {File} file - ebook file. For example from <input> tag evt.target.files[0]
 * @returns {EbookContent} content and metadata of ebook
 */
async function fileToContent (file) {
  // 1. read zip file (.epub files are actually zipped HTML, CSS, etc content that together makes up the book)
  var zip = await JSZip.loadAsync(file)
  var blobPromises = []
  var opfFilename = null
  if (!zip.files['META-INF/container.xml']) throw 'container.xml not found'
  // 2. read container.xml
  var containerBlob = await zip.files['META-INF/container.xml'].async("blob")
  var containerFile = await pFileReader(containerBlob,'text')
  var containerContent = containerFile.explicitOriginalTarget.result
  // 2.1 check path to .opf file. It may be in a folder, that folder name will be useful later
  var rootfileMatch = containerContent.match(/<rootfile[^>]* full-path="[^>]+.opf"/i)
  if (!rootfileMatch) throw "container.xml doesn't contain proper .opf file path"
  rootfileMatch = rootfileMatch.toString()
  var possiblePrefix = rootfileMatch.indexOf('/') > 0 ? rootfileMatch.substring(rootfileMatch.indexOf('"')+1,rootfileMatch.indexOf('/')) : ""
  // 3. read all valid files and turn into Blob type
  for (const fname in zip.files) {
    if (fname.match(supportedFilesRegex)) {
      blobPromises.push({name: fname,promise: zip.files[fname].async("blob")})
    }
    else if (fname.endsWith(".opf")) opfFilename = fname
  }
  if (!opfFilename) throw '.opf file not found'
  var blobResults = await Promise.all(blobPromises.map(pi => pi.promise))
  // 4. read .opf file for chapter order, metadata etc
  var opfBlob = await zip.files[opfFilename].async("blob")
  var opfFile = await pFileReader(opfBlob,'text')
  var opfContent = opfFile.explicitOriginalTarget.result
  // 4.1 read metadata
  var metadata = opfContent.substring(opfContent.indexOf('<metadata'),opfContent.indexOf('</metadata>'))
  var metadataObj = {}
  var metadataTags = metadata.match(/<dc:[^>]+>[^<]+<\/[^>]+>/gi)
  for (const match of metadataTags) {
    var matchStr = match.toString()
    var key = matchStr.match(/[^(>| )]+/i)
    var val = matchStr.match(/>[^<]+/i)
    if (key && val) {
      key = key.toString().substring(4)
      val = val.toString().substring(1)
    }
    if (!metadataObj[key]) metadataObj[key] = val
    else if (typeof metadataObj[key] == 'string') {
      console.log(typeof metadataObj[key])
      metadataObj[key] = [metadataObj[key],val]
    }
    else metadataObj[key].push(val)
  }
  var bookName = metadataObj.name
  // 4.2 read manifest (lists all the files contained in the package, has id to filename mapping useful later)
  var manifest = opfContent.substring(opfContent.indexOf('<manifest'),opfContent.indexOf('</manifest>'))
  var idToHref = {}
  var items = manifest.matchAll(/<item [^>]+>/gi)
  for (const match of items) {
    var href = match.toString().match(/href="[^"]+/).toString().substring(6)
    var id = match.toString().match(/id="[^"]+/).toString().substring(4)
    if (href.startsWith('../')) {
      // hrefs to files may be given in relative notation, should correct href to absolute notation before usage
      var backupCount = 0
      while (href.startsWith('../')) {
        backupCount += 1
        href = href.slice(3)
      }
      var opfPathFolders = opfFilename.split('/')
      opfPathFolders = opfPathFolders.slice(0,opfPathFolders.length-1) // gets rid of the .opf filename at the end, leaving just folder names
      if (backupCount < opfPathFolders.length) href = opfPathFolders.slice(0,opfPathFolders.length-backupCount).join('/') + `/${href}`
    }
    idToHref[id] = href
  }
  // 4.3 read spine (linear reading order of files, id mapping used here)
  var spine = opfContent.substring(opfContent.indexOf('<spine'),opfContent.indexOf('</spine>'))
  var orderedFilenames = []
  var spineItems = spine.matchAll(/<itemref [^>]+>/gi)
  for (const match of spineItems) {
    var idref = match.toString().match(/idref="[^"]+/).toString().substring(7)
    orderedFilenames.push(idToHref[idref])
  }
  // 5. parse the file contents
  var fileResults = await Promise.all(blobResults.map((r,i) => pFileReader(r, blobPromises[i].name.match(imageRegex) ? 'image' : 'text')))
  var parser = new DOMParser();
  var filenameToContent = {}
  for (var i = 0; i < fileResults.length; i++) {
    var fname = blobPromises[i].name
    if (fname.match(imageRegex)) filenameToContent[fname] = fileResults[i].target.result // image data
    else if (fname.match(htmlRegex)) {
      // html, i.e. text content
      var chapterName = null
      var htmlDoc = parser.parseFromString(fileResults[i].explicitOriginalTarget.result,"text/html")
      var body = htmlDoc.getElementsByTagName("body")
      // sometimes chapter titles are included in <title> tags in the head
      var head = htmlDoc.getElementsByTagName("head")
      if (head && head.length > 0) {
        var title = head[0].getElementsByTagName("title")
        // also need to check if <title> is not just book name
        if (title && title.length > 0 && !bookName.toLowerCase().startsWith(title[0].innerText.toLowerCase())) {
          chapterName = title[0].innerText.trim()
        }
      }
      if (!chapterName) {
        // try to find heading tags with chapter name
        for (var j = 0; j < 3; j++) {
          var tags = htmlDoc.getElementsByTagName(["h1","h2"][j])
          if (tags && tags.length > 0) {
            chapterName = tags[0].innerText.trim()
            break;
          }
        }
      }
      filenameToContent[fname] = new EbookChapter(chapterName,fname,htmlDoc,body ? body[0].innerText : null)
    }
    else filenameToContent[fname] = fileResults[i].explicitOriginalTarget.result // css
  }
  // 6. Process data into expected format (correct chapter order etc) and return
  // here possiblePrefix is used. Most books follow standard format of OEBPS but sometimes the path is different, this handles that
  var getChapterContent = (fname) => filenameToContent[fname] || filenameToContent[`OEBPS/${fname}`] || filenameToContent[`${possiblePrefix}/${fname}`]
  var chapters = orderedFilenames.map(of => getChapterContent(of))
  // 6.1 possibly add chapter names from .opf file
  var guide = opfContent.substring(opfContent.indexOf('<guide'),opfContent.indexOf('</guide>'))
  var references = guide.matchAll(/<reference [^>]+>/gi)
  for (const match of references) {
    var chapterHref = match.toString().match(/href="[^"]+/).toString().substring(6)
    var chapterContent = getChapterContent(chapterHref)
    if (chapterContent) {
      var chap = chapters.find(ch => ch.filename == chapterHref || ch.filename == `OEBPS/${chapterHref}` || ch.filename == `${possiblePrefix}/${chapterHref}`)
      if (chap) {
        var titleMatch = match.toString().match(/title="[^"]+/)
        if (titleMatch) chap.name = titleMatch.toString().substring(7)
      }
    }
  }
  // 6.2 Setup filename -> content mapping for stylesheets and images
  var stylesheets = {}
  var images = {}
  for (const fname in filenameToContent) {
    if (fname.match(imageRegex)) images[fname] = filenameToContent[fname]
    else if (fname.match(stylesheetRegex)) stylesheets[fname] = filenameToContent[fname]
  }
  return new EbookContent(chapters,stylesheets,images,metadataObj)
}
var ebookjs = {}
ebookjs.fileToContent = fileToContent
export default ebookjs;
