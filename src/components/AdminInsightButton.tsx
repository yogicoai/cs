"use client";

import { Loader2, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";

type GroupBy = "day" | "week" | "month";

const PERIODS: Array<{ key: GroupBy; label: string }> = [
  { key: "day", label: "일별" },
  { key: "week", label: "주별" },
  { key: "month", label: "월별" },
];

function ymd(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function InsightView({ text }: { text: string }) {
  return (
    <div className="insight-body">
      {text.split("\n").map((line, index) => {
        const key = `line-${index}`;
        if (line.startsWith("## ")) return <h4 key={key}>{line.slice(3)}</h4>;
        if (line.startsWith("# ")) return <h4 key={key}>{line.slice(2)}</h4>;
        if (/^\s*[-*]\s+/.test(line)) return <li key={key}>{line.replace(/^\s*[-*]\s+/, "")}</li>;
        if (/^\s*\d+\.\s+/.test(line)) return <li className="ordered" key={key}>{line.replace(/^\s*\d+\.\s+/, "")}</li>;
        if (line.trim() === "") return <div className="insight-gap" key={key} />;
        return <p key={key}>{line}</p>;
      })}
    </div>
  );
}

export function AdminInsightButton() {
  const [open, setOpen] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>("day");
  const [from, setFrom] = useState(() => ymd(new Date(Date.now() - 29 * 86400000)));
  const [to, setTo] = useState(() => ymd(new Date()));
  const [busy, setBusy] = useState(false);
  const [insight, setInsight] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    setOpen(false);
  }

  async function run() {
    setBusy(true);
    setError("");
    setInsight("");
    try {
      const response = await fetch("/api/analytics/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupBy, from, to }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "AI 분석에 실패했습니다.");
        return;
      }
      setInsight((data.insight as string) ?? "");
    } catch {
      setError("AI 분석 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="guide-link insight-link" onClick={() => setOpen(true)}>
        <Sparkles size={16} />
        AI 데이터 분석
      </button>
      {open && (
        <div className="modal-backdrop" onClick={close} role="dialog" aria-modal="true">
          <div className="modal-card insight-modal" onClick={(event) => event.stopPropagation()}>
            <header className="modal-head">
              <div className="modal-title">
                <Sparkles size={18} />
                <h3>AI 데이터 분석</h3>
              </div>
              <button type="button" className="modal-close" aria-label="닫기" onClick={close}>
                <X size={18} />
              </button>
            </header>
            <p className="insight-modal-desc">
              선택한 기간의 참여도 데이터를 GPT가 분석해 콜 감소 관점의 개선 포인트를 제안합니다.
            </p>
            <div className="insight-modal-controls">
              <div className="date-range">
                <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} aria-label="시작일" />
                <span>~</span>
                <input type="date" value={to} min={from} max={ymd(new Date())} onChange={(e) => setTo(e.target.value)} aria-label="종료일" />
              </div>
              <div className="period-toggle">
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    className={p.key === groupBy ? "active" : ""}
                    onClick={() => setGroupBy(p.key)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <button type="button" className="insight-run" onClick={run} disabled={busy}>
                {busy ? <Loader2 size={14} className="spin-icon" /> : <Sparkles size={14} />}
                {busy ? "분석 중…" : "AI 분석 받기"}
              </button>
            </div>
            {error && <p className="insight-error">{error}</p>}
            {insight && (
              <div className="insight-result">
                <InsightView text={insight} />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
