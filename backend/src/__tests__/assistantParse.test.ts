import { describe, expect, it } from "vitest";
import { buildReadFallback, countUnparsedBlocks, extractProposals, tryParseActionBlock } from "../services/assistant/conversation";
const good = "{\"tool\": \"search\", \"args\": {\"entity\": \"service\"}, \"summary\": \"s\"}";
describe("parse tolerante de blocos", () => {
  it("aceita JSON valido", () => {
    expect(tryParseActionBlock(good)).toMatchObject({ tool: "search" });
  });
  it("repara virgula extra", () => {
    const v = "{\"tool\": \"search\", \"args\": {}, \"summary\": \"s\",}";
    expect(tryParseActionBlock(v)).toMatchObject({ tool: "search" });
  });
  it("remove comentarios de linha", () => {
    const v = "// busca\n" + good;
    expect(tryParseActionBlock(v)).toMatchObject({ tool: "search" });
  });
  it("extrai JSON no meio de prosa", () => {
    const v = "aqui vai " + good + " pronto";
    expect(tryParseActionBlock(v)).toMatchObject({ tool: "search" });
  });
  it("lixo retorna null", () => {
    expect(tryParseActionBlock("nao e json")).toBeNull();
  });
  it("conta blocos nao parseados e extrai os reparaveis", () => {
    const txt = "texto\n```agilizi-action\n" + good + "\n```\nmeio\n```agilizi-action\nnao e json\n```";
    expect(countUnparsedBlocks(txt)).toBe(1);
    expect(extractProposals(txt).length).toBe(1);
  });
});

describe("fallback deterministico de leitura", () => {
  it("inclui os dados lidos quando o modelo volta vazio", () => {
    const txt = buildReadFallback("crie um orcamento", "- search: [{\"name\":\"Joao Silva\"}]");
    expect(txt).toMatch(/Joao Silva/);
    expect(txt).toMatch(/nada foi alterado/i);
  });
  it("sem dados, orienta a reformular sem inventar nada", () => {
    const txt = buildReadFallback("oi", "");
    expect(txt).toMatch(/reformular/i);
    expect(txt).toMatch(/nada foi alterado/i);
  });
});
