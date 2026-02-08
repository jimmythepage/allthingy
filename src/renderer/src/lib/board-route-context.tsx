import { createContext, useContext, type ReactNode } from 'react'

interface BoardRouteContextValue {
  workspacePath: string
  boardId: string
}

const BoardRouteContext = createContext<BoardRouteContextValue | null>(null)

export function BoardRouteProvider({
  workspacePath,
  boardId,
  children
}: {
  workspacePath: string
  boardId: string
  children: ReactNode
}): JSX.Element {
  return (
    <BoardRouteContext.Provider value={{ workspacePath, boardId }}>
      {children}
    </BoardRouteContext.Provider>
  )
}

export function useBoardRoute(): BoardRouteContextValue | null {
  return useContext(BoardRouteContext)
}
