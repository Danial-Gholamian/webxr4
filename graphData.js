// graphData.js
export default {
  nodes: [
    { id: 'A', group: 1, label: 'Home', url: 'pages/a.html' },
    { id: 'B', group: 1, label: 'About', url: 'pages/b.html' },
    { id: 'C', group: 2, label: 'Projects', url: 'pages/c.html' },
    { id: 'D', group: 2, label: 'Research', url: 'pages/d.html' },
    { id: 'E', group: 3, label: 'Blog', url: 'pages/e.html' },
    { id: 'F', group: 3, label: 'Contact', url: 'pages/f.html' }
  ],
  links: [
    { source: 'A', target: 'B' },
    { source: 'A', target: 'C' },
    { source: 'B', target: 'D' },
    { source: 'C', target: 'E' },
    { source: 'D', target: 'F' },
    { source: 'E', target: 'F' }
  ]
};
