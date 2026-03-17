import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { AddMcpServerPayload } from '@/lib/bindings'
import { commands } from '@/lib/bindings'

type FormTransport = 'stdio' | 'sse'

interface CustomFormState {
  name: string
  transport: FormTransport
  command: string
  args: string
  url: string
  env: string
}

interface CustomServerFormProps {
  onSuccess: () => void
}

export function CustomServerForm({ onSuccess }: CustomServerFormProps) {
  const qc = useQueryClient()
  const [form, setForm] = useState<CustomFormState>({
    name: '',
    transport: 'stdio',
    command: 'npx',
    args: '',
    url: '',
    env: ''
  })

  const addMut = useMutation({
    mutationFn: async (params: AddMcpServerPayload) => {
      const res = await commands.addMcpServer(params)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mcp-servers'] })
      toast.success(`MCP server "${form.name}" added`)
      onSuccess()
    },
    onError: (e: unknown) => toast.error(`Failed to add server: ${e}`)
  })

  const setField =
    (key: keyof CustomFormState) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >
    ) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = () => {
    if (!form.name.trim()) {
      toast.error('Server name is required')
      return
    }
    if (form.transport === 'stdio' && !form.command.trim()) {
      toast.error('Command is required for stdio transport')
      return
    }
    if (form.transport === 'sse' && !form.url.trim()) {
      toast.error('URL is required for SSE transport')
      return
    }

    let env: Record<string, string> | undefined
    if (form.env.trim()) {
      try {
        env = JSON.parse(form.env)
      } catch {
        toast.error('Env must be valid JSON, e.g. {"KEY": "value"}')
        return
      }
    }

    addMut.mutate({
      name: form.name.trim(),
      transport: form.transport,
      command: form.transport === 'stdio' ? form.command.trim() : null,
      args:
        form.transport === 'stdio' && form.args.trim()
          ? form.args.trim().split(/\s+/)
          : null,
      url: form.transport === 'sse' ? form.url.trim() : null,
      env: env ?? null
    })
  }

  const inp =
    'w-full h-7 rounded-md border border-input bg-background px-2.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'

  return (
    <div className="space-y-2.5">
      <div>
        <label className="block text-[11px] text-muted-foreground mb-1">
          Name
        </label>
        <input
          className={inp}
          placeholder="my-server"
          value={form.name}
          onChange={setField('name')}
        />
      </div>
      <div>
        <label className="block text-[11px] text-muted-foreground mb-1">
          Transport
        </label>
        <select
          className={inp}
          value={form.transport}
          onChange={setField('transport')}
        >
          <option value="stdio">stdio (local process)</option>
          <option value="sse">SSE (HTTP endpoint)</option>
        </select>
      </div>
      {form.transport === 'stdio' ? (
        <>
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">
              Command
            </label>
            <input
              className={inp}
              placeholder="npx"
              value={form.command}
              onChange={setField('command')}
            />
          </div>
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">
              Arguments <span className="opacity-60">(space-separated)</span>
            </label>
            <input
              className={inp}
              placeholder="-y @modelcontextprotocol/server-filesystem ."
              value={form.args}
              onChange={setField('args')}
            />
          </div>
        </>
      ) : (
        <div>
          <label className="block text-[11px] text-muted-foreground mb-1">
            URL
          </label>
          <input
            className={inp}
            placeholder="http://localhost:8080/sse"
            value={form.url}
            onChange={setField('url')}
          />
        </div>
      )}
      <div>
        <label className="block text-[11px] text-muted-foreground mb-1">
          Env vars <span className="opacity-60">(optional JSON)</span>
        </label>
        <input
          className={inp}
          placeholder='{"GITHUB_TOKEN": "ghp_..."}'
          value={form.env}
          onChange={setField('env')}
        />
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={addMut.isPending}
        className="w-full h-7 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
      >
        {addMut.isPending ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Plus className="size-3" />
        )}
        Add Server
      </button>
    </div>
  )
}
