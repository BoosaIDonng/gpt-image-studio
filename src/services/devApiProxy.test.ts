import { describe, expect, it } from "vitest";
import { proxyDevelopmentApiRequest } from "./devApiProxy";

describe("development API proxy", () => {
  it("routes an external endpoint through the local Vite proxy in development", () => {
    expect(
      proxyDevelopmentApiRequest("http://gateway.example.com:8080/v1/images/generations", true),
    ).toBe("/__api-proxy?url=http%3A%2F%2Fgateway.example.com%3A8080%2Fv1%2Fimages%2Fgenerations");
  });

  it("keeps loopback and production endpoints unchanged", () => {
    expect(proxyDevelopmentApiRequest("http://127.0.0.1:8787/v1/models", true)).toBe(
      "http://127.0.0.1:8787/v1/models",
    );
    expect(proxyDevelopmentApiRequest("http://gateway.example.com:8080/v1/models", false)).toBe(
      "http://gateway.example.com:8080/v1/models",
    );
  });
});
