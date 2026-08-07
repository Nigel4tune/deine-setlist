"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

type PdfViewerProps = {
  pdfUrl: string;
};

export default function PdfViewer({
  pdfUrl,
}: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(
    null,
  );

  const [numberOfPages, setNumberOfPages] =
    useState(0);

  const [visiblePageCount, setVisiblePageCount] =
    useState(2);

  const [containerWidth, setContainerWidth] =
    useState(800);

  const [zoom, setZoom] = useState(1);
  const [pdfError, setPdfError] = useState("");

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    function updateWidth() {
      if (!container) {
        return;
      }

      setContainerWidth(
        Math.max(
          280,
          Math.min(container.clientWidth - 24, 1000),
        ),
      );
    }

    updateWidth();

    const resizeObserver = new ResizeObserver(
      updateWidth,
    );

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    setNumberOfPages(0);
    setVisiblePageCount(2);
    setPdfError("");
  }, [pdfUrl]);

  useEffect(() => {
    if (
      numberOfPages <= 2 ||
      visiblePageCount >= numberOfPages
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setVisiblePageCount((current) =>
        Math.min(current + 2, numberOfPages),
      );
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [numberOfPages, visiblePageCount]);

  function zoomIn() {
    setZoom((currentZoom) =>
      Math.min(
        Number(
          (currentZoom + 0.15).toFixed(2),
        ),
        2.5,
      ),
    );
  }

  function zoomOut() {
    setZoom((currentZoom) =>
      Math.max(
        Number(
          (currentZoom - 0.15).toFixed(2),
        ),
        0.5,
      ),
    );
  }

  function resetZoom() {
    setZoom(1);
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-center gap-2 border-b border-white/10 bg-zinc-900/95 px-3 py-3 shadow-xl backdrop-blur">
        <button
          type="button"
          onClick={zoomOut}
          disabled={zoom <= 0.5}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-800 text-xl font-black transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
          title="Verkleinern"
          aria-label="PDF verkleinern"
        >
          −
        </button>

        <button
          type="button"
          onClick={resetZoom}
          className="min-w-24 rounded-xl bg-zinc-800 px-4 py-3 text-sm font-bold transition hover:bg-zinc-700"
          title="Originalgröße wiederherstellen"
        >
          {Math.round(zoom * 100)} %
        </button>

        <button
          type="button"
          onClick={zoomIn}
          disabled={zoom >= 2.5}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-800 text-xl font-black transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
          title="Vergrößern"
          aria-label="PDF vergrößern"
        >
          +
        </button>

        {numberOfPages > 0 && (
          <span className="ml-2 text-sm text-zinc-400">
            {numberOfPages}{" "}
            {numberOfPages === 1
              ? "Seite"
              : "Seiten"}
          </span>
        )}
      </div>

      <div
        ref={containerRef}
        className="min-h-0 flex-1 overflow-auto bg-zinc-950 px-3 py-5"
      >
        <Document
          file={pdfUrl}
          onLoadSuccess={({ numPages }) => {
            setNumberOfPages(numPages);
            setVisiblePageCount(
              Math.min(2, numPages),
            );
            setPdfError("");
          }}
          onLoadError={(error) => {
            console.error(
              "PDF konnte nicht dargestellt werden:",
              error,
            );

            setPdfError(
              "Die PDF konnte nicht dargestellt werden.",
            );
          }}
          loading={
            <div className="flex min-h-[60vh] items-center justify-center text-zinc-400">
              PDF wird geladen …
            </div>
          }
          error={
            <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center font-bold text-red-200">
              {pdfError ||
                "Die PDF konnte nicht dargestellt werden."}
            </div>
          }
          className="flex flex-col items-center gap-5"
        >
          {Array.from(
            {
              length: Math.min(
                visiblePageCount,
                numberOfPages,
              ),
            },
            (_, pageIndex) => (
              <div
                key={`pdf-page-${pageIndex + 1}`}
                className="overflow-hidden rounded-lg bg-white shadow-2xl"
              >
                <Page
                  pageNumber={pageIndex + 1}
                  width={containerWidth * zoom}
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                  loading={
                    <div className="flex h-96 w-72 items-center justify-center bg-white text-zinc-500">
                      Seite wird geladen …
                    </div>
                  }
                />
              </div>
            ),
          )}

          {visiblePageCount < numberOfPages && (
            <div className="py-4 text-sm text-zinc-500">
              Weitere Seiten werden geladen …
            </div>
          )}
        </Document>
      </div>
    </div>
  );
}