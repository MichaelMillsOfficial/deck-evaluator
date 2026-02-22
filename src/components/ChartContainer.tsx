"use client";

import { ResponsiveContainer } from "recharts";

interface ChartContainerProps {
  height?: number;
  ariaLabel: string;
  children: React.ReactNode;
}

export default function ChartContainer({
  height = 240,
  ariaLabel,
  children,
}: ChartContainerProps) {
  return (
    <div role="img" aria-label={ariaLabel} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}
