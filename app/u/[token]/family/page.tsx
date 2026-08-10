import { getMemberByToken } from "@/lib/auth";
import FamilyManagement from "./FamilyManagement";
import InvalidLink from "../InvalidLink";

export const dynamic = "force-dynamic";

export default async function FamilyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const member = await getMemberByToken(token);

  if (!member) {
    return <InvalidLink />;
  }

  return <FamilyManagement token={token} memberId={member.id} />;
}
