import { useState, useImperativeHandle, forwardRef, useMemo, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PDF_OPTIONS = {
  cMapUrl: `//unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  cMapPacked: true,
};

interface PDFPreviewProps {
  fileUrl: string;
  width?: number;
  height?: number;
  className?: string;
  'data-testid'?: string;
}

export interface PDFPreviewRef {
  nextPage: () => void;
  prevPage: () => void;
  getCurrentPage: () => number;
  getTotalPages: () => number;
}

export const PDFPreview = forwardRef<PDFPreviewRef, PDFPreviewProps>(({ 
  fileUrl, 
  width = 800, 
  height = 1000,
  className = '',
  'data-testid': dataTestId
}, ref) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Use ref to track current page number for getCurrentPage
  const pageNumberRef = useRef(pageNumber);
  pageNumberRef.current = pageNumber;

  // Calculate responsive width based on container
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const parentWidth = containerRef.current.offsetWidth;
        // Use the smaller of: parent width or desired width
        setContainerWidth(Math.min(parentWidth, width));
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [width]);

  // Expose navigation methods to parent
  useImperativeHandle(ref, () => ({
    nextPage: () => {
      setPageNumber(prev => Math.min(numPages, prev + 1));
    },
    prevPage: () => {
      setPageNumber(prev => Math.max(1, prev - 1));
    },
    getCurrentPage: () => pageNumberRef.current,
    getTotalPages: () => numPages,
  }), [numPages]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber(1); // Reset to page 1 when new document loads
    setLoading(false);
    setError(null);
  }

  function onDocumentLoadError(error: Error) {
    console.error('PDF 載入錯誤:', error);
    setError('PDF 載入失敗');
    setLoading(false);
  }

  // Memoize file prop to prevent unnecessary Document reloads
  const fileConfig = useMemo(() => ({ url: fileUrl }), [fileUrl]);

  // Use responsive width if available, otherwise fallback to prop width
  const effectiveWidth = containerWidth > 0 ? containerWidth : width;

  return (
    <div ref={containerRef} className={`flex flex-col items-center w-full ${className}`} data-testid={dataTestId}>
      {loading && (
        <div className="flex items-center justify-center" style={{ width: effectiveWidth, height }}>
          <p className="text-muted-foreground">載入 PDF 中...</p>
        </div>
      )}
      {error && (
        <div className="flex items-center justify-center" style={{ width: effectiveWidth, height }}>
          <p className="text-destructive">{error}</p>
        </div>
      )}
      <Document
        file={fileConfig}
        onLoadSuccess={onDocumentLoadSuccess}
        onLoadError={onDocumentLoadError}
        loading={null}
        error={null}
        options={PDF_OPTIONS}
      >
        <Page
          pageNumber={pageNumber}
          width={effectiveWidth}
          renderTextLayer={true}
          renderAnnotationLayer={true}
        />
      </Document>
      {numPages > 1 && (
        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
            disabled={pageNumber <= 1}
            className="px-3 py-1 rounded bg-primary text-primary-foreground disabled:opacity-50"
            data-testid="button-pdf-prev-page"
          >
            上一頁
          </button>
          <p className="text-sm">
            第 {pageNumber} 頁 / 共 {numPages} 頁
          </p>
          <button
            onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))}
            disabled={pageNumber >= numPages}
            className="px-3 py-1 rounded bg-primary text-primary-foreground disabled:opacity-50"
            data-testid="button-pdf-next-page"
          >
            下一頁
          </button>
        </div>
      )}
    </div>
  );
});
