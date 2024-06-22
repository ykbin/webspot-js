import { BuildScript } from 'webnetq-js';

export default function(source) {
  const callback = this.async();
	(async () => {    
		return BuildScript.makeCMakeProjectScript(source);
	})().then((res) => callback(undefined, res), (err) => callback(err));
}
