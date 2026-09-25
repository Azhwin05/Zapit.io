'use client';

import { useRef, useState, useCallback } from 'react';
import { CloudUpload, FileText, Image, Film, X, Send, Info, AlertCircle, Loader2, TriangleAlert, FolderOpen, FolderCheck } from 'lucide-react';
import { SafetyNumber } from './SafetyNumber';

const LARGE_FILE_WARN_BYTES = 500 * 1024 * 1024; // 500 MB

interface ConnectedScreenProps {
  onSend: (files: File[]) => Promise<void>;
  /** Name of the folder chosen for incoming files streamed straight to disk, if any. */
  saveDirName?: string | null;
  /** Opens the save-folder picker. Omitted entirely when the browser doesn't support it. */
  onChooseSaveFolder?: () => void;
  safetyNumber?: string | null;
  safetyVerified?: boolean;
  onVerifySafety?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ file }: { file: File }) {
  if (file.type.startsWith('image/')) return <Image className="w-4 h-4 text-secondary" strokeWidth={1.5} />;
  if (file.type.startsWith('video/')) return <Film  className="w-4 h-4 text-secondary" strokeWidth={1.5} />;
  return <FileText className="w-4 h-4 text-on-surface-variant" strokeWidth={1.5} />;
}

export function ConnectedScreen({
  onSend, saveDirName, onChooseSaveFolder,
  safetyNumber, safetyVerified, onVerifySafety,
}: ConnectedScreenProps) {
  const [dragging, setDragging] = useState(false);
  const [staged,   setStaged]   = useState<File[]>([]);
  const [sending,  setSending]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    const incoming = Array.from(fileList);
    setStaged((prev) => {
      const existing = new Set(prev.map((f) => `${f.name}|${f.size}`));
      return [...prev, ...incoming.filter((f) => !existing.has(`${f.name}|${f.size}`))];
    });
  }, []);

  const removeFile = (idx: number) =>
    setStaged((prev) => prev.filter((_, i) => i !== idx));

  const handleSend = async () => {
    if (staged.length === 0 || sending) return;
    setSending(true);
    setError(null);
    try {
      await onSend(staged);
      setStaged([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transfer failed — try again');
    } finally {
      setSending(false);
    }
  };

  const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onDrop      = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const totalBytes = staged.reduce((s, f) => s + f.size, 0);

  return (
    <main className="flex-grow flex flex-col items-center justify-center px-6 py-12 animate-fade-in">
      <div className="w-full max-w-3xl mx-auto flex flex-col items-center gap-8">

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="font-display font-bold text-5xl text-on-surface tracking-tight">
            Connected and Ready
          </h1>
          <p className="text-lg text-on-surface-variant">
            Your secure session is active. Add files below, then hit Send.
          </p>
        </div>

        {safetyNumber && (
          <SafetyNumber
            safetyNumber={safetyNumber}
            verified={!!safetyVerified}
            onVerify={() => onVerifySafety?.()}
          />
        )}

        {/* Save-folder picker — streams incoming files to disk instead of RAM */}
        {onChooseSaveFolder && (
          <button
            onClick={onChooseSaveFolder}
            className="flex items-center gap-2 px-4 py-2 rounded-btn text-sm font-medium
                       border border-outline-variant/40 hover:bg-surface-low transition-colors
                       text-on-surface-variant"
          >
            {saveDirName ? (
              <>
                <FolderCheck className="w-4 h-4 text-primary" strokeWidth={1.5} />
                Saving received files to <span className="font-semibold text-on-surface">{saveDirName}</span>
              </>
            ) : (
              <>
                <FolderOpen className="w-4 h-4" strokeWidth={1.5} />
                Choose a folder for received files (recommended for large transfers)
              </>
            )}
          </button>
        )}

        {/* Error banner */}
        {error && (
          <div className="w-full flex items-center gap-3 px-4 py-3 bg-error/10 border border-error/20
                          rounded-xl text-error text-sm font-body">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto p-0.5 hover:opacity-70">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Drop Zone */}
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => !sending && inputRef.current?.click()}
          className={[
            'w-full bg-surface-white rounded-modal flex flex-col items-center justify-center',
            'min-h-[240px] transition-all duration-300 group shadow-l1',
            sending ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
            dragging
              ? 'border-dashed-primary-active bg-primary/5'
              : 'border-dashed-primary hover:bg-primary/[0.03]',
          ].join(' ')}
        >
          <div className={[
            'w-16 h-16 rounded-full bg-surface-mid flex items-center justify-center mb-4',
            'group-hover:scale-110 transition-transform duration-500 ease-out',
            dragging ? 'scale-110 bg-primary/10' : '',
          ].join(' ')}>
            <CloudUpload className="w-8 h-8 text-primary" strokeWidth={1.5} />
          </div>

          <h2 className="font-display font-semibold text-xl text-on-surface mb-1">
            {dragging ? 'Drop to add' : 'Drag & drop or click to browse'}
          </h2>
          <p className="text-sm text-on-surface-variant mb-5">
            Photos, Videos, Documents — any file type
          </p>

          <button
            disabled={sending}
            onClick={(e) => { e.stopPropagation(); if (!sending) inputRef.current?.click(); }}
            className="px-7 py-2.5 bg-primary text-white rounded-btn font-body font-medium text-sm
                       hover:bg-primary-dim transition-colors shadow-l1 active:scale-95
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Select Files
          </button>

          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
            onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
          />
        </div>

        {/* Staged file list */}
        {staged.length > 0 && (
          <div className="w-full bg-surface-white rounded-modal shadow-l1 overflow-hidden">
            {totalBytes > LARGE_FILE_WARN_BYTES && (
              <div className="flex items-start gap-2.5 px-5 py-3 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs">
                <TriangleAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  <strong>Large transfer ({formatBytes(totalBytes)})</strong> — unless the receiver has
                  chosen a save folder, incoming chunks are held in RAM until the transfer completes and
                  it may fail if their device runs low on memory. Connection drops mid-transfer require
                  a full restart.
                </span>
              </div>
            )}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-surface-mid">
              <span className="font-body font-semibold text-on-surface text-sm">
                {staged.length} {staged.length === 1 ? 'file' : 'files'} ready
                <span className="ml-2 text-on-surface-variant font-normal">
                  ({formatBytes(totalBytes)})
                </span>
              </span>
              <button
                disabled={sending}
                onClick={() => { setStaged([]); setError(null); }}
                className="text-xs text-on-surface-variant hover:text-error transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Clear all
              </button>
            </div>

            <ul className="divide-y divide-surface-mid max-h-52 overflow-y-auto">
              {staged.map((file, idx) => (
                <li key={`${file.name}-${idx}`}
                    className="flex items-center gap-3 px-5 py-3 group/row">
                  <div className="w-8 h-8 rounded-lg bg-surface-low flex items-center justify-center shrink-0">
                    <FileIcon file={file} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-body font-medium text-on-surface truncate">{file.name}</p>
                    <p className="text-xs text-on-surface-variant">{formatBytes(file.size)}</p>
                  </div>
                  {!sending && (
                    <button
                      onClick={() => removeFile(idx)}
                      className="opacity-0 group-hover/row:opacity-100 transition-opacity p-1
                                 rounded text-on-surface-variant hover:text-error"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>

            <div className="px-5 py-4 flex items-center justify-between bg-surface-low">
              <div className="flex items-center gap-1.5 text-on-surface-variant/70 text-xs">
                <Info className="w-3.5 h-3.5" />
                End-to-end encrypted · direct P2P transfer
              </div>
              <button
                onClick={handleSend}
                disabled={sending}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-btn
                           font-body font-semibold text-sm hover:bg-primary-dim transition-colors
                           shadow-primary-glow active:scale-95
                           disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-primary"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send {staged.length === 1 ? 'File' : 'Files'}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
