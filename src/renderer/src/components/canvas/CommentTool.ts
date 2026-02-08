import { BaseBoxShapeTool } from 'tldraw'
import { COMMENT_SHAPE_TYPE } from './CommentShape'

export class CommentTool extends BaseBoxShapeTool {
  static override id = 'board-comment'
  static override initial = 'idle'
  override shapeType = COMMENT_SHAPE_TYPE
}
