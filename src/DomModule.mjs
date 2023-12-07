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

async function configure({dom, baseUrl, sourceDir, distDir, addAsset}) {
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

      addAsset(filename);
      if (await copyFileIfDifferent(inFilename, outFilename))
        console.log(`[dom.configure] Copy ${icon}`);
      
      return { href }
    })();
  }
}

async function generate({dom, baseUrl, isDebug, sourceDir, distDir, writeAsset, addAsset, setApplication}) {
  if (!dom) return;
  for (const [ name, params ] of Object.entries(dom.targets)) {
    const { entry, alias, title, description, hasMeta, output } = getOptions(params);
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

    let options = {
      type: "text/html",
    };

    const toUrlString = (pathStr) => {
      return pathStr.startsWith("/") ? pathStr : path.posix.join(baseUrl, pathStr);
    }

    if (typeof alias === "string")
      options.alias = [ toUrlString(alias) ];
    else if (alias) {
      options.alias = [];
      for (const iter of alias) {
        options.alias.push(toUrlString(iter));
      }
    }

    if (params.application) {
      const application = {
        title,
        main: output.filename, // DELME: options.alias ? options.alias[0] : output.filename,
        description,
      };

      if (params.application.icon) {
        const pathStr = params.application.icon;
        const filename = path.basename(pathStr);

        const inFilename = path.resolve(sourceDir, pathStr);
        const outFilename = path.resolve(distDir, filename);
  
        addAsset(filename);
        if (await copyFileIfDifferent(inFilename, outFilename))
          console.log(`[dom.configure] Copy ${filename}`);
        
          application.icon = filename;
      }

      if (params.application.logo) {
        const pathStr = params.application.logo;
        const filename = path.basename(pathStr);

        const inFilename = path.resolve(sourceDir, pathStr);
        const outFilename = path.resolve(distDir, filename);
  
        addAsset(filename);
        if (await copyFileIfDifferent(inFilename, outFilename))
          console.log(`[dom.configure] Copy ${filename}`);
        
          application.logo = filename;
      }

      setApplication(application);
    }

    const html = dom.serialize();
    await writeAsset(output.filename, html, options);
    console.log(`[dom.bundle] Generate ${output.filename}`);
  }
};

export default {
  configure,
  generate,
};
