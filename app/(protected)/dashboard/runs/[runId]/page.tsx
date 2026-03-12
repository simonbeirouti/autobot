import { redirect } from "next/navigation";

export default async function RunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  redirect(`/dashboard/runs?runId=${runId}`);
}
