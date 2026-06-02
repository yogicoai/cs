"use client";

import { Download, FileSpreadsheet, Loader2, Pencil, Sparkles, Trash2, Upload } from "lucide-react";
import readXlsxFile from "read-excel-file/browser";
import { useMemo, useState } from "react";
import type { ClaimItem, ClaimStatus } from "@/lib/repositories/claimRepository";

const TEMPLATE_HEADERS = ["고객문의(상황)", "CS답변"];
const TEMPLATE_ROWS = [
  ["주문한 지 일주일이 지났는데 아직도 상품을 못 받았어요", "현재 주문량 증가로 배송이 지연되고 있습니다. 주문번호 확인 후 출고 일정을 안내드렸습니다."],
  ["커버 지퍼가 처음부터 고장나 있었어요", "제품 하자로 확인되어 무상 교환 접수 도와드렸습니다."],
];
const CLAIM_PAGE_SIZE = 10;

type ClaimRow = { situation: string; csAnswer: string };

function csvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function toClaimRows(rows: Array<Array<string | number | boolean | Date | null | undefined>>): ClaimRow[] {
  return rows
    .slice(1)
    .map((row) => {
      const cell = (i: number) => String(row[i] ?? "").trim();
      return { situation: cell(0), csAnswer: cell(1) };
    })
    .filter((row) => row.situation);
}

