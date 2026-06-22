declare module "@tauri-apps/api/core" {
  export function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
}
