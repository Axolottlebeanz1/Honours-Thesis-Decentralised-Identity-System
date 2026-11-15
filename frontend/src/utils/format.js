export function formatDate(timestamp) {
  if (!timestamp) return "—";
  return new Date(timestamp * 1000).toLocaleString();
}

export function statusColor(status) {
  switch (status) {
    case "valid":
    case "Valid":
      return "var(--color-success)";
    case "revoked":
    case "Revoked":
      return "var(--color-danger)";
    default:
      return "var(--color-muted)";
  }
}
