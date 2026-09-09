const DEV_PROXY_PATH = "/__api-proxy";

export function proxyDevelopmentApiRequest(endpoint: string, isDevelopment = import.meta.env.DEV) {
  if (!isDevelopment || !isExternalHttpUrl(endpoint)) return endpoint;
  return `${DEV_PROXY_PATH}?url=${encodeURIComponent(endpoint)}`;
}

function isExternalHttpUrl(endpoint: string) {
  try {
    const url = new URL(endpoint);
    return (url.protocol === "http:" || url.protocol === "https:") && !isLoopbackHost(url.hostname);
  } catch {
    return false;
  }
}

function isLoopbackHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  return normalized === "localhost" || normalized === "::1" || normalized === "127.0.0.1";
}
