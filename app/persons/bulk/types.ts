// Shared types for the bulk grid. Kept out of actions.ts because a
// "use server" module may only export async functions — exporting the
// initial state object from there breaks the whole action module at runtime.

export type BulkRowError = { row: number; message: string };

export type BulkState = {
  status: "idle" | "error";
  message?: string;
  rowErrors?: BulkRowError[];
};

export const BULK_IDLE: BulkState = { status: "idle" };
