import { NextResponse } from "next/server";
import { z } from "zod";
import { changePin, isAuthed, verifyPin } from "@/lib/adminAuth";

const schema = z.object({
  currentPin: z.string().min(1),
  newPin: z.string().min(4, "새 비밀번호는 4자 이상이어야 합니다."),
});

export async function POST(request: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "입력 오류" }, { status: 400 });
  }
  const { currentPin, newPin } = parsed.data;

  if (!(await verifyPin(currentPin))) {
    return NextResponse.json({ error: "현재 비밀번호가 일치하지 않습니다." }, { status: 401 });
  }

  await changePin(newPin);
  return NextResponse.json({ ok: true });
}
