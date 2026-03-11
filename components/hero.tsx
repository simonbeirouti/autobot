import Link from "next/link";
import { Button } from "./ui/button";

export function Hero() {
  return (
    <div className="flex-1 flex flex-col gap-2 items-center h-full justify-center">
      <h1 className="text-4xl font-bold">AutoBot</h1>
      <p className="text-lg">The fastest way to build apps with AutoBot</p>
      <Link href="/protected">
        <Button className="mt-2" size="lg" variant="default">Get Started</Button>
      </Link>
    </div>
  );
}
