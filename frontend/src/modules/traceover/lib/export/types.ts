/**
 * Project metadata for export headers.
 * Replaces Titan Takeoff's persistence/types.ProjectMetadata.
 */
export interface ProjectMetadata {
  projectName?: string;
  projectNumber?: string;
  date?: string;
  estimatorName?: string;
  tenantLogoUrl?: string;
}
