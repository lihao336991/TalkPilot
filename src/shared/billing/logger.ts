type BillingLogLevel = 'info' | 'error';

function safeSerialize(value: unknown) {
  if (value == null) {
    return value;
  }

  if (typeof value === 'string') {
    return value.length > 1000 ? `${value.slice(0, 1000)}...` : value;
  }

  try {
    return JSON.parse(JSON.stringify(value)) as unknown;
  } catch {
    return String(value);
  }
}

export function logBillingEvent(
  event: string,
  payload: Record<string, unknown> = {},
  level: BillingLogLevel = 'info',
) {
  const serialized = JSON.stringify({
    scope: 'billing-client',
    event,
    ...safeSerialize(payload),
  });

  if (level === 'error') {
    console.error(serialized);
    return;
  }

  console.log(serialized);
}
