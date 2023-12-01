import fs from "node:fs";
import path from "node:path";
import jsdom from "jsdom";

const { JSDOM } = jsdom;

function getOptions(params) {
  const defaultOptions = {
    hasMeta: true,
  };
  return Object.assign(defaultOptions, params);
}

async function configure({dom}) {
  if (!dom) return;
  for (const [ name, params ] of Object.entries(dom.targets)) {
    params.output = params.output || {};
    params.output.filename = params.output.filename || `${name}.html`;
  }
}

async function generate({dom, isDebug, sourceDir, distDir}) {
  if (!dom) return;
  for (const [ name, params ] of Object.entries(dom.targets)) {
    const { entry, title, description, alias, hasMeta, output } = getOptions(params);
    const inFilename = path.resolve(sourceDir, entry);
    const outFilename = path.resolve(distDir, output.filename);
    const dom = await JSDOM.fromFile(inFilename, {});

    const document = dom.window.document;

    // head
    {
      const fragment = document.createDocumentFragment();

      if (isDebug) {
        const comment = document.createComment(`Genrated from '${entry}'`);
        fragment.appendChild(comment);
      }

      if (hasMeta) {
        const metaElm = document.createElement('meta');
        metaElm.setAttribute("http-equiv", "Content-Type");
        metaElm.setAttribute("content", "text/html; charset=utf-8");
        fragment.appendChild(metaElm);  
      }

      if (description) {
        const metaElm = document.createElement('meta');
        metaElm.setAttribute("name", "description");
        metaElm.setAttribute("content", description);
        fragment.appendChild(metaElm);  
      }

      if (title && !document.head.querySelector("title")) {
        const titleElm = document.createElement('title');
        titleElm.setAttribute("class", "notranslate");
        titleElm.setAttribute("translate", "no");
        titleElm.textContent = title + (isDebug ? " (Debug)" : "");
        fragment.appendChild(titleElm);
      }

      document.head.insertBefore(fragment, document.head.firstChild);
    }

    const html = dom.serialize();
    await fs.promises.writeFile(outFilename, html, { encoding: "utf8", flag: "w" });
    console.log(`[dom.bundle] Generate ${output.filename}`);
  }
};

export default {
  configure,
  generate,
};
