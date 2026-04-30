const BASE = (isPaper: boolean) =>
  isPaper ? 'https://demo.tradovateapi.com/v1' : 'https://live.tradovateapi.com/v1';

export interface TradovateAccount {
  id: number;
  name: string;
  accountType: string;
  active: boolean;
}

export interface TradovatePosition {
  id: number;
  accountId: number;
  contractId: number;
  timestamp: string;
  tradeDate: { year: number; month: number; day: number };
  netPos: number;
  netPrice: number;
  bought: number;
  boughtValue: number;
  sold: number;
  soldValue: number;
  prevPos: number;
  prevPrice: number;
}

export interface TradovateOrderResult {
  orderId: number;
  status: string;
}

export interface TradovateCashBalance {
  realizedPnL: number;
  unrealizedPnL: number;
  cashBalance: number;
  netLiq: number;
}

interface TradovateAuthCreds {
  name: string;
  password: string;
  appId: string;
  appVersion: string;
  cid: number;
  sec: string;
}

export async function tradovateAuth(
  creds: TradovateAuthCreds,
  isPaper: boolean
): Promise<{ accessToken: string; userId: number; expirationTime: string }> {
  const res = await fetch(`${BASE(isPaper)}/auth/accesstokenrequest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: creds.name,
      password: creds.password,
      appId: creds.appId,
      appVersion: creds.appVersion,
      cid: creds.cid,
      sec: creds.sec,
      deviceId: 'alphalog-agent',
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Tradovate auth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (data['p-ticket'] || data.errorText) {
    throw new Error(`Tradovate auth error: ${data.errorText ?? 'captcha required'}`);
  }
  if (!data.accessToken) {
    throw new Error('Tradovate auth: no accessToken in response');
  }

  return {
    accessToken: data.accessToken,
    userId: data.userId,
    expirationTime: data.expirationTime,
  };
}

export async function tradovateRenew(
  accessToken: string,
  isPaper: boolean
): Promise<{ accessToken: string; expirationTime: string }> {
  const res = await fetch(`${BASE(isPaper)}/auth/renewaccesstoken`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Tradovate renew failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (!data.accessToken) throw new Error('Tradovate renew: no accessToken in response');

  return { accessToken: data.accessToken, expirationTime: data.expirationTime };
}

export async function getAccounts(
  token: string,
  isPaper: boolean
): Promise<TradovateAccount[]> {
  const res = await fetch(`${BASE(isPaper)}/account/list`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Tradovate getAccounts failed (${res.status}): ${text}`);
  }

  return res.json();
}

export async function placeMarketOrder(params: {
  token: string;
  isPaper: boolean;
  accountSpec: string;
  accountId: number;
  action: 'Buy' | 'Sell';
  symbol: string;
  qty: number;
  slTicks: number;
  tpTicks: number;
}): Promise<TradovateOrderResult> {
  const body = {
    accountSpec: params.accountSpec,
    accountId: params.accountId,
    action: params.action,
    symbol: params.symbol,
    orderQty: params.qty,
    orderType: 'Market',
    isAutomated: true,
    bracket1: {
      action: params.action === 'Buy' ? 'Sell' : 'Buy',
      orderType: 'Stop',
      stopPrice: undefined as number | undefined,
      trailStopPct: undefined as number | undefined,
      stopPriceTicks: params.slTicks,
    },
    bracket2: {
      action: params.action === 'Buy' ? 'Sell' : 'Buy',
      orderType: 'Limit',
      limitPriceTicks: params.tpTicks,
    },
  };

  const res = await fetch(`${BASE(params.isPaper)}/order/placeorder`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Tradovate placeOrder failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return { orderId: data.orderId ?? data.order?.id, status: data.orderStatus ?? 'Working' };
}

export async function getPositions(
  token: string,
  accountId: number,
  isPaper: boolean
): Promise<TradovatePosition[]> {
  const res = await fetch(
    `${BASE(isPaper)}/position/list?accountId=${accountId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Tradovate getPositions failed (${res.status}): ${text}`);
  }

  const all: TradovatePosition[] = await res.json();
  return all.filter(p => p.accountId === accountId && p.netPos !== 0);
}

export async function getCashBalance(
  token: string,
  accountId: number,
  isPaper: boolean
): Promise<TradovateCashBalance> {
  const res = await fetch(
    `${BASE(isPaper)}/cashbalance/getcashbalancesnapshot`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ accountId }),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Tradovate getCashBalance failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    realizedPnL: data.realizedPnL ?? 0,
    unrealizedPnL: data.openPnL ?? 0,
    cashBalance: data.cashBalance ?? 0,
    netLiq: data.netLiq ?? (data.cashBalance ?? 0) + (data.openPnL ?? 0),
  };
}

export async function closePosition(params: {
  token: string;
  isPaper: boolean;
  accountSpec: string;
  accountId: number;
  positionId: number;
  symbol: string;
  qty: number;
}): Promise<{ orderId: number }> {
  const res = await fetch(`${BASE(params.isPaper)}/order/liquidateposition`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.token}`,
    },
    body: JSON.stringify({
      accountSpec: params.accountSpec,
      accountId: params.accountId,
      contractId: params.positionId,
      admin: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Tradovate closePosition failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return { orderId: data.orderId ?? data.order?.id };
}
