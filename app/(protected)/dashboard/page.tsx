import { PageShell } from "@/components/page-shell";
import { ObjectiveIntake } from "@/components/objective-intake";

export default function Home() {
  return (
    <PageShell contentClassName="max-w-none">
      <ObjectiveIntake />
    </PageShell>
  );
}
