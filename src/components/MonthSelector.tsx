import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { monthLabel, shiftMonth } from "@/lib/finance";

interface Props {
  year: number;
  month: number;
  onChange: (y: number, m: number) => void;
}

export default function MonthSelector({ year, month, onChange }: Props) {
  const prev = () => { const r = shiftMonth(year, month, -1); onChange(r.year, r.month); };
  const next = () => { const r = shiftMonth(year, month, 1); onChange(r.year, r.month); };
  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-1 py-1">
      <Button variant="ghost" size="sm" onClick={prev} className="h-8 px-2">
        <ChevronLeft className="h-4 w-4" />
        <span className="hidden sm:inline ml-1">Mes anterior</span>
      </Button>
      <div className="px-3 text-sm font-medium tabular-nums min-w-[140px] text-center">
        {monthLabel(month, year)}
      </div>
      <Button variant="ghost" size="sm" onClick={next} className="h-8 px-2">
        <span className="hidden sm:inline mr-1">Mes siguiente</span>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
