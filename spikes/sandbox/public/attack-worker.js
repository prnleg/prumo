importScripts("/attacks.js");
self.onmessage = async (e) => self.postMessage(await self.runAttacks(e.data.secretPath, e.data.where));
