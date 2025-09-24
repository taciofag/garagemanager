import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';

import { DocumentsApi } from '../api/resources';
import type { DocumentItem } from '../types';
import { Loading } from './Loading';

interface DocumentManagerProps {
  entityType: 'vehicle' | 'driver' | 'rental';
  entityId: string | null;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  emptyMessage?: string;
}

const bytesToSize = (bytes: number) => {
  if (!bytes) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const sizes = ['B', 'KB', 'MB', 'GB'];
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

export const DocumentManager: React.FC<DocumentManagerProps> = ({
  entityType,
  entityId,
  isOpen,
  onClose,
  title,
  emptyMessage,
}) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setFeedback(null);
      setError(null);
      setIsDragOver(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setFeedback(null);
    setError(null);
    setIsDragOver(false);
  }, [entityId, isOpen]);

  const enabled = Boolean(isOpen && entityId);

  const documentsQuery = useQuery({
    queryKey: ['documents', entityType, entityId],
    queryFn: () => DocumentsApi.list(entityType, entityId as string),
    enabled,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => DocumentsApi.upload(entityType, entityId as string, file),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['documents', entityType, entityId] });
      setFeedback('Documento enviado com sucesso.');
      setError(null);
    },
    onError: (err) => {
      setError((err as Error).message);
      setFeedback(null);
    },
  });
  const { mutate: triggerUpload, isPending: isUploading } = uploadMutation;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => DocumentsApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['documents', entityType, entityId] });
      setFeedback('Documento removido.');
      setError(null);
    },
    onError: (err) => setError((err as Error).message),
  });

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file || !entityId || isUploading) {
        return;
      }
      setFeedback(null);
      setError(null);
      triggerUpload(file);
    },
    [entityId, isUploading, triggerUpload]
  );

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files);
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
    handleFiles(event.dataTransfer.files);
    event.dataTransfer.clearData();
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isDragOver) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && event.currentTarget.contains(nextTarget)) {
      return;
    }
    setIsDragOver(false);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="flex w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">{title ?? 'Documentos anexados'}</h3>
            <p className="text-xs text-slate-500">Arraste arquivos para a área abaixo ou utilize o botão para selecionar PDFs, imagens ou comprovantes.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            Fechar
          </button>
        </header>

        {!entityId ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500">
            {emptyMessage ?? 'Selecione um registro para anexar documentos.'}
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Total de documentos: {documentsQuery.data?.length ?? 0}</span>
              <div>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="rounded-md border border-primary/40 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-60"
                >
                  {isUploading ? 'Enviando...' : 'Anexar documento'}
                </button>
              </div>
            </div>

            <div
              className={`flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-6 py-10 text-center transition-colors ${
                isDragOver ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-slate-50 text-slate-500'
              } ${!entityId || isUploading ? 'opacity-60' : ''}`}
              onDragEnter={handleDragOver}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <p className="text-sm font-medium">Solte os arquivos aqui para enviar</p>
              <p className="text-xs">Formatos suportados: PDF, JPEG, PNG. Tamanho máximo conforme limite do servidor.</p>
            </div>

            {feedback ? <div className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-600">{feedback}</div> : null}
            {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div> : null}

            {documentsQuery.isLoading ? (
              <Loading label="Carregando documentos..." />
            ) : (documentsQuery.data?.length ?? 0) === 0 ? (
              <div className="rounded-md border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                Nenhum documento anexado até o momento.
              </div>
            ) : (
              <ul className="divide-y divide-slate-200 text-sm">
                {(documentsQuery.data as DocumentItem[]).map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between py-3">
                    <div>
                      <div className="font-medium text-slate-700">{doc.original_name}</div>
                      <div className="text-xs text-slate-400">
                        {bytesToSize(doc.size_bytes)} - {new Date(doc.created_at).toLocaleString('pt-BR')}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={DocumentsApi.downloadUrl(doc.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                      >
                        Baixar
                      </a>
                      <button
                        type="button"
                        className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                        onClick={() => deleteMutation.mutate(doc.id)}
                      >
                        Excluir
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
