import { redirect } from "next/navigation";

// The room is a one-pager now; /r/x/vote just deep-links the vote tab.
export default async function VoteRedirect({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  redirect(`/r/${code}?tab=vote`);
}
