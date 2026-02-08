import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Board from './pages/Board'
import ReadNotebook from './pages/ReadNotebook'
import Settings from './pages/Settings'

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/board/:workspacePath/:boardId" element={<Board />} />
      <Route path="/read/:encodedWorkspacePath/:boardId/:notebookId" element={<ReadNotebook />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  )
}
