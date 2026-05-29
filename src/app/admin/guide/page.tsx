import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  FileSpreadsheet,
  MessageCircle,
  Pencil,
  Phone,
  Search,
  Sparkles,
  Users,
} from "lucide-react";

const CUSTOMER_STEPS = [
  { title: "카테고리 선택", desc: "A/S문의 · 교환/환불 · 배송안내 등" },
  { title: "세부 유형 선택", desc: "카테고리 안에서 문의 유형을 좁힘" },
  { title: "답변 확인", desc: "인삿말·답변·마무리 멘트가 상담 답변처럼 표시" },
  { title: "AI에게 직접 질문", desc: "못 찾으면 키워드·문장으로 질문 → FAQ·승인 클레임 근거로 즉시 답변" },
  { title: "상담 연결", desc: "부족할 때만 카카오(우선)·전화로 연결" },
  { title: "해결 확인", desc: "‘네, 해결됐어요’ 버튼으로 해결 여부 표시" },
];

const ADMIN_CARDS = [
  {
    icon: Pencil,
    title: "FAQ 관리",
    points: [
      "추가/수정/삭제 (삭제는 보관 처리, 변경 이력 자동 기록)",
      "카테고리는 드롭다운 선택 또는 새로 직접 입력",
      "목록은 카테고리별 접기/펼치기 · 10개 초과 시 페이지네이션",
      "‘AI에게 물어보기’로 중복 확인·답변 초안 활용",
    ],
  },
  {
    icon: BarChart3,
    title: "참여도 대시보드",
    points: [
      "달력 기간 선택 + 일별/주별/월별 전환",
      "자가해결률(상담 미연결) · 해결 전환율 · 전화 클릭 · 세션",
      "인기 검색어 / 미해결 검색어(FAQ 보강 1순위) / 많이 본 질문",
    ],
  },
  {
    icon: Sparkles,
    title: "AI 데이터 분석",
    points: ["[AI 분석 받기] → 핵심 요약 · 콜 유발 약점 · 우선 개선 액션 · 추세 코멘트"],
  },
  {
    icon: FileSpreadsheet,
    title: "고객 클레임 관리",
    points: [
      "과거 문의·CS응대 이력을 자산화 (고객 탐색엔 비노출)",
      "AI가 카테고리 분류 + 맞춤 추천 답변 제안",
      "CS 검토·확정 후 ‘라이브’ 전환 시에만 AI 응대에 사용",
    ],
  },
];

const CLAIM_PIPELINE = [
  { title: "엑셀 업로드", desc: "고객문의 · CS답변 2열" },
  { title: "AI 답변 들어보기", desc: "FAQ + CS답변 기반 추천·자동 분류" },
  { title: "CS 더블체크", desc: "최종 답변 확정" },
  { title: "라이브 전환", desc: "그때부터 AI 응대에 사용" },
];

const OPS_LOOP = [
  "대시보드에서 미해결 검색어 · 낮은 만족도 항목 확인",
  "FAQ 추가·수정 또는 클레임 업로드·라이브 전환으로 보강",
  "다음 기간 지표(자가해결률·해결 전환율↑, 전화 클릭↓)로 효과 확인",
  "반복 → 콜·채팅 인입을 지속적으로 줄여 나감",
];

export default function AdminGuidePage() {
  return (
    <main className="admin-shell guide-page">
      <Link href="/admin" className="guide-back">
        <ArrowLeft size={16} />
        어드민으로 돌아가기
      </Link>

      <header className="guide-hero">
        <p className="eyebrow">Admin · 사용 가이드</p>
        <h1>어드민 사용 가이드</h1>
        <p>고객 셀프 상담 가이드 운영과 상담 지표 관리를 위한 안내서입니다.</p>
      </header>

      <section className="guide-block">
        <div className="guide-block-head">
          <Users size={20} />
          <h2>고객 이용 흐름</h2>
        </div>
        <ol className="flow-steps">
          {CUSTOMER_STEPS.map((step, index) => (
            <li className="flow-step" key={step.title}>
              <span className="flow-num">{index + 1}</span>
              <strong>{step.title}</strong>
              <p>{step.desc}</p>
            </li>
          ))}
        </ol>
        <div className="flow-note">
          <MessageCircle size={15} />
          단순 문의는 앱에서 끝내고, 꼭 필요한 경우에만 상담으로 연결되도록 설계되어 있습니다.
        </div>
      </section>

      <section className="guide-block">
        <div className="guide-block-head">
          <BarChart3 size={20} />
          <h2>어드민 기능</h2>
        </div>
        <div className="guide-cards">
          {ADMIN_CARDS.map((card) => (
            <article className="guide-card" key={card.title}>
              <div className="guide-card-head">
                <card.icon size={18} />
                <h3>{card.title}</h3>
              </div>
              <ul>
                {card.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="guide-block">
        <div className="guide-block-head">
          <FileSpreadsheet size={20} />
          <h2>고객 클레임 큐레이션 흐름</h2>
        </div>
        <p className="guide-lead">
          답변 작성 시 <strong>AI가 해당 클레임에 맞춘 응답을 제안</strong>하고, CS가 확정·라이브 전환한 답변만 고객에게 전달됩니다.
          이 데이터는 <strong>고객 탐색 화면에는 절대 노출되지 않습니다.</strong>
        </p>
        <div className="pipeline">
          {CLAIM_PIPELINE.map((step, index) => (
            <div className="pipe-item" key={step.title}>
              <div className="pipe-step">
                <strong>{step.title}</strong>
                <span>{step.desc}</span>
              </div>
              {index < CLAIM_PIPELINE.length - 1 && <ArrowRight className="pipe-arrow" size={18} />}
            </div>
          ))}
        </div>
      </section>

      <section className="guide-block">
        <div className="guide-block-head">
          <CheckCircle2 size={20} />
          <h2>운영 루프 (권장)</h2>
        </div>
        <ol className="ops-loop">
          {OPS_LOOP.map((item, index) => (
            <li key={item}>
              <span className="ops-num">{index + 1}</span>
              {item}
            </li>
          ))}
        </ol>
      </section>

      <section className="guide-block guide-contacts">
        <div className="guide-block-head">
          <Search size={20} />
          <h2>핵심 지표 한눈에</h2>
        </div>
        <div className="guide-metric-row">
          <div className="guide-metric"><Phone size={15} /> 전화 클릭 ↓ = 콜 감소</div>
          <div className="guide-metric"><CheckCircle2 size={15} /> 자가해결률 ↑</div>
          <div className="guide-metric"><Sparkles size={15} /> 해결 전환율 ↑</div>
        </div>
      </section>
    </main>
  );
}
