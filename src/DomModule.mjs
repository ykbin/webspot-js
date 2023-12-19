import path from "node:path";
import jsdom from "jsdom";

import { copyFileIfDifferent } from './Lib.mjs';
import styleModule from './StyleModule.mjs';
import scriptModule from './ScriptModule.mjs';

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

    if (params.style || (dom.options && dom.options.style)) {
      const globalStyle = (dom.options && dom.options.style) ? dom.options.style : {};
      const localStyle = (typeof params.style === 'string') ? { entry: params.style } : (params.style || {});
      params.style = Object.assign({}, globalStyle, localStyle);
    }

    if (params.script || (dom.options && dom.options.script)) {
      const globalScript = (dom.options && dom.options.script) ? dom.options.script : {};
      const localScript = (typeof params.script === 'string') ? { entry: params.script } : (params.script || {});
      params.script = Object.assign({}, globalScript, localScript);
    }
  }
}

async function generate({dom, baseUrl, isDebug, sourceDir, distDir, writeAsset, addAsset, setApplication}) {
  if (!dom) return;
  for (const [ name, params ] of Object.entries(dom.targets)) {
    const { entry, alias, title, description, hasMeta, output, style, script } = getOptions(params);
    const inFilename = path.resolve(sourceDir, entry);

    const cssFilename = `${name}.bundle.css`;
    const cssOptionList = [];

    const jsFilename = `${name}.bundle.css`;

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

      if (style) {
        cssOptionList.push({
          from: style.entry,
          to: cssFilename,
          prop: style.prop,
          isDebug,
          workDir: sourceDir,
          isInlineSvg: false,
        });

        const linkElm = document.createElement('link');
        linkElm.setAttribute("rel", "stylesheet");
        linkElm.setAttribute("type", "text/css");
        linkElm.setAttribute("href", path.posix.join(baseUrl, cssFilename));
        fragment.appendChild(linkElm);
      }

      if (script) {
        const scriptElm = document.createElement('script');
        scriptElm.setAttribute("defer", "defer");
        scriptElm.setAttribute("src", path.posix.join(baseUrl, jsFilename));
        fragment.appendChild(scriptElm);
      }
  
      document.head.insertBefore(fragment, document.head.firstChild);
    }

    // controls
    {
      const cssMap = {};
      const elements = Array.from(document.getElementsByTagName("webctl"));
      for (const iter of elements) {
        const pkg = iter.getAttribute("pkg");
        const module = await import(`${pkg}/provider`);
        const name = iter.getAttribute("ctl");
        const ctl = module[name];
        const control = ctl.create(document, iter.id);
        iter.replaceWith(control.element);

        if (!(pkg in cssMap))
          cssMap[pkg] = {};
        
        if (!(name in cssMap[pkg])) {
          cssOptionList.push({
            from: ctl.styleEntry,
            to: cssFilename,
            prop: ctl.prop,
            isDebug,
            workDir: ctl.path,
            isInlineSvg: true,
          });
        }
      }
    }

    const cssResult = [];
    for (const options of cssOptionList) {
      const cssText = await styleModule.process(options);
      cssResult.push(cssText);
    }

    if (cssResult) {
      writeAsset(cssFilename, cssResult.join(""), {type: "text/css"});
      console.log(`[style.bundle] Generate ${cssFilename}`);
    }

    if (script) {
      scriptModule.process({
        from: script.entry,
        to: jsFilename,
        isDebug,
        workDir: sourceDir,
        distDir,
        addAsset
      });
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
