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

function requestParentLogin() {
  if (typeof window === "undefined") return;
  // 부모 페이지(cafe24 mall) 로 로그인 요청 이벤트 전달.
  // 부모에서 리스너를 만들어 /member/login.html 로 리다이렉트 하도록 안내한다.
  window.parent?.postMessage({ type: "cs:request-login" }, "*");
}

export function DeliveryInquiry({ memberId }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [orders, setOrders] = useState<OrderWithShipment[] | null>(null);

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
        <p>
          배송 정보를 확인하려면 자사몰에 로그인해 주세요.
          <br />
          로그인 후 다시 이 페이지로 돌아오시면 자동으로 조회됩니다.
        </p>
        <button type="button" className="delivery-login-btn" onClick={requestParentLogin}>
          <LogIn size={16} />
          로그인 하러 가기
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
