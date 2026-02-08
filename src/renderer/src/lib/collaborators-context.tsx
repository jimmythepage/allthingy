import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { useGitHubStore } from '../stores/github'

export interface CollaboratorInfo {
  login: string
  avatar_url?: string
}

interface CollaboratorsContextValue {
  collaborators: CollaboratorInfo[]
  repoFullName: string | null
}

const CollaboratorsContext = createContext<CollaboratorsContextValue>({
  collaborators: [],
  repoFullName: null
})

export function useCollaborators(): CollaboratorInfo[] {
  return useContext(CollaboratorsContext).collaborators
}

export function useRepoFullName(): string | null {
  return useContext(CollaboratorsContext).repoFullName
}

interface Props {
  workspacePath: string
  children: ReactNode
}

export function CollaboratorsProvider({ workspacePath, children }: Props): JSX.Element {
  const { token } = useGitHubStore()
  const [collaborators, setCollaborators] = useState<CollaboratorInfo[]>([])
  const [repoFullName, setRepoFullName] = useState<string | null>(null)

  useEffect(() => {
    if (!token || !workspacePath) return

    async function fetchCollabs(): Promise<void> {
      try {
        const remote = await window.api.git.getRemote(workspacePath)
        if (!remote) return
        const match = remote.match(/github\.com[:/](.+?)(?:\.git)?$/)
        if (!match) return
        const repo = match[1]
        setRepoFullName(repo)
        const collabs = await window.api.sharing.listCollaborators(token!, repo)
        setCollaborators(
          collabs.map((c: { login: string; avatar_url?: string }) => ({
            login: c.login,
            avatar_url: c.avatar_url
          }))
        )
      } catch {
        // silently fail
      }
    }

    fetchCollabs()
    const interval = setInterval(fetchCollabs, 60000)
    return () => clearInterval(interval)
  }, [token, workspacePath])

  return (
    <CollaboratorsContext.Provider value={{ collaborators, repoFullName }}>
      {children}
    </CollaboratorsContext.Provider>
  )
}
