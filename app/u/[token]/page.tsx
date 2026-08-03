import Link from "next/link";
import { getMemberByToken } from "@/lib/auth";
import Dashboard from "./Dashboard";
import ClearStoredToken from "./ClearStoredToken";

export const dynamic = "force-dynamic";

export default async function PersonalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const member = await getMemberByToken(token);

  if (!member) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16">
        <ClearStoredToken />
        <p className="text-center text-lg">
          הלינק לא תקין. בדוק שהעתקת אותו במלואו, או בקש לינק חדש ממי שהוסיף
          אותך.
        </p>
        <Link
          href="/"
          className="rounded-lg border-2 border-black px-4 py-2 text-sm font-semibold transition hover:bg-lime-100"
        >
          חזרה לעמוד הראשי
        </Link>
      </main>
    );
  }

  return (
    <Dashboard token={token} memberId={member.id} memberName={member.name} />
  );
}
