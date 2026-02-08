import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { useGitHubStore } from '../stores/github'

export interface CollaboratorInfo {
  login: string
  avatar_url?: string
}

const CollaboratorsContext = createContext<CollaboratorInfo[]>([])

export function useCollaborators(): CollaboratorInfo[] {
  return useContext(CollaboratorsContext)
}

interface Props {
  workspacePath: string
  children: ReactNode
}

export function CollaboratorsProvider({ workspacePath, children }: Props): JSX.Element {
  const { token } = useGitHubStore()
  const [collaborators, setCollaborators] = useState<CollaboratorInfo[]>([])

  useEffect(() => {
    if (!token || !workspacePath) return

    async function fetchCollabs(): Promise<void> {
      try {
        const remote = await window.api.git.getRemote(workspacePath)
        if (!remote) return
        const match = remote.match(/github\.com[:/](.+?)(?:\.git)?$/)
        if (!match) return
        const repoFullName = match[1]
        const collabs = await window.api.sharing.listCollaborators(token!, repoFullName)
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
    // Refresh every 60 seconds
    const interval = setInterval(fetchCollabs, 60000)
    return () => clearInterval(interval)
  }, [token, workspacePath])

  return (
    <CollaboratorsContext.Provider value={collaborators}>
      {children}
    </CollaboratorsContext.Provider>
  )
}
