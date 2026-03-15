import { redirect } from "next/navigation";
import { connection } from "next/server";

export default async function RunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  await connection();
  const { runId } = await params;
  redirect(`/dashboard/runs?runId=${runId}`);
}
