"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import type { FaqItem } from "@/lib/sample-data";

type FormState = {
  id: string;
  category: string;
  subcategory: string;
  question: string;
  answer: string;
  keywords: string;
  status: "draft" | "published" | "archived";
};

const emptyForm: FormState = {
  id: "",
  category: "",
  subcategory: "",
  question: "",
  answer: "",
  keywords: "",
  status: "published",
};

type AdminFaqManagerProps = {
  initialFaqs: FaqItem[];
};

export function AdminFaqManager({ initialFaqs }: AdminFaqManagerProps) {
  const [faqs, setFaqs] = useState(initialFaqs);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [message, setMessage] = useState("");
  const isEditing = Boolean(form.id);

  const categories = useMemo(() => Array.from(new Set(faqs.map((faq) => faq.category))).sort(), [faqs]);
  const subcategories = useMemo(
    () =>
      Array.from(
        new Set(
          faqs
            .filter((faq) => faq.category === form.category)
            .map((faq) => faq.subcategory)
            .filter(Boolean) as string[],
        ),
      ).sort(),
    [faqs, form.category],
  );

  function editFaq(faq: FaqItem) {
    setForm({
      id: faq.id,
      category: faq.category,
      subcategory: faq.subcategory ?? "",
      question: faq.question,
      answer: faq.answer,
      keywords: faq.keywords.join(", "),
      status: faq.status ?? "published",
    });
    setMessage("");
  }

  async function submitFaq(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("저장 중입니다...");

    const payload = {
      category: form.category,
      subcategory: form.subcategory.trim(),
      question: form.question,
      answer: form.answer,
      keywords: form.keywords
        .split(",")
        .map((keyword) => keyword.trim())
        .filter(Boolean),
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
    setForm(emptyForm);
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

  return (
    <section className="faq-admin-layout">
      <div className="admin-panel">
        <div className="panel-title">
          <Pencil size={20} />
          <h2>FAQ {isEditing ? "수정" : "추가"}</h2>
        </div>
        <form className="faq-form" onSubmit={submitFaq}>
          <label>
            카테고리
            <input
              list="category-options"
              value={form.category}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              required
            />
          </label>
          <datalist id="category-options">
            {categories.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
          <label>
            문의 유형
            <input
              list="subcategory-options"
              value={form.subcategory}
              onChange={(event) => setForm((current) => ({ ...current, subcategory: event.target.value }))}
              placeholder="예: 제품 이상, 사용법, 보증/부품"
            />
          </label>
          <datalist id="subcategory-options">
            {subcategories.map((subcategory) => (
              <option key={subcategory} value={subcategory} />
            ))}
          </datalist>
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
          <div className="form-actions">
            <button type="submit">
              <Plus size={17} />
              {isEditing ? "수정 저장" : "FAQ 추가"}
            </button>
            {isEditing && (
              <button type="button" onClick={() => setForm(emptyForm)}>
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
        <div className="table">
          <div className="table-row table-head">
            <span>카테고리</span>
            <span>문의 유형</span>
            <span>질문</span>
            <span>관리</span>
          </div>
          {faqs.map((faq) => (
            <div className="table-row" key={faq.id}>
              <span>{faq.category}</span>
              <span>{faq.subcategory || "-"}</span>
              <span>{faq.question}</span>
              <span className="row-actions">
                <button aria-label="FAQ 수정" onClick={() => editFaq(faq)} type="button">
                  <Pencil size={16} />
                </button>
                <button aria-label="FAQ 삭제" onClick={() => deleteFaq(faq.id)} type="button">
                  <Trash2 size={16} />
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
