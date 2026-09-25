export {};

// Minimal ambient typings for the parts of the File System Access API not yet
// covered by TypeScript's bundled DOM lib (Window.showDirectoryPicker).
declare global {
  interface DirectoryPickerOptions {
    mode?: 'read' | 'readwrite';
  }

  interface Window {
    showDirectoryPicker(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
  }
}
