export function isPublicCardScanUrl(value: string) {
  try {
    const url = new URL(value);
    const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    return (url.protocol === "https:" || localHttp)
      && !url.username && !url.password && !url.search && !url.hash
      && /^\/scan\/q1_[A-Za-z0-9_-]{90,380}$/.test(url.pathname);
  } catch { return false; }
}
