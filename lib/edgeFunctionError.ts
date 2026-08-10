export async function getEdgeFunctionErrorMessage(error: any): Promise<string> {
  try {
    const body = await error?.context?.json?.();
    if (body?.error) return body.error;
  } catch {
    // response body wasn't JSON or already consumed; fall through
  }
  return error?.message ?? "Unknown error";
}
