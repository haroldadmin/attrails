import { JoseKey } from "@atproto/oauth-client-node";
import { randomUUID } from "node:crypto";

const keyId = randomUUID();
const key = await JoseKey.generate(["ES256"], keyId);

const privateJwk = key.privateJwk;
console.log(JSON.stringify(privateJwk));
