/** True only when an existing editor tab already shows the requested saved template. */
export function shouldReuseEditorTab(
  openTemplatePath: string | null,
  requestedTemplatePath: string | null,
): boolean {
  return requestedTemplatePath !== null && openTemplatePath === requestedTemplatePath;
}
