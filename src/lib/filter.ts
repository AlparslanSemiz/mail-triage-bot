/** Drafts and mails the user sent themselves are not triaged. */
export function isOwnOrDraft(
  msg: { isDraft?: boolean; from?: { emailAddress?: { address?: string } } },
  ownAddresses: string
): boolean {
  if (msg.isDraft) return true;
  const own = ownAddresses
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);
  const from = msg.from?.emailAddress?.address?.toLowerCase() ?? "";
  return from !== "" && own.includes(from);
}
