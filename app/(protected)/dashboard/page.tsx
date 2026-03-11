import { PageShell } from "@/components/page-shell";
import { ObjectiveIntake } from "@/components/objective-intake";

export default function Home() {
  return (
    <PageShell contentClassName="max-w-6xl gap-20">
      <ObjectiveIntake />
    </PageShell>
  );
}
