'use client'

import { useMemo, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { X, FileText } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

interface SelectedDocumentsListDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  documents?: File[]
  existingDocuments?: Array<{ id: string; documentUrl: string; fileName: string }>
  onRemoveDocument?: (index: number) => void
  onRemoveExistingDocument?: (id: string) => void
  title?: string
  description?: string
}

export function SelectedDocumentsListDialog({
  open,
  onOpenChange,
  documents = [],
  existingDocuments = [],
  onRemoveDocument,
  onRemoveExistingDocument,
  title = 'Selected Documents',
  description = 'Preview and manage your selected documents. Click the remove button to remove a document from the list.',
}: SelectedDocumentsListDialogProps) {
  // Create object URLs for file documents (for images)
  const fileDocumentUrls = useMemo(() => {
    return documents.map(file => {
      // Check if file is an image
      const isImage = file.type.startsWith('image/') || 
        /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name)
      if (isImage) {
        return URL.createObjectURL(file)
      }
      return null
    })
  }, [documents])

  // Cleanup object URLs on unmount or when documents change
  useEffect(() => {
    return () => {
      fileDocumentUrls.forEach(url => {
        if (url) {
          URL.revokeObjectURL(url)
        }
      })
    }
  }, [fileDocumentUrls])

  const isImageFile = (file: File): boolean => {
    return file.type.startsWith('image/') || 
      /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name)
  }

  const isImageDocument = (documentUrl: string, fileName?: string): boolean => {
    return documentUrl.startsWith('data:image/') ||
      /\.(jpg|jpeg|png|gif|webp)$/i.test(documentUrl) ||
      (fileName ? /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName) : false)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const totalDocuments = documents.length + existingDocuments.length

  if (totalDocuments === 0) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[70vh]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>
        <ScrollArea className="max-h-[35vh]">
          <div>
            {/* File documents */}
            {documents.map((file, index) => {
              const isImage = isImageFile(file)
              const previewUrl = isImage ? fileDocumentUrls[index] : null
              
              return (
                <div
                  key={`file-${index}`}
                  className="flex items-center gap-2 p-2 border-b last:border-b-0 rounded-none hover:bg-accent/50 transition-colors"
                >
                  <div className="relative w-12 h-12 shrink-0 rounded-md overflow-hidden bg-muted flex items-center justify-center">
                    {isImage && previewUrl ? (
                      <Image
                        src={previewUrl}
                        alt={file.name}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <FileText className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate max-w-xs">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                  {onRemoveDocument && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => onRemoveDocument(index)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              )
            })}

            {/* Existing documents */}
            {existingDocuments.map((doc) => {
              const isImage = isImageDocument(doc.documentUrl, doc.fileName)
              
              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-2 p-2 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="relative w-12 h-12 shrink-0 rounded-md overflow-hidden bg-muted flex items-center justify-center">
                    {isImage ? (
                      <Image
                        src={doc.documentUrl}
                        alt={doc.fileName}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <FileText className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.fileName}</p>
                    <p className="text-xs text-muted-foreground">Existing document</p>
                  </div>
                  {onRemoveExistingDocument && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => onRemoveExistingDocument(doc.id)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}


