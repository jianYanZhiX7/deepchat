export type AigotokenAuthState = 'signed-out' | 'pending-browser' | 'authenticated' | 'error'

export type AigotokenAuthStatus = {
  state: AigotokenAuthState
  authenticated: boolean
  error?: string
}
