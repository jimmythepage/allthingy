import { BaseBoxShapeTool } from 'tldraw'
import { MARKDOWN_NOTEBOOK_TYPE } from './MarkdownShape'

export class MarkdownNotebookTool extends BaseBoxShapeTool {
  static override id = 'markdown-notebook'
  static override initial = 'idle'
  override shapeType = MARKDOWN_NOTEBOOK_TYPE
}
