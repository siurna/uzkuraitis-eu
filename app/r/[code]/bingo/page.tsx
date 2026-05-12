import { redirect } from "next/navigation";

// The room is a one-pager now; /r/x/bingo just deep-links the bingo tab.
export default async function BingoRedirect({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  redirect(`/r/${code}?tab=bingo`);
}
