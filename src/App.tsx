import { Trans } from '@lingui/react/macro'
import './App.css'
import { Button } from '@/components/ui/button'

function App() {
  return (
    <main className="container">
      <h1>
        <Trans>Welcome to Tauri + React</Trans>
      </h1>

      <Button>
        <Trans>Click on the Tauri, Vite, and React logos to learn more.</Trans>
      </Button>
    </main>
  )
}

export default App
