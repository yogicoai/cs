"use client";

import { Loader2, Send, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";

type GroupBy = "day" | "week" | "month";

const PERIODS: Array<{ key: GroupBy; label: string }> = [
  { key: "day", label: "일별" },
  { key: "week", label: "주별" },
  { key: "month", label: "월별" },
];

const PROMPT_EXAMPLES = [
  "지난 7일 동안 가장 자주 묻는 질문 카테고리는?",
  "검색 실패 키워드 중에서 새로 만들어야 할 FAQ는?",
  "전화 클릭이 많이 발생하는 지점은 어디고 어떻게 줄일 수 있을까?",
  "라이브 클레임 중 FAQ로 승격하면 좋을 만한 것은?",
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
  const [from, setFrom] = useState(() => ymd(new Date()));
  const [to, setTo] = useState(() => ymd(new Date()));
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastQuestion, setLastQuestion] = useState("");
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
    const q = question.trim();
    if (!q) {
      setError("질문을 입력해주세요.");
      return;
    }
    setBusy(true);
    setError("");
    setInsight("");
    setLastQuestion(q);
    try {
      const response = await fetch("/api/analytics/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, groupBy, from, to }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? `AI 분석에 실패했습니다 (상태 ${response.status})`);
        return;
      }
      setInsight((data.insight as string) ?? "");
    } catch {
      setError("AI 분석 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void run();
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
              참여도 데이터·FAQ·클레임을 컨텍스트로 Claude가 답합니다. 자유롭게 질문하세요.
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
            </div>
            <div className="insight-prompt-row">
              <textarea
                className="insight-prompt"
                rows={3}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="예) 검색 실패 키워드 중 새로 만들어야 할 FAQ를 추천해줘"
                disabled={busy}
                aria-label="AI에게 보낼 질문"
              />
              <button type="button" className="insight-run" onClick={() => void run()} disabled={busy || !question.trim()}>
                {busy ? <Loader2 size={14} className="spin-icon" /> : <Send size={14} />}
                {busy ? "분석 중…" : "보내기 (Ctrl+Enter)"}
              </button>
            </div>
            {!insight && !busy && (
              <div className="insight-examples">
                <span className="insight-examples-label">예시 질문</span>
                {PROMPT_EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    className="insight-example-chip"
                    onClick={() => setQuestion(ex)}
                    disabled={busy}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            )}
            {error && <p className="insight-error">{error}</p>}
            {(busy || insight) && (
              <div className="insight-result">
                {lastQuestion && <p className="insight-question">Q. {lastQuestion}</p>}
                {busy ? (
                  <p className="insight-loading">
                    <Loader2 size={14} className="spin-icon" /> 응답을 생성하고 있어요…
                  </p>
                ) : (
                  <InsightView text={insight} />
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
