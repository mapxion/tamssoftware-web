
const toggle=document.querySelector('.menu-toggle');const menu=document.querySelector('.menu');if(toggle){toggle.addEventListener('click',()=>{menu.classList.toggle('open');toggle.setAttribute('aria-expanded',menu.classList.contains('open'))});}
document.querySelectorAll('.video-placeholder').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.dataset.youtube;const iframe=document.createElement('iframe');iframe.src=`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`;iframe.title=btn.dataset.title||'Vídeo de TAMS';iframe.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';iframe.allowFullscreen=true;iframe.style.cssText='width:100%;height:100%;border:0;position:absolute;inset:0';btn.replaceChildren(iframe)}));
const dialog=document.querySelector('#image-dialog');document.querySelectorAll('.zoomable').forEach(img=>img.addEventListener('click',()=>{document.querySelector('#dialog-image').src=img.dataset.full||img.src;document.querySelector('#dialog-image').alt=img.alt;dialog.showModal()}));document.querySelector('.close-dialog')?.addEventListener('click',()=>dialog.close());dialog?.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
const form=document.querySelector('#contact-form');if(form){form.addEventListener('submit',e=>{e.preventDefault();const d=new FormData(form);const subject=encodeURIComponent('Consulta TAMS - '+(d.get('empresa')||d.get('nombre')));const body=encodeURIComponent(`Nombre: ${d.get('nombre')}
Empresa: ${d.get('empresa')}
Email: ${d.get('email')}
Teléfono: ${d.get('telefono')}
Interés: ${d.get('interes')}

Mensaje:
${d.get('mensaje')}`);location.href=`mailto:soporte@tamssoftware.es?subject=${subject}&body=${body}`})}
