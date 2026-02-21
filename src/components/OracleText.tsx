import { parseOracleText } from "@/lib/oracle";
import ManaSymbol from "@/components/ManaSymbol";

interface OracleTextProps {
  text: string;
}

export default function OracleText({ text }: OracleTextProps) {
  const lines = text.split("\n");

  return (
    <div className="space-y-1">
      {lines.map((line, lineIdx) => {
        const tokens = parseOracleText(line);
        return (
          <p key={lineIdx} className="text-slate-300">
            {tokens.map((token, tokenIdx) =>
              token.type === "symbol" ? (
                <ManaSymbol
                  key={tokenIdx}
                  symbol={token.value}
                  size="sm"
                />
              ) : (
                <span key={tokenIdx}>{token.value}</span>
              )
            )}
          </p>
        );
      })}
    </div>
  );
}
