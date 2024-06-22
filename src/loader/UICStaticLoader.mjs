import { pathToFileURL } from 'node:url';
import { BuildScript } from 'webnetq-js';

export default function(source) {
  const resourceUrl = pathToFileURL(this.resourcePath);
  const callback = this.async();
	(async () => {
    const module = await import(resourceUrl);
		return BuildScript.makeStaticRegisterScript(module);
	})().then((res) => callback(undefined, res), (err) => callback(err));
}
