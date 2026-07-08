"use client";

import { AlertCircle, LogIn, Package, Truck, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type ShipmentInfo = {
  orderId: string;
  status: string;
  carrierName: string;
  trackingNumber: string;
  trackingUrl: string;
};

type OrderWithShipment = {
  orderId: string;
  orderDate?: string;
  totalItems: number;
  firstItemName?: string;
  paymentAmount?: number;
  shipment: ShipmentInfo | null;
};

type Props = {
  memberId: string;
};

// 자사몰(cafe24 mall) 로그인 페이지. 단독 접속(콜 URL 등) 사용자는 이 곳으로 직접 이동한다.
// returnUrl 로 자사몰 주문내역(배송조회) 페이지를 지정 → 로그인 후 바로 배송 확인 가능.
const MALL_ORIGIN = "https://yogibo.kr";
const MALL_ORDER_LIST_PATH = "/myshop/order/list.html";
const MALL_LOGIN_URL = `${MALL_ORIGIN}/member/login.html?returnUrl=${encodeURIComponent(
  MALL_ORDER_LIST_PATH,
)}`;

export function DeliveryInquiry({ memberId }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [orders, setOrders] = useState<OrderWithShipment[] | null>(null);
  // iframe 안(자사몰 embed) 인지 / 단독 접속(콜 URL) 인지 판별.
  // SSR 중에는 window 가 없으므로 마운트 후 클라이언트에서 결정한다.
  const [isEmbedded, setIsEmbedded] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setIsEmbedded(window.self !== window.top);
    } catch {
      // cross-origin 접근 예외 시엔 embed 로 간주 (안전한 기본값)
      setIsEmbedded(true);
    }
  }, []);

  function handleLogin() {
    if (typeof window === "undefined") return;
    if (isEmbedded) {
      // 자사몰 iframe embed → 부모(자사몰)에게 로그인 요청. 부모가 mall 안에서 로그인 이동.
      window.parent?.postMessage({ type: "cs:request-login" }, "*");
    } else {
      // 단독 접속(콜 URL 등) → 부모가 없으므로 자사몰 로그인 페이지로 브라우저를 직접 이동.
      window.location.href = MALL_LOGIN_URL;
    }
  }

  const load = useCallback(async () => {
    if (!memberId) return;
    setBusy(true);
    setError("");
    setOrders(null);
    try {
      const response = await fetch("/api/cafe24/shipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? `조회에 실패했습니다 (상태 ${response.status})`);
        return;
      }
      setOrders(data.orders ?? []);
    } catch {
      setError("배송 조회 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }, [memberId]);

  useEffect(() => {
    if (memberId) void load();
  }, [memberId, load]);

  if (!memberId) {
    return (
      <div className="delivery-inquiry delivery-empty">
        <div className="delivery-empty-icon">
          <AlertCircle size={28} />
        </div>
        <h3>로그인이 필요합니다</h3>
        {isEmbedded ? (
          <p>
            배송 정보를 확인하려면 자사몰에 로그인해 주세요.
            <br />
            로그인 후 다시 이 페이지로 돌아오시면 자동으로 조회됩니다.
          </p>
        ) : (
          <p>
            배송 조회는 자사몰 로그인이 필요합니다.
            <br />
            아래 버튼을 누르면 자사몰(yogibo.kr)로 이동해 로그인 후 주문·배송 내역을 확인하실 수 있어요.
          </p>
        )}
        <button type="button" className="delivery-login-btn" onClick={handleLogin}>
          <LogIn size={16} />
          {isEmbedded ? "로그인 하러 가기" : "자사몰에서 배송 조회하기"}
        </button>
      </div>
    );
  }

  if (busy) {
    return (
      <div className="delivery-inquiry delivery-loading">
        <Loader2 size={22} className="spin-icon" />
        <p>최근 배송 내역을 불러오는 중이에요…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="delivery-inquiry delivery-error">
        <AlertCircle size={22} />
        <p>{error}</p>
        <button type="button" className="delivery-retry-btn" onClick={() => void load()}>
          다시 시도
        </button>
      </div>
    );
  }

  if (orders && orders.length === 0) {
    return (
      <div className="delivery-inquiry delivery-empty">
        <div className="delivery-empty-icon">
          <Package size={28} />
        </div>
        <h3>최근 배송 내역이 없어요</h3>
        <p>최근 14일간의 주문·배송 내역이 표시됩니다.</p>
      </div>
    );
  }

  return (
    <div className="delivery-inquiry">
      <div className="delivery-head">
        <Truck size={18} />
        <h3>최근 배송 내역</h3>
      </div>
      <ul className="delivery-list">
        {orders?.map((order) => (
          <li key={order.orderId} className="delivery-card">
            <div className="delivery-card-head">
              <span className="delivery-order-id">주문번호 {order.orderId}</span>
              {order.orderDate && (
                <span className="delivery-order-date">{order.orderDate.slice(0, 10)}</span>
              )}
            </div>
            {order.firstItemName && (
              <p className="delivery-order-items">
                {order.firstItemName}
                {order.totalItems > 1 ? ` 외 ${order.totalItems - 1}건` : ""}
              </p>
            )}
            {order.shipment ? (
              <div className="delivery-shipment">
                <div className="delivery-status">
                  <span className={`delivery-status-badge status-${order.shipment.status.replace(/\s/g, "")}`}>
                    {order.shipment.status}
                  </span>
                </div>
                {order.shipment.trackingNumber && (
                  <p className="delivery-tracking">
                    <strong>{order.shipment.carrierName}</strong> · {order.shipment.trackingNumber}
                  </p>
                )}
                {order.shipment.trackingUrl && order.shipment.trackingUrl !== "#" && (
                  <a
                    href={order.shipment.trackingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="delivery-tracking-btn"
                  >
                    <Truck size={15} />
                    실시간 배송조회
                  </a>
                )}
              </div>
            ) : (
              <p className="delivery-no-shipment">아직 배송 정보가 등록되지 않았어요.</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
