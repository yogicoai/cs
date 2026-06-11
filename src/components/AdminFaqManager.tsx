"use client";

import { Bot, ChevronDown, Loader2, Pencil, Plus, Search, Send, Trash2, X } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import type { ClaimItem } from "@/lib/repositories/claimRepository";
import type { FaqItem } from "@/lib/sample-data";

type FormState = {
  id: string;
  source: "faq" | "claim";
  category: string;
  subcategory: string;
  question: string;
  answer: string;
  keywords: string;
  status: "draft" | "published" | "archived";
};

const emptyForm: FormState = {
  id: "",
  source: "faq",
  category: "",
  subcategory: "",
  question: "",
  answer: "",
  keywords: "",
  status: "published",
};

type AdminFaqManagerProps = {
  initialFaqs: FaqItem[];
  initialLiveClaims?: ClaimItem[];
};

export function AdminFaqManager({ initialFaqs, initialLiveClaims = [] }: AdminFaqManagerProps) {
  const [faqs, setFaqs] = useState(initialFaqs);
  const [liveClaims, setLiveClaims] = useState<ClaimItem[]>(initialLiveClaims);

  // 클레임이 라이브로 전환되면 ClaimManager가 이벤트를 발사 → 여기서 라이브 목록을 새로 가져온다.
  useEffect(() => {
    function refreshLiveClaims() {
      void fetch("/api/claims", { cache: "no-store" })
        .then((response) => response.json())
        .then((data) => {
          const items = (data.claims as ClaimItem[]).filter((c) => c.status === "live" && c.answer);
          setLiveClaims(items);
        })
        .catch(() => {});
    }
    window.addEventListener("cs:claim-live-changed", refreshLiveClaims);
    return () => window.removeEventListener("cs:claim-live-changed", refreshLiveClaims);
  }, []);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [message, setMessage] = useState("");
  const [newCategory, setNewCategory] = useState(false);
  const [newSubcategory, setNewSubcategory] = useState(false);
  const isEditing = Boolean(form.id);
  const isClaimEditing = form.source === "claim";

  const [openCats, setOpenCats] = useState<Set<string>>(new Set());
  const [claimSectionOpen, setClaimSectionOpen] = useState(false);
  const [catPage, setCatPage] = useState<Record<string, number>>({});
  const PAGE_SIZE = 10;
  const [faqSearch, setFaqSearch] = useState("");
  const searchTerm = faqSearch.trim().toLowerCase();
  const isSearching = searchTerm.length > 0;
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [categoryDraft, setCategoryDraft] = useState("");
  const [renamingCategory, setRenamingCategory] = useState(false);
  const [editingSubFaqId, setEditingSubFaqId] = useState("");
  const [subDraft, setSubDraft] = useState("");
  const [subOriginal, setSubOriginal] = useState<{ category: string; subcategory: string; faqId: string }>({ category: "", subcategory: "", faqId: "" });
  const [renamingSub, setRenamingSub] = useState(false);

  function startEditSubcategory(faq: FaqItem) {
    setEditingSubFaqId(faq.id);
    setSubDraft(faq.subcategory ?? "");
    setSubOriginal({ category: faq.category, subcategory: faq.subcategory ?? "", faqId: faq.id });
  }

  function cancelEditSubcategory() {
    setEditingSubFaqId("");
    setSubDraft("");
  }

  async function saveSubcategoryRename() {
    const newName = subDraft.trim();
    if (newName === subOriginal.subcategory) {
      cancelEditSubcategory();
      return;
    }
    const isSingleMode = subOriginal.subcategory === "";
    const affected = isSingleMode
      ? 1
      : faqs.filter(
          (f) => f.category === subOriginal.category && (f.subcategory ?? "") === subOriginal.subcategory,
        ).length;
    const fromLabel = subOriginal.subcategory || "(빈 유형)";
    const toLabel = newName || "(빈 유형)";
    const confirmMsg = isSingleMode
      ? `'${subOriginal.category}' 카테고리의 이 FAQ에 '${toLabel}' 유형을 부여합니다. 진행할까요?`
      : `'${subOriginal.category}' 카테고리의 '${fromLabel}' 문의 유형을 '${toLabel}' 으로 변경합니다.\n${affected}건이 일괄 변경됩니다. 진행할까요?`;
    if (!window.confirm(confirmMsg)) return;
    setRenamingSub(true);
    try {
      const response = await fetch("/api/faqs/subcategories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: subOriginal.category,
          from: subOriginal.subcategory,
          to: newName,
          faqId: subOriginal.faqId,
        }),
      });
      if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        const errMsg = errBody?.error || `상태 ${response.status}`;
        setMessage(`문의 유형 변경에 실패했습니다 — ${errMsg}`);
        console.error("[saveSubcategoryRename]", response.status, errBody);
        return;
      }
      const data = await response.json();
      if (isSingleMode) {
        setFaqs((current) => current.map((f) => (f.id === subOriginal.faqId ? { ...f, subcategory: newName } : f)));
      } else {
        setFaqs((current) => current.map((f) =>
          f.category === subOriginal.category && (f.subcategory ?? "") === subOriginal.subcategory
            ? { ...f, subcategory: newName }
            : f,
        ));
        setLiveClaims((current) => current.map((c) =>
          c.category === subOriginal.category && (c.subcategory ?? "") === subOriginal.subcategory
            ? { ...c, subcategory: newName }
            : c,
        ));
        window.dispatchEvent(new Event("cs:claim-live-changed"));
      }
      setMessage(`'${fromLabel}' → '${toLabel}' 변경 완료 (FAQ ${data.faqsUpdated}건, 클레임 ${data.claimsUpdated}건)`);
      cancelEditSubcategory();
    } catch {
      setMessage("문의 유형 변경 중 오류가 발생했습니다.");
    } finally {
      setRenamingSub(false);
    }
  }

  async function saveCategoryRename(oldName: string) {
    const newName = categoryDraft.trim();
    if (!newName) {
      setEditingCategoryName("");
      return;
    }
    if (newName === oldName) {
      setEditingCategoryName("");
      setCategoryDraft("");
      return;
    }
    if (!window.confirm(`'${oldName}' 카테고리를 '${newName}' 으로 변경합니다.\n해당 카테고리의 모든 FAQ와 고객 클레임이 일괄 변경됩니다. 진행할까요?`)) {
      return;
    }
    setRenamingCategory(true);
    try {
      const response = await fetch("/api/faqs/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: oldName, to: newName }),
      });
      if (!response.ok) {
        setMessage("카테고리 변경에 실패했습니다.");
        return;
      }
      const data = await response.json();
      setFaqs((current) => current.map((f) => (f.category === oldName ? { ...f, category: newName } : f)));
      setLiveClaims((current) => current.map((c) => (c.category === oldName ? { ...c, category: newName } : c)));
      window.dispatchEvent(new Event("cs:claim-live-changed"));
      setMessage(`'${oldName}' → '${newName}' 변경 완료 (FAQ ${data.faqsUpdated}건, 클레임 ${data.claimsUpdated}건)`);
      setEditingCategoryName("");
      setCategoryDraft("");
    } catch {
      setMessage("카테고리 변경 중 오류가 발생했습니다.");
    } finally {
      setRenamingCategory(false);
    }
  }

  function matchesSearch(faq: FaqItem) {
    if (!isSearching) return true;
    const haystacks = [faq.question, faq.answer, faq.keywords.join(" ")];
    return haystacks.some((h) => h.toLowerCase().includes(searchTerm));
  }

  function answerSnippet(answer: string) {
    if (!isSearching) return "";
    const lower = answer.toLowerCase();
    const i = lower.indexOf(searchTerm);
    if (i < 0) return "";
    const around = 40;
    const start = Math.max(0, i - around);
    const end = Math.min(answer.length, i + searchTerm.length + around);
    return (start > 0 ? "…" : "") + answer.slice(start, end) + (end < answer.length ? "…" : "");
  }

  function toggleCat(category: string) {
    setClaimSectionOpen(false);
    setOpenCats((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }

  function toggleClaimSection() {
    setOpenCats(new Set());
    setClaimSectionOpen((open) => !open);
  }

  function resetForm() {
    setForm(emptyForm);
    setNewCategory(false);
    setNewSubcategory(false);
  }

  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  async function askAdminAi(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (aiQuestion.trim().length < 2 || aiLoading) {
      return;
    }
    setAiLoading(true);
    setAiAnswer("");
    try {
      const response = await fetch("/api/ai-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "ownmall", query: aiQuestion }),
      });
      if (!response.ok || !response.body) {
        throw new Error("ai failed");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const raw of lines) {
          if (!raw.trim()) {
            continue;
          }
          const msg = JSON.parse(raw) as { type: string; answer?: string; text?: string };
          if (msg.type === "meta" && msg.answer) {
            setAiAnswer(msg.answer);
          } else if (msg.type === "delta" && msg.text) {
            setAiAnswer((prev) => prev + msg.text);
          }
        }
      }
    } catch {
      setAiAnswer("AI 응답을 불러오지 못했습니다.");
    } finally {
      setAiLoading(false);
    }
  }

  const faqCategories = useMemo(() => Array.from(new Set(faqs.map((faq) => faq.category))).sort(), [faqs]);
  const categories = useMemo(
    () => Array.from(new Set([...faqs.map((faq) => faq.category), ...liveClaims.map((claim) => claim.category)].filter(Boolean))).sort(),
    [faqs, liveClaims],
  );
  const subcategories = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...faqs.filter((faq) => faq.category === form.category).map((faq) => faq.subcategory),
            ...liveClaims.filter((claim) => claim.category === form.category).map((claim) => claim.subcategory),
          ].filter(Boolean) as string[],
        ),
      ).sort(),
    [faqs, liveClaims, form.category],
  );

  function editFaq(faq: FaqItem) {
    setNewCategory(false);
    setNewSubcategory(false);
    setForm({
      id: faq.id,
      source: "faq",
      category: faq.category,
      subcategory: faq.subcategory ?? "",
      question: faq.question,
      answer: faq.answer,
      keywords: faq.keywords.join(", "),
      status: faq.status ?? "published",
    });
    setMessage("");
  }

  function editClaim(claim: ClaimItem) {
    setNewCategory(false);
    setNewSubcategory(false);
    setForm({
      id: claim.id,
      source: "claim",
      category: claim.category,
      subcategory: claim.subcategory ?? "",
      question: claim.situation,
      answer: claim.answer,
      keywords: claim.keywords.join(", "),
      status: "published",
    });
    setMessage("");
    document.getElementById("faq-edit-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function submitFaq(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("저장 중입니다...");

    const keywords = form.keywords
      .split(",")
      .map((keyword) => keyword.trim())
      .filter(Boolean);

    if (isClaimEditing) {
      const response = await fetch(`/api/claims/${form.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: form.category,
          subcategory: form.subcategory.trim(),
          situation: form.question,
          answer: form.answer,
          keywords,
          status: "live",
        }),
      });

      if (!response.ok) {
        setMessage("클레임 저장에 실패했습니다.");
        return;
      }

      setLiveClaims((current) =>
        current.map((claim) =>
          claim.id === form.id
            ? {
                ...claim,
                category: form.category,
                subcategory: form.subcategory.trim(),
                situation: form.question,
                answer: form.answer,
                keywords,
                status: "live",
              }
            : claim,
        ),
      );
      window.dispatchEvent(new Event("cs:claim-live-changed"));
      resetForm();
      setMessage("클레임 답변이 수정되었습니다.");
      return;
    }

    const payload = {
      category: form.category,
      subcategory: form.subcategory.trim(),
      question: form.question,
      answer: form.answer,
      keywords,
      status: form.status,
    };

    const response = await fetch(isEditing ? `/api/faqs/${form.id}` : "/api/faqs", {
      method: isEditing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      setMessage("저장에 실패했습니다. MongoDB 연결값을 확인해 주세요.");
      return;
    }

    const data = await response.json();
    const savedFaq = {
      id: data.faq._id ?? data.faq.id,
      category: data.faq.category,
      subcategory: data.faq.subcategory ?? "",
      question: data.faq.question,
      answer: data.faq.answer,
      keywords: data.faq.keywords ?? [],
      status: data.faq.status,
      updatedAt: data.faq.updatedAt,
    };

    setFaqs((current) =>
      isEditing ? current.map((faq) => (faq.id === form.id ? savedFaq : faq)) : [savedFaq, ...current],
    );
    resetForm();
    setMessage("저장되었습니다.");
  }

  async function deleteFaq(id: string) {
    setMessage("삭제 중입니다...");
    const response = await fetch(`/api/faqs/${id}`, { method: "DELETE" });

    if (!response.ok) {
      setMessage("삭제에 실패했습니다. MongoDB 연결값을 확인해 주세요.");
      return;
    }

    setFaqs((current) => current.filter((faq) => faq.id !== id));
    setMessage("삭제되었습니다.");
  }

  async function deleteClaim(id: string) {
    setMessage("클레임 삭제 중입니다...");
    const response = await fetch(`/api/claims/${id}`, { method: "DELETE" });

    if (!response.ok) {
      setMessage("클레임 삭제에 실패했습니다.");
      return;
    }

    setLiveClaims((current) => current.filter((claim) => claim.id !== id));
    if (form.source === "claim" && form.id === id) {
      resetForm();
    }
    window.dispatchEvent(new Event("cs:claim-live-changed"));
    setMessage("클레임이 삭제되었습니다.");
  }

  return (
    <section className="faq-admin-layout">
      <div className="admin-panel">
        <div id="faq-edit-form" className="panel-title">
          <Pencil size={20} />
          <h2>{isClaimEditing ? "고객 클레임 수정" : `FAQ ${isEditing ? "수정" : "추가"}`}</h2>
        </div>
        <div className="admin-ai-box">
          <div className="ai-title">
            <Bot size={18} />
            <strong>AI에게 물어보기</strong>
            <span>등록 여부 확인 · 답변 초안</span>
          </div>
          <form className="ai-question-form" onSubmit={askAdminAi}>
            <label className="search-field">
              <input
                value={aiQuestion}
                onChange={(event) => setAiQuestion(event.target.value)}
                placeholder="예: 비즈 보충 방법 / 환불 지연 문의"
              />
            </label>
            <button className="ai-ask-button" disabled={aiQuestion.trim().length < 2 || aiLoading} type="submit">
              {aiLoading ? <Loader2 size={16} className="spin-icon" /> : <Send size={16} />}
              AI 답변 받기
            </button>
          </form>
          {aiAnswer && (
            <button
              type="button"
              className="admin-ai-answer admin-ai-answer-click"
              onClick={() => {
                resetForm();
                setForm({
                  id: "",
                  source: "faq",
                  category: "",
                  subcategory: "",
                  question: aiQuestion,
                  answer: aiAnswer,
                  keywords: "",
                  status: "published",
                });
                setMessage("AI 답변을 FAQ 폼으로 가져왔습니다. 카테고리/유형을 선택하고 저장하세요.");
                document.getElementById("faq-edit-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              title="이 답변을 FAQ 폼으로 가져오기"
            >
              {aiAnswer}
              <span className="admin-ai-answer-hint">↓ 클릭해서 이 답변을 FAQ로 추가</span>
            </button>
          )}
        </div>
        <form className="faq-form" onSubmit={submitFaq}>
          <label>
            카테고리
            {newCategory ? (
              <span className="field-with-action">
                <input
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                  placeholder="새 카테고리 입력"
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    setNewCategory(false);
                    setForm((current) => ({ ...current, category: "" }));
                  }}
                >
                  목록 선택
                </button>
              </span>
            ) : (
              <select
                value={form.category}
                onChange={(event) => {
                  if (event.target.value === "__new__") {
                    setNewCategory(true);
                    setForm((current) => ({ ...current, category: "" }));
                  } else {
                    setForm((current) => ({ ...current, category: event.target.value }));
                  }
                }}
                required
              >
                <option value="" disabled>
                  카테고리 선택
                </option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
                <option value="__new__">+ 새 카테고리 직접 입력</option>
              </select>
            )}
          </label>
          <label>
            문의 유형
            {newSubcategory ? (
              <span className="field-with-action">
                <input
                  value={form.subcategory}
                  onChange={(event) => setForm((current) => ({ ...current, subcategory: event.target.value }))}
                  placeholder="새 문의 유형 입력"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    setNewSubcategory(false);
                    setForm((current) => ({ ...current, subcategory: "" }));
                  }}
                >
                  목록 선택
                </button>
              </span>
            ) : (
              <select
                value={form.subcategory}
                onChange={(event) => {
                  if (event.target.value === "__new__") {
                    setNewSubcategory(true);
                    setForm((current) => ({ ...current, subcategory: "" }));
                  } else {
                    setForm((current) => ({ ...current, subcategory: event.target.value }));
                  }
                }}
              >
                <option value="">선택 안 함</option>
                {subcategories.map((subcategory) => (
                  <option key={subcategory} value={subcategory}>
                    {subcategory}
                  </option>
                ))}
                <option value="__new__">+ 새 문의 유형 직접 입력</option>
              </select>
            )}
          </label>
          <label>
            질문
            <input
              value={form.question}
              onChange={(event) => setForm((current) => ({ ...current, question: event.target.value }))}
              required
            />
          </label>
          <label>
            답변
            <textarea
              value={form.answer}
              onChange={(event) => setForm((current) => ({ ...current, answer: event.target.value }))}
              required
              rows={6}
            />
          </label>
          <label>
            키워드
            <input
              value={form.keywords}
              onChange={(event) => setForm((current) => ({ ...current, keywords: event.target.value }))}
              placeholder="배송, 출고, 택배"
            />
          </label>
          {!isClaimEditing && (
            <label>
              상태
              <select
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value as FormState["status"],
                  }))
                }
              >
                <option value="published">게시중</option>
                <option value="draft">임시저장</option>
              </select>
            </label>
          )}
          <div className="form-actions">
            <button type="submit">
              <Plus size={17} />
              {isClaimEditing ? "클레임 저장" : isEditing ? "수정 저장" : "FAQ 추가"}
            </button>
            {isEditing && (
              <button type="button" onClick={resetForm}>
                취소
              </button>
            )}
          </div>
          {message && <p className="form-message">{message}</p>}
        </form>
      </div>

      <div className="admin-panel">
        <div className="panel-title">
          <h2>FAQ 목록</h2>
        </div>
        <div className="faq-search">
          <Search size={16} />
          <input
            value={faqSearch}
            onChange={(event) => setFaqSearch(event.target.value)}
            placeholder="질문·답변·키워드에서 검색"
          />
          {faqSearch && (
            <button type="button" aria-label="검색 지우기" onClick={() => setFaqSearch("")}>
              <X size={14} />
            </button>
          )}
        </div>
        {isSearching && (
          <p className="faq-search-meta">검색 결과 {faqs.filter(matchesSearch).length}건</p>
        )}
        <div className="faq-cat-list">
          {liveClaims.length > 0 && (
            <div id="faq-claim-section" className="faq-cat-group faq-claim-group">
              <button
                className="faq-cat-toggle is-claim"
                type="button"
                onClick={toggleClaimSection}
                aria-expanded={claimSectionOpen ? "true" : "false"}
              >
                <ChevronDown size={16} className={claimSectionOpen ? "" : "rot-collapsed"} />
                <span className="faq-cat-name">
                  고객 클레임
                  <small>AI 자동 카테고리 분류 · 고객에게 클레임 출처 미노출</small>
                </span>
                <span className="faq-cat-count">{liveClaims.length}</span>
              </button>
              {claimSectionOpen && (
                <div className="table">
                  {liveClaims.map((claim) => (
                    <div className="table-row" key={claim.id}>
                      <span>라이브</span>
                      <span title={claim.answer}>{claim.situation}</span>
                      <span className="row-actions">
                        <button aria-label="클레임 수정" type="button" onClick={() => editClaim(claim)}>
                          <Pencil size={16} />
                        </button>
                        <button aria-label="클레임 삭제" type="button" onClick={() => void deleteClaim(claim.id)}>
                          <Trash2 size={16} />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {faqCategories.map((category) => {
            const allItems = faqs.filter((faq) => faq.category === category);
            const items = isSearching ? allItems.filter(matchesSearch) : allItems;
            if (isSearching && items.length === 0) return null;
            const open = isSearching ? true : openCats.has(category);
            const totalPages = Math.ceil(items.length / PAGE_SIZE);
            const page = Math.min(catPage[category] ?? 1, totalPages || 1);
            const pageItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
            const isEditingCat = editingCategoryName === category;
            return (
              <div className="faq-cat-group" key={category}>
                <div className="faq-cat-header">
                  {isEditingCat ? (
                    <div className="faq-cat-edit">
                      <input
                        aria-label="새 카테고리 이름"
                        placeholder="새 카테고리 이름"
                        value={categoryDraft}
                        onChange={(e) => setCategoryDraft(e.target.value)}
                        autoFocus
                        disabled={renamingCategory}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void saveCategoryRename(category);
                          if (e.key === "Escape") { setEditingCategoryName(""); setCategoryDraft(""); }
                        }}
                      />
                      <button type="button" onClick={() => void saveCategoryRename(category)} disabled={renamingCategory}>
                        {renamingCategory ? <Loader2 size={14} className="spin-icon" /> : null}
                        저장
                      </button>
                      <button type="button" onClick={() => { setEditingCategoryName(""); setCategoryDraft(""); }} disabled={renamingCategory}>
                        취소
                      </button>
                    </div>
                  ) : (
                    <>
                      <button className="faq-cat-toggle" type="button" onClick={() => toggleCat(category)} aria-expanded={open ? "true" : "false"}>
                        <ChevronDown size={16} className={open ? "" : "rot-collapsed"} />
                        <span className="faq-cat-name">{category}</span>
                        <span className="faq-cat-count">{isSearching ? `${items.length}/${allItems.length}` : items.length}</span>
                      </button>
                      <button
                        className="faq-cat-edit-btn"
                        type="button"
                        aria-label="카테고리명 수정"
                        onClick={() => { setEditingCategoryName(category); setCategoryDraft(category); }}
                      >
                        <Pencil size={14} />
                      </button>
                    </>
                  )}
                </div>
                {open && (
                  <>
                    <div className="table">
                      {pageItems.map((faq) => {
                        const snippet = answerSnippet(faq.answer);
                        const isEditingSub = editingSubFaqId === faq.id;
                        return (
                          <div className="table-row" key={faq.id}>
                            {isEditingSub ? (
                              <span className="faq-subcat-editing">
                                <input
                                  aria-label="새 문의 유형"
                                  placeholder="새 문의 유형 (비우면 유형 없음)"
                                  value={subDraft}
                                  onChange={(e) => setSubDraft(e.target.value)}
                                  autoFocus
                                  disabled={renamingSub}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") void saveSubcategoryRename();
                                    if (e.key === "Escape") cancelEditSubcategory();
                                  }}
                                />
                                <button type="button" onClick={() => void saveSubcategoryRename()} disabled={renamingSub}>
                                  {renamingSub ? <Loader2 size={14} className="spin-icon" /> : null}
                                  저장
                                </button>
                                <button type="button" onClick={cancelEditSubcategory} disabled={renamingSub}>
                                  취소
                                </button>
                              </span>
                            ) : (
                              <>
                                <span>
                                  {faq.subcategory ? (
                                    <button
                                      className="faq-subcat-btn"
                                      type="button"
                                      onClick={() => startEditSubcategory(faq)}
                                      title="클릭해서 문의 유형명 일괄 변경"
                                    >
                                      {faq.subcategory}
                                    </button>
                                  ) : (
                                    <button
                                      className="faq-subcat-btn faq-subcat-empty"
                                      type="button"
                                      onClick={() => startEditSubcategory(faq)}
                                      title="클릭해서 문의 유형 추가"
                                    >
                                      -
                                    </button>
                                  )}
                                </span>
                                <span className="faq-row-text">
                                  <strong>{faq.question}</strong>
                                  {snippet && <em className="faq-row-snippet">답변: {snippet}</em>}
                                </span>
                              </>
                            )}
                            <span className="row-actions">
                              <button aria-label="FAQ 수정" onClick={() => editFaq(faq)} type="button">
                                <Pencil size={16} />
                              </button>
                              <button aria-label="FAQ 삭제" onClick={() => deleteFaq(faq.id)} type="button">
                                <Trash2 size={16} />
                              </button>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {totalPages > 1 && (
                      <div className="faq-pager">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                          <button
                            key={n}
                            type="button"
                            className={n === page ? "active" : ""}
                            onClick={() => setCatPage((prev) => ({ ...prev, [category]: n }))}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
