import fs from "node:fs";
import path from "node:path";
import jsdom from "jsdom";

import { copyFileIfDifferent } from './Lib.mjs';

const { JSDOM } = jsdom;

function getOptions(params) {
  const defaultOptions = {
    hasMeta: true,
  };
  return Object.assign(defaultOptions, params);
}

async function configure({dom, baseUrl, sourceDir, distDir}) {
  if (!dom) return;
  for (const [ name, params ] of Object.entries(dom.targets)) {
    params.output = params.output || {};
    params.output.filename = params.output.filename || `${name}.html`;
    params.favicon = await (async () => {
      const icon = params.favicon || (dom.options && dom.options.favicon);
      if (typeof icon !== "string")
        return null;

      const filename = path.basename(icon);
      const href = path.posix.join(baseUrl, filename);

      const inFilename = path.resolve(sourceDir, icon);
      const outFilename = path.resolve(distDir, filename);
      if (await copyFileIfDifferent(inFilename, outFilename))
        console.log(`[dom.configure] Copy ${icon}`);
      
      return { href }
    })();
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

      if (params.favicon) {
        const linkElm = document.createElement('link');
        linkElm.setAttribute("rel", "icon");
        linkElm.setAttribute("href", params.favicon.href);
        linkElm.setAttribute("sizes", "any");
        fragment.appendChild(linkElm);
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
