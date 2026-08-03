import { getMemberByToken } from "@/lib/auth";
import Dashboard from "./Dashboard";

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
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <p className="text-center text-lg">
          הלינק לא תקין. בדוק שהעתקת אותו במלואו, או בקש לינק חדש ממי שהוסיף
          אותך.
        </p>
      </main>
    );
  }

  return (
    <Dashboard token={token} memberId={member.id} memberName={member.name} />
  );
}
