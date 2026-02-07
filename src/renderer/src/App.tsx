import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Board from './pages/Board'
import Settings from './pages/Settings'

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/board/:workspacePath/:boardId" element={<Board />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  )
}
