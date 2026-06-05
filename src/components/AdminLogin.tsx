"use client";

import { KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";

export function AdminLogin() {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? "로그인에 실패했습니다.");
        return;
      }
      window.location.reload();
    } catch {
      setError("로그인 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-login-shell">
      <form className="admin-login-card" onSubmit={submit}>
        <div className="admin-login-icon">
          <KeyRound size={22} />
        </div>
        <h1>어드민 로그인</h1>
        <p>비밀번호를 입력해 주세요. 한 번 로그인하면 24시간 유지됩니다.</p>
        <input
          type="password"
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          placeholder="비밀번호"
          autoFocus
          required
        />
        <button type="submit" disabled={!pin || busy}>
          {busy ? <Loader2 size={16} className="spin-icon" /> : null}
          {busy ? "확인 중…" : "로그인"}
        </button>
        {error && <p className="admin-login-error">{error}</p>}
      </form>
    </main>
  );
}
