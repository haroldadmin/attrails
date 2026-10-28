import { TID } from "@atproto/common-web";
import { type Agent, cidForRawBytes } from "@atproto/lex";

export async function newCid(): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return (await cidForRawBytes(bytes)).toString();
}

export type FakeAccountOptions = {
  /** Records in the repository, keyed by collection. */
  records?: Record<string, unknown>;
  /** XRPC errors to answer methods with, keyed by method. */
  errors?: Record<string, string>;
};

/** An account whose PDS serves `records` and records the writes made to it. */
export function fakeAccount(
  did: string,
  { records = {}, errors = {} }: FakeAccountOptions = {},
) {
  const writes: { method: string; input: Record<string, unknown> }[] = [];

  const agent: Agent = {
    did: did as Agent["did"],
    async fetchHandler(path, init) {
      const url = new URL(path, "https://pds.test");
      const method = url.pathname.replace(/^\/xrpc\//, "");
      if (errors[method]) {
        return Response.json(
          { error: errors[method], message: errors[method] },
          { status: 400 },
        );
      }

      if (method === "com.atproto.repo.getRecord") {
        const collection = url.searchParams.get("collection") ?? "";
        const value = records[collection];
        if (!value) {
          return Response.json(
            { error: "RecordNotFound", message: "Not found" },
            { status: 400 },
          );
        }

        const rkey = url.searchParams.get("rkey");
        return Response.json({
          uri: `at://${did}/${collection}/${rkey}`,
          cid: await newCid(),
          value,
        });
      }

      const body =
        typeof init.body === "string"
          ? init.body
          : new TextDecoder().decode(init.body as Uint8Array);
      const input = JSON.parse(body);
      writes.push({ method, input });

      return Response.json({
        uri: `at://${did}/${input.collection}/${input.rkey ?? TID.nextStr()}`,
        cid: await newCid(),
      });
    },
  };

  return { agent, writes };
}
