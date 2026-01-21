type PaginationResult = {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  startPage: number;
  endPage: number;
  pages: number[];
  hasPrev: boolean;
  hasNext: boolean;
  prevPage: number | null;
  nextPage: number | null;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function getPagination(
  totalItems: number,
  pageSize: number,
  currentPage: number,
  maxPages = 5
): PaginationResult {
  const safePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const safeCurrent = clamp(currentPage, 1, totalPages);
  const safeMax = Math.max(1, maxPages);
  const half = Math.floor(safeMax / 2);

  let startPage = Math.max(1, safeCurrent - half);
  let endPage = startPage + safeMax - 1;
  if (endPage > totalPages) {
    endPage = totalPages;
    startPage = Math.max(1, endPage - safeMax + 1);
  }

  const pages = Array.from(
    { length: endPage - startPage + 1 },
    (_v, idx) => startPage + idx
  );

  const hasPrev = safeCurrent > 1;
  const hasNext = safeCurrent < totalPages;

  return {
    currentPage: safeCurrent,
    totalPages,
    pageSize: safePageSize,
    totalItems,
    startPage,
    endPage,
    pages,
    hasPrev,
    hasNext,
    prevPage: hasPrev ? safeCurrent - 1 : null,
    nextPage: hasNext ? safeCurrent + 1 : null,
  };
}
