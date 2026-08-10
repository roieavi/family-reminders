import { getMemberByToken } from "@/lib/auth";
import Dashboard from "./Dashboard";
import InvalidLink from "./InvalidLink";

export const dynamic = "force-dynamic";

export default async function PersonalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const member = await getMemberByToken(token);

  if (!member) {
    return <InvalidLink />;
  }

  return (
    <Dashboard token={token} memberId={member.id} memberName={member.name} />
  );
}
