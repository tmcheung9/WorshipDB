import { useState, useRef, useEffect, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { FileText } from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PDF_OPTIONS = {
  cMapUrl: `//unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  cMapPacked: true,
};

interface PDFThumbnailProps {
  fileUrl: string;
  className?: string;
  alt?: string;
}

export function PDFThumbnail({ fileUrl, className = '', alt = 'PDF' }: PDFThumbnailProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '100px',
        threshold: 0.1,
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (containerRef.current && isVisible) {
      const width = containerRef.current.offsetWidth;
      setContainerWidth(width);
    }
  }, [isVisible]);

  function onLoadSuccess() {
    setLoading(false);
    setError(false);
  }

  function onLoadError(error: Error) {
    console.error('PDF thumbnail load error:', error);
    setError(true);
    setLoading(false);
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-muted ${className}`}>
        <FileText className="h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative flex items-center justify-center ${className}`}>
      {(loading || !isVisible) && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <FileText className="h-8 w-8 text-muted-foreground animate-pulse" />
        </div>
      )}
      {isVisible && containerWidth > 0 && (
        <Document
          file={fileUrl}
          onLoadSuccess={onLoadSuccess}
          onLoadError={onLoadError}
          loading={null}
          error={null}
          className="flex items-center justify-center"
          options={PDF_OPTIONS}
        >
          <Page
            pageNumber={1}
            width={containerWidth}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            className="max-w-full max-h-full object-contain"
          />
        </Document>
      )}
    </div>
  );
}
