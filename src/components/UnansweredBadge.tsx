"use client";

import { AlertCircle, Inbox, Loader2, MessageSquareWarning, RefreshCw, Store, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

// onlineData /api/cs/unanswered 응답 구조
type Cafe24BoardItem = {
  작성일?: string;
  제목?: string;
  내용요약?: string;
  작성자?: string;
};
type Cafe24Board = {
  게시판: string;
  기간내원글: number;
  미답변: number;
  미답변목록: Cafe24BoardItem[];
};
type SmartStoreItem = {
  문의일시?: string;
  카테고리?: string;
  제목?: string;
  문의요약?: string;
  상품?: string;
  고객?: string;
};
type UnansweredData = {
  총미답변?: number;
  자사몰?: { 기간?: string; 총미답변?: number; 게시판별?: Cafe24Board[]; error?: string };
  스마트스토어?: { 미답변?: { 건수: number; 목록: SmartStoreItem[] }; error?: string };
  error?: string;
};

const DAYS = 7;

export function UnansweredBadge() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<UnansweredData | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/cs/unanswered?channel=both&days=${DAYS}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error ?? `조회에 실패했습니다 (상태 ${response.status})`);
        return;
      }
      setData(body);
      setLoadedOnce(true);
    } catch {
      setError("미답변 조회 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }, []);

  // 최초 마운트 시 배지 숫자를 위해 1회 백그라운드 로드
  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const total = data?.총미답변 ?? 0;
  const cafe24Boards = (data?.자사몰?.게시판별 ?? []).filter((b) => b.미답변 > 0);
  const ssItems = data?.스마트스토어?.미답변?.목록 ?? [];
  const ssCount = data?.스마트스토어?.미답변?.건수 ?? 0;
  const cafe24Err = data?.자사몰?.error;
  const ssErr = data?.스마트스토어?.error;

  return (
    <>
      <button
        type="button"
        className={total > 0 ? "unanswered-link has-unanswered" : "unanswered-link"}
        onClick={() => setOpen(true)}
        title="자사몰·스마트스토어 미답변 문의 체크"
      >
        <MessageSquareWarning size={16} />
        미답변
        {loadedOnce && <span className="unanswered-count">{total}</span>}
        {!loadedOnce && busy && <Loader2 size={13} className="spin-icon" />}
      </button>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)} role="dialog" aria-modal="true">
          <div className="modal-card unanswered-modal" onClick={(event) => event.stopPropagation()}>
            <header className="modal-head">
              <div className="modal-title">
                <MessageSquareWarning size={18} />
                <h3>미답변 문의 — 최근 {DAYS}일</h3>
              </div>
              <div className="unanswered-head-actions">
                <button
                  type="button"
                  className="unanswered-refresh"
                  onClick={() => void load()}
                  disabled={busy}
                  aria-label="새로고침"
                >
                  {busy ? <Loader2 size={15} className="spin-icon" /> : <RefreshCw size={15} />}
                </button>
                <button type="button" className="modal-close" aria-label="닫기" onClick={() => setOpen(false)}>
                  <X size={18} />
                </button>
              </div>
            </header>

            {error && <p className="unanswered-error">{error}</p>}

            {busy && !data && (
              <p className="unanswered-loading">
                <Loader2 size={16} className="spin-icon" /> 불러오는 중…
              </p>
            )}

            {data && (
              <div className="unanswered-body">
                <div className="unanswered-summary">
                  <span className="unanswered-summary-total">총 {total}건</span>
                  <span className="unanswered-summary-split">
                    자사몰 {data?.자사몰?.총미답변 ?? 0} · 스토어 {ssCount}
                  </span>
                </div>

                {total === 0 && !cafe24Err && !ssErr && (
                  <div className="unanswered-clear">
                    <Inbox size={26} />
                    <p>최근 {DAYS}일간 미답변 문의가 없어요. 👍</p>
                  </div>
                )}

                {/* 자사몰 */}
                {(cafe24Boards.length > 0 || cafe24Err) && (
                  <section className="unanswered-section">
                    <div className="unanswered-section-head">
                      <Store size={15} />
                      <strong>자사몰</strong>
                    </div>
                    {cafe24Err ? (
                      <p className="unanswered-suberr">
                        <AlertCircle size={13} /> {cafe24Err}
                      </p>
                    ) : (
                      cafe24Boards.map((board) => (
                        <div key={board.게시판} className="unanswered-group">
                          <div className="unanswered-group-head">
                            {board.게시판} <span>{board.미답변}건</span>
                          </div>
                          <ul className="unanswered-list">
                            {board.미답변목록.map((item, i) => (
                              <li key={`${board.게시판}-${i}`}>
                                <div className="unanswered-item-top">
                                  <span className="unanswered-item-title">{item.제목 || "(제목 없음)"}</span>
                                  <span className="unanswered-item-date">{item.작성일}</span>
                                </div>
                                {item.내용요약 && <p className="unanswered-item-body">{item.내용요약}</p>}
                                {item.작성자 && <span className="unanswered-item-writer">{item.작성자}</span>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))
                    )}
                  </section>
                )}

                {/* 스마트스토어 */}
                {(ssCount > 0 || ssErr) && (
                  <section className="unanswered-section">
                    <div className="unanswered-section-head">
                      <Store size={15} />
                      <strong>스마트스토어</strong>
                    </div>
                    {ssErr ? (
                      <p className="unanswered-suberr">
                        <AlertCircle size={13} /> {ssErr}
                      </p>
                    ) : (
                      <div className="unanswered-group">
                        <div className="unanswered-group-head">
                          고객문의 <span>{ssCount}건</span>
                        </div>
                        <ul className="unanswered-list">
                          {ssItems.map((item, i) => (
                            <li key={`ss-${i}`}>
                              <div className="unanswered-item-top">
                                <span className="unanswered-item-title">{item.제목 || item.문의요약 || "(내용 없음)"}</span>
                                <span className="unanswered-item-date">
                                  {(item.문의일시 ?? "").slice(0, 10)}
                                </span>
                              </div>
                              {item.문의요약 && item.제목 && (
                                <p className="unanswered-item-body">{item.문의요약}</p>
                              )}
                              <span className="unanswered-item-writer">
                                {item.카테고리 ? `${item.카테고리} · ` : ""}
                                {item.상품 ? `${item.상품} · ` : ""}
                                {item.고객}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </section>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
