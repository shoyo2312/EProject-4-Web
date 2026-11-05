/**
 * TikTok's horizontal bar list: a label, a blue bar sized against `total`, and
 * the rounded share on the right. Rows with nothing in them are left out, and
 * with no total there is nothing to size against, so nothing renders.
 */
export function BarList({
  rows,
  total,
}: {
  rows: { key: string; label: string; value: number }[];
  total: number;
}) {
  if (total <= 0) return null;

  return (
    <ul className="flex flex-col gap-3">
      {rows
        .filter((row) => row.value > 0)
        .map((row) => {
          const share = Math.min(1, row.value / total);
          return (
            <li key={row.key} className="flex items-center gap-3 text-[14px] leading-[18px]">
              <span className="w-[120px] flex-none truncate text-black/65" title={row.label}>
                {row.label}
              </span>
              <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-black/6">
                <span
                  className="block h-full rounded-full bg-[#0075db]"
                  style={{ width: `${share * 100}%` }}
                />
              </span>
              <span className="w-10 flex-none text-right font-medium text-black">
                {Math.round(share * 100)}%
              </span>
            </li>
          );
        })}
    </ul>
  );
}
