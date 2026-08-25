import"./modulepreload-polyfill-B5Qt9EMX.js";import*as b from"https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs";b.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";const m=document.getElementById("pdfInput"),i=document.getElementById("output"),u=document.getElementById("fileName"),n=document.getElementById("status"),d=document.getElementById("downloadButton"),c=document.getElementById("clearButton");let p="";function g(e){return e.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}function v(){i.innerHTML=`
        <div class="empty-state">
          <div>
            <strong>No PDF converted yet</strong>
            <p>Choose a PDF file to extract its text.</p>
          </div>
        </div>
      `}function h(){m.value="",u.textContent="No file selected",p="",v(),d.disabled=!0,c.disabled=!0,n.textContent="The PDF is processed locally in your browser.",n.classList.remove("error")}function y(e,o){const t=e.map((a,s)=>`
          <section class="pdf-page">
            <div class="page-number">Page ${s+1}</div>
            <p class="page-text">${g(a)}</p>
          </section>
        `).join("");return`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${g(o)}</title>
  <style>
    body {
      max-width: 850px;
      margin: 40px auto;
      padding: 0 20px;
      color: #111827;
      font-family: Arial, sans-serif;
      line-height: 1.6;
    }

    .pdf-page {
      margin-bottom: 40px;
      padding-bottom: 30px;
      border-bottom: 1px solid #d1d5db;
    }

    .page-number {
      margin-bottom: 16px;
      color: #6b7280;
      font-size: 0.85rem;
      font-weight: bold;
      text-transform: uppercase;
    }

    .page-text {
      white-space: pre-wrap;
      font-family: Georgia, "Times New Roman", serif;
    }
  </style>
</head>
<body>
${t}
</body>
</html>`}m.addEventListener("change",async()=>{const e=m.files[0];if(!e){h();return}if(!(e.type==="application/pdf"||e.name.toLowerCase().endsWith(".pdf"))){n.textContent="Please select a valid PDF file.",n.classList.add("error");return}try{u.textContent=e.name,n.textContent="Converting PDF...",n.classList.remove("error"),d.disabled=!0,c.disabled=!0;const t=await e.arrayBuffer(),a=await b.getDocument({data:t}).promise,s=[];i.innerHTML="";for(let r=1;r<=a.numPages;r++){const f=(await(await a.getPage(r)).getTextContent()).items.map(x=>x.str).join(" ").replace(/\s+/g," ").trim();s.push(f||"[No selectable text found on this page]");const l=document.createElement("section");l.className="pdf-page",l.innerHTML=`
            <div class="page-number">Page ${r}</div>
            <p class="page-text"></p>
          `,l.querySelector(".page-text").textContent=f||"[No selectable text found on this page]",i.appendChild(l)}p=y(s,e.name.replace(/\.pdf$/i,"")),n.textContent=`Converted ${a.numPages} page${a.numPages===1?"":"s"}.`,d.disabled=!1,c.disabled=!1}catch(t){console.error(t),i.innerHTML=`
          <div class="empty-state">
            <div>
              <strong>Conversion failed</strong>
              <p>The selected file could not be read as a PDF.</p>
            </div>
          </div>
        `,n.textContent="Unable to convert this PDF.",n.classList.add("error")}});d.addEventListener("click",()=>{if(!p)return;const e=new Blob([p],{type:"text/html;charset=utf-8"}),o=URL.createObjectURL(e),t=document.createElement("a");t.href=o,t.download=`${u.textContent.replace(/\.pdf$/i,"")}.html`,t.click(),URL.revokeObjectURL(o)});c.addEventListener("click",h);
