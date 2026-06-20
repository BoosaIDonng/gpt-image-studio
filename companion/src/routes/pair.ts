import type { FastifyInstance } from "fastify";
import type {
  PairConfirmRequest,
  PairStartResponse,
  PairWaitRequest,
  PairWaitResponse,
  PairConfirmResponse,
  PairUnpairResponse,
} from "../types.js";
import { startPairing, confirmPairing, clearSession, enterPairingMode } from "../pairingState.js";

type PairRoutesOptions = {
  sessionTtlMs: number;
  allowDirectPairing: boolean;
};

/**
 * 简易速率限制器：防暴力破解配对码。
 * 6 位数字配对码有 100 万种组合，不限速可在几分钟内穷举。
 */
const CONFIRM_RATE_LIMIT_WINDOW_MS = 60_000;
const CONFIRM_MAX_ATTEMPTS = 5;
const confirmAttempts: Array<{ ip: string; timestamp: number }> = [];

function isConfirmRateLimited(ip: string): boolean {
  const now = Date.now();
  // 清理过期记录
  while (
    confirmAttempts.length &&
    confirmAttempts[0].timestamp + CONFIRM_RATE_LIMIT_WINDOW_MS < now
  ) {
    confirmAttempts.shift();
  }
  const recentAttempts = confirmAttempts.filter((entry) => entry.ip === ip);
  return recentAttempts.length >= CONFIRM_MAX_ATTEMPTS;
}

function recordConfirmAttempt(ip: string) {
  confirmAttempts.push({ ip, timestamp: Date.now() });
}

export async function pairRoutes(app: FastifyInstance, opts: PairRoutesOptions) {
  app.post<{ Body: PairWaitRequest; Reply: PairWaitResponse }>("/pair/wait", async (req, reply) => {
    if (req.headers.origin) {
      return reply.status(403).send({ error: "配对等待模式只能由本地 CLI 开启" } as never);
    }
    const timeoutSeconds = Math.max(1, Number(req.body?.timeoutSeconds) || 300);
    const result = enterPairingMode(timeoutSeconds * 1000);
    return reply.send(result);
  });

  app.post<{ Reply: PairStartResponse }>("/pair/start", async (_req, reply) => {
    const result = startPairing({ requirePairingMode: !opts.allowDirectPairing });
    if (!result) {
      return reply.status(409).send({ error: "请先在终端运行 gpt-image-studio pair" } as never);
    }
    return reply.send(result);
  });

  app.post<{ Body: PairConfirmRequest; Reply: PairConfirmResponse }>(
    "/pair/confirm",
    async (req, reply) => {
      const clientIp = req.ip;
      if (isConfirmRateLimited(clientIp)) {
        return reply.status(429).send({ error: "配对码验证请求过于频繁，请稍后重试。" } as never);
      }

      const { pairingCode } = req.body as PairConfirmRequest;
      const result = confirmPairing(pairingCode, opts.sessionTtlMs);
      if (!result) {
        recordConfirmAttempt(clientIp);
        return reply.status(401).send({ error: "配对码无效或已过期" } as never);
      }
      return reply.send(result);
    },
  );

  app.post<{ Reply: PairUnpairResponse }>("/pair/unpair", async (_req, reply) => {
    clearSession();
    return reply.send({ paired: false });
  });
}
