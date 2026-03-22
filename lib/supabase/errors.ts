type SupabaseLikeError = {
  code?: string;
  details?: string;
  message?: string;
};

export function isSupabaseRowNotFoundError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as SupabaseLikeError;
  return (
    candidate.code === "PGRST116" ||
    candidate.details?.includes("0 rows") === true ||
    candidate.message?.includes("0 rows") === true
  );
}
