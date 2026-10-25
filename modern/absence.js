(() => {
  const links = [...document.querySelectorAll('.ea-open')];
  const viewer = document.querySelector('#ea-viewer');
  if (!viewer || typeof viewer.showModal !== 'function') return;
  const image = document.querySelector('#ea-full');
  let index = 0;
  let opener;
  function show(next) {
    index = (next + links.length) % links.length;
    const link = links[index];
    image.src = link.href;
    image.alt = link.querySelector('img').alt;
    document.querySelector('#ea-viewer-title').textContent = link.dataset.title;
    document.querySelector('#ea-position').textContent = `${index + 1} / ${links.length}`;
    document.querySelector('#ea-original').href = link.href;
  }
  links.forEach((link, i) => link.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); opener = link; show(i); viewer.showModal();
    document.querySelector('#ea-close').focus();
  }));
  document.querySelector('#ea-close').addEventListener('click', () => viewer.close());
  document.querySelector('#ea-prev').addEventListener('click', () => show(index - 1));
  document.querySelector('#ea-next').addEventListener('click', () => show(index + 1));
  viewer.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); show(index - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); show(index + 1); }
  });
  viewer.addEventListener('click', event => {
    const rect = viewer.getBoundingClientRect();
    if (event.target === viewer && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) viewer.close();
  });
  viewer.addEventListener('close', () => opener?.focus());
})();
