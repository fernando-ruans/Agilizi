import { describe, expect, it } from "vitest";
import { runChain } from "../services/assistant/provider";
function fake(id: string, complete: () => Promise<unknown>): unknown {
  return { id, isConfigured: () => true, complete };
}
const base = { system: "s", history: [], userText: "oi", opts: { timeoutMs: 1000 } };
describe("cadeia auto/free", () => {
  it("pula resposta vazia e usa o proximo provedor", async () => {
    const empty = fake("empty", async () => ({ text: "   ", model: "m", provider: "empty" }));
    const good = fake("good", async () => ({ text: "OK com conteudo", model: "m", provider: "good" }));
    const res = await runChain({ chain: ["empty:m", "good:m"], providers: new Map([["empty", empty], ["good", good]]) as never, ...base });
    expect(String((res as { text: string }).text)).toContain("OK");
  });
  it("resposta so com chamadas de ferramenta e aceita", async () => {
    const p = fake("p", async () => ({ text: "", model: "m", provider: "p", toolCalls: [{ name: "search", argsText: "{}" }] }));
    const res = await runChain({ chain: ["p:m"], providers: new Map([["p", p]]) as never, ...base });
    expect((res as { toolCalls?: unknown[] }).toolCalls?.length).toBe(1);
  });
  it("tudo vazio lanca erro para degradacao educada", async () => {
    const p = fake("p", async () => ({ text: "", model: "m", provider: "p" }));
    await expect(runChain({ chain: ["p:m"], providers: new Map([["p", p]]) as never, ...base })).rejects.toThrow();
  });
});
