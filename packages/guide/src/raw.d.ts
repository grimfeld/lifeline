// A page's Markdown as text: Vite's `?raw`, and the MCP build's loader for the same suffix.
declare module "*.md?raw" {
  const text: string;
  export default text;
}
