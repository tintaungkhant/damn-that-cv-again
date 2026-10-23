import { z } from "zod";

// Percent of the chat area. The conversation keeps at least 35%, so the workspace never exceeds 65%.
export const workspaceSize = { min: 30, max: 65, default: 45 };
export const workspacePreferenceKey = "cv-workspace-panel";
const preference = z.object({ open: z.boolean(), size: z.number() });
export type WorkspacePreference = z.infer<typeof preference>;

export function readWorkspacePreference(raw: string | null): WorkspacePreference {
  try {
    const value = preference.parse(JSON.parse(raw ?? ""));
    return { open: value.open, size: Math.min(workspaceSize.max, Math.max(workspaceSize.min, value.size)) };
  } catch {
    return { open: true, size: workspaceSize.default };
  }
}
