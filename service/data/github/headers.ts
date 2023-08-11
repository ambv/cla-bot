export function getHeaders(accessToken: string): {[key: string]: string} {
  return {
    Accept: "application/vnd.github.machine-man-preview+json",
    Authorization: `Bearer ${accessToken}`,
  };
}

export function getHeadersForJsonContent(accessToken: string): {
  [key: string]: string;
} {
  const headers = getHeaders(accessToken);
  headers["Content-Type"] = "application/json; charset=utf-8";
  return headers;
}
