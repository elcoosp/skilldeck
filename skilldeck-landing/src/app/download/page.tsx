'use client'

import { Download, Github, Laptop, Monitor, Terminal } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PageLayout } from '@/components/shared/PageLayout'
import { Button } from '@/components/ui/button'

function detectPlatform(): string {
  if (typeof window === 'undefined') return 'unknown'
  const ua = navigator.userAgent
  if (/Macintosh|MacIntel|MacPPC/.test(ua)) return 'mac'
  if (/Win32|Win64|Windows/.test(ua)) return 'windows'
  if (/Linux|X11/.test(ua)) return 'linux'
  return 'unknown'
}

const PLATFORMS = [
  {
    id: 'mac',
    name: 'macOS',
    icon: Laptop,
    arch: 'Apple Silicon and Intel',
    minVersion: 'macOS 12+',
    size: '~45 MB'
  },
  {
    id: 'windows',
    name: 'Windows',
    icon: Monitor,
    arch: 'x64',
    minVersion: 'Windows 10+',
    size: '~50 MB'
  },
  {
    id: 'linux',
    name: 'Linux',
    icon: Terminal,
    arch: 'x64 (AppImage)',
    minVersion: 'glibc 2.31+',
    size: '~48 MB'
  }
]

const SYSTEM_REQUIREMENTS = [
  { label: 'RAM', value: '4 GB minimum, 8 GB recommended' },
  { label: 'Disk Space', value: '200 MB for SkillDeck, model storage varies' },
  {
    label: 'Network',
    value: 'Required for OpenAI/Claude, optional for Ollama'
  },
  { label: 'Ollama', value: 'Optional, for fully local model inference' }
]

export default function DownloadPage() {
  const [platform, setPlatform] = useState('unknown')

  useEffect(() => {
    setPlatform(detectPlatform())
  }, [])

  return (
    <PageLayout>
      <div className="py-16 sm:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
              Download <span className="gradient-text">SkillDeck</span>
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Free and open source. No account required. No cloud dependency.
              Works on macOS, Windows, and Linux.
            </p>
            {platform !== 'unknown' && (
              <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20">
                <Download className="w-4 h-4" />
                Detected:{' '}
                {PLATFORMS.find((p) => p.id === platform)?.name ??
                  'your platform'}
              </div>
            )}
          </div>

          {/* Download cards */}
          <div className="grid sm:grid-cols-3 gap-4 mb-16">
            {PLATFORMS.map((p) => {
              const isDetected = p.id === platform
              const Icon = p.icon
              return (
                <div
                  key={p.id}
                  className={`glass rounded-2xl p-6 border transition-all duration-300 h-full ${
                    isDetected
                      ? 'border-primary/40 ring-1 ring-primary/20'
                      : 'border-border'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.arch}</p>
                    </div>
                    {isDetected && (
                      <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] bg-primary/10 text-primary border border-primary/20">
                        Recommended
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 text-sm mb-5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Version</span>
                      <span className="text-foreground font-medium">0.1.0</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Size</span>
                      <span className="text-foreground font-medium">
                        {p.size}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Requires</span>
                      <span className="text-foreground font-medium">
                        {p.minVersion}
                      </span>
                    </div>
                  </div>
                  <Button
                    className={`w-full ${
                      isDetected
                        ? 'bg-gradient-to-r from-blue-800 to-blue-500 hover:from-blue-500 hover:to-blue-800 text-white border-0 shadow-lg shadow-blue-500/25'
                        : 'bg-card hover:bg-white/10 text-foreground border border-border'
                    }`}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download for {p.name}
                  </Button>
                </div>
              )
            })}
          </div>

          {/* System requirements */}
          <div className="glass rounded-2xl p-6 lg:p-8 border border-border mb-12">
            <h2 className="text-xl font-bold text-foreground mb-6">
              System Requirements
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {SYSTEM_REQUIREMENTS.map((req) => (
                <div key={req.label} className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">
                    {req.label}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {req.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* GitHub releases */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              All releases are available on GitHub with checksums for
              verification.
            </p>
            <Button
              variant="outline"
              size="lg"
              className="border-border hover:bg-white/5 text-foreground"
              asChild
            >
              <a
                href="https://github.com/elcoosp/skilldeck/releases"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="w-5 h-5 mr-2" />
                View All Releases on GitHub
              </a>
            </Button>
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