export function ClaimManager({ initialClaims }: { initialClaims: ClaimItem[] }) {
  const [claims, setClaims] = useState(initialClaims);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestingId, setSuggestingId] = useState("");
  const [claimPage, setClaimPage] = useState(1);
  const [editingClaimId, setEditingClaimId] = useState("");

  const boardClaims = useMemo(() => claims.filter((claim) => claim.status !== "live"), [claims]);
  const totalClaimPages = Math.ceil(boardClaims.length / CLAIM_PAGE_SIZE);
  const currentClaimPage = Math.min(claimPage, totalClaimPages || 1);
  const pageClaims = boardClaims.slice((currentClaimPage - 1) * CLAIM_PAGE_SIZE, currentClaimPage * CLAIM_PAGE_SIZE);

  async function reload() {
    const response = await fetch("/api/claims", { cache: "no-store" });
    const data = await response.json();
    setClaims(data.claims as ClaimItem[]);
  }

  async function onUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setBusy(true);
    setMessage("업로드 중입니다...");
    try {
      let rows: Array<Array<string | number | boolean | Date | null | undefined>>;
      if (file.name.toLowerCase().endsWith(".csv")) {
        rows = parseCsv(await file.text());
      } else {
        rows = (await readXlsxFile(file)) as unknown as Array<
          Array<string | number | boolean | Date | null | undefined>
        >;
      }
      const claimRows = toClaimRows(rows);
      if (claimRows.length === 0) {
        setMessage("불러올 데이터가 없습니다. 양식(열 순서)을 확인해 주세요.");
        return;
      }
      const response = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: claimRows }),
      });
      if (!response.ok) {
        setMessage("업로드에 실패했습니다. 파일 형식을 확인해 주세요.");
        return;
      }
      const data = await response.json();
      await reload();
      setMessage(`${data.inserted}건이 '검토중'으로 추가되었습니다.`);
    } catch {
      setMessage("파일을 읽지 못했습니다. .csv 또는 .xlsx 파일인지 확인해 주세요.");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  function downloadTemplate() {
    const csv = `﻿${[TEMPLATE_HEADERS.join(","), ...TEMPLATE_ROWS.map((r) => r.map(csvCell).join(","))].join("\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "고객클레임_양식.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function patchLocal(id: string, patch: Partial<ClaimItem>) {
    setClaims((current) => current.map((claim) => (claim.id === id ? { ...claim, ...patch } : claim)));
  }

  async function patchClaim(id: string, patch: Partial<ClaimItem>) {
    patchLocal(id, patch);
    await fetch(`/api/claims/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    // AdminFaqManager의 라이브 클레임 목록을 즉시 갱신하도록 알림
    window.dispatchEvent(new Event("cs:claim-live-changed"));
    if (patch.status === "live") {
      setMessage("라이브로 전환되었습니다 — FAQ 목록의 '고객 클레임' 섹션에 추가됐어요.");
      window.setTimeout(() => {
        document.getElementById("faq-claim-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    }
  }

  async function suggest(id: string) {
    setSuggestingId(id);
    try {
      const response = await fetch(`/api/claims/${id}/suggest`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "AI 추천 생성에 실패했습니다.");
        return;
      }
      patchLocal(id, {
        aiSuggestedAnswer: data.claim.aiSuggestedAnswer,
        category: data.claim.category,
      });
    } catch {
      setMessage("AI 추천 생성 중 오류가 발생했습니다.");
    } finally {
      setSuggestingId("");
    }
  }

  async function deleteClaim(id: string) {
    await fetch(`/api/claims/${id}`, { method: "DELETE" });
    setClaims((current) => current.filter((claim) => claim.id !== id));
    window.dispatchEvent(new Event("cs:claim-live-changed"));
  }

  return (
    <section id="claim-manager-section" className="admin-panel claim-manager">
      <div className="panel-title">
        <FileSpreadsheet size={20} />
        <h2>고객 클레임 관리</h2>
      </div>
      <p className="claim-desc">
        과거 고객문의·CS응대 이력을 업로드하면, AI가 카테고리와 추천 답변을 만들어 줍니다. CS가 더블체크 후 <strong>최종 답변을 확정하고
        ‘라이브’로 전환</strong>해야 AI 응대에 사용됩니다. 이 데이터는 <strong>고객 탐색 화면에는 노출되지 않습니다.</strong>
      </p>

      <div className="claim-actions">
        <button type="button" onClick={downloadTemplate}>
          <Download size={16} />
          엑셀 양식 다운로드
        </button>
        <label className="claim-upload">
          {busy ? <Loader2 size={16} className="spin-icon" /> : <Upload size={16} />}
          파일 업로드
          <input type="file" accept=".xlsx,.csv" onChange={onUpload} disabled={busy} hidden />
        </label>
        {message && <span className="claim-message">{message}</span>}
      </div>

      {claims.length === 0 ? (
        <p className="empty-state">등록된 클레임이 없습니다. 양식을 받아 작성 후 업로드해 주세요.</p>
      ) : boardClaims.length === 0 ? (
        <p className="empty-state">검토/보류 중인 클레임이 없습니다. 라이브 클레임은 위 FAQ 목록의 고객 클레임 섹션에서 수정할 수 있습니다.</p>
      ) : (
        <div className="claim-board">
          <div className="table">
            <div className="table-row table-head">
              <span>상태</span>
              <span>카테고리</span>
              <span>고객 문의</span>
              <span>관리</span>
            </div>
            {pageClaims.map((claim) => {
              const open = editingClaimId === claim.id;
              return (
                <div className={`claim-board-item status-${claim.status}`} key={claim.id}>
                  <div className="table-row">
                    <span>
                      <select
                        className="claim-status"
                        aria-label="상태"
                        value={claim.status}
                        onChange={(event) => void patchClaim(claim.id, { status: event.target.value as ClaimStatus })}
                      >
                        <option value="review">검토중</option>
                        <option value="live">라이브</option>
                        <option value="hold">보류</option>
                      </select>
                    </span>
                    <span>{claim.category || "미분류"}</span>
                    <span title={claim.situation}>
                      <button
                        className="claim-question-toggle"
                        type="button"
                        aria-expanded={open ? "true" : "false"}
                        onClick={() => setEditingClaimId(open ? "" : claim.id)}
                      >
                        {claim.situation}
                      </button>
                    </span>
                    <span className="row-actions">
                      <button
                        aria-label="클레임 편집"
                        type="button"
                        onClick={() => setEditingClaimId(open ? "" : claim.id)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button aria-label="삭제" type="button" onClick={() => void deleteClaim(claim.id)}>
                        <Trash2 size={16} />
                      </button>
                    </span>
                  </div>
                  {open && (
                    <article className="claim-card claim-board-detail">
                      <div className="claim-field">
                        <label>고객 문의</label>
                        <p>{claim.situation}</p>
                        {claim.keywords.length > 0 && <em className="claim-kw">{claim.keywords.join(", ")}</em>}
                      </div>

                      <div className="claim-grid">
                        <div className="claim-field">
                          <label>CS 답변</label>
                          {claim.csAnswer ? <p className="claim-cs">{claim.csAnswer}</p> : <p className="claim-muted">-</p>}
                        </div>
                        <div className="claim-field">
                          <label>AI 추천 답변</label>
                          {claim.aiSuggestedAnswer ? (
                            <p className="claim-suggest">{claim.aiSuggestedAnswer}</p>
                          ) : (
                            <p className="claim-muted">아직 생성하지 않았습니다.</p>
                          )}
                          <div className="claim-suggest-actions">
                            <button type="button" onClick={() => void suggest(claim.id)} disabled={suggestingId === claim.id}>
                              {suggestingId === claim.id ? <Loader2 size={14} className="spin-icon" /> : <Sparkles size={14} />}
                              AI 답변 들어보기
                            </button>
                            {claim.aiSuggestedAnswer && (
                              <button type="button" onClick={() => void patchClaim(claim.id, { answer: claim.aiSuggestedAnswer })}>
                                이 답변 채택 →
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="claim-field claim-final">
                        <label>최종 답변 (라이브용)</label>
                        <textarea
                          defaultValue={claim.answer}
                          key={`${claim.id}-${claim.answer}`}
                          rows={4}
                          placeholder="라이브로 사용할 최종 답변을 확정하세요"
                          onBlur={(event) => {
                            if (event.target.value !== claim.answer) {
                              void patchClaim(claim.id, { answer: event.target.value });
                            }
                          }}
                        />
                      </div>
                    </article>
                  )}
                </div>
              );
            })}
          </div>
          {totalClaimPages > 1 && (
            <div className="faq-pager">
              {Array.from({ length: totalClaimPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={n === currentClaimPage ? "active" : ""}
                  onClick={() => setClaimPage(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
