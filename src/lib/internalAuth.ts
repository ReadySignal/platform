export function assertInternalRequest(request: Request) {
  const expectedToken = process.env.READYSIGNAL_INTERNAL_TOKEN;

  if (!expectedToken) {
    throw new Error("Internal token is not configured.");
  }

  const actualToken = request.headers.get("x-readysignal-internal-token");

  if (actualToken !== expectedToken) {
    throw new Error("Unauthorized.");
  }
}
