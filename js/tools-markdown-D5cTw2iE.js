import"./modulepreload-polyfill-B5Qt9EMX.js";const t=document.getElementById("editor"),f=document.getElementById("hl-layer"),h=document.getElementById("line-nums"),E=document.getElementById("preview");t.value=`# Welcome to Markdown Editor

## Features
- **Syntax highlighting** in the editor pane
- *Live preview* on the right
- Toolbar for common formatting

## Code Example

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}
\`\`\`

## Blockquote

> "The best way to predict the future is to invent it."
> — Alan Kay

## Table

| Language   | Type    | Rating |
|------------|---------|--------|
| JavaScript | Dynamic | ⭐⭐⭐  |
| TypeScript | Static  | ⭐⭐⭐  |
| Python     | Dynamic | ⭐⭐⭐  |

---

Happy writing! ✨
`;const r=n=>n.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");function y(n){return n=n.replace(/(\*\*\*)(.*?)\1/g,'<span class="hl-bold"><span class="hl-italic">$1$2$1</span></span>'),n=n.replace(/(\*\*)(.*?)\1/g,'<span class="hl-bold">$1$2$1</span>'),n=n.replace(/(^|[^*])(\*)([^*\n]+?)(\*)(?=[^*]|$)/g,'$1<span class="hl-italic">$2$3$4</span>'),n=n.replace(/(~~)(.*?)\1/g,'<span class="hl-strike">$1$2$1</span>'),n=n.replace(/(`+)(.*?)\1/g,'<span class="hl-code">$1$2$1</span>'),n=n.replace(/(!\[)(.*?)(\]\()(.*?)(\))/g,'<span class="hl-img">$1$2$3$4$5</span>'),n=n.replace(/(\[)(.*?)(\]\()(.*?)(\))/g,'<span class="hl-link">$1$2$3$4$5</span>'),n}function L(n){const e=n.split(`
`);let s=!1;return e.map(l=>{const i=r(l),o=l.match(/^(`{3,}|~{3,})(.*)/);if(o)return s?(s=!1,'<span class="hl-fence">'+i+"</span>"):(s=!0,'<span class="hl-fence">'+r(o[1])+'</span><span class="hl-flang">'+r(o[2].trim())+"</span>");if(s)return'<span class="hl-code">'+i+"</span>";const m=l.match(/^(#{1,6})(\s)(.*)/);if(m)return'<span class="'+["hl-h1","hl-h2","hl-h3","hl-h4","hl-h4","hl-h4"][m[1].length-1]+'">'+i+"</span>";if(/^(\*{3,}|-{3,}|_{3,})\s*$/.test(l))return'<span class="hl-hr">'+i+"</span>";if(/^>/.test(l))return'<span class="hl-quote">'+i+"</span>";if(/^\|?[\s:]*-{2,}[\s:]*\|/.test(l))return'<span class="hl-tblsep">'+i+"</span>";const c=l.match(/^(\s*)([-*+]|\d+\.)(\s)(.*)/);return c?r(c[1])+'<span class="hl-bullet">'+r(c[2])+r(c[3])+"</span>"+y(r(c[4])):y(i)}).join(`
`)}function S(n){let e=n;const s=l=>l.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");e=e.replace(/```(\w*)\n?([\s\S]*?)```/g,(l,i,o)=>"<pre><code>"+s(o.trim())+"</code></pre>"),e=e.replace(/`([^`\n]+)`/g,"<code>$1</code>"),e=e.replace(/^(#{1,6})\s+(.+)$/gm,(l,i,o)=>"<h"+i.length+">"+o+"</h"+i.length+">"),e=e.replace(/^(\*{3,}|-{3,}|_{3,})\s*$/gm,"<hr>"),e=e.replace(/^>\s?(.+)/gm,"<blockquote>$1</blockquote>"),e=e.replace(/\*\*\*(.+?)\*\*\*/g,"<strong><em>$1</em></strong>"),e=e.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>"),e=e.replace(/\*([^*\n]+)\*/g,"<em>$1</em>"),e=e.replace(/~~(.+?)~~/g,"<del>$1</del>"),e=e.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,'<img src="$2" alt="$1">'),e=e.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank">$1</a>'),e=e.replace(/^\|(.+)\|\s*\n\|[-| :]+\|\s*\n((?:\|.+\|\s*\n?)+)/gm,(l,i,o)=>{const m=i.split("|").filter(d=>d.trim()).map(d=>"<th>"+d.trim()+"</th>").join(""),c=o.trim().split(`
`).map(d=>"<tr>"+d.split("|").filter((I,k,H)=>k>0&&k<H.length-1).map(I=>"<td>"+I.trim()+"</td>").join("")+"</tr>").join("");return"<table><thead><tr>"+m+"</tr></thead><tbody>"+c+"</tbody></table>"}),e=e.replace(/((?:^[ \t]*[-*+] .+\n?)+)/gm,l=>"<ul>"+l.replace(/^[ \t]*[-*+] (.+)$/gm,"<li>$1</li>")+"</ul>"),e=e.replace(/((?:^\d+\. .+\n?)+)/gm,l=>"<ol>"+l.replace(/^\d+\. (.+)$/gm,"<li>$1</li>")+"</ol>"),e=e.replace(/\n{2,}/g,"</p><p>"),e="<p>"+e+"</p>",e=e.replace(/<p>(<\/?(?:h[1-6]|ul|ol|pre|blockquote|table|hr)[^>]*>)/g,"$1"),e=e.replace(/(<\/(?:h[1-6]|ul|ol|pre|blockquote|table)|<hr>)<\/p>/g,"$1"),e=e.replace(/<p>\s*<\/p>/g,""),E.innerHTML=e}function w(){f.scrollTop=t.scrollTop,f.scrollLeft=t.scrollLeft,h.scrollTop=t.scrollTop}t.addEventListener("scroll",w);function a(){const n=t.value;f.innerHTML=L(n)+`
`,S(n);const e=n.split(`
`).length;h.innerHTML=Array.from({length:e},(l,i)=>`<div>${i+1}</div>`).join("");const s=n.trim()?n.trim().split(/\s+/).length:0;document.getElementById("st-words").textContent=s+" word"+(s!==1?"s":""),document.getElementById("st-chars").textContent=n.length+" chars",document.getElementById("st-lines").textContent=e+" lines",w()}t.addEventListener("input",a);function v(){const n=t.value.substring(0,t.selectionStart),e=n.split(`
`).length,s=n.split(`
`).pop().length+1;document.getElementById("st-cursor").textContent="Ln "+e+", Col "+s}t.addEventListener("keyup",v);t.addEventListener("click",v);t.addEventListener("keydown",n=>{if(n.key!=="Tab")return;n.preventDefault();const e=t.selectionStart,s=t.selectionEnd;t.value=t.value.substring(0,e)+"  "+t.value.substring(s),t.selectionStart=t.selectionEnd=e+2,a()});function x(n){document.body.className="mode-"+n,["edit","split","preview"].forEach(e=>document.getElementById("btn-"+e).classList.toggle("active",e===n))}function M(n,e){const s=t.selectionStart,l=t.selectionEnd,i=t.value.substring(s,l)||"text";t.value=t.value.substring(0,s)+n+i+e+t.value.substring(l),t.selectionStart=s+n.length,t.selectionEnd=s+n.length+i.length,t.focus(),a()}function W(n){const e=t.selectionStart,l=t.value.substring(0,e).lastIndexOf(`
`)+1;t.value=t.value.substring(0,l)+n+t.value.substring(l),t.selectionStart=t.selectionEnd=e+n.length,t.focus(),a()}function B(n){const e=t.selectionStart;t.value=t.value.substring(0,e)+n+t.value.substring(e),t.selectionStart=t.selectionEnd=e+n.length,t.focus(),a()}function _(){const n=t.selectionStart,e=t.selectionEnd,l="```js\n"+(t.value.substring(n,e)||"code here")+"\n```";t.value=t.value.substring(0,n)+l+t.value.substring(e),t.focus(),a()}function j(){B(`
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Cell     | Cell     | Cell     |
`)}const p=document.getElementById("divider"),C=document.getElementById("main"),g=document.getElementById("editor-wrap"),T=document.getElementById("preview");let u=!1,$=0,b=0;p.addEventListener("mousedown",n=>{u=!0,$=n.clientX,b=g.getBoundingClientRect().width,p.classList.add("dragging"),document.body.style.cursor="col-resize",document.body.style.userSelect="none",n.preventDefault()});document.addEventListener("mousemove",n=>{if(!u)return;const e=C.getBoundingClientRect().width-p.offsetWidth,s=n.clientX-$;let l=b+s;l=Math.max(80,Math.min(e-80,l)),g.style.flex="none",g.style.width=l+"px",T.style.flex="1"});document.addEventListener("mouseup",()=>{u&&(u=!1,p.classList.remove("dragging"),document.body.style.cursor="",document.body.style.userSelect="")});try{typeof t<"u"&&(window.editor=t),typeof f<"u"&&(window.hlLayer=f),typeof h<"u"&&(window.lineNums=h),typeof E<"u"&&(window.preview=E),typeof r<"u"&&(window.esc=r),typeof y<"u"&&(window.inlineHL=y),typeof L<"u"&&(window.highlight=L),typeof S<"u"&&(window.renderPreview=S),typeof w<"u"&&(window.syncScroll=w),typeof a<"u"&&(window.update=a),typeof v<"u"&&(window.updateCursor=v),typeof x<"u"&&(window.setMode=x),typeof M<"u"&&(window.wrap=M),typeof W<"u"&&(window.insertLine=W),typeof B<"u"&&(window.insertSnippet=B),typeof _<"u"&&(window.insertFence=_),typeof j<"u"&&(window.insertTable=j),typeof p<"u"&&(window.divider=p),typeof C<"u"&&(window.mainEl=C),typeof g<"u"&&(window.editorWrap=g),typeof T<"u"&&(window.previewEl=T),typeof u<"u"&&(window.dragging=u),typeof $<"u"&&(window.startX=$),typeof b<"u"&&(window.startEditorW=b)}catch{}
