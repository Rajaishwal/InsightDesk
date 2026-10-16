// Pagination.jsx — Table footer: "Showing 21–40 of 107" and page buttons (1 … 4 5 6 … 14).
import { ChevronLeft, ChevronRight } from "lucide-react";
import Tooltip from "./Tooltip";

// Page numbers with gaps: 1 … 4 5 6 … 14
const pageList = (cur, last) => {
  const set = new Set([1, last, cur - 1, cur, cur + 1].filter((p) => p >= 1 && p <= last));
  const out = [];
  [...set].sort((a, b) => a - b).forEach((p, i, arr) => { if (i && p - arr[i - 1] > 1) out.push("…"); out.push(p); });
  return out;
};

export default function Pagination({ currentPage = 1, totalPages = 1, totalRecords = 0, pageSize, shown, onPage }) {
  if (!totalRecords) return null;
  const from = (currentPage - 1) * pageSize + 1;
  const to = Math.min(totalRecords, from + shown - 1);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-3">
      <p className="text-xs text-gray-500">
        Showing <span className="font-semibold text-gray-700">{from}–{to}</span> of <span className="font-semibold text-gray-700">{totalRecords}</span>
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <Tooltip text="Previous page"><button type="button" onClick={() => onPage(currentPage - 1)} disabled={currentPage <= 1} aria-label="Previous page"
            className="cursor-pointer rounded-full p-1.5 text-gray-500 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30">
            <ChevronLeft className="h-4 w-4" />
          </button></Tooltip>
          {pageList(currentPage, totalPages).map((p, i) =>
            p === "…" ? (
              <span key={`gap${i}`} className="px-1 text-xs text-gray-400">…</span>
            ) : (
              <button key={p} type="button" onClick={() => onPage(p)} aria-current={p === currentPage ? "page" : undefined}
                className={`h-7 min-w-7 cursor-pointer rounded-full px-2 text-xs font-semibold tabular-nums transition
                  ${p === currentPage ? "bg-gray-800 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
                {p}
              </button>
            )
          )}
          <Tooltip text="Next page"><button type="button" onClick={() => onPage(currentPage + 1)} disabled={currentPage >= totalPages} aria-label="Next page"
            className="cursor-pointer rounded-full p-1.5 text-gray-500 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30">
            <ChevronRight className="h-4 w-4" />
          </button></Tooltip>
        </div>
      )}
    </div>
  );
}
