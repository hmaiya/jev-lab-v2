/*
  Decision Lab: field guide.
  Highlights the table-of-contents entry for the section on screen.
*/
(function () {
  'use strict';

  const links = Array.from(document.querySelectorAll('.toc a'));
  const byId = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
  if (!('IntersectionObserver' in window)) return;

  // Step 1: watch each section; mark the top-most visible one as active.
  const visible = new Set();
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => (e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id)));
    const first = Array.from(byId.keys()).find(id => visible.has(id));
    if (!first) return;
    links.forEach(a => a.classList.toggle('active', a === byId.get(first)));
  }, { rootMargin: '-80px 0px -60% 0px' });

  // Step 2: observe every section that has a TOC link.
  byId.forEach((_, id) => {
    const section = document.getElementById(id);
    if (section) observer.observe(section);
  });
})();
