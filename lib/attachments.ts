export const ATTACHMENTS_BUCKET = "event-attachments";
export const MAX_ATTACHMENTS_PER_EVENT = 5;
export const MAX_ATTACHMENT_SIZE_BYTES = 15 * 1024 * 1024;

export interface EventAttachment {
  id: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
}

export function isAllowedAttachmentType(contentType: string): boolean {
  return contentType === "application/pdf" || contentType.startsWith("image/");
}

export function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
}

export function buildStoragePath(
  familyId: string,
  eventId: string,
  attachmentId: string,
  fileName: string
): string {
  return `${familyId}/${eventId}/${attachmentId}-${sanitizeFileName(fileName)}`;
}
