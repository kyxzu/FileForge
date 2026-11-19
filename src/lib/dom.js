// Tiny DOM helper. Strings are always added as text nodes (never parsed as
// HTML), so user-controlled values such as filenames cannot inject markup.
//
//   h("button", { class: "button", onClick: handler }, "Save")

export function h(tag, attributes = {}, ...children) {
  const element = document.createElement(tag);

  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined || value === null || value === false) continue;

    if (name === "class") {
      element.className = value;
    } else if (name === "text") {
      element.textContent = value;
    } else if (name.startsWith("on") && typeof value === "function") {
      element.addEventListener(name.slice(2).toLowerCase(), value);
    } else {
      element.setAttribute(name, value === true ? "" : String(value));
    }
  }

  for (const child of children.flat()) {
    if (child === undefined || child === null || child === false) continue;
    element.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }

  return element;
}

// Native append()/replaceChildren() turn null into the text "null".
// These helpers skip empty children instead.
export function appendContent(parent, ...children) {
  parent.append(...children.flat().filter((child) => child !== null && child !== undefined && child !== false));
}

export function replaceContent(parent, ...children) {
  parent.replaceChildren(...children.flat().filter((child) => child !== null && child !== undefined && child !== false));
}
