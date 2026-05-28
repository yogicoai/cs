export function inferFaqSubcategory(category: string, question: string, keywords: string[] = []) {
  const source = [question, ...keywords].join(" ");

  if (category === "A/S문의") {
    if (/365|케어/.test(source)) {
      return "365 케어서비스";
    }

    if (/보증|불량|하자|손상|가루|냄새|변색|오염|이염/.test(source)) {
      return "제품 하자/보증";
    }

    if (/충전|리필|비즈|꺼졌|숨이 죽/.test(source)) {
      return "충전재/리필";
    }

    if (/지퍼|슬라이더|부품/.test(source)) {
      return "지퍼/부품";
    }

    if (/폐기|관리|유의/.test(source)) {
      return "제품 관리/폐기";
    }

    if (/접수|신청|제품명|사진|영상|방문/.test(source)) {
      return "A/S 접수";
    }

    return "기타 A/S";
  }

  if (category === "제품정보") {
    if (/추천|가구|의자|소파|가격대|상품 추천/.test(source)) {
      return "제품 추천";
    }

    if (/커버|방수|소재|면 소재|믹스|럭스|줄라|카카오프렌즈/.test(source)) {
      return "커버/소재";
    }

    if (/사이즈|무게|라벨|크기|치수/.test(source)) {
      return "사이즈/규격";
    }

    if (/제조|수입|생산|유해|인체|안전/.test(source)) {
      return "제조/안전";
    }

    if (/품절|예약|색상|재입고/.test(source)) {
      return "재고/색상";
    }

    if (/물 위|열감|촉감|부피|꺼짐|사용/.test(source)) {
      return "사용감/특성";
    }

    return "기타 제품정보";
  }

  if (category === "세탁방법") {
    if (/서비스|맡길/.test(source)) {
      return "세탁 서비스";
    }

    if (/이너|충전재|건조기|세탁기|수령|세탁 후|세탁 시|세탁이 가능/.test(source)) {
      return "공통 세탁 기준";
    }

    if (/러그|슬리퍼|쿠션|헤드피스|바디|도기보|요가보|요기박스|코지보|타블로|마이너스|마이스터|원더|허그|박스/.test(source)) {
      return "제품별 세탁";
    }

    return "기타 세탁";
  }

  if (category === "홈페이지") {
    if (/쿠폰|할인|프로모션|적립금|이벤트/.test(source)) {
      return "쿠폰/혜택";
    }

    if (/주문|결제|취소|결제수단|색상 변경/.test(source)) {
      return "주문/결제";
    }

    if (/추천|가구|의자|소파|메이트|충전재별/.test(source)) {
      return "제품 추천";
    }

    if (/매장|점|스타필드|롯데|신세계|현대|대구|부산|고양|하남|동탄|안산|미아/.test(source)) {
      return "매장 안내";
    }

    return "기타 홈페이지";
  }

  if (category === "배송안내") {
    if (/주소|연락처|수령인|배송정보|잘못 입력/.test(source)) {
      return "배송정보 변경";
    }

    if (/언제|당일|출고|예약배송|원하는 날짜/.test(source)) {
      return "출고/도착 일정";
    }

    if (/배송비|제주|도서산간|합배송/.test(source)) {
      return "배송비";
    }

    if (/누락|못했|받지 못|잘못 배송|박스|카달로그|품질보증서|개봉/.test(source)) {
      return "배송 문제";
    }

    if (/매장|픽업|해외/.test(source)) {
      return "픽업/해외배송";
    }

    return "기타 배송";
  }

  if (category === "교환/환불") {
    if (/접수|택배|규정|불가능/.test(source)) {
      return "접수/규정";
    }

    if (/쿠폰|적립금|환불 진행/.test(source)) {
      return "환불/혜택";
    }

    if (/하자|교환|변심|색상|사이즈/.test(source)) {
      return "교환 사유";
    }

    if (/고객센터|문의/.test(source)) {
      return "문의 방법";
    }

    return "기타 교환/환불";
  }

  if (category === "일반문의") {
    if (/추천|커버|충전재|구매/.test(source)) {
      return "구매 전 상담";
    }

    if (/견적|단체|업체|기관|학교/.test(source)) {
      return "단체/견적";
    }

    if (/캠페인|온라인 몰|매장/.test(source)) {
      return "브랜드/매장";
    }

    return "기타 일반문의";
  }

  return "";
}
