import { pathToFileURL } from 'node:url';
import { BuildScript } from 'webnetq-js';

function makeCtlModuleUrl(pkg, name)
{
  return `${pkg}/control/${name}`;
}

async function makeStaticRegisterScript(module)
{
  const {PKG, CTLS} = module;

  let scriptContent = `import { ControlManager } from 'webnetq-js';\n\n`;
  for (const key in CTLS) {
    const ctlModuleUrl = makeCtlModuleUrl(PKG, key);
    scriptContent += `import { default as ${key} } from '${ctlModuleUrl}';\n`;
  };
  scriptContent += `\n`;

  scriptContent += `const manager = ControlManager.getInstance();\n\n`;

  for (const key in CTLS) {
    const ctlModuleUrl = makeCtlModuleUrl(PKG, key);
    const ctlModule = await import(ctlModuleUrl);
    for (const iter of ['NAME', 'ROOT_HTML', 'CSS', 'ROOT_CLASS']) {
      if (typeof ctlModule[iter] !== 'string') {
        throw `Can't find ${iter} for '${key}' control`;
      }
    }
    const template = ctlModule.TEMPLATE;
    const ctlParams = {
      name: template.NAME,
      rootHTML: template.ROOT_HTML,
      rootCSS: template.CSS,
      rootClass: template.ROOT_CLASS,
    };
    if (template.PORT_CLASS) {
      ctlParams.portClass = template.PORT_CLASS;
    }
    scriptContent += `manager.manager (${key}, ${JSON.stringify(ctlParams)})\n`;
  };
  scriptContent += `\n`;

  scriptContent += `export const PKG = '${PKG}';\n`;
  scriptContent += `export const CTLS = {\n`;
  for (const key in CTLS) {
    scriptContent += `  ${key},\n`;
  };
  scriptContent += `};\n`;

  return scriptContent;
}

export default function(source) {
  const resourceUrl = pathToFileURL(this.resourcePath);
  const callback = this.async();
	(async () => {
    const module = await import(resourceUrl);
		return await makeStaticRegisterScript(module);
	})().then((res) => callback(undefined, res), (err) => callback(err));
}
