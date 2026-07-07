import { cafe24Request } from "@/lib/cafe24/api";

// yogiChat 의 services/cafe24Service.js 에서 배송문의에 필요한 부분만 이식.
// (상품 카탈로그 동기화, 구매이력 등은 이 프로젝트 스코프 밖이라 제외)

const CARRIER_MAP: Record<string, { name: string; url: string }> = {
  "0019": { name: "롯데 택배", url: "https://www.lotteglogis.com/" },
  "0039": { name: "경동 택배", url: "https://kdexp.com/index.do" },
  "0023": { name: "경동 택배", url: "https://kdexp.com/index.do" },
};

export type ShipmentInfo = {
  orderId: string;
  status: string;
  carrierName: string;
  trackingNumber: string;
  trackingUrl: string;
};

type Cafe24Shipment = {
  status?: string;
  tracking_no?: string;
  tracking_url?: string;
  shipping_company_code?: string;
  shipping_company_name?: string;
};

type Cafe24OrderItem = {
  product_name?: string;
  quantity?: number;
  option_value?: string;
};

type Cafe24Order = {
  order_id: string;
  order_date?: string;
  order_place_name?: string;
  order_price_amount?: number | string;
  payment_amount?: number | string;
  items?: Cafe24OrderItem[];
};

function ymd(date: Date) {
  return date.toISOString().split("T")[0];
}

// 최근 N일간의 해당 회원 주문 목록 (기본 14일)
export async function getRecentOrders(memberId: string, days = 14) {
  const today = new Date();
  const start = new Date();
  start.setDate(today.getDate() - days);

  const response = await cafe24Request<{ orders?: Cafe24Order[] }>("/api/v2/admin/orders", {
    params: {
      member_id: memberId,
      start_date: ymd(start),
      end_date: ymd(today),
      limit: 10,
      embed: "items",
    },
  });
  return response.orders ?? [];
}

// 주문의 배송 상세 (택배사, 운송장 번호, 실시간 조회 URL 매핑까지)
export async function getShipmentDetail(orderId: string): Promise<ShipmentInfo | null> {
  const response = await cafe24Request<{ shipments?: Cafe24Shipment[] }>(
    `/api/v2/admin/orders/${orderId}/shipments`,
    { params: { shop_no: 1 } },
  );
  const shipment = response.shipments?.[0];
  if (!shipment) return null;

  const code = shipment.shipping_company_code ?? "";
  const carrier = CARRIER_MAP[code] ?? {
    name: shipment.shipping_company_name || "지정 택배사",
    url: "",
  };

  let trackingUrl = shipment.tracking_url && shipment.tracking_url !== "undefined" ? shipment.tracking_url : "";
  if (!trackingUrl && shipment.tracking_no) {
    if (carrier.url) {
      trackingUrl = carrier.url.endsWith("=") ? carrier.url + shipment.tracking_no : carrier.url;
    } else {
      trackingUrl = `https://search.naver.com/search.naver?query=${encodeURIComponent(
        `${carrier.name} 배송조회 ${shipment.tracking_no}`,
      )}`;
    }
  }

  return {
    orderId,
    status: shipment.status || "배송 준비중",
    carrierName: carrier.name,
    trackingNumber: shipment.tracking_no ?? "",
    trackingUrl: trackingUrl || "#",
  };
}

// 회원의 최근 주문 + 각 주문의 배송 정보를 묶어 반환
export type OrderWithShipment = {
  orderId: string;
  orderDate?: string;
  totalItems: number;
  firstItemName?: string;
  paymentAmount?: number;
  shipment: ShipmentInfo | null;
};

export async function getRecentOrdersWithShipments(memberId: string): Promise<OrderWithShipment[]> {
  const orders = await getRecentOrders(memberId, 14);
  if (orders.length === 0) return [];

  const results = await Promise.all(
    orders.slice(0, 5).map(async (order) => {
      let shipment: ShipmentInfo | null = null;
      try {
        shipment = await getShipmentDetail(order.order_id);
      } catch (error) {
        // 개별 주문의 배송 조회 실패는 전체를 막지 않는다.
        console.warn(`[cafe24] 배송 조회 실패 order=${order.order_id}`, error);
      }
      const paymentAmount = Number(order.payment_amount ?? order.order_price_amount ?? 0);
      return {
        orderId: order.order_id,
        orderDate: order.order_date,
        totalItems: (order.items ?? []).length,
        firstItemName: order.items?.[0]?.product_name,
        paymentAmount: Number.isFinite(paymentAmount) ? paymentAmount : undefined,
        shipment,
      };
    }),
  );

  return results;
}
