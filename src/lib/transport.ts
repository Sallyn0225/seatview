// Shared browser-transport primitives for the API clients.
//
// Every *-client.ts hits a JSON API that, on failure, returns a stable
// `{ error: <code> }` body which the island maps to localized inline copy (R9).
// They all need the same two things: a typed Error carrying that code (+ HTTP
// status), and a parser that pulls the code off a non-OK Response (defaulting to
// "server_error", or "network" when the body isn't JSON). This is that one copy.

/**
 * A typed transport failure. `Code` is the client-specific error-code union;
 * `"network"` is added for fetch/parse failures so callers map both uniformly.
 * Subclass per client only to set a distinct `name` for `instanceof`.
 */
export class TransportError<Code extends string> extends Error {
  constructor(
    readonly code: Code | "network",
    readonly status?: number,
  ) {
    super(code);
    this.name = "TransportError";
  }
}

/**
 * Pull the `{ error }` code off a non-OK Response. Returns "server_error" when
 * the body is missing/unparsable so callers always get a concrete code.
 */
export async function parseErrorCode<Code extends string>(
  res: Response,
): Promise<Code | "network"> {
  try {
    const data = (await res.json()) as { error?: Code };
    return data.error ?? ("server_error" as Code);
  } catch {
    return "server_error" as Code;
  }
}
