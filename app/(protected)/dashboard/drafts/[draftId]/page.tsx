import { redirect } from "next/navigation";
import { connection } from "next/server";

export default async function DraftPage({
  params,
}: {
  params: Promise<{ draftId: string }>;
}) {
  await connection();
  const { draftId } = await params;
  redirect(`/dashboard/drafts?draftId=${draftId}`);
}
