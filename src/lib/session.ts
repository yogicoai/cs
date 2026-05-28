const SESSION_KEY = "cs_sid";

// 한 방문(탭 세션) 동안 이벤트를 하나의 여정으로 묶기 위한 익명 세션 ID.
// 개인 식별 정보가 아니라 무작위 UUID이며 sessionStorage에만 보관한다.
export function getSessionId(): string {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    let id = window.sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      window.sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}
