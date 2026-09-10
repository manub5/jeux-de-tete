// core/ui.js
// Small DOM helpers. Deliberately tiny: a framework would be a dependency, and
// this project has none.

export function element(tag, attributes = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    node.append(child);
  }
  return node;
}

export function button(label, onClick, { className = 'bouton', ...rest } = {}) {
  return element('button', { class: className, type: 'button', text: label, onClick, ...rest });
}
