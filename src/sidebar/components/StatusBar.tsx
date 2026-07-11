import type { Status } from '../state/useAppState';

export function StatusBar({ status }: { status: Status }) {
  if (!status.message) return null;
  return <p className={`status status--${status.kind}`} role="status">{status.message}</p>;
}
