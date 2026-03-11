import { requireUser } from "@/lib/supabase/auth";
import { Suspense } from "react";

async function UserDetails() {
  const user = await requireUser();
  return JSON.stringify(user, null, 2);
}

export default function ProtectedPage() {
  return (
    <div className="flex-1 w-full flex flex-col gap-12">
      <div className="flex flex-col gap-2 items-start">
        <h2 className="font-bold text-2xl mb-4">Your user details</h2>
        <pre className="text-xs font-mono p-3 rounded border overflow-auto w-full">
          <Suspense>
            <UserDetails />
          </Suspense>
        </pre>
      </div>
    </div>
  );
}
