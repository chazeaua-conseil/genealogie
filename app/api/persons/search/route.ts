import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDefaultTree } from "@/lib/tree";
import { toPersonOption } from "@/lib/person-options";

export const runtime = "nodejs";

const LIMIT = 10;

/**
 * Tree-wide person lookup backing the global search field. Matches any name
 * component (given, surname, married name, nickname), case-insensitively,
 * scoped to the caller's tree. Accents are not folded — that would need the
 * `unaccent` extension — so "Chazeau" and "Chazéau" stay distinct.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json([]);

  const tree = await getOrCreateDefaultTree(session.user.id);

  // Each whitespace-separated token must match one of the name fields, so
  // "cha jean" finds "CHAZEAU Jean" whatever the order of the words.
  const tokens = q.split(/\s+/).filter(Boolean).slice(0, 4);
  const persons = await prisma.person.findMany({
    where: {
      treeId: tree.id,
      AND: tokens.map((token) => ({
        OR: [
          { surname: { contains: token, mode: "insensitive" as const } },
          { givenName: { contains: token, mode: "insensitive" as const } },
          { marriedName: { contains: token, mode: "insensitive" as const } },
          { nickname: { contains: token, mode: "insensitive" as const } },
        ],
      })),
    },
    orderBy: [{ surname: "asc" }, { givenName: "asc" }],
    take: LIMIT,
    select: {
      id: true,
      givenName: true,
      surname: true,
      marriedName: true,
      nickname: true,
      sex: true,
      isLiving: true,
      events: {
        where: { type: { in: ["BIRTH", "DEATH"] } },
        select: { type: true, date: true },
      },
    },
  });

  return NextResponse.json(persons.map(toPersonOption));
}
