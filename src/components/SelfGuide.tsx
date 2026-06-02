"use client";

import Image from "next/image";
import {
  ArrowLeft,
  Bot,
  Check,
  ChevronRight,
  Headphones,
  Loader2,
  MessageCircle,
  Phone,
  Search,
  Send,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { RichAnswer } from "@/components/RichAnswer";
import { getSessionId } from "@/lib/session";
import type { FaqItem } from "@/lib/sample-data";

type ChannelCopy = {
  name: string;
  greeting: string;
  closingMessage: string;
  kakaoUrl: string;
  phoneNumber: string;
};

type SelfGuideProps = {
  channel: string;
  channelCopy: ChannelCopy;
  faqs: FaqItem[];
};

type AiAnswer = {
  status: "answered" | "answered_handoff" | "needs_handoff";
  answer: string;
  sources: Array<{
    id: string;
    question: string;
    category: string;
    subcategory?: string;
  }>;
  suggestions: Array<{
    id: string;
    question: string;
    category: string;
    subcategory?: string;
  }>;
};

export function SelfGuide({ channel, channelCopy, faqs }: SelfGuideProps) {
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [selectedFaqId, setSelectedFaqId] = useState("");
  const [query, setQuery] = useState("");
  const [aiAnswer, setAiAnswer] = useState<AiAnswer | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [feedback, setFeedback] = useState<"positive" | "negative" | "">("");
  const [resolved, setResolved] = useState(false);
  const [questionFilter, setQuestionFilter] = useState("");
  const aiAnswerRef = useRef<HTMLDivElement>(null);
  const loggedNoResultFilters = useRef<Set<string>>(new Set());

  const categories = useMemo(() => Array.from(new Set(faqs.map((faq) => faq.category))), [faqs]);
  const categoryFaqs = useMemo(() => faqs.filter((faq) => faq.category === category), [category, faqs]);
  const subcategories = useMemo(
    () => Array.from(new Set(categoryFaqs.map((faq) => faq.subcategory).filter(Boolean) as string[])),
    [categoryFaqs],
  );
  const needsSubcategory = subcategories.length > 0;
  const visibleFaqs =
    needsSubcategory && subcategory
      ? categoryFaqs.filter((faq) => faq.subcategory === subcategory)
      : needsSubcategory
        ? []
        : categoryFaqs;
  const filterText = questionFilter.trim().toLowerCase();
  const displayedFaqs = filterText
    ? visibleFaqs.filter((faq) =>
        `${faq.question} ${faq.keywords.join(" ")}`.toLowerCase().includes(filterText),
      )
    : visibleFaqs;
  const selectedFaq = faqs.find((faq) => faq.id === selectedFaqId);
  const currentStep = selectedFaq ? "answer" : category ? "question" : "category";
  const questionHeading = needsSubcategory && !subcategory ? `${category} 유형을 선택해 주세요.` : "이 중에서 가까운 질문을 골라주세요.";
  const headerTitle = currentStep === "category"
    ? "A/S문의를 도와드릴게요"
    : selectedFaq
      ? "답변을 확인해 주세요"
      : `${category}를 도와드릴게요`;
  const headerDescription = subcategory
      ? `${subcategory} 관련 질문만 정리했어요.`
      : "원하는 유형을 고르면 관련 질문만 보여드릴게요.";

  function logEvent(eventType: string, payload: Record<string, unknown> = {}) {
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, sessionId: getSessionId(), eventType, ...payload }),
    });
  }

  useEffect(() => {
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, sessionId: getSessionId(), eventType: "visit" }),
    });
  }, [channel]);

  useEffect(() => {
    const queryText = questionFilter.trim();
    if (queryText.length < 2 || visibleFaqs.length === 0 || displayedFaqs.length > 0) {
      return;
    }

    const key = `${channel}|${category}|${subcategory}|${queryText.toLowerCase()}`;
    if (loggedNoResultFilters.current.has(key)) {
      return;
    }

    const timer = window.setTimeout(() => {
      loggedNoResultFilters.current.add(key);
      logEvent("no_result", {
        category,
        query: queryText,
        metadata: { source: "question_filter", subcategory },
      });
    }, 800);

    return () => window.clearTimeout(timer);
  }, [category, channel, displayedFaqs.length, questionFilter, subcategory, visibleFaqs.length]);

  function chooseCategory(nextCategory: string) {
    setCategory(nextCategory);
    setSubcategory("");
    setSelectedFaqId("");
    setFeedback("");
    setResolved(false);
    setQuery("");
    setAiAnswer(null);
    logEvent("category_view", { category: nextCategory });
  }

  function goBack() {
    if (selectedFaqId) {
      setSelectedFaqId("");
      setFeedback("");
    setResolved(false);
      return;
    }

    if (subcategory) {
      setSubcategory("");
      setAiAnswer(null);
      return;
    }

    if (category) {
      setCategory("");
      setQuery("");
      setAiAnswer(null);
    }
  }

  function resetGuide() {
    setCategory("");
    setSubcategory("");
    setSelectedFaqId("");
    setQuery("");
    setAiAnswer(null);
    setFeedback("");
    setResolved(false);
  }

  function chooseSubcategory(nextSubcategory: string) {
    setSubcategory(nextSubcategory);
    setSelectedFaqId("");
    setFeedback("");
    setResolved(false);
    setAiAnswer(null);
    logEvent("subcategory_view", { category, subcategory: nextSubcategory });
  }

  function chooseFaq(faqId: string) {
    setSelectedFaqId(faqId);
    setFeedback("");
    setResolved(false);
    setAiAnswer(null);
    logEvent("question_view", { faqId });
  }

  function submitFeedback(helpful: boolean) {
    if (!selectedFaq) {
      return;
    }

    setFeedback(helpful ? "positive" : "negative");
    void fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, sessionId: getSessionId(), faqId: selectedFaq.id, helpful }),
    });
  }

  function markResolved() {
    if (!selectedFaq) {
      return;
    }
    setResolved(true);
    logEvent("resolved", { faqId: selectedFaq.id });
  }

  async function askAi(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (query.trim().length < 2 || aiLoading) {
      return;
    }

    setAiLoading(true);
    setAiAnswer(null);

    try {
      const response = await fetch("/api/ai-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          sessionId: getSessionId(),
          category,
          subcategory,
          query,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("AI query failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let scrolled = false;

      const scrollToAnswer = () => {
        if (scrolled) {
          return;
        }
        scrolled = true;
        window.setTimeout(() => {
          aiAnswerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 50);
      };

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
          const message = JSON.parse(raw) as
            | { type: "meta"; status: AiAnswer["status"]; answer?: string; sources: AiAnswer["sources"]; suggestions: AiAnswer["suggestions"] }
            | { type: "delta"; text: string }
            | { type: "done" };

          if (message.type === "meta") {
            setAiAnswer({
              status: message.status,
              answer: message.answer ?? "",
              sources: message.sources ?? [],
              suggestions: message.suggestions ?? [],
            });
            scrollToAnswer();
          } else if (message.type === "delta") {
            setAiAnswer((prev) => (prev ? { ...prev, answer: prev.answer + message.text } : prev));
          }
        }
      }
    } catch {
      setAiAnswer({
        status: "needs_handoff",
        answer: "답변을 불러오지 못했습니다. 잠시 후 다시 시도하시거나 상담으로 문의해 주세요.",
        sources: [],
        suggestions: [],
      });
      window.setTimeout(() => {
        aiAnswerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <main className="guide-shell">
      <section className="guide-header compact">
        <div className="guide-avatar">
          <Image
            src="https://yogibo.openhost.cafe24.com/web/test/tmp-3922227795.webp"
            alt=""
            aria-hidden="true"
            width={96}
            height={96}
            priority
          />
        </div>
        <div className="guide-copy">
          <h1>{headerTitle}</h1>
          <p>{headerDescription}</p>
        </div>
      </section>

      <section className="mobile-step-view" aria-label="FAQ 탐색 단계">
        {currentStep !== "category" && (
          <button className="back-button" onClick={goBack} type="button">
            <ArrowLeft size={18} />
            이전
          </button>
        )}

        {currentStep === "category" && (
          <div className="step-panel">
            <div className="direct-question">
              <div className="step-title">
                <Bot size={20} />
                <h2>AI에게 바로 질문하기</h2>
              </div>
              <p>키워드나 문장으로 직접 질문해 보세요. 등록된 FAQ 안에서 가장 가까운 답변을 찾아드립니다.</p>
              <form className="ai-question-form ai-question-form--inline" onSubmit={askAi}>
                <label className="search-field">
                  <Search size={18} />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="예: 비즈를 보충하고 싶어요"
                  />
                </label>
                <button disabled={query.trim().length < 2 || aiLoading} type="submit" aria-label="AI에게 직접 질문하기">
                  {aiLoading ? <Loader2 size={18} className="spin-icon" /> : <Send size={18} />}
                </button>
              </form>
              {aiAnswer && (
                <div
                  className={aiAnswer.status === "answered" ? "ai-answer" : "ai-answer needs-handoff"}
                  ref={aiAnswerRef}
                >
                  <div className="ai-answer-head">
                    <Bot size={18} />
                    <strong>AI 답변</strong>
                  </div>
                  <RichAnswer text={aiAnswer.answer} />
                  {aiAnswer.sources.length > 0 && (
                    <div className="source-list">
                      <strong>참고한 FAQ</strong>
                      {aiAnswer.sources.map((source) => (
                        <button key={source.id} onClick={() => chooseFaq(source.id)} type="button">
                          {source.subcategory && <span>{source.subcategory}</span>}
                          {source.question}
                        </button>
                      ))}
                    </div>
                  )}
                  {aiAnswer.suggestions.length > 0 && aiAnswer.sources.length === 0 && (
                    <div className="source-list">
                      <strong>가까운 질문</strong>
                      {aiAnswer.suggestions.map((suggestion) => (
                        <button key={suggestion.id} onClick={() => chooseFaq(suggestion.id)} type="button">
                          {suggestion.question}
                        </button>
                      ))}
                    </div>
                  )}
                  {aiAnswer.status !== "answered" && (
                    <div className="ai-contact-actions">
                      <a href={channelCopy.kakaoUrl} onClick={() => logEvent("contact_click", { metadata: { method: "kakao" } })}>
                        상담톡에서 이어서 확인하기
                      </a>
                      <a href={`tel:${channelCopy.phoneNumber}`} onClick={() => logEvent("contact_click", { metadata: { method: "phone" } })}>
                        <Phone size={15} />
                        {channelCopy.phoneNumber}
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="browse-block">
              <div className="step-title compact-title">
                <h2>또는 문의 종류 선택</h2>
              </div>
              <div className="option-list">
                {categories.map((item) => (
                  <button
                    className={item === category ? "option active" : "option"}
                    key={item}
                    onClick={() => chooseCategory(item)}
                    type="button"
                  >
                    {item}
                    <ChevronRight size={18} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentStep === "question" && (
          <div className="step-panel">
          <div className="selection-context">
            <button onClick={resetGuide} type="button">{category}</button>
            {subcategory && <button onClick={() => setSubcategory("")} type="button">{subcategory}</button>}
          </div>
          <div className="step-title">
            <h2>{questionHeading}</h2>
          </div>
          {category ? (
            <>
              {needsSubcategory && !subcategory && (
                <div className="option-list">
                  {subcategories.map((item) => (
                    <button
                      className={item === subcategory ? "option active" : "option"}
                      key={item}
                      onClick={() => chooseSubcategory(item)}
                      type="button"
                    >
                      {item}
                      <ChevronRight size={18} />
                    </button>
                  ))}
                </div>
              )}
              {visibleFaqs.length > 5 && (
                <label className="search-field list-filter">
                  <Search size={18} />
                  <input
                    value={questionFilter}
                    onChange={(event) => setQuestionFilter(event.target.value)}
                    placeholder="질문 검색으로 빠르게 찾기"
                  />
                </label>
              )}
              {displayedFaqs.length > 0 && (
                <div className="option-list">
                  {displayedFaqs.map((faq) => (
                    <button
                      className={faq.id === selectedFaqId ? "option active" : "option"}
                      key={faq.id}
                      onClick={() => chooseFaq(faq.id)}
                      type="button"
                    >
                      {faq.question}
                      <ChevronRight size={18} />
                    </button>
                  ))}
                </div>
              )}
              {visibleFaqs.length > 0 && displayedFaqs.length === 0 && (
                <p className="empty-state">검색 결과가 없어요. 아래에서 AI에게 직접 물어보세요.</p>
              )}
              {visibleFaqs.length === 0 && !needsSubcategory && (
                <p className="empty-state">등록된 세부 질문이 없습니다.</p>
              )}
              {needsSubcategory && !subcategory && (
                <p className="empty-state">
                  먼저 문의 유형을 선택하면 관련 질문만 정리해서 보여드릴게요.
                </p>
              )}
              <div className="ai-box">
                <div className="ai-title">
                  <Bot size={18} />
                  <strong>원하는 답변을 찾지 못하셨나요?</strong>
                </div>
                <p>키워드나 문장으로 직접 질문해 보세요. 등록된 FAQ 안에서 가장 가까운 답변을 찾아드립니다.</p>
                <form className="ai-question-form" onSubmit={askAi}>
                  <label className="search-field">
                    <Search size={18} />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="예: 비즈를 보충하고 싶어요"
                    />
                  </label>
                  <button className="ai-ask-button" disabled={query.trim().length < 2 || aiLoading} type="submit">
                    {aiLoading ? <Loader2 size={18} className="spin-icon" /> : <Send size={18} />}
                    AI에게 직접 질문하기
                  </button>
                </form>
                {aiAnswer && (
                  <div
                    className={aiAnswer.status === "answered" ? "ai-answer" : "ai-answer needs-handoff"}
                    ref={aiAnswerRef}
                  >
                    <div className="ai-answer-head">
                      <Bot size={18} />
                      <strong>AI 답변</strong>
                    </div>
                    <RichAnswer text={aiAnswer.answer} />
                    {aiAnswer.sources.length > 0 && (
                      <div className="source-list">
                        <strong>참고한 FAQ</strong>
                        {aiAnswer.sources.map((source) => (
                          <button key={source.id} onClick={() => chooseFaq(source.id)} type="button">
                            {source.subcategory && <span>{source.subcategory}</span>}
                            {source.question}
                          </button>
                        ))}
                      </div>
                    )}
                    {aiAnswer.suggestions.length > 0 && aiAnswer.sources.length === 0 && (
                      <div className="source-list">
                        <strong>가까운 질문</strong>
                        {aiAnswer.suggestions.map((suggestion) => (
                          <button key={suggestion.id} onClick={() => chooseFaq(suggestion.id)} type="button">
                            {suggestion.question}
                          </button>
                        ))}
                      </div>
                    )}
                    {aiAnswer.status !== "answered" && (
                      <div className="ai-contact-actions">
                        <a href={channelCopy.kakaoUrl} onClick={() => logEvent("contact_click", { metadata: { method: "kakao" } })}>
                          상담톡에서 이어서 확인하기
                        </a>
                        <a href={`tel:${channelCopy.phoneNumber}`} onClick={() => logEvent("contact_click", { metadata: { method: "phone" } })}>
                          <Phone size={15} />
                          {channelCopy.phoneNumber}
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="empty-state">먼저 카테고리를 선택해 주세요.</p>
          )}
          </div>
        )}

        {currentStep === "answer" && (
          <div className="step-panel answer-panel">
          <div className="selection-context">
            <button onClick={resetGuide} type="button">{selectedFaq?.category}</button>
            {selectedFaq?.subcategory && <button onClick={goBack} type="button">{selectedFaq.subcategory}</button>}
          </div>
          {selectedFaq ? (
            <>
              <h3>{selectedFaq.question}</h3>
              {channelCopy.greeting && <p className="answer-greeting">{channelCopy.greeting}</p>}
              <RichAnswer text={selectedFaq.answer} />
              {channelCopy.closingMessage && <p className="answer-closing">{channelCopy.closingMessage}</p>}
              <div className="resolve-box">
                {resolved ? (
                  <p className="resolve-done">
                    <Check size={16} />
                    해결되어 다행이에요! 이용해 주셔서 감사합니다.
                  </p>
                ) : (
                  <>
                    <span>이 답변으로 궁금증이 해결되셨나요?</span>
                    <button className="resolve-button" onClick={markResolved} type="button">
                      <Check size={16} />네, 해결됐어요
                    </button>
                  </>
                )}
              </div>
              <div className="feedback-row" aria-label="만족도">
                <button
                  className={feedback === "positive" ? "feedback active" : "feedback"}
                  onClick={() => submitFeedback(true)}
                  type="button"
                >
                  <ThumbsUp size={17} />
                  좋아요
                </button>
                <button
                  className={feedback === "negative" ? "feedback active" : "feedback"}
                  onClick={() => submitFeedback(false)}
                  type="button"
                >
                  <ThumbsDown size={17} />
                  아쉬워요
                </button>
              </div>
              {feedback && (
                <p className="feedback-note">
                  <Check size={16} />
                  의견이 기록되었습니다. 답변 품질 개선에 반영할게요.
                </p>
              )}
              <div className="contact-box">
                <div className="contact-head">
                  <span className="contact-head-icon">
                    <Headphones size={18} />
                  </span>
                  <div className="contact-head-copy">
                    <strong>아직 궁금한 점이 있으신가요?</strong>
                    <span>채팅으로 남겨주시면 상담원이 순서대로 답변드려요.</span>
                  </div>
                </div>
                <div className="contact-actions">
                  <a
                    className="contact-cta contact-cta-primary"
                    href={channelCopy.kakaoUrl}
                    onClick={() => logEvent("contact_click", { metadata: { method: "kakao" } })}
                  >
                    <MessageCircle size={18} />
                    카카오톡으로 문의하기
                  </a>
                  <a
                    className="contact-cta contact-cta-ghost"
                    href={`tel:${channelCopy.phoneNumber}`}
                    onClick={() => logEvent("contact_click", { metadata: { method: "phone" } })}
                  >
                    <Phone size={15} />
                    전화 상담 {channelCopy.phoneNumber}
                  </a>
                </div>
              </div>
            </>
          ) : (
            <p className="empty-state">질문을 선택하면 답변과 상담 연결 안내가 표시됩니다.</p>
          )}
          </div>
        )}
      </section>
    </main>
  );
}
