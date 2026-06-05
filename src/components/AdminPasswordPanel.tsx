"use client";

import { KeyRound, Loader2, LogOut } from "lucide-react";
import { useState } from "react";

export function AdminPasswordPanel() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (next.length < 4) {
      setError("새 비밀번호는 4자 이상이어야 합니다.");
      return;
    }
    if (next !== confirm) {
      setError("새 비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/auth/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin: current, newPin: next }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "비밀번호 변경에 실패했습니다.");
        return;
      }
      setMessage("비밀번호가 변경되었습니다. 다시 로그인해 주세요.");
      window.setTimeout(() => window.location.reload(), 1200);
    } catch {
      setError("변경 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    window.location.reload();
  }

  return (
    <section className="admin-panel admin-password-panel">
      <div className="panel-title">
        <KeyRound size={20} />
        <h2>비밀번호 관리</h2>
      </div>
      <p className="admin-password-desc">
        한 번 로그인하면 24시간 동안 유지됩니다. 변경 시 기존 세션은 모두 로그아웃됩니다.
      </p>
      <form className="admin-password-form" onSubmit={submit}>
        <label>
          현재 비밀번호
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </label>
        <label>
          새 비밀번호 (4자 이상)
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} required />
        </label>
        <label>
          새 비밀번호 확인
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </label>
        <div className="admin-password-actions">
          <button type="submit" disabled={busy}>
            {busy ? <Loader2 size={14} className="spin-icon" /> : null}
            {busy ? "변경 중…" : "비밀번호 변경"}
          </button>
          <button type="button" className="admin-logout-btn" onClick={logout}>
            <LogOut size={14} />
            로그아웃
          </button>
        </div>
        {message && <p className="admin-password-msg">{message}</p>}
        {error && <p className="admin-password-error">{error}</p>}
      </form>
    </section>
  );
}
