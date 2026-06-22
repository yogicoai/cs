"use client";

import {
  BarChart3,
  PhoneCall,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
  TrendingUp,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type GroupBy = "day" | "week" | "month";

type TrendBucket = {
  date: string;
  visit: number;
  question_view: number;
  contact_click: number;
  ai_query: number;
  no_result: number;
  resolved: number;
  feedback_positive: number;
  feedback_negative: number;
};

type Analytics = {
  range: { groupBy: GroupBy; days: number; since: string; until: string };
  summary: {
    visits: number;
    sessions: number;
    questionViews: number;
    contactClicks: number;
    kakaoClicks: number;
    phoneClicks: number;
    aiQueries: number;
    noResults: number;
    resolved: number;
    feedbackPositive: number;
    feedbackNegative: number;
    satisfactionRate: number;
    deflectionRate: number;
    resolutionRate: number;
  };
  trend: TrendBucket[];
  topQuestions: Array<{ faqId: string; question: string; category: string; views: number }>;
  topNoResults: Array<{ query: string; count: number }>;
  topSearchKeywords: Array<{ query: string; count: number }>;
  byChannel: Array<{ channel: string; visits: number; contactClicks: number; satisfactionRate: number }>;
};

const PERIODS: Array<{ key: GroupBy; label: string }> = [
  { key: "day", label: "일별" },
  { key: "week", label: "주별" },
  { key: "month", label: "월별" },
];

const CHANNEL_LABELS: Record<string, string> = {
  ownmall: "자사몰",
  marketplace: "외부몰",
  chat: "채팅상담",
  "29cm": "29CM",
};

function channelLabel(slug: string) {
  return CHANNEL_LABELS[slug] ?? slug;
}

function ymd(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function formatBucket(dateIso: string, groupBy: GroupBy) {
  const [year, month, day] = dateIso.slice(0, 10).split("-");
  if (groupBy === "month") return `${year}.${month}`;
  if (groupBy === "week") return `${month}/${day}~`;
  return `${month}/${day}`;
}


function KeywordList({ items, empty }: { items: Array<{ query: string; count: number }>; empty: string }) {
  if (items.length === 0) return <p className="empty-state">{empty}</p>;
  return (
    <ol className="rank-list">
      {items.map((item) => (
        <li key={item.query}>
          <span className="rank-text">{item.query}</span>
          <span className="rank-count">{item.count}</span>
        </li>
      ))}
    </ol>
  );
}

export function EngagementDashboard({ faqCount }: { faqCount: number }) {
  const [groupBy, setGroupBy] = useState<GroupBy>("day");
  const [from, setFrom] = useState(() => ymd(new Date()));
  const [to, setTo] = useState(() => ymd(new Date()));
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/analytics?groupBy=${groupBy}&from=${from}&to=${to}`, { cache: "no-store" });
      if (!response.ok) throw new Error("failed");
      setData((await response.json()) as Analytics);
    } catch {
      setError("데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [groupBy, from, to]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const summary = data?.summary;
  const trend = data?.trend ?? [];
  const trendMax = Math.max(1, ...trend.map((b) => Math.max(b.visit, b.question_view, b.contact_click, b.resolved)));

  const cards = [
    { label: "등록 FAQ", value: String(faqCount), icon: BarChart3, hint: "현재 운영 문항" },
    { label: "세션", value: summary ? String(summary.sessions) : "—", icon: Users, hint: `방문 ${summary?.visits ?? 0}` },
    { label: "자가해결률", value: summary ? `${summary.deflectionRate}%` : "—", icon: ShieldCheck, hint: "세션 중 상담 미연결" },
    { label: "해결 전환율", value: summary ? `${summary.resolutionRate}%` : "—", icon: ThumbsUp, hint: `'해결됐어요' ${summary?.resolved ?? 0}회` },
    { label: "전화 클릭", value: summary ? String(summary.phoneClicks) : "—", icon: PhoneCall, hint: `카카오 ${summary?.kakaoClicks ?? 0}` },
    { label: "AI 직접질문", value: summary ? String(summary.aiQueries) : "—", icon: Sparkles, hint: `검색 실패 ${summary?.noResults ?? 0}` },
  ];

  return (
    <section className="dashboard">
      <div className="dashboard-head">
        <div className="panel-title">
          <TrendingUp size={20} />
          <h2>참여도 대시보드</h2>
        </div>
        <div className="dashboard-controls">
          <div className="date-range">
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} aria-label="시작일" />
            <span>~</span>
            <input type="date" value={to} min={from} max={ymd(new Date())} onChange={(e) => setTo(e.target.value)} aria-label="종료일" />
          </div>
          <div className="period-toggle" role="tablist" aria-label="집계 단위">
            {PERIODS.map((period) => (
              <button
                key={period.key}
                className={period.key === groupBy ? "active" : ""}
                onClick={() => setGroupBy(period.key)}
                type="button"
                role="tab"
                aria-selected={period.key === groupBy}
              >
                {period.label}
              </button>
            ))}
          </div>
          <button className="icon-button" onClick={() => loadAnalytics()} type="button" aria-label="새로고침">
            <RefreshCw size={16} className={loading ? "spin-icon" : ""} />
          </button>
        </div>
      </div>

      {error ? (
        <p className="empty-state">{error}</p>
      ) : (
        <>
          <div className="metric-grid">
            {cards.map((card) => (
              <article className="metric-card" key={card.label}>
                <div className="metric-top">
                  <card.icon size={16} />
                  <span>{card.label}</span>
                </div>
                <strong>{card.value}</strong>
                <small>{card.hint}</small>
              </article>
            ))}
          </div>

          <div className="dashboard-panel trend-panel">
            <h3>방문·열람·상담·해결 추세</h3>
            <div className="trend-legend">
              <span className="dot visit" /> 방문
              <span className="dot view" /> 열람
              <span className="dot resolved" /> 해결
              <span className="dot contact" /> 상담클릭
            </div>
            {trend.length === 0 ? (
              <p className="empty-state">기간 내 데이터가 없습니다.</p>
            ) : (
              <div className="trend-chart">
                {trend.map((bucket) => (
                  <div className="trend-col" key={bucket.date} title={`${bucket.date.slice(0, 10)} · 방문 ${bucket.visit} / 열람 ${bucket.question_view} / 해결 ${bucket.resolved} / 상담 ${bucket.contact_click}`}>
                    <div className="trend-bars">
                      <span className="bar visit" style={{ height: `${(bucket.visit / trendMax) * 100}%` }} />
                      <span className="bar view" style={{ height: `${(bucket.question_view / trendMax) * 100}%` }} />
                      <span className="bar resolved" style={{ height: `${(bucket.resolved / trendMax) * 100}%` }} />
                      <span className="bar contact" style={{ height: `${(bucket.contact_click / trendMax) * 100}%` }} />
                    </div>
                    <span className="trend-label">{formatBucket(bucket.date, groupBy)}</span>
                  </div>
                ))}
              </div>
            )}
            {data && data.byChannel.length > 0 && (
              <div className="channel-row">
                {data.byChannel.map((ch) => (
                  <div className="channel-chip" key={ch.channel}>
                    <strong>{channelLabel(ch.channel)}</strong>
                    <span>방문 {ch.visits} · 상담 {ch.contactClicks} · 만족 {ch.satisfactionRate}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="list-grid">
            <div className="dashboard-panel">
              <h3><Search size={16} /> 인기 검색어 <small>수요</small></h3>
              <KeywordList items={data?.topSearchKeywords ?? []} empty="검색 기록이 없습니다." />
            </div>
            <div className="dashboard-panel">
              <h3><Search size={16} /> 미해결 검색어 <small>FAQ 보강 후보</small></h3>
              <KeywordList items={data?.topNoResults ?? []} empty="미해결 검색 기록이 없습니다." />
            </div>
            <div className="dashboard-panel">
              <h3><BarChart3 size={16} /> 많이 본 질문</h3>
              {data && data.topQuestions.length > 0 ? (
                <ol className="rank-list">
                  {data.topQuestions.map((item) => (
                    <li key={item.faqId}>
                      <span className="rank-text">{item.category && <em>{item.category}</em>}{item.question}</span>
                      <span className="rank-count">{item.views}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="empty-state">열람 기록이 없습니다.</p>
              )}
            </div>
          </div>

        </>
      )}
    </section>
  );
}
