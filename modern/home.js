(() => {
  const selected = [1, 7, 29, 11, 13, 33, 35, 80, 112, 125, 4];
  const all = [8, ...selected];
  const key = n => `File%20${String(n).padStart(5, '0')}.jpeg`;
  const metadata = n => window.artworks[key(n)];
  const gallery = document.querySelector('#gallery');
  const more = document.querySelector('#more');
  const dialog = document.querySelector('#viewer');
  const viewerImage = document.querySelector('#viewer-art');
  const zoom = document.querySelector('#viewer-zoom');
  const stage = document.querySelector('.viewer-image');
  let current = 0, zoomed = false, offsetX = 0, offsetY = 0, drag = null, moved = false;

  selected.forEach((n, i) => {
    const data = metadata(n);
    const figure = document.createElement('figure');
    figure.className = 'work';
    figure.hidden = i >= 6;
    const button = document.createElement('button');
    button.className = 'art-open';
    button.dataset.art = n;
    button.setAttribute('aria-label', `View ${data.title}`);
    const image = document.createElement('img');
    image.src = `/images/${key(n)}`;
    image.alt = data.description;
    image.loading = 'lazy';
    image.decoding = 'async';
    const expand = document.createElement('span');
    expand.className = 'expand';
    expand.setAttribute('aria-hidden', 'true');
    expand.textContent = '↗';
    button.append(image, expand);
    const caption = document.createElement('figcaption');
    const title = document.createElement('span');
    const year = document.createElement('span');
    title.className = 'work-title';
    title.textContent = data.title;
    year.className = 'work-year';
    year.textContent = data.year;
    caption.append(title, year);
    figure.append(button, caption);
    gallery.append(figure);
  });
  more.setAttribute('aria-expanded', 'false');
  more.setAttribute('aria-controls', 'gallery');
  more.addEventListener('click', () => {
    const expanding = more.getAttribute('aria-expanded') !== 'true';
    gallery.querySelectorAll('.work').forEach((f, i) => { f.hidden = !expanding && i >= 6; });
    more.setAttribute('aria-expanded', String(expanding));
    more.innerHTML = expanding ? 'Show fewer works <span>−</span>' : 'Show all selected works <span>＋</span>';
    document.querySelector('#work-count').textContent = expanding ? '11 selected works' : '6 of 11 selected works';
  });

  function setZoom(value) {
    zoomed = value;
    offsetX = offsetY = 0;
    viewerImage.style.transform = zoomed ? 'scale(2)' : '';
    stage.classList.toggle('zoomed', zoomed);
    zoom.setAttribute('aria-pressed', String(zoomed));
    zoom.textContent = zoomed ? 'Fit image' : 'Zoom in';
  }
  function render() {
    const n = all[current], data = metadata(n);
    setZoom(false);
    viewerImage.src = `/images/${key(n)}`;
    viewerImage.alt = data.description;
    document.querySelector('#viewer-title').textContent = `${data.title} · ${data.year}`;
    document.querySelector('#viewer-note').textContent = data.note;
    document.querySelector('#viewer-counter').textContent = `${String(current + 1).padStart(2, '0')} / ${all.length}`;
    const link = document.querySelector('#viewer-print');
    link.hidden = !data.printUrl;
    if (data.printUrl) link.href = data.printUrl;
    else link.removeAttribute('href');
  }
  function change(step) {
    current = (current + step + all.length) % all.length;
    render();
  }
  document.querySelectorAll('[data-art]').forEach(button => button.addEventListener('click', () => {
    current = all.indexOf(Number(button.dataset.art));
    render();
    dialog.showModal();
    document.querySelector('#close').focus();
  }));
  document.querySelector('#close').addEventListener('click', () => dialog.close());
  document.querySelector('#previous').addEventListener('click', () => change(-1));
  document.querySelector('#next').addEventListener('click', () => change(1));
  zoom.addEventListener('click', () => setZoom(!zoomed));
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight') { event.preventDefault(); change(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); change(-1); }
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  });
  viewerImage.draggable = false;
  stage.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    moved = false;
    drag = { x: event.clientX, y: event.clientY, startX: offsetX, startY: offsetY, pointerId: event.pointerId };
    stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener('pointermove', event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 8) moved = true;
    if (zoomed) {
      const width = viewerImage.offsetWidth / 2, height = viewerImage.offsetHeight / 2;
      offsetX = Math.max(-width, Math.min(width, drag.startX + dx));
      offsetY = Math.max(-height, Math.min(height, drag.startY + dy));
      viewerImage.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(2)`;
    }
  });
  stage.addEventListener('pointerup', event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!zoomed && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) change(dx < 0 ? 1 : -1);
    else if (!moved) setZoom(!zoomed);
    drag = null;
  });
  stage.addEventListener('pointercancel', () => { drag = null; });
})();
