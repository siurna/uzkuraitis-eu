import { redirect } from "next/navigation";

// The room is a one-pager now; /r/x/chat just deep-links the chat tab.
export default async function ChatRedirect({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  redirect(`/r/${code}?tab=chat`);
}
